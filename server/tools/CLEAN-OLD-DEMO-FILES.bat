@echo off
setlocal
cd /d "%~dp0..\.."
if not exist "server\app.js" (
 echo Run this file from the JoyJourney project root only.
 pause
 exit /b 1
)
echo Removing known files from previous local DEMO ZIP releases...
for %%f in ("server\seed-demo.js" "server\demo-data.js" "server\demo-photos.js" "public\photo-credits.html" "PHOTO-CREDITS.md" "START-DEMO.bat" "START-DEMO.sh" "START-HERE-TH.txt" "CHANGELOG-v9-TH.md" "tests\demo-data.test.js" "tests\demo-photos.test.js") do (
 if exist %%f del /f /q %%f
)
if exist "server\demo-assets" rmdir /s /q "server\demo-assets"
if exist "public\assets\demo-covers" rmdir /s /q "public\assets\demo-covers"
if exist "uploads\memories\jj_demo_*.jpg" del /f /q "uploads\memories\jj_demo_*.jpg"
echo Finished. Existing MySQL database data was not touched.
echo Keep your .git and server\.env files. Check git status before committing.
pause
