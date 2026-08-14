@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8090
title Sketchfab

echo Starting Sketchfab...
echo Open: http://127.0.0.1:%PORT%/
echo Keep this window open.
echo.

start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:%PORT%/"

where py >nul 2>&1
if %errorlevel%==0 (
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  python -m http.server %PORT%
  goto :eof
)

echo Python not found, opening index.html
start "" "%~dp0index.html"
pause