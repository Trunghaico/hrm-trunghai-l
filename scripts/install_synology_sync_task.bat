@echo off
chcp 65001 >nul
:: ============================================================================
:: TRUNG HAI HRM - INSTALL SYNOLOGY NAS AUTO-SYNC BACKGROUND TASK
:: ============================================================================
echo ----------------------------------------------------------------------
echo  CAI DAT TIEN TRINH TU DONG DONG BO CLOUDFLARE ^<--^> SYNOLOGY NAS
echo  Chay ngam moi 5 phut qua Windows Task Scheduler
echo ----------------------------------------------------------------------
echo.

set SCRIPT_DIR=%~dp0
set NODE_SCRIPT=%SCRIPT_DIR%sync_synology_cloud.js
set TASK_NAME=TrungHai_Synology_Cloud_Sync

if not exist "%NODE_SCRIPT%" (
    echo [LOI] Khong tim thay file %NODE_SCRIPT%
    pause
    exit /b 1
)

echo Dang dang ky Task: %TASK_NAME%...
schtasks /create /tn "%TASK_NAME%" /tr "node.exe \"%NODE_SCRIPT%\"" /sc MINUTE /mo 5 /f

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  [THANH CONG] Da cai dat tien trinh tu dong dong bo chay moi 5 phut!
    echo  Task Name: %TASK_NAME%
    echo  Tien trinh se tu dong cap nhat CSDL tren Synology NAS va xuat Excel.
    echo ======================================================================
    echo.
    echo Chay thu nghiem ngay bay gio...
    schtasks /run /tn "%TASK_NAME%"
) else (
    echo.
    echo [LUU Y] Neu gap loi quyen han, vui long click chuot phai vao file nay
    echo va chon "Run as administrator" (Chay voi quyen Quan tri vien).
)

echo.
pause

