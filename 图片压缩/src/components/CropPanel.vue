<template>
  <div class="tool-page crop-page">
    <div class="crop-top">
      <div class="tool-title">
        <h2>图片裁剪</h2>
        <p>自由裁剪或按比例 · JPG / PNG / WebP / AVIF · 本地处理</p>
      </div>
      <div class="crop-toolbar">
        <div class="chip-row">
          <el-check-tag
            v-for="item in ratios"
            :key="item.key"
            :checked="aspectKey === item.key"
            :disabled="!cropper"
            @change="setAspect(item)"
          >
            {{ item.label }}
          </el-check-tag>
        </div>
        <div class="chip-row">
          <el-button :disabled="!cropper" @click="rotate(-90)">左转</el-button>
          <el-button :disabled="!cropper" @click="rotate(90)">右转</el-button>
          <el-button :disabled="!cropper" @click="resetCrop">重置</el-button>
          <el-button :disabled="!file || busy" @click="pickFile">换图</el-button>
          <el-button type="primary" :loading="busy" :disabled="!cropper" @click="runCrop">
            裁剪并下载
          </el-button>
          <el-button :disabled="!resultBlob" @click="triggerDownload(resultBlob, outputName)">
            再次下载
          </el-button>
        </div>
      </div>
    </div>

    <div
      class="crop-stage"
      :class="{ 'is-dragover': dragover, 'is-empty': !previewUrl }"
      @dragenter.prevent="onStageDragEnter"
      @dragover.prevent="dragover = true"
      @dragleave.prevent="dragover = false"
      @drop.prevent="onDrop"
    >
      <div
        v-if="!previewUrl"
        class="crop-empty"
        @click="pickFile"
      >
        <el-icon><UploadFilled /></el-icon>
        <h3>拖放或点击上传图片</h3>
        <p>支持 JPG、PNG、WebP、AVIF · 单张最大 50MB</p>
      </div>

      <div v-else class="crop-wrap">
        <img ref="imgRef" :src="previewUrl" alt="待裁剪" class="crop-img" @load="initCropper" />
      </div>

      <aside v-if="resultUrl" class="crop-result">
        <div class="crop-result-head">
          <strong>裁剪结果</strong>
          <span>{{ resultW }}×{{ resultH }} · {{ formatSize(resultBlob.size) }}</span>
        </div>
        <img :src="resultUrl" alt="裁剪结果" />
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
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { postJob } from "../composables/useImageWorker.js";
import {
  detectFormat,
  formatSize,
  isAllowedImage,
  triggerDownload,
  withExt,
} from "../utils/format.js";

const ratios = [
  { key: "free", label: "自由", value: NaN },
  { key: "1:1", label: "1:1", value: 1 },
  { key: "4:3", label: "4:3", value: 4 / 3 },
  { key: "16:9", label: "16:9", value: 16 / 9 },
  { key: "3:4", label: "3:4", value: 3 / 4 },
  { key: "9:16", label: "9:16", value: 9 / 16 },
];

const fileRef = ref(null);
const imgRef = ref(null);
const file = ref(null);
const previewUrl = ref("");
const dragover = ref(false);
const busy = ref(false);
const aspectKey = ref("free");
const status = ref({ text: "", type: "info" });
const resultBlob = ref(null);
const resultUrl = ref("");
const resultW = ref(0);
const resultH = ref(0);
const outputName = ref("");

/** @type {import('vue').Ref<import('cropperjs').default | null>} */
const cropper = ref(null);

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

function onStageDragEnter() {
  if (!busy.value) dragover.value = true;
}

function onDrop(e) {
  dragover.value = false;
  if (!busy.value) acceptFile(e.dataTransfer?.files?.[0]);
}

function destroyCropper() {
  if (cropper.value) {
    cropper.value.destroy();
    cropper.value = null;
  }
}

function clearResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = "";
  resultBlob.value = null;
  resultW.value = 0;
  resultH.value = 0;
}

async function acceptFile(f) {
  if (!f) return;
  if (!isAllowedImage(f)) {
    setStatus("error", "请选择 JPG / PNG / WebP / AVIF（≤50MB）");
    return;
  }
  destroyCropper();
  clearResult();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  file.value = f;
  previewUrl.value = URL.createObjectURL(f);
  outputName.value = f.name;
  aspectKey.value = "free";
  setStatus("info", "拖动选区进行调整，然后点击裁剪并下载");
  await nextTick();
}

