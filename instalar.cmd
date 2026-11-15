@echo off
rem Instala o actualiza Studies4Kids en este equipo. Haz doble clic y acepta el aviso de administrador.
rem Para usar otro puerto, abre una terminal aqui y ejecuta:  instalar.cmd -Puerto 8080
setlocal
set "SCRIPT=%~dp0scripts\instalar-windows.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT%\" %*'"
endlocal
