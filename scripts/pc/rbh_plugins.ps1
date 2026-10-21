# Adds the helper packs Aj asked for (05:22). Safe to run again. UNVERIFIED: the "claude plugin ..." command names are from the
# published docs and were not run in the cloud; if one fails, the others still run and the failure is printed.
# Ponytail is installed as a SKILL ONLY (its writing guide). Its automatic hooks are NOT installed: the page does not say what they run.
$ErrorActionPreference = 'Continue'
function Run($label, [scriptblock]$cmd) { Write-Host "== $label"; try { & $cmd; if ($LASTEXITCODE -ne 0) { Write-Host "   FAILED ($LASTEXITCODE)" } } catch { Write-Host "   FAILED: $($_.Exception.Message)" } }
Run 'Anthropic skills marketplace' { claude plugin marketplace add anthropics/skills }
Run 'Document skills (Word, PDF, Excel, PowerPoint)' { claude plugin install document-skills@anthropic-agent-skills }
Run 'Example skills (frontend design, web app testing)' { claude plugin install example-skills@anthropic-agent-skills }
Run 'Superpowers marketplace' { claude plugin marketplace add obra/superpowers-marketplace }
Run 'Superpowers' { claude plugin install superpowers@superpowers-marketplace }
Run 'Karpathy rules marketplace' { claude plugin marketplace add forrestchang/andrej-karpathy-skills }
Run 'Karpathy rules' { claude plugin install andrej-karpathy-skills@karpathy-skills }
Write-Host '== Ponytail (skill only)'
$tmp = Join-Path $env:TEMP ('ponytail-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
git clone --depth 1 https://github.com/DietrichGebert/ponytail $tmp 2>&1 | Out-Null
$src = Join-Path $tmp 'skills\ponytail'
if (Test-Path (Join-Path $src 'SKILL.md')) {
    $dst = Join-Path $HOME '.claude\skills\ponytail'
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item (Join-Path $src 'SKILL.md') $dst -Force
    Write-Host "   installed: $dst\SKILL.md (SKILL.md only, no hooks)"
} else { Write-Host '   FAILED: skills\ponytail\SKILL.md not found in the download' }
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Done. Start a NEW Claude Code session so the new skills load.'
