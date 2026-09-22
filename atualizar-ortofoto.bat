@echo off
cd /d "%~dp0"
node scripts\atualizar-ortofoto.js %*
echo.
pause
