---
title: "GitHub Pages 블로그 Google SEO 설정 체크리스트"
pubDate: 2026-09-08T14:24:04+09:00
description: "Astro와 GitHub Pages로 운영하는 개발 블로그에서 Google 검색 노출을 위해 확인해야 할 title, description, canonical, sitemap, robots.txt, hreflang, Search Console 설정을 단계별로 정리합니다."
category: SEO
tags:
  - GitHub Pages
  - Astro
  - Google SEO
  - Search Console
  - Sitemap
  - robots.txt
lang: ko
---

GitHub Pages에 블로그를 배포했다고 해서 Google 검색 결과에 바로 잘 노출되는 것은 아닙니다.

검색엔진이 페이지를 **발견하고(crawl), 이해하고(index), 적절한 검색어에 노출**할 수 있도록 기본적인 SEO 설정이 필요합니다.

이 글에서는 **Astro + GitHub Pages**로 운영하는 개발 블로그를 기준으로 Google SEO에서 우선 확인해야 할 항목을 정리합니다.

> SEO는 특정 메타태그 하나를 추가한다고 끝나는 작업이 아닙니다. 검색로봇이 사이트에 접근할 수 있어야 하고, 각 페이지의 주제를 이해할 수 있어야 하며, 중복 URL과 다국어 페이지도 명확하게 구분되어야 합니다.

---

## 1. 먼저 확인할 전체 체크리스트

Google SEO를 처음 점검한다면 아래 항목부터 확인하는 것이 좋습니다.

| 항목 | 중요도 | 확인 내용 |
|---|---|---|
| HTTPS 접속 | 필수 | 모든 페이지가 정상적으로 HTTPS로 열리는지 |
| 페이지별 title | 필수 | 각 포스트마다 고유한 제목인지 |
| meta description | 권장 | 페이지 내용을 요약하는 설명이 있는지 |
| canonical | 중요 | 각 페이지의 대표 URL이 올바른지 |
| robots.txt | 중요 | Googlebot을 실수로 차단하지 않았는지 |
| sitemap.xml | 중요 | 검색엔진이 페이지 목록을 발견할 수 있는지 |
| Search Console | 중요 | 사이트 소유권 확인 및 색인 상태 점검 |
| 내부 링크 | 중요 | 포스트가 다른 페이지에서 연결되어 있는지 |
| hreflang | 다국어 사이트 | 한글/영문 페이지 관계가 올바른지 |
| 모바일 대응 | 중요 | 모바일에서도 정상적으로 사용할 수 있는지 |

---

# 2. Astro의 `site` 주소부터 정확하게 설정

Astro에서 sitemap, canonical URL 등을 만들 때 기준이 되는 값이 `site`입니다.

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

GitHub Pages의 사용자 사이트라면 일반적으로 다음 형태입니다.

```text
https://username.github.io
```

별도 도메인을 연결했다면 실제 서비스 도메인을 사용합니다.

```text
https://www.example.com
```

`site` 값이 잘못되어 있으면 sitemap이나 canonical이 잘못된 호스트를 가리킬 수 있으므로 가장 먼저 확인하는 것이 좋습니다.

---

# 3. 포스트마다 고유한 `<title>` 사용

검색결과에서 제목은 사용자가 가장 먼저 확인하는 요소 중 하나입니다.

모든 페이지가 다음처럼 같은 제목을 사용하면 좋지 않습니다.

```html
<title>My Dev Blog</title>
```

포스트 페이지에서는 실제 포스트 제목을 사용해야 합니다.

```astro
<title>{title}</title>
```

예:

```html
<title>macOS에서 SDKMAN으로 Java 여러 버전 관리하기</title>
```

좋은 제목은 페이지 내용을 정확하게 설명해야 합니다.

다음처럼 검색 키워드를 억지로 반복하는 방식은 피하는 것이 좋습니다.

```text
Java Java 설치 Java 버전 Java SDKMAN Java 개발
```

제목은 검색엔진을 위한 키워드 목록이 아니라 **사용자에게 페이지 내용을 설명하는 문장**으로 생각하는 편이 낫습니다.

---

