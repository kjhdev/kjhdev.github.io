---
title: "MySQL nextval 동시성 문제: Duplicate entry 원인과 안전한 ID 생성"
pubDate: 2026-09-17T11:31:48+09:00
updatedDate: "2026-10-12"
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

## 운영 코드에서 재확인할 세 가지 조건

동시성 오류를 해결할 때 SQL만 바꿔서는 충분하지 않을 수 있다. 특히 Spring Boot와 커넥션 풀을 함께 사용한다면 다음 세 가지를 확인해야 한다.

1. **같은 연결 사용:** 값을 증가시킨 연결과 LAST_INSERT_ID()를 조회한 연결이 같아야 한다. 연결이 다르면 세션별로 저장된 값을 올바르게 조회할 수 없다.
2. **업무용 시퀀스 행 존재:** UPDATE가 실제로 한 행을 수정했는지 확인한다. 대상 행이 없으면 증가된 번호를 정상 할당한 것처럼 처리해서는 안 된다.
3. **실패 시 되돌리기:** 값 할당과 이후 업무 INSERT의 트랜잭션 경계를 정해두어야 한다. 중간 실패 시 번호가 비는 것이 허용되는지 등 업무 정책도 별도로 결정한다.

동시성 재현은 단일 요청 50회를 순서대로 보내는 방식이 아니라, **동시에 진행되는 요청의 반환 ID를 모아 중복이 없는지 검사하는 방식**이어야 한다. 이 글의 50개 요청 예시는 기대 결과를 계산한 검증 시나리오이며 실제 부하 시험에서 성공한 횟수라고 주장하는 것은 아니다.

같은 DB 연결인지 확인할 때는 테스트 환경에서 CONNECTION_ID()를 비교할 수 있다. 실제 애플리케이션에서는 커넥션 획득과 반환 방식까지 함께 확인해야 한다.

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

## 두 연결에서 경쟁 조건을 확인하는 테스트

아래는 **테스트용으로 재현할 수 있는 시나리오**다. 운영 DB에서 시퀀스 테이블을 새로 만들거나 값을 초기화하지 않는다.

잠금이 없는 기존 방식에서는 세션 A와 B가 각각 `SELECT current_value`를 실행한 뒤 애플리케이션에서 `+1`을 계산할 수 있다. 둘 다 같은 번호를 돌려줄 수 있는 구조인지 확인한다. 테스트 데이터는 독립된 DB에서 사용한다.

원자적 UPDATE 방식으로 변경했다면 한 연결에서 다음 순서로 호출한다.

```sql
UPDATE sequence_value
SET current_value = LAST_INSERT_ID(current_value + 1)
WHERE sequence_name = 'ORDER';

SELECT ROW_COUNT() AS affected_rows;
SELECT LAST_INSERT_ID() AS allocated_id;
```

`affected_rows`가 **1인지** 확인한다. 0이면 시퀀스 행이 없거나 예상과 다른 조건으로 갱신되지 않았을 수 있다. `SELECT LAST_INSERT_ID()`는 UPDATE와 **동일한 MySQL 연결**에서 호출해야 한다.

여러 애플리케이션 요청이 동시에 실행될 때 반환값을 모두 수집한 뒤 `COUNT(DISTINCT id)`가 성공 요청 수와 같은지 확인한다. 여기서 설명하는 SQL과 기대값은 재현 방법이며, 특정 운영 환경에서 실측한 부하 테스트 결과는 아니다.

## SELECT FOR UPDATE를 선택했다면 반환값도 명확히 정의한다

잠금 방식은 `SELECT ... FOR UPDATE`로 행을 잠근 후 업데이트하는 것에서 끝나지 않는다. 트랜잭션 내에서 **어떤 값을 새 ID로 반환할 것인지**도 코드에 명시해야 한다.

```sql
START TRANSACTION;
SELECT current_value
FROM sequence_value
WHERE sequence_name = 'ORDER'
FOR UPDATE;

UPDATE sequence_value
SET current_value = current_value + 1
WHERE sequence_name = 'ORDER';

SELECT current_value AS allocated_id
FROM sequence_value
WHERE sequence_name = 'ORDER';
COMMIT;
```

이 SQL들은 하나의 연결과 트랜잭션에서 실행해야 한다. `FOR UPDATE`는 적절한 인덱스로 대상 행을 특정하는 것이 좋다. 잠금 범위와 대기 시간이 늘어날 수 있으므로 짧게 처리한다.

## 실패·재시도까지 포함한 검증 기준

| 테스트 | 확인할 결과 |
|---|---|
| 단일 요청 | 번호가 증가하고 새 번호가 반환됨 |
| 동시에 2개 이상 요청 | 성공한 요청의 번호가 모두 다름 |
| 존재하지 않는 시퀀스 이름 | 0행 갱신을 오류로 처리 |
| 업무 INSERT 실패 | 트랜잭션 롤백·번호 재사용 정책 확인 |
| 커넥션 풀 사용 | UPDATE와 LAST_INSERT_ID 조회가 같은 연결에서 실행됨 |
| 반복 실행 | 중복 없이 추가 발급되고 초기화가 발생하지 않음 |

트랜잭션을 롤백했을 때 **시퀀스 행의 갱신도 롤백될 수 있지만**, 같은 연결의 `LAST_INSERT_ID()` 상태가 자동으로 이전 상태로 되돌아가는 것은 아니다. 따라서 반환된 값을 트랜잭션 밖에서 확정 번호처럼 미리 배포하는 설계에는 별도 검토가 필요하다. 업무 번호가 연속이어야 하는지도 고유성 요구사항과 별도로 정의한다.

[대량 데이터 수집 검증 설계](/ko/posts/batch-data-validation/)에서 다룬 것처럼, 단순 건수뿐 아니라 중복·누락·재실행 안전성을 별도로 확인해야 한다.

공식 참고 문서: [MySQL 8.4의 LAST_INSERT_ID()](https://dev.mysql.com/doc/refman/8.4/en/information-functions.html) · [InnoDB 잠금](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html)

## 선택 기준

| 상황 | 우선 선택 |
|---|---|
| 일반 PK | `AUTO_INCREMENT` |
| PK와 별개의 업무 Sequence | 원자적 UPDATE + `LAST_INSERT_ID(expr)` |
| 값을 읽고 추가 로직을 수행해야 함 | `SELECT ... FOR UPDATE` + 트랜잭션 |

직접 만든 `nextval`이 단일 테스트에서 잘 동작한다는 것은 동시성 안전성을 보장하지 않습니다. **재현 → 경쟁 구간 확인 → 원자적 갱신 → 동시 요청 재검증** 순서로 확인하면 간헐적인 `Duplicate entry` 문제를 훨씬 명확하게 해결할 수 있습니다.

## 참고 자료

- MySQL InnoDB AUTO_INCREMENT Handling  
  https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html
- MySQL InnoDB Locking  
  https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html
- MySQL Information Functions  
  https://dev.mysql.com/doc/refman/8.4/en/information-functions.html
