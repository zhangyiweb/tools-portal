<template>
  <div class="tool-page">
    <div class="tool-title">
      <h2>智能图片压缩</h2>
      <p>保持画质的同时减小体积 · JPG / PNG / WebP / AVIF · 本地 WASM</p>
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
          <h3>拖放文件到此处，或点击选择</h3>
          <p>支持 JPG、PNG、WebP、AVIF · 单张最大 50MB · 上传后自动压缩</p>
        </div>
        <input
          ref="fileRef"
          type="file"
          hidden
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          @change="onFileChange"
        />

        <div class="section-block">
          <div class="label-row">
            <span>压缩级别</span>
            <el-tag type="success" effect="light" round>{{ quality }}%</el-tag>
          </div>
          <el-radio-group v-model="preset" size="large" class="preset-group" @change="onPreset">
            <el-radio-button label="lossless">接近无损</el-radio-button>
            <el-radio-button label="recommended">推荐压缩</el-radio-button>
            <el-radio-button label="extreme">极致压缩</el-radio-button>
          </el-radio-group>
          <el-slider
            v-model="quality"
            :min="10"
            :max="95"
            @change="preset = 'custom'"
          />
          <div class="slider-ends"><span>更小</span><span>更清晰</span></div>
        </div>

        <div class="action-row">
          <el-button type="primary" :loading="busy" :disabled="!items.length" @click="runCompress">
            重新压缩
          </el-button>
          <el-button :disabled="busy || !packable.length" @click="downloadZip">
            打包下载 ZIP
          </el-button>
        </div>

        <div class="section-block">
          <el-checkbox v-model="filterReduced">仅打包体积下降的图片</el-checkbox>
        </div>

        <el-alert
          v-if="status.text"
          class="status-alert"
          :title="status.text"
          :type="status.type"
          :closable="false"
          show-icon
        />
        <p class="hint">PNG 保持 PNG：精简颜色 + OxiPNG · 图片不上传服务器</p>
      </div>

      <div class="panel-card list-panel">
        <div class="list-header">
          <h3>图片列表</h3>
          <el-select v-model="listFilter" size="small" style="width: 120px">
            <el-option label="显示全部" value="all" />
            <el-option label="仅体积减小" value="reduced" />
          </el-select>
        </div>
        <div class="list-summary">{{ summary }}</div>

        <el-empty v-if="!visibleItems.length" description="上传后自动压缩并显示体积对比" :image-size="72" />

        <div v-else class="file-scroll">
          <div
            v-for="item in visibleItems"
            :key="item.id"
            class="file-row"
            :class="{ 'is-excluded': isExcluded(item) }"
          >
            <img :src="item.compressedUrl || item.previewUrl" alt="" />
            <div class="file-meta">
              <div class="file-name" :title="item.outputName">{{ item.outputName }}</div>
              <div class="file-sub">
                <span>原 {{ formatSize(item.originalSize) }}</span>
                <template v-if="item.status === 'done'">
                  <span>→</span>
                  <span>{{ formatSize(item.compressedSize) }}</span>
                  <span :class="formatRatio(item.originalSize, item.compressedSize).type">
                    {{ formatRatio(item.originalSize, item.compressedSize).text }}
                  </span>
                  <span v-if="isExcluded(item)" class="warn">不打包</span>
                </template>
                <span v-else-if="item.status === 'compressing'">压缩中…</span>
                <span v-else-if="item.status === 'error'" class="err">{{ item.error }}</span>
                <span v-else>等待中</span>
              </div>
            </div>
            <div class="row-actions">
              <el-button size="small" :disabled="item.status !== 'done'" @click="openCompare(item)">
                对比
              </el-button>
              <el-button
                size="small"
                type="primary"
                plain
                :disabled="item.status !== 'done'"
                @click="triggerDownload(item.compressedBlob, item.outputName)"
              >
                下载
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="compareOpen"
      :title="compareItem?.outputName || '对比预览'"
      width="80%"
      top="8vh"
      destroy-on-close
      class="compare-dialog"
    >
      <div
        ref="stageRef"
        class="compare-stage"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="dragging = false"
      >
        <img class="compare-img" :src="compareItem?.previewUrl" alt="原图" />
        <div class="compare-after-clip" :style="{ width: comparePos * 100 + '%' }">
          <img
            class="compare-img"
            :src="compareItem?.compressedUrl"
            alt="压缩后"
            :style="{ width: stageWidth + 'px' }"
          />
        </div>
        <div class="compare-handle" :style="{ left: comparePos * 100 + '%' }" />
        <div class="compare-labels"><span>原图</span><span>压缩后</span></div>
      </div>
      <template #footer>
        <div class="compare-foot" v-if="compareItem?.status === 'done'">
          <span>原 {{ formatSize(compareItem.originalSize) }}</span>
          <span>→</span>
          <span>{{ formatSize(compareItem.compressedSize) }}</span>
          <el-tag
            :type="formatRatio(compareItem.originalSize, compareItem.compressedSize).type === 'ok' ? 'success' : 'warning'"
            effect="light"
            round
          >
            {{ formatRatio(compareItem.originalSize, compareItem.compressedSize).text }}
          </el-tag>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import JSZip from "jszip";
