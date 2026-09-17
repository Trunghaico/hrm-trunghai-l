$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"
$dbList = @("VPSG", "TLMT", "longan")

foreach ($db in $dbList) {
    try {
        $connStr = "Server=$serverHost;Database=$db;User Id=$serverUser;Password=$serverPass;TrustServerCertificate=True;Connect Timeout=8;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        Write-Host "`n=== DATABASE: $db ===" -ForegroundColor Cyan
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT COUNT(*) FROM NHANVIEN"
        $count = $cmd.ExecuteScalar()
        Write-Host "NHANVIEN count: $count" -ForegroundColor Green

        $cmdSample = $conn.CreateCommand()
        $cmdSample.CommandText = "SELECT TOP 3 MaNhanVien, TenNhanVien, MaChamCong FROM NHANVIEN"
        $ad = New-Object System.Data.SqlClient.SqlDataAdapter($cmdSample)
        $ds = New-Object System.Data.DataSet
        $ad.Fill($ds) | Out-Null
        foreach ($r in $ds.Tables[0].Rows) {
            Write-Host "  NV: $($r.MaNhanVien) - $($r.TenNhanVien) - MCC: $($r.MaChamCong)"
        }

        $conn.Close()
    } catch {
        Write-Host "Failed to connect to ${db}: $($_.Exception.Message)" -ForegroundColor Red
    }
}


