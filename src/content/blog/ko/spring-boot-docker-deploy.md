---
title: "Spring Boot JAR를 Ubuntu Docker 서버에 자동 배포하는 방법"
pubDate: 2026-09-12T20:51:44+09:00
description: "Spring Boot 프로젝트를 로컬에서 bootJar로 빌드하고 JAR 파일만 Ubuntu 서버로 전송한 뒤 Docker Compose로 재빌드·재배포하는 과정을 쉘 스크립트로 자동화하는 방법을 정리한다."
category: Spring Boot
tags:
  - Spring Boot
  - Docker
  - Ubuntu
  - Gradle
  - Deployment
  - Shell Script
lang: ko
---

Spring Boot 애플리케이션을 Ubuntu 서버의 Docker에서 운영할 때 매번 전체 소스를 서버에 올릴 필요는 없다.

로컬에서 실행 가능한 JAR를 만든 뒤 서버에는 **JAR 파일만 전송**하고, 서버에 미리 준비한 Dockerfile과 Compose 설정을 이용해 이미지를 다시 만들면 된다.

전체 흐름은 다음과 같다.

```text
로컬 Spring Boot 빌드
↓
JAR 생성
↓
SCP로 서버에 업로드
↓
Docker Image 재빌드
↓
컨테이너 재생성
↓
상태와 로그 확인
```

처음에는 각 단계를 직접 실행하고, 정상 동작이 확인되면 `deploy.sh` 하나로 자동화하는 방식이 좋다.

## 1. 배포 구조

로컬 프로젝트:

```text
project/
├── build.gradle
├── gradlew
├── src/
└── deploy.sh
```

Ubuntu 서버:

```text
~/docker/api/
├── app.jar
├── Dockerfile
├── compose.yaml
└── .env
```

빌드는 로컬에서 수행하므로 서버에는 소스코드 전체나 Gradle 개발환경이 필요하지 않다.

## 2. `bootJar`로 실행 가능한 JAR 만들기

Spring Boot Gradle Plugin을 사용한다면 다음 명령으로 실행 가능한 JAR를 생성할 수 있다.

```bash
./gradlew bootJar
```

기본 생성 위치는 다음과 같다.

```text
build/libs/
```

예:

```text
build/libs/example-0.0.1-SNAPSHOT.jar
```

전체 테스트와 빌드를 함께 수행하려면 다음 명령을 사용할 수도 있다.

```bash
./gradlew build
```

배포용 JAR만 만들 목적이라면 `bootJar`를 직접 실행하는 방식이 단순하다.

## 3. 서버에서는 JAR 이름을 고정한다

빌드 결과 파일명에는 버전이 포함되는 경우가 많다.

```text
example-0.0.1-SNAPSHOT.jar
example-0.0.2.jar
```

Dockerfile까지 매번 수정하지 않으려면 업로드할 때 서버 파일명을 `app.jar`로 고정하면 편하다.

```bash
scp build/libs/example-0.0.1-SNAPSHOT.jar \
    user@server.example.com:~/docker/api/app.jar
```

서버에서는 항상 다음 파일만 사용한다.

```text
app.jar
```

## 4. Dockerfile 구성

서버의 `Dockerfile` 예시는 다음과 같다.

```dockerfile
FROM eclipse-temurin:25-jre

WORKDIR /app

COPY app.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
```

Java 21 프로젝트라면 Runtime도 Java 21 계열로 맞춘다.

```dockerfile
FROM eclipse-temurin:21-jre
```

로컬에서 빌드한 Java 버전보다 낮은 Runtime으로 실행하면 클래스 버전 오류가 발생할 수 있으므로 빌드 JDK와 서버 Runtime의 호환성을 맞춰야 한다.

## 5. Docker Compose 구성

`compose.yaml` 예시는 다음과 같다.

```yaml
services:
  api:
    build:
      context: .
    container_name: api
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8080:8080"
    networks:
      - app-network

networks:
  app-network:
    external: true
```

MySQL이 같은 Docker Network에 있다면 환경변수에서 서비스명을 사용할 수 있다.

```env
DB_URL=jdbc:mysql://mysql:3306/app
DB_USERNAME=app_user
DB_PASSWORD=change-this-password
```

