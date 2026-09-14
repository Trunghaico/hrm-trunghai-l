@echo off
chcp 65001 >nul
title DONG BO DU LIEU MAY CHAM CONG RONALD JACK - HRM TRUNG HAI
echo ====================================================================
echo  HRM TRUNG HAI - DONG BO DU LIEU QUET THE TRUC TIEP TU CSDL SQL
echo ====================================================================
echo  Dang ket noi toi CSDL SQL Server 113.161.53.133:1433 (Mitaco, Tlmt, longan, khbmt, ctvp)...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\sync_live_sql.ps1"

echo.
echo  Dang day du lieu cham cong len GitHub va Cloudflare Pages...
git add public/mitaco_punches_cache.json
git commit -m "sync(attendance): cap nhat du lieu quet the moi nhat tu SQL Server"
git push origin main

echo.
echo ====================================================================
echo  HOAN TAT DONG BO DU LIEU VA CAP NHAT HE THONG CLOUDFLARE!
echo  Hay mo lai trang Web HRM va nhan Ctrl + F5 de xem ket qua moi nhat.
echo ====================================================================
pause
