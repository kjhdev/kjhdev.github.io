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
ssh     -N     -L 127.0.0.1:13306:127.0.0.1:3306     user@server.example.com
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
ssh     -N     -L 127.0.0.1:13306:127.0.0.1:3306     -o ExitOnForwardFailure=yes     user@server.example.com
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
ssh     -N     -L 127.0.0.1:13306:127.0.0.1:3306     -o ExitOnForwardFailure=yes     -o ServerAliveInterval=60     -o ServerAliveCountMax=3     user@server.example.com
```

## SSH 포트가 다른 경우

```bash
ssh     -p 2200     -N     -L 127.0.0.1:13306:127.0.0.1:3306     -o ExitOnForwardFailure=yes     user@server.example.com
```

실제 포트는 서버 설정에 맞게 변경한다.

## 백그라운드 실행

`-f`를 사용하면 인증 후 SSH 클라이언트를 백그라운드로 보낼 수 있다.

```bash
ssh     -f     -N     -L 127.0.0.1:13306:127.0.0.1:3306     -o ExitOnForwardFailure=yes     user@server.example.com
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
mysql     -h 127.0.0.1     -P 13306     -u app_user     -p
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
ssh     -N     -L 127.0.0.1:13306:127.0.0.1:3306     -o ExitOnForwardFailure=yes     -o ServerAliveInterval=60     -o ServerAliveCountMax=3     user@server.example.com
```

로컬 애플리케이션은 다음 주소를 사용한다.

```text
127.0.0.1:13306
```

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
