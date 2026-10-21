# START ROYAL BATH HUB (the desktop shortcut runs this). Safe any time: if the shop app is already running it only opens it.
# If it is down it finds out why, restarts ONLY pm2 apex-server, writes the reason to logs\watchdog.log, then opens the app.
param([switch]$NoBrowser)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$port = if ($env:RBH_PORT) { $env:RBH_PORT } else { 3100 }
$url = "http://127.0.0.1:$port"
function Test-Up { try { return ((Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) } catch { return $false } }
if (-not (Test-Up)) {
    Write-Host 'Starting Royal Bath Hub ...'
    Push-Location $root
    $env:RBH_MANUAL = '1'
    node (Join-Path $root 'scripts\pc\rbh_watchdog.js')
    Pop-Location
}
if (Test-Up) {
    Write-Host 'Royal Bath Hub is UP.'
    if (-not $NoBrowser) { Start-Process "$url/owner" }
} else {
    Write-Host 'Still down. The reason is in logs\watchdog.log (tell Claude: read the watchdog log).'
    exit 2
}
