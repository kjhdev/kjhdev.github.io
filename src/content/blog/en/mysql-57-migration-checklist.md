---
title: "MySQL 5.7 Migration Checklist for Current MySQL Releases"
pubDate: 2026-09-11T09:15:59+09:00
description: "A practical checklist for migrating MySQL 5.7 to a current LTS release, covering upgrade paths, SQL modes, reserved words, character sets, authentication plugins, application drivers, and rollback planning."
category: MySQL
tags:
  - MySQL
  - MySQL 5.7
  - Database Migration
  - Upgrade
  - Docker
  - MySQL Shell
lang: en
---

Many long-running systems still use MySQL 5.7. When infrastructure is rebuilt or databases move into Docker, it is tempting to export the data and load it directly into the newest server.

A major-version migration needs more preparation than that.

As of September 2026, MySQL provides LTS and Innovation release tracks. For production environments that prioritize long-term stability, **MySQL 9.7 LTS** is the current LTS line to consider.

This guide covers the main checks to perform before moving a MySQL 5.7 workload to a current LTS release.

## 1. Distinguish an upgrade from a migration

An upgrade follows supported server-version transitions:

```text
MySQL 5.7
→ MySQL 8.0
→ MySQL 8.4 LTS
→ MySQL 9.7 LTS
```

MySQL's supported upgrade matrix does not allow required Bugfix or LTS series to be skipped.

A migration usually builds a clean target server and moves logical data:

```text
Existing MySQL 5.7
        ↓
logical dump
        ↓
compatibility checks and fixes
        ↓
new MySQL environment
```

A clean Docker target can be easier to manage, but version compatibility still must be tested.

## 2. Record the exact source version

```sql
SELECT VERSION();
```

or:

```bash
mysql --version
```

Record the complete patch version rather than only "5.7".

MySQL recommends moving to the latest release within the current series before advancing to the next supported series.

## 3. Inventory schemas and database sizes

```sql
SHOW DATABASES;
```

Estimate sizes:

```sql
SELECT
    table_schema,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
GROUP BY table_schema
ORDER BY size_mb DESC;
```

Keep system schemas separate from application schemas:

```text
information_schema
mysql
performance_schema
sys
```

Avoid treating an old `mysql` system schema as an ordinary application database to overwrite on the target. Recreate and validate users and privileges for the new version.

## 4. Check storage engines

```sql
SELECT
    table_schema,
    table_name,
    engine
FROM information_schema.tables
WHERE table_schema NOT IN (
    'information_schema',
    'mysql',
    'performance_schema',
    'sys'
)
ORDER BY table_schema, table_name;
```

For application workloads, confirm that important tables use InnoDB where practical.

Investigate legacy engines such as MyISAM before migration.

## 5. Review `sql_mode`

```sql
SELECT @@GLOBAL.sql_mode;
SELECT @@SESSION.sql_mode;
```

Common compatibility areas include:

```text
ONLY_FULL_GROUP_BY
STRICT_TRANS_TABLES
NO_ZERO_DATE
NO_ZERO_IN_DATE
ERROR_FOR_DIVISION_BY_ZERO
```

Older SQL can depend on permissive GROUP BY behavior or invalid date handling.

Rather than permanently weakening the target server configuration, fix incompatible SQL where possible.

## 6. Check reserved-word collisions

New MySQL releases add reserved words.

Generic object names may become problematic:

```text
rank
groups
system
window
```

If needed, rename the object or quote it explicitly:

```sql
SELECT `rank`
FROM example;
```

Avoiding reserved-word names is easier to maintain long term.

## 7. Review character sets and collations

Database defaults:

```sql
SELECT
    schema_name,
    default_character_set_name,
    default_collation_name
FROM information_schema.schemata;
```

Table collations:

```sql
SELECT
    table_schema,
    table_name,
    table_collation
FROM information_schema.tables
WHERE table_schema = 'app_db';
```

Older systems may still use:

```text
latin1
utf8
utf8mb3
```

A modern target commonly uses `utf8mb4`, but conversion should be tested with actual data, index sizes, and application connector settings.

## 8. Find zero-date values

Legacy databases can contain:

```text
0000-00-00
0000-00-00 00:00:00
```

Example:

```sql
SELECT *
FROM example
WHERE created_at = '0000-00-00 00:00:00';
```