실제 `.env` 파일에는 비밀번호가 포함될 수 있으므로 Git에 올리지 않는다.

```gitignore
.env
```

## 6. 자동화 전에 수동 배포 확인

먼저 로컬에서 빌드한다.

```bash
./gradlew bootJar
```

JAR를 확인한다.

```bash
ls -lh build/libs
```

서버에 올린다.

```bash
scp build/libs/example.jar \
    user@server.example.com:~/docker/api/app.jar
```

서버에 접속한다.

```bash
ssh user@server.example.com
```

Compose를 다시 빌드하고 실행한다.

```bash
cd ~/docker/api
docker compose up -d --build
```

상태 확인:

```bash
docker compose ps
```

로그 확인:

```bash
docker compose logs -f api
```

이 흐름이 정상일 때 자동화해야 문제를 구분하기 쉽다.

## 7. 기본 `deploy.sh`

프로젝트 루트에 다음 파일을 만든다.

```bash
#!/bin/bash

set -euo pipefail

SERVER="user@server.example.com"
REMOTE_DIR="~/docker/api"

echo "[1/4] Build JAR"
./gradlew bootJar

echo "[2/4] Find JAR"
JAR_FILE=$(find build/libs \
    -maxdepth 1 \
    -type f \
    -name "*.jar" \
    ! -name "*-plain.jar" \
    | head -n 1)

if [ -z "$JAR_FILE" ]; then
    echo "JAR file not found"
    exit 1
fi

echo "[3/4] Upload"
scp "$JAR_FILE" "$SERVER:$REMOTE_DIR/app.jar"

echo "[4/4] Deploy"
ssh "$SERVER" \
    "cd $REMOTE_DIR && docker compose up -d --build"

echo "Deploy complete"
```

실행 권한을 추가한다.

```bash
chmod +x deploy.sh
```

이후 배포는 다음 한 줄로 처리한다.

```bash
./deploy.sh
```

## 8. SSH 포트가 22번이 아닌 경우

SSH 포트를 별도로 사용하는 서버라면 변수로 분리한다.

```bash
SSH_PORT="2200"
```

SCP:

```bash
scp -P "$SSH_PORT" "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar"
```

SSH:

```bash
ssh -p "$SSH_PORT" "$SERVER" \
    "cd $REMOTE_DIR && docker compose up -d --build"
```

`scp`는 대문자 `-P`, `ssh`는 소문자 `-p`를 사용한다.

## 9. 업로드 중 파일 손상 방지

현재 사용 중인 `app.jar` 위에 바로 업로드하기보다 임시 파일명을 사용하는 편이 안전하다.

```bash
scp "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar.new"
```

업로드가 끝난 뒤 서버에서 교체한다.

```bash
ssh "$SERVER" "
    set -e
    cd $REMOTE_DIR
    mv app.jar.new app.jar
    docker compose up -d --build
"
```

전송이 실패하면 기존 `app.jar`는 그대로 남는다.

## 10. 실사용 형태의 배포 스크립트

앞 내용을 하나로 합치면 다음과 같다.

```bash
#!/bin/bash

set -euo pipefail

SERVER="user@server.example.com"
REMOTE_DIR="~/docker/api"
SSH_PORT="2200"

echo "[1/5] Build"
./gradlew bootJar

echo "[2/5] Find JAR"
JAR_FILE=$(find build/libs \
    -maxdepth 1 \
    -type f \
    -name "*.jar" \
    ! -name "*-plain.jar" \
    | head -n 1)

if [ -z "$JAR_FILE" ]; then
    echo "JAR file not found"
    exit 1
fi

echo "[3/5] Upload"
scp -P "$SSH_PORT" \
    "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar.new"

echo "[4/5] Deploy"
ssh -p "$SSH_PORT" "$SERVER" "
    set -e
    cd $REMOTE_DIR

    if [ -f app.jar ]; then
        cp app.jar app.jar.backup
    fi

    mv app.jar.new app.jar
    docker compose up -d --build
"

echo "[5/5] Check"
ssh -p "$SSH_PORT" "$SERVER" "
    cd $REMOTE_DIR
    docker compose ps
"

echo "Deploy complete"
```

