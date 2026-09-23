import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { triggerDownload } from "./format.js";

/** CubeTextureLoader 约定顺序 */
export const FACE_NAMES = ["px", "nx", "py", "ny", "pz", "nz"];
export const FACE_LABELS = {
  px: "右 +X",
  nx: "左 -X",
  py: "上 +Y",
  ny: "下 -Y",
  pz: "前 +Z",
  nz: "后 -Z",
};

/** 十字展开布局 */
export const CROSS_LAYOUT = [
  { name: "py", col: 1, row: 0 },
  { name: "nx", col: 0, row: 1 },
  { name: "pz", col: 1, row: 1 },
  { name: "px", col: 2, row: 1 },
  { name: "nz", col: 3, row: 1 },
  { name: "ny", col: 1, row: 2 },
];

export const FORMAT_OPTIONS = [
  { value: "png", label: "PNG", mime: "image/png", ext: "png" },
  { value: "jpeg", label: "JPEG", mime: "image/jpeg", ext: "jpg" },
];

export const SIZE_OPTIONS = [256, 512, 1024, 2048];

function formatMeta(format = "png") {
  return FORMAT_OPTIONS.find((o) => o.value === format) || FORMAT_OPTIONS[0];
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("导出失败"));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

function flipYIntoImageData(buffer, size, imageData) {
  const row = size * 4;
  for (let y = 0; y < size; y += 1) {
    const src = (size - 1 - y) * row;
    const dst = y * row;
    imageData.data.set(buffer.subarray(src, src + row), dst);
  }
}

/**
 * 从本地文件加载球面图（HDR / EXR / 普通图片）
 * @returns {Promise<{ texture: THREE.Texture, isHdr: boolean, width: number, height: number }>}
 */
export function loadSphericalMap(file) {
  const name = (file.name || "").toLowerCase();
  const isHdr = name.endsWith(".hdr") || file.type === "image/vnd.radiance";
  const isExr = name.endsWith(".exr") || file.type === "image/x-exr";

  if (isHdr || isExr) {
    const loader = isExr ? new EXRLoader() : new HDRLoader();
    loader.setDataType?.(THREE.HalfFloatType);
    if (isExr && typeof loader.setOutputFormat === "function") {
      loader.setOutputFormat(THREE.RGBAFormat);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.onload = () => {
        try {
          const texData = loader.parse(reader.result);
          if (!texData?.data || !texData.width || !texData.height) {
            throw new Error("HDR 数据无效");
          }
          const texture = new THREE.DataTexture(
            texData.data,
            texData.width,
            texData.height,
            texData.format ?? THREE.RGBAFormat,
            texData.type ?? THREE.HalfFloatType
          );
          texture.colorSpace = texData.colorSpace ?? THREE.LinearSRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.flipY = texData.flipY ?? true;
          // 球面图左右接缝处必须 Repeat，否则会出现竖向白线
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.needsUpdate = true;
          resolve({
            texture,
            isHdr: true,
            width: texData.width,
            height: texData.height,
          });
        } catch (err) {
          reject(new Error(err?.message || "HDR 解析失败"));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        URL.revokeObjectURL(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.needsUpdate = true;
        const img = texture.image;
        resolve({
          texture,
          isHdr: false,
          width: img?.naturalWidth || img?.width || 0,
          height: img?.naturalHeight || img?.height || 0,
        });
      },
      undefined,
      () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片加载失败"));
      }
    );
  });
}

export function isSphericalFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  return (
    /\.(hdr|exr|png|jpe?g|webp)$/i.test(name) ||
    file.type === "image/vnd.radiance" ||
    file.type === "image/x-exr" ||
    /^image\/(png|jpeg|webp|jpg)/.test(file.type)
  );
}

export function isHdrFile(file) {
  return isSphericalFile(file);
}

export async function loadHdrTexture(file) {
  const { texture } = await loadSphericalMap(file);
  return texture;
}

/**
 * CubeMap 十字预览工作室：仅水平拖动旋转朝向
 * 用 scene.background 等距柱状采样（按视线方向），避免球面 UV 接缝
 */
