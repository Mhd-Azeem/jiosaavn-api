param([string]$IsoPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$qemu=Join-Path $root 'runtime\qemu\qemu-system-x86_64.exe'
$disk=Join-Path $root 'runtime\azdroid.qcow2'
if(!$IsoPath){$IsoPath=Join-Path $root 'android-x86_64-9.0-r2.iso'}
if(!(Test-Path $IsoPath)){Write-Host "ISO not found: $IsoPath"; Read-Host 'Press Enter'; exit 1}
if(!(Test-Path $qemu)){Write-Host 'QEMU is not installed in runtime\qemu yet.'; Write-Host 'Install QEMU for Windows, then copy its files into runtime\qemu.'; Read-Host 'Press Enter'; exit 1}
if(!(Test-Path $disk)){& (Join-Path $root 'runtime\qemu\qemu-img.exe') create -f qcow2 $disk 4G}
& $qemu -enable-kvm -m 2048 -smp 2 -device virtio-vga -display sdl -netdev user,id=n1 -device e1000,netdev=n1 -drive file=$disk,if=ide,format=qcow2 -cdrom $IsoPath -boot d
