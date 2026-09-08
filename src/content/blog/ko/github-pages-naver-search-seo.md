---
title: "GitHub Pages 블로그를 네이버 검색에 노출시키는 방법"
pubDate: 2026-09-08T14:24:04+09:00
description: "Astro와 GitHub Pages로 만든 블로그를 네이버 검색에서 수집·색인될 수 있도록 네이버 서치어드바이저 등록, robots.txt, sitemap, title, description, canonical, Open Graph 설정을 단계별로 정리합니다."
category: SEO
tags:
  - GitHub Pages
  - Astro
  - 네이버 SEO
  - 네이버 서치어드바이저
  - Sitemap
  - robots.txt
lang: ko
---

GitHub Pages로 만든 블로그는 네이버에서도 검색될 수 있습니다.

별도의 서버나 네이버 전용 블로그 플랫폼을 사용할 필요는 없습니다. 일반적인 웹사이트처럼 검색로봇이 접근할 수 있고, 페이지의 제목과 설명, 대표 URL, sitemap 등이 올바르게 구성되어 있으면 네이버 검색 수집 대상이 될 수 있습니다.

다만 Google Search Console과 마찬가지로 네이버에는 **네이버 서치어드바이저**라는 웹마스터 도구가 있습니다.

이 글에서는 **Astro + GitHub Pages** 블로그를 기준으로 네이버 검색 노출을 위해 확인할 항목을 정리합니다.

---

# 1. 네이버에 "검색 등록"을 해야만 노출되는 것은 아니다

먼저 많이 헷갈리는 부분입니다.

네이버 웹 검색은 검색로봇이 웹사이트를 자동으로 수집합니다.

즉 네이버 검색 결과에 나오기 위해 반드시 별도의 "검색 등록 신청"을 해야 하는 구조는 아닙니다.

하지만 네이버 서치어드바이저에 사이트를 등록하고 소유확인을 해두면 다음 정보를 확인할 수 있습니다.

- 사이트 수집 상태
- 색인 상태
- 수집 제한
- SEO 진단
- sitemap 제출
- 웹페이지 수집 요청

따라서 블로그를 꾸준히 운영할 예정이라면 등록해 두는 것이 좋습니다.

---

# 2. 네이버 서치어드바이저에 사이트 등록

네이버 서치어드바이저에 로그인한 뒤 웹마스터 도구에서 사이트를 추가합니다.

GitHub Pages 사용자 사이트라면 예를 들어:

```text
https://username.github.io
```

별도 도메인을 사용한다면:

```text
https://www.example.com
```

을 등록합니다.

등록 후에는 사이트 소유확인이 필요합니다.

일반적으로 HTML 파일 또는 메타태그 방식 등을 이용해 소유 여부를 확인합니다.

GitHub Pages에서는 정적 파일을 직접 배포할 수 있으므로 제공되는 인증 방식을 사이트 구조에 맞게 적용하면 됩니다.

---

# 3. 사이트가 실제로 정상 접근되는지 확인

검색로봇이 접근할 수 없는 사이트는 색인될 수 없습니다.

먼저 브라우저에서 다음을 확인합니다.

```text
https://username.github.io/
https://username.github.io/ko/
https://username.github.io/en/
```

그리고 개별 포스트도 정상적으로 `200 OK` 페이지로 열리는지 확인합니다.

GitHub Pages 배포 실패, 잘못된 라우팅, 404 페이지가 발생한다면 SEO 설정 이전에 사이트 접근 문제부터 해결해야 합니다.

---

# 4. `robots.txt` 확인

네이버 검색로봇은 robots.txt 규칙을 확인합니다.

Astro 프로젝트에서는 다음 파일을 둘 수 있습니다.

```text
public/robots.txt
```

기본적인 공개 블로그라면 다음과 같이 설정할 수 있습니다.

```text
User-agent: *
Allow: /

Sitemap: https://username.github.io/sitemap-index.xml
```

빌드 후 다음 URL에서 접근할 수 있어야 합니다.

```text
https://username.github.io/robots.txt
```

### 가장 먼저 확인할 실수

다음처럼 되어 있으면 전체 사이트 수집이 차단됩니다.

```text
User-agent: *
Disallow: /
```

개발 중 검색 노출을 막기 위해 사용했던 설정을 운영 배포 전에 제거하지 않는 실수가 자주 발생합니다.

