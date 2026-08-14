# 工具门户

本地开发工具集合的展示页。用浏览器打开根目录 [`index.html`](./index.html) 即可浏览各项目截图、用途说明与**启动方式**；点击截图可放大预览。

## 包含项目

### [HDR 预览器](./hdr预览器) · Web

**用途：** 给做 3D / 可视化的同学快速挑选和试用环境贴图（HDRI），并在真实光照下检查模型材质。

从 Poly Haven 浏览海量 HDRI，在 Three.js 场景里实时看环境光照与背景效果；可导入 GLB/GLTF 模型，改 PBR 材质与贴图后再导出。适合选图、看光照、调材质，不必先搭一整套 3D 工程。

**如何启动：** 双击 `启动.bat`，会自动安装依赖（如需要）并打开 http://127.0.0.1:5101/ 。

```bash
cd hdr预览器
npm install
npm run dev -- --port 5101
```

### [Linux 可视化](./linux可视化) · Web

**用途：** 让不熟悉 Linux 命令的前端也能管远程服务器——部署站点、管 Docker、装数据库，主要靠界面点选完成。

浏览器里 SSH 连上机器后，可看 CPU/内存/磁盘，管理容器/镜像/数据卷，在线改站点与卷文件，按向导部署前后端（含 Compose）或安装 MySQL / PostgreSQL / Redis。适合个人或内网开发机的日常运维。

**如何启动：**

```bash
cd linux可视化
npm install
npm run dev
```

Windows 双击 `启动.bat` 会自动打开 http://127.0.0.1:5173/ 。API 默认 `http://localhost:3789`。

### [Linux 客户端](./linux客户端) · Desktop（Java）

**用途：** 和「Linux 可视化」目标类似，但是 Windows 桌面端，适合想独立窗口、少开浏览器的场景。

基于 Java Swing：管理多台服务器连接，左侧看系统状态与进程磁盘，支持文件上传下载、容器启停/日志/迁移，以及一键装 Docker/Nginx、部署静态站或拉镜像跑容器。配置保存在本机 `~/.easy-ssh/`。

**如何启动（需已安装 Java）：**

```powershell
cd linux客户端
java -jar target\easy-ssh-1.0.0.jar
```

或双击 `启动.bat`。

### [Nginx 可视化](./nginx_view) · Desktop（Electron）

**用途：** 在 Windows 本机把多个前端 `dist` 挂到 Nginx 上本地预览或局域网演示，不用手写配置、不用记端口。

导入带 `index.html` 的构建目录后自动分配端口并生成 SPA 友好配置（`try_files`），一键启停 Nginx，开关项目会自动 reload。适合同时预览多个前端包、给同事看本地效果。

**如何启动：** 双击 `启动.bat`（会打开 Electron 窗口）。

```bash
cd nginx_view
npm install
npm run dev
```

### [NVM 可视化](./nvm可视化) · Desktop（Electron）

**用途：** 用图形界面管理 Windows 上的 Node.js 多版本，避免反复敲 `nvm` 命令。

基于 nvm-windows：查看当前版本与 nvm 状态，安装/切换/卸载 Node，支持搜列表、只看 LTS，以及一键装 LTS / Latest。未装 nvm 时可从界面引导安装。适合经常在多个 Node 大版本之间切换的开发环境。

**如何启动：**

```bash
cd nvm可视化
npm install
npm start
```

或双击 `启动.bat`（会打开 Electron 窗口）。

### [GLB Shrink](./glb-shrink) · Web

**用途：** 把 AI 生成或扫描得到的臃肿 GLB（常见数 MB～数十 MB）压成可上线的轻量资源，用于网页 3D、游戏、AR/VR。

拖放 `.glb` 后左右对比压缩前后效果，支持 Draco 几何与 WebP 纹理等，按质量档位一键压缩并下载。无需 Blender、无需命令行调参。

**如何启动：** 双击 `启动.bat`，浏览器会打开 http://127.0.0.1:5201/ 。

```bash
cd glb-shrink
npm install
npm run dev
```

### [glTF Transform](./gltf-transform) · Web

**用途：** 本地 glTF/GLB 处理与转换相关工具（按版本目录组织）。

**如何启动：** 双击 `启动.bat`，浏览器会打开 http://127.0.0.1:3000/ 。

```bash
cd gltf-transform/3.0/frontend
npm install
node server.js
```

### [Sketchfab 模型库](./sketchfab) · Web

**用途：** 在本地网页里搜索、筛选 Sketchfab 上的 3D 模型，预览并查找可下载素材。

**如何启动：** 双击 `启动.bat`，浏览器会打开 http://127.0.0.1:8090/ 。

### [Three.js 中文文档](./three.js_185_CN) · Docs

**用途：** 查阅 Three.js r185 的简体中文 API，降低英文文档门槛，方便边查边写 3D 代码。

本目录为中文文档相关源码与资源（体积很大的 examples/manual 等未全部纳入本仓库）。

**如何启动：** 双击 `启动.bat`，浏览器会打开 http://127.0.0.1:8081/docs/ 。

```bash
cd three.js_185_CN
npm install
npm run dev
```

### [UI 编辑器](./UI编辑器) · Web

**用途：** 用拖拽方式搭网页界面原型，再导出可读的前端代码，减少从设计到脚手架的手工还原。

三栏编辑器（组件/画布/属性），支持多分辨率画布、多页面、Ant Design / Element Plus 预览组件；可从 Figma 导入，或贴蓝湖 CSS、叠参考图对照。一键导出 HTML/CSS、React、Vue（原生结构，不绑死 UI 库）。适合出原型、切页面、快速交付静态/组件稿。

**如何启动：** 双击 `启动.bat`，浏览器会打开 http://127.0.0.1:5202/ 。

```bash
cd UI编辑器
npm install
npm install --prefix apps/web
npm install --prefix server
npm run dev
```

## 快速开始

### 浏览门户

```bash
start index.html
```

每个项目目录里都有一个 **`启动.bat`**，双击即可。Web 项目会自动打开浏览器。需要 **Node.js 18+**；Linux 客户端需要 **Java**；Sketchfab 需要 Python。更细的功能说明见各子目录 `README.md`。

## 说明

- 仓库已忽略 `node_modules`、构建产物（如 `dist` / `*.exe`）、运行时数据等大体积目录
- `three.js_185_CN` 中体积很大的 `examples` / `manual` 未纳入，以控制仓库体积
- 克隆后请在各子项目中自行 `npm install`（或按对应 README 构建）后再运行
