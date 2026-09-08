---
title: "macOS에서 SDKMAN으로 Java 여러 버전 관리하기 - VS Code 프로젝트별 JDK 자동 전환"
pubDate: 2026-09-08T09:24:00+09:00
description: "macOS에서 SDKMAN으로 Java 17, Java 21 등 여러 JDK를 관리하고, .sdkmanrc와 VS Code Java 설정을 이용해 프로젝트를 열 때 각 프로젝트에 맞는 Java 버전을 사용하도록 구성하는 방법을 정리합니다."
category: Java
tags:
  - macOS
  - SDKMAN
  - Java
  - VSCode
  - JDK
  - SpringBoot
lang: ko
---

Java 프로젝트를 여러 개 관리하다 보면 프로젝트마다 요구하는 Java 버전이 다른 경우가 많습니다.

예를 들어 기존 Spring Boot 프로젝트는 **Java 17**, 새 프로젝트는 **Java 21**을 사용한다고 가정해 보겠습니다.

매번 터미널에서 Java 버전을 직접 변경할 수도 있지만, 프로젝트가 많아지면 실수하기 쉽습니다.

이 글에서는 macOS에서 **SDKMAN**으로 여러 Java 버전을 설치하고 관리한 뒤 다음과 같이 동작하도록 구성합니다.

- 프로젝트 A를 열면 터미널은 자동으로 Java 17 사용
- 프로젝트 B를 열면 터미널은 자동으로 Java 21 사용
- VS Code Java 확장도 각 프로젝트의 Java 버전을 올바르게 인식
- `sdk use java ...`를 프로젝트를 열 때마다 직접 실행할 필요 없음

핵심은 **SDKMAN의 `.sdkmanrc`**와 **VS Code의 Java Runtime 설정**을 함께 사용하는 것입니다.

> 이 글의 경로 예시는 특정 개인 계정명을 사용하지 않고 `/Users/user/...` 형식으로 작성했습니다.

---

## 1. SDKMAN이 필요한 이유

macOS에 Java를 하나만 설치해서 사용하는 경우에는 큰 문제가 없습니다.

하지만 다음처럼 프로젝트별 Java 버전이 다르면 관리가 번거로워집니다.

| 프로젝트 | Java 버전 |
|---|---:|
| legacy-api | Java 17 |
| new-api | Java 21 |

직접 관리한다면 프로젝트를 바꿀 때마다 `JAVA_HOME`과 `PATH`를 수정해야 합니다.

SDKMAN을 사용하면 Java뿐만 아니라 Maven, Gradle, Kotlin 등 JVM 관련 SDK의 여러 버전을 설치하고 전환할 수 있습니다.

---

## 2. SDKMAN 설치

macOS 기본 셸인 zsh 기준으로 다음 명령을 실행합니다.

```bash
curl -s "https://get.sdkman.io" | zsh
```

설치 후 현재 터미널에서 바로 사용하려면 다음 명령을 실행합니다.

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

설치 확인:

```bash
sdk version
```

정상적으로 버전 정보가 출력되면 설치가 완료된 것입니다.

새 터미널을 열었을 때도 `sdk` 명령을 사용할 수 있어야 합니다.

---

## 3. 설치 가능한 Java 버전 확인

SDKMAN에서 설치 가능한 Java 목록은 다음 명령으로 확인합니다.

```bash
sdk list java
```

Temurin만 확인하고 싶다면 다음처럼 검색할 수 있습니다.

```bash
sdk list java | grep tem
```

이미 설치된 Java만 확인하려면 다음 명령이 편리합니다.

```bash
sdk list java | grep installed
```

현재 사용 중인 Java는 다음 명령으로 확인합니다.

```bash
sdk current java
```

또는 일반적인 Java 명령으로 확인할 수도 있습니다.

```bash
java -version
```

---

## 4. Java 17과 Java 21 설치

이 글에서는 예제로 Temurin Java 17과 Java 21을 사용합니다.

```bash
sdk install java 17.0.16-tem
sdk install java 21.0.8-tem
```

SDKMAN에서 제공되는 정확한 버전 번호는 시점에 따라 달라질 수 있으므로 실제 설치 전에는 다음 명령으로 현재 목록을 확인하는 것이 좋습니다.

```bash
sdk list java
```

설치 후 다시 확인합니다.

```bash
sdk list java | grep installed
```

예를 들면 다음과 비슷하게 표시됩니다.

```text
17.0.16-tem    installed
21.0.8-tem     installed
```

---

