@echo off
powershell -Command "Get-Process | Where-Object { $_.MainWindowTitle -match 'CMPROYECTOSBIM' } | Stop-Process -Force"
exit
