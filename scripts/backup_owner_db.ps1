# Daily backup of bathco_owner using PostgreSQL 18 pg_dump. Keeps the newest 14 locally. Reads the DB password from the gitignored .env.
# Tracked copy of local_ops\backup_owner_db.ps1 plus an ENCRYPTED off-machine copy (scripts\backup_encrypt.js): needs BACKUP_COPY_DIR and
# BACKUP_PASSPHRASE in .env. If either is missing, nothing is copied and a warning is printed. Works from scripts\ or local_ops\.
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$pw = ((Get-Content $envFile | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=','').Trim()
$env:PGPASSWORD = $pw
$out = Join-Path $root ("backups\bathco_owner-" + (Get-Date -Format 'yyyy-MM-dd_HHmm') + ".sql")
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h 127.0.0.1 -p 5432 -U bathco_owner_user -d bathco_owner -f $out
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out) -or (Get-Item $out).Length -lt 1000) { Remove-Item $out -ErrorAction SilentlyContinue; Write-Error 'backup failed'; exit 1 }
Get-ChildItem (Join-Path $root 'backups') -Filter 'bathco_owner-*.sql' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force

# Encrypted off-machine copy. A failed copy exits 2 but never removes the local backup. The passphrase is read by node from .env and never printed.
Push-Location $root
try { node (Join-Path $root 'scripts\backup_encrypt.js') $out; $code = $LASTEXITCODE } finally { Pop-Location }
if ($code -ne 0) { exit 2 }
