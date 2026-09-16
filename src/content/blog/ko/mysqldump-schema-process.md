---
title: "mysqldump로 스키마만 추출하고 PROCESS 권한 오류 해결하기"
pubDate: 2026-09-16T09:16:31+09:00
description: "MySQL에서 데이터 없이 테이블 구조와 Routine, Trigger, Event만 mysqldump로 추출하고 PROCESS privilege 오류를 --no-tablespaces 옵션으로 해결하는 방법을 정리한다."
category: MySQL
tags:
  - MySQL
  - mysqldump
  - Database Schema
  - Backup
  - Docker
lang: ko
---

DB 구조를 분석하거나 다른 환경에 동일한 스키마만 만들고 싶을 때는 데이터 전체를 백업할 필요가 없다.

`mysqldump --no-data`를 사용하면 INSERT 데이터 없이 CREATE TABLE 중심의 스키마를 추출할 수 있다.

하지만 일반 애플리케이션 계정으로 실행하면 다음 오류가 발생할 수 있다.

```text
Access denied; you need (at least one of) the PROCESS privilege(s)
for this operation
```

이 오류는 tablespace 정보를 조회하려 할 때 자주 발생한다.

## 스키마만 추출하는 기본 명령

```bash
mysqldump     -u app_user     -p     --no-data     app_db     > app_schema.sql
```

`--no-data`는 테이블의 row 데이터를 제외한다.

결과에는 주로 다음 내용이 들어간다.

```text
CREATE TABLE
VIEW 정의
Trigger
기타 DDL
```

단, Routine과 Event는 별도 옵션을 추가하는 편이 명확하다.

## Routine, Trigger, Event까지 포함하기

```bash
mysqldump     -u app_user     -p     --no-data     --routines     --triggers     --events     app_db     > app_schema.sql
```

옵션 의미:

```text
--no-data
→ 테이블 데이터 제외

--routines
→ Stored Procedure / Function 포함

--triggers
→ Trigger 포함

--events
→ Event Scheduler 객체 포함
```

Trigger는 mysqldump 기본 옵션에 포함되는 경우가 많지만, 스키마 백업 목적을 명확하게 하기 위해 직접 작성해도 된다.

## PROCESS 권한 오류가 발생하는 이유

최근 mysqldump는 기본 동작 중 tablespace 관련 정보를 확인할 수 있다.

이 과정에서는 `PROCESS` 권한이 필요할 수 있다.

일반 애플리케이션 계정은 보통 다음처럼 제한된 권한만 가진다.

```text
SELECT
INSERT
UPDATE
DELETE
EXECUTE
```

따라서 스키마 dump를 실행하면 다음 오류가 발생할 수 있다.

```text
mysqldump: Error:
'Access denied; you need (at least one of) the PROCESS privilege(s)
for this operation' when trying to dump tablespaces
```

## 해결 방법: `--no-tablespaces`

일반적인 애플리케이션 스키마를 추출할 목적이라면 tablespace 정보를 제외할 수 있다.

```bash
mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

MySQL 공식 문서에 따르면 `--no-tablespaces`는 `CREATE LOGFILE GROUP`과 `CREATE TABLESPACE` 관련 출력을 제외한다.

또한 이 옵션을 사용하지 않으면 mysqldump에 `PROCESS` 권한이 필요할 수 있다.

일반적인 InnoDB 애플리케이션 DB의 구조를 분석하는 목적이라면 이 방식이 실용적이다.

## Docker MySQL에서 실행하기

MySQL이 Docker 컨테이너에서 실행 중이라면 컨테이너 내부의 mysqldump를 사용할 수 있다.

```bash
docker exec -i mysql     mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

이 명령에서 중요한 점은 `>` 위치이다.

```text
docker exec ...
    ↓
mysqldump 출력
    ↓
호스트의 app_schema.sql
```

즉 SQL 파일은 컨테이너 내부가 아니라 명령을 실행한 호스트에 생성된다.

## 비밀번호는 명령줄에 직접 쓰지 않는다

다음처럼 작성할 수는 있다.

```bash
-pMyPassword
```

하지만 비밀번호가 shell history나 process 정보에 노출될 수 있다.

가능하면 다음처럼 `-p`만 사용하고 입력 프롬프트에서 비밀번호를 입력한다.

```bash
mysqldump -u app_user -p ...
```

자동화가 필요하면 MySQL option file이나 Secret 관리 방식을 검토하는 편이 좋다.

## dump 파일 확인

파일 크기:

```bash
ls -lh app_schema.sql
```

앞부분 확인:

```bash
head -n 50 app_schema.sql
```

테이블 생성문 확인:

```bash
grep -n "CREATE TABLE" app_schema.sql
```

Routine:

```bash
grep -n "CREATE.*PROCEDURE\|CREATE.*FUNCTION" app_schema.sql
```

데이터를 제외했으므로 일반 테이블의 INSERT 문은 없어야 한다.

```bash
grep -n "^INSERT INTO" app_schema.sql
```

## 다른 서버에 스키마 적용

생성한 스키마 파일은 다음처럼 적용할 수 있다.

```bash
mysql     -u app_user     -p     app_db     < app_schema.sql
```

실제 운영 DB에 바로 적용하기보다 빈 테스트 DB에서 먼저 복원하는 편이 안전하다.

## 권한을 무조건 추가하는 것은 피한다

PROCESS 오류가 발생했다고 바로 다음 권한을 부여할 수도 있다.

```sql
GRANT PROCESS ON *.* TO 'app_user'@'%';
```

하지만 애플리케이션 계정에 글로벌 관리 권한을 추가할 필요가 없다면 피하는 편이 좋다.

스키마 추출 목적에서 tablespace 정보가 필요 없다면 `--no-tablespaces`가 더 제한적인 해결 방법이다.

## 추천 명령

일반적인 스키마 분석 목적이라면 다음 형태가 단순하다.

```bash
mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

Docker:

```bash
docker exec -i mysql     mysqldump     -u app_user     -p     --no-data     --no-tablespaces     --routines     --triggers     --events     app_db     > app_schema.sql
```

## 마무리

MySQL 스키마만 추출할 때 핵심 옵션은 다음과 같다.

```text
--no-data
→ row 데이터 제외

--no-tablespaces
→ PROCESS 권한이 필요한 tablespace 출력 제외

--routines
→ Procedure / Function 포함

--triggers
→ Trigger 포함

--events
→ Event 포함
```

`PROCESS privilege` 오류가 발생했다고 애플리케이션 계정의 권한부터 늘리기보다 실제 dump 목적에 tablespace 정보가 필요한지 먼저 확인하는 것이 좋다.

## 참고 자료

- MySQL mysqldump  
  https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html
- Dumping Table Definitions and Content Separately  
  https://dev.mysql.com/doc/refman/8.4/en/mysqldump-definition-data-dumps.html
