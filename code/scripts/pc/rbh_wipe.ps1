# FRESH START (Aj's order 2026-10-21). Makes a backup, copies it to E:, then clears the opening/test records. See utils\freshStart.js.
# Without -Execute it is a REHEARSAL: backup is skipped and nothing is changed, it only shows what would be cleared.
#   scripts\pc\rbh_wipe.ps1                      rehearsal
#   scripts\pc\rbh_wipe.ps1 -Execute             backup, then clear the JUNK only (-Scope clean, the default)
#   scripts\pc\rbh_wipe.ps1 -Execute -Scope all  ALSO clears customers, bills, cheques, GRNs, stock (only on Aj's word 'play 78')
#   scripts\pc\rbh_wipe.ps1 -Execute -Also daily,expenses     also clear the daily figures and expenses
param([switch]$Execute, [string]$Also = '', [ValidateSet('clean','all')][string]$Scope = 'clean')
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root
try {
    $alsoArg = @(); if ($Also) { $alsoArg = @("--also=$Also") }
    $alsoArg += "--scope=$Scope"
    $alsoArg += "--db=bathco_owner"   # refuses if the connection is to any other database
    if (-not $Execute) { node scripts\wipe_fresh_start.js @alsoArg; exit $LASTEXITCODE }

    # the backup script covers the database bathco_owner only, so the wipe must be aimed at that same database
    $dbName = ((Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^DB_NAME=' }) -replace '^DB_NAME=', '').Trim()
    if ($dbName -ne 'bathco_owner') { Write-Host "STOPPED: .env DB_NAME is '$dbName' but the backup script covers bathco_owner. Nothing changed."; exit 1 }

    # 1 backup (the same dump the nightly task makes). Exit 2 only means the encrypted off-machine copy is not set up; the local file is still good.
    & (Join-Path $root 'scripts\backup_owner_db.ps1')
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) { Write-Host 'STOPPED: backup failed. Nothing changed.'; exit 1 }
    $bk = Get-ChildItem (Join-Path $root 'backups') -Filter 'bathco_owner-*.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $bk -or $bk.Length -lt 1000 -or $bk.LastWriteTime -lt (Get-Date).AddMinutes(-15)) { Write-Host 'STOPPED: no fresh backup file found. Nothing changed.'; exit 1 }

    # 2 a second copy on E: (or inside the project if there is no E:), size checked
    $dest = if (Test-Path 'E:\') { 'E:\RBH_BACKUPS\pre_wipe' } else { Join-Path $root 'backups\pre_wipe' }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item $bk.FullName $dest -Force
    $copy = Join-Path $dest $bk.Name
    if (-not (Test-Path $copy) -or (Get-Item $copy).Length -ne $bk.Length) { Write-Host 'STOPPED: the second backup copy did not match. Nothing changed.'; exit 1 }
    Write-Host ('Backup OK: {0} KB, copy in {1}' -f [math]::Round($bk.Length / 1KB), $dest)

    # 3 clear
    node scripts\wipe_fresh_start.js --yes ("--backup=" + $bk.FullName) @alsoArg
    $code = $LASTEXITCODE
    if ($code -ne 0) { Write-Host "Wipe command stopped with code $code (see above)."; exit $code }

    # 4 restart ONLY the shop app so it starts with empty screens, then check it
    pm2 restart apex-server | Out-Null
    Start-Sleep -Seconds 8
    $port = if ($env:RBH_PORT) { $env:RBH_PORT } else { 3100 }
    try { $h = (Invoke-WebRequest "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 6).StatusCode } catch { $h = 0 }
    Write-Host "Shop app health after restart: $h"
    if ($h -ne 200) { exit 2 }
} finally { Pop-Location }
