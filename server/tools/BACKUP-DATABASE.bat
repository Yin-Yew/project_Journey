@echo off
setlocal
cd /d "%~dp0..\.."
if not exist "server\.env" copy ".env.example" "server\.env" >nul
cd server
if not exist node_modules\mysql2\package.json call npm ci
node database-snapshot.js backup
if errorlevel 1 (echo Backup failed. Make sure MySQL is running and credentials are set.)
pause
