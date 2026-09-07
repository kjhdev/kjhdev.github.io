---
title: "Building and Distributing a Flutter Windows Desktop App"
description: "A practical guide to building a Flutter Windows desktop app in Release mode and packaging it as a Windows installer with Inno Setup."
lang: "en"
pubDate: 2026-09-07T15:10:00+09:00
category: "Flutter"
tags:
  - Flutter
  - Windows
  - Desktop
  - Inno Setup
  - Release Build
draft: false
---

Flutter can be used not only for Android and iOS applications, but also for Windows desktop applications.

This post summarizes the process I used while building a Flutter-based **bulk parcel tracking desktop application**, from preparing the Windows project to creating a Release build and packaging it as an installer.

The overall workflow looks like this:

```text
Flutter project
    ↓
Windows Desktop setup
    ↓
Local testing
    ↓
Release build
    ↓
Icon / version check
    ↓
Inno Setup
    ↓
Windows installer (.exe)
```

## 1. Check the Windows Desktop Project

First, check whether your Flutter environment is ready for Windows desktop development.

```bash
flutter doctor
```

On Windows, Flutter desktop development also depends on the required Visual Studio desktop components being installed correctly.

If the Flutter project does not contain a Windows platform project yet, run the following command from the project root:

```bash
flutter create --platforms=windows .
```

This adds a `windows` directory to the existing project.

```text
project/
├── lib/
├── assets/
├── windows/
├── pubspec.yaml
└── ...
```

If you see an error such as:

```text
No Windows desktop project configured.
```

the Windows platform files are often missing, and the command above can be used to add them.

## 2. Run the App on Windows

On a Windows development machine, run:

```bash
flutter run -d windows
```

If everything is configured correctly, the Flutter application opens as a native Windows desktop window.

Before creating a Release build, test the important features in this environment.

For the parcel tracking application, I checked features such as:

- Manual tracking-number input
- Excel file import
- Bulk tracking requests
- Delivery status display
- Excel export
- Launching a local executable
- License validation
- Application version checks

## 3. Prepare the Application Icon

It is better to replace the default Flutter icon with an icon that represents the application.

For this project, I used an icon combining a parcel box and a magnifying glass so that the purpose of the application is easy to recognize.

![Parcel Tracker icon](/images/parcel_tracker.png)

To use the image in an Astro blog, place it here:

```text
public/images/parcel_tracker.png
```

For the Flutter Windows application itself, prepare a Windows `.ico` file and apply it to the Windows runner resources.

In the default Flutter Windows structure, the icon resources are usually located under the `windows/runner/resources` directory.

## 4. Configure the Application Version

The main Flutter application version is managed in `pubspec.yaml`.

For example:

```yaml
version: 1.0.0+1
```

This can be interpreted as:

```text
1.0.0  → user-facing version
1      → build number
```

For the next release, you might change it to:

```yaml
version: 1.0.1+2
```

When Windows and macOS are built from the same Flutter project, the version in `pubspec.yaml` can be used as the common version source.

However, installer metadata and platform-specific version resources may still need to be managed separately.

## 5. Build the Windows Release Version

After development and testing are complete, create a Release build.

```bash
flutter build windows --release
```

If the build succeeds, Flutter creates the executable and its required runtime files in the Release directory.

Depending on the Flutter version and project configuration, the path is usually similar to:

```text
build/windows/x64/runner/Release/
```

The directory contains more than just the `.exe` file.

```text
Release/
├── app.exe
├── flutter_windows.dll
├── data/
└── other DLL files
```

This is important when distributing a Flutter desktop application.

Copying only the `.exe` file may result in an application that cannot start because required DLLs and data files are missing.

## 6. Application Name and Executable Name

The internal Flutter project name does not have to be the same as the product name shown to users.

For example, an internal project might use:

```text
parcel_desk
```

while the product name shown to users is:

```text
Parcel Tracker
```

The executable name can also be managed separately if required.

In my project, the executable filename was:

```text
parcel_desk.exe
```

while the application and installer used a user-facing product name.

Separating internal project naming from the product name can make project maintenance easier.

## 7. Test the Release Files Directly

Before creating an installer, test the executable directly from the Release directory.

Useful things to verify include:

```text
Application startup
External file paths
Asset loading
Local executable launching
Network requests
File picker behavior
Excel import/export
Initial window size
Application icon
```

A feature can work correctly in Debug mode but fail in Release mode because file paths or bundled resources are different.

This is especially important when the Flutter application includes a Python executable or other external runtime files.

## 8. Create an Installer with Inno Setup

You can distribute the entire Release directory as a ZIP file, but an installer is usually easier for end users.

For this project, I used **Inno Setup**.

A simplified installer script can look like this:

```ini
#define MyAppName "Parcel Tracker"
#define MyAppVersion "1.0.0"
#define MyAppExeName "parcel_desk.exe"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\Parcel Desk
OutputBaseFilename=ParcelDesk_Setup_1.0.0

[Files]
Source: "Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
```

Update the `Source` path to match the actual location of the Flutter Release directory.

Make sure the installer includes the required DLLs, the `data` directory, and any other bundled files.

## 9. Keep Installer Versions in Sync

When releasing a new application version, it is useful to update both the Flutter version and the installer version.

For example, Flutter:

```yaml
version: 1.0.1+2
```

Inno Setup:

```ini
#define MyAppVersion "1.0.1"
OutputBaseFilename=ParcelDesk_Setup_1.0.1
```

Keeping these values synchronized makes installer management easier.

If the application checks its latest version from a server, a separate build number can also be used to determine whether an update is required.

## 10. Windows SmartScreen Warnings

One common issue for independent developers distributing Windows applications is Microsoft Defender SmartScreen.

An unsigned or unfamiliar installer may display a warning such as:

```text
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

This does not automatically mean the application is malicious.

It can happen when Windows cannot verify the publisher through a trusted code-signing certificate or when the executable has not yet built enough reputation.

For long-term commercial distribution, a code-signing certificate is worth considering.

For early-stage projects, however, certificate cost may also be a factor, so some developers initially provide installation instructions explaining the warning.

## 11. Releasing a New Version

After changing the UI or application features, build the Release version again.

```bash
flutter build windows --release
```

Then create a new Inno Setup installer using the latest Release files.

The update workflow becomes:

```text
Modify Flutter source
     ↓
flutter run -d windows
     ↓
Test features
     ↓
flutter build windows --release
     ↓
Test Release output
     ↓
Build Inno Setup installer
     ↓
Distribute the new installer
```

## Conclusion

Flutter makes it possible to develop Windows desktop applications from the same framework used for mobile development.

However, distributing a Windows application involves more than running:

```bash
flutter build windows --release
```

A practical release process should also cover:

- Windows Desktop project configuration
- Release builds
- Application name and icon
- Version management
- Required DLL and data files
- Installer creation with Inno Setup
- SmartScreen warnings
- Application update strategy

If your Flutter desktop app depends on external executables or local resources, always test the **actual Release build and installed application**, not only the Debug version.
