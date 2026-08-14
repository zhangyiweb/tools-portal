@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5202
title UI Editor

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 18+
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing root dependencies...
  call npm install
)
if not exist "apps\web\node_modules\" (
  echo Installing web dependencies...
  call npm install --prefix apps/web
)
if not exist "server\node_modules\" (
  echo Installing server dependencies...
  call npm install --prefix server
)

echo Starting UI Editor...
echo Open: http://127.0.0.1:%PORT%/
echo Keep this window open.
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://127.0.0.1:%PORT%/"
start "UI Editor API" cmd /c "npm run dev --prefix server"
call npm run dev --prefix apps/web -- --port %PORT% --strictPort --open
if errorlevel 1 pause