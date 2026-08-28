@echo off
cd /d "%~dp0"
title QuickShare

if exist "dist\QuickShare.exe" (
  start "" "dist\QuickShare.exe"
  exit /b 0
)

where python >nul 2>&1
if not errorlevel 1 goto run_python

where py >nul 2>&1
if not errorlevel 1 goto run_py

echo [ERROR] Python not found. Install Python 3.10+ or build dist\QuickShare.exe
pause
exit /b 1

:run_python
echo Installing dependencies if needed...
python -m pip install -r requirements.txt -q
if errorlevel 1 (
  echo [ERROR] pip install failed
  pause
  exit /b 1
)
echo Starting QuickShare...
python main.py
if errorlevel 1 pause
exit /b 0

:run_py
echo Installing dependencies if needed...
py -3 -m pip install -r requirements.txt -q
if errorlevel 1 (
  echo [ERROR] pip install failed
  pause
  exit /b 1
)
echo Starting QuickShare...
py -3 main.py
if errorlevel 1 pause
exit /b 0