export function createHdrStudio(options) {
  const {
    dragRoot,
    crossCanvases,
    mapTexture,
    isHdr = true,
    exposure = 1.1,
    previewFaceSize = 192,
    onChange,
  } = options;

  mapTexture.wrapS = THREE.RepeatWrapping;
  mapTexture.wrapT = THREE.ClampToEdgeWrapping;
  mapTexture.mapping = THREE.EquirectangularReflectionMapping;
  mapTexture.needsUpdate = true;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x111111, 1);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // 按方向采样全景，不会出现球面 UV 接缝
  scene.background = mapTexture;

  const faceSize = Math.max(64, Math.min(512, previewFaceSize));
  renderer.setSize(faceSize, faceSize, false);

  const faceRT = new THREE.WebGLRenderTarget(faceSize, faceSize, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  const faceCam = new THREE.PerspectiveCamera(90, 1, 0.1, 100);

  /** CubeTexture 六面朝向（与 CubeCamera 一致） */
  const FACE_LOOKS = [
    { look: [1, 0, 0], up: [0, -1, 0] }, // px
    { look: [-1, 0, 0], up: [0, -1, 0] }, // nx
    { look: [0, 1, 0], up: [0, 0, 1] }, // py
    { look: [0, -1, 0], up: [0, 0, -1] }, // ny
    { look: [0, 0, 1], up: [0, -1, 0] }, // pz
    { look: [0, 0, -1], up: [0, -1, 0] }, // nz
  ];

  const scratch = document.createElement("canvas");
  scratch.width = faceSize;
  scratch.height = faceSize;
  const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
  const imageData = scratchCtx.createImageData(faceSize, faceSize);
  const pixelBuffer = new Uint8Array(faceSize * faceSize * 4);

  let yaw = 0;
  let raf = 0;
  let facesDirty = true;
  let disposed = false;
  let currentExposure = exposure;
  let currentIsHdr = isHdr;
  let dragging = false;
  let lastX = 0;
  let moved = false;

  const nameToIndex = Object.fromEntries(FACE_NAMES.map((n, i) => [n, i]));
  const lookTarget = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  function applyExposure() {
    renderer.toneMapping = currentIsHdr ? THREE.ReinhardToneMapping : THREE.LinearToneMapping;
    renderer.toneMappingExposure = Math.max(0.01, currentExposure);
  }

  function renderFace(faceIndex, target, cam) {
    const face = FACE_LOOKS[faceIndex];
    lookTarget.set(face.look[0], face.look[1], face.look[2]).applyAxisAngle(yAxis, yaw);
    upVec.set(face.up[0], face.up[1], face.up[2]).applyAxisAngle(yAxis, yaw);
    cam.position.set(0, 0, 0);
    cam.up.copy(upVec);
    cam.lookAt(lookTarget);
    cam.updateMatrixWorld(true);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, cam);
  }

  applyExposure();

  function paintCross() {
    if (disposed || !crossCanvases?.length) return;

    applyExposure();

    for (const layout of CROSS_LAYOUT) {
      const idx = nameToIndex[layout.name];
      const target = crossCanvases[idx];
      if (!target) continue;
      renderFace(idx, faceRT, faceCam);
      renderer.readRenderTargetPixels(faceRT, 0, 0, faceSize, faceSize, pixelBuffer);
      flipYIntoImageData(pixelBuffer, faceSize, imageData);
      scratchCtx.putImageData(imageData, 0, 0);
      if (target.width !== faceSize || target.height !== faceSize) {
        target.width = faceSize;
        target.height = faceSize;
      }
      const ctx = target.getContext("2d");
      ctx.drawImage(scratch, 0, 0);
    }
    renderer.setRenderTarget(null);
    facesDirty = false;
    onChange?.({ yaw });
  }

  function tick() {
    if (disposed) return;
    if (facesDirty) paintCross();
    raf = requestAnimationFrame(tick);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    lastX = e.clientX;
    dragRoot.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    if (dx === 0) return;
    lastX = e.clientX;
    moved = true;
    yaw += dx * 0.005;
    facesDirty = true;
  }

  function onPointerUp(e) {
    dragging = false;
    dragRoot.releasePointerCapture?.(e.pointerId);
  }

  function wasDrag() {
    return moved;
  }

  dragRoot.addEventListener("pointerdown", onPointerDown);
  dragRoot.addEventListener("pointermove", onPointerMove);
  dragRoot.addEventListener("pointerup", onPointerUp);
  dragRoot.addEventListener("pointercancel", onPointerUp);

  requestAnimationFrame(() => {
    if (!disposed) {
      paintCross();
      tick();
    }
  });

  return {
    getYaw() {
      return yaw;
    },
    setYaw(value) {
      yaw = value;
      facesDirty = true;
    },
    wasDrag,
    setExposure(value) {
      currentExposure = value;
      applyExposure();
      facesDirty = true;
    },
    resetOrientation() {
      yaw = 0;
      facesDirty = true;
    },
    markDirty() {
      facesDirty = true;
    },
    async downloadFace(index, format = "png") {
      if (moved) return;
      paintCross();
      const canvas = crossCanvases[index];
      if (!canvas) return;
      const meta = formatMeta(format);
      const blob = await canvasToBlob(canvas, meta.mime);
      triggerDownload(blob, `${FACE_NAMES[index]}.${meta.ext}`);
    },
    async exportFaces(size = 512, format = "png") {
      const exportSize = Math.max(64, Math.min(2048, Math.round(size)));
      const meta = formatMeta(format);

      const exportRT = new THREE.WebGLRenderTarget(exportSize, exportSize, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.SRGBColorSpace,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });
      const exportCam = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
      const prevSize = renderer.getSize(new THREE.Vector2());
      renderer.setSize(exportSize, exportSize, false);

      const out = document.createElement("canvas");
      out.width = exportSize;
      out.height = exportSize;
      const ctx = out.getContext("2d");
      const img = ctx.createImageData(exportSize, exportSize);
      const buf = new Uint8Array(exportSize * exportSize * 4);
      const faces = [];

      applyExposure();

      try {
        for (let face = 0; face < 6; face += 1) {
          renderFace(face, exportRT, exportCam);
          renderer.readRenderTargetPixels(exportRT, 0, 0, exportSize, exportSize, buf);
          flipYIntoImageData(buf, exportSize, img);
          ctx.putImageData(img, 0, 0);
          const blob = await canvasToBlob(out, meta.mime);
          const name = FACE_NAMES[face];
          faces.push({
            name,
            label: FACE_LABELS[name],
            blob,
            url: URL.createObjectURL(blob),
            fileName: `${name}.${meta.ext}`,
          });
        }
      } finally {
        renderer.setRenderTarget(null);
        renderer.setSize(prevSize.x, prevSize.y, false);
        exportRT.dispose();
      }

      return {
        faces,
        faceSize: exportSize,
        format: meta.value,
        ext: meta.ext,
        exposure: currentExposure,
        yaw,
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      dragRoot.removeEventListener("pointerdown", onPointerDown);
      dragRoot.removeEventListener("pointermove", onPointerMove);
      dragRoot.removeEventListener("pointerup", onPointerUp);
      dragRoot.removeEventListener("pointercancel", onPointerUp);
      scene.background = null;
      faceRT.dispose();
      renderer.dispose();
    },
  };
}
