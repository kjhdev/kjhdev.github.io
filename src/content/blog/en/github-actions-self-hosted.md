---
title: "Deploying to a Synology Private Server with a GitHub Self-hosted Runner"
pubDate: "2026-09-22T07:36:00+09:00"
description: "How I connected main-branch pushes to Docker deployments on an Ubuntu VM hosted by Synology, without making the private server a public SSH deployment target."
category: "DevOps"
tags: ["GitHub Actions", "Self-hosted Runner", "CI/CD", "Deployment", "Docker", "Synology"]
lang: "en"
---

I run several Docker-based side projects on an Ubuntu VM hosted by Synology. The original deployment loop was repetitive: push from the development machine, SSH to the server, pull the repository, and restart the relevant service.

Because the server lives on a private network, I did not want deployment automation to depend on exposing it as a public SSH target. I moved the execution point inside the network with a **GitHub Actions Self-hosted Runner**.

## Before and after

```text
Before
Mac → GitHub push → SSH to server → git pull → Docker deploy

After
Mac → main push → GitHub Actions → private Runner → build / deploy
```

A GitHub-hosted Runner no longer needs direct inbound access to the server. The private Runner receives jobs from GitHub and executes them locally.

## Multiple Docker projects change the design

The server does not host a single application. Several projects have separate Compose files, ports, and environment settings. That made it important to keep repository-specific deployment paths and commands explicit rather than giving a Runner unrestricted scripts that affect the whole host.

A minimal workflow is still small:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh
```

The project-specific behavior belongs in `deploy.sh`.

## Do not mix deployment models accidentally

`actions/checkout` creates a checkout in the Runner workspace. If a separate production directory also performs `git pull`, it becomes easy to lose track of which copy was actually deployed.

Choose an explicit model:

```text
A. build in Runner workspace → deploy artifact/image
B. synchronize a known runtime directory → run Compose there
```

## Keep Docker deployment scope small

A basic script can be:

```bash
#!/bin/bash
set -euo pipefail

docker compose build
docker compose up -d
```

On a multi-project server, one repository deployment should not restart unrelated containers. Avoid host-wide Docker restarts and unnecessary `docker compose down` operations.

## A Self-hosted Runner inherits server failures

The Runner does not isolate deployment from host problems. A full disk can break Docker builds. A reboot can change process state. Repository lock files or a stopped Runner can make an otherwise valid workflow fail.

Useful host checks include:

```bash
df -h
docker ps
docker system df
```

This was an important operational lesson: a Self-hosted Runner is not a managed deployment server. It is an agent executing CI/CD commands on infrastructure that I still have to maintain.

## Keep secrets out of the repository

Runtime `.env` files, API keys, and database passwords stay outside public workflow examples and source files. Deployment scripts should also avoid echoing secret values.

```text
Git repository: source and deployment procedure
server: runtime secrets and environment-specific values
```

## Verify the service, not only the workflow

A Docker command can exit successfully while the application fails during startup. The deployment should at least inspect container state and recent logs:

```bash
docker compose ps
docker compose logs --tail=100
```

A health check or real HTTP request is an even stronger final gate.

## Why this architecture fit the server

As the number of projects increased, manual SSH deployment became repeated operational work. The Self-hosted Runner connected a specific `main` commit with a visible Actions run while keeping the execution point inside the private network.

The most useful benefit is not automation by itself. It is the ability to connect GitHub events to private-server operations **without turning the server into a publicly reachable SSH deployment target**, while still keeping each project's deployment scope controlled.
