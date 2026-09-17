# Test direct ZK Protocol connection over TCP
function Test-ZKConnect {
    param(
        [string]$IP,
        [int]$Port,
        [string]$Name
    )

    Write-Host "Connecting to $Name (${IP}:${Port})..." -ForegroundColor Cyan
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect($IP, $Port, $null, $null)
        $success = $async.AsyncWaitHandle.WaitOne(3000, $false) -and $tcp.Connected
        if (-not $success) {
            Write-Host "  -> TCP connect timed out or refused." -ForegroundColor Red
            $tcp.Close()
            return
        }

        $stream = $tcp.GetStream()
        $stream.ReadTimeout = 4000
        $stream.WriteTimeout = 4000

        # ZK TCP Packet Format:
        # Magic: 0x50 0x50 0x82 0x7d (4 bytes)
        # Payload Size (4 bytes, little endian): e.g. 8 bytes
        # Payload:
        #   Command Code (2 bytes): CMD_CONNECT = 1000 = 0xE8 0x03
        #   Checksum (2 bytes):
        #   Session ID (2 bytes): 0x00 0x00
        #   Reply ID (2 bytes): 0x00 0x00

        # Calculate Checksum for CMD_CONNECT
        # 16-bit 1's complement sum
        # cmd=1000, session=0, reply=0 -> sum = 1000 -> not(1000) & 0xFFFF
        $cmd = 1000
        $session = 0
        $reply = 0
        
        # Checksum calculation:
        $chk = 0
        $chk += $cmd
        $chk += $session
        $chk += $reply
        $chk = ($chk -band 0xFFFF)
        $chk = (0xFFFF - $chk)

        # Build payload (8 bytes)
        $payload = [byte[]]@(
            ($cmd -band 0xFF), (($cmd -shr 8) -band 0xFF),
            ($chk -band 0xFF), (($chk -shr 8) -band 0xFF),
            ($session -band 0xFF), (($session -shr 8) -band 0xFF),
            ($reply -band 0xFF), (($reply -shr 8) -band 0xFF)
        )

        $magic = [byte[]]@(0x50, 0x50, 0x82, 0x7D)
        $size = [byte[]]@(($payload.Length -band 0xFF), 0, 0, 0)

        $packet = $magic + $size + $payload
        $stream.Write($packet, 0, $packet.Length)
        $stream.Flush()

        # Read Response
        $resp = New-Object byte[] 1024
        $readBytes = $stream.Read($resp, 0, $resp.Length)
        if ($readBytes -gt 0) {
            $hex = ($resp[0..($readBytes-1)] | ForEach-Object { $_.ToString("X2") }) -join " "
            Write-Host "  -> Response ($readBytes bytes): $hex" -ForegroundColor Green
            if ($readBytes -ge 16) {
                # Check response code at offset 8 (after 4b magic + 4b size)
                $respCode = $resp[8] + ($resp[9] -shl 8)
                $sessionId = $resp[12] + ($resp[13] -shl 8)
                Write-Host "  -> Response Code: $respCode (2000=ACK_OK), SessionId: $sessionId" -ForegroundColor Green
            }
        } else {
            Write-Host "  -> No response received" -ForegroundColor Yellow
        }

        $tcp.Close()
    } catch {
        Write-Host "  -> Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Test-ZKConnect -IP "113.161.53.133" -Port 5005 -Name "MCC T2"
Test-ZKConnect -IP "113.161.53.133" -Port 5006 -Name "MCC T3"
Test-ZKConnect -IP "113.161.53.133" -Port 5007 -Name "MCC TANG TRET"
Test-ZKConnect -IP "113.161.201.71" -Port 5005 -Name "TL-MT TP"
Test-ZKConnect -IP "14.224.132.5" -Port 5005 -Name "TL-MT TH"
