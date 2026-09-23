<template>
  <div class="tool-page">
    <div class="tool-title">
      <h2>HDR 转 KTX2</h2>
      <p>将 HDR / EXR 环境贴图转为 KTX2 · UASTC HDR · 本地 WASM 编码</p>
    </div>

    <div class="workspace workspace-list">
      <div class="panel-card scrollable">
        <div
          class="upload-zone"
          :class="{ 'is-dragover': dragover, 'is-disabled': busy }"
          @click="pickFile"
          @dragenter.prevent="dragover = true"
          @dragover.prevent="dragover = true"
          @dragleave.prevent="dragover = false"
          @drop.prevent="onDrop"
        >
          <el-icon><UploadFilled /></el-icon>
          <h3>拖放或点击上传 HDR / EXR</h3>
          <p>支持 .hdr、.exr · 本地转换不上传服务器</p>
        </div>
        <input
          ref="fileRef"
          type="file"
          hidden
          accept=".hdr,.exr,.HDR,.EXR,image/vnd.radiance,image/x-exr"
          @change="onFileChange"
        />

        <div v-if="file" class="section-block">
          <div class="label-row"><span>文件信息</span></div>
          <div class="info-grid">
            <div><strong>文件名</strong>{{ file.name }}</div>
            <div><strong>大小</strong>{{ formatSize(file.size) }}</div>
            <div><strong>格式</strong>{{ fileExt }}</div>
            <div><strong>目标</strong>KTX2</div>
          </div>
        </div>

        <div class="section-block">
          <div class="label-row"><span>编码格式</span></div>
          <el-select v-model="encode" style="width: 100%" :disabled="busy">
            <el-option
              v-for="opt in encodeOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>
        </div>

        <div class="section-block option-checks">
          <el-checkbox v-model="mipmap" :disabled="busy">生成 Mipmap</el-checkbox>
          <el-checkbox v-model="zstd" :disabled="busy">Zstd 超级压缩</el-checkbox>
          <p class="hint-inline">Mipmap 便于多级采样 · Zstd 进一步减小体积</p>
        </div>

        <div class="action-row">
          <el-button type="primary" :loading="busy" :disabled="!file" @click="runConvert">
            开始转换
          </el-button>
          <el-button :disabled="!result" @click="downloadResult">下载 KTX2</el-button>
        </div>

        <el-alert
          v-if="status.text"
          class="status-alert"
          :title="status.text"
          :type="status.type"
          :closable="false"
          show-icon
        />
        <p class="hint">基于 ktx2-encoder（Basis Universal WASM）· 适用于 WebGL / Three.js</p>
      </div>

      <div class="panel-card list-panel">
        <div class="list-header"><h3>转换结果</h3></div>
        <el-empty v-if="!result && !busy" description="上传并转换后显示对比" :image-size="72" />
        <div v-else-if="busy" class="busy-box">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>正在编码 KTX2，大图可能需要数十秒…</p>
        </div>
        <template v-else>
          <div class="result-table-wrap">
            <table class="result-table">
              <thead>
                <tr>
                  <th>属性</th>
                  <th>原始文件</th>
                  <th>KTX2</th>
                  <th>变化</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>文件名</td>
                  <td>{{ file?.name }}</td>
                  <td>{{ result.outputName }}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>文件大小</td>
                  <td>{{ formatSize(result.originalSize) }}</td>
                  <td>{{ formatSize(result.convertedSize) }}</td>
                  <td :class="sizeChangeClass">{{ sizeChangeText }}</td>
                </tr>
                <tr>
                  <td>编码</td>
                  <td>{{ result.imageType.toUpperCase() }}</td>
                  <td>{{ result.encode }}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Mipmap</td>
                  <td>—</td>
                  <td>{{ result.mipmap ? "是" : "否" }}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Zstd</td>
                  <td>—</td>
                  <td>{{ result.zstd ? "是" : "否" }}</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="code-block">
            <div class="label-row"><span>Three.js 用法</span></div>
            <pre>{{ usageCode }}</pre>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from "vue";
