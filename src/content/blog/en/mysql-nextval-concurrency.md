---
title: "MySQL nextval Concurrency Problems and Safer ID Generation"
pubDate: 2026-09-17T11:31:48+09:00
description: "Learn why a SELECT-then-UPDATE nextval implementation can generate duplicate IDs under concurrency and how AUTO_INCREMENT, SELECT FOR UPDATE, and LAST_INSERT_ID(expr) provide safer alternatives."
category: MySQL
tags:
  - MySQL
  - Concurrency
  - nextval
  - AUTO_INCREMENT
  - InnoDB
lang: en
---

A custom MySQL `nextval` function often follows this pattern:

```text
SELECT current value
↓
add 1
↓
UPDATE
↓
return value
```

The problem appears under concurrency.

```text
Request A → reads 100
Request B → reads 100
Request A → writes 101
Request B → writes 101
```

Both requests can use the same ID and trigger a duplicate-key error.

## Prefer AUTO_INCREMENT for normal primary keys

For ordinary primary keys, use MySQL `AUTO_INCREMENT`.

```sql
CREATE TABLE app_user (
    app_user_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100),
    PRIMARY KEY (app_user_id)
);
```

Insert without calculating the ID:

```sql
INSERT INTO app_user (name)
VALUES ('example');
```

InnoDB handles AUTO_INCREMENT concurrency internally.

Retrieve the generated value with:

```sql
SELECT LAST_INSERT_ID();
```

`LAST_INSERT_ID()` is connection-specific, so another connection does not overwrite it.

## When a separate sequence is needed

For a business sequence independent of the primary key:

```sql
CREATE TABLE sequence_value (
    sequence_name VARCHAR(50) PRIMARY KEY,
    current_value BIGINT NOT NULL
);
```

Avoid separate SELECT and UPDATE statements:

```sql
SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER';

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';
```

Another transaction can run between them.

## Option 1: SELECT FOR UPDATE

Lock the row in one transaction.

```sql
START TRANSACTION;

SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER'
FOR UPDATE;

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';

COMMIT;
```

InnoDB blocks conflicting updates until the lock is released.

## Option 2: LAST_INSERT_ID(expr)

Use a single UPDATE:

```sql
UPDATE sequence_value
SET current_value = LAST_INSERT_ID(current_value + 1)
WHERE sequence_name = 'ORDER';
```

Then on the same connection:

```sql
SELECT LAST_INSERT_ID();
```

The updated row is locked by InnoDB, and the generated value is stored in connection-specific state.

## Connection pools

The UPDATE and `SELECT LAST_INSERT_ID()` must use the same database connection.

With Spring Boot or another pooled environment, execute both statements within the same transaction or session.

## Why retrying DuplicateKeyException is not enough

Retry logic only handles collisions after they happen.

```text
INSERT
↓
DuplicateKeyException
↓
generate another ID
↓
retry
```

Under load, repeated collisions can produce repeated retries.

The safer solution is to make ID generation concurrency-safe first.

## Summary

Recommended priority:

```text
ordinary primary key
→ AUTO_INCREMENT

independent business sequence
→ sequence table + atomic UPDATE

explicit locking requirement
→ SELECT FOR UPDATE
```

A custom MySQL `nextval` implementation should always be designed for concurrent requests.

## References

- MySQL InnoDB AUTO_INCREMENT Handling  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-auto-increment-handling.html
- MySQL InnoDB Locking  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-locking.html
- MySQL Information Functions  
  https://dev.mysql.com/doc/refman/9.7/en/information-functions.html
