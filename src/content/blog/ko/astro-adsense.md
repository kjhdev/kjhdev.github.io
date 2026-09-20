---
title: "Astro GitHub Pages에 Google AdSense 적용하기"
pubDate: "2026-09-21T08:09:44+09:00"
description: "Astro 기반 GitHub Pages 블로그에 Google AdSense 코드를 추가하고 ads.txt를 루트 경로에 배포한 뒤 정상 노출 여부를 확인하는 방법을 정리합니다."
category: "Blog"
tags: ["Astro", "GitHub Pages", "AdSense", "ads.txt", "SEO"]
lang: "ko"
---

# Astro GitHub Pages에 Google AdSense 적용하기

Astro로 만든 GitHub Pages 블로그에 Google AdSense를 연결할 때는 크게 두 가지를 준비한다.

하나는 페이지의 `<head>`에 들어가는 AdSense 스크립트이고, 다른 하나는 사이트 루트에서 접근할 수 있는 `ads.txt`다.

이 글에서는 Astro 프로젝트에서 두 항목을 어디에 넣고 어떻게 확인하는지 정리한다.

## AdSense 코드는 공통 Layout에 추가한다

여러 페이지에서 같은 `<head>`를 사용하는 Astro 프로젝트라면 각 페이지마다 AdSense 코드를 반복해서 넣을 필요가 없다.

공통 Layout에 한 번 추가하는 편이 관리하기 쉽다.

예를 들어 다음과 같은 구조라고 가정한다.

```text
src/
├── layouts/
│   └── BaseLayout.astro
└── pages/
```

`BaseLayout.astro`의 `<head>` 안에 AdSense에서 제공한 코드를 넣는다.

```html
<head>
    <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000"
        crossorigin="anonymous">
    </script>
</head>
```

`ca-pub-0000000000000000` 부분은 자신의 AdSense 게시자 값으로 바꾼다.

실제 게시자 ID를 블로그 글이나 공개 예제에 그대로 남길 필요는 없다.

## Astro 외부 스크립트 처리 확인

Astro는 일반 `<script>`를 빌드 과정에서 처리할 수 있다.

공식 문서에서는 CDN 같은 외부 스크립트를 작성된 형태 그대로 출력하려면 `is:inline`을 사용할 수 있다고 설명한다.

```html
<script
    is:inline
    async
    src="https://example.com/external.js">
</script>
```

다만 `src` 외에 다른 속성이 있는 `<script>`는 Astro에서 처리되지 않는 형태가 될 수 있다.

중요한 것은 문법만 보고 끝내지 않고 실제 빌드 결과의 HTML에 AdSense 스크립트가 원하는 형태로 들어갔는지 확인하는 것이다.

## 루트 페이지도 별도 확인한다

다국어 블로그에서는 `/ko/`, `/en/` 페이지가 공통 Layout을 사용하지만 `/` 페이지는 별도의 `index.astro`를 사용하는 경우가 있다.

예를 들면 다음과 같다.

```text
src/pages/index.astro
src/layouts/BaseLayout.astro
```

루트 페이지가 `BaseLayout.astro`를 사용하지 않는다면 공통 Layout에 추가한 AdSense 코드가 `/`에는 들어가지 않는다.

따라서 다음을 확인한다.

```text
/      → 어떤 Layout을 사용하는가?
/ko/   → BaseLayout을 사용하는가?
/en/   → BaseLayout을 사용하는가?
```

AdSense 코드를 사이트 전체에 넣으려면 실제 페이지 구조를 기준으로 누락된 페이지가 없는지 확인해야 한다.

## ads.txt는 public 디렉터리에 둔다

Astro에서 `public/` 안의 파일은 빌드 결과에서 루트 경로로 복사된다.

따라서 다음 위치에 파일을 만든다.

```text
public/ads.txt
```

Google AdSense용 기본 형식은 다음과 같다.

```text
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```

여기에서도 `pub-0000000000000000`은 자신의 게시자 ID로 변경한다.

빌드 후에는 다음 주소에서 접근할 수 있어야 한다.

```text
https://username.github.io/ads.txt
```