# 4. `meta description`을 페이지별로 작성

각 블로그 포스트의 frontmatter에 `description`을 두고 layout에서 출력하는 구조가 관리하기 편합니다.

Markdown:

```yaml
---
title: "macOS에서 SDKMAN으로 Java 여러 버전 관리하기"
description: "SDKMAN과 VS Code를 사용해 프로젝트별 Java 버전을 자동으로 전환하는 방법을 정리합니다."
---
```

Astro Layout:

```astro
<meta name="description" content={description} />
```

description은 검색결과의 스니펫 후보로 사용될 수 있습니다.

다만 Google이 항상 작성한 description을 그대로 표시하는 것은 아닙니다. 검색어와 페이지 내용에 따라 본문에서 더 적절한 부분을 선택할 수도 있습니다.

따라서 description은 다음 원칙으로 작성하는 것이 좋습니다.

- 페이지 내용을 실제로 요약할 것
- 페이지마다 서로 다른 설명을 사용할 것
- 의미 없는 키워드 나열을 피할 것
- 검색 클릭만 유도하는 과장된 문구를 피할 것

---

# 5. canonical URL 설정

같은 콘텐츠가 여러 URL로 접근 가능한 경우 검색엔진 입장에서는 어떤 URL을 대표 페이지로 봐야 하는지 판단해야 합니다.

이때 사용하는 것이 canonical입니다.

```html
<link
  rel="canonical"
  href="https://username.github.io/ko/posts/sdkman-java/"
/>
```

Astro에서는 현재 경로와 `Astro.site`를 이용해 만들 수 있습니다.

```astro
---
const site = Astro.site ?? new URL('https://username.github.io');
const canonicalURL = new URL(Astro.url.pathname, site);
---

<link rel="canonical" href={canonicalURL} />
```

Google은 canonical을 강제 명령이 아닌 **대표 URL을 판단하는 신호**로 사용합니다.

따라서 다음 항목을 서로 일관되게 유지하는 것이 좋습니다.

```text
canonical URL
sitemap의 URL
내부 링크 URL
실제 배포 URL
```

예를 들어 canonical은 `/post/java`, sitemap은 `/post/java/`, 내부 링크는 다른 쿼리 파라미터 URL을 사용하도록 제각각 구성하는 것은 피하는 것이 좋습니다.

---

# 6. sitemap 생성

포스트가 많아지면 검색로봇이 모든 페이지를 빠르게 발견하기 어려울 수 있습니다.

Astro에서는 공식 sitemap integration을 사용할 수 있습니다.

설치:

```bash
npm install @astrojs/sitemap
```

설정:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',
  integrations: [sitemap()],
});
```

빌드 후 일반적으로 sitemap 파일이 생성됩니다.

예:

```text
https://username.github.io/sitemap-index.xml
```

브라우저에서 해당 URL에 직접 접근해서 XML이 정상적으로 표시되는지 확인합니다.

### sitemap에 넣지 않아야 할 페이지

모든 URL을 무조건 sitemap에 넣어야 하는 것은 아닙니다.

예를 들면 다음 페이지는 상황에 따라 제외할 수 있습니다.

- 실제 콘텐츠가 없는 빈 페이지
- 테스트 페이지
- `noindex` 페이지
- 검색결과 페이지
- 중복 페이지

중요한 것은 **검색결과에 노출시키고 싶은 대표 URL**을 sitemap에 제공하는 것입니다.

---

# 7. `robots.txt` 확인

GitHub Pages에서는 `public/robots.txt`를 만들어 두면 빌드 후 사이트 루트에 배포할 수 있습니다.

기본적인 블로그라면 다음 정도로 시작할 수 있습니다.

```text
User-agent: *
Allow: /

