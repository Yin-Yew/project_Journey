@echo off
setlocal
cd /d "%~dp0..\.."
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js was not found. Install Node.js 20 or later.
 pause
 exit /b 1
)
echo Checking for an older server on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -File "server\tools\CHECK-PORT-3000.ps1"
if errorlevel 1 (
 echo.
 echo Cannot start JoyJourney: another program is already using port 3000.
 echo Stop the old JoyJourney server in VS Code with Ctrl+C, then retry.
 pause
 exit /b 1
)
if not exist "server\.env" copy ".env.example" "server\.env" >nul
cd server
if not exist "node_modules\mysql2\package.json" (
 echo Installing Node.js packages...
 call npm ci
 if errorlevel 1 (echo npm install failed.&pause&exit /b 1)
)
if not exist "node_modules\express\package.json" (
 call npm ci
 if errorlevel 1 (echo npm install failed.&pause&exit /b 1)
)
echo Preparing empty JoyJourney tables (without demo data)...
node setup-db.js
if errorlevel 1 (
 echo Setup failed. Start MySQL and verify DB_USER and DB_PASSWORD in server\.env.
 pause
 exit /b 1
)
echo.
echo Open http://localhost:3000/register.html to create your own account.
echo To stop, press Ctrl+C.
call npm start
pause
