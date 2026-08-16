@echo off
title Smart Folder Organizer - Iniciador
setlocal enabledelayedexpansion

echo ============================================================
echo    SMART FOLDER ORGANIZER
echo    Desarrollado por Christian Freelance
echo ============================================================
echo.

REM ------------------------------------------------------------
REM  Verificar que Node.js este instalado
REM ------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js instalado.
    echo.
    echo Por favor instala Node.js v18 o superior desde:
    echo   https://nodejs.org/
    echo.
    echo Despues de instalar, ejecuta este archivo de nuevo.
    pause
    exit /b 1
)

echo [OK] Node.js detectado:
node -v
echo.

REM ------------------------------------------------------------
REM  Verificar e instalar dependencias en el primer inicio
REM ------------------------------------------------------------
if not exist "node_modules" (
    echo [INFO] Instalando dependencias por primera vez...
    echo        Esto puede tardar unos minutos, por favor espera.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la instalacion de dependencias.
        echo        Revisa tu conexion a internet e intenta de nuevo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas correctamente.
    echo.
) else (
    echo [OK] Dependencias ya instaladas.
    echo.
)

echo [INFO] Iniciando Smart Folder Organizer...
echo.
call npm start

echo.
echo [INFO] La aplicacion se cerro. Gracias por usar Smart Folder Organizer.
echo        Apoyanos en https://christian-freelance.us/
echo.
pause
endlocal