## 5. SDKMAN Java 버전 변경 명령어

SDKMAN에서 자주 사용하는 Java 버전 변경 명령은 세 가지입니다.

### 현재 터미널에서만 변경

```bash
sdk use java 17.0.16-tem
```

현재 셸에서만 Java 17을 사용합니다.

새 터미널을 열면 기본 Java 버전으로 돌아갑니다.

### 기본 Java 변경

```bash
sdk default java 21.0.8-tem
```

앞으로 새로 실행하는 터미널에서 Java 21을 기본으로 사용합니다.

### 현재 버전 확인

```bash
sdk current java
```

예:

```text
Using java version 21.0.8-tem
```

하지만 프로젝트마다 Java 버전이 다르다면 `sdk use`를 계속 실행하는 방식보다 `.sdkmanrc`를 사용하는 것이 편리합니다.

---

# 6. 프로젝트별 Java 버전 지정하기

SDKMAN은 프로젝트 루트에 있는 `.sdkmanrc` 파일을 이용해 프로젝트별 SDK 버전을 관리할 수 있습니다.

예를 들어 다음과 같은 프로젝트가 있다고 가정합니다.

```text
projects
├── legacy-api
└── new-api
```

`legacy-api`는 Java 17을 사용하고 `new-api`는 Java 21을 사용합니다.

---

## 7. Java 17 프로젝트 설정

Java 17 프로젝트로 이동합니다.

```bash
cd /Users/user/projects/legacy-api
```

Java 17을 활성화합니다.

```bash
sdk use java 17.0.16-tem
```

그리고 `.sdkmanrc`를 생성합니다.

```bash
sdk env init
```

프로젝트 루트에 다음 파일이 생성됩니다.

```text
legacy-api
├── .sdkmanrc
├── pom.xml
└── src
```

`.sdkmanrc` 내용은 다음과 같습니다.

```properties
java=17.0.16-tem
```

필요하다면 파일을 직접 만들어도 됩니다.

---

## 8. Java 21 프로젝트 설정

Java 21 프로젝트에서도 동일하게 설정합니다.

```bash
cd /Users/user/projects/new-api
```

Java 21을 활성화합니다.

```bash
sdk use java 21.0.8-tem
```

`.sdkmanrc`를 생성합니다.

```bash
sdk env init
```

결과:

```properties
java=21.0.8-tem
```

이제 각 프로젝트에는 자신이 사용할 Java 버전이 기록됩니다.

---

# 9. 프로젝트 디렉터리에 들어갈 때 Java 자동 변경하기

`.sdkmanrc` 파일만 생성했다고 해서 항상 자동 전환되는 것은 아닙니다.

SDKMAN의 **auto env** 기능을 활성화해야 합니다.

SDKMAN 설정 파일은 일반적으로 다음 위치에 있습니다.

```text
/Users/user/.sdkman/etc/config
```

홈 디렉터리 표현을 사용하면 다음과 같습니다.

```text
~/.sdkman/etc/config
```

설정 파일을 열어 다음 항목을 찾습니다.

```properties
sdkman_auto_env=false
```

다음과 같이 변경합니다.

```properties
sdkman_auto_env=true
```

터미널에서 편집한다면 예를 들어 다음과 같이 실행할 수 있습니다.

```bash
vi ~/.sdkman/etc/config
```

설정을 변경한 후 새 터미널을 열거나 SDKMAN을 다시 로드합니다.

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

이제 프로젝트 디렉터리로 이동하면 `.sdkmanrc`를 읽고 Java 버전이 자동으로 변경됩니다.

---

## 10. 자동 변경 확인

먼저 Java 17 프로젝트로 이동합니다.

```bash
cd /Users/user/projects/legacy-api
```

확인:

```bash
sdk current java
java -version
```

Java 17이 표시되어야 합니다.

이번에는 Java 21 프로젝트로 이동합니다.

```bash
cd /Users/user/projects/new-api
```

다시 확인합니다.

```bash
sdk current java
java -version
```

이번에는 Java 21이 표시되어야 합니다.

즉 다음과 같은 흐름이 됩니다.

```text
legacy-api 이동
        ↓
.sdkmanrc 확인
        ↓
Java 17 자동 적용

new-api 이동
        ↓
.sdkmanrc 확인
        ↓
Java 21 자동 적용
```

---

# 11. 여기까지 했는데 VS Code는 왜 다른 Java를 사용할까?

여기서 주의할 점이 있습니다.