또한 robots.txt는 개인정보 보호 수단이 아닙니다.

공개하면 안 되는 파일은 애초에 GitHub Pages의 public 경로에 배포하지 않는 것이 원칙입니다.

---

# 5. sitemap 생성

사이트맵은 검색로봇에게 사이트에서 수집할 URL을 알려주는 표준 파일입니다.

Astro에서는 `@astrojs/sitemap`을 사용할 수 있습니다.

설치:

```bash
npm install @astrojs/sitemap
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',

  integrations: [
    sitemap(),
  ],
});
```

빌드 후 일반적으로 다음과 같은 주소가 생성됩니다.

```text
https://username.github.io/sitemap-index.xml
```

해당 URL을 직접 열어서 XML이 정상적으로 표시되는지 확인합니다.

---

# 6. 네이버 서치어드바이저에 sitemap 제출

사이트 소유확인을 완료한 뒤 웹마스터 도구에서 sitemap 주소를 제출합니다.

예:

```text
https://username.github.io/sitemap-index.xml
```

네이버 공식 가이드에서도 RSS보다 sitemap을 적극적으로 활용할 것을 권장하고 있습니다.

포스트가 추가될 때 sitemap이 자동으로 다시 생성되도록 Astro 빌드와 연결해 두면 관리하기 편합니다.

```text
Markdown 포스트 추가
        ↓
Astro build
        ↓
sitemap 갱신
        ↓
GitHub Pages 배포
```

---

# 7. 페이지별 `<title>` 설정

네이버는 페이지 제목을 중요한 정보로 사용합니다.

포스트마다 같은 title을 사용하지 않도록 합니다.

잘못된 예:

```html
<title>개발 블로그</title>
```

모든 글에서 같은 제목이 사용되는 경우입니다.

권장 구조:

```astro
<title>{title}</title>
```

Markdown:

```yaml
---
title: "macOS에서 SDKMAN으로 Java 여러 버전 관리하기"
---
```

실제 HTML:

```html
<title>macOS에서 SDKMAN으로 Java 여러 버전 관리하기</title>
```

제목은 다음 원칙이 좋습니다.

- 콘텐츠 주제를 명확하게 표현
- 페이지마다 고유하게 작성
- 지나치게 길지 않게 작성
- 같은 키워드를 반복하지 않기
- 실제 내용과 관계없는 인기 검색어를 넣지 않기

---

# 8. `meta description` 작성

포스트에는 내용 요약을 작성합니다.

```yaml
---
description: "SDKMAN과 VS Code 설정을 이용해 macOS에서 프로젝트별 Java 버전을 자동으로 전환하는 방법을 정리합니다."
---
```

공통 Layout:

```astro
<meta name="description" content={description} />
```

description은 한두 문장으로 해당 페이지가 무엇을 설명하는지 알려주는 것이 좋습니다.

다음처럼 키워드만 나열하는 방식은 피합니다.

```text
Java, Java 설치, Java 버전, SDKMAN, VS Code, macOS Java
```

대신 실제 내용을 요약합니다.

```text
SDKMAN과 VS Code를 이용해 프로젝트마다 다른 Java 버전을 자동으로 선택하는 설정 방법을 설명합니다.
```

---

# 9. canonical로 대표 URL 지정

같은 콘텐츠에 여러 URL이 존재할 수 있다면 대표 URL을 지정하는 것이 좋습니다.

```html
<link
  rel="canonical"
  href="https://username.github.io/ko/posts/sdkman-java/"
/>
```

Astro에서는 다음과 같이 처리할 수 있습니다.

```astro
---
const site = Astro.site ?? new URL('https://username.github.io');
const canonicalURL = new URL(Astro.url.pathname, site);
---

<link rel="canonical" href={canonicalURL} />
```

네이버 공식 가이드에서도 동일한 콘텐츠의 대표 URL을 알리기 위해 canonical을 활용할 수 있다고 안내합니다.

특히 다음처럼 URL 변형이 생길 수 있는 사이트에서는 신경 써야 합니다.

```text
/post/example
/post/example/
/post/example?ref=home
```

사이트 내부 링크와 sitemap에서도 대표 URL 형식을 일관되게 사용하는 것이 좋습니다.

---

# 10. Open Graph도 함께 설정

