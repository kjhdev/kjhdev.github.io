---
title: "Fix Spring Boot .env DB_URL Environment Variable Errors"
pubDate: 2026-09-09T12:16:37+09:00
description: "Learn why Spring Boot may pass the literal ${DB_URL} string as a JDBC URL and how to correctly load environment variables on macOS, VS Code, and Docker."
category: Spring Boot
tags:
  - Spring Boot
  - MySQL
  - Environment Variables
  - macOS
  - VS Code
  - Docker
lang: en
---

The same Spring Boot project can connect to MySQL correctly on one machine and fail on another with an error like:

```text
Driver com.mysql.cj.jdbc.Driver claims to not accept jdbcUrl, ${DB_URL}
```

The key clue is that the JDBC driver received the literal **`${DB_URL}`** string instead of a real JDBC URL.

For example:

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

with a project-level `.env` file:

```env
DB_URL=jdbc:mysql://db.example.com:3306/app?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
DB_USERNAME=dev
DB_PASSWORD=example-password
```

A plain `.env` file is not automatically exported into the process environment by a standard Spring Boot application.

## 1. Check whether the variable exists

In the terminal that will run Spring Boot:

```bash
echo $DB_URL
```

or:

```bash
printenv DB_URL
```

To inspect all DB-related variables:

```bash
env | grep '^DB_'
```

If nothing is printed, the file exists but the running process does not have the variable.

## 2. Load `.env` on macOS

For a simple `KEY=VALUE` file in zsh:

```bash
set -a
source .env
set +a
```

Verify:

```bash
echo $DB_URL
```

Then launch Spring Boot from the same shell.

Gradle:

```bash
./gradlew bootRun
```

Maven:

```bash
./mvnw spring-boot:run
```

Packaged JAR:

```bash
java -jar build/libs/app.jar
```

The Java process must inherit the environment from the shell where `.env` was loaded.

## 3. VS Code terminal and Run/Debug may differ

`echo $DB_URL` may work in the integrated terminal while Run or Debug still fails.

The Java process launched by VS Code can use a different environment.

A project-level Java launch configuration can explicitly load `.env`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "Run Spring Boot",
      "request": "launch",
      "mainClass": "com.example.Application",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

Do not commit real secrets.

```gitignore
.env
```

Commit a template instead:

```env
DB_URL=
DB_USERNAME=
DB_PASSWORD=
```

## 4. Use development defaults when appropriate

Spring placeholders can include fallback values:

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://localhost:3306/app}
    username: ${DB_USERNAME:dev}
    password: ${DB_PASSWORD}
```

Avoid embedding real production passwords as defaults.

## 5. Docker Compose `.env` is not the same as container environment

Compose can read `.env` for interpolation, but the Spring Boot container must still receive the variables.

```yaml
services:
  api:
    image: example-api
    environment:
      DB_URL: ${DB_URL}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
```

Or:

```yaml
services:
  api:
    image: example-api
    env_file:
      - .env
```

Verify inside the container:

```bash
docker compose exec api printenv DB_URL
```

It should print the actual JDBC URL.

## 6. Why one computer works and another does not

The working machine may already have:

- variables exported in `~/.zshrc`,
- a VS Code launch configuration,
- IDE-specific environment settings,
- Docker Compose `env_file`,
- variables exported in an existing shell.

Copying `.env` alone does not recreate all of those conditions.

## 7. Diagnose the correct layer

If the error still contains:

```text
jdbcUrl, ${DB_URL}
```

check environment-variable resolution first.

If the application already has:

```text
jdbc:mysql://db.example.com:3306/app
```

then investigate:

- MySQL service status,
- hostname and port,
- firewall or port forwarding,
- DB user permissions,
- database name,
- SSL options.

## Final troubleshooting order

```text
Confirm ${DB_URL} in application.yml
        ↓
Run printenv DB_URL
        ↓
Load .env if missing
        ↓
Check VS Code envFile
        ↓
Check Docker container environment
        ↓
Then troubleshoot MySQL connectivity
```

The main lesson is simple: **having a `.env` file is not the same as making those values available to the Spring Boot process**.
