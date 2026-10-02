---
title: "Connecting a Node.js API Behind Apache Reverse Proxy: Finding and Fixing 404 Errors"
pubDate: "2026-10-02T14:51:00+09:00"
description: "A practical guide to connecting Apache to a Node.js and Express API with ProxyPass, then isolating 404 errors across Apache, proxy path rewriting, and Express routing."
category: "Web Development"
tags: ["Apache", "Node.js", "Express", "Reverse Proxy", "ProxyPass", "Troubleshooting"]
lang: "en"
---

# Connecting a Node.js API Behind Apache Reverse Proxy: Finding and Fixing 404 Errors

A common deployment pattern is to expose a single HTTPS address such as `https://example.com/api/...` while the actual API runs internally as a Node.js service.

For example, if a Node.js application listens on `127.0.0.1:3006`, Apache can receive public requests and forward only the API path to that internal process.

```text
Browser or app
   ↓ HTTPS
Apache :443
   ↓ forward only /api/
Node.js :3006
```

The configuration itself is short. The harder part is troubleshooting `404 Not Found` responses. You need to determine whether Apache failed to match the request, whether the proxy rewrote the path differently than expected, or whether Express is waiting for another route.

This article explains the basic Apache-to-Node.js reverse proxy setup and a practical way to trace 404 errors one layer at a time.

## Why place Apache in front of Node.js

A Node.js application can be exposed directly, but if Apache already owns the domain and HTTPS configuration, using it as the front door usually simplifies operations.

The main benefits are:

- Existing TLS certificates and port 443 can be reused.
- Only selected paths such as `/api/` or `/admin/` need to be forwarded.
- The Node.js port does not have to be exposed directly to the internet.
- Static pages and API endpoints can share one domain.
- Multiple internal services can use Apache as a single entry point.

For example, Apache can serve the main site while Node.js handles only API requests.

```text
https://example.com/             → Apache website
https://example.com/api/users    → Node.js API
https://example.com/api/status   → Node.js API
```

## Basic Apache configuration

<!-- media:image:3 -->
![Apache 리버스 프록시로 Node.js API 연결하기: 404 원인과 해결 방법](https://media.bubudev.com/images/kjhdev/apache-node-reverse-proxy/apache-node-reverse-proxy-1790932468128-2c14e3.webp)
<!-- /media:image:3 -->

The simplest setup usually uses `ProxyPass` and `ProxyPassReverse` together.

```apache
ProxyPreserveHost On

ProxyPass        /api/ http://127.0.0.1:3006/
ProxyPassReverse /api/ http://127.0.0.1:3006/
```

With this configuration, the external `/api/` prefix is removed before the request reaches Node.js.

```text
External request
/api/verify-token

↓ Apache ProxyPass

Path received by Node.js
/verify-token
```

Express can therefore register `/verify-token` directly.

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

The important rule is simple: **the final path produced by Apache must match the path registered in Express**.

## Path rewriting is the most common source of confusion

Many reverse proxy 404 errors are caused by path mismatches rather than port problems.

Suppose Apache contains this rule:

```apache
ProxyPass /api/ http://127.0.0.1:3006/
```

A client requests:

```text
https://example.com/api/verify-token
```

Node.js receives:

```text
GET /verify-token
```

If Express was written like this, the paths do not match:

```javascript
app.get('/api/verify-token', handler);
```

Express expects `/api/verify-token`, but Apache forwards `/verify-token`, so the request ends in a 404.

There are two straightforward ways to fix this.

### Option 1. Remove the prefix in Apache

```apache
ProxyPass        /api/ http://127.0.0.1:3006/
ProxyPassReverse /api/ http://127.0.0.1:3006/
```

```javascript
app.get('/verify-token', handler);
```

This is often the simplest choice for a small API service.

### Option 2. Keep `/api` inside Node.js

```apache
ProxyPass        /api/ http://127.0.0.1:3006/api/
ProxyPassReverse /api/ http://127.0.0.1:3006/api/
```

```javascript
app.get('/api/verify-token', handler);
```

With an Express Router, the same structure can look like this:

```javascript
const router = express.Router();

router.get('/verify-token', handler);

app.use('/api', router);
```

Either approach is valid. The important point is to review the Apache rule and the Express routing rule as one unit.

## When a 404 appears, call Node.js directly first

Repeatedly testing only the public URL makes it harder to identify the failing layer.

First bypass Apache and call Node.js directly.

```bash
curl -i http://127.0.0.1:3006/verify-token
```

A successful response may look like this:

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"result":"Y","message":"valid"}
```

If this direct request already returns 404, Apache is not the problem.

Check the following first:

- Is the route actually registered in Express?
- Does the `app.use()` prefix match what you expect?
- Is the running process using the latest source code?
- Was the pm2 process or Docker container restarted after the change?
- Is the request using the correct method, such as `GET` or `POST`?

If the direct request succeeds but the public URL fails, move on to the Apache layer.

## Validate Apache configuration before applying it

After editing an Apache configuration file, run a syntax check before reloading the service.

On Ubuntu-based systems, this is commonly done with:

```bash
sudo apachectl configtest
```

A valid configuration should return:

```text
Syntax OK
```

Then reload Apache.

```bash
sudo systemctl reload apache2
```

Some changes may require a restart, but for a normal proxy configuration update it is usually better to check whether a reload is sufficient first.

After applying the change, inspect the Apache logs while sending a request.

```bash
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

