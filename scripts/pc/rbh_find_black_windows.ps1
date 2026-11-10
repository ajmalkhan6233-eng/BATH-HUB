# rbh_find_black_windows.ps1 - READ ONLY. Finds who opens the black node windows (3 to 5 a day).
# For every node.exe it writes: start time, the program that started it (parent chain) and its command line (secrets hidden).
# Also lists scheduled tasks / start-up items that run node, cmd or claude straight (not through run_hidden.vbs) or from .claude\worktrees.
# Run: powershell -ExecutionPolicy Bypass -File scripts\pc\rbh_find_black_windows.ps1   -> result file %USERPROFILE%\rbh_black_windows.txt (then rbh_send_report.ps1 sends it)
$res = Join-Path $env:USERPROFILE 'rbh_black_windows.txt'
$L = New-Object System.Collections.Generic.List[string]
function Red($s) { return (($s -replace '(?i)(key|token|pass(word)?|secret)(=|\s)\S+', '$1=***') -replace '\s+', ' ') }
function Cut($s, $n) { $s = Red ([string]$s); if ($s.Length -gt $n) { return $s.Substring(0, $n) } else { return $s } }
$all = @{}; Get-CimInstance Win32_Process | ForEach-Object { $all[[int]$_.ProcessId] = $_ }
function Chain($p) {
  $out = @(); $cur = $p; $n = 0
  while ($cur -and $n -lt 5) { $pp = $all[[int]$cur.ParentProcessId]; if (-not $pp) { break }; $out += ('{0}({1}): {2}' -f $pp.Name, $pp.ProcessId, (Cut $pp.CommandLine 110)); $cur = $pp; $n++ }
  return $out
}
$L.Add("BLACK WINDOWS REPORT $(Get-Date)")
$L.Add('--- node.exe now (newest first)')
$nodes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Sort-Object CreationDate -Descending
if (-not $nodes) { $L.Add('no node.exe running') }
foreach ($p in $nodes) {
  $L.Add(('NODE pid {0} started {1} | {2}' -f $p.ProcessId, $p.CreationDate, (Cut $p.CommandLine 170)))
  $L.Add(('   cwd/script hint: {0}' -f $(if ($p.CommandLine -match 'worktrees') { 'RUNS FROM A CLAUDE CODE WORKTREE' } else { 'normal folder' })))
  Chain $p | ForEach-Object { $L.Add('   started by ' + $_) }
}
$L.Add('--- other console programs with a window: cmd, claude, pm2, WindowsTerminal')
Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(cmd|claude|pm2|WindowsTerminal|wt|OpenConsole)\.exe$' } | Sort-Object CreationDate -Descending | Select-Object -First 25 | ForEach-Object {
  $L.Add(('{0} pid {1} started {2} | {3}' -f $_.Name, $_.ProcessId, $_.CreationDate, (Cut $_.CommandLine 150))) }
$L.Add('--- scheduled tasks that start node/cmd/claude/powershell directly (not through wscript run_hidden.vbs)')
try {
  Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.State -ne 'Disabled' } | ForEach-Object {
    $t = $_; foreach ($a in $t.Actions) {
      $line = ('{0} {1}' -f $a.Execute, $a.Arguments)
      if ($line -match '(?i)node|cmd|claude|powershell|pm2|worktrees' -and $line -notmatch '(?i)run_hidden\.vbs|wscript') { $L.Add(('TASK {0} -> {1} (folder {2})' -f $t.TaskName, (Cut $line 170), $a.WorkingDirectory)) }
    } }
} catch { $L.Add('could not read scheduled tasks: ' + $_.Exception.Message) }
$L.Add('--- start-up items')
foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run') { try { $p = Get-ItemProperty $k -ErrorAction Stop; $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $L.Add(('RUN {0} = {1}' -f $_.Name, (Cut $_.Value 150))) } } catch {} }
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" -ErrorAction SilentlyContinue | ForEach-Object { $L.Add('STARTUP FOLDER ' + $_.Name) }
$L.Add('--- git worktrees of the shop folder')
try { git -C 'E:\AI Sttuf\BATHCO_TEMPLATE' worktree list 2>&1 | ForEach-Object { $L.Add([string]$_) } } catch {}
$L | Set-Content -Path $res -Encoding UTF8
Write-Host "DONE. Result: $res"
