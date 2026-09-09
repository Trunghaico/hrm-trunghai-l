<#
================================================================================
 TRUNG HAI HRM - BACKGROUND AUTO-SYNC AGENT (MITACO & RONALD JACK PRO)
================================================================================
 Script tu dong chay ngam tren may chu hoac may tram cai CSDL Cham Cong Mitaco / Ronald Jack.
 Tu dong ket noi SQL Server (113.161.53.133,1433) hoac Access MDB, trich xuat ban ghi quet the
 moi nhat va day len he thong Trung Hai HRM qua REST API.

 Tan suat chay khuyen nghi: Moi 5 phut (qua Windows Task Scheduler hoac che do Loop).
================================================================================
#>

param (
    [string]$ConfigPath = "$PSScriptRoot\agent_config.json",
    [string]$SyncSince = "",
    [switch]$OneShot = $true,
    [int]$LoopIntervalSec = 300
)

$ErrorActionPreference = "Continue"

# 1. CAU HINH MAC DINH CHO MITACO SQL SERVER
$Config = @{
    HrmApiUrl           = "https://trunghaico.vn/api/attendance/zk/software-sync"
    DatabaseType        = "sql_server"
    SqlHost             = "113.161.53.133,1433"
    SqlDatabase         = "mitaco"
    SqlUser             = "sa"
    SqlPassword         = "THG@2026!"
    UseWindowsAuth      = $false
    BatchLimit          = 1000
    AccessMdbPath       = "C:\Program Files (x86)\Ronald Jack Pro\att2000.mdb"
    LastSyncFile        = "$PSScriptRoot\last_sync.txt"
    LogFile             = "$PSScriptRoot\agent_sync.log"
}

# Doc cau hinh tu agent_config.json neu co
if (Test-Path $ConfigPath) {
    try {
        $jsonContent = Get-Content $ConfigPath -Raw -Encoding UTF8
        $jsonConfig = ConvertFrom-Json $jsonContent
        if ($jsonConfig.HrmApiUrl) { $Config.HrmApiUrl = $jsonConfig.HrmApiUrl }
        if ($jsonConfig.DatabaseType) { $Config.DatabaseType = $jsonConfig.DatabaseType }
        if ($jsonConfig.SqlHost) { $Config.SqlHost = $jsonConfig.SqlHost }
        if ($jsonConfig.SqlDatabase) { $Config.SqlDatabase = $jsonConfig.SqlDatabase }
        if ($jsonConfig.SqlUser) { $Config.SqlUser = $jsonConfig.SqlUser }
        if ($jsonConfig.SqlPassword) { $Config.SqlPassword = $jsonConfig.SqlPassword }
        if ($null -ne $jsonConfig.UseWindowsAuth) { $Config.UseWindowsAuth = [bool]$jsonConfig.UseWindowsAuth }
        if ($jsonConfig.BatchLimit) { $Config.BatchLimit = [int]$jsonConfig.BatchLimit }
        if ($jsonConfig.AccessMdbPath) { $Config.AccessMdbPath = $jsonConfig.AccessMdbPath }
    } catch {
        Write-Warning "Khong doc duoc file config, su dung cau hinh mac dinh."
    }
}

