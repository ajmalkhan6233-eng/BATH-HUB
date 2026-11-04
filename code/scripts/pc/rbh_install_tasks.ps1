# ONE-TIME SETUP (no admin needed). Schedules the plain-code watchdog (every 5 minutes) and the daily log tidy (03:30),
# and puts a "Start Royal Bath Hub" shortcut on the desktop. Safe to run again (it replaces its own tasks).
# -NoSleep also stops the PC sleeping while plugged in (a sleeping PC is a stopped server).
param([switch]$NoSleep)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$vbs = Join-Path $root 'scripts\pc\run_hidden.vbs'
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
Unregister-ScheduledTask -TaskName 'Apex_Server_Watchdog' -Confirm:$false -ErrorAction SilentlyContinue   # the old name, never scheduled; avoids two watchdogs

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
$a1 = New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "{0}" "{1}"' -f $vbs, (Join-Path $root 'scripts\pc\rbh_watchdog.js')) -WorkingDirectory $root
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'RBH_Watchdog' -Action $a1 -Trigger $t1 -Settings $settings -Description 'Royal Bath Hub: checks the shop app every 5 minutes, restarts only apex-server if it is down, writes the reason to logs\watchdog.log' -Force | Out-Null

$a2 = New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "{0}" "{1}"' -f $vbs, (Join-Path $root 'scripts\pc\rbh_logrotate.js')) -WorkingDirectory $root
$t2 = New-ScheduledTaskTrigger -Daily -At '03:30'
Register-ScheduledTask -TaskName 'RBH_LogTidy' -Action $a2 -Trigger $t2 -Settings $settings -Description 'Royal Bath Hub: keeps the apex-server logs small' -Force | Out-Null

# bridge watcher: every 15 min, plain code; starts Claude Code only when AJ has "played" a task (so a phone "play" is enough)
$settings3 = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$a3 = New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "{0}" "{1}"' -f $vbs, (Join-Path $root 'scripts\pc\bridge_watcher.js')) -WorkingDirectory $root
$t3 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'RBH_BridgeWatcher' -Action $a3 -Trigger $t3 -Settings $settings3 -Description 'Royal Bath Hub: every 15 min checks the bridge; starts Claude Code only when a task is PLAYED (max 3 starts a day)' -Force | Out-Null

# desktop shortcut
$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Start Royal Bath Hub.lnk'
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $PSHOME 'powershell.exe'
$lnk.Arguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $root 'scripts\pc\rbh_start.ps1'))
$lnk.WorkingDirectory = $root
$lnk.Description = 'Start Royal Bath Hub (starts the shop app if it is down, then opens it)'
$lnk.Save()

if ($NoSleep) { powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0 }   # plugged in: never sleep

Get-ScheduledTask -TaskName 'RBH_Watchdog', 'RBH_LogTidy', 'RBH_BridgeWatcher' | ForEach-Object { '{0}: {1}' -f $_.TaskName, $_.State }
"Shortcut: $lnkPath"
