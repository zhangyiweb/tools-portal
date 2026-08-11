@echo off
chcp 65001 >nul
cd /d "%~dp0"
title NVM 可视化管理

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [错误] 未检测到 Node.js。
  echo 请先安装 nvm-windows 或 Node.js，然后再打开本工具。
  echo.
  echo 正在打开 nvm-windows 下载页面...
  start "" "https://github.com/coreybutler/nvm-windows/releases/latest"
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo 首次运行，正在安装依赖，请稍候...
  set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
  call npm install
  if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
  echo 依赖安装完成。
  echo.
)

echo 正在启动 NVM 可视化管理...
call npm start
if errorlevel 1 (
  echo.
  echo [错误] 启动失败。
  pause
  exit /b 1
)
