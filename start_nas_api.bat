@echo off
chcp 65001 >nul
title HRM Synology NAS API Gateway
echo ========================================================
echo   KHOI DONG HRM SYNOLOGY NAS API GATEWAY
echo ========================================================
echo.
echo Kiem tra cau hinh trong scripts/synology_config.json...
node nas_api_server.js
pause

