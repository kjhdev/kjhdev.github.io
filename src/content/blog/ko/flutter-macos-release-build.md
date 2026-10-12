---
title: "Flutter macOS Release 빌드 오류 해결하기"
pubDate: "2026-09-20T10:24:37+09:00"
description: "기존 Flutter 프로젝트에 macOS 지원을 추가하고 flutter build macos --release 과정에서 발생하는 대표적인 문제를 점검하는 방법을 정리합니다."
category: "Flutter"
tags: ["Flutter", "macOS", "Release", "Desktop", "Build"]
lang: "ko"
updatedDate: "2026-10-12"
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

## 빌드는 성공했지만 Release에서만 네트워크가 실패한다면

Flutter 데스크톱 앱은 **빌드 오류와 실행 오류를 따로 구분**해야 합니다. 특히 macOS에서는 Debug에서는 동작하는 기능이 Release 앱에서 App Sandbox 권한 때문에 실패할 수 있습니다.

대표적인 점검 대상은 `macos/Runner/DebugProfile.entitlements`와 `macos/Runner/Release.entitlements`입니다. 실제 프로젝트에서는 `macos/Runner/*.entitlements`에 있는 파일명과 현재 Xcode 설정을 확인합니다.

| 기능 | 확인할 설정 | 실패했을 때 점검 |
|---|---|---|
| 외부 HTTPS API 호출 | `com.apple.security.network.client` | Release에서만 네트워크 요청 실패 여부 |
| 외부에서 접속하는 로컬 서버 | `com.apple.security.network.server` | Debug와 Release의 entitlement 차이 |
| 사용자가 선택한 파일 읽기/쓰기 | 파일 접근 entitlement | 파일 선택·열기·저장 동작 |
| 번들에 포함한 실행파일 실행 | Sandbox 정책·서명·실행 권한 | 별도 프로세스가 실행되는지 |

권한을 무조건 추가하는 것이 아니라 **앱이 실제 수행하는 작업에 필요한 항목만** 설정합니다. 파일 선택기나 외부 프로세스를 사용하는 앱이라면 단순한 Flutter UI 앱보다 검증 범위가 넓습니다.

## 오류가 발생한 단계별 진단표

| 단계 | 증상 | 우선 확인 |
|---|---|---|
| 플랫폼 준비 | `macos/`가 없거나 생성 오류 | 플랫폼 폴더, `flutter doctor -v` |
| 패키지/컴파일 | plugin, Swift, Pod, framework 오류 | 플러그인 macOS 지원, Xcode 설정, 전체 빌드 로그의 첫 오류 |
| 빌드 성공 | `.app`은 생성됐으나 실행 직후 종료 | 터미널 실행·Console 로그·네이티브 라이브러리 |
| 실행 기능 | Windows에서는 되지만 Mac에서 실패 | 경로·실행 권한·외부 바이너리 형식 |
| 배포 | 내 Mac에서는 되지만 다른 Mac에서 차단 | Code Signing, Notarization, Gatekeeper |

`flutter clean`을 매번 반복하는 것보다 **첫 번째 실제 오류 로그를 기준으로 범위를 좁히는 편**이 효율적입니다. 로그에 사용자 경로·토큰·서명 정보가 있다면 공개하기 전에 가려야 합니다.

## Release 앱까지 확인하는 재현 절차

```bash
flutter doctor -v
flutter pub get
flutter build macos --release
find build/macos/Build/Products/Release -maxdepth 1 -name "*.app"
```

앱 이름은 프로젝트마다 다릅니다. 빌드가 성공하면 `.app`을 직접 실행하고 아래 동작을 확인합니다.

1. 메인 화면이 열리는가?
2. 실제로 사용하는 API에 HTTPS 요청이 성공하는가?
3. 파일 선택·저장과 외부 실행파일 호출이 정상인가?
4. 앱을 종료한 뒤 다시 실행해도 같은 결과인가?

이 과정은 **검증 방법**이며, 이 글에 특정 앱의 빌드가 모두 성공했다는 실제 측정 결과를 뜻하지는 않습니다. 외부 배포 전에는 [Flutter 공식 macOS 빌드 가이드](https://docs.flutter.dev/platform-integration/macos/building)에 따라 서명·공증 절차를 별도로 확인합니다.

관련 글: [Flutter Windows 데스크톱 빌드](/ko/posts/flutter-windows-desktop-build/) · [Flutter dart-define 환경 분리](/ko/posts/flutter-dart-define/)

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
