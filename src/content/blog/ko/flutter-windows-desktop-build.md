---
title: "Flutter Windows 데스크톱 앱 빌드부터 설치파일 배포까지"
description: "Flutter Windows 데스크톱 앱을 Release로 빌드하고, 아이콘과 버전을 설정한 뒤 Inno Setup으로 설치파일을 만드는 과정을 정리합니다."
lang: "ko"
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

Flutter는 Android와 iOS뿐 아니라 Windows 데스크톱 앱도 만들 수 있다.

이번 글에서는 실제로 Flutter 기반의 **택배 송장번호 일괄 조회 프로그램**을 Windows용 데스크톱 앱으로 만들면서 사용했던 과정을 기준으로, Windows 프로젝트 준비부터 Release 빌드와 설치파일 생성까지 정리한다.

전체 흐름은 다음과 같다.

```text
Flutter 프로젝트
    ↓
Windows Desktop 설정
    ↓
로컬 실행 및 테스트
    ↓
Release 빌드
    ↓
아이콘 / 버전 확인
    ↓
Inno Setup
    ↓
Windows 설치파일(.exe)
```

## 1. Windows Desktop 프로젝트 확인

먼저 Flutter에서 Windows Desktop을 사용할 수 있는지 확인한다.

```bash
flutter doctor
```

Windows 개발환경이 정상이라면 Visual Studio의 Windows Desktop 관련 구성도 확인할 수 있다.

Flutter 프로젝트에 Windows 플랫폼이 아직 생성되어 있지 않다면 프로젝트 루트에서 다음 명령어를 실행한다.

```bash
flutter create --platforms=windows .
```

이 명령을 실행하면 기존 Flutter 프로젝트에 `windows` 폴더가 추가된다.

```text
프로젝트/
├── lib/
├── assets/
├── windows/
├── pubspec.yaml
└── ...
```

예전에 생성된 프로젝트에서 다음 오류가 나온다면 Windows 플랫폼 폴더가 없는 경우가 많다.

```text
No Windows desktop project configured.
```

이 경우 위의 `flutter create --platforms=windows .` 명령으로 Windows 프로젝트를 추가하면 된다.

## 2. Windows에서 앱 실행하기

Windows PC에서 개발 중이라면 다음 명령어로 실행할 수 있다.

```bash
flutter run -d windows
```

정상적으로 실행되면 실제 Windows 창 형태로 Flutter 앱이 열린다.

Release 빌드 전에 가능한 한 여기서 주요 기능을 먼저 테스트하는 것이 좋다.

예를 들어 택배트래커 프로그램에서는 다음 기능들을 확인했다.

- 송장번호 직접 입력
- Excel 파일 불러오기
- 여러 송장번호 일괄 조회
- 배송상태 표시
- 조회 결과 Excel 저장
- 로컬 실행파일 호출
- 라이선스 및 버전 확인

## 3. Flutter 앱 아이콘 준비

Windows 실행파일에는 기본 Flutter 아이콘 대신 앱에 맞는 아이콘을 적용하는 것이 좋다.

이 프로젝트에서는 택배 조회 프로그램임을 쉽게 알 수 있도록 택배 상자와 돋보기를 조합한 아이콘을 사용했다.

![택배트래커 아이콘](/images/parcel_tracker.png)

Astro 블로그에서 위 이미지를 사용하려면 파일을 다음 위치에 두면 된다.

```text
public/images/parcel_tracker.png
```

Flutter Windows 프로젝트에서는 일반적으로 `.ico` 형식의 Windows 아이콘을 준비한 후 Windows 리소스에 적용한다.

프로젝트에 따라 아이콘 경로가 다를 수 있지만, Flutter Windows 기본 구조에서는 `windows/runner/resources` 아래의 아이콘 파일을 확인하면 된다.

## 4. 앱 버전 설정

Flutter 프로젝트의 기본 버전은 `pubspec.yaml`에서 관리할 수 있다.

예를 들어:

```yaml
version: 1.0.0+1
```

여기서:

```text
1.0.0  → 사용자에게 표시되는 버전
1      → 빌드 번호
```

형태로 이해하면 된다.

버전을 올릴 때는 예를 들어 다음과 같이 변경할 수 있다.

```yaml
version: 1.0.1+2
```

Windows와 macOS를 같은 Flutter 프로젝트에서 관리한다면 `pubspec.yaml`의 버전 정보를 공통 기준으로 사용할 수 있다.

다만 설치 프로그램 자체의 버전, Windows 리소스 정보 등은 별도 설정이 있을 수 있으므로 실제 배포 시 함께 확인하는 것이 좋다.

## 5. Windows Release 빌드

개발 테스트가 끝났다면 Release 빌드를 만든다.

```bash
flutter build windows --release
```

빌드가 성공하면 Windows 실행파일과 필요한 DLL 등이 Release 폴더에 생성된다.

환경이나 Flutter 버전에 따라 경로가 조금 다를 수 있지만 일반적으로 다음과 비슷한 위치를 확인한다.

```text
build/windows/x64/runner/Release/
```

이 폴더에는 실행파일 하나만 있는 것이 아니다.

```text
Release/
├── app.exe
├── flutter_windows.dll
├── data/
└── 기타 DLL 파일
```

따라서 배포할 때 `.exe` 하나만 복사하면 실행되지 않을 수 있다.

Release 폴더에 생성된 실행에 필요한 파일들을 함께 배포해야 한다.

