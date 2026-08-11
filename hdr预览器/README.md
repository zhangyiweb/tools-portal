# Poly Haven HDRI 预览器

基于 **Three.js + Vite** 的在线 HDRI 浏览器。可从 [Poly Haven](https://polyhaven.com/zh) 浏览环境贴图、实时预览光照与背景，并支持导入 GLB 模型进行材质编辑与导出。

**在线访问：** https://zhangyiweb.github.io/polyhaven-hdri-viewer/

## 功能

### HDRI 浏览与预览
- 从 Poly Haven API 加载 HDRI 列表，缩略图双列网格展示
- 搜索、分类筛选，滚动分页加载
- 分辨率切换：1k / 2k / 4k / 8k / 16k（默认 1k）
- 环境光照与背景可独立开关
- 支持下载当前 HDR 文件

### 3D 场景
- 轨道控制器浏览场景
- 平行光 + 半球光，支持软阴影
- ACES 色调映射，可调试曝光与光照参数（右上角 GUI）

### GLB 模型
- 导入 `.glb` / `.gltf`（支持 Draco、Meshopt 压缩）
- 导出单个或全部模型（保留材质修改）
- 左下角模型列表管理

### 材质编辑
- 左键点击模型网格打开右侧材质面板
- 编辑 Three.js 材质通用属性与 PBR 参数
- 贴图槽：添加 / 替换 / 删除贴图，调节贴图强度
- **UV 坐标**：缩放、偏移、旋转；无 UV 模型自动生成立方体投影 UV
- 点击空白处关闭面板

## 技术栈

| 依赖 | 用途 |
|------|------|
| [Three.js](https://threejs.org/) r184 | 3D 渲染 |
| [Vite](https://vitejs.dev/) | 构建与开发服务器 |
| [lil-gui](https://lil-gui.georgealways.com/) | 调试与材质面板 |
| Poly Haven API | HDRI 数据与文件 |

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装与运行

```bash
git clone https://github.com/zhangyiweb/polyhaven-hdri-viewer.git
cd polyhaven-hdri-viewer
npm install
npm run dev
```

浏览器访问终端提示的本地地址（通常为 `http://localhost:5173`）。

### 构建

**本地静态部署**（资源路径为 `/`）：

```bash
npm run build
npm run preview
```

**GitHub Pages 部署**（资源路径含仓库名 `/polyhaven-hdri-viewer/`）：

```bash
npm run build:pages
```

构建产物输出到 `dist/` 目录。推送到 GitHub 后，访问：

https://zhangyiweb.github.io/polyhaven-hdri-viewer/

## 项目结构

```
hdr/
├── index.html          # 页面入口
├── package.json
├── vite.config.js
├── src/
│   ├── main.js         # UI、HDRI 列表、导入导出
│   ├── scene.js        # Three.js 场景、光照、GLB 加载
│   ├── polyhaven.js    # Poly Haven API
│   ├── categories.js   # HDRI 分类中文化
│   ├── materialEditor.js  # 材质与 UV 编辑
│   ├── gui.js          # 渲染调试 GUI
│   └── style.css
└── dist/               # 构建输出
```

## 使用说明

1. 启动后从左侧列表选择 HDRI，即可在右侧预览环境光照与背景。
2. 点击 **导入 GLB 模型** 加载模型，用鼠标拖拽旋转、滚轮缩放视图。
3. 左键点击模型表面，在右侧面板编辑材质与贴图；可调整 UV 后导出模型。
4. 本地离线分享：执行 `npm run build`，将 `dist/` 部署到网站根路径即可。
5. GitHub Pages：执行 `npm run build:pages` 后提交 `dist/`，或在仓库 Settings → Pages 中从 `main` 分支的 `/dist` 目录发布。

## 说明

- HDRI 数据与缩略图来自 Poly Haven，使用时请遵守其许可协议。
- 自动生成的 UV 为立方体投影，适合快速贴图；精细展开建议在 Blender 等 DCC 工具中处理。
- 部分功能需通过 HTTP 访问，不建议直接用 `file://` 打开页面。

## License

本项目代码仅供学习与交流。Poly Haven 资产请遵循 [Poly Haven License](https://polyhaven.com/license)。