import { postJob } from "../composables/useImageWorker.js";
import {
  detectFormat,
  formatRatio,
  formatSize,
  isAllowedImage,
  mimeOfFormat,
  triggerDownload,
  uniqueZipName,
  withExt,
} from "../utils/format.js";

const PRESETS = { lossless: 90, recommended: 75, extreme: 40 };

const fileRef = ref(null);
const items = ref([]);
const busy = ref(false);
const dragover = ref(false);
const quality = ref(75);
const preset = ref("recommended");
const filterReduced = ref(true);
const listFilter = ref("all");
const status = ref({ text: "", type: "info" });
let idSeq = 0;

const compareOpen = ref(false);
const compareItem = ref(null);
const comparePos = ref(0.5);
const dragging = ref(false);
const stageRef = ref(null);
const stageWidth = ref(800);

const packable = computed(() => {
  const done = items.value.filter((it) => it.status === "done" && it.compressedBlob);
  return filterReduced.value
    ? done.filter((it) => it.compressedSize < it.originalSize)
    : done;
});

const visibleItems = computed(() => {
  if (listFilter.value === "reduced") {
    return items.value.filter(
      (it) => it.status === "done" && it.compressedSize < it.originalSize
    );
  }
  return items.value;
});

const summary = computed(() => {
  if (!items.value.length) return "暂无图片";
  const done = items.value.filter((it) => it.status === "done");
  if (!done.length) return `原总体积 ${formatSize(items.value.reduce((s, i) => s + i.originalSize, 0))}`;
  const totalOrig = items.value.reduce((s, i) => s + i.originalSize, 0);
  const totalComp = done.reduce((s, i) => s + i.compressedSize, 0);
  const saved = totalOrig - totalComp;
  const pct = totalOrig ? ((saved / totalOrig) * 100).toFixed(1) : "0";
  const base = saved >= 0 ? `共减小 ${formatSize(saved)}（${pct}%）` : `总体积增大 ${formatSize(Math.abs(saved))}`;
  const reduced = done.filter((it) => it.compressedSize < it.originalSize).length;
  return filterReduced.value ? `${base} · 可打包 ${reduced}/${done.length}` : base;
});

function isExcluded(item) {
  return (
    filterReduced.value &&
    item.status === "done" &&
    item.compressedSize != null &&
    item.compressedSize >= item.originalSize
  );
}

function onPreset(val) {
  if (PRESETS[val] != null) quality.value = PRESETS[val];
}

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
    if (it.compressedUrl) URL.revokeObjectURL(it.compressedUrl);
  }
  items.value = [];
}

