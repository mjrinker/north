# Run this in Windows PowerShell AS ADMINISTRATOR after starting the dev server.
# It forwards ports 5173 and 3001 from Windows to WSL so your iPhone can reach them.

$ports = @(5173, 3001)

# Get WSL's internal IP
$wslIp = (wsl -- hostname -I).Trim()
if (-not $wslIp) {
    Write-Host "Could not detect WSL IP. Is WSL running?" -ForegroundColor Red
    exit 1
}

Write-Host "WSL IP: $wslIp" -ForegroundColor Cyan

# Remove any existing proxies for these ports (cleanup from previous runs)
$existingProxies = netsh interface portproxy show all
foreach ($port in $ports) {
    $existingProxies | Select-String "\s+(\S+)\s+$port\s+\S+\s+\d+" | ForEach-Object {
        $listenAddr = $_.Matches.Groups[1].Value
        netsh interface portproxy delete v4tov4 listenport=$port listenaddress=$listenAddr 2>$null
        Write-Host "Removed old proxy: $listenAddr`:$port" -ForegroundColor DarkYellow
    }
}

# Add port proxies
foreach ($port in $ports) {
    netsh interface portproxy add v4tov4 `
        listenport=$port listenaddress=0.0.0.0 `
        connectport=$port connectaddress=$wslIp
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Port $port -> $wslIp`:$port" -ForegroundColor Green
    } else {
        Write-Host "Failed to add proxy for port $port (run as Administrator?)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "iPhone should now reach the app at http://YOUR_WINDOWS_IP:5173" -ForegroundColor Yellow
Write-Host "Find your Windows IP with: ipconfig" -ForegroundColor Yellow

# Show current proxies
Write-Host ""
Write-Host "Active proxies:" -ForegroundColor Cyan
netsh interface portproxy show all
