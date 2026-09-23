<template>
  <div class="tool-page hdr-page">
    <div class="hdr-top">
      <div class="tool-title">
        <h2>HDR → CubeMap 天空盒</h2>
        <p>
          参照
          <a href="https://matheowis.github.io/HDRI-to-CubeMap/" target="_blank" rel="noopener"
            >HDRI-to-CubeMap</a
          >
          · CubeMap 十字预览 · 左右拖动旋转 · 导出六面
        </p>
      </div>
      <div class="hdr-toolbar">
        <el-button :disabled="busy" @click="pickFile">上传 HDRI</el-button>
        <el-select v-model="faceSize" style="width: 120px" :disabled="!studio">
          <el-option v-for="s in sizeOptions" :key="s" :value="s" :label="`${s}²`" />
        </el-select>
        <el-select v-model="format" style="width: 100px" :disabled="!studio">
          <el-option
            v-for="opt in formatOptions"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </el-select>
        <el-button :disabled="!studio" @click="resetOrientation">重置朝向</el-button>
        <el-button type="primary" :loading="busy" :disabled="!studio" @click="exportZip">
          保存 ZIP
        </el-button>
      </div>
    </div>

    <div
      class="hdr-workspace"
      :class="{ 'is-dragover': dragover }"
      @dragenter.prevent="dragover = true"
      @dragover.prevent="dragover = true"
      @dragleave.prevent="dragover = false"
      @drop.prevent="onDrop"
    >
      <div v-if="!file" class="hdr-empty" @click="pickFile">
        <el-icon><UploadFilled /></el-icon>
        <h3>拖放或点击上传球面图</h3>
        <p>支持 .hdr / .exr / .png / .jpg · 本地处理不上传</p>
      </div>

      <template v-else>
        <div ref="crossRootRef" class="hdr-main view-cross">
          <div class="cross-grid">
            <button
              v-for="cell in crossLayout"
              :key="cell.name"
              type="button"
              class="cross-cell"
              :style="{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }"
              :title="`下载 ${cell.name}.${formatExt}`"
              @click="downloadFace(faceIndex(cell.name))"
            >
              <canvas :ref="(el) => setFaceCanvas(faceIndex(cell.name), el)" />
              <span>{{ cell.name }} · {{ faceLabels[cell.name] }}</span>
            </button>
          </div>
          <div class="hdr-hint">左右拖动旋转朝向 · 点击单面可下载 · 不可上下拖动</div>
        </div>

        <aside class="hdr-side panel-card">
          <div class="list-header"><h3>参数</h3></div>
          <div class="list-summary">{{ summary }}</div>

          <div class="exposure-block">
            <div class="label-row">
              <span>Exposure</span>
              <strong>{{ exposure.toFixed(2) }}</strong>
            </div>
            <el-slider
              v-model="exposure"
              :min="0.1"
              :max="maxExposure"
              :step="0.05"
              :disabled="!studio"
            />
            <p class="side-tip">HDR 默认 Reinhard 色调映射 · 调曝光使画面可见</p>
          </div>

          <div class="orient-block">
            <div class="label-row">
              <span>水平朝向</span>
              <strong>{{ yawDeg }}°</strong>
            </div>
            <el-slider
              v-model="yawDeg"
              :min="-180"
              :max="180"
              :step="1"
              :disabled="!studio"
            />
          </div>

          <div class="side-actions">
            <el-button size="small" :disabled="!studio" @click="resetOrientation">重置朝向</el-button>
            <el-button
              size="small"
              type="primary"
              :loading="busy"
              :disabled="!studio"
              @click="exportZip"
            >
              导出六面 ZIP
            </el-button>
          </div>

          <div class="code-block">
            <div class="label-row"><span>Three.js 用法</span></div>
            <pre>{{ usageCode }}</pre>
          </div>
        </aside>
      </template>
    </div>

    <input
      ref="fileRef"
      type="file"
      hidden
      accept=".hdr,.exr,.png,.jpg,.jpeg,.webp,image/*"
      @change="onFileChange"
    />

    <el-alert
      v-if="status.text"
      class="status-alert"
      :title="status.text"
      :type="status.type"
      :closable="false"
      show-icon
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { UploadFilled } from "@element-plus/icons-vue";
import JSZip from "jszip";
import {
  CROSS_LAYOUT,
  FACE_LABELS,
  FACE_NAMES,
  FORMAT_OPTIONS,
  SIZE_OPTIONS,
  createHdrStudio,
  isSphericalFile,
  loadSphericalMap,
} from "../utils/hdrSkybox.js";
import { triggerDownload } from "../utils/format.js";

