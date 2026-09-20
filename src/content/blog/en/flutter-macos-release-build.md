---
title: "Flutter macOS Release 빌드 오류 해결하기"
pubDate: "2026-09-20T10:24:37+09:00"
description: "기존 Flutter 프로젝트에 macOS 지원을 추가하고 flutter build macos --release 과정에서 발생하는 대표적인 문제를 점검하는 방법을 정리합니다."
category: "Flutter"
tags: ["Flutter", "macOS", "Release", "Desktop", "Build"]
lang: "ko"
---

Flutter로 Windows 데스크톱 앱을 개발하다가 macOS까지 지원하려면 단순히 `flutter build macos --release`만 실행해서 끝나지 않는 경우가 있습니다.

특히 기존 프로젝트가 Windows 중심으로 개발되었거나 나중에 macOS 플랫폼을 추가했다면 프로젝트 설정, 플러그인, 네이티브 의존성, 외부 실행파일 때문에 빌드 오류가 발생할 수 있습니다.

## macOS 플랫폼부터 확인하기

프로젝트에 `macos/` 디렉터리가 있는지 확인합니다.

```text
project/
├── lib/
├── windows/
├── macos/
└── pubspec.yaml
```

없다면 기존 프로젝트에 macOS 플랫폼을 추가할 수 있습니다.

```bash
flutter create --platforms=macos .
```

Windows와 macOS를 함께 추가하려면 다음과 같이 실행합니다.

```bash
flutter create --platforms=windows,macos .
```

이미 수정된 `macos` 디렉터리가 있다면 재생성하기 전에 기존 네이티브 설정을 확인하는 것이 안전합니다.

## Flutter와 Xcode 환경 확인

먼저 개발 환경을 확인합니다.

```bash
flutter doctor -v
flutter --version
```

macOS 빌드에는 Flutter SDK뿐 아니라 정상적인 Xcode 환경이 필요합니다. 여러 Mac에서 프로젝트를 공유한다면 Flutter 버전 차이도 확인합니다.

## 의존성과 빌드 캐시 정리

플랫폼을 추가했거나 다른 PC에서 프로젝트를 처음 받은 경우 다음 순서로 정리합니다.

```bash
flutter clean
flutter pub get
flutter build macos --release
```

`flutter clean`이 모든 오류를 해결하는 것은 아니지만 이전 플랫폼 빌드 결과나 변경 전 플러그인 캐시의 영향을 배제하는 기본 점검으로 유용합니다.

## 플러그인의 macOS 지원 확인

Windows에서 정상 동작하던 패키지가 macOS까지 지원한다고 단정할 수는 없습니다.

특히 다음 기능은 확인이 필요합니다.

- 파일 시스템 접근
- 시스템 트레이
- 로컬 프로세스 실행
- 네이티브 라이브러리
- Windows 전용 API

플랫폼별 구현이 필요하면 Dart에서 구분할 수 있습니다.

```dart
import 'dart:io';

if (Platform.isWindows) {
    // Windows 처리
} else if (Platform.isMacOS) {
    // macOS 처리
}
```

## Windows 실행파일은 macOS에서 실행할 수 없다

Flutter 앱에서 별도의 로컬 프로그램을 호출하는 구조라면 중요한 차이가 있습니다.

```text
Flutter → Local executable → Result
```

Windows용 `.exe`는 macOS에서 그대로 사용할 수 없습니다. 플랫폼별 바이너리를 따로 준비해야 합니다.

```text
assets/
├── windows/
│   └── worker.exe
└── macos/
    └── worker
```

Python 프로그램을 PyInstaller 등으로 패키징하는 경우에도 Windows용과 macOS용 실행파일을 각각 빌드해야 합니다.

## 파일 경로도 점검하기

Windows 경로 구분자를 직접 사용한 코드는 macOS에서 문제가 될 수 있습니다.

```dart
final filePath = '$basePath\\data\\result.xlsx';
```

가능하면 `path` 패키지를 사용합니다.

```dart
import 'package:path/path.dart' as p;

final filePath = p.join(basePath, 'data', 'result.xlsx');
```

`/Users/user/...` 같은 로컬 개발 경로도 코드에 고정하지 않고 실행 시 적절한 디렉터리를 구하도록 구성하는 것이 좋습니다.

## macOS 실행 권한 확인

외부 바이너리가 존재해도 실행 권한이 없으면 실행되지 않습니다.

```bash
ls -l path/to/worker
chmod +x path/to/worker
```

Git으로 프로젝트를 공유한다면 실행 권한이 유지되는지도 확인합니다. Windows 개발에서는 잘 드러나지 않던 차이입니다.

## Xcode 네이티브 설정 확인

Flutter macOS 프로젝트는 내부적으로 Xcode 프로젝트를 사용합니다.

```text
macos/
├── Runner/
├── Runner.xcodeproj/
├── Runner.xcworkspace/
└── Podfile
```

필요하면 직접 열어 확인합니다.

```bash
open macos/Runner.xcworkspace
```

Deployment Target, Signing, Bundle Identifier, Framework 설정 등 네이티브 빌드 단계의 문제를 확인할 수 있습니다.

## Release 앱 생성 위치

최종적으로 다음 명령을 실행합니다.

```bash
flutter build macos --release
```

정상적으로 완료되면 일반적으로 결과는 다음 위치에 생성됩니다.

```text
build/macos/Build/Products/Release/MyApp.app
```

`--release`로 생성했으므로 Debug 앱이 아닌 Release 결과물입니다.

## 빌드 성공과 외부 배포는 다르다

개발 Mac에서 `.app`이 실행된다고 해서 다른 Mac에 바로 배포할 수 있다는 의미는 아닙니다.

외부 배포에서는 추가로 다음 항목을 검토해야 합니다.

- Code Signing
- Developer ID 인증서
- Hardened Runtime
- Notarization
- Gatekeeper
- 앱에 포함된 외부 바이너리의 서명

특히 별도의 실행파일을 앱에 포함한다면 메인 `.app`뿐 아니라 해당 바이너리도 배포 과정에 영향을 줄 수 있습니다.

## 빌드 자동화

반복 빌드한다면 쉘 스크립트로 정리할 수 있습니다.

```bash
#!/bin/bash

set -e

flutter clean
flutter pub get
flutter build macos --release

echo "macOS Release build completed."
```

실행 권한을 부여합니다.

```bash
chmod +x build_macos.sh
./build_macos.sh
```

실제 배포 스크립트에는 플랫폼별 실행파일 복사, 버전 확인, ZIP 생성 등의 과정을 추가할 수 있습니다.

## 정리

기존 Windows용 Flutter 프로젝트를 macOS로 확장할 때는 다음 순서로 점검하면 문제 범위를 좁히기 쉽습니다.

```text
1. macOS 플랫폼 프로젝트 확인
2. flutter doctor -v로 개발 환경 확인
3. flutter clean / flutter pub get
4. 플러그인의 macOS 지원 확인
5. Windows 전용 코드와 실행파일 확인
6. 파일 경로와 실행 권한 확인
7. Xcode 네이티브 설정 확인
8. flutter build macos --release
9. 외부 배포 시 Signing과 Notarization 검토
```

단순한 Flutter UI만 사용하는 프로젝트보다 로컬 실행파일, 파일 시스템, 네이티브 라이브러리를 사용하는 데스크톱 앱에서 플랫폼 차이가 더 크게 나타납니다. Windows에서 정상 동작했던 운영체제 의존 부분을 하나씩 macOS 기준으로 확인하는 것이 핵심입니다.