Stricter SQL modes can reject these values during later writes.

Clean them up before migration when possible.

## 9. Review authentication plugins

Check source accounts:

```sql
SELECT
    user,
    host,
    plugin
FROM mysql.user;
```

The important compatibility sequence is:

```text
MySQL 8.0
→ caching_sha2_password becomes the default

MySQL 8.4
→ mysql_native_password disabled by default

MySQL 9.0 and later
→ mysql_native_password removed from the server
```

A MySQL 9.7 target therefore cannot depend on old server-side `mysql_native_password`.

Verify that applications and connectors support current authentication.

## 10. Check application database drivers

For Spring Boot, review MySQL Connector/J.

Gradle:

```gradle
runtimeOnly 'com.mysql:mysql-connector-j'
```

Maven:

```xml
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

A database migration is incomplete if the application still uses an outdated driver that is incompatible with the new server.

## 11. Inventory stored objects

Check more than table rows:

```sql
SHOW PROCEDURE STATUS;
SHOW FUNCTION STATUS;
SHOW TRIGGERS;
SHOW EVENTS;
```

Include required objects in logical backups:

```bash
mysqldump \
  --single-transaction \
  --routines \
  --events \
  --triggers \
  --databases app_db \
  > app_db.sql
```

For InnoDB workloads, `--single-transaction` is useful for producing a consistent logical backup without long table locks.

## 12. Run MySQL Shell Upgrade Checker

MySQL Shell provides an Upgrade Checker utility.

Example:

```bash
mysqlsh -- util check-for-server-upgrade \
  user@db.example.com:3306 \
  --target-version=8.0 \
  --output-format=JSON
```

For the complete transition to the current LTS line, validate each supported step:

```text
5.7 → 8.0
8.0 → 8.4
8.4 → 9.7
```

The utility can detect many removed features and configuration problems, but application-level testing is still required.

## 13. Regression-test application SQL

After the server starts correctly, test actual application behavior:

```text
Login
SELECT
INSERT
UPDATE
DELETE
Batch jobs
Reports
Schedulers
File import/export
```

Projects with custom SQL or MyBatis mappers should be tested at the feature level, not only by checking that a database connection succeeds.

## 14. Separate migration dumps from rollback backups

A migration needs two recovery concepts.

### Transfer artifact

```text
logical dump
```

Used to move data.

### Rollback backup

```text
complete pre-migration backup
```

Used to restore the old environment if the migration fails.

Do not assume a data directory modified by a newer MySQL release can simply be downgraded to 5.7.

Plan rollback around restoring a backup created before the migration.

## 15. Rehearse before production cutover

```text
Production 5.7
↓
backup
↓
test environment
↓
compatibility fixes
↓
staged migration
↓
application testing
↓
measure elapsed time
↓
production cutover
```

A rehearsal is also the best way to estimate downtime.

## Final checklist

```text
[ ] Record exact MySQL 5.7 patch version
[ ] Inventory schemas and sizes
[ ] Check storage engines
[ ] Review sql_mode
[ ] Check reserved-word conflicts
[ ] Review character sets and collations
[ ] Find zero dates
[ ] Review authentication plugins
[ ] Verify connector versions
[ ] Inventory procedures/functions/triggers/events
[ ] Run Upgrade Checker
[ ] Test logical dump restore
[ ] Run application regression tests
[ ] Create rollback backup
[ ] Measure cutover time
```

## Conclusion

The dangerous assumption in a MySQL 5.7 migration is that moving table data is the whole job.

A safe migration considers three layers together:

```text
schema and data
+
server configuration and authentication
+
application SQL and connectors
```

For a production system in 2026, consider the current LTS line first, follow supported release transitions, and validate compatibility before touching production.

## References

- MySQL Upgrade Paths  
  https://dev.mysql.com/doc/refman/9.7/en/upgrade-paths.html
- MySQL Shell Upgrade Checker Utility  
  https://dev.mysql.com/doc/mysql-shell/9.7/en/mysql-shell-utilities-upgrade.html
- MySQL Releases: Innovation and LTS  
  https://dev.mysql.com/doc/refman/9.7/en/mysql-releases.html
- MySQL Keywords and Reserved Words  
  https://dev.mysql.com/doc/refman/9.7/en/keywords.html