function acceptFiles(fileList) {
  if (busy.value) return;
  const files = Array.from(fileList || []).filter((f) => isAllowedImage(f));
  if (!files.length) {
    setStatus("error", "未找到可用图片，请选择 JPG / PNG / WebP / AVIF（≤50MB）");
    return;
  }
  clearItems();
  items.value = files.map((file) => ({
    id: `img-${++idSeq}`,
    file,
    name: file.name,
    outputName: file.name,
    originalSize: file.size,
    previewUrl: URL.createObjectURL(file),
    compressedBlob: null,
    compressedUrl: null,
    compressedSize: null,
    error: null,
    status: "pending",
  }));
  setStatus("info", "图片已就绪，开始自动压缩…");
  runCompress();
}

async function runCompress() {
  if (busy.value || !items.value.length) return;
  busy.value = true;
  for (const item of items.value) {
    if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    item.compressedUrl = null;
    item.compressedBlob = null;
    item.compressedSize = null;
    item.error = null;
    item.status = "pending";
    item.outputName = item.name;
  }

  try {
    for (let i = 0; i < items.value.length; i += 1) {
      const item = items.value[i];
      item.status = "compressing";
      setStatus("warning", `压缩中 ${i + 1}/${items.value.length}…`);
      try {
        const format = detectFormat(item.file);
        const buffer = await item.file.arrayBuffer();
        const result = await postJob(
          {
            action: "compress",
            buffer,
            mime: item.file.type || mimeOfFormat(format),
            format,
            options: { quality: quality.value },
          },
          [buffer]
        );
        item.compressedBlob = result.blob;
        item.compressedSize = result.blob.size;
        item.outputName = withExt(item.name, result.ext);
        item.compressedUrl = URL.createObjectURL(result.blob);
        item.status = "done";
      } catch (err) {
        item.status = "error";
        item.error = err?.message || "压缩失败";
      }
    }
    const done = items.value.filter((it) => it.status === "done");
    if (!done.length) throw new Error("全部图片压缩失败");
    setStatus("success", `完成：可对比预览、单张下载或打包 ZIP`);
  } catch (err) {
    setStatus("error", err?.message || "压缩出错");
  } finally {
    busy.value = false;
  }
}

async function downloadZip() {
  const pack = packable.value;
  if (!pack.length) {
    ElMessage.warning("没有可打包的图片");
    return;
  }
  try {
    setStatus("warning", `正在打包 ${pack.length} 张…`);
    const zip = new JSZip();
    const used = new Set();
    for (const item of pack) {
      zip.file(uniqueZipName(item.outputName, used), item.compressedBlob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `compressed-images-${Date.now()}.zip`);
    setStatus("success", `已下载 ZIP（含 ${pack.length} 张）`);
  } catch (err) {
    setStatus("error", err?.message || "打包失败");
  }
}

function openCompare(item) {
  compareItem.value = item;
  comparePos.value = 0.5;
  compareOpen.value = true;
  nextTick(updateStageWidth);
}

function updateStageWidth() {
  stageWidth.value = stageRef.value?.clientWidth || 800;
}

function onPointerDown(e) {
  dragging.value = true;
  stageRef.value?.setPointerCapture(e.pointerId);
  setPos(e.clientX);
}

function onPointerMove(e) {
  if (dragging.value) setPos(e.clientX);
}

function setPos(clientX) {
  const rect = stageRef.value?.getBoundingClientRect();
  if (!rect) return;
  comparePos.value = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

function onResize() {
  if (compareOpen.value) updateStageWidth();
}

onMounted(() => window.addEventListener("resize", onResize));
onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  clearItems();
});
</script>

<style scoped>
.preset-group {
  display: flex;
  width: 100%;
  margin-bottom: 8px;
  max-width: 100%;
}

.preset-group :deep(.el-radio-button) {
  flex: 1;
  min-width: 0;
}

.preset-group :deep(.el-radio-button__inner) {
  width: 100%;
  padding-left: 8px;
  padding-right: 8px;
}

.slider-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--muted);
}

.status-alert {
  margin-top: 14px;
}

.row-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  color: var(--muted);
  font-size: 0.88rem;
}
</style>
