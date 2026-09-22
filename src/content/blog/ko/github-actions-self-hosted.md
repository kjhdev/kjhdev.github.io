---
title: "GitHub Actions Self-hosted Runner로 내부 서버 자동 배포하기"
pubDate: "2026-09-22T07:36:00+09:00"
description: "외부에서 직접 SSH로 접근하기 어려운 내부 서버에 GitHub Actions Self-hosted Runner를 설치해 main push를 자동 배포로 연결하는 구조와 설정 시 주의점을 정리한다."
category: "DevOps"
tags: ["GitHub Actions", "Self-hosted Runner", "CI/CD", "Deployment", "Docker"]
lang: "ko"
---

# GitHub Actions Self-hosted Runner로 내부 서버 자동 배포하기

개발 서버에서 주기적으로 `git pull`을 실행하는 방식은 단순하지만, 배포 시점을 서버가 직접 확인해야 한다.

반대로 GitHub의 `main` 브랜치에 코드가 반영되는 순간 배포를 시작하면 소스 변경과 배포 시점을 일치시키기 쉽다.

문제는 배포 대상이 공유기나 방화벽 뒤의 내부 서버일 때다. GitHub-hosted Runner에서 해당 서버로 직접 SSH 접속할 수 없다면 **Self-hosted Runner를 내부 서버에 설치해 작업을 받아 실행하는 방식**을 사용할 수 있다.

## 기존 pull 방식의 한계

서버가 직접 저장소를 확인하는 구조는 보통 다음과 같다.

```text
개발 PC → GitHub
             ↑
          서버가 pull
```

수동 `git pull`이라면 배포할 때마다 서버에 접속해야 한다. cron으로 자동화하면 변경 여부와 관계없이 정해진 시간에 확인하는 구조가 된다.

CI/CD 관점에서는 GitHub의 변경 이벤트를 기준으로 배포 작업을 시작하는 편이 흐름을 추적하기 쉽다.

## 내부 서버가 문제인 이유

GitHub-hosted Runner에서 SSH로 배포하려면 대상 서버가 Runner에서 접근 가능한 네트워크에 있어야 한다.

하지만 서버가 사설 IP만 사용하고 외부 SSH를 열지 않았다면 다음 연결은 성립하지 않는다.

```text
GitHub-hosted Runner
        X
        ↓
192.168.x.x 내부 서버
```

이 문제를 해결하기 위해 배포 서버 또는 같은 내부망의 머신에서 Self-hosted Runner를 실행할 수 있다.

## Self-hosted Runner 구조

Self-hosted Runner는 GitHub Actions 작업을 직접 실행하는 머신이다.

```text
main push
   ↓
GitHub Actions
   ↓
Self-hosted Runner
   ↓
내부 서버에서 build / deploy
```

핵심은 GitHub가 내부 서버의 SSH 포트로 직접 들어오는 구조가 아니라는 점이다. Runner가 GitHub Actions와 통신하면서 할당된 작업을 받아 실행한다.

따라서 배포를 위해 내부 서버의 SSH 포트를 인터넷에 공개하는 구조를 피할 수 있다.

## Runner 등록

GitHub 저장소의 Actions Runner 설정에서 운영체제에 맞는 설치 명령을 확인한다.

Linux 서버라면 일반적인 과정은 다음과 같다.

```bash
mkdir actions-runner
cd actions-runner

# GitHub에서 안내하는 Runner 패키지 다운로드 및 압축 해제
# 저장소 설정 화면에서 발급된 등록 명령 실행

./config.sh --url https://github.com/username/project --token <registration-token>
```

등록 토큰은 예시나 저장소에 남기지 않는다. GitHub 설정 화면에서 제공되는 현재 명령을 사용한다.

등록 후 Runner를 실행한다.

```bash
./run.sh
```

운영 서버에서는 터미널 종료와 함께 Runner가 멈추지 않도록 서비스 방식으로 실행하는 것이 적합하다.

## workflow 작성

`.github/workflows/deploy.yml`을 만들고 `main` push를 트리거로 지정한다.

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: self-hosted

    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        run: ./deploy.sh
```

`runs-on: self-hosted`가 GitHub-hosted Runner와의 핵심 차이다.

이제 `main`에 push되면 등록된 Self-hosted Runner가 작업을 받아 `deploy.sh`를 실행한다.

## 서버에서 다시 git pull 해야 할까

`actions/checkout`을 사용하면 Runner의 작업 디렉터리에 해당 커밋이 checkout된다.

따라서 기존처럼 별도의 운영 디렉터리에서 `git pull`하는 구조를 반드시 유지할 필요는 없다.

예를 들어 빌드 결과물을 배포하는 방식이라면 다음 흐름으로 바꿀 수 있다.

```text
GitHub main
   ↓
actions/checkout
   ↓
build
   ↓
Docker image 또는 배포 파일 생성
   ↓
서비스 재시작
```

소스 저장소와 실제 실행 디렉터리를 분리하면 배포 과정도 더 명확해진다.

## Docker 프로젝트 배포 예시

서버에서 Docker Compose로 서비스를 운영한다면 `deploy.sh`를 다음처럼 구성할 수 있다.

```bash
#!/bin/bash
set -e

docker compose build
docker compose up -d
```

실제 프로젝트에서는 테스트, 환경변수 확인, 이미지 정리 등 필요한 절차를 추가한다.

중요한 점은 `.env`, API Key, 비밀번호 같은 값을 workflow 파일에 직접 작성하지 않는 것이다.

## Runner 권한을 최소화한다

Self-hosted Runner의 workflow는 서버에서 실제 명령을 실행한다.

따라서 Runner 계정에 불필요한 root 권한을 주지 않는 것이 중요하다.

Docker 명령이 필요하다면 필요한 범위의 권한만 부여하고, 배포와 관계없는 디렉터리나 서비스에 접근하지 못하도록 구성한다.

특히 외부 기여자가 임의의 workflow를 실행할 수 있는 저장소에서는 Self-hosted Runner 사용 범위를 더 엄격하게 제한해야 한다.

## main push와 배포를 분리하고 싶다면

모든 `main` push를 즉시 운영 배포로 연결할 필요는 없다.

테스트 작업과 배포 작업을 분리해 다음처럼 구성할 수도 있다.

```text
push
 ↓
test
 ↓
build
 ↓
deploy
```

테스트가 실패하면 deploy 단계가 실행되지 않도록 구성하면 잘못된 빌드가 서버에 반영되는 것을 줄일 수 있다.

## 정리

내부 서버의 배포 방식을 서버 주도의 `git pull`에서 GitHub Actions 중심으로 바꾸려면 네트워크 접근 방식을 먼저 확인해야 한다.

외부에서 서버로 직접 접근하기 어렵다면 Self-hosted Runner가 실용적인 선택지가 된다.

```text
기존
서버 → GitHub 확인 → git pull

변경
GitHub push → Actions 작업 생성 → 내부 Runner가 작업 실행
```

이 구조에서는 내부 서버의 SSH 포트를 배포 목적으로 외부에 공개하지 않고도 `main` push를 자동 빌드와 배포로 연결할 수 있다.
