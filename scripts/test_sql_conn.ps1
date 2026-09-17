$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"
$dbList = @("Mitaco", "Tlmt", "longan", "khbmt", "ctvp")

foreach ($dbName in $dbList) {
    try {
        $connStr = "Server=$serverHost;Database=$dbName;User Id=$serverUser;Password=$serverPass;Connection Timeout=8;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "SELECT COUNT(*) FROM CheckInOut"
        $count = $cmd.ExecuteScalar()
        $conn.Close()
        Write-Host "[$dbName] OK! Total rows in CheckInOut: $count" -ForegroundColor Green
    } catch {
        Write-Host "[$dbName] Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
