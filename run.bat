@echo off
echo Starting Digital Event Feedback Analyzer...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo 1. Opening frontend in browser...
start "" "index.html"

echo 2. Starting backend server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && node server.js"

echo.
echo Application is running!
echo - Frontend should open in your default browser
pause
