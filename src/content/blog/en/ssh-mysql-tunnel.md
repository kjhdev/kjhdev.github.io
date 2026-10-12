---
title: "Safely Connect to Remote MySQL Through an SSH Tunnel"
pubDate: 2026-09-16T09:16:31+09:00
description: "Use SSH local port forwarding to access a remote MySQL server without exposing port 3306 publicly, with loopback binding, forwarding checks, and keepalive settings."
category: Server
tags:
  - SSH
  - MySQL
  - Port Forwarding
  - Ubuntu
  - Security
lang: en
updatedDate: "2026-10-12"
---

A remote MySQL server does not need to expose port 3306 to the public internet just because a developer needs database access.

SSH Local Port Forwarding can map a local port through an encrypted SSH connection to MySQL on the remote server.

```text
Local computer
127.0.0.1:13306
  ↓
SSH tunnel
  ↓
Remote server
127.0.0.1:3306
  ↓
MySQL
```

## Basic command

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 user@server.example.com
```

The `-L` format is:

```text
-L [local-address:]local-port:remote-host:remote-port
```

`-N` tells SSH not to run a remote command and to use the connection only for forwarding.

## Local application configuration

A Spring Boot development environment can use:

```env
DB_URL=jdbc:mysql://127.0.0.1:13306/app
DB_USERNAME=app_user
DB_PASSWORD=example-password
```

The application sees MySQL as a local service on port `13306`.

## Bind to loopback

Use:

```text
127.0.0.1:13306
```

OpenSSH creates a local listening socket for `-L`. Binding it to loopback limits access to the same machine.

## Detect forwarding setup failures

Add:

```bash
-o ExitOnForwardFailure=yes
```

Example:

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

This makes SSH terminate if the requested forwarding cannot be established.

It does not guarantee that every later connection to the final MySQL destination will succeed.

## Add keepalive settings

```bash
-o ServerAliveInterval=60
-o ServerAliveCountMax=3
```

Example:

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@server.example.com
```

## Custom SSH port

```bash
ssh -p 2200 -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

Replace the port with the actual server configuration.

## Run in the background

Use `-f`:

```bash
ssh -f -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes user@server.example.com
```

For automation, check whether the local port is already in use before starting another tunnel.

## Verify the tunnel

```bash
lsof -iTCP:13306 -sTCP:LISTEN
```

or:

```bash
nc -z 127.0.0.1 13306
```

Test with the MySQL client:

```bash
mysql -h 127.0.0.1 -P 13306 -u app_user -p
```

## MySQL running in Docker

The remote MySQL container can publish its port only to the server loopback interface:

```yaml
ports:
  - "127.0.0.1:3306:3306"
```

The SSH forwarding destination can then remain:

```text
127.0.0.1:3306
```

This keeps MySQL off the public network.

## Recommended command

```bash
ssh -N -L 127.0.0.1:13306:127.0.0.1:3306 -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@server.example.com
```

The application connects to:

```text
127.0.0.1:13306
```

## Isolate each part of the connection

The following is a **reproducible example topology**, not a claim that these exact endpoints were used in a production deployment.

| Layer | Example | What to verify |
|---|---|---|
| Developer machine | macOS, `127.0.0.1:13306` | The local port is free |
| SSH endpoint | Ubuntu server, SSH port 22 | SSH authentication and firewall |
| Database | `127.0.0.1:3306` on the server | MySQL listener or Docker port publishing |
| Client | Spring Boot or MySQL CLI | Database credentials and grants |

1. Verify that `ssh user@server.example.com` can log in **without forwarding**.
2. On the server, inspect `ss -lntp | grep 3306` and, for Docker, check the published ports in `docker ps`.
3. Start the SSH forwarding command on the developer machine. With `-N`, a running foreground process is expected.
4. In **another terminal**, check the end-to-end database connection:

```bash
mysql -h 127.0.0.1 -P 13306 -u app_user -p -e "SELECT 1"
```

A passing `lsof` or `nc` check confirms a local listener. It does **not** prove that MySQL authentication works. Use a database client to verify the final hop.

## Troubleshoot by symptom

| Symptom | First place to investigate | Action |
|---|---|---|
| `Address already in use` | Developer machine | Check `lsof -nP -iTCP:13306 -sTCP:LISTEN` |
| SSH `Permission denied` | SSH endpoint | Verify account, key, and authentication |
| Tunnel opens, MySQL says `Connection refused` | Remote destination | Check the server's port 3306 listener and Docker mapping |
| MySQL `Access denied` | Database | Inspect username, password, and database grants |
| Repeated disconnects | Network or SSH | Review keepalive and server-side timeout settings |

Port forwarding solves the **network path**. It does not replace MySQL permissions, SSH access control, or firewall rules.

## Related troubleshooting notes

- [Spring Boot DB_URL environment variable errors](/en/posts/spring-env-db-url/): when SSH works but the application does not
- [Deploying Spring Boot with Docker](/en/posts/spring-boot-docker-deploy/): when host and container networking behave differently

## Conclusion

SSH local forwarding is a simple way to use remote MySQL without publishing port 3306.

The key principles are:

```text
keep MySQL off the public internet
bind the local tunnel to 127.0.0.1
connect applications to the local forwarded port
```

## References

- OpenSSH ssh Manual  
  https://man.openbsd.org/ssh
- OpenSSH ssh_config  
  https://man.openbsd.org/ssh_config