function Write-Log {
    param ([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $color = "White"
    switch ($Level) {
        "SUCCESS" { $color = "Green" }
        "WARN"    { $color = "Yellow" }
        "ERROR"   { $color = "Red" }
        "INFO"    { $color = "Cyan" }
    }
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine -ForegroundColor $color
    try {
        Add-Content -Path $Config.LogFile -Value $logLine -Encoding UTF8
    } catch {}
}

function Run-SyncCycle {
    Write-Log "=== BAT DAU CHU KY DONG BO DU LIEU CHAM CONG ===" "INFO"

    # 2. XAC DINH MOC THOI GIAN DONG BO LAN TRUOC
    $lastSyncTime = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd 00:00:00")
    if (![string]::IsNullOrWhiteSpace($SyncSince)) {
        $lastSyncTime = $SyncSince
    } elseif (Test-Path $Config.LastSyncFile) {
        $savedTime = (Get-Content $Config.LastSyncFile -Raw -Encoding UTF8).Trim()
        if (![string]::IsNullOrWhiteSpace($savedTime)) {
            $lastSyncTime = $savedTime
        }
    }
    Write-Log "Lay du lieu quet the moi tu moc thoi gian: $lastSyncTime" "INFO"

    # 3. KET NOI CO SO DU LIEU VA TRICH XUAT BAN GHI
    $punchLogs = @()
    $maxPunchTime = $lastSyncTime

    if ($Config.DatabaseType -eq "sql_server") {
        $connStr = ""
        if ($Config.UseWindowsAuth) {
            $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);Integrated Security=True;TrustServerCertificate=True;Connect Timeout=20;"
        } else {
            $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);User Id=$($Config.SqlUser);Password=$($Config.SqlPassword);TrustServerCertificate=True;Connect Timeout=20;"
        }

        try {
            $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
            $conn.Open()
            Write-Log "Ket noi thanh cong SQL Server: $($Config.SqlHost) - CSDL: $($Config.SqlDatabase)" "SUCCESS"

            # Kiem tra cau truc bang CheckInOut (Mitaco vs Ronald Jack Pro standard)
            $colCheckCmd = $conn.CreateCommand()
            $colCheckCmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CheckInOut'"
            $colReader = $colCheckCmd.ExecuteReader()
            $existingCols = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
            while ($colReader.Read()) {
                [void]$existingCols.Add($colReader["COLUMN_NAME"].ToString())
            }
            $colReader.Close()

            $batchLimit = [int]$Config.BatchLimit
            if ($batchLimit -le 0) { $batchLimit = 1000 }

            $cmd = $conn.CreateCommand()

            if ($existingCols.Contains("MaChamCong") -and $existingCols.Contains("GioCham")) {
                Write-Log "Nhan dien cau truc CSDL: Mitaco 5v2 / Mitaco Pro (MaChamCong, GioCham, TenMay)" "INFO"
                $cmd.CommandText = "SELECT TOP ($batchLimit) c.ID, c.MaChamCong AS AttCode, ISNULL(nv.MaNhanVien, '') AS EmpId, ISNULL(nv.TenNhanVien, '') AS EmpName, CONVERT(varchar(19), c.GioCham, 120) AS CheckTimeString, ISNULL(c.TenMay, 'Mitaco') AS DeviceName, ISNULL(c.MaSoMay, 1) AS MachineNo, ISNULL(c.KieuCham, '255') AS VerifyMode FROM CheckInOut c LEFT JOIN NHANVIEN nv ON c.MaChamCong = nv.MaChamCong WHERE c.GioCham >= @LastSyncTime ORDER BY c.GioCham ASC"
            } else {
                Write-Log "Nhan dien cau truc CSDL: Ronald Jack Pro Chuan (UserEnrollNumber, TimeStr)" "INFO"
                $cmd.CommandText = "SELECT TOP ($batchLimit) c.UserEnrollNumber AS AttCode, '' AS EmpId, '' AS EmpName, CONVERT(varchar(19), c.TimeStr, 120) AS CheckTimeString, 'Ronald Jack Pro' AS DeviceName, ISNULL(c.MachineNo, 1) AS MachineNo, ISNULL(c.VerifyMode, 0) AS VerifyMode FROM CheckInOut c WHERE c.TimeStr >= @LastSyncTime ORDER BY c.TimeStr ASC"
            }

            [void]$cmd.Parameters.AddWithValue("@LastSyncTime", [datetime]$lastSyncTime)
            $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
            $dataset = New-Object System.Data.DataSet
            [void]$adapter.Fill($dataset)
            $conn.Close()

            $table = $dataset.Tables[0]
            Write-Log "Trich xuat duoc $($table.Rows.Count) ban ghi quet the moi tu CSDL." "INFO"

            foreach ($row in $table.Rows) {
                $attCode = [string]$row["AttCode"]
                $empId   = [string]$row["EmpId"]
                $empName = [string]$row["EmpName"]
                $timeStr = [string]$row["CheckTimeString"]
                $machNo  = [int]$row["MachineNo"]
                $devName = [string]$row["DeviceName"]
                $vMode   = [string]$row["VerifyMode"]

                $vTypeName = "Khuon mat"
                if ($vMode -eq "2") { $vTypeName = "Khuon mat" }
                elseif ($vMode -eq "3") { $vTypeName = "The tu" }
                elseif ($vMode -eq "4") { $vTypeName = "Mat ma" }

                $punchLogs += @{
                    attendance_code = $attCode
                    employee_id     = $empId
                    employee_name   = $empName
                    timestamp       = $timeStr
                    device_id       = "MCC-M$machNo"
                    device_name     = $devName
                    verify_type     = $vTypeName
                }

                if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                    $maxPunchTime = $timeStr
                }
            }
        } catch {
            Write-Log "Loi ket noi SQL Server: $($_.Exception.Message)" "ERROR"
        }
    }

    if ($Config.DatabaseType -eq "ms_access") {
        $mdbPath = $Config.AccessMdbPath
        if (!(Test-Path $mdbPath)) {
            Write-Log "Khong tim thay file CSDL Access: $mdbPath" "ERROR"
        } else {
            try {
                $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$mdbPath;"
                $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
                $conn.Open()
                Write-Log "Ket noi thanh cong file CSDL Access: $mdbPath" "SUCCESS"

                $query = "SELECT UserEnrollNumber, CHECKTIME, SENSORID FROM CheckInOut WHERE CHECKTIME >= #$lastSyncTime# ORDER BY CHECKTIME ASC"
                $cmd = New-Object System.Data.OleDb.OleDbCommand($query, $conn)
                $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
                $dataset = New-Object System.Data.DataSet
                [void]$adapter.Fill($dataset)
                $conn.Close()

                $table = $dataset.Tables[0]
                Write-Log "Tim thay $($table.Rows.Count) luot quet the moi tu Access DB." "INFO"

                foreach ($row in $table.Rows) {
                    $attCode = [string]$row["UserEnrollNumber"]
                    $dt = [datetime]$row["CHECKTIME"]
                    $timeStr = $dt.ToString("yyyy-MM-dd HH:mm:ss")
                    $sensor = [string]$row["SENSORID"]

                    $punchLogs += @{
                        attendance_code = $attCode
                        employee_id     = ""
                        employee_name   = ""
                        timestamp       = $timeStr
                        device_id       = "RJ-ACCESS-$sensor"
                        device_name     = "Ronald Jack Access (Cong $sensor)"
                        verify_type     = "Khuon mat"
                    }

                    if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                        $maxPunchTime = $timeStr
                    }
                }
            } catch {
                Write-Log "Loi truy van Access MDB: $($_.Exception.Message)" "ERROR"
            }
        }
    }

    # 4. GUI DU LIEU LEN TRUNG HAI HRM QUA REST API
    if ($punchLogs.Count -gt 0) {
        Write-Log "Dang truyen $($punchLogs.Count) ban ghi quet the len he thong Trung Hai HRM..." "INFO"

        $payload = @{
            db_type       = $Config.DatabaseType
            server_host   = $Config.SqlHost
            database_name = $Config.SqlDatabase
            punch_logs    = $punchLogs
        } | ConvertTo-Json -Depth 5

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $response = Invoke-RestMethod -Uri $Config.HrmApiUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $payload -TimeoutSec 20
            
            if ($response.success) {
                Write-Log "DONG BO THANH CONG: $($response.message)" "SUCCESS"
                Set-Content -Path $Config.LastSyncFile -Value $maxPunchTime -Encoding UTF8
            } else {
                Write-Log "May chu phan hoi: $($response.message)" "WARN"
            }
        } catch {
            Write-Log "Loi khi gui du lieu qua API: $($_.Exception.Message)" "WARN"
        }
    } else {
        Write-Log "Khong co ban ghi quet the moi nao can dong bo." "INFO"
    }

    Write-Log "=== KET THUC CHU KY DONG BO ===" "INFO"
}

# THUC THI CHINH
if ($OneShot) {
    Run-SyncCycle
} else {
    Write-Log "Khoi dong che do chay ngam dinh ky moi $LoopIntervalSec giay (Nhan Ctrl+C de dung)..." "SUCCESS"
    while ($true) {
        Run-SyncCycle
        Write-Log "Nghi $LoopIntervalSec giay truoc chu ky dong bo tiep theo..." "INFO"
        Start-Sleep -Seconds $LoopIntervalSec
    }
}