function initCropper() {
  destroyCropper();
  if (!imgRef.value) return;
  cropper.value = new Cropper(imgRef.value, {
    viewMode: 1,
    dragMode: "crop",
    autoCropArea: 0.85,
    responsive: true,
    background: false,
    aspectRatio: NaN,
  });
}

function onWindowResize() {
  cropper.value?.resize();
}

onMounted(() => window.addEventListener("resize", onWindowResize));

onUnmounted(() => {
  window.removeEventListener("resize", onWindowResize);
  destroyCropper();
  clearResult();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

function setAspect(item) {
  aspectKey.value = item.key;
  if (cropper.value) {
    cropper.value.setAspectRatio(Number.isFinite(item.value) ? item.value : NaN);
  }
}

function rotate(deg) {
  cropper.value?.rotate(deg);
}

function resetCrop() {
  cropper.value?.reset();
  aspectKey.value = "free";
  cropper.value?.setAspectRatio(NaN);
}

function canvasToPngBuffer(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("无法生成裁剪画布"));
          return;
        }
        blob.arrayBuffer().then(resolve, reject);
      },
      "image/png"
    );
  });
}

async function runCrop() {
  if (!cropper.value || !file.value || busy.value) return;
  const data = cropper.value.getData(true);
  if (!data.width || !data.height) {
    ElMessage.warning("请先选择裁剪区域");
    return;
  }

  busy.value = true;
  clearResult();
  try {
    setStatus("warning", "正在裁剪…");
    const format = detectFormat(file.value);
    const canvas = cropper.value.getCroppedCanvas({
      maxWidth: 8192,
      maxHeight: 8192,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillColor: format === "jpeg" ? "#ffffff" : undefined,
    });
    if (!canvas) throw new Error("裁剪失败");

    const buffer = await canvasToPngBuffer(canvas);
    const result = await postJob(
      {
        action: "convert",
        buffer,
        mime: "image/png",
        format: "png",
        options: {
          targetFormat: format,
          quality: 92,
        },
      },
      [buffer]
    );
    resultBlob.value = result.blob;
    resultUrl.value = URL.createObjectURL(result.blob);
    resultW.value = result.width || canvas.width;
    resultH.value = result.height || canvas.height;
    outputName.value = withExt(file.value.name, result.ext);
    triggerDownload(result.blob, outputName.value);
    setStatus("success", `裁剪完成：${resultW.value}×${resultH.value}`);
  } catch (err) {
    setStatus("error", err?.message || "裁剪失败");
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.crop-page {
  max-width: none;
  gap: 12px;
}

.crop-top {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
}

.crop-top .tool-title {
  margin-bottom: 0;
}

.crop-toolbar {
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

.crop-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(215, 235, 231, 0.9);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.06);
  overflow: hidden;
}

.crop-stage.is-dragover {
  outline: 2px dashed var(--brand);
  outline-offset: -6px;
}

.crop-empty {
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

.crop-empty .el-icon {
  font-size: 52px;
  color: var(--brand);
}

.crop-empty h3 {
  margin: 0;
  color: var(--ink);
  font-size: 1.05rem;
}

.crop-empty p {
  margin: 0;
  font-size: 0.86rem;
}

.crop-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: #0f172a;
}

.crop-img {
  display: block;
  max-width: 100%;
}

.crop-result {
  width: min(280px, 32%);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-left: 1px solid var(--line);
  background: #f8fafc;
  overflow: auto;
}

.crop-result-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  color: var(--muted);
}

.crop-result-head strong {
  font-size: 0.9rem;
  color: var(--ink);
}

.crop-result img {
  width: 100%;
  border-radius: 12px;
  object-fit: contain;
  background: #fff;
  border: 1px solid var(--line);
}

.status-alert {
  flex-shrink: 0;
}

:deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
}

@media (max-width: 900px) {
  .crop-result {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: min(200px, 46%);
    max-height: 42%;
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 10px 28px rgba(15, 78, 74, 0.18);
  }
}
</style>
