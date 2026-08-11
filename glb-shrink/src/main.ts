import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface InspectResult {
  fileName: string;
  fileSize: number;
  tris: number;
  verts: number;
}

interface CompressResult {
  fileName: string;
  sourceSize: number;
  outputSize: number;
  stats: { tris: number; sourceTris: number };
  data: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTris(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M 三角面`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k 三角面`;
  return `${n} 三角面`;
}

function savingsPercent(before: number, after: number): string {
  if (before <= 0) return '0%';
  const pct = ((before - after) / before) * 100;
  return `缩小 ${pct.toFixed(0)}%`;
}

class ModelViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private loader: GLTFLoader;
  private model: THREE.Object3D | null = null;
  private animId = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1018);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    this.camera.position.set(1.8, 1.2, 1.8);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.2;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 2);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(draco);

    this.animate = this.animate.bind(this);
    this.animate();
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      this.model = null;
    }
  }

  async loadUrl(url: string) {
    this.clear();
    const gltf = await this.loader.loadAsync(url);
    this.model = gltf.scene;
    this.frameModel(this.model);
    this.scene.add(this.model);
  }

  private frameModel(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8;

    object.position.sub(center);
    this.camera.position.set(dist * 0.7, dist * 0.55, dist * 0.7);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private animate() {
    this.animId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.animId);
    this.clear();
    this.renderer.dispose();
  }
}

// ── DOM refs ──
const dropzone = document.getElementById('dropzone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hero = document.getElementById('hero')!;
const sizeBefore = document.getElementById('size-before')!;
const sizeAfter = document.getElementById('size-after')!;
const savingsBadge = document.getElementById('savings-badge')!;
const heroSub = document.getElementById('hero-sub')!;
const fileMeta = document.getElementById('file-meta')!;
const fileNameEl = document.getElementById('file-name')!;
const fileTrisEl = document.getElementById('file-tris')!;
const controls = document.getElementById('controls')!;
const presetCards = document.getElementById('preset-cards')!;
const qualityInput = document.getElementById('quality') as HTMLInputElement;
const qualityHint = document.getElementById('quality-hint')!;
const compressBtn = document.getElementById('compress-btn')!;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const beforeStat = document.getElementById('before-stat')!;
const afterStat = document.getElementById('after-stat')!;
const emptyBefore = document.getElementById('empty-before')!;
const emptyAfter = document.getElementById('empty-after')!;

const canvasBefore = document.getElementById('canvas-before') as HTMLCanvasElement;
const canvasAfter = document.getElementById('canvas-after') as HTMLCanvasElement;

const viewerBefore = new ModelViewer(canvasBefore);
const viewerAfter = new ModelViewer(canvasAfter);

let currentFile: File | null = null;
let sourceBlobUrl: string | null = null;
let outputBlobUrl: string | null = null;
let outputFileName = 'model-draco.glb';

const HINTS: Record<number, string> = {
  0: '极小文件 — 适合远处背景道具，几乎看不清细节。',
  50: '平衡 — 大多数项目的最佳选择。',
  100: '最高细节 — 适合近距离观看，文件更大。',
};

function hintForQuality(q: number): string {
  if (q <= 20) return HINTS[0];
  if (q <= 40) return '较小文件 — 适合场景中的远景物体。';
  if (q <= 60) return HINTS[50];
  if (q <= 80) return '更多细节 — 边缘和纹理更清晰。';
  return HINTS[100];
}

function syncPresetCards(quality: number) {
  presetCards.querySelectorAll('.preset-card').forEach((card) => {
    const q = Number((card as HTMLElement).dataset.quality);
    card.classList.toggle('active', Math.abs(q - quality) < 1);
  });
  qualityHint.textContent = hintForQuality(quality);
}

function setQuality(quality: number) {
  qualityInput.value = String(quality);
  syncPresetCards(quality);
}

presetCards.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.preset-card') as HTMLElement | null;
  if (!card) return;
  setQuality(Number(card.dataset.quality));
});

