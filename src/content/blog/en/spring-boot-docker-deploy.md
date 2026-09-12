---
title: "Automate Spring Boot JAR Deployment to Ubuntu with Docker"
pubDate: 2026-09-12T20:51:44+09:00
description: "Build a Spring Boot executable JAR locally, upload only the artifact to an Ubuntu server, rebuild the Docker image with Compose, and automate the deployment flow with a shell script."
category: Spring Boot
tags:
  - Spring Boot
  - Docker
  - Ubuntu
  - Gradle
  - Deployment
  - Shell Script
lang: en
---

When a Spring Boot application runs in Docker on an Ubuntu server, the complete source tree does not have to be uploaded for every deployment.

A lightweight workflow is:

```text
Build executable JAR locally
↓
Upload JAR with SCP
↓
Rebuild Docker image
↓
Recreate application container
↓
Check status and logs
```

After the manual commands work reliably, the entire sequence can be wrapped in a single `deploy.sh` script.

## 1. Deployment structure

Local project:

```text
project/
├── build.gradle
├── gradlew
├── src/
└── deploy.sh
```

Ubuntu server:

```text
~/docker/api/
├── app.jar
├── Dockerfile
├── compose.yaml
└── .env
```

The build happens locally, so the server does not need the full source tree or Gradle development setup.

## 2. Build the executable JAR

With the Spring Boot Gradle Plugin:

```bash
./gradlew bootJar
```

The artifact is normally created under:

```text
build/libs/
```

Example:

```text
build/libs/example-0.0.1-SNAPSHOT.jar
```

A complete build can also be used:

```bash
./gradlew build
```

For a deployment script that only needs to package the application, directly invoking `bootJar` keeps the process simple.

## 3. Keep the server-side filename stable

Versioned builds often create different filenames:

```text
example-0.0.1-SNAPSHOT.jar
example-0.0.2.jar
```

Upload the artifact with a stable destination name:

```bash
scp build/libs/example-0.0.1-SNAPSHOT.jar \
    user@server.example.com:~/docker/api/app.jar
```

The server always uses:

```text
app.jar
```

## 4. Dockerfile

Example:

```dockerfile
FROM eclipse-temurin:25-jre

WORKDIR /app

COPY app.jar app.jar

ENTRYPOINT ["java", "-jar", "app.jar"]
```

For a Java 21 application:

```dockerfile
FROM eclipse-temurin:21-jre
```

The runtime must be compatible with the Java version used to build the JAR.

## 5. Docker Compose

Example `compose.yaml`:

```yaml
services:
  api:
    build:
      context: .
    container_name: api
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8080:8080"
    networks:
      - app-network

networks:
  app-network:
    external: true
```

If MySQL is on the same Docker network:

```env
DB_URL=jdbc:mysql://mysql:3306/app
DB_USERNAME=app_user
DB_PASSWORD=change-this-password
```

Do not commit real credentials.

```gitignore
.env
```

## 6. Verify the manual workflow first

Build:

```bash
./gradlew bootJar
```

Check the artifact:

```bash
ls -lh build/libs
```

Upload:

```bash
scp build/libs/example.jar \
    user@server.example.com:~/docker/api/app.jar
```

Connect:

```bash
ssh user@server.example.com
```

Deploy:

```bash
cd ~/docker/api
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs -f api
```

Automation is easier to debug when each manual command already works.

## 7. Basic `deploy.sh`

```bash
#!/bin/bash

set -euo pipefail

SERVER="user@server.example.com"
REMOTE_DIR="~/docker/api"

echo "[1/4] Build JAR"
./gradlew bootJar

echo "[2/4] Find JAR"
JAR_FILE=$(find build/libs \
    -maxdepth 1 \
    -type f \
    -name "*.jar" \
    ! -name "*-plain.jar" \
    | head -n 1)

if [ -z "$JAR_FILE" ]; then
    echo "JAR file not found"
    exit 1
fi

echo "[3/4] Upload"
scp "$JAR_FILE" "$SERVER:$REMOTE_DIR/app.jar"

echo "[4/4] Deploy"
ssh "$SERVER" \
    "cd $REMOTE_DIR && docker compose up -d --build"

echo "Deploy complete"
```

Make it executable:

```bash
chmod +x deploy.sh
```

Deploy:

```bash
./deploy.sh
```

## 8. Custom SSH port

```bash
SSH_PORT="2200"
```

SCP uses uppercase `-P`:

