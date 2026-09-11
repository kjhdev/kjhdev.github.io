---
title: "Migrate MySQL 5.7 to a Current MySQL Docker Setup"
pubDate: 2026-09-11T09:15:59+09:00
description: "A practical guide to moving an Ubuntu MySQL 5.7 server to a Docker-based MySQL 9.7 LTS environment with backups, staged compatibility checks, Docker Compose, imports, account recreation, cutover, and rollback planning."
category: MySQL
tags:
  - MySQL
  - MySQL 5.7
  - Docker
  - Docker Compose
  - Database Migration
  - Ubuntu
lang: en
---

Moving an old MySQL 5.7 server into Docker can simplify versioning, storage, and infrastructure management.

The dangerous shortcut is:

```text
MySQL 5.7 dump
→ start the newest MySQL container
→ import immediately
→ done
```

As of September 2026, **MySQL 9.7 is the current LTS line**, and the Docker Official Image provides `mysql:9.7` and `mysql:lts` tags.

Docker does not remove major-version compatibility problems, so a production migration should include staged validation.

## 1. Target architecture

Existing server:

```text
Ubuntu
└── MySQL 5.7
    └── app_db
```

New server:

```text
Ubuntu
└── Docker
    └── MySQL 9.7 LTS
        ├── app_db
        └── mysql_data volume
```

If the application is also containerized:

```text
application container
        │
        ▼
Docker network
        │
        ▼
MySQL container
```

## 2. Back up MySQL 5.7 first

For an InnoDB-based application database:

```bash
mysqldump \
  -u backup_user \
  -p \
  --single-transaction \
  --routines \
  --events \
  --triggers \
  --databases app_db \
  > app_db_57.sql
```

Key options:

```text
--single-transaction
→ consistent logical backup for InnoDB workloads

--routines
→ procedures and functions

--events
→ Event Scheduler objects

--triggers
→ triggers
```

For multiple application databases, separate dumps can simplify testing and recovery.

## 3. Validate the backup file

```bash
ls -lh app_db_57.sql
```

A file existing on disk does not prove the backup is usable.

Restore it into a disposable test instance and verify important tables and stored objects.

## 4. Record users and grants

Check source accounts:

```sql
SELECT
    user,
    host,
    plugin
FROM mysql.user;
```

Record grants:

```sql
SHOW GRANTS FOR 'app_user'@'%';
```

Instead of overwriting the new server's `mysql` system schema with the old one, recreate application accounts and grant only the privileges they need.

```sql
CREATE USER 'app_user'@'%'
IDENTIFIED BY 'NEW_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE
ON app_db.*
TO 'app_user'@'%';
```

Keep real passwords out of tutorials, Compose files, and public repositories.

## 5. Do not mount a 5.7 data directory into MySQL 9.7

The supported release path crosses intermediate series:

```text
MySQL 5.7
↓
MySQL 8.0
↓
MySQL 8.4 LTS
↓
MySQL 9.7 LTS
```

Avoid a shortcut like:

```yaml
services:
  mysql:
    image: mysql:9.7
    volumes:
      - /old/mysql57/datadir:/var/lib/mysql
```

A data directory created by a much older server is not a safe migration path for a current server.

## 6. Build staged test environments

Use copies of production data:

```text
5.7 dump
↓
8.0 test
↓
fix compatibility issues
↓
8.4 test
↓
9.7 test
```

Run MySQL Shell Upgrade Checker for each supported transition.

Example:

```bash
mysqlsh -- util check-for-server-upgrade \
  user@db.example.com:3306 \
  --target-version=8.0 \
  --output-format=JSON
```

Resolve compatibility errors before advancing.

## 7. Prepare MySQL 9.7 with Docker Compose

Example `compose.yaml`:

```yaml
services:
  mysql:
    image: mysql:9.7
    container_name: mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      TZ: Asia/Seoul
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-network

volumes:
  mysql_data:

networks:
  app-network:
    name: app-network
```

`.env`:

```env
MYSQL_ROOT_PASSWORD=change-this-password
```

Exclude it from Git:

```gitignore
.env
```

For higher-security environments, consider Docker Secrets or an external secret-management system.

## 8. Avoid `mysql:latest` for production

This is convenient:

```yaml
image: mysql:latest
```

but `latest` can move to another Innovation release line.

For an LTS production deployment, specify the intended series:

```yaml
image: mysql:9.7
```

For strict change control, pin the tested patch release or image digest.

## 9. Start the new database

```bash
docker compose up -d
```

Check status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f mysql
```

Connect:

```bash
docker compose exec mysql mysql -uroot -p
```

Verify:

```sql
SELECT VERSION();
```

## 10. Import the final compatible dump

After staged testing has produced a dump known to work on the target:

```bash
docker compose exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  < app_db_97.sql
```

Command-line password handling can expose secrets through shell history or process inspection, so use a safer credential mechanism for production automation.

## 11. Validate database objects

Table counts:

```sql
SELECT
    table_schema,
    COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'app_db'
