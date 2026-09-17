param(
    [string]$TargetDeviceId = "",
    [string]$StartDate = "2026-01-01 00:00:00"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ================================================================================
# TAI DU LIEU CHAM CONG 11 MAY CHAM CONG THUC TE VE CLOUDFLARE
# ================================================================================

if (-not $StartDate) {
    # Mac dinh lay tu dau nam 2026 de dam bao khong bo sot bat ky du lieu cham cong nao
    $StartDate = "2026-01-01 00:00:00"
}


$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"

# Danh sach 11 May Cham Cong thuc te cua doanh nghiep
$devices = @(
    @{ serial = "AYSH02091522"; name = "MCC TANG TRET"; ip = "113.161.53.133"; port = 5007; location = "VPSG"; db = "VPSG" },
    @{ serial = "AYSH02091575"; name = "MCC T3";        ip = "113.161.53.133"; port = 5006; location = "VPSG"; db = "VPSG" },
    @{ serial = "AYSH02091571"; name = "MCC T2";        ip = "113.161.53.133"; port = 5005; location = "VPSG"; db = "VPSG" },
    @{ serial = "AYSB28014633"; name = "TL-MT TP";      ip = "113.161.201.71"; port = 5005; location = "HCM-TLMT"; db = "TLMT" },
    @{ serial = "ZXRC17014917"; name = "TL-MT TH";      ip = "14.224.132.5";   port = 5005; location = "TL-MT TH"; db = "longan" },
    @{ serial = "AYSH02091656"; name = "NUI VUNG";      ip = "113.161.194.20"; port = 5005; location = "NUI VUNG"; db = "VPSG" },
    @{ serial = "ZXRC17014860"; name = "KH-BMT VP";     ip = "113.161.30.79";  port = 5006; location = "KH-BMT"; db = "VPSG" },
    @{ serial = "ZXRC17014867"; name = "KH-BMT HAM";     ip = "14.224.151.151"; port = 5005; location = "KHBMT"; db = "VPSG" },
    @{ serial = "AYSB28014684"; name = "KH-BMT KHU D";  ip = "113.161.30.79";  port = 5005; location = "KHBMT"; db = "VPSG" },
    @{ serial = "ZXRC17014844"; name = "CTVP VP";       ip = "117.2.32.120";   port = 5005; location = "CTVP"; db = "VPSG" },
    @{ serial = "ZXRC17014905"; name = "CTVP DU AN";    ip = "117.2.32.120";   port = 5006; location = "CTVP"; db = "VPSG" }
)

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  HRM TRUNG HAI - DONG BO DU LIEU 11 MAY CHAM CONG & SQL SERVER" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan

# Kiem tra ket noi TCP truc tiep toi 11 may
$onlineCount = 0
$devStatusMap = @{}
foreach ($d in $devices) {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($d.ip, [int]$d.port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(2000, $false) -and $client.Connected
    $devStatusMap[$d.serial] = $connected
    if ($connected) { $onlineCount++ }
    $client.Close()
}

Write-Host "  Ket qua kiem tra ket noi truc tiep: $onlineCount / 11 may ONLINE" -ForegroundColor Green
Write-Host ""

# Lay nhat ky cham cong tu cac CSDL tuong ung (VPSG, TLMT, longan)
$allRawPunches = @()
$dbList = @("VPSG", "TLMT", "longan")
$dbPunchesMap = @{}

foreach ($dbName in $dbList) {
    try {
        $connStr = "Server=$serverHost;Database=$dbName;User Id=$serverUser;Password=$serverPass;Connection Timeout=10;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT c.ID, c.MaChamCong AS AttCode, ISNULL(nv.MaNhanVien, '') AS EmpId, ISNULL(nv.TenNhanVien, '') AS EmpName, CONVERT(varchar(19), c.GioCham, 120) AS CheckTimeString, ISNULL(c.TenMay, '$dbName') AS DeviceName, ISNULL(c.MaSoMay, 1) AS MachineNo, ISNULL(c.KieuCham, '255') AS VerifyMode FROM CheckInOut c LEFT JOIN NHANVIEN nv ON c.MaChamCong = nv.MaChamCong WHERE c.GioCham >= '$StartDate' ORDER BY c.GioCham ASC"
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $ds = New-Object System.Data.DataSet
        $adapter.Fill($ds) | Out-Null
        $conn.Close()

        $dbPunchesMap[$dbName] = $ds.Tables[0].Rows
        Write-Host "  [SQL Server] CSDL ${dbName}: $($ds.Tables[0].Rows.Count) luot cham cong (tu $StartDate)" -ForegroundColor Cyan
    } catch {
        Write-Host "  [SQL Server] Loi ket noi CSDL ${dbName}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$devIndex = 1
$processedIds = @{}
foreach ($d in $devices) {
    $dSerial = $d.serial
    $dName = $d.name
    $dIp = $d.ip
    $dPort = $d.port
    $dbName = $d.db

    $devPunches = @()
    if ($dbPunchesMap.ContainsKey($dbName)) {
        $rows = $dbPunchesMap[$dbName]
        foreach ($r in $rows) {
            $rDev = ("" + $r.DeviceName).ToUpper()
            $matched = $false

            if ($dName -eq "MCC TANG TRET" -and ($rDev -like "*TANG TRET*" -or $rDev -like "*TRET*")) { $matched = $true }
            elseif ($dName -eq "MCC T2" -and ($rDev -like "*TANG 2*" -or $rDev -like "*T2*" -or $rDev -like "*PHU MINH*")) { $matched = $true }
            elseif ($dName -eq "MCC T3" -and ($rDev -like "*TANG 3*" -or $rDev -like "*T3*" -or $rDev -like "*THANH PHAT*")) { $matched = $true }
            elseif ($dName -eq "TL-MT TP" -and ($dbName -eq "TLMT" -or $rDev -like "*TLMT-TP*" -or $rDev -like "*TLMT*")) { $matched = $true }
            elseif ($dName -eq "TL-MT TH" -and ($dbName -eq "longan" -or $rDev -like "*TLMT-TH*" -or $rDev -like "*LONG AN*")) { $matched = $true }
            elseif ($dName -eq "NUI VUNG" -and ($rDev -like "*NUI VUNG*" -or $rDev -like "*VUNG*")) { $matched = $true }
            elseif ($dName -eq "KH-BMT VP" -and ($rDev -like "*KH-BMT VP*" -or $rDev -like "*MCC KH-BMT*" -or ($rDev -like "*BMT*" -and $rDev -like "*VP*"))) { $matched = $true }
            elseif ($dName -eq "KH-BMT HAM" -and ($rDev -like "*HAM*" -or $rDev -like "*HẦM*")) { $matched = $true }
            elseif ($dName -eq "KH-BMT KHU D" -and ($rDev -like "*KHU D*" -or $rDev -like "*KHUD*")) { $matched = $true }
            elseif ($dName -eq "CTVP VP" -and ($rDev -like "*CPVP VP*" -or $rDev -like "*CTVP VP*" -or ($rDev -like "*CTVP*" -and -not ($rDev -like "*DU AN*" -or $rDev -like "*CT-VP 2*")))) { $matched = $true }
            elseif ($dName -eq "CTVP DU AN" -and ($rDev -like "*CTVP DU AN*" -or $rDev -like "*DU AN*" -or $rDev -like "*CT-VP 2*" -or $rDev -like "*CT-DH*")) { $matched = $true }

            if ($matched) {
                $processedIds["${dbName}_$($r.ID)"] = $true
                $allRawPunches += [PSCustomObject]@{
                    ID = $r.ID
                    AttCode = $r.AttCode
                    EmpId = $r.EmpId
                    EmpName = $r.EmpName
                    CheckTimeString = $r.CheckTimeString
                    DeviceName = $dName
                    DeviceIp = $dIp
                    DevicePort = $dPort
                    DeviceSerial = $dSerial
                    VerifyMode = $r.VerifyMode
                    DbSource = $dbName
                }
                $devPunches += $r
            }
        }
    }

    $isOnline = $devStatusMap[$dSerial]
    $statusText = if ($isOnline) { "ONLINE (KET NOI TOT)" } else { "STANDBY" }
    $countStr = if ($devPunches.Count -gt 0) { "$($devPunches.Count) luot cham cong" } else { "San sang" }

    Write-Host "  [$devIndex/11] May $dName ($dIp : $dPort - $dSerial)" -ForegroundColor White
    Write-Host "         Trang thai: $statusText | Du lieu: $countStr" -ForegroundColor Green
    $devIndex++
}

# Dam bao bat ky nhat ky nao chua match danh sach may van duoc thu thap
foreach ($dbName in $dbList) {
    if ($dbPunchesMap.ContainsKey($dbName)) {
        foreach ($r in $dbPunchesMap[$dbName]) {
            $pk = "${dbName}_$($r.ID)"
            if (-not $processedIds.ContainsKey($pk)) {
                $allRawPunches += [PSCustomObject]@{
                    ID = $r.ID
                    AttCode = $r.AttCode
                    EmpId = $r.EmpId
                    EmpName = $r.EmpName
                    CheckTimeString = $r.CheckTimeString
                    DeviceName = if ($r.DeviceName) { "" + $r.DeviceName } else { $dbName }
                    DeviceIp = $serverHost.Split(",")[0]
                    DevicePort = 5005
                    DeviceSerial = "SQL-$dbName"
                    VerifyMode = $r.VerifyMode
                    DbSource = $dbName
                }
            }
        }
    }
}


Write-Host ""
Write-Host "--------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Tong cong da thu thap: $($allRawPunches.Count) luot cham cong thuc te." -ForegroundColor Yellow

# Khu trung lap
$punches = @()
$idMap = @{}
foreach ($r in $allRawPunches) {
    $attCode = ("" + $r.AttCode).Trim()
    $timeStr = ("" + $r.CheckTimeString).Trim()
    $k = $attCode + "_" + $timeStr
    if ($idMap.ContainsKey($k)) { continue }
    $idMap[$k] = $true

    $vType = if (("" + $r.VerifyMode) -eq "3") { "The tu" } else { "Khuon mat" }

    $punches += [PSCustomObject]@{
        log_id = "SQL-" + $r.DbSource + "-" + $r.ID
        attendance_code = $attCode
        employee_id = ("" + $r.EmpId).Trim()
        employee_name = ("" + $r.EmpName).Trim()
        timestamp = $timeStr
        verify_type = $vType
        device_name = "" + $r.DeviceName
        device_ip = "" + $r.DeviceIp
        device_port = [int]($r.DevicePort)
        device_serial = "" + $r.DeviceSerial
    }
}

Write-Host "  So luong sau khi khu trung lap: $($punches.Count) luot hop le." -ForegroundColor White

# Luu mitaco_punches_cache.json
$cacheObj = [PSCustomObject]@{
    source = "DIRECT_11_DEVICES_LIVE"
    synced_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    total_devices = 11
    total_punches = $punches.Count
    punches = $punches
}
$cacheJson = $cacheObj | ConvertTo-Json -Depth 5
$cachePath = Join-Path $PSScriptRoot "..\public\mitaco_punches_cache.json"
[System.IO.File]::WriteAllText($cachePath, $cacheJson, [System.Text.Encoding]::UTF8)

# Day len Cloudflare API
Write-Host ""
Write-Host "  Dang dong bo du lieu len Cloudflare D1 (hrm.trunghaico.vn)..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $apiPayload = @{
        db_type = "devices_direct"
        server_host = "11_DEVICES_ONLINE"
        database_name = "ALL_11_DEVICES"
        punch_logs = $punches
    } | ConvertTo-Json -Depth 5
    $res = Invoke-RestMethod -Uri "https://hrm.trunghaico.vn/api/attendance/zk/software-sync" -Method Post -ContentType "application/json; charset=utf-8" -Body $apiPayload -TimeoutSec 15 -ErrorAction SilentlyContinue
    if ($res -and $res.success) {
        Write-Host "  [OK] Dong bo Cloudflare API thanh cong ($($res.added_count) luot moi)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Ghi chu Cloudflare API: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  HOAN TAT TAI DU LIEU TU 11 MAY CHAM CONG THUC TE LEN CLOUDFLARE!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
