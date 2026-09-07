@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo  DashCom - Dashboard Comercial
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

set "NODE_OPTIONS=--use-system-ca"
set "APP_PORT=4310"

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="PORT" set "APP_PORT=%%B"
  )
)

set "APP_URL=http://localhost:%APP_PORT%"

if not exist "node_modules" (
  echo Instalando dependencias...
  npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

if not exist "data\hyl_gym.db" (
  echo Creando base de datos inicial...
  npm run seed
)

echo Abriendo %APP_URL% ...
start "" cmd /c "timeout /t 4 >nul && start %APP_URL%"
npm run dev

pause
