<template>
  <div class="tool-page">
    <div class="tool-title">
      <h2>精准图片缩放</h2>
      <p>按像素或百分比调整尺寸，支持旋转翻转 · 本地处理</p>
    </div>

    <div class="workspace workspace-resize">
      <div class="panel-card scrollable">
        <div
          class="upload-zone"
          :class="{ 'is-dragover': dragover, 'is-disabled': busy }"
          @click="pickFiles"
          @dragenter.prevent="dragover = true"
          @dragover.prevent="dragover = true"
          @dragleave.prevent="dragover = false"
          @drop.prevent="onDrop"
        >
          <el-icon><UploadFilled /></el-icon>
          <h3>拖放或点击上传图片</h3>
          <p>支持 JPG、PNG、WebP、AVIF · 单张最大 50MB</p>
        </div>
        <input
          ref="fileRef"
          type="file"
          hidden
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,image/*"
          @change="onFileChange"
        />

        <div class="section-block">
          <div class="label-row"><span>调整方式</span></div>
          <el-radio-group v-model="mode" size="large" class="preset-group">
            <el-radio-button label="pixel">按像素</el-radio-button>
            <el-radio-button label="percent">按百分比</el-radio-button>
          </el-radio-group>

          <div v-if="mode === 'pixel'" class="size-grid">
            <el-form-item label="宽度 (px)">
              <el-input-number v-model="width" :min="1" controls-position="right" @change="syncFromWidth" />
            </el-form-item>
            <el-form-item label="高度 (px)">
              <el-input-number v-model="height" :min="1" controls-position="right" @change="syncFromHeight" />
            </el-form-item>
          </div>
          <el-checkbox v-if="mode === 'pixel'" v-model="lockAspect">锁定宽高比（防拉伸）</el-checkbox>

          <el-form-item v-else label="缩放比例 (%)">
            <el-input-number v-model="percent" :min="1" :max="400" controls-position="right" />
          </el-form-item>
        </div>

        <div class="section-block">
          <div class="label-row"><span>快捷比例</span></div>
          <div class="chip-row">
            <el-check-tag
              v-for="p in presets"
              :key="p"
              :checked="false"
              @change="applyPreset(p)"
            >
              {{ p }}
            </el-check-tag>
          </div>
        </div>

        <div class="section-block">
          <div class="label-row">
            <span>旋转 / 翻转</span>
            <el-tag round effect="plain">{{ rotate }}°</el-tag>
          </div>
          <div class="chip-row">
            <el-button @click="rotate = (rotate + 270) % 360">左转 90°</el-button>
            <el-button @click="rotate = (rotate + 90) % 360">右转 90°</el-button>
            <el-button :type="flipH ? 'primary' : 'default'" plain @click="flipH = !flipH">水平翻转</el-button>
            <el-button :type="flipV ? 'primary' : 'default'" plain @click="flipV = !flipV">垂直翻转</el-button>
          </div>
        </div>

        <div class="action-row">
          <el-button type="primary" :loading="busy" :disabled="!items.length" @click="runResize">
            开始调整
          </el-button>
          <el-button :disabled="busy || !doneCount" @click="downloadZip">打包下载 ZIP</el-button>
        </div>

        <el-alert
          v-if="status.text"
          class="status-alert"
          :title="status.text"
          :type="status.type"
          :closable="false"
          show-icon
        />
        <p class="hint">默认锁定比例 · 高质量缩放 · 本地处理不上传</p>
      </div>

      <div class="panel-card list-panel">
        <div class="list-header"><h3>图片列表</h3></div>
        <div class="list-summary">{{ summary }}</div>
        <el-empty v-if="!items.length" description="上传后在此显示尺寸信息" :image-size="72" />
        <div v-else class="file-scroll">
          <div v-for="item in items" :key="item.id" class="file-row">
            <img :src="item.resultUrl || item.previewUrl" alt="" />
            <div class="file-meta">
              <div class="file-name">{{ item.outputName }}</div>
              <div class="file-sub">
                <span>{{ item.srcW }}×{{ item.srcH }}</span>
                <template v-if="item.status === 'done'">
                  <span>→</span>
                  <span class="ok">{{ item.outW }}×{{ item.outH }}</span>
                  <span>{{ formatSize(item.blob.size) }}</span>
                </template>
                <span v-else-if="item.status === 'processing'">处理中…</span>
                <span v-else-if="item.status === 'error'" class="err">{{ item.error }}</span>
              </div>
            </div>
            <el-button
              size="small"
              type="primary"
              plain
              :disabled="item.status !== 'done'"
              @click="triggerDownload(item.blob, item.outputName)"
            >
              下载
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import JSZip from "jszip";
import { postJob } from "../composables/useImageWorker.js";
import {
  detectFormat,
  formatSize,
  isAllowedImage,
  mimeOfFormat,
  readImageSize,
  triggerDownload,
  uniqueZipName,
  withExt,
} from "../utils/format.js";

const presets = ["1:1", "4:3", "16:9", "3:4", "9:16"];
const fileRef = ref(null);
const items = ref([]);
const busy = ref(false);
const dragover = ref(false);
const mode = ref("pixel");
const width = ref(800);
const height = ref(600);
const percent = ref(100);
const lockAspect = ref(true);
const rotate = ref(0);
const flipH = ref(false);
const flipV = ref(false);
const status = ref({ text: "", type: "info" });
let baseSize = null;
let syncing = false;
let idSeq = 0;

const doneCount = computed(() => items.value.filter((it) => it.status === "done").length);
const summary = computed(() => {
  if (!items.value.length) return "暂无图片";
  if (doneCount.value) return `已处理 ${doneCount.value}/${items.value.length}`;
  return baseSize ? `原尺寸 ${baseSize.width}×${baseSize.height}` : `已选 ${items.value.length} 张`;
});

function setStatus(type, text) {
  status.value = { type, text };
}

function pickFiles() {
  if (!busy.value) fileRef.value?.click();
}

function onFileChange(e) {
  acceptFiles(e.target.files);
  e.target.value = "";
}

function onDrop(e) {
  dragover.value = false;
  if (!busy.value) acceptFiles(e.dataTransfer?.files);
}

function clearItems() {
  for (const it of items.value) {
    URL.revokeObjectURL(it.previewUrl);
    if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
  }
  items.value = [];
  baseSize = null;
}

function syncFromWidth() {
  if (syncing || !lockAspect.value || !baseSize) return;
  syncing = true;
  height.value = Math.max(1, Math.round((width.value * baseSize.height) / baseSize.width));
  syncing = false;
}

function syncFromHeight() {
  if (syncing || !lockAspect.value || !baseSize) return;
  syncing = true;
  width.value = Math.max(1, Math.round((height.value * baseSize.width) / baseSize.height));
  syncing = false;
}

function applyPreset(ratio) {
  if (!baseSize) {
    ElMessage.info("请先上传图片");
    return;
  }
  mode.value = "pixel";
  const [rw, rh] = ratio.split(":").map(Number);
  let w = baseSize.width;
  let h = Math.round((w * rh) / rw);
  if (h > baseSize.height) {
    h = baseSize.height;
    w = Math.round((h * rw) / rh);
  }
  width.value = w;
  height.value = h;
}

async function acceptFiles(fileList) {
  if (busy.value) return;
  const files = Array.from(fileList || []).filter((f) => isAllowedImage(f));
  if (!files.length) {
    setStatus("error", "未找到可用图片（JPG/PNG/WebP/AVIF，≤50MB）");
    return;
  }
  clearItems();
  setStatus("info", "读取尺寸中…");
  try {
    for (const file of files) {
      const size = await readImageSize(file);
      items.value.push({
        id: `rs-${++idSeq}`,
        file,
        name: file.name,
        outputName: file.name,
        previewUrl: URL.createObjectURL(file),
        srcW: size.width,
        srcH: size.height,
        outW: null,
        outH: null,
        blob: null,
        resultUrl: null,
        error: null,
        status: "pending",
        format: detectFormat(file),
      });
    }
    baseSize = { width: items.value[0].srcW, height: items.value[0].srcH };
    width.value = baseSize.width;
    height.value = baseSize.height;
    percent.value = 100;
    rotate.value = 0;
    flipH.value = false;
    flipV.value = false;
    setStatus("success", "已加载，设置尺寸后点击开始调整");
  } catch (err) {
    clearItems();
    setStatus("error", err?.message || "读取失败");
  }
}

function resolveTarget(item) {
  if (mode.value === "percent") {
    const p = Math.max(1, percent.value || 100) / 100;
    return {
      width: Math.max(1, Math.round(item.srcW * p)),
      height: Math.max(1, Math.round(item.srcH * p)),
    };
  }
  return {
    width: Math.max(1, width.value || item.srcW),
    height: Math.max(1, height.value || item.srcH),
  };
}

async function runResize() {
  if (busy.value || !items.value.length) return;
  busy.value = true;
  for (const item of items.value) {
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    item.resultUrl = null;
    item.blob = null;
    item.error = null;
    item.status = "pending";
  }
  try {
    for (let i = 0; i < items.value.length; i += 1) {
      const item = items.value[i];
      item.status = "processing";
      setStatus("warning", `调整中 ${i + 1}/${items.value.length}…`);
      try {
        const target = resolveTarget(item);
        const buffer = await item.file.arrayBuffer();
        const result = await postJob(
          {
            action: "resize",
            buffer,
            mime: item.file.type || mimeOfFormat(item.format),
            format: item.format,
            options: {
              width: target.width,
              height: target.height,
              rotate: rotate.value,
              flipH: flipH.value,
              flipV: flipV.value,
              format: item.format,
              quality: 92,
            },
          },
          [buffer]
        );
        item.blob = result.blob;
        item.outW = result.width;
        item.outH = result.height;
        item.outputName = withExt(item.name, result.ext);
        item.resultUrl = URL.createObjectURL(result.blob);
        item.status = "done";
      } catch (err) {
        item.status = "error";
        item.error = err?.message || "调整失败";
      }
    }
    if (!doneCount.value) throw new Error("全部处理失败");
    setStatus("success", `完成：已调整 ${doneCount.value}/${items.value.length} 张`);
  } catch (err) {
    setStatus("error", err?.message || "处理出错");
  } finally {
    busy.value = false;
  }
}

async function downloadZip() {
  const pack = items.value.filter((it) => it.blob);
  if (!pack.length) return;
  const zip = new JSZip();
  const used = new Set();
  for (const item of pack) zip.file(uniqueZipName(item.outputName, used), item.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `resized-images-${Date.now()}.zip`);
  setStatus("success", `已下载 ZIP（${pack.length} 张）`);
}

onUnmounted(clearItems);
</script>

<style scoped>
.preset-group {
  display: flex;
  width: 100%;
  margin-bottom: 12px;
}
.preset-group :deep(.el-radio-button) { flex: 1; }
.preset-group :deep(.el-radio-button__inner) { width: 100%; }
.size-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-alert { margin-top: 14px; }
</style>
