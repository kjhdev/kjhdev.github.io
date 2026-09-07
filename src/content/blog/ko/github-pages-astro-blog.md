---
title: "GitHub Pages + Astro로 무료 개발 블로그 만들기"
description: "GitHub Pages와 Astro를 이용해 별도 호스팅 비용 없이 개발 블로그를 만들고 배포하는 과정을 정리합니다."
lang: "ko"
pubDate: 2026-09-07T14:30:00+09:00
category: "Web Development"
tags:
  - Astro
  - GitHub Pages
  - GitHub Actions
  - Blog
draft: false
---

개발하면서 알게 된 내용이나 문제 해결 과정을 기록하기 위해 개인 개발 블로그를 만들기로 했다.

블로그 플랫폼을 이용하는 방법도 있지만, 개발자라면 직접 소스를 관리하고 원하는 형태로 수정할 수 있는 구성이 더 편할 수 있다. 이번에는 **Astro로 정적 블로그를 만들고 GitHub Pages에 무료로 배포하는 방법**을 정리한다.

최종적으로 다음과 같은 구조를 만든다.

```text
Markdown으로 글 작성
        ↓
Astro
        ↓
정적 HTML 생성
        ↓
GitHub Actions
        ↓
GitHub Pages
        ↓
https://사용자명.github.io
```

GitHub Pages는 정적 웹사이트를 무료로 호스팅할 수 있기 때문에 개인 블로그나 기술 문서를 운영하기에 적합하다.

## 1. GitHub Pages 저장소 만들기

GitHub 계정명이 `kjhdev`라면 저장소 이름을 다음과 같이 만든다.

```text
kjhdev.github.io
```

사용자 페이지용 저장소는 반드시 다음 규칙을 따른다.

```text
GitHub계정명.github.io
```

저장소를 만든 후 로컬로 내려받는다.

```bash
git clone https://github.com/kjhdev/kjhdev.github.io.git
cd kjhdev.github.io
```

이 저장소에 Astro 프로젝트를 구성하고 나중에 GitHub Actions를 통해 빌드 결과물을 배포한다.

## 2. Node.js 버전 확인

Astro를 설치하기 전에 Node.js 버전을 확인한다.

```bash
node -v
npm -v
```

Node.js 버전을 여러 개 사용한다면 `nvm`을 이용하면 편하다.

예를 들어 Node.js 22를 설치하고 사용하는 방법은 다음과 같다.

```bash
nvm install 22
nvm use 22
```

기본 버전으로 지정하려면 다음 명령어를 사용한다.

```bash
nvm alias default 22
```

다시 버전을 확인한다.

```bash
node -v
```

## 3. Astro 프로젝트 생성

GitHub 저장소 폴더에서 다음 명령어를 실행한다.

```bash
npm create astro@latest .
```

프로젝트 템플릿은 직접 블로그 구조를 만들 예정이므로 최소 구성을 선택했다.

```text
Use minimal (empty) template
```

이미 GitHub 저장소를 clone한 상태라면 Git 저장소를 새로 초기화할 필요는 없다.

설치가 완료되면 개발 서버를 실행한다.

```bash
npm run dev
```

기본 주소는 다음과 같다.

```text
http://localhost:4321
```

브라우저에서 정상적으로 Astro 페이지가 보이면 기본 프로젝트 생성이 완료된 것이다.

## 4. 블로그 페이지 구조 만들기

한국어와 영어 글을 별도의 URL로 운영하기 위해 다음과 같은 구조를 사용했다.

```text
src/
├── content/
│   └── blog/
│       ├── ko/
│       └── en/
├── layouts/
│   └── BaseLayout.astro
└── pages/
    ├── index.astro
    ├── ko/
    │   └── index.astro
    ├── en/
    │   └── index.astro
    └── [lang]/
        └── posts/
            └── [slug].astro
```

실제 URL은 다음과 같이 생성된다.

```text
/ko/posts/first-post/
/en/posts/first-post/
```

같은 글의 한국어판과 영어판은 동일한 파일명을 사용하면 관리하기 편하다.