Open Graph는 SNS 공유용 정보이지만 네이버 검색로봇도 페이지 분석에 활용할 수 있습니다.

공통 Layout에 다음 정보를 넣어둘 수 있습니다.

```html
<meta property="og:title" content="페이지 제목" />
<meta property="og:description" content="페이지 설명" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://username.github.io/ko/posts/example/" />
<meta property="og:image" content="https://username.github.io/images/og-default.png" />
```

네이버에서는 `og:image`가 검색결과의 대표 이미지 후보로 활용될 수도 있습니다.

따라서 다음을 확인하는 것이 좋습니다.

- 외부에서 실제 접근 가능한 이미지
- 지나치게 작은 이미지가 아닌지
- 글과 관계있는 이미지인지
- 사이트 전체에서 무조건 같은 광고성 이미지만 반복하지 않는지

대표 이미지가 없다면 사이트 공통 이미지를 사용할 수 있지만, 장기적으로는 주요 글에 고유한 대표 이미지를 넣는 것도 고려할 수 있습니다.

---

# 11. 한글과 영문 페이지가 모두 있어도 문제없다

다국어 블로그라면 다음과 같이 URL을 분리할 수 있습니다.

```text
/ko/posts/example/
/en/posts/example/
```

각 페이지는 자신의 언어에 맞는 title, description, 본문을 가져야 합니다.

```html
<html lang="ko">
```

영문:

```html
<html lang="en">
```

그리고 실제 번역 페이지가 존재한다면 `hreflang`을 연결할 수 있습니다.

```html
<link
  rel="alternate"
  hreflang="ko"
  href="https://username.github.io/ko/posts/example/"
/>

<link
  rel="alternate"
  hreflang="en"
  href="https://username.github.io/en/posts/example/"
/>
```

중요한 것은 단순히 메뉴만 번역하고 본문 내용은 동일하게 두는 것이 아니라 실제 언어별 콘텐츠를 제공하는 것입니다.

---

# 12. 중요한 내용은 이미지가 아니라 텍스트로 작성

개발 블로그에서는 터미널 화면이나 설정 화면 스크린샷을 많이 사용합니다.

하지만 해결 방법 전체를 이미지 한 장으로만 제공하는 것은 좋지 않습니다.

예를 들어 SDKMAN 설정이라면 명령어를 실제 텍스트로도 작성합니다.

```bash
sdk list java
sdk current java
sdk env
```

스크린샷은 보조 자료로 활용합니다.

이미지를 사용할 때는 alt도 작성합니다.

```html
<img
  src="/images/sdkman-settings.png"
  alt="SDKMAN 프로젝트별 Java 버전 설정 예시"
/>
```

검색로봇뿐 아니라 접근성 측면에서도 도움이 됩니다.

---

# 13. 키워드를 반복해서 넣지 않는다

검색노출을 위해 특정 단어를 지나치게 반복하는 방식은 오히려 피해야 합니다.

예:

```text
Docker 설치 Docker Ubuntu Docker 설치방법 Docker 서버 Docker 사용법...
```

실제 개발 경험을 중심으로 자연스럽게 작성하는 편이 좋습니다.

개발 블로그라면 다음 구조가 특히 유용합니다.

```text
문제 상황
↓
원인
↓
확인 방법
↓
해결 방법
↓
최종 설정
```

실제로 겪은 문제와 해결 과정을 구체적으로 작성하면 단순한 키워드 나열보다 훨씬 유용한 콘텐츠가 됩니다.

---

# 14. 네이버 서치어드바이저에서 사이트 진단

사이트를 등록한 뒤에는 웹마스터 도구의 진단 결과를 확인합니다.

대표적으로 다음 항목을 볼 수 있습니다.

```text
색인
수집제한
색인제외
SEO
```

SEO 문제가 표시된다면 URL 단위의 상세 내용을 확인합니다.

예를 들어 다음 문제가 있을 수 있습니다.

- title 없음
- 중복 title
- description 없음
- robots 차단
- 페이지 접근 오류

소스만 보고 정상이라고 생각하지 말고 실제 검색로봇이 어떻게 사이트를 인식하는지 확인하는 것이 중요합니다.

---

# 15. 사이트 간단 체크 활용

네이버 서치어드바이저에는 사이트 기본 정보를 확인할 수 있는 진단 기능이 있습니다.

