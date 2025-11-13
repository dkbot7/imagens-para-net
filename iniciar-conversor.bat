@echo off
title Conversor de Imagens AVIF - Iniciando...
color 0A

echo.
echo ========================================
echo   CONVERSOR DE IMAGENS PARA AVIF
echo ========================================
echo.
echo Iniciando servidor...
echo.

cd /d "%~dp0"
start "" "http://localhost:8765"
node server.js

pause
