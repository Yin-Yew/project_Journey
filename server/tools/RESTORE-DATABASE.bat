@echo off
setlocal
cd /d "%~dp0..\.."
echo WARNING: This replaces existing JoyJourney data with a previous snapshot.
echo Backup your current database first using BACKUP-DATABASE.bat.
echo.
set /p BACKUPFOLDER=Enter full backup folder path from the backups folder: 
set /p APPROVE=Type RESTORE to confirm overwriting your database: 
if not "%APPROVE%"=="RESTORE" (echo Cancelled.&pause&exit /b 1)
cd server
if not exist node_modules\mysql2\package.json call npm ci
node database-snapshot.js restore "%BACKUPFOLDER%" RESTORE
if errorlevel 1 (echo Restore failed. The database transaction was rolled back where possible.)
pause