## 6. 실행파일 이름과 앱 이름

Flutter 프로젝트명과 실제 사용자에게 보여줄 앱 이름은 다르게 가져갈 수 있다.

예를 들어 개발 프로젝트 내부에서는:

```text
parcel_desk
```

를 사용하고 사용자에게 보이는 제품명은:

```text
택배트래커
```

로 사용할 수 있다.

실행파일명도 필요하다면 Windows Runner 설정을 수정해서 관리할 수 있다.

실제 배포 프로젝트에서는 실행파일명을 다음처럼 사용했다.

```text
parcel_desk.exe
```

반면 설치 프로그램과 화면상 제품명은 `택배트래커`로 표시했다.

개발용 이름과 사용자에게 노출되는 이름을 분리하면 프로젝트 관리가 더 편한 경우가 많다.

## 7. Release 파일 직접 테스트

설치 프로그램을 만들기 전에 Release 폴더의 실행파일을 직접 실행해보는 것이 좋다.

확인할 항목은 다음과 같다.

```text
앱 실행 여부
외부 파일 경로
assets 로딩
로컬 실행파일 호출
네트워크 요청
파일 선택
Excel 읽기/쓰기
창 크기
앱 아이콘
```

Debug에서는 정상인데 Release에서 외부 파일을 찾지 못하는 경우가 있기 때문에 특히 파일 경로 처리를 확인해야 한다.

Flutter에서 Python이나 다른 로컬 실행파일을 포함시키는 경우에는 Release 빌드 폴더에서의 실제 경로가 개발환경과 다를 수 있다.

## 8. Inno Setup으로 설치파일 만들기

Release 빌드를 그대로 ZIP으로 전달할 수도 있지만, 일반 사용자에게 배포한다면 Windows 설치 프로그램 형태가 편하다.

이번 프로젝트에서는 **Inno Setup**을 사용했다.

설치 스크립트의 기본 구조는 다음과 비슷하다.

```ini
#define MyAppName "택배트래커"
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

실제 프로젝트 경로에 맞게 `Source` 경로를 변경하면 된다.

중요한 점은 Release 폴더 전체에 필요한 DLL과 `data` 폴더까지 포함해야 한다는 것이다.

## 9. 설치파일 버전 관리

앱 버전을 올릴 때는 Flutter의 버전뿐 아니라 Inno Setup의 버전도 함께 맞추는 것이 좋다.

예를 들어 Flutter:

```yaml
version: 1.0.1+2
```

Inno Setup:

```ini
#define MyAppVersion "1.0.1"
OutputBaseFilename=ParcelDesk_Setup_1.0.1
```

처럼 맞춰두면 설치파일 관리가 편해진다.

서버에서 앱 버전을 체크하는 구조를 사용한다면 별도의 `buildNo`를 두어 업데이트 여부를 판단하는 방식도 사용할 수 있다.

## 10. Windows SmartScreen 경고

개인 개발자가 Windows 설치파일을 배포할 때 가장 먼저 접하게 되는 문제 중 하나가 SmartScreen 경고다.

코드서명 인증서가 없는 실행파일이나 설치파일은 Windows에서 다음과 같은 경고가 표시될 수 있다.

```text
Windows의 PC 보호
Microsoft Defender SmartScreen에서 인식할 수 없는 앱의 시작을 차단했습니다.
```

프로그램 자체에 문제가 있다는 의미는 아니다.

Windows가 해당 실행파일의 게시자를 신뢰할 수 있는 코드서명으로 확인하지 못했거나 충분한 평판이 쌓이지 않은 경우 발생할 수 있다.

정식 상용 배포를 장기간 운영한다면 코드서명 인증서를 검토할 수 있다.

다만 개인 프로젝트나 초기 제품에서는 인증서 비용도 고려해야 하기 때문에 설치 안내를 별도로 제공하는 방식으로 시작할 수도 있다.

## 11. 새 버전을 다시 배포하는 과정

화면이나 기능을 수정한 뒤에는 다시 Release 빌드를 진행한다.

```bash
flutter build windows --release
```

그다음 새 Release 결과물을 기준으로 Inno Setup 설치파일을 다시 생성한다.

전체 과정은 다음처럼 단순화할 수 있다.

```text
Flutter 소스 수정
     ↓
flutter run -d windows
     ↓
기능 테스트
     ↓
flutter build windows --release
     ↓
Release 실행 테스트
     ↓
Inno Setup 빌드
     ↓
새 설치파일 배포
```

## 마무리

Flutter를 이용하면 하나의 프로젝트에서 모바일뿐 아니라 Windows 데스크톱 앱까지 개발할 수 있다.

Windows 배포에서 중요한 것은 단순히 다음 명령어를 실행하는 것만은 아니다.

```bash
flutter build windows --release
```

실제 사용자에게 전달하려면 다음 항목까지 함께 확인해야 한다.

- Windows Desktop 프로젝트 설정
- Release 빌드
- 앱 이름과 아이콘
- 버전 관리
- Release 폴더의 DLL과 데이터 파일
- Inno Setup 설치파일
- SmartScreen 경고
- 업데이트 방식

특히 외부 실행파일이나 로컬 파일을 함께 사용하는 Flutter 데스크톱 앱이라면 Debug 환경뿐 아니라 **실제 Release 폴더와 설치된 환경에서 반드시 테스트하는 것**이 중요하다.
