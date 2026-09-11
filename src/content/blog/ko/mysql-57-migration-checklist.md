---
title: "MySQL 5.7에서 최신 MySQL로 마이그레이션 전 체크리스트"
pubDate: 2026-09-11T09:15:59+09:00
description: "MySQL 5.7에서 최신 LTS 계열로 이전하기 전에 업그레이드 경로, sql_mode, 예약어, 문자셋, 인증 플러그인, 드라이버와 백업을 점검하는 방법을 정리합니다."
category: MySQL
tags:
  - MySQL
  - MySQL 5.7
  - Database Migration
  - Upgrade
  - Docker
  - MySQL Shell
lang: ko
---

오래 운영한 서버에는 아직 MySQL 5.7이 남아 있는 경우가 있습니다.

새 서버를 만들거나 Docker 기반으로 환경을 정리할 때 최신 MySQL로 이전하고 싶어지지만, 메이저 버전 차이가 크기 때문에 데이터만 옮기면 끝나는 작업으로 보면 위험합니다.

2026년 9월 기준 MySQL은 LTS와 Innovation 트랙으로 나뉘며, 장기 운영 안정성을 우선한다면 **MySQL 9.7 LTS**를 목표로 검토할 수 있습니다.

이 글에서는 MySQL 5.7에서 최신 LTS 계열로 마이그레이션하기 전에 확인해야 할 항목을 정리합니다.

## 1. 업그레이드와 마이그레이션을 구분한다

먼저 두 개념을 구분하는 것이 좋습니다.

### 업그레이드

기존 MySQL 서버를 지원되는 버전 경로를 따라 올리는 작업입니다.

```text
MySQL 5.7
→ MySQL 8.0
→ MySQL 8.4 LTS
→ MySQL 9.7 LTS
```

MySQL 공식 업그레이드 경로에서는 필요한 Bugfix/LTS 계열을 건너뛰는 방식을 지원하지 않습니다.

### 마이그레이션

새 서버를 만들고 논리 백업을 통해 데이터를 이전하는 방식입니다.

```text
기존 MySQL 5.7
↓
dump
↓
호환성 검사 및 수정
↓
새 MySQL 환경
```

Docker로 새 서버를 구성한다면 마이그레이션 방식이 관리하기 편하지만, 메이저 버전 호환성 검증은 여전히 필요합니다.

## 2. 현재 MySQL 버전을 정확히 기록한다

```sql
SELECT VERSION();
```

또는:

```bash
mysql --version
```

단순히 `5.7`이라고 기록하지 말고 정확한 패치 버전까지 확인합니다.

MySQL은 다음 계열로 넘어가기 전에 현재 계열의 최신 릴리스를 사용하는 방식을 권장합니다.

## 3. DB 목록과 용량 확인

```sql
SHOW DATABASES;
```

DB별 용량:

```sql
SELECT
    table_schema,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
GROUP BY table_schema
ORDER BY size_mb DESC;
```

시스템 스키마와 애플리케이션 DB를 구분합니다.

```text
information_schema
mysql
performance_schema
sys
```

오래된 `mysql` 시스템 스키마를 최신 서버에 그대로 덮어쓰기보다는 사용자와 권한을 별도로 확인하고 재구성하는 편이 안전합니다.

## 4. Storage Engine 확인

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

애플리케이션 테이블은 가능하면 InnoDB 중심인지 확인합니다.

MyISAM 같은 오래된 엔진이 남아 있다면 이전 전에 변환 여부를 검토합니다.

## 5. `sql_mode` 확인

```sql
SELECT @@GLOBAL.sql_mode;
SELECT @@SESSION.sql_mode;
```

대표적인 확인 항목:

```text
ONLY_FULL_GROUP_BY
STRICT_TRANS_TABLES
NO_ZERO_DATE
NO_ZERO_IN_DATE
ERROR_FOR_DIVISION_BY_ZERO
```

오래된 SQL이 느슨한 GROUP BY 규칙이나 비정상 날짜값에 의존하고 있으면 최신 버전에서 오류가 발생할 수 있습니다.

문제가 생겼다고 최신 서버의 `sql_mode`를 무조건 낮추기보다 SQL을 수정할 수 있는지 먼저 확인합니다.

## 6. 예약어 충돌 확인

새 MySQL 버전에는 예약어가 추가될 수 있습니다.

테이블명이나 컬럼명으로 일반적인 단어를 사용했다면 확인이 필요합니다.

예:

```text
rank
groups
system
window
```

문제가 있다면 이름을 변경하거나 명확하게 인용합니다.

```sql
SELECT `rank`
FROM example;
```

## 7. 문자셋과 Collation 확인

DB 기본값:

```sql
SELECT
    schema_name,
    default_character_set_name,
    default_collation_name
FROM information_schema.schemata;
```

테이블별 Collation:

```sql
SELECT
    table_schema,
    table_name,
    table_collation
FROM information_schema.tables
WHERE table_schema = 'app_db';
```

오래된 서버에는 다음 설정이 남아 있을 수 있습니다.

```text
latin1
utf8
utf8mb3
```

새 환경에서는 보통 `utf8mb4`를 검토하지만, 실제 데이터와 인덱스 크기, Connector 설정까지 함께 테스트한 뒤 변경하는 것이 좋습니다.

## 8. Zero Date 확인

기존 데이터에 다음 값이 있을 수 있습니다.

```text
0000-00-00
0000-00-00 00:00:00
```

예:

```sql
SELECT *
FROM example
WHERE created_at = '0000-00-00 00:00:00';
```

