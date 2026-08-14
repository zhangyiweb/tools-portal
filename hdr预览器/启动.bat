@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5101
title HDR Viewer

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

echo Starting HDR Viewer...
echo Open: http://127.0.0.1:%PORT%/
echo Keep this window open.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:%PORT%/"
call npm run dev -- --port %PORT% --strictPort --open
if errorlevel 1 pause