확인할 수 있는 대표 항목:

- 사이트 정상 접속 여부
- robots.txt
- 로봇 메타태그
- 사이트 제목
- 사이트 설명
- Open Graph 제목
- Open Graph 설명

GitHub Pages SEO 설정을 변경한 뒤 기본적인 문제를 빠르게 점검할 때 유용합니다.

---

# 16. 새 포스트가 바로 검색되지 않을 수 있다

GitHub Pages에 포스트를 배포한 시점과 네이버 검색결과에 나타나는 시점은 다를 수 있습니다.

다음 과정이 필요하기 때문입니다.

```text
포스트 배포
↓
검색로봇 URL 발견
↓
페이지 수집
↓
콘텐츠 분석
↓
색인
↓
검색결과 노출
```

따라서 글을 올린 직후 네이버에서 제목을 검색했는데 나오지 않는다고 해서 바로 SEO 설정이 잘못됐다고 판단할 필요는 없습니다.

서치어드바이저에서 수집 및 색인 상태를 먼저 확인합니다.

---

# 17. Astro + GitHub Pages 최소 설정 예시

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',
  integrations: [sitemap()],
});
```

`public/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://username.github.io/sitemap-index.xml
```

`BaseLayout.astro`:

```astro
<title>{title}</title>
<meta name="description" content={description} />

<link rel="canonical" href={canonicalURL} />

<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:image" content={imageURL} />
```

각 Markdown 포스트:

```yaml
---
title: "포스트 제목"
description: "포스트에 대한 간단한 설명"
category: Docker
tags:
  - Docker
  - Ubuntu
lang: ko
---
```

이렇게 공통 Layout에서 메타태그를 처리하면 새 글을 작성할 때마다 HTML 메타태그를 직접 추가할 필요가 없습니다.

---

# 18. 네이버 검색 노출 체크리스트

```text
[ ] 사이트 HTTPS 정상 접속
[ ] 네이버 서치어드바이저 사이트 등록
[ ] 사이트 소유확인 완료
[ ] robots.txt 접근 가능
[ ] robots.txt에서 전체 사이트를 차단하지 않음
[ ] sitemap-index.xml 접근 가능
[ ] 서치어드바이저에 sitemap 제출
[ ] 포스트마다 고유 title
[ ] 포스트마다 고유 description
[ ] canonical 대표 URL 설정
[ ] og:title 설정
[ ] og:description 설정
[ ] og:image 정상 접근
[ ] 중요한 정보는 HTML 텍스트로 제공
[ ] 이미지 alt 작성
[ ] 과도한 키워드 반복 없음
[ ] 사이트 진단에서 수집/색인 오류 확인
```

---

# 마무리

GitHub Pages 블로그라고 해서 네이버 검색에 특별한 별도 방식이 필요한 것은 아닙니다.

일반 웹사이트와 마찬가지로 핵심은 다음과 같습니다.

```text
검색로봇이 접근 가능
↓
사이트맵으로 URL 발견
↓
title / description으로 페이지 이해
↓
canonical로 대표 URL 판단
↓
실제 콘텐츠를 수집
```

그리고 네이버 서치어드바이저는 이 과정이 정상적으로 진행되는지 확인하는 도구로 활용하면 됩니다.

개발 블로그라면 검색 키워드를 억지로 늘리는 것보다 **실제로 겪은 오류, 원인, 해결 과정, 사용한 명령어를 정확하게 기록하는 것**이 장기적으로 더 가치 있는 콘텐츠가 됩니다.

---

## 참고 자료

- 네이버 서치어드바이저 웹마스터 가이드  
  https://searchadvisor.naver.com/guide
- 사이트 등록 및 소유확인  
  https://searchadvisor.naver.com/guide/faq-start-register
- robots.txt 설정하기  
  https://searchadvisor.naver.com/guide/seo-basic-robots
- RSS 및 사이트맵 제출  
  https://searchadvisor.naver.com/guide/request-feed
- 콘텐츠 마크업  
  https://searchadvisor.naver.com/guide/markup-content
- 선호 URL 및 로봇 메타 태그  
  https://searchadvisor.naver.com/guide/markup-structure
- 사이트 진단  
  https://searchadvisor.naver.com/guide/report-diagnosis