최신 SQL mode에서는 이런 값이 이후 INSERT나 UPDATE 과정에서 문제가 될 수 있습니다.

가능하면 정상 날짜나 `NULL`로 정리합니다.

## 9. 인증 플러그인 확인

```sql
SELECT
    user,
    host,
    plugin
FROM mysql.user;
```

중요한 변화는 다음과 같습니다.

```text
MySQL 8.0
→ caching_sha2_password 기본 사용

MySQL 8.4
→ mysql_native_password 기본 비활성화

MySQL 9.0 이후
→ mysql_native_password 서버 플러그인 제거
```

따라서 MySQL 9.7을 목표로 한다면 오래된 `mysql_native_password`에 의존하는 계정과 클라이언트를 점검해야 합니다.

## 10. 애플리케이션 DB Driver 확인

Spring Boot라면 MySQL Connector/J도 확인합니다.

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

오래된 JDBC 드라이버는 최신 인증 방식이나 프로토콜과 충돌할 수 있습니다.

DB만 최신으로 바꾸고 애플리케이션 드라이버를 그대로 두는 것은 피합니다.

## 11. Procedure, Function, Trigger, Event 확인

```sql
SHOW PROCEDURE STATUS;
SHOW FUNCTION STATUS;
SHOW TRIGGERS;
SHOW EVENTS;
```

논리 백업을 만들 때도 필요한 객체가 포함되도록 합니다.

```bash
mysqldump \
  --single-transaction \
  --routines \
  --events \
  --triggers \
  --databases app_db \
  > app_db.sql
```

InnoDB 중심의 DB에서는 `--single-transaction`이 일관된 논리 백업에 유용합니다.

## 12. MySQL Shell Upgrade Checker 사용

MySQL Shell에는 업그레이드 호환성을 검사하는 Utility가 있습니다.

예:

```bash
mysqlsh -- util check-for-server-upgrade \
  user@db.example.com:3306 \
  --target-version=8.0 \
  --output-format=JSON
```

5.7에서 9.7까지는 단계가 있으므로 다음처럼 각 전환을 확인합니다.

```text
5.7 → 8.0
8.0 → 8.4
8.4 → 9.7
```

자동 검사만으로 모든 애플리케이션 문제를 잡을 수는 없지만 제거된 기능이나 설정 호환성 문제를 미리 발견하는 데 도움이 됩니다.

## 13. 애플리케이션 SQL 회귀 테스트

DB가 정상적으로 기동되는 것만으로 마이그레이션이 끝난 것은 아닙니다.

다음 기능을 실제로 테스트합니다.

```text
로그인
조회
등록
수정
삭제
배치
통계
스케줄러
파일 업로드/다운로드
```

MyBatis처럼 직접 SQL을 많이 사용하는 프로젝트라면 Mapper 단위가 아니라 실제 서비스 기능 단위로 테스트하는 것이 좋습니다.

## 14. 이전용 dump와 원복용 backup을 분리한다

### 이전용

```text
논리 dump
```

새 서버로 데이터를 옮기기 위한 파일입니다.

### 원복용

```text
업그레이드 전 전체 백업
```

문제가 생겼을 때 기존 환경으로 돌아가기 위한 백업입니다.

새 버전이 수정한 데이터 디렉터리를 MySQL 5.7로 단순 다운그레이드하는 방식에 의존하면 안 됩니다.

원복은 업그레이드 전에 확보한 백업 기준으로 계획합니다.

## 15. 운영 전에 테스트 환경에서 전체 과정을 반복한다

```text
운영 5.7
↓
백업
↓
테스트 환경
↓
호환성 수정
↓
단계별 마이그레이션
↓
애플리케이션 테스트
↓
소요 시간 측정
↓
운영 전환
```

이 과정을 먼저 해보면 실제 downtime도 예측할 수 있습니다.

## 최종 체크리스트

```text
[ ] 정확한 MySQL 5.7 패치 버전 확인
[ ] DB 목록과 용량 확인
[ ] Storage Engine 확인
[ ] sql_mode 확인
[ ] 예약어 충돌 확인
[ ] 문자셋 / Collation 확인
[ ] Zero Date 확인
[ ] 인증 플러그인 확인
[ ] MySQL Connector 버전 확인
[ ] Procedure / Function / Trigger / Event 확인
[ ] Upgrade Checker 실행
[ ] 논리 dump 복원 테스트
[ ] 애플리케이션 회귀 테스트
[ ] 원복용 백업 확보
[ ] 실제 전환 시간 측정
```

## 마무리

MySQL 5.7에서 최신 MySQL로 옮길 때는 다음 세 영역을 함께 봐야 합니다.

```text
DB 스키마와 데이터
+
서버 설정과 인증
+
애플리케이션 SQL과 Connector
```

운영용 새 환경이라면 최신 LTS 계열을 우선 검토하고, 필요한 중간 버전 경로를 건너뛰지 않으면서 호환성 검사를 진행하는 것이 안전합니다.

## 참고 자료

- MySQL Upgrade Paths  
  https://dev.mysql.com/doc/refman/9.7/en/upgrade-paths.html
- MySQL Shell Upgrade Checker Utility  
  https://dev.mysql.com/doc/mysql-shell/9.7/en/mysql-shell-utilities-upgrade.html
- MySQL Releases: Innovation and LTS  
  https://dev.mysql.com/doc/refman/9.7/en/mysql-releases.html
- MySQL Keywords and Reserved Words  
  https://dev.mysql.com/doc/refman/9.7/en/keywords.html
