<template>
  <div class="app-shell">
    <div class="mobile-bar">
      <el-button :icon="Menu" circle @click="drawer = true" />
      <strong>{{ currentTitle }}</strong>
    </div>

    <aside class="side-panel" :class="{ open: drawer }">
      <div class="brand">
        <div class="brand-mark">
          <el-icon :size="20"><PictureFilled /></el-icon>
        </div>
        <h1>本地工具箱</h1>
        <p>清新本地处理 · 图片不上传</p>
      </div>

      <el-menu
        class="side-menu"
        :default-active="active"
        @select="onSelect"
      >
        <el-menu-item index="compress">
          <el-icon><Picture /></el-icon>
          <span>图片压缩</span>
        </el-menu-item>
        <el-menu-item index="resize">
          <el-icon><FullScreen /></el-icon>
          <span>图片改尺寸</span>
        </el-menu-item>
        <el-menu-item index="convert">
          <el-icon><Switch /></el-icon>
          <span>格式转换</span>
        </el-menu-item>
      </el-menu>

      <div class="side-foot">
        Vue 3 + Element Plus<br />
        Worker + WASM 本地编解码
      </div>
    </aside>

    <div v-if="drawer" class="side-mask" @click="drawer = false" />

    <main class="main-panel">
      <CompressPanel v-if="active === 'compress'" />
      <ResizePanel v-else-if="active === 'resize'" />
      <ConvertPanel v-else />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Menu, PictureFilled, Picture, FullScreen, Switch } from "@element-plus/icons-vue";
import CompressPanel from "./components/CompressPanel.vue";
import ResizePanel from "./components/ResizePanel.vue";
import ConvertPanel from "./components/ConvertPanel.vue";

const titles = {
  compress: "图片压缩",
  resize: "图片改尺寸",
  convert: "格式转换",
};

const active = ref("compress");
const drawer = ref(false);
const currentTitle = computed(() => titles[active.value] || "本地工具箱");

function onSelect(key) {
  active.value = key;
  drawer.value = false;
  history.replaceState(null, "", `#${key}`);
}

const hash = location.hash.replace(/^#/, "");
if (titles[hash]) active.value = hash;

watch(active, (v) => {
  document.title = `${titles[v]} · 本地工具箱`;
});
</script>

<style scoped>
.side-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 78, 74, 0.28);
  z-index: 35;
}

@media (min-width: 901px) {
  .side-mask {
    display: none;
  }
}
</style>
