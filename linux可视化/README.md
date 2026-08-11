# Linux View（linux_view）

面向前端开发者的 **Linux 可视化运维工具**。在浏览器里通过 SSH 连接远程 Linux，管理 Docker、部署前后端、编辑站点/卷文件，无需熟记一长串命令。

仓库：[https://github.com/zhangyiweb/linux_view](https://github.com/zhangyiweb/linux_view)

## 功能

- **SSH 连接**：密码 / 私钥登录，多服务器切换与退出，本地凭证可自动重连
- **系统总览**：CPU / 内存 / 磁盘可视化，常用环境检测
- **Docker**
  - 容器：启停 / 重启 / 日志 / 详情；前端类容器显示一键访问地址；点击名称打开详情
  - 镜像：列表、拉取 / 上传（`docker load`）、基于镜像创建容器
  - 数据卷：创建、浏览、删除；可跳转卷 `_data` 目录
  - **文件管理**：浏览 `/opt/vizops/sites` 与 Docker 卷目录，在线编辑、上传、新建文件/目录
  - 一键安装 Docker
- **应用部署**：前端站点（Nginx）、后端服务、**Compose 一键部署**（仅前端 / 仅后端 / 前后端）
- **数据库**：向导安装 MySQL / PostgreSQL / Redis
- **命令行**：常用排查命令 + 自定义执行

## 快速开始

环境要求：**Node.js 18+**

```bash
git clone https://github.com/zhangyiweb/linux_view.git
cd linux_view
npm install
npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| API  | http://localhost:3789 |

Windows 也可双击 `start.bat`。

生产构建（API 与静态资源同端口）：

```bash
npm run build
npm start
```

## 使用流程

1. 打开 **服务器**，填写主机、用户名、密码或私钥并连接
2. 进入 **总览** 查看资源
3. **Docker** 管理容器 / 镜像 / 数据卷 / 文件
4. **部署** / **数据库** 按向导完成发布与安装

## 权限说明

安装 Docker、数据库、Nginx 等会调用 `sudo`。建议使用具备 sudo 的用户，并配置免密 sudo（`NOPASSWD`），否则非交互远程命令可能卡住。

凭证默认保存在本机浏览器与 Node 进程侧，**请勿把真实密码写进代码后提交到公开仓库**。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 · Vite · Ant Design · Recharts · React Router |
| 后端 | Express · ssh2 · SSE 任务流 |
| 连接 | SSH（远程 Linux） |

## 目录结构

```
├── client/          # 可视化前端
├── server/          # SSH API 与运维编排
├── package.json     # npm workspaces 根项目
├── start.bat        # Windows 一键启动
└── README.md
```

## 安全提示

本工具面向个人 / 内网开发运维。请勿将带凭证的服务暴露到公网；生产环境优先使用 SSH 密钥，并限制 sudo 范围。
