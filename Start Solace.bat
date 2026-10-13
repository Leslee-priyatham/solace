@echo off
rem Double-click to start Solace on Windows. Keep the window open while you use it; close it to stop.
title Solace
cd /d "%~dp0app"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Solace needs Node.js, which isn't installed on this computer yet.
  echo.
  echo   1. The Node.js download page is opening now.
  echo   2. Download and install the "LTS" version ^(accept the default options^).
  echo   3. Double-click "Start Solace" again.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

node scripts\launch.mjs
if errorlevel 1 (
  echo.
  pause
)
