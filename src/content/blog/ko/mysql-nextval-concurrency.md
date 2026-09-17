---
title: "MySQL nextval 함수의 동시성 문제와 안전한 ID 생성 방법"
pubDate: 2026-09-17T11:31:48+09:00
description: "MySQL에서 SELECT 후 UPDATE로 구현한 nextval 방식이 동시 요청에서 중복 ID를 만들 수 있는 이유와 AUTO_INCREMENT, SELECT FOR UPDATE, LAST_INSERT_ID(expr) 대안을 정리한다."
category: MySQL
tags:
  - MySQL
  - Concurrency
  - nextval
  - AUTO_INCREMENT
  - InnoDB
lang: ko
---

MySQL에서 Oracle Sequence처럼 ID를 만들기 위해 직접 `nextval` 함수를 구현하는 경우가 있다.

문제는 다음과 같은 구조이다.

```text
현재 값 SELECT
↓
+1 계산
↓
UPDATE
↓
새 값 반환
```

동시 요청이 들어오면 두 요청이 같은 현재 값을 읽을 수 있다.

```text
요청 A → 100 조회
요청 B → 100 조회
요청 A → 101 저장
요청 B → 101 저장
```

결과적으로 같은 ID가 생성되고 PK나 UNIQUE 컬럼에서 `Duplicate entry` 오류가 발생할 수 있다.

## 일반 PK는 AUTO_INCREMENT 사용

단순한 PK라면 직접 `nextval`을 만들기보다 `AUTO_INCREMENT`를 사용하는 편이 안전하다.

```sql
CREATE TABLE app_user (
    app_user_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100),
    PRIMARY KEY (app_user_id)
);
```

INSERT 시 ID를 직접 계산하지 않는다.

```sql
INSERT INTO app_user (name)
VALUES ('example');
```

MySQL InnoDB가 AUTO_INCREMENT 값 생성을 위한 동시성 제어를 처리한다. 생성된 값은 같은 connection에서 `LAST_INSERT_ID()`로 가져올 수 있다.

```sql
SELECT LAST_INSERT_ID();
```

`LAST_INSERT_ID()`는 connection 단위 값이므로 다른 connection의 INSERT 결과와 섞이지 않는다.

## 별도 Sequence가 필요한 경우

업무용 번호처럼 테이블 PK와 독립적인 Sequence가 필요할 수 있다.

```sql
CREATE TABLE sequence_value (
    sequence_name VARCHAR(50) PRIMARY KEY,
    current_value BIGINT NOT NULL
);
```

다음처럼 SELECT와 UPDATE를 분리하면 동시성 문제가 생기기 쉽다.

```sql
SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER';

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';
```

두 SQL 사이에 다른 트랜잭션이 들어올 수 있기 때문이다.

## 방법 1. SELECT FOR UPDATE

트랜잭션 안에서 row를 잠근다.

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

InnoDB에서 `SELECT ... FOR UPDATE`는 대상 row에 잠금을 건다. 다른 트랜잭션이 같은 row를 변경하려 하면 기존 트랜잭션이 끝날 때까지 기다린다.

단점은 SELECT와 UPDATE를 반드시 같은 트랜잭션으로 묶어야 한다는 점이다.

## 방법 2. LAST_INSERT_ID(expr) 활용

SELECT를 제거하고 UPDATE 자체에서 값을 증가시킬 수 있다.

```sql
UPDATE sequence_value
SET current_value = LAST_INSERT_ID(current_value + 1)
WHERE sequence_name = 'ORDER';
```

같은 connection에서 다음 값을 읽는다.

```sql
SELECT LAST_INSERT_ID();
```

흐름은 다음과 같다.

```text
100
↓
UPDATE에서 101로 증가
↓
해당 connection의 LAST_INSERT_ID = 101
↓
SELECT LAST_INSERT_ID()
↓
101
```

InnoDB의 UPDATE는 row lock을 사용하므로 같은 row를 동시에 갱신하면 순서대로 처리된다.

## Connection Pool 사용 시 주의

`LAST_INSERT_ID(expr)` 방식은 UPDATE와 `SELECT LAST_INSERT_ID()`가 같은 DB connection에서 실행되어야 한다.

Spring Boot처럼 Connection Pool을 사용한다면 두 SQL을 같은 트랜잭션 안에서 실행하는 편이 안전하다.

## DuplicateKeyException 재시도만으로는 부족하다

다음처럼 재시도할 수도 있다.

```text
INSERT
↓
DuplicateKeyException
↓
새 ID 생성
↓
재시도
```

하지만 이는 충돌 이후 복구하는 방식이다.

동시 요청이 많아질수록 충돌과 재시도가 반복될 수 있으므로 ID 생성 방식 자체를 원자적으로 만드는 것이 먼저이다.

## 정리

권장 우선순위는 다음과 같다.

```text
일반 PK
→ AUTO_INCREMENT

업무용 독립 Sequence
→ Sequence Table + 원자적 UPDATE

명시적 잠금이 필요한 경우
→ SELECT FOR UPDATE
```

MySQL에서 직접 `nextval`을 구현한다면 단일 요청이 아니라 동시 요청을 기준으로 설계해야 한다.

## 참고 자료

- MySQL InnoDB AUTO_INCREMENT Handling  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-auto-increment-handling.html
- MySQL InnoDB Locking  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-locking.html
- MySQL Information Functions  
  https://dev.mysql.com/doc/refman/9.7/en/information-functions.html
