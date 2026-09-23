<template>
  <div class="tool-page split-page">
    <div class="split-top">
      <div class="tool-title">
        <h2>图片分割</h2>
        <p>按网格切成多张小图 · 默认 3×3 · 本地处理</p>
      </div>
      <div class="split-toolbar">
        <div class="chip-row">
          <el-check-tag
            v-for="item in presets"
            :key="item.key"
            :checked="presetKey === item.key"
            @change="applyPreset(item)"
          >
            {{ item.label }}
          </el-check-tag>
        </div>
        <div class="size-inputs">
          <span>列</span>
          <el-input-number v-model="cols" :min="1" :max="20" controls-position="right" @change="onCustomSize" />
          <span>×</span>
          <span>行</span>
          <el-input-number v-model="rows" :min="1" :max="20" controls-position="right" @change="onCustomSize" />
        </div>
        <div class="chip-row">
          <el-button :disabled="!file || busy" @click="pickFile">换图</el-button>
          <el-button type="primary" :loading="busy" :disabled="!file" @click="runSplit">
            分割并打包
          </el-button>
          <el-button :disabled="!pieces.length" @click="downloadZip">再次下载 ZIP</el-button>
        </div>
      </div>
    </div>

    <div class="split-body">
      <div
        class="split-stage"
        :class="{ 'is-dragover': dragover, 'is-empty': !previewUrl }"
        @dragenter.prevent="dragover = true"
        @dragover.prevent="dragover = true"
        @dragleave.prevent="dragover = false"
        @drop.prevent="onDrop"
      >
        <div v-if="!previewUrl" class="split-empty" @click="pickFile">
          <el-icon><UploadFilled /></el-icon>
          <h3>拖放或点击上传图片</h3>
          <p>支持 JPG、PNG、WebP、AVIF · 单张最大 50MB</p>
        </div>
        <div v-else class="split-preview">
          <div class="split-frame">
            <img :src="previewUrl" alt="原图" />
            <div
              class="split-grid"
              :style="{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }"
            >
              <div v-for="n in rows * cols" :key="n" class="split-cell">
                <span>{{ n }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside class="split-side panel-card">
        <div class="list-header">
          <h3>分割块预览</h3>
          <el-tag v-if="pieces.length" size="small" effect="plain">{{ cols }}×{{ rows }}</el-tag>
        </div>
        <div class="list-summary">{{ summary }}</div>
        <el-empty v-if="!pieces.length" description="分割后在此预览各块" :image-size="72" />
        <div
          v-else
          class="tile-grid"
          :style="{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, 1fr)` }"
        >
          <button
            v-for="piece in pieces"
            :key="`${piece.row}-${piece.col}`"
            type="button"
            class="tile"
            @click="triggerDownload(piece.blob, piece.name)"
          >
            <img :src="piece.url" :alt="piece.name" />
            <span>r{{ piece.row }}c{{ piece.col }}</span>
          </button>
        </div>
      </aside>
    </div>

    <input
      ref="fileRef"
      type="file"
      hidden
      accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
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
import { computed, onUnmounted, ref } from "vue";
import { UploadFilled } from "@element-plus/icons-vue";
import JSZip from "jszip";
import { postJob } from "../composables/useImageWorker.js";
import {
  detectFormat,
  formatSize,
  isAllowedImage,
  mimeOfFormat,
  triggerDownload,
  uniqueZipName,
} from "../utils/format.js";

const presets = [
  { key: "2x2", label: "2×2", cols: 2, rows: 2 },
  { key: "3x3", label: "3×3", cols: 3, rows: 3 },
  { key: "4x4", label: "4×4", cols: 4, rows: 4 },
  { key: "1x3", label: "1×3", cols: 3, rows: 1 },
  { key: "3x1", label: "3×1", cols: 1, rows: 3 },
];

const fileRef = ref(null);
const file = ref(null);
const previewUrl = ref("");
const dragover = ref(false);
const busy = ref(false);
const cols = ref(3);
const rows = ref(3);
const presetKey = ref("3x3");
const status = ref({ text: "", type: "info" });
const pieces = ref([]);
const srcSize = ref({ width: 0, height: 0 });

const summary = computed(() => {
  if (!file.value) return "暂无图片";
  if (pieces.value.length) {
    return `已分成 ${pieces.value.length} 块 · 点击单块可单独下载`;
  }
  return `${file.value.name} · 将分成 ${cols.value}×${rows.value} = ${cols.value * rows.value} 块`;
});

function setStatus(type, text) {
  status.value = { type, text };
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

function clearPieces() {
  for (const p of pieces.value) {
    if (p.url) URL.revokeObjectURL(p.url);
  }
  pieces.value = [];
}

function acceptFile(f) {
  if (!f) return;
  if (!isAllowedImage(f)) {
    setStatus("error", "请选择 JPG / PNG / WebP / AVIF（≤50MB）");
    return;
  }
  clearPieces();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  file.value = f;
  previewUrl.value = URL.createObjectURL(f);
  srcSize.value = { width: 0, height: 0 };
  setStatus("info", `已选图片，默认 ${cols.value}×${rows.value} 分割`);
}

function applyPreset(item) {
  presetKey.value = item.key;
  cols.value = item.cols;
  rows.value = item.rows;
}

function onCustomSize() {
  const matched = presets.find((p) => p.cols === cols.value && p.rows === rows.value);
  presetKey.value = matched ? matched.key : "custom";
}

function baseName(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

async function runSplit() {
  if (!file.value || busy.value) return;
  const c = Math.round(cols.value);
  const r = Math.round(rows.value);
  if (c < 1 || r < 1 || c > 20 || r > 20) {
    setStatus("error", "行列需在 1～20 之间");
    return;
  }

  busy.value = true;
  clearPieces();
  try {
    setStatus("warning", `正在分割为 ${c}×${r}…`);
    const format = detectFormat(file.value);
    const buffer = await file.value.arrayBuffer();
    const result = await postJob(
      {
        action: "split",
        buffer,
        mime: file.value.type || mimeOfFormat(format),
        format,
        options: {
          cols: c,
          rows: r,
          format,
          quality: 92,
        },
      },
      [buffer]
    );

    const nameBase = baseName(file.value.name);
    pieces.value = result.pieces.map((p) => ({
      ...p,
      url: URL.createObjectURL(p.blob),
      name: `${nameBase}_r${p.row}c${p.col}.${p.ext}`,
    }));
    srcSize.value = { width: result.srcWidth, height: result.srcHeight };
    await downloadZip();
    setStatus(
      "success",
      `已分割 ${result.pieces.length} 块（原图 ${result.srcWidth}×${result.srcHeight}）`
    );
  } catch (err) {
    setStatus("error", err?.message || "分割失败");
  } finally {
    busy.value = false;
  }
}

async function downloadZip() {
  if (!pieces.value.length || !file.value) return;
  const zip = new JSZip();
  const used = new Set();
  for (const p of pieces.value) {
    const name = uniqueZipName(p.name, used);
    zip.file(name, p.blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${baseName(file.value.name)}_${cols.value}x${rows.value}.zip`);
}

onUnmounted(() => {
  clearPieces();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
.split-page {
  max-width: none;
  gap: 12px;
}

.split-top {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
}

.split-top .tool-title {
  margin-bottom: 0;
}

.split-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.86rem;
  color: var(--muted);
}

.size-inputs :deep(.el-input-number) {
  width: 110px;
}

.split-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.75fr);
  gap: 14px;
}

.split-stage {
  min-height: 0;
  position: relative;
  display: flex;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(215, 235, 231, 0.9);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.06);
  overflow: hidden;
}

.split-stage.is-dragover {
  outline: 2px dashed var(--brand);
  outline-offset: -6px;
}

.split-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: linear-gradient(180deg, #eff6ff, #f8fafc);
  color: var(--muted);
  text-align: center;
  padding: 32px;
}

.split-empty .el-icon {
  font-size: 52px;
  color: var(--brand);
}

.split-empty h3 {
  margin: 0;
  color: var(--ink);
  font-size: 1.05rem;
}

.split-empty p {
  margin: 0;
  font-size: 0.86rem;
}

.split-preview {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  padding: 16px;
  overflow: hidden;
}

.split-frame {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
}

.split-frame img {
  max-width: 100%;
  max-height: calc(100vh - 220px);
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  border-radius: 4px;
}

.split-grid {
  position: absolute;
  inset: 0;
  display: grid;
  pointer-events: none;
}

.split-cell {
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.25);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px 6px;
}

.split-cell span {
  font-size: 0.7rem;
  color: #fff;
  background: rgba(15, 78, 74, 0.55);
  border-radius: 4px;
  padding: 1px 5px;
}

.split-side {
  min-height: 0;
  overflow: hidden;
}

.tile-grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 10px;
  align-content: start;
}

.tile {
  appearance: none;
  border: 1px solid var(--line);
  background: #f8fafc;
  border-radius: 12px;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, transform 0.15s;
}

.tile:hover {
  border-color: var(--brand);
  transform: translateY(-1px);
}

.tile img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  background: #e2e8f0;
  display: block;
}

.tile span {
  display: block;
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--muted);
}

.status-alert {
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .split-body {
    grid-template-columns: 1fr;
  }

  .split-stage {
    min-height: 48vh;
  }

  .split-side {
    max-height: 42vh;
  }
}
</style>
