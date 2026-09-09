---
title: "Spring Boot .env 환경변수 DB_URL 인식 오류 해결"
pubDate: 2026-09-09T12:16:37+09:00
description: "Spring Boot에서 .env에 정의한 DB_URL이 치환되지 않고 ${DB_URL} 문자열 그대로 JDBC URL에 전달되는 원인과 macOS, VS Code, Docker 환경별 해결 방법을 정리합니다."
category: Spring Boot
tags:
  - Spring Boot
  - MySQL
  - Environment Variables
  - macOS
  - VS Code
  - Docker
lang: ko
---

Spring Boot 프로젝트를 여러 개발환경에서 실행하다 보면 한 환경에서는 정상적으로 DB에 연결되는데 다른 환경에서는 다음과 같은 오류가 발생할 수 있습니다.

```text
Driver com.mysql.cj.jdbc.Driver claims to not accept jdbcUrl, ${DB_URL}
```

이 오류에서 가장 먼저 봐야 할 부분은 MySQL 드라이버가 실제 JDBC URL이 아니라 **`${DB_URL}` 문자열 자체를 전달받았다는 점**입니다.

예를 들어 `application.yml`이 다음과 같다고 가정합니다.

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

그리고 프로젝트 루트에 `.env` 파일이 있습니다.

```env
DB_URL=jdbc:mysql://db.example.com:3306/app?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
DB_USERNAME=dev
DB_PASSWORD=example-password
```

겉으로는 정상처럼 보이지만, 일반적인 Spring Boot 애플리케이션은 프로젝트 루트의 `.env` 파일을 자동으로 운영체제 환경변수로 등록하지 않습니다.

## 1. 먼저 현재 환경변수를 확인한다

Spring Boot를 실행할 터미널에서 확인합니다.

```bash
echo $DB_URL
```

또는:

```bash
printenv DB_URL
```

DB 관련 변수 전체를 확인하려면:

```bash
env | grep '^DB_'
```

아무것도 출력되지 않는다면 `.env` 파일은 존재하지만 현재 Java 프로세스가 사용할 환경에는 값이 없는 상태입니다.

## 2. macOS에서 `.env`를 현재 셸에 로드한다

`.env`가 단순한 `KEY=VALUE` 형식이라면 zsh에서 다음처럼 불러올 수 있습니다.

```bash
set -a
source .env
set +a
```

다시 확인합니다.

```bash
echo $DB_URL
```

정상적인 JDBC URL이 출력되면 같은 터미널에서 애플리케이션을 실행합니다.

Gradle:

```bash
./gradlew bootRun
```

Maven:

```bash
./mvnw spring-boot:run
```

JAR:

```bash
java -jar build/libs/app.jar
```

환경변수를 불러온 셸과 Spring Boot를 실행하는 셸이 같아야 합니다.

## 3. VS Code 터미널과 Run/Debug 환경은 다를 수 있다

VS Code 내장 터미널에서는 `DB_URL`이 정상인데 Run 또는 Debug 버튼으로 실행하면 실패하는 경우도 있습니다.

Java 프로세스를 실행하는 환경이 터미널과 다를 수 있기 때문입니다.

프로젝트별 실행 설정을 사용한다면 `.vscode/launch.json`에서 `.env`를 명시할 수 있습니다.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "Run Spring Boot",
      "request": "launch",
      "mainClass": "com.example.Application",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

`.env`에는 비밀번호가 포함될 수 있으므로 Git에는 올리지 않는 것이 좋습니다.

```gitignore
.env
```

필요한 변수 이름만 공유하려면 `.env.example`을 별도로 둡니다.

```env
DB_URL=
DB_USERNAME=
DB_PASSWORD=
```

## 4. 기본값을 사용할 수도 있다

개발환경에 한해 placeholder 기본값을 지정할 수 있습니다.

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://localhost:3306/app}
    username: ${DB_USERNAME:dev}
    password: ${DB_PASSWORD}
```

`DB_URL`이 없으면 localhost를 사용합니다.

운영 비밀번호처럼 민감한 값은 소스에 기본값으로 작성하지 않는 편이 안전합니다.

## 5. Docker Compose의 `.env`와 컨테이너 환경변수는 구분한다

Docker Compose가 `.env`를 읽는 것과 Spring Boot 컨테이너가 해당 환경변수를 받는 것은 별개의 문제입니다.

```yaml
services:
  api:
    image: example-api
    environment:
      DB_URL: ${DB_URL}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
```

또는:

```yaml
services:
  api:
    image: example-api
    env_file:
      - .env
```

컨테이너 내부에서도 확인할 수 있습니다.

```bash
docker compose exec api printenv DB_URL
```

실제 JDBC URL이 출력되어야 합니다.

## 6. 같은 소스가 다른 PC에서만 실패하는 이유

한 개발환경에서는 이미 다음 중 하나가 설정되어 있었을 수 있습니다.

- `~/.zshrc`에 환경변수가 등록됨
- VS Code launch 설정이 존재함
- IDE 실행 설정에 환경변수가 있음
- Docker Compose에서 `env_file`을 사용함
- 기존 터미널에서 환경변수를 export한 상태였음

새 환경에 `.env` 파일만 복사했다고 동일한 실행환경이 만들어지는 것은 아닙니다.

## 7. 오류 메시지의 단계부터 구분한다

다음 오류라면:

```text
jdbcUrl, ${DB_URL}
```

DB 서버나 방화벽보다 먼저 **환경변수 치환 실패**를 확인합니다.

반대로 실제 URL이 표시된다면:

```text
jdbc:mysql://db.example.com:3306/app
```

그 다음에 확인할 것은 다음과 같습니다.

- MySQL 서버 상태
- 호스트와 포트
- 방화벽 및 포트포워딩
- DB 사용자 권한
- 데이터베이스 이름
- SSL 옵션

## 최종 점검 순서

```text
application.yml의 ${DB_URL} 확인
        ↓
printenv DB_URL
        ↓
값이 없으면 .env 로드
        ↓
VS Code Run/Debug라면 envFile 확인
        ↓
Docker라면 컨테이너 환경변수 확인
        ↓
실제 JDBC URL이 들어간 뒤 DB 연결 확인
```

핵심은 **`.env` 파일이 존재하는 것과 Spring Boot 프로세스에 환경변수가 전달되는 것은 다르다**는 점입니다.

이 차이를 알고 있으면 `${DB_URL}`이 문자열 그대로 JDBC 드라이버까지 전달되는 문제를 빠르게 해결할 수 있습니다.
