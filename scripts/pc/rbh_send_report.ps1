# rbh_send_report.ps1 - copy report files into the PRIVATE rbh-data repo (pc_reports\) and push, so chat can read them.
# Usage: powershell -ExecutionPolicy Bypass -File rbh_send_report.ps1 file1 file2 ...
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Files)
$repo = 'E:\rbh-data'
if (-not (Test-Path (Join-Path $repo '.git'))) { Write-Host "NEEDS CHAT: $repo is not a git repo"; exit 1 }
Set-Location $repo
git pull --rebase -q origin 2>&1 | Out-Null
$d = Join-Path $repo 'pc_reports'; New-Item -ItemType Directory -Force -Path $d | Out-Null
foreach ($f in $Files) { if (Test-Path $f) { Copy-Item $f (Join-Path $d (Split-Path $f -Leaf)) -Force; Write-Host "sent $f" } else { Write-Host "missing $f" } }
git add pc_reports 2>&1 | Out-Null
git commit -q -m ("PC reports " + (Get-Date -Format 'yyyyMMdd_HHmm')) 2>&1 | Out-Null
git push -q origin HEAD 2>&1 | Select-Object -Last 2
Write-Host 'DONE: reports pushed to private rbh-data/pc_reports'
