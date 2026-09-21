<template>
  <div class="app-shell">
    <div class="mobile-bar">
      <el-button :icon="Menu" circle @click="drawer = true" />
      <strong>{{ currentTitle }}</strong>
    </div>

    <aside class="side-panel" :class="{ open: drawer }">
      <div class="brand">
        <h1>本地工具箱</h1>
        <p>本地处理 · 图片不上传</p>
      </div>

      <el-menu
        class="side-menu"
        :default-active="active"
        :default-openeds="['image']"
        @select="onSelect"
      >
        <el-sub-menu index="image">
          <template #title>
            <el-icon><Picture /></el-icon>
            <span>图片处理</span>
          </template>
          <el-menu-item index="compress">
            <span>图片压缩</span>
          </el-menu-item>
          <el-menu-item index="resize">
            <span>图片改尺寸</span>
          </el-menu-item>
          <el-menu-item index="convert">
            <span>格式转换</span>
          </el-menu-item>
          <el-menu-item index="crop">
            <span>图片裁剪</span>
          </el-menu-item>
          <el-menu-item index="split">
            <span>图片分割</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </aside>

    <div v-if="drawer" class="side-mask" @click="drawer = false" />

    <main class="main-panel">
      <CompressPanel v-if="active === 'compress'" />
      <ResizePanel v-else-if="active === 'resize'" />
      <ConvertPanel v-else-if="active === 'convert'" />
      <CropPanel v-else-if="active === 'crop'" />
      <SplitPanel v-else-if="active === 'split'" />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Menu, Picture } from "@element-plus/icons-vue";
import CompressPanel from "./components/CompressPanel.vue";
import ResizePanel from "./components/ResizePanel.vue";
import ConvertPanel from "./components/ConvertPanel.vue";
import CropPanel from "./components/CropPanel.vue";
import SplitPanel from "./components/SplitPanel.vue";

const titles = {
  compress: "图片压缩",
  resize: "图片改尺寸",
  convert: "格式转换",
  crop: "图片裁剪",
  split: "图片分割",
};

const active = ref("compress");
const drawer = ref(false);
const currentTitle = computed(() => titles[active.value] || "本地工具箱");

function onSelect(key) {
  if (!titles[key]) return;
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
