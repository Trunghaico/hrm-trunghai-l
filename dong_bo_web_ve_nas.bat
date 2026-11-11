@echo off
chcp 65001 >nul
title Keo Du Lieu HRM: Web Cloudflare -> Synology NAS
echo ========================================================
echo   TIEN TRINH KEO DU LIEU: WEB CLOUDFLARE -^> SYNOLOGY NAS
echo ========================================================
echo.
echo Kiem tra cau hinh scripts/synology_config.json...
node scripts/sync_synology_cloud.js --pull
echo.
pause