If the request never appears in the access log, investigate the path before Apache itself: the wrong VirtualHost, DNS, port forwarding, or a load balancer may be involved.

## Test a specific HTTPS server with curl --resolve

In environments that use DNS or a load balancer, it may be unclear which server is handling the request.

`curl --resolve` lets you keep the hostname while forcing the request to a specific IP address.

```bash
curl -k -i \
  --resolve example.com:443:127.0.0.1 \
  'https://example.com/api/verify-token'
```

This is useful for checking several things at once:

- Is the expected Apache VirtualHost active on this server?
- Does HTTPS work on the target server?
- Is the `/api/` ProxyPass rule being applied?
- Does the request reach Node.js?

This becomes especially important when two or more backend servers sit behind a load balancer.

If one server has the proxy configuration and another does not, the same URL can appear to work intermittently: some requests succeed while others return 404.

## Identify which layer generated the 404

Not every 404 is the same.

Distinguishing an Apache-generated 404 from an Express-generated 404 can significantly reduce troubleshooting time.

Inspect both the response headers and body.

```bash
curl -i https://example.com/api/verify-token
```

An Express default 404 may contain something similar to:

```text
Cannot GET /verify-token
```

If you instead receive an Apache error page, the request may not have matched the ProxyPass rule, or another VirtualHost or Location rule may have handled it first.

Application-side request logging also helps.

```javascript
app.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});
```

If a request appears in the Node.js log, the proxy path from Apache to Node.js is working. If there is no Node.js log entry at all, the problem is probably earlier in the request path.

## Check Location blocks and overlapping proxy rules

Some deployments use `<Location>` to apply access control or headers to a specific API path.

```apache
<Location /api/>
    ProxyPass http://127.0.0.1:3006/
    ProxyPassReverse http://127.0.0.1:3006/
</Location>
```

The same rule still applies: determine exactly what internal URL `/api/verify-token` becomes.

Also check whether several VirtualHost or configuration files contain similar proxy rules.

```bash
grep -R "ProxyPass" /etc/apache2/sites-enabled /etc/apache2/conf-enabled
```

On long-running servers, old configuration files may remain enabled, or the same path may be defined in more than one place.

## The Node.js port often does not need public exposure

When Apache and Node.js run on the same server, Node.js often does not need to listen on every network interface.

```javascript
app.listen(3006, '127.0.0.1');
```

This keeps the Node.js service reachable only from the local machine, while external clients must go through Apache.

```text
Internet
   ↓
Apache :443
   ↓
127.0.0.1:3006 Node.js
```

When Docker is involved, host port publishing and container networking change the exact connection path, but the same principle applies: verify the real route that Apache uses to reach the application.

## Account for the proxy when the API needs client IP addresses

If an Express application uses `req.ip`, reverse proxy deployments also need an appropriate proxy trust configuration.

```javascript
app.set('trust proxy', 'loopback');
```

If Apache on the same machine is the only trusted proxy, the trust rule should be restricted to the actual deployment structure.

Avoid blindly trusting every proxy. Decide which forwarded headers Apache supplies and which proxies Node.js is allowed to trust.

This is not directly required to fix a 404, but it often becomes important immediately afterward when an API uses IP allowlists or access control.

## A fixed troubleshooting order saves time

Instead of repeatedly editing configuration files, use the same diagnostic sequence every time.

```text
1. Confirm that the Node.js process is running
        ↓
2. Call the API directly through 127.0.0.1:port
        ↓
3. Compare the Express route with the path Apache forwards
        ↓
4. Run apachectl configtest
        ↓
5. Reload Apache
        ↓
6. Call the public URL with curl -i
        ↓
7. Check Apache access and error logs
        ↓
8. If needed, verify each server with curl --resolve
```

This process quickly separates a Node.js problem from an Apache problem before deeper debugging begins.

## Conclusion

Connecting Apache and Node.js through a reverse proxy requires only a few configuration lines. In production, however, the important part is understanding how the request path changes and identifying the exact layer where a failure occurs.

Three checks solve a large portion of reverse proxy 404 problems:

- Call the Node.js API directly through `127.0.0.1` first.
- Compare the path after `ProxyPass` with the route registered in Express.
- In multi-server environments, confirm that every backend server has the same Apache configuration.

When debugging a reverse proxy, tracing the request one layer at a time is usually faster than repeatedly changing configuration and testing the full stack again.

