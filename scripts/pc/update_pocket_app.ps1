# RBH Pocket: update ONLY the app files (look, menu). Keeps the same link, passcode and secrets, so AJ's phone stays paired.
# Run on the shop PC from the app folder. Nothing secret is printed.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$ErrorActionPreference = 'Continue'
$ls = (npx --yes wrangler@4 kv namespace list 2>&1 | Out-String)
$m = [regex]::Match($ls, '"id":\s*"([0-9a-f]{32})"[^}]*"title":\s*"[^"]*SNAP"|"title":\s*"[^"]*SNAP"[^}]*"id":\s*"([0-9a-f]{32})"')
$ErrorActionPreference = 'Stop'
if (-not $m.Success) { Write-Output 'BLOCKED: could not read the KV id'; exit 1 }
$kvid = ($m.Groups | Where-Object { $_.Success -and $_.Value.Length -eq 32 } | Select-Object -First 1).Value
$tmp = Join-Path $env:TEMP 'rbh-pocket-worker'; New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item cloudflare\pocket_worker.js $tmp\pocket_worker.js -Force
Remove-Item $tmp\public -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item pocket $tmp\public -Recurse -Force
Remove-Item $tmp\public\*.md -Force -ErrorAction SilentlyContinue
@"
name = "rbh-pocket"
main = "pocket_worker.js"
compatibility_date = "2025-01-01"
[assets]
directory = "./public"
[[kv_namespaces]]
binding = "SNAP"
id = "$kvid"
"@ | Set-Content $tmp\wrangler.toml -Encoding ascii
Push-Location $tmp
$out = (npx --yes wrangler@4 deploy 2>&1 | Out-String)
Pop-Location
$w = [regex]::Match($out, 'https://[a-z0-9.-]+\.workers\.dev').Value
if (-not $w) { Write-Output 'BLOCKED: worker URL not found'; exit 1 }
$h = try { (Invoke-WebRequest -UseBasicParsing "$w/" -TimeoutSec 20).StatusCode } catch { 'fail' }
Write-Output "POCKET APP UPDATED: worker=$w page=$h (same link and passcode, secrets untouched)"
