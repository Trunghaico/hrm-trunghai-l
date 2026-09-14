@echo off
chcp 65001 >nul
title TAI DU LIEU 11 MAY CHAM CONG THUC TE - HRM TRUNG HAI
echo ====================================================================
echo  HRM TRUNG HAI - TAI DU LIEU QUET THE 11 MAY CHAM CONG VE CLOUDFLARE
echo ====================================================================
echo  Dang ket noi va lay du lieu cham cong tu 11 may cham cong thuc te...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\sync_devices.ps1"

echo.
echo  Dang dong bo du lieu len GitHub va Cloudflare Pages...
git add public/mitaco_punches_cache.json
git commit -m "sync(attendance): cap nhat du lieu quet the tu 11 may cham cong thuc te"
git push origin main

echo.
echo ====================================================================
echo  HOAN TAT TAI DU LIEU VA DONG BO LEN CLOUDFLARE THANH CONG!
echo  Hay mo Website hoac App HRM va bam "Dong bo Cloud" de xem ket qua.
echo ====================================================================
pause