SDKMAN의 `.sdkmanrc`는 기본적으로 **셸 환경의 Java 버전**을 관리합니다.

하지만 VS Code의 Java 확장은 자체 Java Language Server를 실행하고 프로젝트 JDK도 별도로 관리합니다.

따라서 VS Code 터미널에서 다음 결과가 Java 17이라고 해도,

```bash
java -version
```

VS Code Java 확장이 반드시 Java 17을 프로젝트 JDK로 사용한다고 단정할 수는 없습니다.

이 문제를 해결하려면 VS Code에도 SDKMAN으로 설치한 JDK 위치를 알려주는 것이 좋습니다.

---

# 12. VS Code Extension Pack for Java 설치

VS Code에서 Java 개발을 한다면 **Extension Pack for Java**를 설치합니다.

VS Code Extensions에서 다음 이름을 검색합니다.

```text
Extension Pack for Java
```

이 확장팩에는 Java Language Support, Debugger, Maven 지원 등 Java 개발에 필요한 주요 확장들이 포함되어 있습니다.

---

# 13. SDKMAN으로 설치된 Java의 실제 경로 확인

SDKMAN이 관리하는 Java는 일반적으로 다음 아래에 설치됩니다.

```text
/Users/user/.sdkman/candidates/java/
```

하지만 경로를 직접 추측하기보다 `sdk home` 명령으로 확인하는 것이 정확합니다.

Java 17:

```bash
sdk home java 17.0.16-tem
```

예:

```text
/Users/user/.sdkman/candidates/java/17.0.16-tem
```

Java 21:

```bash
sdk home java 21.0.8-tem
```

예:

```text
/Users/user/.sdkman/candidates/java/21.0.8-tem
```

이 경로를 VS Code 설정에 사용합니다.

---

# 14. VS Code에 여러 JDK 등록하기

VS Code에서 Command Palette를 엽니다.

```text
Command + Shift + P
```

다음을 실행합니다.

```text
Preferences: Open User Settings (JSON)
```

macOS에서 사용자 설정 파일은 일반적으로 다음 위치에 있습니다.

```text
/Users/user/Library/Application Support/Code/User/settings.json
```

여기에 SDKMAN으로 설치한 Java 17과 Java 21을 등록합니다.

```json
{
  "java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem",

  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
    },
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
    }
  ],

  "java.configuration.updateBuildConfiguration": "automatic"
}
```

이미 다른 VS Code 설정이 있다면 기존 JSON에 위 항목만 추가합니다.

---

## 15. `java.jdt.ls.java.home`은 왜 Java 21로 설정할까?

이 부분은 특히 헷갈리기 쉽습니다.

현재 VS Code의 Java Language Support 확장은 최신 버전에서 **Java Language Server 자체를 실행하기 위해 JDK 21 이상을 요구**합니다.

그래서 다음 설정은 Java Language Server 실행용 JDK입니다.

```json
"java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
```

이 설정을 Java 21로 했다고 해서 모든 프로젝트를 Java 21로 개발해야 하는 것은 아닙니다.

프로젝트가 Java 17이라면 다음 `java.configuration.runtimes`에 등록된 Java 17을 프로젝트 JDK로 사용할 수 있습니다.

```json
{
  "name": "JavaSE-17",
  "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
}
```

즉 두 역할을 구분하면 이해하기 쉽습니다.

| 설정 | 역할 |
|---|---|
| `java.jdt.ls.java.home` | VS Code Java Language Server 실행용 JDK |
| `java.configuration.runtimes` | 실제 프로젝트에서 사용할 Java JDK 목록 |

Java 17 프로젝트를 사용한다고 해서 Language Server까지 Java 17로 실행해야 하는 것은 아닙니다.

---

# 16. Maven 프로젝트의 Java 버전도 맞춰주기

VS Code는 Maven 또는 Gradle 프로젝트의 빌드 설정도 참고합니다.

따라서 `.sdkmanrc`만 Java 17로 설정하고 `pom.xml`은 Java 21로 되어 있다면 설정이 서로 충돌할 수 있습니다.

Spring Boot Maven 프로젝트라면 보통 `pom.xml`에서 다음처럼 Java 버전을 지정합니다.

Java 17 프로젝트:

```xml
<properties>
    <java.version>17</java.version>
</properties>
```

Java 21 프로젝트:

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

일반 Maven 프로젝트에서는 다음과 같이 사용할 수도 있습니다.

```xml
<properties>
    <maven.compiler.release>17</maven.compiler.release>
</properties>
```

