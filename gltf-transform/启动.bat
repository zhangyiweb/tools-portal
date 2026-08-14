@echo off
chcp 65001 >nul
cd /d "%~dp03.0\frontend"
title glTF Transform

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 18+
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] 3.0\frontend\package.json not found
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

echo Starting glTF Transform...
echo Open: http://127.0.0.1:3000/
echo Keep this window open.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:3000/"
node server.js
if errorlevel 1 pause