@echo off
chcp 65001 >nul
title Dong Bo HRM Synology NAS -> Cloudflare Web
echo ========================================================
echo   TIEN TRINH DONG BO DU LIEU: SYNOLOGY NAS -^> WEB
echo ========================================================
echo.
echo Kiem tra cau hinh scripts/synology_config.json...
node scripts/sync_synology_cloud.js --push
echo.
pause

