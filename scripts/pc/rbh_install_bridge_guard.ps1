# Run ONCE (Claude Code does it). Makes the WhatsApp bridge and the shop app come back by themselves when the computer starts or you sign in.
# Adds two triggers (at start, at sign-in) to the existing 5-minute watchdog and adds a 5-minute guard for the bridge. Nothing is deleted.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$vbs = Join-Path $root 'scripts\pc\run_hidden.vbs'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
$triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn), (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)))
$triggers[0].Delay = 'PT45S'; $triggers[1].Delay = 'PT30S'
function Reg($name, $js, $desc) {
  $a = New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "{0}" "{1}"' -f $vbs, (Join-Path $root $js)) -WorkingDirectory $root
  Register-ScheduledTask -TaskName $name -Action $a -Trigger $triggers -Settings $settings -Description $desc -Force | Out-Null
  Write-Host "OK $name"
}
Reg 'RBH_Watchdog' 'scripts\pc\rbh_watchdog.js' 'Royal Bath Hub: at start, at sign-in and every 5 minutes, restarts only apex-server if it is down'
Reg 'RBH_BridgeGuard' 'scripts\pc\rbh_bridge_guard.js' 'Royal Bath Hub: at start, at sign-in and every 5 minutes, starts the WhatsApp bridge if it is down (never a second copy)'
