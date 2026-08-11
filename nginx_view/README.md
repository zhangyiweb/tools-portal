# Nginx 可视化工具（Windows 本地，MVP）

你要做的事情：把前端构建产物 `dist` 导入进来，然后用开关控制是否启用；点击按钮启动/停止 Nginx。

## 功能（当前 MVP）

- 导入 `dist` 文件夹（会校验是否存在 `index.html`）
- 每个项目自动分配一个端口（默认从 8000 开始）
- 生成 Nginx 配置：对 Vue/React 等 SPA 自动做 `try_files ... /index.html`
- 一键启动/停止 Nginx；项目启用状态变化会自动 `reload`
- 首次运行会自动下载并解压 Nginx 到用户数据目录

## 如何运行

1. 安装 Node.js（建议 18+ 或 20+）
2. 在本目录执行：

```bash
npm install
npm run dev
```

## 数据保存位置

程序默认把数据放在**项目根目录**下，方便整目录拷到其他电脑使用：

- `nginx-visual-manager-data/`
  - `state.json`：项目列表与设置
  - `nginx/`：下载的 `nginx.exe`、生成的 `conf/nginx.conf`、日志 `logs/`

在界面右上角点击“打开数据目录”即可直接打开。

首次启动会自动把旧版 `AppData\Roaming\nginx-visual-manager` 里的数据迁移过来，并清空旧目录。


