---
title: "Flutter --dart-define으로 Release 빌드와 서버 환경 분리하기"
pubDate: "2026-09-19T17:31:51+09:00"
description: "Flutter의 Release 빌드 모드와 개발·운영 서버 환경을 분리하는 방법을 정리합니다. --dart-define과 String.fromEnvironment를 사용해 동일한 Release 앱에서 API 환경을 안전하게 선택하는 구조를 알아봅니다."
category: "Flutter"
tags: ["Flutter", "dart-define", "Release", "환경설정", "API"]
lang: "ko"
---

Flutter 앱을 개발하다 보면 `debug`, `profile`, `release` 빌드 모드와 개발·운영 서버 환경을 같은 개념으로 생각하기 쉽습니다.

하지만 두 가지는 서로 별개입니다.

예를 들어 다음 명령으로 앱을 실행할 수 있습니다.

```bash
flutter run --release -d <device-id> --dart-define=ENV=dev
```

이 명령은 **Release 모드로 빌드하면서 개발 서버를 사용**하도록 구성할 수 있습니다.

이 글에서는 `--dart-define`을 이용해 Flutter의 빌드 모드와 API 서버 환경을 분리하는 방법을 정리합니다.

## Release 빌드라고 운영 서버를 사용해야 하는 것은 아니다

Flutter의 빌드 모드는 앱 자체의 실행 방식과 최적화 수준을 결정합니다.

대표적으로 다음 세 가지가 있습니다.

- `debug`: 개발과 디버깅에 사용하는 모드
- `profile`: 성능 분석에 사용하는 모드
- `release`: 디버깅 기능을 제거하고 최적화한 배포용 모드

반면 `dev`, `prod` 같은 값은 애플리케이션에서 직접 정의하는 **서버 환경**입니다.

따라서 다음과 같은 조합도 가능합니다.

```text
Debug 빌드   + 개발 서버
Release 빌드 + 개발 서버
Release 빌드 + 운영 서버
```

실기기에서 실제 Release 성능과 동작을 확인하면서 API는 개발 서버에 연결하고 싶다면 두 번째 조합이 유용합니다.

## --dart-define 사용하기

Flutter에서는 빌드 또는 실행 시 `--dart-define`으로 값을 전달할 수 있습니다.

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

운영 환경이라면 다음처럼 변경합니다.

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=prod
```

앱 코드에서는 `String.fromEnvironment()`로 값을 읽습니다.

```dart
class AppConfig {
    AppConfig._();

    static const String env = String.fromEnvironment(
        'ENV',
        defaultValue: 'dev',
    );

    static bool get isProd => env == 'prod';
}
```

이제 앱이 Release인지 Debug인지와 관계없이 `ENV` 값으로 서버 환경을 결정할 수 있습니다.

## API 주소를 환경별로 분리하기

API마다 전체 URL을 직접 작성하면 환경을 변경할 때 수정해야 할 곳이 많아집니다.

예를 들어 다음 구조는 관리하기 어렵습니다.

```dart
static const String productUrl =
    'https://dev.example.com/product';

static const String sequenceUrl =
    'https://dev-api.example.com/api/init/sequence';
```

대신 서버 주소와 API Path를 분리하는 편이 좋습니다.

```dart
class ApiConfig {
    ApiConfig._();

    static const String env = String.fromEnvironment(
        'ENV',
        defaultValue: 'dev',
    );

    static const String _devWebBaseUrl = 'https://dev.example.com';
    static const String _prodWebBaseUrl = 'https://www.example.com';

    static const String _devApiBaseUrl = 'https://dev-api.example.com/api';
    static const String _prodApiBaseUrl = 'https://api.example.com/api';

    static String get webBaseUrl =>
        env == 'prod' ? _prodWebBaseUrl : _devWebBaseUrl;

    static String get apiBaseUrl =>
        env == 'prod' ? _prodApiBaseUrl : _devApiBaseUrl;

    static String get productDetailUrl => '$webBaseUrl/product';
    static String get sequenceUrl => '$apiBaseUrl/init/sequence';
}
```

이 구조에서는 API Path가 추가되더라도 개발·운영 주소를 반복해서 작성할 필요가 없습니다.

## iOS 실기기에서 Release + 개발 서버 테스트

연결된 기기는 다음 명령으로 확인할 수 있습니다.

```bash
flutter devices
```

그다음 Device ID를 지정해 실행합니다.

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

여기서 중요한 부분은 `--release`와 `ENV=dev`가 서로 충돌하지 않는다는 점입니다.

`--release`는 Flutter 빌드 모드이고 `ENV=dev`는 우리가 정의한 애플리케이션 설정이기 때문입니다.

## 실제 배포용 빌드

운영 서버를 바라보는 iOS Release 빌드는 다음처럼 만들 수 있습니다.

```bash
flutter build ios --release     --dart-define=ENV=prod
```

Android라면 같은 방식으로 적용할 수 있습니다.

```bash
flutter build appbundle --release     --dart-define=ENV=prod
```

macOS에서도 동일한 개념을 사용할 수 있습니다.

```bash
flutter build macos --release     --dart-define=ENV=prod
```

플랫폼은 달라도 Dart 코드에서 환경값을 읽는 방식은 같습니다.

## 기본값을 dev로 둘 때 주의할 점

다음 코드처럼 기본값을 `dev`로 지정하면 로컬 개발은 편합니다.

```dart
static const String env = String.fromEnvironment(
    'ENV',
    defaultValue: 'dev',
);
```

하지만 운영 빌드 명령에서 `--dart-define=ENV=prod`를 빠뜨리면 Release 앱이 개발 서버를 바라볼 수 있습니다.

이를 방지하려면 운영 배포 스크립트에 환경값을 명시하는 것이 좋습니다.

```bash
flutter build ios --release --dart-define=ENV=prod
```

프로젝트 규모가 커지면 환경값이 예상한 값인지 검증하는 로직을 추가하는 것도 방법입니다.

```dart
static bool get isValidEnv => env == 'dev' || env == 'prod';
```

## API Key를 --dart-define에 넣어도 안전할까?

`--dart-define`은 환경별 URL이나 기능 플래그를 관리하기에는 편리하지만, **비밀정보를 안전하게 숨기는 기능은 아닙니다.**

다음과 같은 값을 앱에 포함시키는 용도로 사용해서는 안 됩니다.

- 서버 비밀번호
- 비공개 API Secret
- 인증용 Private Key
- 외부에 노출되면 안 되는 Token

클라이언트 앱에 포함된 값은 최종적으로 추출될 가능성이 있다고 가정해야 합니다.

`--dart-define`은 비밀정보 저장소가 아니라 **빌드 시 설정값을 전달하는 방법**으로 사용하는 것이 적절합니다.

## 정리

Flutter에서는 빌드 모드와 서버 환경을 분리해서 생각하는 것이 중요합니다.

```text
--release
    → 앱의 빌드 및 최적화 방식

--dart-define=ENV=dev
    → 앱이 사용할 서버 환경
```

따라서 다음 명령은 정상적인 구성입니다.

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

실기기에서는 Release 모드의 동작을 확인하면서 개발 API를 사용할 수 있고, 실제 배포 시에는 `ENV=prod`만 지정하면 동일한 코드로 운영 서버에 연결할 수 있습니다.

API URL까지 Base URL과 Path로 분리해 두면 개발·운영 환경 전환에 필요한 수정 범위도 크게 줄일 수 있습니다.
