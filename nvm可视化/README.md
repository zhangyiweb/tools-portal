# NVM 可视化管理

基于 Electron 的 Windows NVM 图形界面，调用本机 `nvm-windows` 管理 Node.js 版本。

## 功能

- 查看当前 Node 版本与 nvm 状态
- 已安装版本：切换使用、卸载
- 可安装版本：从 nodejs.org 拉取列表，支持搜索与仅 LTS
- 一键安装 LTS / Latest

## 前提

已安装 [nvm-windows](https://github.com/coreybutler/nvm-windows)，并确保 `nvm` 在 PATH 中可用。

切换版本（`nvm use`）在部分环境需要**管理员权限**，如遇失败请以管理员身份启动本应用。

## 使用

### 方式一：打包成 exe（推荐）

```bash
npm install
npm run dist
```

完成后在 `dist` 目录得到 **`NVM可视化管理-1.0.0.exe`**，双击即可运行（便携版，无需安装）。

### 方式二：开发模式

双击 `启动.bat`，或：

```bash
npm install
npm start
```

### NVM 安装 / 更新

- 未检测到 nvm 时，界面会显示「安装 NVM」按钮，自动下载官方 `nvm-setup.exe` 并打开安装向导。
- 已安装时可点「更新 NVM」：优先执行 `nvm upgrade`，失败则下载最新安装包覆盖升级。
- 安装或更新完成后请点击「刷新」。

若 Electron 下载失败（常见于国内网络），项目已包含 `.npmrc` 镜像配置；也可手动设置：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

可安装版本列表会优先请求 nodejs.org，失败时自动回退到 npmmirror。若 `nvm install` 本身很慢，可在本机配置：

```bash
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/
```
