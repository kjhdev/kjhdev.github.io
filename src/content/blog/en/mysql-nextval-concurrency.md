---
title: "MySQL nextval Concurrency: Fixing Duplicate IDs Under Load"
pubDate: 2026-09-17T11:31:48+09:00
description: "Reproduce duplicate IDs caused by a SELECT-then-UPDATE MySQL nextval implementation and compare AUTO_INCREMENT, SELECT FOR UPDATE, and LAST_INSERT_ID(expr) fixes."
category: MySQL
tags: ["MySQL", "Concurrency", "nextval", "AUTO_INCREMENT", "InnoDB"]
lang: en
---

A hand-written MySQL `nextval` implementation can appear completely reliable in single-request testing and still produce an occasional `Duplicate entry` error when requests overlap.

The important clue is that **reading the current value and incrementing it are separate operations**.

## The failing pattern

A simplified implementation looks like this:

```text
SELECT current value
↓
add 1 in application code
↓
UPDATE
↓
use calculated value as the new ID
```

If the current value is `100`, two requests can interleave like this:

```text
Request A: read 100
Request B: read 100
Request A: write 101
Request B: write 101
Request A: INSERT with 101
Request B: INSERT with 101 → Duplicate entry
```

The UPDATE statements themselves can succeed. The race happened earlier, when both requests observed the same value.

## Reproduce the race before changing the code

Concurrency bugs are easier to reason about with two database sessions than with sequential application tests.

Assume this table:

```sql
CREATE TABLE sequence_value (
    sequence_name VARCHAR(50) PRIMARY KEY,
    current_value BIGINT NOT NULL
) ENGINE=InnoDB;

INSERT INTO sequence_value VALUES ('ORDER', 100);
```

Without locking, both sessions can read `100`. If application code independently decides that the next value is `101`, the collision condition already exists.

The question to answer is not "should the INSERT retry?" but **"is ID allocation itself safe when requests run concurrently?"**

## Prefer AUTO_INCREMENT for an ordinary primary key

For a normal table primary key, let InnoDB allocate the value.

```sql
CREATE TABLE app_user (
    app_user_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100),
    PRIMARY KEY (app_user_id)
) ENGINE=InnoDB;
```

Insert without calculating the key:

```sql
INSERT INTO app_user (name)
VALUES ('example');
```

Read the generated value on the same connection:

```sql
SELECT LAST_INSERT_ID();
```

This removes the application's responsibility to read a maximum/current value and increment it safely.

## For a business sequence, update the sequence row atomically

A business number independent of the table PK can still use a sequence table. Avoid a separate SELECT followed by UPDATE:

```sql
SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER';

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';
```

The gap between those statements is the race window.

### Option 1: SELECT FOR UPDATE

Lock the sequence row and keep the read/update inside one transaction.

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

The important requirement is that the lock and update use the **same transaction and database connection**.

### Option 2: LAST_INSERT_ID(expr)

Remove the initial read and increment the row in a single UPDATE.

```sql
UPDATE sequence_value
SET current_value = LAST_INSERT_ID(current_value + 1)
WHERE sequence_name = 'ORDER';
```

Then, on the same connection:

```sql
SELECT LAST_INSERT_ID();
```

The flow becomes:

```text
100
↓
UPDATE acquires row lock
↓
increment to 101 and store 101 in connection state
↓
SELECT LAST_INSERT_ID()
↓
return 101
```

A competing UPDATE of the same row is serialized by InnoDB, removing the original "both requests read 100" race.

## Check transaction boundaries with Spring Boot connection pools

With a connection pool, do not allow the UPDATE and `SELECT LAST_INSERT_ID()` to run on unrelated connections.

A service-level transaction is a useful boundary:

```java
@Transactional
public long nextOrderSequence() {
    sequenceRepository.increment("ORDER");
    return sequenceRepository.lastInsertId();
}
```

The repository technology can vary; the important part is that both statements execute within the same transactional connection.

## Validate with concurrent requests after the fix

A successful single call does not prove that the original bug is gone. Run concurrent requests and verify:

```text
number of generated IDs = number of successful requests
duplicate IDs = 0
Duplicate entry errors = 0
final sequence value = starting value + successful requests
```

If the starting value is 100 and 50 requests succeed, the final sequence value should be 150 and all 50 returned values should be unique.

## Retrying DuplicateKeyException is only a fallback

Retrying after a collision treats the symptom:

```text
INSERT fails
↓
DuplicateKeyException
↓
allocate another ID
↓
retry
```

Under load, the same race can keep producing collisions. Retries can be a defensive measure, but the first fix should make ID allocation atomic.

## Choosing an approach

| Situation | Preferred approach |
|---|---|
| Ordinary primary key | `AUTO_INCREMENT` |
| Independent business sequence | atomic UPDATE + `LAST_INSERT_ID(expr)` |
| Read value and perform additional locked work | `SELECT ... FOR UPDATE` in a transaction |

A custom `nextval` working in a sequential test says little about concurrency safety. A stronger troubleshooting process is **reproduce → identify the race window → make allocation atomic → rerun concurrent validation**.

## References

- MySQL InnoDB AUTO_INCREMENT Handling  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-auto-increment-handling.html
- MySQL InnoDB Locking  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-locking.html
- MySQL Information Functions  
  https://dev.mysql.com/doc/refman/9.7/en/information-functions.html
