@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
 echo Python 3 installation required. https://www.python.org/downloads/
 pause
 exit /b 1
)
echo Tiny Worlds admin server
set /p TW_ADMIN_PASSWORD=Enter administrator password: 
if "%TW_ADMIN_PASSWORD%"=="" (
 echo Password is required.
 pause
 exit /b 1
)
python server.py
pause
