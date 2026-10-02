---
title: "Apache 리버스 프록시로 Node.js API 연결하기: 404 원인과 해결 방법"
pubDate: "2026-10-02T14:51:00+09:00"
description: "Apache에서 특정 URL 경로를 Node.js·Express API로 프록시할 때 필요한 ProxyPass 설정과 404 오류를 Apache, 프록시 경로, Express 라우터 단계로 나눠 점검하는 방법을 정리한다."
category: "Web Development"
tags: ["Apache", "Node.js", "Express", "Reverse Proxy", "ProxyPass", "Troubleshooting"]
lang: "ko"
---

# Apache 리버스 프록시로 Node.js API 연결하기: 404 원인과 해결 방법

외부에서는 `https://example.com/api/...`처럼 하나의 HTTPS 주소를 사용하고, 실제 API 서버는 내부에서 Node.js로 실행하는 구성이 자주 필요하다.

예를 들어 Node.js 애플리케이션이 서버의 `127.0.0.1:3006`에서 실행 중이라면 Apache가 외부 요청을 받아 내부 API로 전달하도록 구성할 수 있다.

```text
브라우저·앱
   ↓ HTTPS
Apache :443
   ↓ /api/ 요청만 전달
Node.js :3006
```

설정 자체는 짧지만 실제 운영에서는 `404 Not Found`가 발생했을 때 원인을 찾는 과정이 더 중요하다. Apache가 요청을 받지 못한 것인지, 프록시 경로가 잘못된 것인지, Node.js의 Express 라우터가 다른 경로를 기다리고 있는지 구분해야 한다.

이 글에서는 Apache와 Node.js를 리버스 프록시로 연결하는 기본 구성과 404 오류를 단계별로 추적하는 방법을 정리한다.

## 리버스 프록시를 사용하는 이유

Node.js 애플리케이션을 외부에 직접 노출하는 방법도 있지만, 이미 Apache가 HTTPS와 도메인을 담당하고 있다면 Apache를 앞단에 두는 편이 관리하기 쉽다.

주요 장점은 다음과 같다.

- 기존 HTTPS 인증서와 443 포트를 그대로 사용할 수 있다.
- `/api/`, `/admin/`처럼 특정 경로만 별도 애플리케이션으로 전달할 수 있다.
- Node.js 포트를 인터넷에 직접 노출하지 않아도 된다.
- 정적 페이지와 API를 하나의 도메인에서 함께 서비스할 수 있다.
- 여러 내부 서비스의 진입점을 Apache 하나로 통합할 수 있다.

예를 들어 기존 웹사이트는 Apache가 처리하고 `/api/` 요청만 Node.js가 처리하도록 분리할 수 있다.

```text
https://example.com/             → Apache 웹사이트
https://example.com/api/users    → Node.js API
https://example.com/api/status   → Node.js API
```

## Apache에서 필요한 기본 설정

가장 단순한 구성은 `ProxyPass`와 `ProxyPassReverse`를 함께 사용하는 것이다.

```apache
ProxyPreserveHost On

ProxyPass        /api/ http://127.0.0.1:3006/
ProxyPassReverse /api/ http://127.0.0.1:3006/
```

이 설정에서는 외부 요청의 `/api/` 접두사가 제거되어 Node.js로 전달된다.

```text
외부 요청
/api/verify-token

↓ Apache ProxyPass

Node.js가 받는 경로
/verify-token
```

따라서 Express에서도 다음처럼 `/verify-token` 경로를 처리하면 된다.

```javascript
import express from 'express';

const app = express();

app.get('/verify-token', (req, res) => {
  res.json({
    result: 'Y',
    message: 'valid'
  });
});

app.listen(3006, '127.0.0.1');
```

여기서 중요한 것은 **Apache가 전달하는 최종 경로와 Express가 등록한 경로가 같아야 한다는 점**이다.

## 가장 많이 헷갈리는 부분은 경로이다

리버스 프록시 404 문제는 포트보다 경로에서 발생하는 경우가 많다.

예를 들어 Apache 설정이 다음과 같다고 하자.

```apache
ProxyPass /api/ http://127.0.0.1:3006/
```

외부에서 다음 주소를 호출한다.

```text
https://example.com/api/verify-token
```

Node.js에는 다음 요청이 들어온다.

```text
GET /verify-token
```

그런데 Express를 다음처럼 작성했다면 경로가 맞지 않는다.

```javascript
app.get('/api/verify-token', handler);
```

Node.js는 `/api/verify-token`을 기다리지만 Apache는 `/verify-token`을 전달하고 있으므로 Express에서 404가 발생한다.

해결 방법은 두 가지이다.