## 11. `docker compose restart`만 사용하면 안 되는 이유

Dockerfile이 다음과 같다고 가정한다.

```dockerfile
COPY app.jar app.jar
```

호스트의 `app.jar`가 바뀌어도 기존 Docker Image 내부 JAR는 그대로이다.

다음 명령은 기존 컨테이너만 다시 시작한다.

```bash
docker compose restart
```

새 JAR를 Image에 반영하려면 다시 빌드해야 한다.

```bash
docker compose up -d --build
```

Compose는 변경된 Image나 설정이 있으면 필요한 컨테이너를 재생성한다.

## 12. 매번 `docker compose down`할 필요는 없다

다음 방식도 동작한다.

```bash
docker compose down
docker compose up -d --build
```

하지만 API 하나를 재배포하기 위해 DB 같은 다른 컨테이너까지 모두 내릴 필요는 없다.

일반적인 재배포라면 다음 명령으로 충분한 경우가 많다.

```bash
docker compose up -d --build
```

불필요한 전체 서비스 중단을 줄일 수 있다.

## 13. 간단한 롤백 구성

새 버전에 문제가 생겼을 때 직전 JAR를 복구할 수 있도록 기존 파일을 남겨둔다.

배포 전:

```bash
cp app.jar app.jar.backup
```

문제가 발생하면:

```bash
mv app.jar.backup app.jar
docker compose up -d --build
```

개인 프로젝트나 소규모 서비스에서는 이 정도도 유용하다.

서비스 규모가 커지면 Docker Image Tag나 Artifact 저장소를 이용해 버전별로 관리하는 방식이 더 적합하다.

## 14. 배포 후 확인할 항목

스크립트가 끝났다고 배포 성공으로 판단하면 안 된다.

최소한 다음 항목을 확인한다.

```text
컨테이너가 Up 상태인가
Spring Boot가 정상 기동됐는가
DB Connection 오류가 없는가
환경변수가 정상 적용됐는가
서비스 포트가 열렸는가
```

최근 로그:

```bash
docker compose logs --tail=100 api
```

실시간 로그:

```bash
docker compose logs -f api
```

## 15. 서버에서 직접 빌드하지 않는 이유

전체 소스를 서버에 올리고 Gradle로 빌드하는 방식도 가능하다.

하지만 로컬 빌드 후 JAR만 전송하면 다음 장점이 있다.

```text
서버에 Gradle 설치 불필요
소스 전체 업로드 불필요
서버 CPU와 메모리 사용 감소
배포 Artifact가 명확함
서버 디렉터리 구조가 단순함
```

소규모 프로젝트에는 충분히 실용적이다.

여러 개발자가 함께 작업하거나 배포 빈도가 높아지면 같은 흐름을 GitHub Actions, Jenkins, GitLab CI 같은 CI/CD로 옮기면 된다.

## 최종 흐름

로컬에서는 다음 명령 하나만 실행한다.

```bash
./deploy.sh
```

내부 동작:

```text
./gradlew bootJar
↓
build/libs에서 JAR 검색
↓
app.jar.new로 SCP 업로드
↓
기존 JAR 백업
↓
app.jar 교체
↓
docker compose up -d --build
↓
docker compose ps
```

## 마무리

Spring Boot 애플리케이션을 Ubuntu Docker 서버에 배포할 때 전체 소스를 서버로 복사할 필요는 없다.

핵심은 다음 세 단계이다.

```text
로컬에서 실행 가능한 JAR 생성
+
JAR만 서버에 전송
+
Docker Image 재빌드
```

이 과정을 쉘 스크립트로 묶으면 반복 배포를 한 줄로 줄일 수 있다.

수동 배포 절차가 명확하게 정리되어 있으면 이후 CI/CD로 확장하기도 쉽다.

## 참고 자료

- Spring Boot Gradle Plugin - Packaging Executable Archives  
  https://docs.spring.io/spring-boot/gradle-plugin/packaging.html
- Docker Compose `up`  
  https://docs.docker.com/reference/cli/docker/compose/up/
- Docker Compose Services  
  https://docs.docker.com/reference/compose-file/services/
