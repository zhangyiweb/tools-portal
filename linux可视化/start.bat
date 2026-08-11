@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在安装依赖（如已安装会很快跳过）...
call npm install
echo.
echo 启动 Linux Viz Ops...
echo 浏览器打开提示的 Local 地址（默认 http://localhost:5173 ）
echo API 地址: http://localhost:3789
echo.
call npm run dev
