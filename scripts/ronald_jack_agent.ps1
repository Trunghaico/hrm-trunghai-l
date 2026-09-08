<#
================================================================================
 TRUNG HẢI HRM - RONALD JACK PRO BACKGROUND AUTO-SYNC AGENT
================================================================================
 Script tự động chạy ngầm trên máy tính cài phần mềm Ronald Jack Pro / Wise Eye.
 Tự động kết nối cơ sở dữ liệu SQL Server / MS Access, lấy các lượt quẹt thẻ mới
 và đẩy trực tiếp lên hệ thống Trung Hải HRM qua REST API.

 Tần suất chạy khuyến nghị: Mỗi 5 phút hoặc 10 phút một lần (qua Windows Task Scheduler).
================================================================================
#>

param (
    [string]$ConfigPath = "$PSScriptRoot\agent_config.json"
)

$ErrorActionPreference = "Continue"

# 1. CẤU HÌNH MẶC ĐỊNH (Có thể ghi đè trong agent_config.json)
$Config = @{
    # URL API hệ thống Trung Hải HRM
    HrmApiUrl      = "https://trunghaico.vn/api/attendance/zk/software-sync"
    
    # Loại CSDL: "sql_server" hoặc "ms_access"
    DatabaseType   = "sql_server"
    
    # Cấu hình SQL Server (Nếu dùng SQL Server)
    SqlHost        = "127.0.0.1\SQLEXPRESS"   # Ví dụ: 127.0.0.1, localhost, .\SQLEXPRESS
    SqlDatabase    = "RonaldJackPro"           # Tên CSDL: RonaldJackPro, Att2000, WiseEye
    SqlUser        = "sa"
    SqlPassword    = "123456"
    UseWindowsAuth = $false                    # $true nếu dùng Windows Authentication
    
    # Cấu hình MS Access (Nếu Ronald Jack lưu file .mdb)
    AccessMdbPath  = "C:\Program Files (x86)\Ronald Jack Pro\att2000.mdb"
    
    # File lưu mốc thời gian đồng bộ lần trước và file log
    LastSyncFile   = "$PSScriptRoot\last_sync.txt"
    LogFile        = "$PSScriptRoot\agent_sync.log"
}

# Tải cấu hình từ agent_config.json nếu có
if (Test-Path $ConfigPath) {
    try {
        $jsonConfig = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($prop in $jsonConfig.PSObject.Properties) {
            $Config[$prop.Name] = $prop.Value
        }
    }
    catch {
        Write-Warning "Không đọc được file config, dùng cấu hình mặc định."
    }
}

