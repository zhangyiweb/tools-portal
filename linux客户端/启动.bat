@echo off
cd /d "%~dp0"
title Linux Client

where java >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Java not found. Install JDK/JRE first.
  pause
  exit /b 1
)

if not exist "target\easy-ssh-1.0.0.jar" (
  echo [ERROR] target\easy-ssh-1.0.0.jar not found
  pause
  exit /b 1
)

java -jar "target\easy-ssh-1.0.0.jar"
if errorlevel 1 pause