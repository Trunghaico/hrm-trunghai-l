# ==============================================================================
# ZK HARDWARE PROBE - KIEM TRA KET NOI PHAN CUNG MAY CHAM CONG
# ==============================================================================

function Probe-ZKDevice {
    param(
        [string]$IP,
        [int]$Port,
        [string]$Name
    )

    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Kiem tra thiet bi: $Name (${IP}:${Port})" -ForegroundColor Cyan

    # 1. Kiem tra TCP Socket
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcpConnected = $false
    try {
        $async = $tcp.BeginConnect($IP, $Port, $null, $null)
        $tcpConnected = $async.AsyncWaitHandle.WaitOne(2000, $false) -and $tcp.Connected
    } catch {}
    
    if ($tcpConnected) {
        Write-Host "  [TCP Port $Port] -> OPEN (Router da mo cong TCP)" -ForegroundColor Green
        
        # Gui CMD_CONNECT qua TCP
        try {
            $stream = $tcp.GetStream()
            $stream.ReadTimeout = 2500
            $stream.WriteTimeout = 2500

            # TCP ZK Packet: Magic(4b) + Length(4b) + CMD_CONNECT(8b)
            # cmd=1000, chk=64535, session=0, reply=0
            $payload = [byte[]]@(0xE8, 0x03, 0xD7, 0xFB, 0x00, 0x00, 0x00, 0x00)
            $header = [byte[]]@(0x50, 0x50, 0x82, 0x7D, 0x08, 0x00, 0x00, 0x00)
            $packet = $header + $payload

            $stream.Write($packet, 0, $packet.Length)
            $stream.Flush()

            $buf = New-Object byte[] 256
            $bytes = $stream.Read($buf, 0, $buf.Length)
            if ($bytes -gt 0) {
                $hex = ($buf[0..($bytes-1)] | ForEach-Object { $_.ToString("X2") }) -join " "
                Write-Host "  [TCP ZK Protocol] -> PHAN HOI THANH CONG! Raw: $hex" -ForegroundColor Green
            } else {
                Write-Host "  [TCP ZK Protocol] -> Ket noi mo nhung khong co byte phan hoi (co the do CommKey hoac Internal Port khong phai TCP)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  [TCP ZK Protocol] -> Khong nhan duoc byte phan hoi ($($_.Exception.Message))" -ForegroundColor Yellow
        }
        $tcp.Close()
    } else {
        Write-Host "  [TCP Port $Port] -> CLOSED / TIMEOUT" -ForegroundColor Red
        $tcp.Close()
    }

    # 2. Kiem tra UDP Socket
    try {
        $udp = New-Object System.Net.Sockets.UdpClient
        $udp.Client.ReceiveTimeout = 2000
        $udp.Connect($IP, $Port)

        # UDP payload: CMD_CONNECT (8 bytes)
        $udpPayload = [byte[]]@(0xE8, 0x03, 0xD7, 0xFB, 0x00, 0x00, 0x00, 0x00)
        $udp.Send($udpPayload, $udpPayload.Length) | Out-Null

        $ep = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
        $resp = $udp.Receive([ref]$ep)
        if ($resp -and $resp.Length -gt 0) {
            $hex = ($resp | ForEach-Object { $_.ToString("X2") }) -join " "
            Write-Host "  [UDP ZK Protocol] -> PHAN HOI THANH CONG! Raw: $hex" -ForegroundColor Green
        }
        $udp.Close()
    } catch {
        Write-Host "  [UDP ZK Protocol] -> Khong nhan phan hoi UDP ($($_.Exception.Message))" -ForegroundColor Yellow
    }
}

Probe-ZKDevice -IP "113.161.53.133" -Port 5005 -Name "MCC T2"
Probe-ZKDevice -IP "113.161.53.133" -Port 5006 -Name "MCC T3"
Probe-ZKDevice -IP "113.161.53.133" -Port 5007 -Name "MCC TANG TRET"
Probe-ZKDevice -IP "113.161.201.71" -Port 5005 -Name "TL-MT TP"
Probe-ZKDevice -IP "14.224.132.5" -Port 5005 -Name "TL-MT TH"
Probe-ZKDevice -IP "113.161.30.79" -Port 5006 -Name "KH-BMT VP"
