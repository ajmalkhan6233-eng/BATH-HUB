# RBH computer health check. READ-ONLY: only Get-* commands. Changes nothing, kills nothing, deletes nothing.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pc\rbh_health_check.ps1
$ErrorActionPreference = 'SilentlyContinue'
function MB($b){ [math]::Round($b/1MB) }
function SizeMB($p){ if(Test-Path $p){ $s=(Get-ChildItem $p -Recurse -Force -File | Measure-Object Length -Sum).Sum; MB $s } else { 'n/a' } }

Write-Output "=== RAM / CPU ==="
$os = Get-CimInstance Win32_OperatingSystem
$tot = [math]::Round($os.TotalVisibleMemorySize/1MB,1); $free = [math]::Round($os.FreePhysicalMemory/1MB,1)
Write-Output ("RAM: {0} GB total, {1} GB free, {2}% used" -f $tot,$free,[math]::Round(100*($tot-$free)/$tot))
Write-Output ("CPU load now: {0}%" -f (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average)

Write-Output "`n=== TOP 10 BY RAM ==="
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name,Id,@{n='RAM_MB';e={MB $_.WorkingSet64}},@{n='CPU_s';e={[math]::Round($_.CPU)}} | Format-Table -AutoSize | Out-String | Write-Output

Write-Output "=== PROCESS COUNTS ==="
$all = Get-Process
$node = @($all | Where-Object Name -eq 'node').Count
$pm2  = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'pm2' }).Count
$emu  = @($all | Where-Object { $_.Name -match '^(qemu-system|emulator|adb|studio64|HAXM|crosvm|BlueStacks|HD-Player|Genymotion)' }).Count
$brw  = @($all | Where-Object { $_.Name -match '^(chrome|msedge|firefox|brave|opera)$' }).Count
Write-Output "node: $node | pm2-related node: $pm2 | emulator/adb/android-studio: $emu | browser: $brw"

Write-Output "`n=== FREE DISK ==="
Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { "{0}: {1} GB free of {2} GB" -f $_.Name,[math]::Round($_.Free/1GB,1),[math]::Round(($_.Used+$_.Free)/1GB,1) }

Write-Output "`n=== STARTUP PROGRAMS ==="
Get-CimInstance Win32_StartupCommand | Select-Object Name,Location | Format-Table -AutoSize | Out-String | Write-Output

Write-Output "=== TEMP / CACHE SIZES (MB) ==="
Write-Output ("User temp ({0}): {1}" -f $env:TEMP,(SizeMB $env:TEMP))
Write-Output ("Windows temp: {0}" -f (SizeMB 'C:\Windows\Temp'))
$npm = (& npm config get cache 2>$null); if(-not $npm){ $npm = "$env:LOCALAPPDATA\npm-cache" }
Write-Output ("npm cache ({0}): {1}" -f $npm,(SizeMB $npm))
Write-Output ("Chrome cache: {0}" -f (SizeMB "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"))
Write-Output ("Edge cache: {0}" -f (SizeMB "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"))
Write-Output ("Gradle cache: {0}" -f (SizeMB "$env:USERPROFILE\.gradle\caches"))
Write-Output ("Pub cache (Flutter): {0}" -f (SizeMB "$env:LOCALAPPDATA\Pub\Cache"))

Write-Output "`n=== PROJECT BUILD FOLDERS (MB) ==="
$roots = @('E:\AI Sttuf\BATHCO_TEMPLATE','C:\Users\Sony\Documents\noor_app','C:\Users\Sony\ai-bridge')
foreach($r in $roots){ foreach($d in 'node_modules','build','dist','.dart_tool','android\.gradle','.next'){ $p = Join-Path $r $d; if(Test-Path $p){ Write-Output ("{0}: {1}" -f $p,(SizeMB $p)) } } }

Write-Output "`n=== TEMPERATURE ==="
$t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature
if($t){ $t | ForEach-Object { "{0} C" -f [math]::Round(($_.CurrentTemperature/10)-273.15,1) } } else { "CPU/GPU temperature: not readable here (Windows does not expose it on many PCs)" }
Write-Output "`nDONE. Nothing was changed."