Sitemap: https://username.github.io/sitemap-index.xml
```

배포 후 확인:

```text
https://username.github.io/robots.txt
```

여기에서 특히 확인해야 할 실수가 있습니다.

```text
User-agent: *
Disallow: /
```

이 설정은 사이트 전체의 crawling을 차단합니다.

개발 중 임시로 넣었던 설정이 운영 배포에도 남아 있지 않은지 확인해야 합니다.

또한 `robots.txt`는 보안 기능이 아닙니다.

비공개 파일이나 개인정보를 robots.txt로 차단하는 방식에 의존하면 안 됩니다. 민감한 데이터는 애초에 공개 경로에 배포하지 않아야 합니다.

---

# 8. Google Search Console 등록

기술적인 SEO 설정을 마쳤다면 Google Search Console에 사이트를 등록하는 것이 좋습니다.

Search Console에서는 다음 작업을 할 수 있습니다.

- Google이 페이지를 발견했는지 확인
- 색인 여부 확인
- sitemap 제출
- URL 검사
- 검색 노출 및 클릭 확인
- crawling/indexing 문제 확인

사이트 등록 후 sitemap 메뉴에서 다음 주소를 제출합니다.

```text
sitemap-index.xml
```

또는 사이트 구성에 따라:

```text
sitemap-0.xml
```

등 실제 생성된 sitemap 주소를 사용합니다.

---

# 9. 새 포스트는 URL 검사로 확인 가능

포스트를 새로 작성했다고 해서 즉시 Google 검색결과에 나타나는 것은 아닙니다.

Search Console의 **URL 검사**에서 실제 포스트 URL을 확인하면 현재 Google의 상태를 볼 수 있습니다.

예:

```text
https://username.github.io/ko/posts/github-pages-seo/
```

확인할 항목:

```text
Google에 URL이 등록되어 있는가?
크롤링이 가능한가?
사용자 선언 canonical은 무엇인가?
Google이 선택한 canonical은 무엇인가?
```

필요하다면 색인 생성 요청을 할 수 있습니다.

다만 요청한다고 즉시 검색결과에 노출되는 것은 아닙니다.

---

# 10. 한글/영문 블로그라면 `hreflang` 설정

같은 주제의 한국어와 영어 포스트를 함께 제공한다면 각 언어 페이지의 관계를 검색엔진에 알려주는 것이 좋습니다.

한국어 페이지:

```html
<link
  rel="alternate"
  hreflang="ko"
  href="https://username.github.io/ko/posts/sdkman-java/"
/>

<link
  rel="alternate"
  hreflang="en"
  href="https://username.github.io/en/posts/sdkman-java/"
/>
```

영문 페이지에서도 두 페이지를 동일하게 연결합니다.

Astro에서는 한글/영문 URL이 실제로 존재할 때만 출력하는 방법이 안전합니다.

```astro
{koUrl && (
  <link
    rel="alternate"
    hreflang="ko"
    href={new URL(koUrl, site)}
  />
)}

{enUrl && (
  <link
    rel="alternate"
    hreflang="en"
    href={new URL(enUrl, site)}
  />
)}
```

번역 페이지가 실제로 존재하지 않는데 존재하는 것처럼 `hreflang`을 생성하는 것은 피합니다.

---

# 11. Open Graph는 SEO와 별개로 같이 설정

Open Graph는 주로 링크를 SNS나 메신저에서 공유할 때 사용됩니다.

```html
<meta property="og:title" content="페이지 제목" />
<meta property="og:description" content="페이지 설명" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://username.github.io/ko/posts/example/" />
<meta property="og:image" content="https://username.github.io/images/og-default.png" />
```

OG 태그를 설정했다고 Google 검색순위가 직접 올라가는 것으로 생각할 필요는 없습니다.

하지만 링크 공유 화면에서 제목, 설명, 대표 이미지가 제대로 표시되기 때문에 블로그 유입 경로를 생각하면 함께 설정해 두는 것이 좋습니다.

이미지 URL은 상대 경로보다 실제 접근 가능한 절대 URL로 생성해 두는 편이 안전합니다.

---

# 12. 내부 링크도 중요

검색로봇은 sitemap뿐 아니라 페이지 내 링크를 따라가며 다른 콘텐츠를 발견합니다.

따라서 포스트가 생성되었는데 사이트 어디에서도 연결되지 않는 구조는 피하는 것이 좋습니다.

예:

```text
홈
 ├── 최신 글
 ├── 카테고리
 │    └── Java
 │         └── SDKMAN 글
 └── 다른 포스트의 관련 글 링크
