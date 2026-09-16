Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Az APK Runner'
$form.Size = New-Object System.Drawing.Size(560,300)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Az APK Runner'
$title.Font = New-Object System.Drawing.Font('Segoe UI',18,[System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20,18)
$form.Controls.Add($title)

$pathBox = New-Object System.Windows.Forms.TextBox
$pathBox.Location = New-Object System.Drawing.Point(20,78)
$pathBox.Size = New-Object System.Drawing.Size(395,30)
$form.Controls.Add($pathBox)

$browse = New-Object System.Windows.Forms.Button
$browse.Text = 'Browse APK'
$browse.Location = New-Object System.Drawing.Point(425,75)
$browse.Size = New-Object System.Drawing.Size(100,32)
$form.Controls.Add($browse)

$start = New-Object System.Windows.Forms.Button
$start.Text = 'Start Android'
$start.Location = New-Object System.Drawing.Point(20,130)
$start.Size = New-Object System.Drawing.Size(150,42)
$form.Controls.Add($start)

$install = New-Object System.Windows.Forms.Button
$install.Text = 'Install APK'
$install.Location = New-Object System.Drawing.Point(185,130)
$install.Size = New-Object System.Drawing.Size(150,42)
$form.Controls.Add($install)

$stop = New-Object System.Windows.Forms.Button
$stop.Text = 'Stop Android'
$stop.Location = New-Object System.Drawing.Point(350,130)
$stop.Size = New-Object System.Drawing.Size(150,42)
$form.Controls.Add($stop)

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Status: Ready'
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(20,205)
$form.Controls.Add($status)

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = 'Android APK (*.apk)|*.apk'

$browse.Add_Click({
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $pathBox.Text = $dialog.FileName
  }
})

function Get-Root { Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
function Tool-Path($relative) { Join-Path (Get-Root) $relative }

$start.Add_Click({
  $launcher = Tool-Path 'scripts\start-emulator.ps1'
  if (Test-Path $launcher) {
    $status.Text = 'Status: Starting Android...'
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$launcher`""
  } else {
    [System.Windows.Forms.MessageBox]::Show('Runtime has not been installed yet. See apk-runner/README.md.')
  }
})

$install.Add_Click({
  $apk = $pathBox.Text
  if (-not (Test-Path $apk)) {
    [System.Windows.Forms.MessageBox]::Show('Select a valid APK first.')
    return
  }
  $adb = Tool-Path 'tools\platform-tools\adb.exe'
  if (-not (Test-Path $adb)) {
    [System.Windows.Forms.MessageBox]::Show('ADB is missing. Run the runtime setup first.')
    return
  }
  $status.Text = 'Status: Installing APK...'
  $p = Start-Process $adb -ArgumentList @('install','-r',"$apk") -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -eq 0) { $status.Text = 'Status: APK installed' } else { $status.Text = 'Status: Install failed' }
})

$stop.Add_Click({
  $adb = Tool-Path 'tools\platform-tools\adb.exe'
  if (Test-Path $adb) {
    & $adb emu kill | Out-Null
    $status.Text = 'Status: Android stopped'
  }
})

[void]$form.ShowDialog()
