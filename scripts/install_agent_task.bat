@echo off
chcp 65001 >nul
:: ============================================================================
:: TRUNG HAI HRM - INSTALL RONALD JACK BACKGROUND AUTO-SYNC TASK
:: ============================================================================
echo ----------------------------------------------------------------------
echo  CAI DAT TIEN TRINH TU DONG DONG BO MAY CHAM CONG RONALD JACK PRO
echo  Chay ngam moi 5 phut qua Windows Task Scheduler
echo ----------------------------------------------------------------------
echo.

set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%ronald_jack_agent.ps1
set TASK_NAME=TrungHai_RonaldJack_AutoSync

if not exist "%PS_SCRIPT%" (
    echo [LOI] Khong tim thay file %PS_SCRIPT%
    pause
    exit /b 1
)

echo Dang dang ky Task: %TASK_NAME%...
schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%PS_SCRIPT%\"" /sc MINUTE /mo 5 /f /ru SYSTEM

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  [THANH CONG] Da cai dat tien trinh tu dong chay moi 5 phut!
    echo  Task Name: %TASK_NAME%
    echo  Tien trinh se chay ngam hoan toan va khong hien thi cua so popup.
    echo ======================================================================
    echo.
    echo Chay thu nghiem lan dau tien ngay bay gio...
    schtasks /run /tn "%TASK_NAME%"
) else (
    echo.
    echo [LUU Y] Neu gap loi quyen han, vui long click chuot phai vao file nay
    echo va chon "Run as administrator" (Chay voi quyen Quan tri vien).
)

echo.
pause
