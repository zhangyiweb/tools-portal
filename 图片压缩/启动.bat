@echo off
chcp 65001 >nul
cd /d "%~dp0"

title 本地工具箱

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装后再运行。
  echo 下载地址: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [错误] 未找到 package.json，请确认脚本放在项目根目录。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [提示] 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败。
    echo.
    pause
    exit /b 1
  )
  echo.
)

echo [启动] 正在启动本地服务，并自动打开浏览器...
echo [提示] 关闭本窗口将停止服务。
echo.

rem --open：Vite 启动后自动打开默认浏览器
call npm run dev -- --open

echo.
echo 服务已结束。
pause