### 방법 1. Apache에서 접두사를 제거한다

```apache
ProxyPass        /api/ http://127.0.0.1:3006/
ProxyPassReverse /api/ http://127.0.0.1:3006/
```

```javascript
app.get('/verify-token', handler);
```

작은 API 서버에서는 이 방식이 단순하다.

### 방법 2. Node.js에서도 `/api` 경로를 유지한다

```apache
ProxyPass        /api/ http://127.0.0.1:3006/api/
ProxyPassReverse /api/ http://127.0.0.1:3006/api/
```

```javascript
app.get('/api/verify-token', handler);
```

Express Router를 사용한다면 다음처럼 구성할 수도 있다.

```javascript
const router = express.Router();

router.get('/verify-token', handler);

app.use('/api', router);
```

어느 방식을 선택해도 문제는 없다. 중요한 것은 Apache 설정과 Express 라우팅 규칙을 한 세트로 보고 확인하는 것이다.

## 404가 발생하면 먼저 Node.js를 직접 호출한다

브라우저에서 외부 URL만 반복해서 호출하면 문제의 위치를 찾기 어렵다.

가장 먼저 Apache를 거치지 않고 Node.js를 직접 호출한다.

```bash
curl -i http://127.0.0.1:3006/verify-token
```

정상이라면 다음처럼 HTTP 상태와 응답을 확인할 수 있다.

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"result":"Y","message":"valid"}
```

여기서 이미 404가 나온다면 Apache 문제가 아니다.

다음 항목을 먼저 확인한다.

- Express에 해당 라우트가 실제로 등록되어 있는가
- Router의 `app.use()` 경로가 예상과 같은가
- 수정한 소스를 실행 중인 프로세스가 사용하고 있는가
- pm2나 Docker 컨테이너를 재시작했는가
- 요청 메서드가 `GET`, `POST` 중 올바른가

직접 호출은 정상인데 외부 URL에서만 실패한다면 그때 Apache 설정을 확인하면 된다.

## Apache 설정을 적용하기 전에 문법을 검사한다

설정 파일을 수정했다면 바로 재시작하기보다 먼저 문법 검사를 수행하는 것이 안전하다.

Ubuntu 계열에서는 보통 다음 명령을 사용할 수 있다.

```bash
sudo apachectl configtest
```

정상이라면 다음과 같은 결과가 나온다.

```text
Syntax OK
```

그다음 설정을 다시 읽힌다.

```bash
sudo systemctl reload apache2
```

`restart`가 필요한 상황도 있지만 단순한 프록시 설정 변경이라면 먼저 `reload`로 적용할 수 있는지 확인하는 편이 좋다.

설정 변경 후에는 Apache가 실제로 요청을 받는지도 확인한다.

```bash
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

요청을 보냈는데 access log에 아무 기록도 없다면 다른 VirtualHost로 들어가거나 DNS·포트·로드밸런서 같은 Apache 이전 구간을 확인해야 한다.

## HTTPS 도메인을 특정 서버로 직접 검증하기

DNS나 로드밸런서를 거치는 환경에서는 현재 요청이 어느 서버로 들어가는지 모호할 수 있다.

이럴 때 `curl --resolve`를 사용하면 도메인은 유지하면서 특정 IP로 HTTPS 요청을 보낼 수 있다.

```bash
curl -k -i \
  --resolve example.com:443:127.0.0.1 \
  'https://example.com/api/verify-token'
```

이 방법은 다음을 한 번에 확인할 때 유용하다.

- 해당 서버의 Apache VirtualHost가 맞는가
- HTTPS 요청이 정상적으로 들어오는가
- `/api/` ProxyPass가 적용되는가
- Node.js까지 요청이 전달되는가

특히 서버가 두 대 이상이고 로드밸런서가 앞에 있다면 각 서버에 같은 프록시 설정이 배포되었는지 반드시 확인해야 한다.

한 서버에는 설정이 있고 다른 서버에는 없다면 같은 URL이 어떤 때는 정상이고 어떤 때는 404를 반환하는 현상이 발생할 수 있다.

## 404 응답이 어디에서 만들어졌는지 확인한다

모든 404가 같은 404는 아니다.

Apache가 반환한 404와 Express가 반환한 404를 구분하면 원인을 훨씬 빠르게 찾을 수 있다.

먼저 응답 헤더와 본문을 확인한다.

```bash
curl -i https://example.com/api/verify-token
```

Express 기본 404라면 다음과 비슷한 응답이 보일 수 있다.

```text
Cannot GET /verify-token
```

반면 Apache 자체의 404 페이지가 나온다면 ProxyPass 규칙에 진입하지 못했거나 다른 VirtualHost·Location 설정에 의해 처리되고 있을 가능성을 확인해야 한다.

