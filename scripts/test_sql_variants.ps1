$serverHost = "113.161.53.133,1433"
$serverUser = "sa"
$serverPass = "THG@2026!"

$variants = @(
    "Server=$serverHost;Database=Mitaco;User Id=$serverUser;Password=$serverPass;Encrypt=False;TrustServerCertificate=True;Connect Timeout=5;",
    "Server=$serverHost;Database=Mitaco;User Id=$serverUser;Password=$serverPass;TrustServerCertificate=True;Connect Timeout=5;",
    "Server=113.161.53.133;Database=Mitaco;User Id=$serverUser;Password=$serverPass;Encrypt=False;Connect Timeout=5;",
    "Data Source=113.161.53.133,1433;Initial Catalog=Mitaco;User ID=$serverUser;Password=$serverPass;Encrypt=False;TrustServerCertificate=True;Timeout=5;"
)

foreach ($v in $variants) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($v)
        $conn.Open()
        Write-Host "Success with: $v" -ForegroundColor Green
        $conn.Close()
        break
    } catch {
        Write-Host "Failed ($($_.Exception.Message)) with: $v" -ForegroundColor Red
    }
}
