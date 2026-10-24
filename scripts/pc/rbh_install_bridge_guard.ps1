# Run ONCE (Claude Code does it). Makes the WhatsApp bridge and the shop app come back by themselves when the computer starts or you sign in.
# Adds two triggers (at start, at sign-in) to the existing 5-minute watchdog and adds a 5-minute guard for the bridge. Nothing is deleted.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$vbs = Join-Path $root 'scripts\pc\run_hidden.vbs'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
function Trigs($full) {
  $rep = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
  $lo = New-ScheduledTaskTrigger -AtLogOn; $lo.Delay = 'PT30S'
  if (-not $full) { return @($lo, $rep) }
  $st = New-ScheduledTaskTrigger -AtStartup; $st.Delay = 'PT45S'
  return @($st, $lo, $rep)
}
function Reg($name, $js, $desc) {
  $a = New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "{0}" "{1}"' -f $vbs, (Join-Path $root $js)) -WorkingDirectory $root
  try { Register-ScheduledTask -TaskName $name -Action $a -Trigger (Trigs $true) -Settings $settings -Description $desc -Force -ErrorAction Stop | Out-Null; Write-Host "OK $name (starts at computer start, at sign-in, every 5 min)"; return }
  catch { Write-Host "No admin rights for start-at-boot on $name, using sign-in plus every 5 min instead." }
  try { Register-ScheduledTask -TaskName $name -Action $a -Trigger (Trigs $false) -Settings $settings -Description $desc -Force -ErrorAction Stop | Out-Null; Write-Host "OK $name (starts at sign-in, every 5 min)" }
  catch { Write-Host "FAILED $name : $($_.Exception.Message)" }
}
Reg 'RBH_Watchdog' 'scripts\pc\rbh_watchdog.js' 'Royal Bath Hub: restarts only apex-server if it is down'
Reg 'RBH_BridgeGuard' 'scripts\pc\rbh_bridge_guard.js' 'Royal Bath Hub: starts the WhatsApp bridge if it is down (never a second copy)'
Get-ScheduledTask -TaskName 'RBH_Watchdog','RBH_BridgeGuard' -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("{0}: {1}, {2} triggers" -f $_.TaskName, $_.State, $_.Triggers.Count) }