const faceLabels = FACE_LABELS;
const formatOptions = FORMAT_OPTIONS;
const sizeOptions = SIZE_OPTIONS;
const crossLayout = CROSS_LAYOUT;

const fileRef = ref(null);
const crossRootRef = ref(null);
const faceCanvasEls = ref(/** @type {(HTMLCanvasElement|null)[]} */ ([null, null, null, null, null, null]));
const file = ref(null);
const dragover = ref(false);
const busy = ref(false);
const faceSize = ref(512);
const format = ref("png");
const exposure = ref(1.1);
const maxExposure = 16;
const yawDeg = ref(0);
const syncingYaw = ref(false);
const srcSize = ref({ width: 0, height: 0 });
const isHdr = ref(true);
const status = ref({ text: "", type: "info" });

/** @type {import('vue').Ref<ReturnType<typeof createHdrStudio> | null>} */
const studio = ref(null);
/** @type {import('vue').Ref<import('three').Texture | null>} */
const texture = ref(null);

const formatExt = computed(
  () => FORMAT_OPTIONS.find((o) => o.value === format.value)?.ext || "png"
);

const summary = computed(() => {
  if (!file.value) return "暂无文件";
  const dim = srcSize.value.width
    ? `${srcSize.value.width}×${srcSize.value.height}`
    : "";
  const kind = isHdr.value ? "HDR" : "LDR";
  return [file.value.name, dim, kind].filter(Boolean).join(" · ");
});

const usageCode = computed(() => {
  const ext = formatExt.value;
  return `import * as THREE from 'three';

const loader = new THREE.CubeTextureLoader();
const skybox = loader.load([
  'px.${ext}', 'nx.${ext}', 'py.${ext}',
  'ny.${ext}', 'pz.${ext}', 'nz.${ext}'
]);
skybox.colorSpace = THREE.SRGBColorSpace;
scene.background = skybox;`;
});

function faceIndex(name) {
  return FACE_NAMES.indexOf(name);
}

function setStatus(type, text) {
  status.value = { type, text };
}

function setFaceCanvas(idx, el) {
  faceCanvasEls.value[idx] = el || null;
}

function pickFile() {
  if (!busy.value) fileRef.value?.click();
}

function onFileChange(e) {
  acceptFile(e.target.files?.[0]);
  e.target.value = "";
}

function onDrop(e) {
  dragover.value = false;
  if (!busy.value) acceptFile(e.dataTransfer?.files?.[0]);
}

function disposeStudio() {
  studio.value?.dispose();
  studio.value = null;
  texture.value?.dispose?.();
  texture.value = null;
}

async function acceptFile(f) {
  if (!f) return;
  if (!isSphericalFile(f)) {
    setStatus("error", "请选择 .hdr / .exr / .png / .jpg 球面图");
    return;
  }

  busy.value = true;
  disposeStudio();
  file.value = f;
  yawDeg.value = 0;

  try {
    setStatus("warning", "正在加载球面图…");
    const loaded = await loadSphericalMap(f);
    texture.value = loaded.texture;
    isHdr.value = loaded.isHdr;
    srcSize.value = { width: loaded.width, height: loaded.height };
    exposure.value = 1.1;

    await nextTick();
    await new Promise((r) => requestAnimationFrame(r));

    const root = crossRootRef.value;
    const faces = faceCanvasEls.value;
    if (!root || faces.some((c) => !c)) {
      throw new Error("预览画布未就绪，请重试");
    }

    studio.value = createHdrStudio({
      dragRoot: root,
      crossCanvases: faces,
      mapTexture: loaded.texture,
      isHdr: loaded.isHdr,
      exposure: exposure.value,
      previewFaceSize: 192,
      onChange: ({ yaw }) => {
        syncingYaw.value = true;
        yawDeg.value = Math.round((yaw * 180) / Math.PI);
        syncingYaw.value = false;
      },
    });

    setStatus("success", "已加载：左右拖动调整朝向，点击单面可下载");
  } catch (err) {
    disposeStudio();
    file.value = null;
    setStatus("error", err?.message || "加载失败");
  } finally {
    busy.value = false;
  }
}

function resetOrientation() {
  studio.value?.resetOrientation();
  yawDeg.value = 0;
}

