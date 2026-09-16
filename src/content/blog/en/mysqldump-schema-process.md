---
title: "Dump MySQL Schema Only and Fix PROCESS Privilege Errors"
pubDate: 2026-09-16T09:16:31+09:00
description: "Use mysqldump to export MySQL schema without table data and fix PROCESS privilege errors with --no-tablespaces while including routines, triggers, and events."
category: MySQL
tags:
  - MySQL
  - mysqldump
  - Database Schema
  - Backup
  - Docker
lang: en
---

When analyzing a database or recreating its structure in another environment, a full data backup is often unnecessary.

`mysqldump --no-data` exports definitions without ordinary table row data.

A common problem is:

```text
Access denied; you need (at least one of) the PROCESS privilege(s)
for this operation
```

This often occurs while mysqldump is handling tablespace information.

## Basic schema-only dump

```bash
mysqldump     -u app_user     -p     --no-data     app_db     > app_schema.sql
```

`--no-data` skips table row contents and keeps schema definitions.

## Include routines, triggers, and events

```bash
mysqldump     -u app_user     -p     --no-data     --routines     --triggers     --events     app_db     > app_schema.sql
```

The options mean:

```text
--no-data
→ skip table rows

--routines
→ include stored procedures and functions

--triggers
→ include triggers

--events
→ include Event Scheduler objects
```

Triggers are normally enabled by mysqldump defaults, but listing the option explicitly makes the intent clear.

## Why the PROCESS privilege error appears

mysqldump can include tablespace-related information.

According to the MySQL documentation, `PROCESS` is required if `--no-tablespaces` is not used.

Application accounts commonly do not have this global privilege, so the dump can fail with:

```text
mysqldump: Error:
'Access denied; you need (at least one of) the PROCESS privilege(s)
for this operation' when trying to dump tablespaces
```

## Fix it with `--no-tablespaces`

If tablespace definitions are not needed:

```bash
mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

`--no-tablespaces` suppresses `CREATE LOGFILE GROUP` and `CREATE TABLESPACE` statements.

For many ordinary InnoDB application schemas, this is more appropriate than giving an application account the global `PROCESS` privilege.

## Run mysqldump from a Docker container

If MySQL runs in Docker:

```bash
docker exec -i mysql     mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

The final redirection happens in the host shell.

That means `app_schema.sql` is created on the host, not inside the MySQL container.

## Avoid putting passwords directly in the command

This works:

```bash
-pMyPassword
```

but it can expose credentials through shell history or process information.

Prefer:

```bash
-p
```

and enter the password when prompted.

For automation, consider a MySQL option file or a proper secret-management mechanism.

## Verify the dump

File size:

```bash
ls -lh app_schema.sql
```

Preview:

```bash
head -n 50 app_schema.sql
```

Find table definitions:

```bash
grep -n "CREATE TABLE" app_schema.sql
```

Find routines:

```bash
grep -n "CREATE.*PROCEDURE\|CREATE.*FUNCTION" app_schema.sql
```

A normal schema-only dump should not contain ordinary table row inserts.

```bash
grep -n "^INSERT INTO" app_schema.sql
```

## Restore the schema

```bash
mysql     -u app_user     -p     app_db     < app_schema.sql
```

Test the file against an empty development database before applying it to an important environment.

## Do not grant PROCESS automatically

It is possible to grant:

```sql
GRANT PROCESS ON *.* TO 'app_user'@'%';
```

but this adds a global privilege.

If the dump does not need tablespace statements, using `--no-tablespaces` keeps the account more restricted.

## Recommended command

```bash
mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

Docker:

```bash
docker exec -i mysql     mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

## Conclusion

The useful options for a schema-focused dump are:

```text
--no-data
→ skip row data

--no-tablespaces
→ skip tablespace statements that can require PROCESS

--routines
→ include procedures and functions

--triggers
→ include triggers

--events
→ include events
```

Before increasing database privileges, check whether the dump actually needs tablespace information.

## References

- MySQL mysqldump  
  https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html
- Dumping Table Definitions and Content Separately  
  https://dev.mysql.com/doc/refman/8.4/en/mysqldump-definition-data-dumps.html