중요한 것은 다음 세 설정의 Java 메이저 버전을 맞추는 것입니다.

```text
.sdkmanrc
    ↓
pom.xml
    ↓
VS Code java.configuration.runtimes
```

---

# 17. Gradle 프로젝트라면

Gradle 프로젝트에서는 Java Toolchain을 사용하는 것이 좋습니다.

Java 17:

```groovy
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
```

Java 21:

```groovy
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

그리고 `.sdkmanrc`도 동일한 메이저 버전으로 맞춥니다.

Java 17:

```properties
java=17.0.16-tem
```

Java 21:

```properties
java=21.0.8-tem
```

---

# 18. 프로젝트마다 `.vscode/settings.json`까지 고정하는 방법

개인 PC에서 여러 프로젝트를 확실하게 분리하고 싶다면 프로젝트 내부에 `.vscode/settings.json`을 둘 수도 있습니다.

예를 들어 Java 17 프로젝트는 다음과 같이 구성합니다.

```text
legacy-api
├── .sdkmanrc
├── .vscode
│   └── settings.json
├── pom.xml
└── src
```

`.vscode/settings.json`:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem",
      "default": true
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

Java 21 프로젝트:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem",
      "default": true
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

다만 이 방식에는 한 가지 단점이 있습니다.

```text
/Users/user/...
```

경로가 개발자 PC 환경에 종속되므로 여러 개발자가 공유하는 저장소라면 `.vscode/settings.json`을 Git에 올리는 것은 신중하게 결정해야 합니다.

개인 개발 환경이라면 편리하지만, 팀 프로젝트에서는 **VS Code User Settings에 JDK 목록을 등록하고 프로젝트에서는 `.sdkmanrc`와 빌드 파일만 공유하는 방식**이 더 관리하기 편할 수 있습니다.

---

# 19. 추천 구성

개인적으로 여러 Java 프로젝트를 동시에 관리한다면 다음 구성이 가장 단순합니다.

## macOS 전체 설정

SDKMAN에 Java 17과 Java 21 설치:

```bash
sdk install java 17.0.16-tem
sdk install java 21.0.8-tem
```

SDKMAN 자동 환경 전환:

```properties
# ~/.sdkman/etc/config

sdkman_auto_env=true
```

VS Code User Settings:

```json
{
  "java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/Users/user/.sdkman/candidates/java/17.0.16-tem"
    },
    {
      "name": "JavaSE-21",
      "path": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
    }
  ],
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

## Java 17 프로젝트

`.sdkmanrc`:

```properties
java=17.0.16-tem
```

`pom.xml`:

```xml
<properties>
    <java.version>17</java.version>
</properties>
```

## Java 21 프로젝트

`.sdkmanrc`:

```properties
java=21.0.8-tem
```

`pom.xml`:

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

이렇게 구성하면 프로젝트를 변경할 때 사람이 직접 Java 버전을 기억해서 바꾸는 작업을 크게 줄일 수 있습니다.

---

# 20. 실제 동작 확인

VS Code에서 프로젝트를 열고 새 터미널을 실행합니다.

Java 버전:

```bash
java -version
```

SDKMAN 기준 버전:

```bash
sdk current java
```

`JAVA_HOME` 확인:

```bash
echo $JAVA_HOME
```

Maven이 사용하는 Java 확인:

```bash
mvn -v
```

Gradle 프로젝트라면:

```bash
./gradlew --version
```

VS Code Java 확장이 인식한 Runtime은 Command Palette에서 다음 명령으로 확인합니다.

```text
Java: Configure Java Runtime
```

여기에서 프로젝트가 사용하는 JDK와 설치된 JDK 목록을 확인할 수 있습니다.

---

# 21. `.sdkmanrc`에 적힌 Java가 설치되어 있지 않을 때

Git에서 프로젝트를 새로 받은 경우 `.sdkmanrc`에 지정된 Java가 아직 설치되어 있지 않을 수 있습니다.

프로젝트 루트에서 다음 명령을 실행합니다.

```bash
sdk env install
```

SDKMAN이 `.sdkmanrc`를 읽고 필요한 SDK 설치를 진행합니다.

수동으로 현재 프로젝트 설정을 적용하고 싶다면 다음 명령을 사용합니다.

```bash
sdk env
```

프로젝트 환경을 해제하고 기본 SDK로 돌아가려면 다음 명령을 사용할 수 있습니다.

```bash
sdk env clear
```

---

# 22. VS Code 터미널에서 `sdk` 명령을 찾지 못하는 경우

