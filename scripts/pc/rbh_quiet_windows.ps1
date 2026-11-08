# rbh_quiet_windows.ps1 - lists what opens at start-up and MINIMIZES (never kills) black node/pm2 windows.
# Run once:      powershell -ExecutionPolicy Bypass -File rbh_quiet_windows.ps1
# Keep it quiet: add -Install (per-user logon task, runs hidden for 4 minutes after sign-in). Undo: schtasks /delete /tn RBH-QuietWindows /f
param([switch]$Install, [switch]$Loop)
$res = Join-Path $env:USERPROFILE 'rbh_quiet_result.txt'
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public class RbhWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
function Quiet() {
  $done = New-Object System.Collections.Generic.List[string]
  $cb = [RbhWin+EnumProc] { param($h, $l)
    if ([RbhWin]::IsWindowVisible($h) -and -not [RbhWin]::IsIconic($h)) {
      $sb = New-Object System.Text.StringBuilder 300; [void][RbhWin]::GetWindowText($h, $sb, 300); $t = $sb.ToString()
      if ($t -match '(?i)nodejs\\node|node\.exe|^pm2|apex-|bathco|rbh-server') { [void][RbhWin]::ShowWindow($h, 6); $done.Add($t) }
    }
    return $true }
  [void][RbhWin]::EnumWindows($cb, [IntPtr]::Zero)
  return $done
}
if ($Loop) { for ($i = 0; $i -lt 24; $i++) { [void](Quiet); Start-Sleep -Seconds 10 }; exit 0 }
$L = New-Object System.Collections.Generic.List[string]
function Red($s) { return (($s -replace '(?i)(key|token|pass(word)?|secret)=\S+', '$1=***') -replace '\s+', ' ') }
$L.Add("QUIET WINDOWS REPORT $(Get-Date)")
$L.Add('--- Start-up programs (Run keys)')
foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run') { try { $p = Get-ItemProperty $k -ErrorAction Stop; $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $L.Add(("{0} | {1}" -f $_.Name, (Red ([string]$_.Value)))) } } catch {} }
$L.Add('--- Start-up folder')
foreach ($f in "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp") { Get-ChildItem $f -ErrorAction SilentlyContinue | ForEach-Object { $L.Add($_.FullName) } }
$L.Add('--- Scheduled tasks that run at sign-in/boot and use node, pm2, cmd or powershell')
try { Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.State -ne 'Disabled' -and ($_.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon|Boot' }) } | ForEach-Object { $a = ($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' ; '; if ($a -match '(?i)node|pm2|cmd|powershell|\.bat|\.vbs') { $L.Add(("{0} | {1}" -f $_.TaskName, (Red $a))) } } } catch { $L.Add('unreadable') }
$L.Add('--- node processes')
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { $c = Red ([string]$_.CommandLine); if ($c.Length -gt 140) { $c = $c.Substring(0, 140) }; $L.Add(("{0} | {1}" -f $_.ProcessId, $c)) }
$m = Quiet
$L.Add('--- Windows minimized now (not closed)')
if ($m.Count -eq 0) { $L.Add('none visible') } else { $m | ForEach-Object { $L.Add($_) } }
if ($Install) {
  $dst = Join-Path $env:USERPROFILE 'rbh_quiet_windows.ps1'; Copy-Item $PSCommandPath $dst -Force
  schtasks /create /tn RBH-QuietWindows /tr "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$dst`" -Loop" /sc onlogon /delay 0000:45 /f 2>&1 | ForEach-Object { $L.Add("install: $_") }
}
$L | Set-Content -Path $res -Encoding UTF8
Write-Host "DONE. Result: $res"
