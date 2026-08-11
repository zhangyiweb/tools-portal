import { defineConfig } from 'vite';

/** GitHub Pages 项目站路径，与仓库名一致 */
const GITHUB_PAGES_BASE = '/polyhaven-hdri-viewer/';

export default defineConfig(({ command }) => ({
  // 开发用根路径；构建默认面向 GitHub Pages
  base: command === 'serve' ? '/' : (process.env.VITE_BASE || GITHUB_PAGES_BASE),
  server: {
    port: 5173,
    open: true,
  },
}));