```bash
scp -P "$SSH_PORT" "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar"
```

SSH uses lowercase `-p`:

```bash
ssh -p "$SSH_PORT" "$SERVER" \
    "cd $REMOTE_DIR && docker compose up -d --build"
```

## 9. Upload to a temporary filename

Avoid overwriting the active JAR while the transfer is still running.

```bash
scp "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar.new"
```

Then replace it remotely:

```bash
ssh "$SERVER" "
    set -e
    cd $REMOTE_DIR
    mv app.jar.new app.jar
    docker compose up -d --build
"
```

If the upload fails, the current `app.jar` remains intact.

## 10. A more practical deployment script

```bash
#!/bin/bash

set -euo pipefail

SERVER="user@server.example.com"
REMOTE_DIR="~/docker/api"
SSH_PORT="2200"

echo "[1/5] Build"
./gradlew bootJar

echo "[2/5] Find JAR"
JAR_FILE=$(find build/libs \
    -maxdepth 1 \
    -type f \
    -name "*.jar" \
    ! -name "*-plain.jar" \
    | head -n 1)

if [ -z "$JAR_FILE" ]; then
    echo "JAR file not found"
    exit 1
fi

echo "[3/5] Upload"
scp -P "$SSH_PORT" \
    "$JAR_FILE" \
    "$SERVER:$REMOTE_DIR/app.jar.new"

echo "[4/5] Deploy"
ssh -p "$SSH_PORT" "$SERVER" "
    set -e
    cd $REMOTE_DIR

    if [ -f app.jar ]; then
        cp app.jar app.jar.backup
    fi

    mv app.jar.new app.jar
    docker compose up -d --build
"

echo "[5/5] Check"
ssh -p "$SSH_PORT" "$SERVER" "
    cd $REMOTE_DIR
    docker compose ps
"

echo "Deploy complete"
```

## 11. Why `docker compose restart` is not enough

If the Dockerfile contains:

```dockerfile
COPY app.jar app.jar
```

changing the host-side JAR does not change the existing Docker image.

This only restarts the current container:

```bash
docker compose restart
```

The image must be rebuilt to include the new artifact:

```bash
docker compose up -d --build
```

Compose can recreate the service container when its image or configuration changes.

## 12. `docker compose down` is usually unnecessary

This works:

```bash
docker compose down
docker compose up -d --build
```

but taking down the complete Compose project for every application update is often unnecessary.

For a normal application deployment:

```bash
docker compose up -d --build
```

is usually sufficient and avoids stopping unrelated services such as a database.

## 13. Simple rollback

Before replacing the JAR:

```bash
cp app.jar app.jar.backup
```

If the new deployment has a problem:

```bash
mv app.jar.backup app.jar
docker compose up -d --build
```

For larger production systems, versioned artifacts or immutable Docker image tags provide a stronger rollback strategy.

## 14. Check deployment logs

Recent logs:

```bash
docker compose logs --tail=100 api
```

Continuous logs:

```bash
docker compose logs -f api
```

Verify at least:

```text
Container is running
Spring Boot started successfully
Database connection succeeded
Environment variables loaded
Application port is reachable
```

## 15. Why build locally

Uploading source code and building on the server is also possible, but local packaging has several advantages for smaller deployments:

```text
No Gradle installation on the server
No complete source-code upload
Lower server CPU and memory usage
Clear deployment artifact
Simpler server directory
```

As the project grows, the same commands can later move into GitHub Actions, Jenkins, GitLab CI, or another CI/CD system.

## Final flow

The developer runs:

```bash
./deploy.sh
```

The script performs:

```text
./gradlew bootJar
↓
find JAR under build/libs
↓
upload app.jar.new
↓
back up current app.jar
↓
replace app.jar
↓
docker compose up -d --build
↓
docker compose ps
```

## Conclusion

A Spring Boot application running in Docker does not require the entire source repository to be copied to the server for every release.

The essential deployment process is:

```text
Build executable JAR locally
+
upload only the artifact
+
rebuild the Docker image
```

Wrapping those commands in a shell script removes repetitive deployment work and creates a clean path toward CI/CD automation later.

## References

- Spring Boot Gradle Plugin - Packaging Executable Archives  
  https://docs.spring.io/spring-boot/gradle-plugin/packaging.html
- Docker Compose `up`  
  https://docs.docker.com/reference/cli/docker/compose/up/
- Docker Compose Services  
  https://docs.docker.com/reference/compose-file/services/
