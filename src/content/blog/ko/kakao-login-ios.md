---
title: "iOS 앱에 카카오 로그인 연동하는 방법"
pubDate: 2026-09-10T09:30:45+09:00
description: "Kakao Developers 앱 설정부터 Swift Package Manager 설치, Native App Key, URL Scheme, Allowlist, SDK 초기화, 카카오톡·카카오계정 로그인과 서버 연동까지 iOS 카카오 로그인 과정을 단계별로 정리합니다."
category: iOS
tags:
  - iOS
  - Swift
  - Kakao Login
  - Kakao SDK
  - OAuth
  - Xcode
lang: ko
---

iOS 앱에 카카오 로그인을 붙이려면 단순히 SDK를 설치하고 로그인 함수를 한 번 호출하는 것으로 끝나지 않습니다.

전체 흐름은 다음과 같습니다.

```text
Kakao Developers 앱 생성
↓
iOS 플랫폼 등록
↓
카카오 로그인 활성화
↓
동의항목 설정
↓
Kakao SDK 설치
↓
Native App Key / URL Scheme 설정
↓
Allowlist 설정
↓
SDK 초기화
↓
로그인 구현
↓
필요하면 자체 서버 사용자와 연결
```

이 글에서는 Swift 기반 iOS 앱을 기준으로 전체 과정을 정리합니다.

> Kakao SDK 요구사항과 API는 버전에 따라 변경될 수 있으므로 실제 적용 시에는 Kakao Developers 공식 문서를 함께 확인하는 것이 좋습니다.

## 1. Kakao Developers 애플리케이션 생성

Kakao Developers에서 사용할 애플리케이션을 생성합니다.

iOS SDK에서 중요한 값은 **Native App Key**입니다.

이 글에서는 실제 값을 노출하지 않고 다음처럼 표현합니다.

```text
NATIVE_APP_KEY
```

실제 서비스의 Secret, Admin Key, 서버용 인증정보는 공개 저장소나 블로그에 절대 포함하지 않습니다.

## 2. iOS 플랫폼과 Bundle Identifier 등록

Kakao Developers에서 iOS 플랫폼 정보를 등록합니다.

예:

```text
com.example.myapp
```

Xcode의 실제 Bundle Identifier와 Kakao Developers에 등록한 값이 동일해야 합니다.

Xcode:

```text
TARGETS
→ Signing & Capabilities
→ Bundle Identifier
```

Kakao Developers:

```text
App
→ Platform Key
→ Native app key
→ iOS
```

Bundle ID가 바뀌면 Kakao Developers 설정도 함께 확인해야 합니다.

## 3. 카카오 로그인 활성화와 동의항목 설정

애플리케이션을 만들었다고 카카오 로그인이 자동 활성화되는 것은 아닙니다.

카카오 로그인 사용 설정을 켜고 서비스에 필요한 동의항목을 설정합니다.

예:

```text
닉네임
프로필 이미지
카카오계정 이메일
```

실제로 필요하지 않은 개인정보를 무조건 요청하지 않는 것이 좋습니다.

이메일이나 프로필 값은 항상 존재한다고 가정하지 말고 nullable하게 처리합니다.

## 4. Swift Package Manager로 Kakao SDK 설치

현재 Kakao SDK for iOS는 Swift Package Manager(SPM)를 이용해 설치할 수 있습니다.

Xcode:

```text
Project
→ Package Dependencies
→ +
```

Repository URL:

```text
https://github.com/kakao/kakao-ios-sdk
```

카카오 로그인에 주로 사용하는 모듈:

```text
KakaoSDKCommon
KakaoSDKAuth
KakaoSDKUser
```

현재 Kakao 공식 문서에서는 최신 SDK 계열에서 CocoaPods 지원이 종료되었으므로 신규 프로젝트라면 SPM 기준으로 구성하는 것이 자연스럽습니다.

## 5. Allowlist 설정

카카오톡 앱을 실행하려면 iOS의 URL Scheme 조회 허용 목록을 설정합니다.

Xcode Target의 Info에서:

```text
Queried URL Schemes
```

를 추가하고 다음 값을 등록합니다.

```text
kakaokompassauth
```

