# 工具门户

本地开发工具集合的展示页，汇总多个实用小工具，并附界面预览与说明。

用浏览器直接打开根目录的 [`index.html`](./index.html) 即可浏览；点击项目截图可放大预览。

## 包含项目

| 项目 | 说明 | 类型 |
|------|------|------|
| [HDR 预览器](./hdr预览器) | 浏览 Poly Haven HDRI，实时预览环境光照，支持导入 GLB 编辑材质并导出 | Web |
| [Linux 可视化](./linux可视化) | 浏览器内通过 SSH 管理远程 Linux：Docker、部署、数据库与文件编辑 | Web |
| [Linux 客户端](./linux客户端) | Java Swing 桌面端：系统监控、文件管理、容器操作与一键部署 | Desktop |
| [Nginx 可视化](./nginx_view) | Windows 本地 Nginx 管理：导入 dist、分配端口、一键启停与自动配置 | Desktop |
| [NVM 可视化](./nvm可视化) | nvm-windows 图形界面：查看、安装、切换与卸载 Node.js 版本 | Desktop |
| [Three.js 中文文档](./three.js_185_CN) | Three.js r185 简体中文 API 文档与示例 | Docs |
| [UI 编辑器](./UI编辑器) | 可视化拖拽搭建界面，支持 Figma 导入，导出 HTML / React / Vue | Web |

## 快速开始

### 浏览门户

```bash
# 用系统默认浏览器打开
start index.html
```

### 运行各子项目

多数 Web / Electron 项目需要 **Node.js 18+**：

```bash
cd <项目目录>
npm install
npm run dev   # 或 npm start，以各项目 README 为准
```

- **Linux 可视化**：也可双击 `linux可视化/start.bat`
- **NVM 可视化**：双击 `nvm可视化/启动.bat`，或使用打包好的可执行文件
- **Linux 客户端**（Java）：

```powershell
cd linux客户端
java -jar target\easy-ssh-1.0.0.jar
# 或双击 run.bat
```

各项目更详细的说明见对应目录下的 `README.md`。

## 相关在线地址

- HDR 预览器：https://zhangyiweb.github.io/polyhaven-hdri-viewer/
- Three.js 中文文档：https://zhangyiweb.github.io/threejsDocs/

## 说明

- 仓库已忽略 `node_modules`、构建产物（如 `dist` / `*.exe`）、运行时数据等大体积目录
- `three.js_185_CN` 中体积很大的 `examples` / `manual` 未纳入本仓库，完整文档与示例见：[threejsDocs](https://github.com/zhangyiweb/threejsDocs)
- 克隆后请在各子项目中自行 `npm install`（或按 README 构建）后再运行
