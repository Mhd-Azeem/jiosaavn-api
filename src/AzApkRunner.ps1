Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root 'runtime'
$adb = Join-Path $runtime 'platform-tools\adb.exe'
$emulator = Join-Path $runtime 'emulator\emulator.exe'
$avdName = 'AzPhone'

$form = New-Object Windows.Forms.Form
$form.Text = 'Az APK Runner'
$form.Size = New-Object Drawing.Size(520,850)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [Drawing.Color]::FromArgb(20,20,22)
$form.ForeColor = [Drawing.Color]::White
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false

$phone = New-Object Windows.Forms.Panel
$phone.Location = New-Object Drawing.Point(55,25)
$phone.Size = New-Object Drawing.Size(390,700)
$phone.BackColor = [Drawing.Color]::FromArgb(5,5,6)
$form.Controls.Add($phone)

$screen = New-Object Windows.Forms.Panel
$screen.Location = New-Object Drawing.Point(15,35)
$screen.Size = New-Object Drawing.Size(360,620)
$screen.BackColor = [Drawing.Color]::FromArgb(30,30,34)
$phone.Controls.Add($screen)

$title = New-Object Windows.Forms.Label
$title.Text = 'AZ PHONE'
$title.Font = New-Object Drawing.Font('Segoe UI',18,[Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object Drawing.Point(112,150)
$screen.Controls.Add($title)

$status = New-Object Windows.Forms.Label
$status.Text = 'Android runtime not started'
$status.Font = New-Object Drawing.Font('Segoe UI',10)
$status.AutoSize = $true
$status.Location = New-Object Drawing.Point(85,200)
$screen.Controls.Add($status)

$select = New-Object Windows.Forms.Button
$select.Text = 'Select APK'
$select.Size = New-Object Drawing.Size(145,45)
$select.Location = New-Object Drawing.Point(30,270)
$screen.Controls.Add($select)

$run = New-Object Windows.Forms.Button
$run.Text = 'Install && Run'
$run.Size = New-Object Drawing.Size(145,45)
$run.Location = New-Object Drawing.Point(185,270)
$run.Enabled = $false
$screen.Controls.Add($run)

$start = New-Object Windows.Forms.Button
$start.Text = 'Start Android'
$start.Size = New-Object Drawing.Size(300,45)
$start.Location = New-Object Drawing.Point(30,330)
$screen.Controls.Add($start)

$home = New-Object Windows.Forms.Button
$home.Text = 'Home'
$home.Size = New-Object Drawing.Size(90,35)
$home.Location = New-Object Drawing.Point(30,560)
$screen.Controls.Add($home)
$back = New-Object Windows.Forms.Button
$back.Text = 'Back'
$back.Size = New-Object Drawing.Size(90,35)
$back.Location = New-Object Drawing.Point(135,560)
$screen.Controls.Add($back)
$recent = New-Object Windows.Forms.Button
$recent.Text = 'Recent'
$recent.Size = New-Object Drawing.Size(90,35)
$recent.Location = New-Object Drawing.Point(240,560)
$screen.Controls.Add($recent)

$apkPath = $null
$select.Add_Click({
  $dlg = New-Object Windows.Forms.OpenFileDialog
  $dlg.Filter = 'Android APK (*.apk)|*.apk'
  if ($dlg.ShowDialog() -eq 'OK') {
    $script:apkPath = $dlg.FileName
    $status.Text = 'Selected: ' + [IO.Path]::GetFileName($script:apkPath)
    $run.Enabled = $true
  }
})

$start.Add_Click({
  if (!(Test-Path $emulator)) {
    [Windows.Forms.MessageBox]::Show('Runtime is not installed. Run setup-runtime.ps1 first.','Az APK Runner')
    return
  }
  $status.Text = 'Starting Android...'
  Start-Process $emulator -ArgumentList "-avd $avdName -no-boot-anim -gpu auto -memory 1536"
})

$run.Add_Click({
  if (!(Test-Path $adb)) { [Windows.Forms.MessageBox]::Show('ADB runtime missing.','Az APK Runner'); return }
  if (!$script:apkPath) { return }
  $status.Text = 'Installing APK...'
  & $adb wait-for-device
  & $adb install -r $script:apkPath
  if ($LASTEXITCODE -eq 0) {
    $status.Text = 'APK installed. Open it in Android.'
  } else { $status.Text = 'APK installation failed.' }
})

$home.Add_Click({ if(Test-Path $adb){ & $adb shell input keyevent 3 } })
$back.Add_Click({ if(Test-Path $adb){ & $adb shell input keyevent 4 } })
$recent.Add_Click({ if(Test-Path $adb){ & $adb shell input keyevent 187 } })

[void]$form.ShowDialog()
