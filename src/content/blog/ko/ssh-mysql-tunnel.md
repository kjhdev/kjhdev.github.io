---
title: "SSH 터널로 원격 MySQL에 안전하게 접속하는 방법"
pubDate: 2026-09-16T09:16:31+09:00
description: "원격 MySQL의 3306 포트를 외부에 공개하지 않고 SSH Local Port Forwarding으로 로컬 개발환경에서 안전하게 접속하는 방법을 정리한다."
category: Server
tags:
  - SSH
  - MySQL
  - Port Forwarding
  - Ubuntu
  - Security
lang: ko
updatedDate: "2026-10-12"
---

개발 PC에서 원격 MySQL에 접속해야 할 때 3306 포트를 인터넷에 직접 공개할 필요는 없다.

SSH Local Port Forwarding을 사용하면 로컬 포트를 SSH 서버를 통해 원격 MySQL로 전달할 수 있다.

```text
로컬 PC
127.0.0.1:13306
  ↓
SSH 터널
  ↓
원격 서버
127.0.0.1:3306
  ↓
MySQL
```

## 기본 명령

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 user@server.example.com
```

`-L` 형식은 다음과 같다.

```text
-L [로컬주소:]로컬포트:원격호스트:원격포트
```

`-N`은 원격 명령을 실행하지 않고 포트포워딩만 수행한다.

## 로컬 애플리케이션 설정

Spring Boot라면 로컬 터널 포트를 사용한다.

```env
DB_URL=jdbc:mysql://127.0.0.1:13306/app
DB_USERNAME=app_user
DB_PASSWORD=example-password
```

애플리케이션 입장에서는 MySQL이 로컬 `13306` 포트에 있는 것처럼 보인다.

## 왜 `127.0.0.1`로 바인딩하는가

다음처럼 loopback 주소를 명시하는 편이 좋다.

```text
127.0.0.1:13306
```

OpenSSH의 `-L`은 로컬에 listening socket을 만든다. `127.0.0.1`로 제한하면 같은 PC에서만 해당 포트에 접근할 수 있다.

개발용 DB 터널을 다른 장비에 공개할 이유가 없다면 이 구성이 안전하다.

## 포워딩 생성 실패 감지

로컬 포트가 이미 사용 중이라면 터널 생성이 실패할 수 있다.

다음 옵션을 추가한다.

```bash
-o ExitOnForwardFailure=yes
```

예:

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

이 옵션은 요청한 포워딩을 만들지 못하면 SSH 연결을 종료하게 한다.

단, 포워딩이 만들어진 이후 최종 MySQL 서버 연결까지 항상 성공하는 것을 보장하는 옵션은 아니다.

## keepalive 추가

장시간 사용 시 죽은 SSH 연결을 감지하려면 다음 옵션을 추가할 수 있다.

```bash
-o ServerAliveInterval=60
-o ServerAliveCountMax=3
```

전체 예:

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@server.example.com
```

## SSH 포트가 다른 경우

```bash
ssh -p 2200 -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

실제 포트는 서버 설정에 맞게 변경한다.

## 백그라운드 실행

`-f`를 사용하면 인증 후 SSH 클라이언트를 백그라운드로 보낼 수 있다.

```bash
ssh -f -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

자동화할 때는 같은 터널이 이미 실행 중인지 먼저 확인하는 편이 좋다.

## 터널 확인

macOS나 Linux에서:

```bash
lsof -iTCP:13306 -sTCP:LISTEN
```

또는:

```bash
nc -z 127.0.0.1 13306
```

MySQL Client가 있다면 실제 접속까지 확인한다.

```bash
mysql -h 127.0.0.1 -P 13306 -u app_user -p
```

## 원격 MySQL이 Docker에 있는 경우

MySQL 컨테이너를 원격 서버 loopback에만 publish할 수 있다.

```yaml
ports:
  - "127.0.0.1:3306:3306"
```

그러면 SSH 터널 목적지는 그대로 사용할 수 있다.

```text
127.0.0.1:3306
```