async function downloadFace(idx) {
  if (!studio.value || idx < 0) return;
  if (studio.value.wasDrag?.()) return;
  try {
    await studio.value.downloadFace(idx, format.value);
    setStatus("success", `已下载 ${FACE_NAMES[idx]}.${formatExt.value}`);
  } catch (err) {
    setStatus("error", err?.message || "下载失败");
  }
}

async function exportZip() {
  if (!studio.value || !file.value || busy.value) return;
  busy.value = true;
  try {
    setStatus("warning", `正在导出 ${faceSize.value}² 六面 CubeMap…`);
    const result = await studio.value.exportFaces(faceSize.value, format.value);
    const zip = new JSZip();
    for (const face of result.faces) {
      zip.file(face.fileName, face.blob);
      URL.revokeObjectURL(face.url);
    }
    zip.file(
      "README.txt",
      [
        "CubeTextureLoader 天空盒（px nx py ny pz nz）",
        `源文件: ${file.value.name}`,
        `面尺寸: ${result.faceSize}`,
        `格式: ${result.format}`,
        `曝光: ${result.exposure}`,
        `朝向 yaw: ${(((result.yaw || 0) * 180) / Math.PI).toFixed(1)}°`,
        "",
        usageCode.value,
      ].join("\n")
    );
    const blob = await zip.generateAsync({ type: "blob" });
    const base = file.value.name.replace(/\.[^.]+$/, "");
    triggerDownload(blob, `${base}_cubemap.zip`);
    setStatus("success", `已导出 ${result.faceSize}² × 6 面 ZIP`);
  } catch (err) {
    setStatus("error", err?.message || "导出失败");
  } finally {
    busy.value = false;
  }
}

watch(exposure, (v) => {
  studio.value?.setExposure(v);
});

watch(yawDeg, (v) => {
  if (syncingYaw.value || !studio.value) return;
  studio.value.setYaw((v * Math.PI) / 180);
});

onUnmounted(() => {
  disposeStudio();
});
</script>

<style scoped>
.hdr-page {
  max-width: none;
  gap: 12px;
}

.hdr-top {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
}

.hdr-top .tool-title {
  margin-bottom: 0;
}

.hdr-top a {
  color: var(--brand);
  text-decoration: none;
}

.hdr-top a:hover {
  text-decoration: underline;
}

.hdr-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.hdr-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 14px;
}

.hdr-workspace.is-dragover {
  outline: 2px dashed var(--brand);
  outline-offset: -4px;
  border-radius: 18px;
}

.hdr-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: var(--muted);
  padding: 48px 24px;
  cursor: pointer;
  border: 1.5px dashed #93c5fd;
  border-radius: 18px;
  background: linear-gradient(180deg, #eff6ff, #f8fafc);
}

.hdr-empty .el-icon {
  font-size: 52px;
  color: var(--brand);
}

.hdr-empty h3 {
  margin: 0;
  color: var(--ink);
  font-size: 1.05rem;
}

.hdr-empty p {
  margin: 0;
  font-size: 0.86rem;
}

.hdr-main {
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #1a1a1a;
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
}

.cross-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  width: min(100%, 780px);
  aspect-ratio: 4 / 3;
  gap: 4px;
  pointer-events: none;
}

.cross-cell {
  appearance: none;
  border: 1px solid #333;
  background: #222;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 0;
  transition: border-color 0.15s;
}

.cross-cell:hover {
  border-color: var(--brand);
}

.cross-cell canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  display: block;
  border-radius: 4px;
  background: #0a0a0a;
  pointer-events: none;
}

.cross-cell span {
  font-size: 0.62rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.hdr-hint {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
  font-size: 0.76rem;
  pointer-events: none;
  text-align: center;
}

.hdr-side {
  min-height: 0;
  overflow-y: auto;
}

.exposure-block,
.orient-block {
  margin: 8px 0 14px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.84rem;
  margin-bottom: 4px;
}

.label-row strong {
  color: var(--brand-deep);
  font-variant-numeric: tabular-nums;
}

.side-tip {
  margin: 4px 0 0;
  font-size: 0.74rem;
  color: var(--muted);
}

.side-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.code-block .label-row {
  font-size: 0.8rem;
  font-weight: 650;
}

.code-block pre {
  margin: 6px 0 0;
  padding: 10px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.68rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.status-alert {
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .hdr-workspace {
    grid-template-columns: 1fr;
  }

  .hdr-main {
    min-height: 48vh;
  }

  .hdr-side {
    max-height: 40vh;
  }
}
</style>