GROUP BY table_schema;
```

Critical rows:

```sql
SELECT COUNT(*)
FROM important_table;
```

Stored procedures:

```sql
SHOW PROCEDURE STATUS
WHERE Db = 'app_db';
```

Triggers:

```sql
SHOW TRIGGERS
FROM app_db;
```

Events:

```sql
SHOW EVENTS
FROM app_db;
```

Compare results with the source environment.

## 12. Recheck character sets and collations

```sql
SELECT
    schema_name,
    default_character_set_name,
    default_collation_name
FROM information_schema.schemata
WHERE schema_name = 'app_db';
```

Tables:

```sql
SELECT
    table_name,
    table_collation
FROM information_schema.tables
WHERE table_schema = 'app_db';
```

If the source uses `utf8` or `utf8mb3`, test a deliberate move to `utf8mb4` instead of changing everything blindly.

## 13. Recreate users for modern authentication

MySQL 9.x no longer provides the server-side `mysql_native_password` plugin.

Create accounts for the new server and verify that application connectors support current authentication.

```sql
CREATE USER 'app_user'@'%'
IDENTIFIED BY 'NEW_STRONG_PASSWORD';
```

Grant only required permissions:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON app_db.*
TO 'app_user'@'%';
```

## 14. Use the Compose service name from other containers

When application and database containers share a Docker network:

```text
jdbc:mysql://mysql:3306/app_db
```

Example:

```yaml
services:
  api:
    environment:
      DB_URL: jdbc:mysql://mysql:3306/app_db
    networks:
      - app-network

  mysql:
    networks:
      - app-network
```

Inside a container, `localhost` refers to that container itself, not the MySQL service.

## 15. Do not publish MySQL to the host unless necessary

If only other containers need the database, this may be unnecessary:

```yaml
ports:
  - "3306:3306"
```

Containers on the same Docker network can communicate through the service name and internal port.

Publish the port only when direct external access is actually required, and combine it with appropriate firewall restrictions.

## 16. Test the application

Validate real features:

```text
Login
Lists
Details
INSERT
UPDATE
DELETE
Batch jobs
Reports
Schedulers
```

For Spring Boot running in Docker:

```bash
docker compose logs -f api
```

A successful application startup is not enough; test real CRUD and business workflows.

## 17. Production cutover

For a dump/import migration, stop writes during the final transfer.

```text
Start maintenance
↓
stop writes on old DB
↓
create final dump
↓
import into new MySQL
↓
validate data
↓
change application DB endpoint
↓
start application
↓
run final checks
```

For very large databases or strict downtime requirements, consider a replication-based migration.

## 18. Prepare rollback

Do not delete the old MySQL 5.7 server immediately after cutover.

```text
old 5.7
→ retain temporarily

new 9.7
→ production
```

Rollback should use the old server or a backup taken before migration.

Do not plan to downgrade a data directory already modified by a newer MySQL release.

## 19. Rebuild backup procedures for Docker

After migration, create backups for the new environment too.

Example:

```bash
docker compose exec -T mysql \
  mysqldump \
  -uroot \
  --single-transaction \
  --routines \
  --events \
  --triggers \
  --databases app_db \
  > app_db_backup.sql
```

Pass credentials through a secure mechanism.

Keep backups outside the same failure domain as the database volume:

```text
database volume
+
separate backup storage
```

## Final migration flow

```text
Inventory MySQL 5.7
↓
create rollback backup
↓
run compatibility checks
↓
validate 5.7 → 8.0 → 8.4 → 9.7
↓
create MySQL 9.7 Docker environment
↓
import compatible dump
↓
recreate users and grants
↓
validate data
↓
switch application connection
↓
run regression tests
↓
production cutover
↓
retain old server temporarily
```

## Conclusion

When moving MySQL 5.7 into a current Docker setup, Docker is not the difficult part. **Major-version compatibility is.**

Follow three core rules:

```text
Do not mount a MySQL 5.7 data directory directly into a current server
Validate required intermediate release transitions
Keep a tested rollback backup before production cutover
```

Those rules make it much safer to retire an old database server and move to a maintainable Docker-based environment.

## References

- MySQL Upgrade Paths  
  https://dev.mysql.com/doc/refman/9.7/en/upgrade-paths.html
- MySQL Shell Upgrade Checker  
  https://dev.mysql.com/doc/mysql-shell/9.7/en/mysql-shell-utilities-upgrade.html
- MySQL Official Docker Image  
  https://hub.docker.com/_/mysql
- MySQL Backup and Recovery  
  https://dev.mysql.com/doc/refman/9.7/en/backup-and-recovery.html