운영 환경에서는 애플리케이션 로그도 같이 본다.

```javascript
app.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});
```

요청 시 Node.js 로그가 남는다면 Apache에서 Node.js까지는 도달한 것이다. 로그가 전혀 없다면 프록시 이전 구간에 원인이 있을 가능성이 높다.

## Location 설정과 ProxyPass가 함께 있을 때 확인할 점

API 경로에 별도 접근 제어나 헤더 설정을 적용하기 위해 `<Location>`을 함께 사용할 수도 있다.

```apache
<Location /api/>
    ProxyPass http://127.0.0.1:3006/
    ProxyPassReverse http://127.0.0.1:3006/
</Location>
```

이 경우에도 핵심 원칙은 같다.

`/api/verify-token`이 내부에서 실제로 어떤 URL로 변환되는지 확인해야 한다.

또한 VirtualHost 안에 비슷한 경로의 설정이 여러 개 존재하면 예상하지 못한 규칙이 먼저 적용되는지 확인한다.

```bash
grep -R "ProxyPass" /etc/apache2/sites-enabled /etc/apache2/conf-enabled
```

오래 운영된 서버에서는 예전 설정 파일이 남아 있거나 다른 사이트 설정에 같은 경로가 정의되어 있는 경우가 있다.

## Node.js 포트는 외부에 열 필요가 없다

Apache와 Node.js가 같은 서버에서 실행된다면 Node.js를 모든 인터페이스에 바인딩할 필요가 없는 경우가 많다.

```javascript
app.listen(3006, '127.0.0.1');
```

이렇게 하면 Node.js는 로컬에서만 접근할 수 있고 외부 사용자는 Apache를 통해서만 API에 접근한다.

구조도 단순해진다.

```text
Internet
   ↓
Apache :443
   ↓
127.0.0.1:3006 Node.js
```

Docker를 사용한다면 호스트 포트 공개 여부와 컨테이너 네트워크 구성이 달라질 수 있으므로 동일한 원칙으로 실제 접근 경로를 확인해야 한다.

## 클라이언트 IP가 필요하다면 프록시 환경을 고려한다

Express에서 `req.ip`를 사용하는 API라면 리버스 프록시 환경에서는 프록시 신뢰 설정도 확인해야 한다.

```javascript
app.set('trust proxy', 'loopback');
```

같은 서버의 Apache만 신뢰하는 구성이라면 실제 배포 구조에 맞춰 제한적으로 설정하는 것이 좋다.

무조건 모든 프록시를 신뢰하도록 설정하기보다 Apache가 어떤 헤더를 전달하고 Node.js가 어떤 프록시를 신뢰할지 함께 설계해야 한다.

이 부분은 404 해결과 직접적인 관련은 없지만 IP 화이트리스트나 접근 제어가 있는 API에서는 연결 직후 자주 확인하게 되는 항목이다.

## 문제를 찾는 순서를 고정하면 빨라진다

리버스 프록시 문제를 해결할 때는 설정 파일을 계속 바꾸기보다 확인 순서를 고정하는 편이 효율적이다.

```text
1. Node.js 프로세스가 실행 중인지 확인
        ↓
2. 127.0.0.1:포트로 API 직접 호출
        ↓
3. Express 라우트와 실제 전달 경로 비교
        ↓
4. apachectl configtest
        ↓
5. Apache reload
        ↓
6. 외부 URL을 curl -i로 호출
        ↓
7. Apache access/error log 확인
        ↓
8. 필요하면 curl --resolve로 서버별 검증
```

이 순서를 따르면 `Apache 문제인지 Node.js 문제인지`부터 빠르게 분리할 수 있다.

## 마무리

Apache와 Node.js를 연결하는 리버스 프록시 자체는 몇 줄의 설정으로 끝난다. 그러나 실제 운영에서 중요한 부분은 요청 경로가 어떻게 변환되는지 이해하고, 장애가 발생했을 때 어느 계층에서 실패했는지 분리하는 것이다.

특히 다음 세 가지를 기억하면 404 문제의 대부분을 빠르게 좁힐 수 있다.

- Node.js API를 `127.0.0.1`에서 먼저 직접 호출한다.
- `ProxyPass` 이후의 경로와 Express Router의 경로를 정확히 비교한다.
- 여러 서버를 사용하는 환경이라면 모든 서버에 동일한 Apache 설정이 적용되었는지 확인한다.

리버스 프록시 문제는 설정을 많이 바꾸는 것보다 요청이 지나가는 경로를 한 단계씩 검증하는 것이 가장 빠른 해결 방법이다.