```text
src/content/blog/ko/first-post.md
src/content/blog/en/first-post.md
```

## 5. Markdown으로 글 작성하기

Astro Content Collection을 사용하면 Markdown 파일에 글 정보를 함께 정의할 수 있다.

예를 들어 다음과 같이 작성한다.

```markdown
---
title: "첫 번째 개발 글"
description: "첫 번째 개발 글에 대한 설명입니다."
lang: "ko"
pubDate: 2026-09-07
category: "Flutter"
tags:
  - Flutter
  - Desktop
draft: false
---

여기에 실제 글 내용을 작성한다.
```

`draft: true`로 설정한 글은 목록과 배포 대상에서 제외하도록 구성할 수 있다.

글을 추가할 때마다 HTML 파일을 직접 만들 필요 없이 Markdown 파일만 추가하면 되는 것이 정적 사이트 생성기를 사용하는 가장 큰 장점 중 하나다.

## 6. GitHub Pages용 Astro 설정

`astro.config.mjs`에 실제 사이트 주소를 지정한다.

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kjhdev.github.io',
});
```

사용자 대표 GitHub Pages 저장소인 `kjhdev.github.io`를 사용하는 경우 별도의 `base` 경로는 필요하지 않다.

일반 프로젝트 저장소를 GitHub Pages로 배포한다면 저장소 이름에 따라 `base` 설정이 추가로 필요할 수 있다.

## 7. GitHub Actions로 자동 배포하기

프로젝트에 다음 파일을 만든다.

```text
.github/workflows/deploy.yml
```

예시는 다음과 같다.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Build Astro
        uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

GitHub 저장소에서 다음 메뉴로 이동한다.

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

이 설정이 중요하다. 기존의 `Deploy from a branch`가 선택되어 있으면 저장소의 원본 파일이 직접 배포되어 Astro 빌드 결과가 표시되지 않을 수 있다.

## 8. 실제 배포하기

먼저 로컬에서 빌드가 정상적으로 되는지 확인한다.

```bash
npm run build
```

문제가 없다면 GitHub에 반영한다.

```bash
git add .
git commit -m "Set up Astro blog"
git push origin main
```

`main` 브랜치에 push하면 GitHub Actions가 자동으로 실행된다.

```text
git push
   ↓
GitHub Actions
   ↓
Astro build
   ↓
GitHub Pages deploy
```

Actions 메뉴에서 `build`와 `deploy` 작업이 모두 성공하면 실제 주소로 접속한다.

```text
https://kjhdev.github.io
```

## 9. 이후 글을 올리는 방법

한 번 배포 환경을 만들어 놓으면 이후에는 과정이 매우 단순하다.

Markdown 파일을 추가하거나 수정한 후 다음 명령어만 실행하면 된다.

```bash
git add .
git commit -m "Add new post"
git push origin main
```

GitHub Actions가 다시 실행되고 변경된 블로그가 자동으로 배포된다.

다른 PC에서 작업할 때도 저장소를 clone하고 `npm install`만 실행하면 동일한 환경에서 작업할 수 있다.

```bash
git clone https://github.com/kjhdev/kjhdev.github.io.git
cd kjhdev.github.io
npm install
npm run dev
```

작업을 시작하기 전에는 최신 내용을 먼저 받는 습관을 들이는 것이 좋다.

```bash
git pull origin main
```

## 마무리

Astro와 GitHub Pages를 조합하면 별도의 웹 호스팅 비용 없이 개발 블로그를 운영할 수 있다.

특히 개발자 입장에서는 다음과 같은 장점이 있다.

- 블로그 전체 소스를 Git으로 관리할 수 있다.
- Markdown으로 글을 작성할 수 있다.
- HTML, CSS를 자유롭게 수정할 수 있다.
- GitHub에 push하는 것만으로 자동 배포할 수 있다.
- 별도의 서버를 운영할 필요가 없다.
- 나중에 개인 도메인도 연결할 수 있다.

앞으로 이 블로그에는 Flutter, Spring Boot, Node.js, Docker 등 실제 개발 과정에서 사용한 기술과 문제 해결 과정을 중심으로 기록할 예정이다.
