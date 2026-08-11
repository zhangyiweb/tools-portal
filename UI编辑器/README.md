# UI 编辑器 MVP

可视化 Web UI 编辑器：拖拽搭建界面，支持 Figma 设计稿导入，一键导出 HTML/CSS 与 React。

## 快速开始

```bash
# 根目录安装 concurrently
npm install

# 安装子项目依赖（若尚未安装）
npm install --prefix apps/web
npm install --prefix server

# 同时启动前端 (5173) 与 API (8787)
npm run dev
```

打开 http://localhost:5173

## 功能

- 三栏编辑器：组件/图层、画布、属性
- **多分辨率画布**：手机 / 平板 / 桌面预设一键切换（375～1920）
- **Ant Design** / **Element Plus** 组件库（画布预览）
- 基础组件：Frame、Rect、Text、Image、Button、Input
- 多页面画布：底部新建 / 切换 / 复制 / 删除 / 重命名页面
- 选中、拖拽移动、缩放手柄；滚轮缩放，小手拖拽平移
- 撤销 / 重做（Ctrl+Z / Ctrl+Y）、删除、复制（Ctrl+D）
- 导出 HTML+CSS / React / Vue（原生代码，不依赖 UI 库）
- Figma 导入（需 Personal Access Token）
- 蓝湖 CSS：右侧「蓝湖CSS」粘贴蓝湖复制的样式，应用到选中元素
- 单位切换：工具栏可选 px（固定）/ rem（随页面宽度缩放，默认 px）
- 参考图层：上传蓝湖切图/截图半透明叠加对照

## Figma 导入

1. 在 [Figma Settings → Personal access tokens](https://www.figma.com/developers/api#access-tokens) 创建 Token
2. 点击工具栏「导入 Figma」，粘贴文件链接与 Token
3. 服务端代理 `api.figma.com`，映射节点树与图片资源到编辑器

## 目录

```
apps/web/     # Vite + React 编辑器
server/       # Express Figma 代理
```

## 说明

- 首期布局为绝对定位，优先视觉保真
- 蓝湖无公开结构化设计树 API，故用参考图层过渡；设计导入主路径为 Figma
