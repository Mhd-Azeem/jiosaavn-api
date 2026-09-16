# Az APK Runner

A lightweight Windows launcher for installing and running Android APKs through an Android emulator backend.

## Goal
- Total footprint target: <= 700 MB where practical
- Windows 10/11
- Drag-and-drop or browse for an APK
- Install APK with ADB
- Start/stop emulator
- Launch installed package
- Minimal GUI

## Architecture
This project does **not** implement Android emulation from scratch. It wraps an emulator/runtime backend and ADB in a simple Windows GUI.

Expected layout after packaging:

```
apk-runner/
  app/
  runtime/
  tools/
  scripts/
```

The runtime image is intentionally kept external to source control because of size and licensing concerns.
