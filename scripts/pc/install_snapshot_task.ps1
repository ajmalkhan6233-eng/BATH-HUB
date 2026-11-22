# Registers the Windows scheduled task RBH_Snapshot: every 5 minutes, hidden, runs node scripts\pc\shop_snapshot.js (read-only). Remove with: Unregister-ScheduledTask RBH_Snapshot -Confirm:$false
$app = 'E:\AI Sttuf\BATHCO_TEMPLATE'
$cmd = "Set-Location '$app'; node scripts\pc\shop_snapshot.js"
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$cmd`""
$trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'RBH_Snapshot' -Action $act -Trigger $trg -Settings $set -Description 'RBH shop snapshot for Claude chat (read only)' -Force | Out-Null
Get-ScheduledTask -TaskName 'RBH_Snapshot' | Select-Object TaskName, State | Format-List
