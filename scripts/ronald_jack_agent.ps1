<#
================================================================================
 TRUNG HAI HRM - RONALD JACK PRO BACKGROUND AUTO-SYNC AGENT
================================================================================
 Script tu dong chay ngam tren may tinh cai phan mem Ronald Jack Pro / Wise Eye.
 Tu dong ket noi co so du lieu SQL Server / MS Access, trich xuat ban ghi quet the moi
 va day len he thong Trung Hai HRM qua REST API.

 Tan suat chay khuyen nghi: Moi 5 phut (qua Windows Task Scheduler).
================================================================================
#>

param (
    [string]$ConfigPath = "$PSScriptRoot\agent_config.json"
)

$ErrorActionPreference = "Continue"

# 1. CAU HINH MAC DINH
$Config = @{
    HrmApiUrl       = "https://trunghaico.vn/api/attendance/zk/software-sync"
    DatabaseType    = "sql_server"
    SqlHost         = "127.0.0.1\SQLEXPRESS"
    SqlDatabase     = "RonaldJackPro"
    SqlUser         = "sa"
    SqlPassword     = "123"
    UseWindowsAuth  = $false
    AccessMdbPath   = "C:\Program Files (x86)\Ronald Jack Pro\att2000.mdb"
    LastSyncFile    = "$PSScriptRoot\last_sync.txt"
    LogFile         = "$PSScriptRoot\agent_sync.log"
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
        if ($jsonConfig.AccessMdbPath) { $Config.AccessMdbPath = $jsonConfig.AccessMdbPath }
    } catch {
        Write-Warning "Khong doc duoc file config, su dung cau hinh mac dinh."
    }
}

