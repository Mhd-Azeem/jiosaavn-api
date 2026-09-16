Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$qemu='C:\Program Files\qemu\qemu-system-x86_64.exe'
$qemuImg='C:\Program Files\qemu\qemu-img.exe'
$adbCandidates=@((Join-Path $root 'runtime\platform-tools\adb.exe'),(Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'))
$adb=$adbCandidates|Where-Object{Test-Path $_}|Select-Object -First 1
$disk=Join-Path $env:LOCALAPPDATA 'AzDroid\azdroid.qcow2'
$config=Join-Path $env:LOCALAPPDATA 'AzDroid\config.txt'
New-Item -ItemType Directory -Force (Split-Path $disk)|Out-Null
$iso='C:\Users\azeem\Downloads\android-x86-9.0-r2.iso'
if(Test-Path $config){$saved=Get-Content $config -ErrorAction SilentlyContinue;if($saved -and (Test-Path $saved)){$iso=$saved}}

function Invoke-Adb([string[]]$Args){if(!$adb){throw 'ADB not found. Android Studio platform-tools or runtime platform-tools is required.'};& $adb @Args}
function Connect-Adb{Invoke-Adb @('start-server')|Out-Null;Invoke-Adb @('connect','127.0.0.1:5555')|Out-Null}
function Start-Phone([bool]$Installer){
 if(!(Test-Path $qemu)){[Windows.Forms.MessageBox]::Show('QEMU not found at C:\Program Files\qemu.','AzDroid');return}
 if(!(Test-Path $disk)){& $qemuImg create -f qcow2 $disk 8G|Out-Null;$Installer=$true}
 $a=@('-m','2048','-smp','2','-accel','whpx','-drive',"file=$disk,format=qcow2,if=ide",'-netdev','user,id=net0,hostfwd=tcp::5555-:5555','-device','e1000,netdev=net0','-vga','std','-display','sdl')
 if($Installer){if(!(Test-Path $iso)){[Windows.Forms.MessageBox]::Show('Select your Android-x86 ISO first.','AzDroid');return};$a+=@('-cdrom',$iso,'-boot','d')}else{$a+=@('-boot','c')}
 Start-Process $qemu -ArgumentList $a
}

$form=New-Object Windows.Forms.Form
$form.Text='AzDroid - Android APK Runner';$form.Size=New-Object Drawing.Size(520,820);$form.StartPosition='CenterScreen';$form.BackColor=[Drawing.Color]::FromArgb(18,18,20);$form.ForeColor=[Drawing.Color]::White
$title=New-Object Windows.Forms.Label;$title.Text='AZDROID';$title.Font=New-Object Drawing.Font('Segoe UI',22,[Drawing.FontStyle]::Bold);$title.AutoSize=$true;$title.Location=New-Object Drawing.Point(190,35);$form.Controls.Add($title)
$status=New-Object Windows.Forms.Label;$status.Text='Ready';$status.AutoSize=$true;$status.Location=New-Object Drawing.Point(45,100);$form.Controls.Add($status)
function Btn($text,$x,$y,$w=190){$b=New-Object Windows.Forms.Button;$b.Text=$text;$b.Size=New-Object Drawing.Size($w,45);$b.Location=New-Object Drawing.Point($x,$y);$form.Controls.Add($b);return $b}
$isoBtn=Btn 'Select Android ISO' 45 145
$installAndroid=Btn 'Create / Install Phone' 260 145
$start=Btn 'Start Android' 45 205
$apkBtn=Btn 'Select APK' 260 205
$pushBtn=Btn 'Copy File to Android' 45 265
$installApk=Btn 'Install APK' 260 265
$home=Btn 'Home' 45 650 120;$back=Btn 'Back' 190 650 120;$recent=Btn 'Recent' 335 650 120
$apkPath=$null
$isoBtn.Add_Click({$d=New-Object Windows.Forms.OpenFileDialog;$d.Filter='Android ISO (*.iso)|*.iso';if($d.ShowDialog()-eq'OK'){$script:iso=$d.FileName;Set-Content $config $script:iso;$status.Text='ISO: '+[IO.Path]::GetFileName($script:iso)}})
$installAndroid.Add_Click({$status.Text='Starting Android installer...';Start-Phone $true})
$start.Add_Click({$status.Text='Starting persistent Android...';Start-Phone $false})
$apkBtn.Add_Click({$d=New-Object Windows.Forms.OpenFileDialog;$d.Filter='Android APK (*.apk)|*.apk';if($d.ShowDialog()-eq'OK'){$script:apkPath=$d.FileName;$status.Text='APK: '+[IO.Path]::GetFileName($script:apkPath)}})
$installApk.Add_Click({try{if(!$script:apkPath){throw 'Select an APK first.'};Connect-Adb;$status.Text='Installing APK...';$o=Invoke-Adb @('-s','127.0.0.1:5555','install','-r',$script:apkPath);if($LASTEXITCODE-eq 0){$status.Text='APK installed successfully.'}else{throw ($o -join "`n")}}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'AzDroid')}})
$pushBtn.Add_Click({try{$d=New-Object Windows.Forms.OpenFileDialog;if($d.ShowDialog()-eq'OK'){Connect-Adb;$status.Text='Copying file...';Invoke-Adb @('-s','127.0.0.1:5555','push',$d.FileName,'/sdcard/Download/');$status.Text='Copied to Android Download folder.'}}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'AzDroid')}})
$home.Add_Click({try{Connect-Adb;Invoke-Adb @('-s','127.0.0.1:5555','shell','input','keyevent','3')}catch{}})
$back.Add_Click({try{Connect-Adb;Invoke-Adb @('-s','127.0.0.1:5555','shell','input','keyevent','4')}catch{}})
$recent.Add_Click({try{Connect-Adb;Invoke-Adb @('-s','127.0.0.1:5555','shell','input','keyevent','187')}catch{}})
$note=New-Object Windows.Forms.Label;$note.Text="First run: Select ISO > Create / Install Phone.`nInstall Android-x86 onto the virtual disk. Later use Start Android.`nADB requires Android-x86 debugging/TCP ADB on port 5555.";$note.Size=New-Object Drawing.Size(430,100);$note.Location=New-Object Drawing.Point(45,350);$form.Controls.Add($note)
[void]$form.ShowDialog()
