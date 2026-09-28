---
title: "MySQL nextval 동시성 문제: Duplicate entry 원인과 안전한 ID 생성"
pubDate: 2026-09-17T11:31:48+09:00
description: "동시 요청에서 직접 구현한 MySQL nextval이 같은 ID를 반환해 Duplicate entry가 발생하는 과정을 재현하고 AUTO_INCREMENT, SELECT FOR UPDATE, LAST_INSERT_ID(expr) 대안을 비교합니다."
category: MySQL
tags: ["MySQL", "Concurrency", "nextval", "AUTO_INCREMENT", "InnoDB"]
lang: ko
---

운영 코드에서 Oracle Sequence와 비슷하게 쓰기 위해 MySQL에 직접 만든 `nextval` 로직을 사용하다가, 요청이 겹칠 때만 간헐적으로 `Duplicate entry`가 발생하는 유형의 문제를 만날 수 있습니다.

단일 요청으로 테스트하면 정상이라 더 찾기 어렵습니다. 핵심은 **ID를 읽는 과정과 증가시키는 과정이 하나의 원자적 작업이 아니라는 것**입니다.

## 문제가 된 구조

단순화하면 기존 로직은 다음 순서입니다.

```text
현재 값 SELECT
↓
애플리케이션에서 +1
↓
UPDATE
↓
계산한 값을 새 ID로 사용
```

현재 값이 `100`일 때 요청 두 개가 거의 동시에 들어오면 다음 순서가 가능합니다.

```text
요청 A: 100 조회
요청 B: 100 조회
요청 A: 101 저장
요청 B: 101 저장
요청 A: ID 101로 INSERT
요청 B: ID 101로 INSERT → Duplicate entry
```

UPDATE 자체가 성공했다는 사실만 보고 안전하다고 판단하면 안 됩니다. 문제는 두 요청이 UPDATE 전에 같은 값을 읽었다는 데 있습니다.

## 먼저 재현해서 원인을 확정한다

이 문제는 순차 실행보다 두 DB 세션을 열어 확인하는 편이 명확합니다.

예를 들어 Sequence 테이블이 다음과 같다고 가정합니다.

```sql
CREATE TABLE sequence_value (
    sequence_name VARCHAR(50) PRIMARY KEY,
    current_value BIGINT NOT NULL
) ENGINE=InnoDB;

INSERT INTO sequence_value VALUES ('ORDER', 100);
```

두 세션에서 잠금 없이 같은 값을 조회하면 둘 다 `100`을 볼 수 있습니다. 이 상태에서 애플리케이션이 각각 `101`을 ID로 결정하면 충돌 조건이 만들어집니다.

여기서 확인해야 할 것은 "중복 INSERT를 재시도할까"가 아니라 **ID를 만드는 단계부터 동시 요청에 안전한가**입니다.

## 일반 PK라면 AUTO_INCREMENT가 우선

단순한 테이블 PK라면 별도 Sequence를 직접 구현할 이유가 크지 않습니다.

```sql
CREATE TABLE app_user (
    app_user_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100),
    PRIMARY KEY (app_user_id)
) ENGINE=InnoDB;
```

INSERT에서는 ID를 계산하지 않습니다.

```sql
INSERT INTO app_user (name)
VALUES ('example');
```

생성된 값은 같은 connection에서 확인할 수 있습니다.

```sql
SELECT LAST_INSERT_ID();
```

이 방식의 장점은 애플리케이션 코드가 "현재 최대값을 읽고 1을 더하는" 책임을 갖지 않는다는 것입니다.

## 업무용 번호라면 Sequence row를 원자적으로 갱신한다

주문번호처럼 PK와 독립된 증가값이 필요한 경우에는 별도 Sequence 테이블을 유지할 수 있습니다. 이때도 다음처럼 SELECT와 UPDATE를 분리하면 안 됩니다.

```sql
SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER';

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';
```

두 문장 사이가 경쟁 조건입니다.

### 방법 1: SELECT FOR UPDATE

