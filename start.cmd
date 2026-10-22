@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Tokenly needs Node.js 20 or newer.
  echo   Install it from https://nodejs.org, then run this file again.
  echo.
  pause
  exit /b 1
)
node server.mjs --open
if errorlevel 1 pause
endlocal
