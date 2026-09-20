@echo off
cd /d "%~dp0"
echo Compilando DashCom 0.1.5...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\build-desktop-installer.ps1" > "desktop-build\build-0.1.5.log" 2>&1
echo EXITCODE=%ERRORLEVEL%>> "desktop-build\build-0.1.5.log"
echo Listo. Revisa desktop-build\build-0.1.5.log
