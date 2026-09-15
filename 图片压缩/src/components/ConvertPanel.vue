<template>
  <div class="tool-page">
    <div class="tool-title">
      <h2>通用图片转换器</h2>
      <p>转换为 JPG / PNG / WebP / AVIF · 批量处理 · 本地完成</p>
    </div>

    <div class="workspace">
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
          <p>支持 JPG、PNG、WebP、AVIF、GIF、BMP · 最大 50MB · 上传后自动转换</p>
        </div>
        <input
          ref="fileRef"
          type="file"
          hidden
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,image/*"
          @change="onFileChange"
        />

        <div class="section-block">
          <div class="label-row"><span>目标格式</span></div>
          <el-radio-group v-model="target" size="large" class="format-group">
            <el-radio-button label="jpeg">JPG</el-radio-button>
            <el-radio-button label="png">PNG</el-radio-button>
            <el-radio-button label="webp">WebP</el-radio-button>
            <el-radio-button label="avif">AVIF</el-radio-button>
          </el-radio-group>
          <p class="format-tip">{{ formatTip }}</p>
        </div>

        <div class="section-block">
          <div class="label-row">
            <span>输出质量</span>
            <el-tag type="success" effect="light" round>{{ quality }}%</el-tag>
          </div>
          <el-slider v-model="quality" :min="40" :max="100" />
          <div class="slider-ends"><span>更小</span><span>更清晰</span></div>
        </div>

        <div class="action-row">
          <el-button type="primary" :loading="busy" :disabled="!items.length" @click="runConvert">
            重新转换
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
        <p class="hint">转 JPG 时透明区域变白底 · PNG/WebP/AVIF 可保留透明</p>
      </div>

      <div class="panel-card list-panel">
        <div class="list-header"><h3>图片列表</h3></div>
        <div class="list-summary">{{ summary }}</div>
        <el-empty v-if="!items.length" description="上传后自动转换并显示结果" :image-size="72" />
        <div v-else class="file-scroll">
          <div v-for="item in items" :key="item.id" class="file-row">
            <img :src="item.resultUrl || item.previewUrl" alt="" />
            <div class="file-meta">
              <div class="file-name">{{ item.outputName }}</div>
              <div class="file-sub">
                <span>原 {{ formatSize(item.originalSize) }}</span>
                <template v-if="item.status === 'done'">
                  <span>→</span>
                  <span>{{ formatSize(item.blob.size) }}</span>
                  <el-tag size="small" effect="plain" round>{{ item.outputExt.toUpperCase() }}</el-tag>
                </template>
                <span v-else-if="item.status === 'processing'">转换中…</span>
                <span v-else-if="item.status === 'error'" class="err">{{ item.error }}</span>
                <span v-else>待转换</span>
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
  withExt,
} from "../utils/format.js";

const fileRef = ref(null);
const items = ref([]);
const busy = ref(false);
const dragover = ref(false);
const target = ref("webp");
const quality = ref(90);
const status = ref({ text: "", type: "info" });
let idSeq = 0;

const tips = {
  jpeg: "兼容性最好，不支持透明背景",
  png: "适合透明图与图标",
  webp: "网页优选，体积小且可透明",
  avif: "体积更小，现代浏览器友好",
};

const formatTip = computed(() => tips[target.value] || "");
const doneCount = computed(() => items.value.filter((it) => it.status === "done").length);
const summary = computed(() => {
  if (!items.value.length) return "暂无图片";
  return doneCount.value
    ? `已转换 ${doneCount.value}/${items.value.length}`
    : `已选 ${items.value.length} 张`;
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
}

function acceptFiles(fileList) {
  if (busy.value) return;
  const files = Array.from(fileList || []).filter((f) => isAllowedImage(f, { allowExtra: true }));
  if (!files.length) {
    setStatus("error", "未找到可用图片（JPG/PNG/WebP/AVIF/GIF/BMP，≤50MB）");
    return;
  }
  clearItems();
  items.value = files.map((file) => ({
    id: `cv-${++idSeq}`,
    file,
    name: file.name,
    outputName: file.name,
    outputExt: null,
    originalSize: file.size,
    previewUrl: URL.createObjectURL(file),
    blob: null,
    resultUrl: null,
    error: null,
    status: "pending",
  }));
  setStatus("info", "图片已就绪，开始转换…");
  runConvert();
}

async function runConvert() {
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
      setStatus("warning", `转换中 ${i + 1}/${items.value.length}…`);
      try {
        const format = detectFormat(item.file);
        const buffer = await item.file.arrayBuffer();
        const result = await postJob(
          {
            action: "convert",
            buffer,
            mime: item.file.type || mimeOfFormat(format),
            format,
            options: { targetFormat: target.value, quality: quality.value },
          },
          [buffer]
        );
        item.blob = result.blob;
        item.outputExt = result.ext;
        item.outputName = withExt(item.name, result.ext);
        item.resultUrl = URL.createObjectURL(result.blob);
        item.status = "done";
      } catch (err) {
        item.status = "error";
        item.error = err?.message || "转换失败";
      }
    }
    if (!doneCount.value) throw new Error("全部转换失败");
    setStatus(
      "success",
      `完成：已转换 ${doneCount.value}/${items.value.length} 张为 ${target.value.toUpperCase()}`
    );
  } catch (err) {
    setStatus("error", err?.message || "转换出错");
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
  triggerDownload(blob, `converted-${target.value}-${Date.now()}.zip`);
  setStatus("success", `已下载 ZIP（${pack.length} 张）`);
}

onUnmounted(clearItems);
</script>

<style scoped>
.format-group {
  display: flex;
  width: 100%;
  max-width: 100%;
}
.format-group :deep(.el-radio-button) { flex: 1; min-width: 0; }
.format-group :deep(.el-radio-button__inner) {
  width: 100%;
  padding-left: 8px;
  padding-right: 8px;
}
.format-tip {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.slider-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--muted);
}
.status-alert { margin-top: 14px; }
</style>
