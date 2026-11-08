# rbh_pc_fix.ps1 - READ-ONLY PC health check + update. No AI, no installs, no restarts, no deletes.
# Run from inside the repo: powershell -ExecutionPolicy Bypass -File scripts\pc\rbh_pc_fix.ps1
$ErrorActionPreference = 'Continue'
$root = (git rev-parse --show-toplevel 2>$null); if (-not $root) { Write-Host 'Run this inside the repo folder'; exit 1 }
Set-Location $root
git pull origin work 2>&1 | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out = Join-Path $root "AI_MEMORY\PC_HEALTH_$stamp.txt"
$L = New-Object System.Collections.Generic.List[string]
function Add($t) { $L.Add([string]$t) }
Add "PC HEALTH $stamp (read only)"
$os = Get-CimInstance Win32_OperatingSystem
Add ("Last boot: {0} | Uptime h: {1}" -f $os.LastBootUpTime, [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1))
Add ("RAM free MB: {0} of {1}" -f [math]::Round($os.FreePhysicalMemory / 1024), [math]::Round($os.TotalVisibleMemorySize / 1024))
Add ("C: free GB: {0}" -f [math]::Round((Get-PSDrive C).Free / 1GB, 1))
Add '--- Temperature (may be unreadable on this board)'
try { Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object { Add ("Thermal zone C: {0}" -f [math]::Round(($_.CurrentTemperature / 10) - 273.15, 1)) } } catch { Add 'Temperature: not readable by Windows (use HWMonitor/BIOS)' }
Add '--- Power plan'
Add ((powercfg /getactivescheme) -join ' ')
Add '--- Disks'
Get-PhysicalDisk | ForEach-Object { Add ("{0} | health {1} | {2}" -f $_.FriendlyName, $_.HealthStatus, $_.OperationalStatus) }
Add '--- Graphics'
Get-CimInstance Win32_VideoController | ForEach-Object { Add ("{0} | driver {1} | {2}" -f $_.Name, $_.DriverVersion, $_.DriverDate) }
Add '--- Top 8 by RAM (MB)'
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 | ForEach-Object { Add ("{0} {1}" -f $_.ProcessName, [math]::Round($_.WorkingSet64 / 1MB)) }
Add ("Chrome processes: {0}" -f @(Get-Process chrome -ErrorAction SilentlyContinue).Count)
Add '--- Sudden power-offs (Kernel-Power 41), newest 12'
try { Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'; Id = 41 } -MaxEvents 12 -ErrorAction Stop | ForEach-Object { Add ("{0} | BugcheckCode {1}" -f $_.TimeCreated, $_.Properties[0].Value) } } catch { Add 'none or unreadable' }
Add '--- Blue-screen records (BugCheck 1001), newest 5'
try { Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WER-SystemErrorReporting'; Id = 1001 } -MaxEvents 5 -ErrorAction Stop | ForEach-Object { Add ("{0} | {1}" -f $_.TimeCreated, ($_.Message -split "`n")[0]) } } catch { Add 'none' }
Add '--- Hardware errors (WHEA), newest 5'
try { Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WHEA-Logger' } -MaxEvents 5 -ErrorAction Stop | ForEach-Object { Add ("{0} | id {1}" -f $_.TimeCreated, $_.Id) } } catch { Add 'none' }
Add '--- Memory test result (if ever run)'
try { Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-MemoryDiagnostics-Results' } -MaxEvents 2 -ErrorAction Stop | ForEach-Object { Add ("{0} | {1}" -f $_.TimeCreated, ($_.Message -split "`n")[0]) } } catch { Add 'never run' }
$L | Set-Content -Path $out -Encoding UTF8
$kp = ($L | Where-Object { $_ -match 'BugcheckCode' }).Count
$live = Join-Path $root 'AI_MEMORY\LIVE.md'
$line = ("{0} | PC | rbh_pc_fix | DONE | report AI_MEMORY/PC_HEALTH_{1}.txt, power-offs listed: {2}, gentle-mode UI pulled | AJ: nothing" -f (Get-Date -Format 'HH:mm'), $stamp, $kp)
$old = if (Test-Path $live) { Get-Content $live -Raw } else { '' }
Set-Content -Path $live -Value ($line + "`r`n" + $old) -Encoding UTF8
git add $out $live 2>&1 | Out-Null
git commit -m "PC health report $stamp (read only)" 2>&1 | Out-Null
git push origin work 2>&1 | Select-Object -Last 2
Write-Host "DONE. Report: AI_MEMORY\PC_HEALTH_$stamp.txt"
