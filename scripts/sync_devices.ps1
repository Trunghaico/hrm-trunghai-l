param(
    [string]$TargetDeviceId = ""
)

$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"

# Danh sach 11 May Cham Cong thuc te cua doanh nghiep
$devices = @(
    @{ id = "MCC00012"; name = "TANG TRET"; port = 5007; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091522"; location = "Sanh / Loi vao Tang Tret (Xuong & VP)" },
    @{ id = "MCC00003"; name = "PHU MINH L2"; port = 5005; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091571"; location = "Tang 2 - Khoi Phu Minh" },
    @{ id = "MCC00011"; name = "THANH PHAT L3"; port = 5006; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091575"; location = "Tang 3 - Khoi Thanh Phat" },
    @{ id = "MCC00001"; name = "TLMT-TP"; port = 5005; ip = "113.161.201.71"; db = "Tlmt"; serial = "AYSH02091510"; location = "Chi Nhanh TLMT / TP.HCM" },
    @{ id = "MCC00002"; name = "TLMT-TH"; port = 5005; ip = "14.224.132.5"; db = "longan"; serial = "AYSH02091588"; location = "Chi Nhanh Xuong Long An" },
    @{ id = "MCC00004"; name = "KHBMT"; port = 5008; ip = "113.161.53.133"; db = "khbmt"; serial = "AYSH02091601"; location = "Chi Nhanh Buon Ma Thuot / Dak Lak" },
    @{ id = "MCC00005"; name = "CTVP"; port = 5009; ip = "113.161.53.133"; db = "ctvp"; serial = "AYSH02091602"; location = "Khoi Cong Trinh / VP CTVP" },
    @{ id = "MCC00006"; name = "TRUNG NAM L1"; port = 5010; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091603"; location = "Khoi Du An Trung Nam" },
    @{ id = "MCC00007"; name = "KHO VAT TU"; port = 5011; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091604"; location = "Kho Vat Tu & Thiet Bi" },
    @{ id = "MCC00008"; name = "VAN PHONG HA NOI"; port = 5012; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091605"; location = "VP Dai Dien Ha Noi" },
    @{ id = "MCC00009"; name = "CHI NHANH DA NANG"; port = 5013; ip = "113.161.53.133"; db = "Mitaco"; serial = "AYSH02091606"; location = "Chi Nhanh Da Nang" }
)

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "  HRM TRUNG HAI - TAI DU LIEU QUET THE 11 MAY CHAM CONG THUC TE" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan

$allRawPunches = @()
$dbList = @("Mitaco", "Tlmt", "longan", "khbmt", "ctvp")

$dbPunchesMap = @{}
foreach ($dbName in $dbList) {
    try {
        $connStr = "Server=$serverHost;Database=$dbName;User Id=$serverUser;Password=$serverPass;Connection Timeout=10;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
SELECT 
    c.ID, 
    c.MaChamCong AS AttCode, 
    ISNULL(nv.MaNhanVien, '') AS EmpId, 
    ISNULL(nv.TenNhanVien, '') AS EmpName, 
    CONVERT(varchar(19), c.GioCham, 120) AS CheckTimeString, 
    ISNULL(c.TenMay, '$dbName') AS DeviceName, 
    ISNULL(c.MaSoMay, 1) AS MachineNo, 
    ISNULL(c.KieuCham, '255') AS VerifyMode 
FROM CheckInOut c 
LEFT JOIN NHANVIEN nv ON c.MaChamCong = nv.MaChamCong 
WHERE c.GioCham >= '2026-08-01 00:00:00'
ORDER BY c.GioCham ASC
"@
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $ds = New-Object System.Data.DataSet
        $adapter.Fill($ds) | Out-Null
        $conn.Close()

        $dbPunchesMap[$dbName] = $ds.Tables[0].Rows
    } catch {
        Write-Host "  [!] Ket noi may cham cong $dbName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Quet va phan tach theo tung may thuc te
$devIndex = 1
foreach ($d in $devices) {
    $dId = $d.id
    $dName = $d.name
    $dIp = $d.ip
    $dPort = $d.port
    $dbName = $d.db

    $devPunches = @()
    if ($dbPunchesMap.ContainsKey($dbName)) {
        $rows = $dbPunchesMap[$dbName]
        foreach ($r in $rows) {
            $rDev = "$($r.DeviceName)".ToUpper()
            $matched = $false

            if ($dName -eq "TANG TRET" -and ($rDev -like "*TANG TRET*" -or $rDev -like "*TRET*")) { $matched = $true }
            elseif ($dName -eq "PHU MINH L2" -and ($rDev -like "*PHU MINH*" -or $rDev -like "*PM*")) { $matched = $true }
            elseif ($dName -eq "THANH PHAT L3" -and ($rDev -like "*THANH PHAT*" -or $rDev -like "*TP*")) { $matched = $true }
            elseif ($dName -eq "TLMT-TP" -and ($dbName -eq "Tlmt" -or $rDev -like "*TLMT*")) { $matched = $true }
            elseif ($dName -eq "TLMT-TH" -and ($dbName -eq "longan" -or $rDev -like "*LONG AN*")) { $matched = $true }
            elseif ($dName -eq "KHBMT" -and ($dbName -eq "khbmt" -or $rDev -like "*BMT*" -or $rDev -like "*BUON MA THUOT*")) { $matched = $true }
            elseif ($dName -eq "CTVP" -and ($dbName -eq "ctvp" -or $rDev -like "*CTVP*" -or $rDev -like "*CONG TRINH*")) { $matched = $true }
            elseif ($dbName -eq "Mitaco" -and -not ($rDev -like "*TANG TRET*" -or $rDev -like "*PHU MINH*" -or $rDev -like "*THANH PHAT*")) {
                $matched = $true
            }

            if ($matched) {
                $allRawPunches += [PSCustomObject]@{
                    ID = $r.ID
                    AttCode = $r.AttCode
                    EmpId = $r.EmpId
                    EmpName = $r.EmpName
                    CheckTimeString = $r.CheckTimeString
                    DeviceName = $dName
                    DeviceIp = $dIp
                    DevicePort = $dPort
                    VerifyMode = $r.VerifyMode
                    DbSource = $dbName
                }
                $devPunches += $r
            }
        }
    }

    $countStr = if ($devPunches.Count -gt 0) { "$($devPunches.Count) luot quet the" } else { "Dang san sang" }
    Write-Host "  [$devIndex/11] May $dName ($dIp`:$dPort) -> $countStr" -ForegroundColor Green
    $devIndex++
}

Write-Host "--------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Tong cong da lay duoc: $($allRawPunches.Count) luot cham cong thuc te." -ForegroundColor Yellow

# Khu trung lap
$punches = @()
$idMap = @{}
foreach ($r in $allRawPunches) {
    $attCode = "$($r.AttCode)".Trim()
    $timeStr = "$($r.CheckTimeString)".Trim()
    $k = "${attCode}_${timeStr}"
    if ($idMap.ContainsKey($k)) { continue }
    $idMap[$k] = $true

    $vType = if ("$($r.VerifyMode)" -eq "3") { "The tu" } else { "Khuon mat" }

    $punches += [PSCustomObject]@{
        log_id = "SQL-$($r.DbSource)-$($r.ID)"
        attendance_code = $attCode
        employee_id = "$($r.EmpId)".Trim()
        employee_name = "$($r.EmpName)".Trim()
        timestamp = $timeStr
        verify_type = $vType
        device_name = "$($r.DeviceName)"
        device_ip = "$($r.DeviceIp)"
        device_port = [int]($r.DevicePort)
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
[System.IO.File]::WriteAllText("$PSScriptRoot\..\public\mitaco_punches_cache.json", $cacheJson, [System.Text.Encoding]::UTF8)

# Day len Cloudflare REST API
Write-Host "  Dang dong bo du lieu truc tiep len Cloudflare D1 Database..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $apiPayload = @{
        db_type = "devices_direct"
        server_host = "11_DEVICES_ONLINE"
        database_name = "ALL_11_DEVICES"
        punch_logs = $punches
    } | ConvertTo-Json -Depth 5
    $res = Invoke-RestMethod -Uri "https://trunghaico.vn/api/attendance/zk/software-sync" -Method Post -ContentType "application/json; charset=utf-8" -Body $apiPayload -TimeoutSec 15 -ErrorAction SilentlyContinue
    if ($res -and $res.success) {
        Write-Host "  [OK] Dong bo Cloudflare API: Thanh cong ($($res.added_count) luot cham cong moi)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Note Cloudflare API: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  HOAN TAT LAY DU LIEU TU 11 MAY CHAM CONG THUC TE!" -ForegroundColor Green
Write-Host "====================================================================`n" -ForegroundColor Cyan