명시적으로 row를 잠그고 같은 트랜잭션 안에서 읽고 갱신합니다.

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

중요한 조건은 `SELECT ... FOR UPDATE`와 UPDATE가 **같은 트랜잭션과 같은 connection**에서 실행되는 것입니다.

### 방법 2: LAST_INSERT_ID(expr)

읽기 단계를 없애고 UPDATE 한 번으로 값을 증가시킬 수도 있습니다.

```sql
UPDATE sequence_value
SET current_value = LAST_INSERT_ID(current_value + 1)
WHERE sequence_name = 'ORDER';
```

바로 같은 connection에서 값을 읽습니다.

```sql
SELECT LAST_INSERT_ID();
```

흐름은 다음처럼 바뀝니다.

```text
100
↓
UPDATE가 row lock을 획득
↓
101로 증가하면서 connection 상태에 101 기록
↓
SELECT LAST_INSERT_ID()
↓
101 반환
```

다른 요청이 같은 row를 갱신하려 하면 InnoDB가 순서를 조정하므로 기존의 "둘 다 100을 읽는" 구조를 제거할 수 있습니다.

## Spring Boot Connection Pool에서 특히 확인할 부분

Connection Pool을 사용하면 UPDATE와 `SELECT LAST_INSERT_ID()`를 서로 다른 connection에서 실행하지 않도록 해야 합니다.

서비스 계층에서 하나의 트랜잭션으로 묶는 구조가 안전합니다.

```java
@Transactional
public long nextOrderSequence() {
    sequenceRepository.increment("ORDER");
    return sequenceRepository.lastInsertId();
}
```

실제 Mapper 구현 방식과 관계없이 핵심은 두 SQL이 같은 트랜잭션 경계 안에서 같은 DB connection을 사용하도록 만드는 것입니다.

## 수정 후에는 동시성 검증을 한다

단일 호출 성공만 확인하면 처음 문제를 다시 놓칠 수 있습니다. 수정 후에는 여러 요청을 동시에 발생시켜 다음을 확인합니다.

```text
생성된 ID 개수 = 요청 성공 개수
중복 ID = 0
Duplicate entry = 0
Sequence 최종값 = 시작값 + 성공 횟수
```

예를 들어 시작값이 100이고 50개 요청이 모두 성공했다면 최종값은 150이어야 하며, 반환된 50개 값도 모두 달라야 합니다.

## DuplicateKeyException 재시도는 보조 수단이다

충돌 후 다음 번호를 다시 만들어 재시도하는 방법도 있지만 근본 해결은 아닙니다.

```text
INSERT 실패
↓
DuplicateKeyException
↓
새 ID 생성
↓
재시도
```

부하가 커질수록 같은 경쟁 조건을 반복해서 만날 수 있습니다. 재시도는 일시적 충돌에 대한 방어책으로 둘 수 있지만, 먼저 ID 생성 자체를 원자적으로 만들어야 합니다.

## 선택 기준

| 상황 | 우선 선택 |
|---|---|
| 일반 PK | `AUTO_INCREMENT` |
| PK와 별개의 업무 Sequence | 원자적 UPDATE + `LAST_INSERT_ID(expr)` |
| 값을 읽고 추가 로직을 수행해야 함 | `SELECT ... FOR UPDATE` + 트랜잭션 |

직접 만든 `nextval`이 단일 테스트에서 잘 동작한다는 것은 동시성 안전성을 보장하지 않습니다. **재현 → 경쟁 구간 확인 → 원자적 갱신 → 동시 요청 재검증** 순서로 확인하면 간헐적인 `Duplicate entry` 문제를 훨씬 명확하게 해결할 수 있습니다.

## 참고 자료

- MySQL InnoDB AUTO_INCREMENT Handling  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-auto-increment-handling.html
- MySQL InnoDB Locking  
  https://dev.mysql.com/doc/refman/9.7/en/innodb-locking.html
- MySQL Information Functions  
  https://dev.mysql.com/doc/refman/9.7/en/information-functions.html