# Hàm ghi log có ngày giờ
function Write-Log {
    param ([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine
    try {
        Add-Content -Path $Config.LogFile -Value $logLine -Encoding UTF8
    }
    catch {}
}

Write-Log "=== BẮT ĐẦU CHU KỲ ĐỒNG BỘ MÁY CHẤM CÔNG RONALD JACK ==="

# 2. XÁC ĐỊNH MỐC THỜI GIAN ĐỒNG BỘ LẦN TRƯỚC
$lastSyncTime = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd 00:00:00")
if (Test-Path $Config.LastSyncFile) {
    $savedTime = (Get-Content $Config.LastSyncFile -Raw -Encoding UTF8).Trim()
    if (![string]::IsNullOrWhiteSpace($savedTime)) {
        $lastSyncTime = $savedTime
    }
}
Write-Log "Lấy dữ liệu quẹt thẻ mới từ thời điểm: $lastSyncTime"

# 3. KẾT NỐI CƠ SỞ DỮ LIỆU VÀ ĐỌC BẢN GHI
$punchLogs = @()
$maxPunchTime = $lastSyncTime

if ($Config.DatabaseType -eq "sql_server") {
    # Kết nối Microsoft SQL Server
    $connStr = ""
    if ($Config.UseWindowsAuth) {
        $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);Integrated Security=True;TrustServerCertificate=True;"
    }
    else {
        $connStr = "Server=$($Config.SqlHost);Database=$($Config.SqlDatabase);User Id=$($Config.SqlUser);Password=$($Config.SqlPassword);TrustServerCertificate=True;"
    }

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        Write-Log "Kết nối thành công tới SQL Server: $($Config.SqlHost) - Database: $($Config.SqlDatabase)"

        # Query bảng CheckInOut của Ronald Jack Pro
        $query = "SELECT c.UserEnrollNumber, CONVERT(varchar(19), c.TimeStr, 120) AS CheckTimeString, ISNULL(c.MachineNo, 1) AS MachineNo, ISNULL(c.VerifyMode, 0) AS VerifyMode FROM CheckInOut c WHERE c.TimeStr >= @LastSyncTime ORDER BY c.TimeStr ASC"
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $query
        $param = $cmd.Parameters.AddWithValue("@LastSyncTime", [datetime]$lastSyncTime)

        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
        $dataset = New-Object System.Data.DataSet
        [void]$adapter.Fill($dataset)
        $conn.Close()

        $table = $dataset.Tables[0]
        Write-Log "Tìm thấy $($table.Rows.Count) lượt quẹt thẻ mới từ phần mềm."

        foreach ($row in $table.Rows) {
            $attCode = [string]$row["UserEnrollNumber"]
            $timeStr = [string]$row["CheckTimeString"]
            $machNo = [int]$row["MachineNo"]
            $vMode = [int]$row["VerifyMode"]

            $vTypeName = "Vân tay"
            if ($vMode -eq 1) { $vTypeName = "Vân tay" }
            elseif ($vMode -eq 2) { $vTypeName = "Khuôn mặt" }
            elseif ($vMode -eq 3) { $vTypeName = "Thẻ từ" }
            elseif ($vMode -eq 4) { $vTypeName = "Mật mã" }

            $punchLogs += @{
                attendance_code = $attCode
                timestamp       = $timeStr
                device_id       = "RJ-PRO-M$machNo"
                device_name     = "Ronald Jack Pro (Máy $machNo)"
                verify_type     = $vTypeName
            }

            if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                $maxPunchTime = $timeStr
            }
        }
    }
    catch {
        Write-Log "Lỗi truy vấn SQL Server Ronald Jack: $($_.Exception.Message)" "ERROR"
    }
}
elseif ($Config.DatabaseType -eq "ms_access") {
    # Kết nối Microsoft Access .mdb
    $mdbPath = $Config.AccessMdbPath
    if (!(Test-Path $mdbPath)) {
        Write-Log "Không tìm thấy file CSDL Access: $mdbPath" "ERROR"
    }
    else {
        try {
            $connStr = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$mdbPath;"
            $conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
            $conn.Open()
            Write-Log "Kết nối thành công tới file CSDL Access: $mdbPath"

            $query = "SELECT UserEnrollNumber, CHECKTIME, SENSORID FROM CheckInOut WHERE CHECKTIME >= #$lastSyncTime# ORDER BY CHECKTIME ASC"
            $cmd = New-Object System.Data.OleDb.OleDbCommand($query, $conn)
            $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
            $dataset = New-Object System.Data.DataSet
            [void]$adapter.Fill($dataset)
            $conn.Close()

            $table = $dataset.Tables[0]
            Write-Log "Tìm thấy $($table.Rows.Count) lượt quẹt thẻ mới từ Access DB."

            foreach ($row in $table.Rows) {
                $attCode = [string]$row["UserEnrollNumber"]
                $dt = [datetime]$row["CHECKTIME"]
                $timeStr = $dt.ToString("yyyy-MM-dd HH:mm:ss")
                $sensor = [string]$row["SENSORID"]

                $punchLogs += @{
                    attendance_code = $attCode
                    timestamp       = $timeStr
                    device_id       = "RJ-ACCESS-$sensor"
                    device_name     = "Ronald Jack Access (Cổng $sensor)"
                    verify_type     = "Vân tay"
                }

                if ([string]::Compare($timeStr, $maxPunchTime) -gt 0) {
                    $maxPunchTime = $timeStr
                }
            }
        }
        catch {
            Write-Log "Lỗi truy vấn Access MDB Ronald Jack: $($_.Exception.Message)" "ERROR"
        }
    }
}

# 4. GỬI DỮ LIỆU LÊN TRUNG HẢI HRM QUA REST API
if ($punchLogs.Count -gt 0) {
    Write-Log "Đang đẩy $($punchLogs.Count) bản ghi quẹt thẻ lên hệ thống Trung Hải HRM..."
    
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
            Write-Log "ĐỒNG BỘ THÀNH CÔNG: $($response.message)" "SUCCESS"
            # Lưu lại mốc thời gian đã đồng bộ
            Set-Content -Path $Config.LastSyncFile -Value $maxPunchTime -Encoding UTF8
        }
        else {
            Write-Log "Máy chủ phản hồi thất bại: $($response.message)" "WARN"
        }
    }
    catch {
        Write-Log "Lỗi khi gửi dữ liệu qua API: $($_.Exception.Message)" "ERROR"
    }
}
else {
    Write-Log "Không có bản ghi quẹt thẻ mới nào cần đồng bộ."
}

Write-Log "=== KẾT THÚC CHU KỲ ĐỒNG BỘ ==="
