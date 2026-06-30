@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo  HYL Gym Direccion Comercial
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

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

echo Abriendo http://localhost:4310 ...
start "" cmd /c "timeout /t 4 >nul && start http://localhost:4310"
npm run dev

pause
