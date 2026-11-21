# ROYAL BATH HUB: ONE start script (21 Nov 2026, AJ startup audit). Runs at Windows logon (Startup folder) and from the desktop shortcut.
# 1. waits for pm2 (its own resurrect starts it at logon), 2. runs the watchdog once (starts the app if down, removes a duplicate
# apex-server, restarts by id), 3. checks: exactly ONE apex-server, /health 200, build = the service worker VERSION on disk,
# 4. opens exactly ONE Chrome window at /owner. Writes one line per run to logs\boot.log. Touches no data.
param([switch]$NoBrowser)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$port = if ($env:RBH_PORT) { $env:RBH_PORT } else { 3100 }
$url = "http://127.0.0.1:$port"
$log = Join-Path $root 'logs\boot.log'
function Say($t) { New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null; Add-Content -Path $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm') + ' | ' + $t) }
function Health { try { return (Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 4 -Headers @{ 'Cache-Control' = 'no-store' }).Content | ConvertFrom-Json } catch { return $null } }
# pm2 jlist holds env keys that differ only by case (Path/PATH), which Windows PowerShell's JSON reader refuses: count with node instead
function Apex { try { $o = (pm2 jlist 2>$null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s.slice(s.indexOf('[')));const m=a.filter(p=>p.name==='apex-server');console.log(m.length+' '+m.filter(p=>p.pm2_env.status==='online').length)}catch(e){console.log('x')}})" | Out-String).Trim(); if ($o -notmatch '^\d+ \d+$') { return $null }; $p = $o -split ' '; return @{ n = [int]$p[0]; on = [int]$p[1] } } catch { return $null } }

# 1. wait up to 90 s for pm2 to answer
$t = 0; while ($t -lt 90 -and $null -eq (Apex)) { Start-Sleep 5; $t += 5 }
# 2. watchdog once (it starts / restarts / removes a duplicate, and logs why in logs\watchdog.log)
Push-Location $root; try { node (Join-Path $root 'scripts\pc\rbh_watchdog.js') | Out-Null } catch {} ; Pop-Location
# 3. checks
$h = $null; $t = 0; while ($t -lt 60 -and $null -eq $h) { $h = Health; if ($null -eq $h) { Start-Sleep 3; $t += 3 } }
$apps = Apex; $n = if ($apps) { $apps.n } else { 0 }; $on = if ($apps) { $apps.on } else { 0 }
$disk = ''; try { $m = [regex]::Match((Get-Content (Join-Path $root 'public\service-worker.js') -Raw), "const VERSION = '([^']+)'"); if ($m.Success) { $disk = $m.Groups[1].Value } } catch {}
$build = if ($h) { $h.build } else { '' }
$ok = ($null -ne $h) -and ($n -eq 1) -and ($build -eq $disk)
Say ("{0} | apex-server in pm2: {1} ({2} online) | health {3} | build {4} (on disk {5})" -f ($(if ($ok) { 'OK' } else { 'CHECK' }), $n, $on, $(if ($h) { 200 } else { 'no answer' }), $(if ($build) { $build } else { '?' }), $disk))
# 4. one window
if (-not $NoBrowser -and $h) {
    $ch = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($ch) { Start-Process $ch -ArgumentList '--new-window', "http://localhost:$port/owner" }
}
if (-not $ok) { exit 2 }
