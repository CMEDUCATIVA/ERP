@echo off
start "CMPROYECTOSBIM - Backend" powershell -NoExit -Command "cd 'D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\backend'; Write-Host 'Backend: http://127.0.0.1:8000'; openconstructionerp serve --port 8000"
powershell -Command "Start-Sleep -Seconds 60"
start "CMPROYECTOSBIM - Frontend" powershell -NoExit -Command "cd 'D:\1-NUBE\ALMACENAMIENTO CENTRAL\CM\1-3-CMPROYECTOS\2-INSTALACIÓN-CMPROYECTOS-ERP\ERP-main\ERP-DEEP\frontend'; Write-Host 'Frontend: http://127.0.0.1:5173'; npm.cmd run dev"
exit
