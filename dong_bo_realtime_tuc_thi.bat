@echo off
chcp 65001 >nul
title HRM Realtime Sync: Web -> Synology NAS
echo ========================================================
echo   TIEN TRINH DONG BO REALTIME TUC THI (DUOI 2 GIAY)
echo   Web Cloudflare -^> Synology NAS MariaDB
echo ========================================================
echo.
echo Tien trinh se chay ngam lien tuc.
echo NGAY KHI ban Them, Sua hoac Xoa du lieu tren Web,
echo NAS se tu dong cap nhat LIEN sau 1 - 2 giay!
echo.
echo [De cua so nay mo hoac thu nho xuong Taskbar de dong bo lien tuc]
echo.
node scripts/sync_synology_cloud.js --realtime
pause
