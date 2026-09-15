---
title: "Ubuntu Nginx에 Let’s Encrypt 무료 SSL 적용하기"
pubDate: 2026-09-15T09:17:07+09:00
description: "Ubuntu 서버의 Nginx에 Certbot과 Let’s Encrypt를 이용해 무료 HTTPS 인증서를 적용하고 자동 갱신까지 확인하는 과정을 간단하게 정리한다."
category: Server
tags:
  - Ubuntu
  - Nginx
  - Let's Encrypt
  - Certbot
  - SSL
  - HTTPS
lang: ko
---

Ubuntu 서버에서 Nginx로 웹 서비스를 운영한다면 Let’s Encrypt와 Certbot을 이용해 무료 HTTPS를 적용할 수 있다.

전체 흐름은 다음과 같다.

```text
도메인 DNS 연결
↓
HTTP 접속 확인
↓
Certbot 설치
↓
SSL 인증서 발급
↓
HTTPS 확인
↓
자동 갱신 테스트
```

## 1. 도메인이 서버를 가리키는지 확인

A Record가 서버 Public IP를 가리켜야 한다.

```text
example.com
→ server public IP
```

확인:

```bash
nslookup example.com
```

또는:

```bash
dig example.com
```

## 2. Nginx HTTP 접속 확인

먼저 다음 주소가 정상이어야 한다.

```text
http://example.com
```

Nginx 예:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

설정 검사:

```bash
sudo nginx -t
```

적용:

```bash
sudo systemctl reload nginx
```

## 3. 80, 443 포트 확인

```text
80  → HTTP
443 → HTTPS
```

AWS EC2라면 Security Group inbound rule도 확인한다.

## 4. Certbot 설치

Certbot 공식 안내에서는 Linux 환경에서 Snap 설치 방식을 권장한다.

```bash
sudo snap install --classic certbot
```

명령 링크:

```bash
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
```

이미 링크가 있으면 다시 만들 필요는 없다.

## 5. SSL 인증서 발급

자동으로 Nginx 설정까지 적용하려면 다음 명령을 사용한다.

```bash
sudo certbot --nginx
```

도메인을 직접 지정할 수도 있다.

```bash
sudo certbot --nginx     -d example.com     -d www.example.com
```

## 6. HTTPS 확인

브라우저에서 다음 주소를 확인한다.

```text
https://example.com
```

Nginx 설정:

```bash
sudo nginx -t
```

인증서 목록:

```bash
sudo certbot certificates
```

## 7. 자동 갱신 테스트

Certbot은 설치 방식에 따라 systemd timer나 cron을 이용해 갱신한다.

테스트:

```bash
sudo certbot renew --dry-run
```

오류 없이 끝나면 자동 갱신 준비가 된 상태이다.

## 8. 인증서 위치

일반적인 경로는 다음과 같다.

```text
/etc/letsencrypt/live/example.com/
```

주요 파일:

```text
fullchain.pem
privkey.pem
```

Certbot이 Nginx 설정을 자동 수정했다면 직접 경로를 작성할 필요는 거의 없다.

## 자주 발생하는 오류

### 인증 실패

다음을 확인한다.

```text
DNS가 서버 IP를 가리키는가
80 포트가 열려 있는가
Nginx가 실행 중인가
server_name이 올바른가
```

### Nginx 설정 오류

```bash
sudo nginx -t
```

출력된 파일과 라인을 수정한 뒤 Certbot을 다시 실행한다.

## 최종 명령

```bash
sudo nginx -t
sudo systemctl reload nginx

sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot

sudo certbot --nginx     -d example.com     -d www.example.com

sudo certbot renew --dry-run
```

## 마무리

Let’s Encrypt SSL 적용에서 가장 중요한 것은 Certbot 실행 전 다음 세 가지를 정상으로 만드는 것이다.

```text
DNS
80 포트
Nginx server_name
```

인증서 발급 후에는 `renew --dry-run`까지 확인해야 한다.

## 참고 자료

- Certbot Nginx Instructions  
  https://certbot.eff.org/instructions?ws=nginx&os=snap
- Let’s Encrypt  
  https://letsencrypt.org/
