@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5201
title GLB Shrink

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

echo Starting GLB Shrink...
echo Open: http://127.0.0.1:%PORT%/
echo Keep this window open.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://127.0.0.1:%PORT%/"
call npx --yes concurrently -n web,api -c cyan,magenta "npx vite --port %PORT% --strictPort --open" "node server/index.mjs"
if errorlevel 1 pause