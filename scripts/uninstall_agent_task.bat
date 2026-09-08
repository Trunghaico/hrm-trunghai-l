@echo off
chcp 65001 >nul
:: ============================================================================
:: TRUNG HAI HRM - UNINSTALL RONALD JACK AUTO-SYNC TASK
:: ============================================================================
echo Dang go bo tien trinh TrungHai_RonaldJack_AutoSync...
schtasks /delete /tn "TrungHai_RonaldJack_AutoSync" /f
if %ERRORLEVEL% equ 0 (
    echo [THANH CONG] Da huy bo tien trinh dong bo tu dong!
) else (
    echo [THONG BAO] Khong tim thay task hoac can chay voi quyen Administrator.
)
pause
