---
title: "Synology 내부 서버를 GitHub Actions Self-hosted Runner로 자동 배포한 과정"
pubDate: "2026-09-22T07:36:00+09:00"
description: "Synology VM의 Ubuntu 서버에서 여러 Docker 서비스를 운영하면서 외부 SSH 배포 대신 Self-hosted Runner로 main push와 배포를 연결한 실제 구성과 운영 시 주의점을 정리합니다."
category: "DevOps"
tags: ["GitHub Actions", "Self-hosted Runner", "CI/CD", "Deployment", "Docker", "Synology"]
lang: "ko"
---

개인 프로젝트 여러 개를 Synology VM의 Ubuntu 서버에서 Docker로 운영하면서 배포 방식이 점점 번거로워졌다. 로컬에서 수정한 뒤 GitHub에 push하고 다시 서버에 접속해 `git pull`과 Docker 재시작을 반복하는 방식이었다.

서버는 내부망에 있고, 배포만을 위해 SSH를 인터넷에 넓게 공개하고 싶지는 않았다. 그래서 **GitHub Actions Self-hosted Runner를 서버 쪽에 두고 `main` push를 배포 시작점으로 만드는 구조**로 변경했다.

## 바꾸기 전과 후

```text
기존
Mac → GitHub push
     → 서버 SSH 접속
     → git pull
     → docker compose 재배포

변경
Mac → GitHub main push
     → GitHub Actions
     → 내부 Self-hosted Runner
     → build / deploy
```

이 구조의 장점은 GitHub-hosted Runner가 사설망 서버로 SSH 접속할 필요가 없다는 점이었다. 내부 Runner가 GitHub에서 작업을 받아 서버에서 직접 실행한다.

## 여러 Docker 프로젝트에서 중요했던 점

서버에는 하나의 서비스만 있는 것이 아니었다. 여러 프로젝트가 각자의 Compose 파일과 포트를 사용한다. 따라서 Runner에 무조건 root 권한을 주고 아무 디렉터리에서나 배포하도록 만드는 대신 **저장소별 배포 경로와 명령을 명확하게 분리**하는 것이 중요했다.

기본 workflow는 단순하다.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh
```

실제 차이는 `deploy.sh` 안에서 생긴다. 프로젝트마다 필요한 빌드, Compose 파일, 환경변수, 재시작 범위가 다르기 때문이다.

## Runner와 서비스 디렉터리를 구분한다

`actions/checkout`은 Runner 작업 디렉터리에 해당 커밋을 checkout한다. 운영 디렉터리에서 계속 `git pull`하는 방식과 혼합하면 어느 소스가 실제 배포됐는지 헷갈릴 수 있다.

둘 중 하나를 명확히 선택하는 편이 좋았다.

```text
A. Runner workspace에서 빌드 → 산출물/이미지 배포
B. 운영 디렉터리를 명시적으로 동기화 → 해당 디렉터리에서 Compose 실행
```

## Docker 배포는 서비스 범위를 작게 잡는다

단순 예시는 다음과 같다.

```bash
#!/bin/bash
set -euo pipefail

docker compose build
docker compose up -d
```

여러 서비스가 같은 서버에 있을 때는 한 프로젝트를 배포하면서 관계없는 컨테이너까지 내리지 않는 것이 중요하다. 습관적으로 전체 Docker를 재시작하거나 불필요하게 `docker compose down`을 사용하는 방식은 피했다.

## 실제 운영에서 겪은 문제: Runner가 있다고 배포가 항상 되는 것은 아니다

Self-hosted Runner는 서버 상태의 영향을 그대로 받는다.

예를 들어 서버 디스크가 가득 차면 Docker build가 실패하고, Runner 프로세스나 작업 디렉터리에 문제가 생기면 workflow도 진행되지 않는다. 실제 운영에서는 소스만 보는 것보다 다음을 함께 확인해야 했다.

```bash
df -h
docker ps
docker system df
```

Git 저장소에 `index.lock` 같은 비정상 상태가 남아 있거나 서버 재부팅 후 Runner/컨테이너 상태가 달라진 경우도 배포 실패 원인이 될 수 있다.

즉 Self-hosted Runner는 "GitHub가 알아서 서버를 관리해 주는 서비스"가 아니라 **내 서버에서 CI/CD 명령을 실행하는 에이전트**다.

## 환경변수와 비밀값은 저장소에 넣지 않는다

서버에서 사용하는 `.env`, API Key, DB 비밀번호는 workflow 예제에 직접 넣지 않는다. 배포 스크립트도 비밀값을 출력하지 않도록 한다.

```text
Git 저장소: 소스와 배포 절차
서버: 실행 환경에 필요한 비밀값
```

## 배포 성공 기준을 workflow 종료로만 잡지 않는다

Docker 명령이 exit 0으로 끝났더라도 애플리케이션이 정상 기동하지 못할 수 있다. 최소한 컨테이너 상태와 최근 로그를 확인하는 단계를 두는 것이 좋다.

```bash
docker compose ps
docker compose logs --tail=100
```

가능하면 서비스의 health check나 실제 HTTP 응답 확인까지 연결한다.

## 이 구조가 잘 맞았던 이유

내부 서버를 계속 운영하면서 프로젝트 수가 늘어날수록 수동 SSH 배포는 반복 작업이 됐다. Self-hosted Runner로 바꾼 뒤에는 `main`에 어떤 커밋이 들어갔는지와 어떤 배포 작업이 실행됐는지를 GitHub Actions에서 함께 추적할 수 있게 됐다.

다만 자동화의 범위는 작게 유지하는 편이 안전했다. 저장소 하나의 배포가 다른 Docker 프로젝트에 영향을 주지 않도록 하고, 실패하면 로그에서 어느 단계가 문제인지 확인할 수 있어야 한다.

Self-hosted Runner의 핵심 장점은 단순히 "자동 배포"가 아니라 **사설망 서버를 외부 배포용 SSH 대상으로 만들지 않고도 GitHub 이벤트와 내부 서버 작업을 연결할 수 있다는 것**이다.
