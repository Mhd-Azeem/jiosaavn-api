$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $root 'runtime'
$sdk=Join-Path $runtime 'sdk'
New-Item -ItemType Directory -Force -Path $runtime,$sdk | Out-Null

Write-Host 'Az APK Runner - Runtime Setup'
Write-Host 'This installer uses the official Android SDK command-line tools.'
Write-Host 'The SDK/emulator files are downloaded locally and are not committed to this repository.'

$zip=Join-Path $env:TEMP 'az-commandlinetools.zip'
$url='https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
Invoke-WebRequest $url -OutFile $zip
Expand-Archive $zip -DestinationPath $sdk -Force
New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools\latest') | Out-Null
Get-ChildItem (Join-Path $sdk 'cmdline-tools') | Where-Object {$_.Name -ne 'latest'} | ForEach-Object { Move-Item $_.FullName (Join-Path $sdk 'cmdline-tools\latest') -Force }

$sdkmanager=Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$env:ANDROID_SDK_ROOT=$sdk
1..20 | ForEach-Object { 'y' } | & $sdkmanager --licenses | Out-Null
& $sdkmanager 'platform-tools' 'emulator' 'platforms;android-30' 'system-images;android-30;default;x86_64'

$avdmanager=Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'
'no' | & $avdmanager create avd -n AzPhone -k 'system-images;android-30;default;x86_64' -d pixel_2 --force

# Stable paths consumed by the launcher.
$pt=Join-Path $runtime 'platform-tools'
$emu=Join-Path $runtime 'emulator'
if(Test-Path $pt){Remove-Item $pt -Recurse -Force}
if(Test-Path $emu){Remove-Item $emu -Recurse -Force}
Copy-Item (Join-Path $sdk 'platform-tools') $pt -Recurse
Copy-Item (Join-Path $sdk 'emulator') $emu -Recurse

Write-Host 'Runtime ready. Run src\AzApkRunner.ps1.'
