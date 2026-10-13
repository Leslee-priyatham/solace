@echo off
rem Double-click to set a new password for a Solace account (close Solace first).
title Solace - reset password
cd /d "%~dp0app"
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js isn't installed. Follow step 1 of the README first.
  pause
  exit /b 1
)
node scripts\reset-password.mjs
echo.
pause
