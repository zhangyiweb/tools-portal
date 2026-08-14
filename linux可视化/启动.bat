@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Linux View

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 18+
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
)

echo Starting Linux View...
echo Open: http://127.0.0.1:5173/
echo Keep this window open.
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://127.0.0.1:5173/"
call npm run dev
if errorlevel 1 pause