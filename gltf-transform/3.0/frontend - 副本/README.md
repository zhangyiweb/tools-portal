# 3D 资源工具箱（v3.0）

基于 Web 的 3D 资源处理工具，支持 GLB 模型压缩和 HDR 环境贴图转 KTX2。

**仓库地址：** [https://gitee.com/zhangyiweb/gltf-transform](https://gitee.com/zhangyiweb/gltf-transform)

## 功能特性

### 模型压缩
- 拖拽上传 GLB 模型文件
- 侧边栏展示模型节点树结构
- 显示原始模型的基本信息（面数、顶点数、材质数等）
- 多种压缩选项：WebP 纹理压缩、Draco 网格压缩、GLB 优化
- 压缩前后文件大小对比与下载

### HDR 转 KTX2
- 支持 .hdr、.exr 格式环境贴图
- UASTC HDR 4×4 / 6×6i 编码选项
- 可选 Mipmap 生成与 Zstd 超级压缩
- 转换结果对比与 KTX2 文件下载

### HDR 转天空盒
- 将等距柱状 HDR 全景图转为 6 张立方体贴图
- 输出命名 `px` `nx` `py` `ny` `pz` `nz`，兼容 Three.js CubeTexture
- 支持 PNG / HDR / JPEG 输出格式
- 可选单面分辨率（512 / 1024 / 2048）与色调映射
- 打包 ZIP 一键下载

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js, Express
- 压缩工具：gltf-transform (CLI)

## 安装和使用

### 1. 安装依赖

全局安装 gltf-transform CLI（模型压缩）：

```bash
npm install -g @gltf-transform/cli
```

安装项目依赖（含 `ktx2-encoder`，用于 HDR 转 KTX2）：

```bash
npm install
```

### 2. 启动服务器

```bash
node server.js
```

服务器将在 `http://localhost:3000` 上运行。

### 3. 使用工具

1. 在浏览器中打开 `http://localhost:3000`
2. 通过顶部 Tab 切换「模型压缩」或「HDR 转 KTX2」页面
3. 上传文件、选择选项、点击开始处理
4. 查看结果对比并下载输出文件

## 压缩选项说明

- **WebP纹理压缩**: 将模型中的纹理压缩为WebP格式，显著减小纹理大小，无需额外依赖
- **Draco网格压缩**: 使用Google的Draco算法压缩3D网格几何数据
- **GLB优化**: 对GLB文件进行整体优化，去除冗余数据

## 工作流程

1. 用户上传GLB模型
2. 服务器接收文件并保存到临时目录
3. 根据用户选择的选项执行相应的gltf-transform命令
4. 返回压缩结果和统计信息
5. 用户可以下载压缩后的模型文件

## HDR 转换技术说明

HDR 转 KTX2 通过 npm 包 [`ktx2-encoder`](https://www.npmjs.com/package/ktx2-encoder) 实现，底层使用 Basis Universal WASM 编码器，直接解析 `.hdr` / `.exr` 文件，无需安装 KTX-Software 命令行工具。

## 扩展新页面

前端采用 Tab 模块化架构，添加新功能只需：

1. 在 `index.html` 的 `tab-nav` 和 `main-content` 中添加 Tab 按钮和面板
2. 新建 `public/js/xxx.js`，调用 `TabManager.register('xxx', { showSidebar: false })`
3. 在 `index.html` 中于 `app.js` 之前引入新脚本
4. 在 `server.js` 中添加对应 API 接口

## 注意事项

- 确保系统已安装 Node.js（版本 >= 14.0.0）
- 模型压缩需要全局安装 gltf-transform CLI
- HDR 转换依赖 `ktx2-encoder` npm 包（`npm install` 时自动安装）
- 处理大型文件可能需要较长时间，请耐心等待
