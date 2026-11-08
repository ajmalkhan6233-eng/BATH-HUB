# rbh_rename_folder.ps1 - rename the PC app folder BATHCO_TEMPLATE -> RBH_APP, safely, with automatic undo.
# Run from OUTSIDE the old folder (script moves itself to C:\). Touches only apex-server / apex-tunnel in pm2.
param([string]$Old = 'E:\AI Sttuf\BATHCO_TEMPLATE', [string]$New = 'E:\AI Sttuf\RBH_APP')
$ErrorActionPreference = 'Continue'
Set-Location 'C:\'
$res = Join-Path $env:USERPROFILE 'rbh_rename_result.txt'
function Say($t) { Add-Content -Path $res -Value ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $t); Write-Host $t }
Set-Content -Path $res -Value "RENAME RUN $(Get-Date)"
if (-not (Test-Path $Old)) { Say "STOP: $Old not found (already renamed?)"; exit 1 }
if (Test-Path $New) { Say "STOP: $New already exists"; exit 1 }
# 1. read-only scan for things that point at the old path
$hits = @()
try { $t = schtasks /query /fo LIST /v 2>$null | Select-String -SimpleMatch 'BATHCO_TEMPLATE'; if ($t) { $hits += "scheduled task text: " + (($t | Select-Object -First 3 | ForEach-Object { $_.Line.Trim() }) -join ' | ') } } catch {}
$pm = $null; try { $pm = (pm2 jlist 2>$null | Out-String) | ConvertFrom-Json } catch {}
$mine = @(); if ($pm) { $mine = @($pm | Where-Object { $_.name -in @('apex-server', 'apex-tunnel') }) ; $others = @($pm | Where-Object { $_.name -notin @('apex-server', 'apex-tunnel') -and ($_.pm2_env.pm_cwd -like "*BATHCO_TEMPLATE*" -or $_.pm2_env.pm_exec_path -like "*BATHCO_TEMPLATE*") }); foreach ($o in $others) { $hits += "other pm2 app uses old path: $($o.name)" } }
if ($hits.Count -gt 0) { $hits | ForEach-Object { Say "BLOCKED: $_" }; Say 'NEEDS CHAT: these must be fixed first. Nothing was changed.'; exit 2 }
Say ("Scan clean. pm2 apps to move: " + (($mine | ForEach-Object { $_.name }) -join ', '))
# 2. stop only our apps, rename
foreach ($n in ($mine | ForEach-Object { $_.name } | Sort-Object -Unique)) { pm2 stop $n 2>&1 | Out-Null }
Start-Sleep -Seconds 2
try { Rename-Item -Path $Old -NewName (Split-Path $New -Leaf) -ErrorAction Stop; Say "Renamed to $New" }
catch {
  Say ("FAILED rename (folder is in use): " + $_.Exception.Message)
  foreach ($n in ($mine | ForEach-Object { $_.name } | Sort-Object -Unique)) { pm2 restart $n 2>&1 | Out-Null }
  Say 'Undone: apps restarted from the old folder. Close terminals / Claude sessions that are open inside the old folder, then run again.'; exit 3
}
# 3. start our apps from the new folder
Set-Location $New
foreach ($n in ($mine | ForEach-Object { $_.name } | Sort-Object -Unique)) { pm2 delete $n 2>&1 | Out-Null; pm2 start ecosystem.config.js --only $n 2>&1 | Out-Null }
pm2 save 2>&1 | Out-Null
$ok = $false
for ($i = 0; $i -lt 10; $i++) { Start-Sleep -Seconds 2; try { if ((Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3100/health' -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {} }
Set-Location 'C:\'
if ($ok) { Say 'DONE: health 200 from the new folder. Old name gone.'; exit 0 }
# 4. undo
Say 'Health did not come back: undoing the rename'
foreach ($n in ($mine | ForEach-Object { $_.name } | Sort-Object -Unique)) { pm2 delete $n 2>&1 | Out-Null }
Rename-Item -Path $New -NewName (Split-Path $Old -Leaf)
Set-Location $Old
foreach ($n in ($mine | ForEach-Object { $_.name } | Sort-Object -Unique)) { pm2 start ecosystem.config.js --only $n 2>&1 | Out-Null }
pm2 save 2>&1 | Out-Null; Set-Location 'C:\'
Say 'UNDONE: back to the old folder name. NEEDS CHAT: send this result file.'; exit 4