`Info.plist`를 직접 작성하면:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>kakaokompassauth</string>
</array>
```

카카오톡 공유나 채널 같은 다른 Kakao 기능을 사용한다면 추가 Scheme이 필요할 수 있습니다.

## 6. Custom URL Scheme 등록

카카오톡 로그인 후 다시 자신의 앱으로 돌아오려면 URL Scheme을 등록해야 합니다.

형식:

```text
kakao{NATIVE_APP_KEY}
```

예시:

```text
kakao123456789
```

Xcode:

```text
Target
→ Info
→ URL Types
→ URL Schemes
```

카카오 로그인 callback 형식은 다음과 같습니다.

```text
kakao{NATIVE_APP_KEY}://oauth
```

블로그나 공개 저장소에는 실제 Native App Key를 그대로 사용하지 않습니다.

## 7. Kakao SDK 초기화

UIKit의 `AppDelegate.swift`를 사용하는 경우:

```swift
import KakaoSDKCommon

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {
    KakaoSDK.initSDK(appKey: "NATIVE_APP_KEY")

    return true
}
```

SwiftUI App Life Cycle을 사용한다면:

```swift
import SwiftUI
import KakaoSDKCommon

@main
struct MyApp: App {
    init() {
        KakaoSDK.initSDK(appKey: "NATIVE_APP_KEY")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 8. 카카오톡 로그인 가능 여부 확인

사용자 단말기에 카카오톡이 설치되어 있는지 확인합니다.

```swift
import KakaoSDKUser

if UserApi.isKakaoTalkLoginAvailable() {
    // 카카오톡 로그인
} else {
    // 카카오계정 로그인
}
```

카카오 공식 문서에서도 `isKakaoTalkLoginAvailable()`을 먼저 확인하는 방식을 안내합니다.

## 9. 카카오톡으로 로그인

```swift
UserApi.shared.loginWithKakaoTalk { oauthToken, error in
    if let error = error {
        print(error)
        return
    }

    guard oauthToken != nil else {
        return
    }

    print("Kakao login success")
}
```

운영 앱에서는 access token 전체를 로그에 출력하지 않는 편이 좋습니다.

## 10. 카카오계정으로 로그인

카카오톡을 사용할 수 없는 경우 기본 브라우저 기반 카카오계정 로그인을 사용할 수 있습니다.

```swift
UserApi.shared.loginWithKakaoAccount { oauthToken, error in
    if let error = error {
        print(error)
        return
    }

    guard oauthToken != nil else {
        return
    }

    print("Kakao account login success")
}
```

## 11. 두 로그인 방식을 하나로 처리

```swift
func loginWithKakao() {
    if UserApi.isKakaoTalkLoginAvailable() {
        UserApi.shared.loginWithKakaoTalk { token, error in
            handleLoginResult(token: token, error: error)
        }
    } else {
        UserApi.shared.loginWithKakaoAccount { token, error in
            handleLoginResult(token: token, error: error)
        }
    }
}
```

공통 결과 처리:

```swift
func handleLoginResult(
    token: OAuthToken?,
    error: Error?
) {
    if let error = error {
        print("Kakao login failed: \(error)")
        return
    }

    guard token != nil else {
        return
    }

    // 서비스 로그인 처리
}
```

Kakao SDK가 제공하는 통합 로그인 선택 UI인 `loginWithKakao()`를 사용하는 방법도 있습니다.

## 12. 앱으로 돌아오는 URL 처리

카카오톡 인증 후 앱으로 복귀한 URL을 Kakao SDK가 처리해야 합니다.

SceneDelegate 기반 앱의 개념적인 예:

```swift
import KakaoSDKAuth

func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
) {
    guard let url = URLContexts.first?.url else {
        return
    }

    if AuthApi.isKakaoTalkLoginUrl(url) {
        AuthController.handleOpenUrl(url: url)
    }
}
```

SwiftUI App Life Cycle에서는 `onOpenURL()`을 이용할 수 있습니다.

이 처리가 빠지면 카카오톡 앱까지 정상적으로 열렸지만 인증 후 앱으로 돌아와 로그인이 완료되지 않는 문제가 생길 수 있습니다.

## 13. 사용자 정보 조회

필요한 경우 로그인 이후 사용자 정보를 조회합니다.

```swift
UserApi.shared.me { user, error in
    if let error = error {
        print(error)
        return
    }

    guard let user = user else {
        return
    }

    print("Kakao user id: \(user.id ?? 0)")
}
```

이메일과 프로필 정보는 동의항목 설정과 실제 사용자 동의 여부에 따라 없을 수 있습니다.

## 14. 자체 서버가 있는 경우의 로그인 구조

실서비스에서는 카카오 로그인 성공 이후 자체 서버 사용자와 연결하는 경우가 많습니다.

```text
iOS 앱
↓
카카오 로그인 성공
↓
Kakao access token 획득
↓
자체 서버 로그인 API 호출
↓
서버가 카카오 인증정보 검증
↓
자체 사용자 조회 또는 생성
↓
서비스용 Access Token 발급
↓
앱은 서비스 토큰으로 API 호출
```

클라이언트에서 전달한 `kakaoUserId`만 서버가 그대로 신뢰하는 방식은 피하는 것이 좋습니다.

서버가 Kakao에서 발급한 인증정보를 검증한 뒤 자체 사용자와 매핑하도록 설계합니다.

## 15. Kakao 토큰과 서비스 토큰 구분

```text
Kakao Access Token
→ Kakao API 인증

Service Access Token
→ 자체 서버 API 인증
```

자체 백엔드가 있다면 카카오 인증이 끝난 뒤 서비스 전용 토큰을 발급하는 구조가 관리하기 편합니다.

이 구조는 나중에 Apple 로그인 같은 다른 로그인 방식을 추가할 때도 유리합니다.

## 16. 로그아웃과 연결 끊기

로그아웃:

```swift
UserApi.shared.logout { error in
    if let error = error {
        print(error)
        return
    }

    print("logout success")
}
```

연결 끊기:

```swift
UserApi.shared.unlink { error in
    if let error = error {
        print(error)
        return
    }

    print("unlink success")
}
```

`unlink()`는 앱과 카카오계정의 연결을 해제하고 발급된 토큰을 무효화합니다.

회원탈퇴 기능을 제공한다면 자체 서비스 데이터 삭제뿐 아니라 카카오 연결 해제 정책도 함께 검토해야 합니다.

## 17. 자주 발생하는 오류

### 카카오톡이 열리지 않는 경우

확인:

```text
LSApplicationQueriesSchemes
kakaokompassauth
```

### 로그인 후 앱으로 돌아오지 않는 경우

확인:

```text
URL Scheme
kakao{NATIVE_APP_KEY}
```

그리고 URL callback 처리 코드를 확인합니다.

### 로그인은 되지만 이메일이 없는 경우

확인:

```text
Kakao Developers 동의항목
사용자 실제 동의 여부
nullable 처리
```

### 특정 Xcode Target에서만 SDK를 찾지 못하는 경우

SPM Package Product가 해당 Target에 연결되어 있는지 확인합니다.

여러 Target/Scheme을 사용하는 앱에서는 Target별 SDK와 설정 적용 여부가 특히 중요합니다.

## 전체 구현 순서

```text
1. Kakao Developers 앱 생성
2. iOS Bundle ID 등록
3. 카카오 로그인 활성화
4. 동의항목 설정
5. SPM으로 Kakao SDK 설치
6. kakaokompassauth Allowlist 등록
7. kakao{NATIVE_APP_KEY} URL Scheme 등록
8. KakaoSDK 초기화
9. callback URL 처리
10. 카카오톡/카카오계정 로그인 호출
11. 필요한 사용자 정보 조회
12. 자체 서버 인증과 연결
13. 로그아웃/회원탈퇴 정책 구현
```

## 마무리

iOS 카카오 로그인에서 오류가 자주 나는 부분은 로그인 메서드보다 **Kakao Developers 설정과 Xcode 프로젝트 설정이 서로 맞지 않는 경우**입니다.

먼저 다음 네 가지를 확인하면 문제를 빠르게 좁힐 수 있습니다.

```text
Bundle Identifier
Native App Key
URL Scheme
LSApplicationQueriesSchemes
```

자체 서버가 있다면 다음처럼 역할을 분리하는 것이 좋습니다.

```text
Kakao = 사용자 신원 인증
자체 서버 = 실제 서비스 로그인과 권한 관리
```

## 참고 자료

- Kakao Developers - iOS SDK 시작하기  
  https://developers.kakao.com/docs/ko/ios/getting-started
- Kakao Developers - 카카오 로그인 iOS  
  https://developers.kakao.com/docs/ko/kakaologin/ios