커스텀 도메인을 사용한다면 해당 도메인의 루트에서도 접근되어야 한다.

```text
https://example.com/ads.txt
```

Google은 ads.txt를 사이트의 루트 디렉터리에 배치하도록 안내한다.

## GitHub Pages 배포 전에 빌드한다

변경 후 로컬에서 먼저 빌드한다.

```bash
npm run build
```

Astro 프로젝트에 별도의 검사 명령이 구성되어 있다면 함께 실행한다.

빌드가 성공하면 생성 결과에서 `ads.txt`가 포함되었는지 확인한다.

```text
dist/
├── ads.txt
├── index.html
└── ...
```

페이지 HTML에 AdSense 스크립트가 들어갔는지도 확인한다.

```bash
grep -R "adsbygoogle.js" dist
```

## 배포 후 확인할 항목

GitHub Pages 배포가 완료되면 브라우저에서 직접 확인한다.

먼저 `ads.txt`다.

```text
https://example.com/ads.txt
```

파일 내용이 텍스트로 표시되어야 한다.

Google의 안내에 따르면 ads.txt는 루트 도메인에서 접근 가능하고 HTTP 200 응답을 반환해야 하며 `robots.txt`에 의해 크롤링이 차단되지 않아야 한다.

다음으로 실제 페이지의 HTML 소스에서 `adsbygoogle.js`를 검색한다.

```text
view-source:https://example.com/
```

사이트가 다국어 구조라면 `/`, `/ko/`, `/en/`을 각각 확인하는 것이 좋다.

## ads.txt를 올렸는데 바로 인식되지 않는 경우

파일이 정상적으로 열리는데 AdSense 화면에서는 아직 찾을 수 없다고 표시될 수 있다.

Google은 업로드 후 상태가 반영되기까지 시간이 필요할 수 있으며 광고 요청이 적은 사이트는 검토에 더 오래 걸릴 수 있다고 안내한다.

따라서 먼저 다음 조건을 확인한다.

```text
사이트 루트에서 ads.txt 접근 가능
HTTP 200 응답
게시자 ID 오타 없음
robots.txt에서 차단하지 않음
HTTP와 HTTPS 접근 상태 확인
```

이 조건이 정상이라면 파일을 계속 수정하기보다 AdSense의 재크롤링과 상태 갱신을 기다린다.

## 공개 저장소에서는 민감한 값을 구분한다

GitHub Pages 저장소는 공개 저장소로 운영하는 경우가 많다.

AdSense 게시자 ID 자체는 사이트의 AdSense 코드와 `ads.txt`에 포함되는 값이므로 실제 사이트에서는 공개된다.

하지만 블로그 예제나 문서에서는 다음처럼 일반화하는 편이 읽기도 쉽다.

```text
ca-pub-0000000000000000
pub-0000000000000000
```

API Key, 비밀번호, 인증 토큰 같은 비밀정보와 AdSense 게시자 식별값을 같은 종류의 Secret으로 혼동하지 않는 것도 중요하다.

## 정리

Astro 기반 GitHub Pages에서 AdSense를 적용할 때 핵심은 세 가지다.

```text
1. 공통 Layout의 head에 AdSense 코드 추가
2. public/ads.txt 생성
3. 배포 후 실제 HTML과 /ads.txt 직접 확인
```

다국어 사이트처럼 페이지 구조가 나뉘어 있다면 공통 Layout을 사용하지 않는 루트 페이지가 있는지도 함께 확인해야 한다.

코드를 추가했다는 사실보다 최종 배포된 HTML과 루트 경로의 `ads.txt`가 실제로 접근 가능한지를 검증하는 것이 더 중요하다.

## 참고 자료

- Google AdSense: Connect your site to AdSense
  https://support.google.com/adsense/answer/7584263
- Google AdSense: ads.txt guide
  https://support.google.com/adsense/answer/12171612
- Google AdSense: Ensure your ads.txt files can be crawled
  https://support.google.com/adsense/answer/7679060
- Astro: Scripts and event handling
  https://docs.astro.build/en/guides/client-side-scripts/
