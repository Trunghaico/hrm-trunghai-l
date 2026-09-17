@echo off
chcp 65001 >nul
title DONG BO DU LIEU SQL SERVER & 11 MAY CHAM CONG - HRM TRUNG HAI

echo ====================================================================
echo  HRM TRUNG HAI - DONG BO DU LIEU SQL SERVER & 11 MAY CHAM CONG
echo ====================================================================
echo  Dang ket noi va lay du lieu cham cong tu SQL Server (VPSG, TLMT, longan)...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\sync_devices.ps1"

echo.
echo  Dang cap nhat du lieu len GitHub va Cloudflare Pages...
git add public/mitaco_punches_cache.json scripts/
git commit -m "sync(attendance): cap nhat du lieu quet the tu SQL Server (VPSG, TLMT, longan) & 11 may cham cong"
git push origin main

echo.
echo ====================================================================
echo  HOAN TAT DONG BO DU LIEU LEN CLOUDFLARE VA GITHUB THANH CONG!
echo  Hay mo Website hoac App HRM va bam "Dong bo Cloud" de xem ket qua.
echo ====================================================================
pause