function Write-Log {
    param ([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine
    try {
        Add-Content -Path $Config.LogFile -Value $logLine
    } catch {}
}

Write-Log "=== BAT DAU CHU KY DONG BO MAY CHAM CONG RONALD JACK ==="

# 2. XAC DINH MOC THOI GIAN DONG BO LAN TRUOC
$lastSyncTime = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd 00:00:00")
if (Test-Path $Config.LastSyncFile) {
    $savedTime = (Get-Content $Config.LastSyncFile -Raw).Trim()
    if (![string]::IsNullOrWhiteSpace($savedTime)) {
        $lastSyncTime = $savedTime
    }
}
Write-Log "Lay du lieu quet the moi tu moc thoi gian: $lastSyncTime"

# 3. KET NOI CSDL VA TRICH XUAT BAN GHI
$punchLogs = @()
$maxPunchTime = $lastSyncTime

if ($Config.DatabaseType -eq "sql_server") {
    $connStr = ""
    if ($Config.UseWindowsAuth) {
        $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);Integrated Security=True;TrustServerCertificate=True;"
    } else {
        $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);User Id=$($Config.SqlUser);Password=$($Config.SqlPassword);TrustServerCertificate=True;"
    }

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        Write-Log "Ket noi thanh cong SQL Server: $($Config.SqlHost) - Database: $($Config.SqlDatabase)"

        $query = "SELECT c.UserEnrollNumber, CONVERT(varchar(19), c.TimeStr, 120) AS CheckTimeString, ISNULL(c.MachineNo, 1) AS MachineNo, ISNULL(c.VerifyMode, 0) AS VerifyMode FROM CheckInOut c WHERE c.TimeStr >= @LastSyncTime ORDER BY c.TimeStr ASC"
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $query
        [void]$cmd.Parameters.AddWithValue("@LastSyncTime", [datetime]$lastSyncTime)

        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dataset = New-Object System.Data.DataSet
        [void]$adapter.Fill($dataset)
        $conn.Close()

        $table = $dataset.Tables[0]
        Write-Log "Tim thay $($table.Rows.Count) luot quet the moi tu phan mem."

        foreach ($row in $table.Rows) {
            $attCode = [string]$row["UserEnrollNumber"]
            $timeStr = [string]$row["CheckTimeString"]
            $machNo  = [int]$row["MachineNo"]
            $vMode   = [int]$row["VerifyMode"]

            $vTypeName = "Van tay"
            if ($vMode -eq 1) { $vTypeName = "Van tay" }
            elseif ($vMode -eq 2) { $vTypeName = "Khuon mat" }
            elseif ($vMode -eq 3) { $vTypeName = "The tu" }
            elseif ($vMode -eq 4) { $vTypeName = "Mat ma" }

            $punchLogs += @{
                attendance_code = $attCode
                timestamp       = $timeStr
                device_id       = "RJ-PRO-M$machNo"
                device_name     = "Ronald Jack Pro (May $machNo)"
                verify_type     = $vTypeName
            }

            if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                $maxPunchTime = $timeStr
            }
        }
    } catch {
        Write-Log "Loi truy van SQL Server Ronald Jack: $($_.Exception.Message)" "ERROR"
    }
} elseif ($Config.DatabaseType -eq "ms_access") {
    $mdbPath = $Config.AccessMdbPath
    if (!(Test-Path $mdbPath)) {
        Write-Log "Khong tim thay file CSDL Access: $mdbPath" "ERROR"
    } else {
        try {
            $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$mdbPath;"
            $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
            $conn.Open()
            Write-Log "Ket noi thanh cong file CSDL Access: $mdbPath"

            $query = "SELECT UserEnrollNumber, CHECKTIME, SENSORID FROM CheckInOut WHERE CHECKTIME >= #$lastSyncTime# ORDER BY CHECKTIME ASC"
            $cmd = New-Object System.Data.OleDb.OleDbCommand($query, $conn)
            $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
            $dataset = New-Object System.Data.DataSet
            [void]$adapter.Fill($dataset)
            $conn.Close()

            $table = $dataset.Tables[0]
            Write-Log "Tim thay $($table.Rows.Count) luot quet the moi tu Access DB."

            foreach ($row in $table.Rows) {
                $attCode = [string]$row["UserEnrollNumber"]
                $dt = [datetime]$row["CHECKTIME"]
                $timeStr = $dt.ToString("yyyy-MM-dd HH:mm:ss")
                $sensor = [string]$row["SENSORID"]

                $punchLogs += @{
                    attendance_code = $attCode
                    timestamp       = $timeStr
                    device_id       = "RJ-ACCESS-$sensor"
                    device_name     = "Ronald Jack Access (Cong $sensor)"
                    verify_type     = "Van tay"
                }

                if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                    $maxPunchTime = $timeStr
                }
            }
        } catch {
            Write-Log "Loi truy van Access MDB Ronald Jack: $($_.Exception.Message)" "ERROR"
        }
    }
}

# 4. GUI DU LIEU LEN TRUNG HAI HRM QUA REST API
if ($punchLogs.Count -gt 0) {
    Write-Log "Dang gui $($punchLogs.Count) ban ghi quet the len he thong Trung Hai HRM..."
    
    $payload = @{
        db_type       = $Config.DatabaseType
        server_host   = $Config.SqlHost
        database_name = $Config.SqlDatabase
        punch_logs    = $punchLogs
    } | ConvertTo-Json -Depth 5

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $response = Invoke-RestMethod -Uri $Config.HrmApiUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $payload
        
        if ($response.success) {
            Write-Log "DONG BO THANH CONG: $($response.message)" "SUCCESS"
            Set-Content -Path $Config.LastSyncFile -Value $maxPunchTime
        } else {
            Write-Log "May chu phan hoi: $($response.message)" "WARN"
        }
    } catch {
        Write-Log "Loi khi gui du lieu qua API: $($_.Exception.Message)" "ERROR"
    }
} else {
    Write-Log "Khong co ban ghi quet the moi nao can dong bo."
}

Write-Log "=== KET THUC CHU KY DONG BO ==="
