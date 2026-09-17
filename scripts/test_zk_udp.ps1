function Test-ZKConnectUDP {
    param(
        [string]$IP,
        [int]$Port,
        [string]$Name
    )

    Write-Host "Connecting UDP to $Name (${IP}:${Port})..." -ForegroundColor Cyan
    try {
        $udp = New-Object System.Net.Sockets.UdpClient
        $udp.Client.ReceiveTimeout = 3000
        $udp.Connect($IP, $Port)

        $cmd = 1000 # CMD_CONNECT
        $session = 0
        $reply = 0
        
        # Checksum calculation:
        $chk = 0
        $chk += $cmd
        $chk += $session
        $chk += $reply
        $chk = ($chk -band 0xFFFF)
        $chk = (0xFFFF - $chk)

        # Build UDP payload (8 bytes)
        $payload = [byte[]]@(
            ($cmd -band 0xFF), (($cmd -shr 8) -band 0xFF),
            ($chk -band 0xFF), (($chk -shr 8) -band 0xFF),
            ($session -band 0xFF), (($session -shr 8) -band 0xFF),
            ($reply -band 0xFF), (($reply -shr 8) -band 0xFF)
        )

        $udp.Send($payload, $payload.Length) | Out-Null

        $remoteEp = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $resp = $udp.Receive([ref]$remoteEp)
        
        if ($resp -and $resp.Length -gt 0) {
            $hex = ($resp | ForEach-Object { $_.ToString("X2") }) -join " "
            Write-Host "  -> UDP Response ($($resp.Length) bytes): $hex" -ForegroundColor Green
            $respCode = $resp[0] + ($resp[1] -shl 8)
            $sessionId = $resp[4] + ($resp[5] -shl 8)
            Write-Host "  -> Response Code: $respCode (2000=ACK_OK), SessionId: $sessionId" -ForegroundColor Green
        }

        $udp.Close()
    } catch {
        Write-Host "  -> Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Test-ZKConnectUDP -IP "113.161.53.133" -Port 5005 -Name "MCC T2"
Test-ZKConnectUDP -IP "113.161.53.133" -Port 5006 -Name "MCC T3"
Test-ZKConnectUDP -IP "113.161.53.133" -Port 5007 -Name "MCC TANG TRET"
Test-ZKConnectUDP -IP "113.161.201.71" -Port 5005 -Name "TL-MT TP"
Test-ZKConnectUDP -IP "14.224.132.5" -Port 5005 -Name "TL-MT TH"
Test-ZKConnectUDP -IP "113.161.30.79" -Port 5006 -Name "KH-BMT VP"
Test-ZKConnectUDP -IP "113.161.30.79" -Port 5005 -Name "KH-BMT KHU D"