VS Code 내장 터미널에서 다음 오류가 발생할 수 있습니다.

```text
command not found: sdk
```

우선 일반 Terminal 앱에서 다음 명령이 동작하는지 확인합니다.

```bash
sdk version
```

그리고 `~/.zshrc`에 SDKMAN 초기화 코드가 있는지 확인합니다.

```bash
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$SDKMAN_DIR/bin/sdkman-init.sh" ]] && source "$SDKMAN_DIR/bin/sdkman-init.sh"
```

수정 후 터미널을 다시 시작하거나 다음 명령을 실행합니다.

```bash
source ~/.zshrc
```

VS Code의 기존 터미널도 종료한 뒤 새 터미널을 여는 것이 좋습니다.

---

# 23. 터미널은 Java 17인데 VS Code가 Java 21로 표시되는 경우

이 현상은 반드시 오류는 아닙니다.

다음 설정 때문에 Java Language Server 자체는 Java 21로 실행될 수 있습니다.

```json
"java.jdt.ls.java.home": "/Users/user/.sdkman/candidates/java/21.0.8-tem"
```

중요한 것은 **프로젝트 Runtime**입니다.

Command Palette에서 다음을 실행합니다.

```text
Java: Configure Java Runtime
```

프로젝트 JDK가 Java 17로 잡혀 있다면 Java 17 프로젝트는 정상적으로 구성된 것입니다.

정리하면 다음 둘은 다를 수 있습니다.

```text
Java Language Server → Java 21

실제 프로젝트       → Java 17
```

---

# 24. 설정을 변경했는데 VS Code에 반영되지 않을 때

Java 버전이나 `pom.xml`, Gradle 설정을 변경했는데 VS Code가 이전 상태를 계속 사용하는 경우 Command Palette에서 다음 명령을 사용할 수 있습니다.

```text
Java: Reload Projects
```

그래도 해결되지 않는다면 다음 명령을 실행합니다.

```text
Java: Clean Java Language Server Workspace
```

이후 VS Code가 Java 프로젝트 정보를 다시 로드합니다.

---

# 25. 최종 구조

Java 17 프로젝트:

```text
legacy-api
├── .sdkmanrc
├── pom.xml
└── src
```

`.sdkmanrc`:

```properties
java=17.0.16-tem
```

Java 21 프로젝트:

```text
new-api
├── .sdkmanrc
├── pom.xml
└── src
```

`.sdkmanrc`:

```properties
java=21.0.8-tem
```

macOS 전체에서는 SDKMAN과 VS Code에 JDK를 한 번 등록해 둡니다.

결과적으로:

```text
legacy-api 열기
    ↓
SDKMAN → Java 17
    ↓
pom.xml → Java 17
    ↓
VS Code → JavaSE-17 Runtime

new-api 열기
    ↓
SDKMAN → Java 21
    ↓
pom.xml → Java 21
    ↓
VS Code → JavaSE-21 Runtime
```

프로젝트가 많아질수록 매번 `sdk use java ...`를 직접 실행하는 것보다 이 방식이 훨씬 안전합니다.

특히 서로 다른 Spring Boot 버전이나 Java 17/21 프로젝트를 동시에 관리하는 macOS 개발 환경에서 유용합니다.

---

## 자주 사용하는 SDKMAN Java 명령어 정리

| 목적 | 명령어 |
|---|---|
| Java 목록 | `sdk list java` |
| 설치된 Java 확인 | `sdk list java \| grep installed` |
| 현재 Java 확인 | `sdk current java` |
| Java 설치 | `sdk install java <version>` |
| 현재 셸에서 변경 | `sdk use java <version>` |
| 기본 Java 변경 | `sdk default java <version>` |
| 프로젝트 설정 생성 | `sdk env init` |
| 프로젝트 환경 적용 | `sdk env` |
| 필요한 SDK 자동 설치 | `sdk env install` |
| 프로젝트 환경 해제 | `sdk env clear` |
| JDK 실제 경로 확인 | `sdk home java <version>` |

---

## 참고 자료

- SDKMAN 공식 사이트: https://sdkman.io/
- SDKMAN Installation: https://sdkman.io/install/
- SDKMAN Usage / Env Command: https://sdkman.io/usage/
- VS Code Java: https://code.visualstudio.com/docs/languages/java
- VS Code Managing Java Projects: https://code.visualstudio.com/docs/java/java-project
- vscode-java JDK Requirements: https://github.com/redhat-developer/vscode-java/wiki/JDK-Requirements