import { Loading, UploadFilled } from "@element-plus/icons-vue";
import { convertHdrToKtx2, HDR_ENCODE_OPTIONS } from "../utils/hdrKtx2.js";
import { isHdrFile } from "../utils/hdrSkybox.js";
import { formatSize, triggerDownload, withExt } from "../utils/format.js";

const encodeOptions = HDR_ENCODE_OPTIONS;

const fileRef = ref(null);
const file = ref(null);
const dragover = ref(false);
const busy = ref(false);
const encode = ref("uastc-hdr-4x4");
const mipmap = ref(true);
const zstd = ref(true);
const result = ref(null);
const status = ref({ text: "", type: "info" });

const fileExt = computed(() => {
  if (!file.value) return "";
  const i = file.value.name.lastIndexOf(".");
  return i >= 0 ? file.value.name.slice(i + 1).toUpperCase() : "—";
});

const sizeChangeText = computed(() => {
  if (!result.value) return "—";
  const diff = result.value.convertedSize - result.value.originalSize;
  if (Math.abs(diff) < 1) return "几乎不变";
  return diff <= 0
    ? `${formatSize(Math.abs(diff))} 减小`
    : `${formatSize(diff)} 增大`;
});

const sizeChangeClass = computed(() => {
  if (!result.value) return "";
  const diff = result.value.convertedSize - result.value.originalSize;
  if (diff < 0) return "ok";
  if (diff > 0) return "warn";
  return "";
});

const usageCode = `import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const loader = new KTX2Loader()
  .setTranscoderPath('path/to/basis/')
  .detectSupport(renderer);

const texture = await loader.loadAsync('env.ktx2');
texture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = texture;
scene.background = texture;`;

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

function revokeResult() {
  if (result.value?.url) URL.revokeObjectURL(result.value.url);
  result.value = null;
}

function acceptFile(f) {
  if (!f) return;
  if (!isHdrFile(f)) {
    setStatus("error", "请选择 .hdr 或 .exr 文件");
    return;
  }
  revokeResult();
  file.value = f;
  setStatus("info", `已选择 ${f.name}，可调整选项后开始转换`);
}

async function runConvert() {
  if (!file.value || busy.value) return;
  busy.value = true;
  revokeResult();
  setStatus("warning", "正在编码 KTX2…");
  try {
    const out = await convertHdrToKtx2(file.value, {
      encode: encode.value,
      mipmap: mipmap.value,
      zstd: zstd.value,
    });
    const outputName = withExt(file.value.name, "ktx2");
    result.value = {
      blob: out.blob,
      url: URL.createObjectURL(out.blob),
      outputName,
      originalSize: file.value.size,
      convertedSize: out.bytes.byteLength,
      imageType: out.imageType,
      encode: out.encode,
      mipmap: mipmap.value,
      zstd: zstd.value,
    };
    setStatus("success", `转换完成 · ${formatSize(out.bytes.byteLength)}`);
  } catch (err) {
    setStatus("error", err?.message || "转换失败");
  } finally {
    busy.value = false;
  }
}

function downloadResult() {
  if (!result.value) return;
  triggerDownload(result.value.blob, result.value.outputName);
}

onUnmounted(() => {
  revokeResult();
});
</script>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  font-size: 0.84rem;
  color: var(--ink);
}

.info-grid strong {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 2px;
}

.option-checks {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.hint-inline {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.busy-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
  padding: 40px 16px;
}

.busy-box .el-icon {
  font-size: 36px;
  color: var(--brand);
}

.result-table-wrap {
  overflow-x: auto;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.result-table th,
.result-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  word-break: break-all;
}

.result-table th {
  color: var(--muted);
  font-weight: 600;
  background: #f8fafc;
}

.result-table td.ok {
  color: #059669;
  font-weight: 600;
}

.result-table td.warn {
  color: #d97706;
  font-weight: 600;
}

.code-block {
  margin-top: 16px;
}

.code-block pre {
  margin: 6px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.72rem;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
