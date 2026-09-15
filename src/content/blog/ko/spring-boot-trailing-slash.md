---
title: "Spring Boot에서 /admin과 /admin/ 경로가 다르게 동작할 때"
pubDate: 2026-09-15T09:17:07+09:00
description: "Spring Boot에서 /admin은 404가 나고 /admin/만 동작하거나 그 반대 상황이 생길 때 trailing slash 차이와 해결 방법을 정리한다."
category: Spring Boot
tags:
  - Spring Boot
  - Spring MVC
  - Trailing Slash
  - URL Mapping
lang: ko
---

Spring Boot에서 `/admin`과 `/admin/`은 항상 같은 경로로 처리되지 않는다.

## 원인

다음처럼 작성했다고 가정한다.

```java
@Controller
@RequestMapping("/admin")
public class AdminController {

    @GetMapping("/")
    public String index() {
        return "admin/index";
    }
}
```

실제 매핑은 `/admin/`이 된다. 따라서 `/admin`은 매칭되지 않을 수 있다.

Spring MVC의 과거 trailing slash 자동 매칭은 Spring 6에서 deprecated 되었고 Spring 7에서는 제거되었다.

## 가장 단순한 해결 방법

두 경로를 명시한다.

```java
@GetMapping({"", "/"})
public String index() {
    return "admin/index";
}
```

이제 둘 다 처리된다.

```text
/admin
/admin/
```

## 한쪽 URL로 통일하기

`/admin/`을 `/admin`으로 통일하려면 redirect를 사용할 수 있다.

```java
@GetMapping("/")
public String redirectAdmin() {
    return "redirect:/admin";
}

@GetMapping
public String index() {
    return "admin/index";
}
```

Spring 7에서는 `UrlHandlerFilter`를 이용해 trailing slash를 정규화할 수도 있다.

```java
UrlHandlerFilter filter = UrlHandlerFilter
    .trailingSlashHandler("/admin/**")
    .redirect(HttpStatus.PERMANENT_REDIRECT)
    .build();
```

## Nginx도 확인한다

Spring Boot 앞에 Nginx가 있다면 proxy 설정도 확인해야 한다.

```nginx
location /admin {
    proxy_pass http://127.0.0.1:8080;
}
```

`location`과 `proxy_pass` 뒤 `/` 유무에 따라 전달 경로가 달라질 수 있다.

## 정리

확인 순서는 다음과 같다.

```text
Controller 매핑 확인
↓
@GetMapping("/") 확인
↓
두 경로를 모두 매핑할지 결정
↓
redirect로 한쪽 URL로 통일할지 결정
↓
Nginx proxy 설정 확인
```

간단한 관리자 페이지라면 다음 방식이 가장 명확하다.

```java
@GetMapping({"", "/"})
```

## 참고 자료

- Spring Framework Path Matching  
  https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-config/path-matching.html
- Spring Framework URL Handler Filter  
  https://docs.spring.io/spring-framework/reference/web/webmvc/filters.html