qualityInput.addEventListener('input', () => {
  syncPresetCards(Number(qualityInput.value));
});

function resizeViewers() {
  const cards = document.querySelectorAll('.viewer-card');
  cards.forEach((card, i) => {
    const canvas = i === 0 ? canvasBefore : canvasAfter;
    const viewer = i === 0 ? viewerBefore : viewerAfter;
    const rect = card.getBoundingClientRect();
    viewer.resize(rect.width, rect.height);
  });
}

window.addEventListener('resize', resizeViewers);
new ResizeObserver(resizeViewers).observe(document.querySelector('.viewers')!);

function updateHero(beforeBytes: number, afterBytes: number, beforeTris: number, afterTris: number) {
  hero.hidden = false;
  sizeBefore.textContent = formatBytes(beforeBytes);
  sizeAfter.textContent = formatBytes(afterBytes);
  savingsBadge.textContent = savingsPercent(beforeBytes, afterBytes);
  heroSub.textContent = `${formatTris(beforeTris)} → ${formatTris(afterTris)} · Draco 几何体 + WebP 纹理`;
}

async function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.glb')) {
    alert('请拖放 .glb 文件。');
    return;
  }

  currentFile = file;
  if (sourceBlobUrl) URL.revokeObjectURL(sourceBlobUrl);
  if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
  outputBlobUrl = null;
  downloadBtn.hidden = true;
  viewerAfter.clear();
  emptyAfter.classList.remove('hidden');
  afterStat.textContent = '—';

  sourceBlobUrl = URL.createObjectURL(file);
  emptyBefore.classList.add('hidden');
  await viewerBefore.loadUrl(sourceBlobUrl);

  fileMeta.hidden = false;
  fileNameEl.textContent = file.name;
  controls.hidden = false;

  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/inspect', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    alert(err.error ?? '模型分析失败');
    return;
  }
  const data: InspectResult = await res.json();
  fileTrisEl.textContent = `${formatTris(data.tris)} · ${formatBytes(data.fileSize)}`;
  beforeStat.textContent = formatBytes(data.fileSize);
  hero.hidden = false;
  sizeBefore.textContent = formatBytes(data.fileSize);
  sizeAfter.textContent = '—';
  savingsBadge.textContent = '准备压缩';
  heroSub.textContent = `${formatTris(data.tris)} · 选择质量后点击压缩`;
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) void handleFile(file);
});

compressBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  const btnLabel = compressBtn.querySelector('.btn-label')!;
  const spinner = compressBtn.querySelector('.btn-spinner')!;
  compressBtn.setAttribute('disabled', 'true');
  btnLabel.textContent = '压缩中…';
  spinner.hidden = false;

  try {
    const form = new FormData();
    form.append('file', currentFile);
    form.append('quality', qualityInput.value);

    const res = await fetch('/api/compress', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '压缩失败');
    }

    const result: CompressResult = await res.json();
    outputFileName = result.fileName;

    const binary = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
    if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    outputBlobUrl = URL.createObjectURL(new Blob([binary], { type: 'model/gltf-binary' }));

    emptyAfter.classList.add('hidden');
    await viewerAfter.loadUrl(outputBlobUrl);

    afterStat.textContent = formatBytes(result.outputSize);
    updateHero(result.sourceSize, result.outputSize, result.stats.sourceTris, result.stats.tris);
    downloadBtn.hidden = false;
  } catch (err) {
    alert(err instanceof Error ? err.message : '压缩失败');
  } finally {
    compressBtn.removeAttribute('disabled');
    btnLabel.textContent = '压缩模型';
    spinner.hidden = true;
  }
});

downloadBtn.addEventListener('click', () => {
  if (!outputBlobUrl) return;
  const a = document.createElement('a');
  a.href = outputBlobUrl;
  a.download = outputFileName;
  a.click();
});

void resizeViewers();
syncPresetCards(50);