이 구조에서는 MySQL 3306을 인터넷에 공개하지 않고 SSH를 통해서만 접근할 수 있다.

## 최종 추천 명령

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@server.example.com
```

로컬 애플리케이션은 다음 주소를 사용한다.

```text
127.0.0.1:13306
```

## 문제를 실제로 분리해서 확인하는 순서

다음 구성은 명령을 재현하기 위한 **예시 환경**입니다. 실제 서버 호스트명, 포트, 계정은 각자의 환경에 맞게 바꿔야 합니다.

| 구간 | 예시 | 확인할 사항 |
|---|---|---|
| 개발 PC | macOS, `127.0.0.1:13306` | 로컬 포트 충돌 여부 |
| SSH 대상 | Ubuntu 서버, SSH 22번 | SSH 인증 및 방화벽 |
| DB 서비스 | 서버의 `127.0.0.1:3306` | MySQL 또는 Docker 포트 매핑 |
| 클라이언트 | Spring Boot, MySQL CLI | 사용자 권한과 DB 이름 |

1. 먼저 `ssh user@server.example.com`으로 **SSH 로그인 자체가 되는지** 확인한다.
2. 서버에 로그인한 뒤 `ss -lntp | grep 3306`으로 MySQL이 기대한 주소에서 대기하는지 확인한다. Docker 구성이라면 `docker ps`의 포트 매핑도 비교한다.
3. 개발 PC에서 포워딩을 실행한다. 종료되지 않고 대기하는 것은 `-N` 사용 시 정상 동작이다.
4. **다른 터미널**에서 아래 명령으로 실제 데이터베이스까지 확인한다.

```bash
mysql -h 127.0.0.1 -P 13306 -u app_user -p -e "SELECT 1"
```

`lsof`와 `nc`의 성공은 로컬에 포트가 열렸다는 근거이지, **DB 인증까지 성공했다는 뜻은 아니다**. 최종 검증은 실제 MySQL 클라이언트나 애플리케이션에서 수행한다.

## 오류 메시지별로 확인할 지점

| 증상 | 먼저 살펴볼 위치 | 조치 |
|---|---|---|
| `Address already in use` | 개발 PC | `lsof -nP -iTCP:13306 -sTCP:LISTEN`으로 포트 점유 확인 |
| SSH `Permission denied` | SSH 연결 | 계정·키·인증 설정 확인 |
| 터널은 열리지만 DB에서 `Connection refused` | 서버의 목적지 포트 | 서버에서 `127.0.0.1:3306` 리스닝 여부 및 Docker 매핑 확인 |
| MySQL `Access denied` | DB 계정 | MySQL 사용자·비밀번호·접근 권한 확인 |
| 연결 후 자주 끊김 | 네트워크·SSH | ServerAlive 설정과 서버 측 연결 종료 조건 확인 |

SSH 포워딩은 **네트워크 경로를 제공하는 기능**이다. 암호화된 터널이 있다고 해서 MySQL 계정의 권한, 서버 방화벽, SQL 접근 통제가 불필요해지는 것은 아니다.

## 개발 환경에서 함께 점검할 글

- [Spring Boot에서 DB_URL이 치환되지 않는 경우](/ko/posts/spring-env-db-url/): 터널은 정상인데 애플리케이션 연결만 실패할 때
- [Spring Boot 애플리케이션을 Docker로 배포하기](/ko/posts/spring-boot-docker-deploy/): 로컬 환경과 컨테이너 내부 네트워크의 차이를 확인할 때

## 마무리

SSH 터널을 사용하면 MySQL 3306 포트를 인터넷에 직접 공개하지 않고 원격 DB에 접속할 수 있다.

핵심은 다음 세 가지이다.

```text
MySQL 포트는 외부에 공개하지 않는다
로컬 터널은 127.0.0.1에 바인딩한다
애플리케이션은 로컬 포트로 접속한다
```

## 참고 자료

- OpenSSH ssh Manual  
  https://man.openbsd.org/ssh
- OpenSSH ssh_config  
  https://man.openbsd.org/ssh_config
