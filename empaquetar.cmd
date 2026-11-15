@echo off
rem Crea compartir\Studies4Kids.zip para pasar la app a otra familia, sin vuestros datos.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\empaquetar.ps1"
pause
