@echo off
chcp 65001 >nul
echo Dang go bo Task: TrungHai_Synology_Cloud_Sync...
schtasks /delete /tn "TrungHai_Synology_Cloud_Sync" /f
echo Da go bo thanh cong!
pause

