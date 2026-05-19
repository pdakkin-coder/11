@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

if not exist dist\index.cjs (
  echo Building application...
  call npm run build
)

echo Starting Codex Citation Desktop at http://127.0.0.1:5000/#/
set HOST=127.0.0.1
set PORT=5000
set NODE_ENV=production
call npm start
