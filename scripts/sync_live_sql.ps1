param(
    [string]$TargetDatabase = ""
)

$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"

$databases = if ($TargetDatabase) { @($TargetDatabase) } else { @("Mitaco", "Tlmt", "longan") }

$allRawPunches = @()
$allDevices = @()
$devMap = @{}

foreach ($dbName in $databases) {
    try {
        $connStr = "Server=$serverHost;Database=$dbName;User Id=$serverUser;Password=$serverPass;Connection Timeout=10;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # 1. Query Devices
        try {
            $cmdDev = $conn.CreateCommand()
            $cmdDev.CommandText = "SELECT MaMCC, TenMCC, DiaChiIP, Port, Serial, TrangThai FROM MAYCHAMCONG"
            $adDev = New-Object System.Data.SqlClient.SqlDataAdapter($cmdDev)
            $dsDev = New-Object System.Data.DataSet
            $adDev.Fill($dsDev) | Out-Null
            foreach ($devRow in $dsDev.Tables[0].Rows) {
                $mCode = "$($devRow.MaMCC)".Trim()
                $mName = "$($devRow.TenMCC)".Trim()
                $mIp = "$($devRow.DiaChiIP)".Trim()
                if (-not $mIp) { $mIp = "113.161.53.133" }
                $mPort = [int]($devRow.Port)
                $mSerial = "$($devRow.Serial)".Trim()
                $kDev = "${mName}_${mPort}"
                if (-not $devMap.ContainsKey($kDev)) {
                    $devMap[$kDev] = $true
                    $allDevices += [PSCustomObject]@{
                        device_id = if ($mCode) { $mCode } else { "DEV-" + ($allDevices.Count + 1) }
                        device_name = if ($mName -like "*MCC00001*") { "Máy MCC00001 (TP)" } elseif ($mName) { $mName } else { "Máy Chấm Công" }
                        name = if ($mName) { $mName } else { "Máy Chấm Công" }
                        ip = $mIp
                        port = if ($mPort -gt 0) { $mPort } else { 5005 }
                        comm_key = 0
                        location = if ($mName -like "*TLMT*" -or $mName -like "*MCC00001*") { "Chi Nhánh TLMT / TP.HCM" } elseif ($mName -like "*TANG TRET*") { "Tầng Trệt Xưởng" } elseif ($mName -like "*PHU MINH*") { "Phú Minh Lầu 2" } elseif ($mName -like "*THANH PHAT*") { "Thanh Phát Lầu 3" } elseif ($mName -like "*TH*") { "Chi Nhánh Long An" } else { "Văn Phòng / Xưởng" }
                        serial_number = $mSerial
                        database_source = $dbName
                        enabled = $true
                        status = "ONLINE"
                        last_sync = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
                        note = "May cham cong $mName (${mIp}:${mPort})"
                    }
                }
            }
        } catch {
            Write-Host "Warning: Could not query MAYCHAMCONG from $dbName : $($_.Exception.Message)"
        }

        # 2. Query Punches
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

        $rows = $ds.Tables[0].Rows
        Write-Host "Punches pulled from live SQL Server ($dbName): $($rows.Count)"

        foreach ($r in $rows) {
            $allRawPunches += [PSCustomObject]@{
                ID = $r.ID
                AttCode = $r.AttCode
                EmpId = $r.EmpId
                EmpName = $r.EmpName
                CheckTimeString = $r.CheckTimeString
                DeviceName = $r.DeviceName
                VerifyMode = $r.VerifyMode
                DbSource = $dbName
            }
        }
    } catch {
        Write-Host "Error connecting to database $dbName : $($_.Exception.Message)"
    }
}

Write-Host "Total raw punches combined: $($allRawPunches.Count)"

# Deduplicate punches
$punches = @()
$idMap = @{}
foreach ($r in $allRawPunches) {
    $attCode = "$($r.AttCode)".Trim()
    $timeStr = "$($r.CheckTimeString)".Trim()
    $k = "${attCode}_${timeStr}"
    if ($idMap.ContainsKey($k)) { continue }
    $idMap[$k] = $true

    $vMode = "$($r.VerifyMode)"
    $vType = "Khuon mat"
    if ($vMode -eq "2") { $vType = "Khuon mat" }
    elseif ($vMode -eq "3") { $vType = "The tu" }

    $dName = "$($r.DeviceName)".Trim()
    $dPort = 5005
    $dIp = "113.161.53.133"
    if ($dName -like "*PHU MINH*") { $dPort = 5005; $dIp = "113.161.53.133"; $dName = "PHÚ MINH L2" }
    elseif ($dName -like "*THANH PHAT*") { $dPort = 5006; $dIp = "113.161.53.133"; $dName = "THANH PHÁT L3" }
    elseif ($dName -like "*TANG TRET*") { $dPort = 5007; $dIp = "113.161.53.133"; $dName = "TẦNG TRỆT" }
    elseif ($dName -like "*TLMT-TP*" -or $dName -like "*MCC00001*") { $dPort = 5005; $dIp = "113.161.201.71"; $dName = "TLMT-TP" }
    elseif ($dName -like "*TLMT-TH*") { $dPort = 5005; $dIp = "14.224.132.5"; $dName = "TLMT-TH" }

    $punches += [PSCustomObject]@{
        log_id = "SQL-$($r.DbSource)-$($r.ID)"
        attendance_code = $attCode
        employee_id = "$($r.EmpId)".Trim()
        employee_name = "$($r.EmpName)".Trim()
        timestamp = $timeStr
        verify_type = $vType
        device_name = $dName
        device_ip = $dIp
        device_port = $dPort
    }
}

Write-Host "Unique punches after deduplication: $($punches.Count)"

# Save mitaco_punches_cache.json
$cacheObj = [PSCustomObject]@{
    source = "LIVE_SQL_SERVER_MULTI_DB"
    synced_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    databases = $databases
    total_punches = $punches.Count
    punches = $punches
}
$cacheJson = $cacheObj | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("$PSScriptRoot\..\public\mitaco_punches_cache.json", $cacheJson, [System.Text.Encoding]::UTF8)
Write-Host "Updated public/mitaco_punches_cache.json successfully."

# Sync to Cloudflare Pages Production API if available
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $apiPayload = @{
        db_type = "sql_server"
        server_host = $serverHost
        database_name = if ($TargetDatabase) { $TargetDatabase } else { "Tlmt,Mitaco,longan" }
        punch_logs = $punches
    } | ConvertTo-Json -Depth 5
    $res = Invoke-RestMethod -Uri "https://trunghaico.vn/api/attendance/zk/software-sync" -Method Post -ContentType "application/json; charset=utf-8" -Body $apiPayload -TimeoutSec 15 -ErrorAction SilentlyContinue
    if ($res -and $res.success) {
        Write-Host "Cloudflare API sync: Success ($($res.added_count) new punches)"
    }
} catch {
    Write-Host "Cloudflare API sync note: $($_.Exception.Message)"
}

Write-Host "Sync completed successfully! Total punches: $($punches.Count), Devices found: $($allDevices.Count)"
