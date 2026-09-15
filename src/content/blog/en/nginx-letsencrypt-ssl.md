---
title: "Enable Free Let’s Encrypt SSL on Ubuntu Nginx"
pubDate: 2026-09-15T09:17:07+09:00
description: "A concise guide to enabling HTTPS on Ubuntu Nginx with Certbot and Let’s Encrypt, including DNS checks, certificate issuance, Nginx configuration, and renewal testing."
category: Server
tags:
  - Ubuntu
  - Nginx
  - Let's Encrypt
  - Certbot
  - SSL
  - HTTPS
lang: en
---

Let’s Encrypt and Certbot can add free HTTPS to an Ubuntu Nginx server.

The basic flow is:

```text
Point DNS to the server
↓
verify HTTP access
↓
install Certbot
↓
issue certificate
↓
verify HTTPS
↓
test renewal
```

## 1. Check DNS

The domain A record must point to the server public IP.

```text
example.com
→ server public IP
```

Check it with:

```bash
nslookup example.com
```

or:

```bash
dig example.com
```

## 2. Verify HTTP access

Before requesting a certificate, confirm:

```text
http://example.com
```

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

Validate:

```bash
sudo nginx -t
```

Reload:

```bash
sudo systemctl reload nginx
```

## 3. Open ports 80 and 443

```text
80  → HTTP
443 → HTTPS
```

On AWS EC2, check the Security Group inbound rules too.

## 4. Install Certbot

Certbot currently recommends Snap for most Linux users.

```bash
sudo snap install --classic certbot
```

Create the command link:

```bash
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
```

## 5. Issue the certificate

Run:

```bash
sudo certbot --nginx
```

Or specify domains directly:

```bash
sudo certbot --nginx     -d example.com     -d www.example.com
```

Certbot can request the certificate and update Nginx automatically.

## 6. Verify HTTPS

Open:

```text
https://example.com
```

Check Nginx:

```bash
sudo nginx -t
```

List certificates:

```bash
sudo certbot certificates
```

## 7. Test automatic renewal

```bash
sudo certbot renew --dry-run
```

A successful dry run confirms that renewal can complete automatically.

## 8. Certificate location

Typical files are stored under:

```text
/etc/letsencrypt/live/example.com/
```

Important files include:

```text
fullchain.pem
privkey.pem
```

Manual path configuration is usually unnecessary when Certbot edits Nginx directly.

## Common failures

### Domain validation fails

Check:

```text
DNS points to the correct server
port 80 is reachable
Nginx is running
server_name is correct
```

### Nginx validation fails

Run:

```bash
sudo nginx -t
```

Fix the reported configuration error before running Certbot again.

## Final command flow

```bash
sudo nginx -t
sudo systemctl reload nginx

sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot

sudo certbot --nginx     -d example.com     -d www.example.com

sudo certbot renew --dry-run
```

## Conclusion

The key requirement is to make these work before running Certbot:

```text
DNS
port 80
Nginx server_name
```

After issuance, test renewal with `renew --dry-run`.

## References

- Certbot Nginx Instructions  
  https://certbot.eff.org/instructions?ws=nginx&os=snap
- Let’s Encrypt  
  https://letsencrypt.org/