```

블로그에서는 최소한 다음 경로로 포스트에 접근할 수 있게 구성하는 것이 좋습니다.

- 홈의 글 목록
- 카테고리 목록
- 이전/다음 글
- 관련 글
- 본문 내부 링크

---

# 13. 이미지에는 `alt` 속성 사용

글에 스크린샷이나 다이어그램을 넣을 때 이미지 자체에만 정보를 담지 않는 것이 좋습니다.

```html
<img
  src="/images/sdkman-vscode-settings.png"
  alt="VS Code에서 Java 17 Runtime을 설정한 화면"
/>
```

이미지가 로드되지 않거나 검색엔진이 이미지를 이해해야 할 때 alt 텍스트가 도움이 됩니다.

다만 alt에는 키워드를 억지로 반복하지 말고 이미지가 무엇을 보여주는지만 설명합니다.

---

# 14. Astro + GitHub Pages 기준 최소 구성

최소한 다음 정도가 갖춰지면 기본적인 기술 SEO 구조가 만들어집니다.

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

공통 Layout:

```astro
<title>{title}</title>
<meta name="description" content={description} />

<link rel="canonical" href={canonicalURL} />

<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
```

Markdown:

```yaml
---
title: "포스트 제목"
description: "포스트 내용을 설명하는 한두 문장"
category: Java
tags:
  - Java
  - macOS
lang: ko
---
```

---

# 15. 배포 후 직접 확인할 URL

SEO 설정은 소스만 보고 끝내지 말고 실제 배포 결과를 확인해야 합니다.

```text
https://username.github.io/robots.txt
https://username.github.io/sitemap-index.xml
```

그리고 포스트 페이지에서 페이지 소스를 확인합니다.

확인할 항목:

```html
<title>...</title>
<meta name="description" ...>
<link rel="canonical" ...>
<meta property="og:title" ...>
<meta property="og:description" ...>
```

개발 소스에는 존재하지만 빌드 결과에는 나오지 않는다면 검색엔진도 볼 수 없습니다.

---

# 16. 체크리스트

GitHub Pages 블로그를 배포한 뒤 다음 항목을 하나씩 확인하면 됩니다.

```text
[ ] HTTPS로 정상 접속
[ ] 각 포스트의 title이 고유함
[ ] 각 포스트의 description이 존재함
[ ] canonical이 현재 대표 URL을 가리킴
[ ] robots.txt가 전체 사이트를 차단하지 않음
[ ] sitemap-index.xml 정상 접근
[ ] sitemap에 실제 포스트가 포함됨
[ ] Google Search Console 사이트 등록
[ ] sitemap 제출
[ ] 주요 포스트 URL 검사
[ ] 한글/영문 페이지 hreflang 연결
[ ] 포스트가 홈/카테고리에서 내부 링크됨
[ ] 이미지 alt 작성
[ ] 모바일에서 정상 표시
```

---

# 마무리

GitHub Pages의 Google SEO는 별도의 서버가 없다고 해서 특별히 어려운 것은 아닙니다.

중요한 것은 검색엔진이 다음 세 가지를 명확하게 알 수 있도록 만드는 것입니다.

```text
어떤 페이지가 존재하는가
↓
그 페이지는 무슨 내용인가
↓
대표 URL은 무엇인가
```

Astro라면 `@astrojs/sitemap`, 공통 Layout, Markdown frontmatter를 활용해 대부분의 설정을 코드로 일관되게 관리할 수 있습니다.

새로운 포스트를 작성할 때마다 SEO 설정을 다시 만드는 것이 아니라, **포스트의 title과 description만 잘 작성하면 공통 Layout에서 나머지가 자동으로 생성되도록 구성하는 것**이 유지보수 측면에서 가장 편합니다.

---

## 참고 자료

- Google Search Central - Canonicalization  
  https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Search Central - robots.txt  
  https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- Google Search Central  
  https://developers.google.com/search/
- Google Search Console  
  https://search.google.com/search-console/
- Astro Sitemap Integration  
  https://docs.astro.build/en/guides/integrations-guide/sitemap/
