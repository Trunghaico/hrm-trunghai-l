@echo off
chcp 65001 >nul
title DONG BO DU LIEU MAY CHAM CONG RONALD JACK - HRM TRUNG HAI
echo ====================================================================
echo  HRM TRUNG HAI - DONG BO DU LIEU QUET THE TRUC TIEP TU CSDL SQL
echo ====================================================================
echo  Dang ket noi toi CSDL SQL Server 113.161.53.133:1433 (mitaco)...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\sync_live_sql.ps1"

echo.
echo ====================================================================
echo  HOAN TAT DONG BO DU LIEU TRUC TIEP TU SQL SERVER!
echo  Hay mo lai trang Web HRM va nhan Ctrl + F5 de xem ket qua moi nhat.
echo ====================================================================
pause
