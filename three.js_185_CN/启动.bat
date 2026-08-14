@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8081
title Three.js Docs

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

echo Starting Three.js docs...
echo URL: http://127.0.0.1:%PORT%/docs/
echo Keep this window open.
echo.
echo Building, please wait...
call node utils/build/dev.js
if errorlevel 1 (
  echo [ERROR] build failed
  pause
  exit /b 1
)

start "" "http://127.0.0.1:%PORT%/docs/"
node utils/server.js -p %PORT%
if errorlevel 1 pause