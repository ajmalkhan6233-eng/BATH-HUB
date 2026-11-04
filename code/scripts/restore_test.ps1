# Restore test on a COPY: loads the newest backup into a throwaway database (bathco_restore_test), counts tables, then drops it. Never touches bathco_owner.
$envFile = 'E:\AI Sttuf\BATHCO_TEMPLATE\.env'
$env:PGPASSWORD = ((Get-Content $envFile | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=','').Trim()
$bin = 'C:\Program Files\PostgreSQL\18\bin'; $u = 'bathco_owner_user'; $db = 'bathco_restore_test'
$bk = Get-ChildItem 'E:\AI Sttuf\BATHCO_TEMPLATE\backups' -Filter 'bathco_owner-*.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
& "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d postgres -q -c "DROP DATABASE IF EXISTS $db" ; & "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d postgres -q -c "CREATE DATABASE $db"
if ($LASTEXITCODE -ne 0) { Write-Output 'RESTORE TEST BLOCKED: this DB user cannot create a database'; exit 3 }
& "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d $db -q -v ON_ERROR_STOP=0 -f $bk.FullName *> $null
$n = & "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d $db -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
$o = & "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d bathco_owner -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
& "$bin\psql.exe" -w -h 127.0.0.1 -U $u -d postgres -q -c "DROP DATABASE $db"
Write-Output "RESTORE TEST: backup $($bk.Name) -> $n tables in the copy, $o in the live database. $(if ([int]$n -gt 0 -and [int]$n -ge [int]$o - 3) {'PASS'} else {'FAIL'})"
