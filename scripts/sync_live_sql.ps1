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
                $mIp = "113.161.53.133"
                $mPort = [int]($devRow.Port)
                $mSerial = "$($devRow.Serial)".Trim()
                $kDev = "${mName}_${mPort}"
                if (-not $devMap.ContainsKey($kDev)) {
                    $devMap[$kDev] = $true
                    $allDevices += [PSCustomObject]@{
                        device_id = if ($mCode) { $mCode } else { "DEV-" + ($allDevices.Count + 1) }
                        device_name = if ($mName -like "*MCC00001*") { "Máy MCC00001 (TP)" } elseif ($mName) { $mName } else { "Máy Chấm Công" }
                        name = if ($mName) { $mName } else { "Máy Chấm Công" }
                        ip = "113.161.53.133"
                        port = if ($mPort -gt 0) { $mPort } else { 5005 }
                        comm_key = 0
                        location = if ($mName -like "*TLMT*") { "Chi Nhánh TLMT / TP.HCM" } elseif ($mName -like "*TANG TRET*") { "Tầng Trệt Xưởng" } elseif ($mName -like "*PHU MINH*") { "Phú Minh Lầu 2" } elseif ($mName -like "*THANH PHAT*") { "Thanh Phát Lầu 3" } else { "Văn Phòng / Xưởng" }
                        serial_number = $mSerial
                        database_source = $dbName
                        enabled = $true
                        status = "ONLINE"
                        last_sync = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
                        note = "Máy chấm công $mName (113.161.53.133:$mPort)"
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
    if ($dName -like "*PHU MINH*") { $dPort = 5005; $dName = "PHÚ MINH L2" }
    elseif ($dName -like "*THANH PHAT*") { $dPort = 5006; $dName = "THANH PHÁT L3" }
    elseif ($dName -like "*TANG TRET*") { $dPort = 5007; $dName = "TẦNG TRỆT" }
    elseif ($dName -like "*TLMT-TP*") { $dPort = 5005; $dName = "TLMT-TP" }
    elseif ($dName -like "*TLMT-TH*") { $dPort = 5005; $dName = "TLMT-TH" }

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

# Update sample_database.json
$db = [System.IO.File]::ReadAllText("$PSScriptRoot\..\public\sample_database.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$db.tables.'17_Attendance_Logs' = @($punches)
if ($allDevices.Count -gt 0) {
    $db.tables | Add-Member -MemberType NoteProperty -Name '20_Attendance_Devices' -Value @($allDevices) -Force
}

# Recalculate timesheets based on live SQL punches
$dayNames = @{
    [System.DayOfWeek]::Sunday = "Chủ nhật"
    [System.DayOfWeek]::Monday = "Thứ 2"
    [System.DayOfWeek]::Tuesday = "Thứ 3"
    [System.DayOfWeek]::Wednesday = "Thứ 4"
    [System.DayOfWeek]::Thursday = "Thứ 5"
    [System.DayOfWeek]::Friday = "Thứ 6"
    [System.DayOfWeek]::Saturday = "Thứ 7"
}

$logsByDateCode = @{}
$allDatesSet = @{}
foreach ($l in $punches) {
    if (-not $l.timestamp -or $l.timestamp.Length -lt 10) { continue }
    $dt = $l.timestamp.Substring(0,10)
    $allDatesSet[$dt] = $true
    $c = "$($l.attendance_code)".Trim()
    $k = "${c}_${dt}"
    if (-not $logsByDateCode.ContainsKey($k)) { $logsByDateCode[$k] = @() }
    $logsByDateCode[$k] += $l
}

$allDates = @($allDatesSet.Keys | Sort-Object)
$emps = $db.tables.'03_Employees'
$masters = @{}
foreach ($m in $db.tables.'00_Master_Profiles') {
    $masters[$m.employee_id] = $m
}

$allTimesheets = @()

foreach ($dt in $allDates) {
    $dateObj = [DateTime]::ParseExact($dt, "yyyy-MM-dd", $null)
    $dayName = $dayNames[$dateObj.DayOfWeek]

    foreach ($e in $emps) {
        $m = $masters[$e.employee_id]
        $code = if ($e.time_attendance_code) { "$($e.time_attendance_code)".Trim() } elseif ($e.attendance_code) { "$($e.attendance_code)".Trim() } elseif ($m -and $m.'Mã chấm công') { "$($m.'Mã chấm công')".Trim() } else { "" }

        if (-not $code) {
            $allTimesheets += [PSCustomObject]@{
                timesheet_id = "TS_$($e.employee_id)_$dt"
                employee_id = $e.employee_id
                attendance_code = ""
                full_name = $e.full_name
                department_name = $e.department_name
                date = $dt
                day_name = $dayName
                shift_id = "CA-HC"
                shift_name = "Ca Hành Chính"
                check_in = ""
                check_out = ""
                late_minutes = 0
                early_minutes = 0
                work_units = 0
                total_work_hours = 0
                ot_hours = 0
                total_all_hours = 0
                status = "NO_CODE"
                is_locked = $false
                is_manual_edited = $false
                note = "Không áp dụng chấm công máy (Không có mã CC)"
            }
            continue
        }

        $k = "${code}_${dt}"
        $empLogs = if ($logsByDateCode.ContainsKey($k)) { $logsByDateCode[$k] } else { @() }
        $empLogs = $empLogs | Sort-Object { $_.timestamp }

        $checkIn = ""
        $checkOut = ""
        $lateMins = 0
        $earlyMins = 0
        $workUnits = 0.0
        $totalHours = 0.0
        $otHours = 0.0
        $status = "ABSENT"
        $note = "Vắng mặt (Không có dữ liệu chấm công)"

        if ($empLogs.Count -ge 2) {
            $checkIn = $empLogs[0].timestamp.Substring(11, 5)
            $checkOut = $empLogs[-1].timestamp.Substring(11, 5)

            $inH = [int]$checkIn.Substring(0,2)
            $inM = [int]$checkIn.Substring(3,2)
            $outH = [int]$checkOut.Substring(0,2)
            $outM = [int]$checkOut.Substring(3,2)

            $inMins = $inH * 60 + $inM
            $outMins = $outH * 60 + $outM

            if ($inMins -gt (8 * 60 + 15)) { $lateMins = $inMins - (8 * 60) }
            if ($outMins -lt (17 * 60)) { $earlyMins = (17 * 60) - $outMins }

            $span = $outMins - $inMins
            if ($inMins -le (12 * 60) -and $outMins -ge (13 * 60)) { $span -= 60 }
            $totalHours = [Math]::Round([Math]::Max(0, $span / 60.0), 1)

            if ($totalHours -ge 7.0) {
                $workUnits = 1.0
                if ($lateMins -gt 0 -and $earlyMins -gt 0) { $status = "LATE"; $note = "Đi muộn ${lateMins}p, về sớm ${earlyMins}p" }
                elseif ($lateMins -gt 0) { $status = "LATE"; $note = "Đi muộn ${lateMins}p" }
                elseif ($earlyMins -gt 0) { $status = "EARLY"; $note = "Về sớm ${earlyMins}p" }
                else { $status = "VALID"; $note = "Hợp lệ" }
            } elseif ($totalHours -ge 3.5) {
                $workUnits = 0.5
                $status = "HALF_DAY"
                $note = "Làm nửa ngày (0.5 công)"
            } else {
                $workUnits = 0
                $status = "INVALID"
                $note = "Thời gian làm việc không đủ ca"
            }
        } elseif ($empLogs.Count -eq 1) {
            $checkIn = $empLogs[0].timestamp.Substring(11, 5)
            $inH = [int]$checkIn.Substring(0,2)
            $inM = [int]$checkIn.Substring(3,2)
            $inMins = $inH * 60 + $inM
            if ($inMins -gt (8 * 60 + 15)) { $lateMins = $inMins - (8 * 60) }
            $workUnits = 0.5
            $totalHours = 4.0
            $status = if ($lateMins -gt 0) { "LATE" } else { "VALID" }
            $note = if ($lateMins -gt 0) { "Đi muộn ${lateMins}p (chưa chấm ra)" } else { "Đang làm việc (chưa chấm ra)" }
        }

        $allTimesheets += [PSCustomObject]@{
            timesheet_id = "TS_$($e.employee_id)_$dt"
            employee_id = $e.employee_id
            attendance_code = $code
            full_name = $e.full_name
            department_name = $e.department_name
            date = $dt
            day_name = $dayName
            shift_id = "CA-HC"
            shift_name = "Ca Hành Chính"
            check_in = $checkIn
            check_out = $checkOut
            late_minutes = $lateMins
            early_minutes = $earlyMins
            work_units = $workUnits
            total_work_hours = $totalHours
            ot_hours = $otHours
            total_all_hours = $totalHours
            status = $status
            is_locked = $false
            is_manual_edited = $false
            note = $note
        }
    }
}

$persistedTimesheets = @($allTimesheets | Where-Object { $_.date -ge '2026-08-20' -or $_.status -ne 'ABSENT' })
$db.tables.'19_Attendance_Timesheets' = $persistedTimesheets
$dbJson = $db | ConvertTo-Json -Compress -Depth 10
[System.IO.File]::WriteAllText("$PSScriptRoot\..\public\sample_database.json", $dbJson, [System.Text.Encoding]::UTF8)

# Sync to Cloudflare Pages Production API if available
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $apiPayload = @{
        db_type = "sql_server"
        server_host = $serverHost
        database_name = if ($TargetDatabase) { $TargetDatabase } else { "Tlmt,Mitaco,longan" }
        punch_logs = $punches
        timesheets = $allTimesheets
    } | ConvertTo-Json -Depth 5
    $res = Invoke-RestMethod -Uri "https://trunghaico.vn/api/attendance/zk/software-sync" -Method Post -ContentType "application/json; charset=utf-8" -Body $apiPayload -TimeoutSec 15 -ErrorAction SilentlyContinue
    if ($res -and $res.success) {
        Write-Host "Cloudflare API sync: Success ($($res.added_count) new punches, $($res.timesheets_count) timesheets updated)"
    }
} catch {}

Write-Host "Sync completed! Total punches: $($punches.Count), Total timesheets: $($allTimesheets.Count), Devices found: $($allDevices.Count)"
