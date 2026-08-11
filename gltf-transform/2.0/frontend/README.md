# GLB模型压缩工具

这是一个基于Web的GLB模型压缩工具，使用gltf-transform库来压缩3D模型文件。该工具提供了图形界面，允许用户上传GLB模型、选择不同的压缩选项，并比较压缩前后的文件大小。

## 功能特性

- 拖拽上传GLB模型文件
- 显示原始模型的基本信息（文件名、大小等）
- 提供多种压缩选项：
  - KTX2纹理压缩 (etc1s)
  - Draco网格压缩
  - GLB优化
- 压缩前后文件大小对比
- 下载压缩后的模型文件

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js, Express
- 压缩工具：gltf-transform (CLI)

## 安装和使用

### 1. 安装依赖

首先全局安装gltf-transform CLI：

```bash
npm install -g @gltf-transform/cli
```

然后安装项目依赖：

```bash
cd frontend
npm install
```

### 2. 启动服务器

```bash
cd frontend
node server.js
```

服务器将在 `http://localhost:3000` 上运行。

### 3. 使用工具

1. 在浏览器中打开 `http://localhost:3000`
2. 拖拽或选择一个GLB文件上传
3. 选择所需的压缩选项
4. 点击"开始压缩"按钮
5. 查看压缩结果对比
6. 下载压缩后的模型文件

## 压缩选项说明

- **KTX2纹理压缩**: 将模型中的纹理压缩为KTX2格式，显著减小纹理大小
- **Draco网格压缩**: 使用Google的Draco算法压缩3D网格几何数据
- **GLB优化**: 对GLB文件进行整体优化，去除冗余数据

## 工作流程

1. 用户上传GLB模型
2. 服务器接收文件并保存到临时目录
3. 根据用户选择的选项执行相应的gltf-transform命令
4. 返回压缩结果和统计信息
5. 用户可以下载压缩后的模型文件

## 注意事项

- 确保系统已安装Node.js (版本 >= 14.0.0)
- 确保已全局安装gltf-transform CLI
- 压缩大型模型可能需要较长时间，请耐心等待