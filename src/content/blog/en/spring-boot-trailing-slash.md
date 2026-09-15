---
title: "Fix /admin and /admin/ Trailing Slash Issues in Spring Boot"
pubDate: 2026-09-15T09:17:07+09:00
description: "Learn why /admin and /admin/ can behave differently in Spring Boot and how to fix trailing slash routing with explicit mappings, redirects, and URL normalization."
category: Spring Boot
tags:
  - Spring Boot
  - Spring MVC
  - Trailing Slash
  - URL Mapping
lang: en
---

In Spring Boot, `/admin` and `/admin/` do not always match the same controller route.

## Why it happens

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

The effective mapping is `/admin/`, so `/admin` may not match.

Implicit trailing slash matching was deprecated in Spring 6 and removed in Spring 7.

## Simple fix

Map both paths explicitly.

```java
@GetMapping({"", "/"})
public String index() {
    return "admin/index";
}
```

Now both routes work.

```text
/admin
/admin/
```

## Use one canonical URL

Redirect `/admin/` to `/admin` if one URL should be canonical.

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

Spring 7 also provides `UrlHandlerFilter` for trailing slash normalization.

```java
UrlHandlerFilter filter = UrlHandlerFilter
    .trailingSlashHandler("/admin/**")
    .redirect(HttpStatus.PERMANENT_REDIRECT)
    .build();
```

## Check Nginx too

When Nginx proxies requests to Spring Boot, verify the forwarded path.

```nginx
location /admin {
    proxy_pass http://127.0.0.1:8080;
}
```

A trailing slash on `location` or `proxy_pass` can change path handling.

## Summary

```text
Check controller mapping
↓
Check @GetMapping("/")
↓
Map both routes or choose one canonical route
↓
Add redirect if needed
↓
Check Nginx proxy behavior
```

For a small admin page, this is often the clearest mapping:

```java
@GetMapping({"", "/"})
```

## References

- Spring Framework Path Matching  
  https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-config/path-matching.html
- Spring Framework URL Handler Filter  
  https://docs.spring.io/spring-framework/reference/web/webmvc/filters.html
