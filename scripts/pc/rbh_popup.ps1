# Coloured pop-up. Shows a message, closes itself. No network, changes nothing.
# green = good news, red = needs you, amber = heads-up, blue = info
param([string]$Color = 'blue', [string]$Title = 'Royal Bath Hub', [string]$Message = '', [int]$Seconds = 90)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$map = @{ green = '#1E8E3E'; red = '#D93025'; amber = '#F29900'; blue = '#1A73E8' }
$hex = $map[$Color]; if (-not $hex) { $hex = $map['blue'] }
$f = New-Object System.Windows.Forms.Form
$f.FormBorderStyle = 'None'; $f.StartPosition = 'CenterScreen'; $f.TopMost = $true
$f.Size = New-Object System.Drawing.Size(640, 260)
$f.BackColor = [System.Drawing.ColorTranslator]::FromHtml($hex)
$t = New-Object System.Windows.Forms.Label
$t.Text = $Title; $t.ForeColor = 'White'; $t.Font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$t.Location = New-Object System.Drawing.Point(24, 20); $t.Size = New-Object System.Drawing.Size(592, 50)
$m = New-Object System.Windows.Forms.Label
$m.Text = $Message; $m.ForeColor = 'White'; $m.Font = New-Object System.Drawing.Font('Segoe UI', 14)
$m.Location = New-Object System.Drawing.Point(24, 80); $m.Size = New-Object System.Drawing.Size(592, 110)
$b = New-Object System.Windows.Forms.Button
$b.Text = 'OK'; $b.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$b.Location = New-Object System.Drawing.Point(480, 200); $b.Size = New-Object System.Drawing.Size(130, 40)
$b.BackColor = 'White'; $b.ForeColor = [System.Drawing.ColorTranslator]::FromHtml($hex)
$b.Add_Click({ $f.Close() })
$f.Controls.AddRange(@($t, $m, $b))
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $Seconds * 1000
$timer.Add_Tick({ $f.Close() })
$timer.Start()
[void]$f.ShowDialog()
