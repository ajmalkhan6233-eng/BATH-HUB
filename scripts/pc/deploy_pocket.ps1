# RBH Pocket one-shot deploy (Cloudflare, free). Run on the shop PC from the app folder. Secrets go ONLY to data\pocket_*.txt and .env, never to the screen or LIVE.md.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
function Rnd($n){ -join ((48..57)+(65..90)+(97..122) | Get-Random -Count $n | ForEach-Object {[char]$_}) }
# 1. login (opens the browser once; AJ clicks Allow)
$who = (npx --yes wrangler@4 whoami 2>&1 | Out-String)
if ($who -notmatch 'logged in|associated with') { npx --yes wrangler@4 login }
# 2. KV store
$kv = (npx --yes wrangler@4 kv namespace create SNAP 2>&1 | Out-String)
$m = [regex]::Match($kv, '"?id"?\s*[:=]\s*"([0-9a-f]{32})"')
if (-not $m.Success) { $ls = (npx --yes wrangler@4 kv namespace list 2>&1 | Out-String); $m = [regex]::Match($ls, '"id":\s*"([0-9a-f]{32})"[^}]*"title":\s*"[^"]*SNAP"|"title":\s*"[^"]*SNAP"[^}]*"id":\s*"([0-9a-f]{32})"') }
if (-not $m.Success) { Write-Output 'BLOCKED: could not read the KV id'; exit 1 }
$kvid = ($m.Groups | Where-Object { $_.Success -and $_.Value.Length -eq 32 } | Select-Object -First 1).Value
# 3. worker
$tmp = Join-Path $env:TEMP 'rbh-pocket-worker'; New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item cloudflare\pocket_worker.js $tmp\pocket_worker.js -Force
@"
name = "rbh-pocket"
main = "pocket_worker.js"
compatibility_date = "2025-01-01"
[[kv_namespaces]]
binding = "SNAP"
id = "$kvid"
"@ | Set-Content $tmp\wrangler.toml -Encoding ascii
$push = Rnd 40; $read = Rnd 40
Push-Location $tmp
$out = (npx --yes wrangler@4 deploy 2>&1 | Out-String)
$push | npx --yes wrangler@4 secret put PUSH_SECRET | Out-Null
$read | npx --yes wrangler@4 secret put READ_TOKEN | Out-Null
Pop-Location
$w = [regex]::Match($out, 'https://[a-z0-9.-]+\.workers\.dev').Value
if (-not $w) { Write-Output 'BLOCKED: worker URL not found'; exit 1 }
# 4. phone app shell (no shop numbers inside)
npx --yes wrangler@4 pages project create rbh-pocket-app --production-branch main 2>&1 | Out-Null
$po = (npx --yes wrangler@4 pages deploy pocket --project-name rbh-pocket-app --branch main 2>&1 | Out-String)
$p = 'https://rbh-pocket-app.pages.dev'
# 5. PC .env + private files (never printed)
$pass = Rnd 14
New-Item -ItemType Directory -Force data | Out-Null
Add-Content .env "`nPOCKET_URL=$w`nPOCKET_PUSH_SECRET=$push`nPOCKET_PASSCODE=$pass"
"$p/#t=$read&w=$w" | Set-Content data\pocket_link.txt -Encoding ascii
$pass | Set-Content data\pocket_passcode.txt -Encoding ascii
Set-Clipboard -Value "$p/#t=$read&w=$w"
pm2 restart apex-server --update-env | Out-Null
Start-Sleep 5
$h = try { (Invoke-WebRequest http://localhost:3100/health -UseBasicParsing).StatusCode } catch { 0 }
Write-Output "POCKET: worker=$w pages=$p health=$h link copied to clipboard and saved in data\pocket_link.txt, passcode in data\pocket_passcode.txt"
