---
title: "MySQL 5.7을 Docker 기반 최신 MySQL로 이전하는 방법"
pubDate: 2026-09-11T09:15:59+09:00
description: "기존 Ubuntu MySQL 5.7 서버를 Docker 기반 MySQL 9.7 LTS 환경으로 옮길 때 백업, 단계별 버전 검증, Docker Compose, 데이터 import, 계정 재생성, 전환과 롤백까지 정리합니다."
category: MySQL
tags:
  - MySQL
  - MySQL 5.7
  - Docker
  - Docker Compose
  - Database Migration
  - Ubuntu
lang: ko
---

기존 Ubuntu 서버에 직접 설치해 사용하던 MySQL 5.7을 새 서버로 옮길 때 Docker를 사용하면 DB 버전과 데이터 볼륨을 분리해 관리하기 편합니다.

하지만 다음처럼 바로 진행하는 것은 위험합니다.

```text
MySQL 5.7 dump
→ 최신 MySQL Docker 실행
→ 바로 import
→ 완료
```

2026년 9월 기준 MySQL의 현재 LTS 계열은 **9.7**이며 Docker Official Image에서도 `mysql:9.7`과 `mysql:lts` 계열을 제공합니다.

중요한 점은 Docker가 메이저 버전 호환성 문제를 해결해 주는 것은 아니라는 것입니다.

## 1. 목표 구조

기존 서버:

```text
Ubuntu
└── MySQL 5.7
    └── app_db
```

신규 서버:

```text
Ubuntu
└── Docker
    └── MySQL 9.7 LTS
        ├── app_db
        └── mysql_data volume
```

애플리케이션도 Docker로 운영한다면 같은 Network에 연결할 수 있습니다.

```text
API container
    │
    ▼
Docker Network
    │
    ▼
MySQL container
```

## 2. 먼저 기존 5.7 DB를 백업한다

InnoDB 중심의 애플리케이션 DB라면 예를 들어 다음과 같이 논리 백업을 만듭니다.

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

주요 옵션:

```text
--single-transaction
→ InnoDB 논리 백업의 일관성 확보

--routines
→ Procedure / Function 포함

--events
→ Event 포함

--triggers
→ Trigger 포함
```

DB가 여러 개라면 애플리케이션 단위로 dump를 분리하는 것도 관리하기 편합니다.

## 3. dump가 실제로 복원되는지 확인

```bash
ls -lh app_db_57.sql
```

파일이 생성됐다는 사실만으로 백업이 검증된 것은 아닙니다.

별도 테스트 인스턴스에 복원해서 주요 테이블, Procedure, Trigger, Event가 실제로 살아나는지 확인합니다.

## 4. 사용자와 권한을 별도로 기록한다

```sql
SELECT
    user,
    host,
    plugin
FROM mysql.user;
```

특정 계정의 권한:

```sql
SHOW GRANTS FOR 'app_user'@'%';
```

오래된 `mysql` 시스템 스키마 자체를 최신 서버에 덮어쓰기보다 새 서버에서 애플리케이션 계정을 다시 생성하고 필요한 권한만 부여하는 편이 안전합니다.

예:

```sql
CREATE USER 'app_user'@'%'
IDENTIFIED BY 'NEW_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE
ON app_db.*
TO 'app_user'@'%';
```

실제 비밀번호는 소스나 블로그에 작성하지 않습니다.

## 5. 5.7 데이터 디렉터리를 9.7 컨테이너에 직접 연결하지 않는다

MySQL 공식 업그레이드 경로는 필요한 중간 릴리스 계열을 거쳐야 합니다.

```text
MySQL 5.7
↓
MySQL 8.0
↓
MySQL 8.4 LTS
↓
MySQL 9.7 LTS
```

따라서 다음처럼 기존 5.7 데이터 디렉터리를 최신 이미지에 직접 마운트하는 방식은 피합니다.

```yaml
services:
  mysql:
    image: mysql:9.7
    volumes:
      - /old/mysql57/datadir:/var/lib/mysql
```

DB 파일 포맷과 내부 메타데이터가 여러 세대를 건너뛰기 때문에 안전한 이전 방식이 아닙니다.

## 6. 단계별 테스트 환경을 만든다

운영 데이터 복사본으로 중간 버전을 테스트합니다.

```text
5.7 dump
↓
8.0 테스트
↓
호환성 수정
↓
8.4 테스트
↓
9.7 테스트
```

각 단계에서 MySQL Shell Upgrade Checker를 사용할 수 있습니다.

예:

```bash
mysqlsh -- util check-for-server-upgrade \
  user@db.example.com:3306 \
  --target-version=8.0 \
  --output-format=JSON
```

다음 단계로 넘어가기 전에 발견된 호환성 문제를 먼저 수정합니다.

## 7. Docker Compose로 MySQL 9.7 준비

신규 서버의 `compose.yaml` 예시:

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

`.env`는 Git에서 제외합니다.

```gitignore
.env
```

운영 환경에서는 Docker Secrets나 별도 Secret Manager도 검토할 수 있습니다.

## 8. 운영 DB에서는 `latest` 사용을 피한다

다음 설정은 간단합니다.

```yaml
image: mysql:latest
```

하지만 `latest`가 향후 다른 Innovation 계열을 가리킬 수 있습니다.

운영 DB라면 의도한 LTS 계열을 명시합니다.

```yaml
image: mysql:9.7
```

변경을 더 엄격하게 통제해야 한다면 검증한 패치 버전이나 image digest까지 고정할 수 있습니다.

## 9. MySQL 컨테이너 실행

```bash
docker compose up -d
```

상태 확인:

```bash
docker compose ps
```

로그:

```bash
docker compose logs -f mysql
```

접속:

```bash
docker compose exec mysql mysql -uroot -p
```

버전 확인:

```sql
SELECT VERSION();
```

## 10. 최종 호환 dump import

중간 버전 검증과 애플리케이션 테스트를 거쳐 MySQL 9.7에서 사용할 수 있는 dump를 준비했다고 가정합니다.

호스트의 SQL 파일을 다음처럼 import할 수 있습니다.

```bash
docker compose exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
  < app_db_97.sql
```

명령줄 비밀번호 사용은 셸 히스토리나 프로세스 정보에 노출될 수 있으므로 운영 자동화에서는 더 안전한 인증 방식을 사용하는 것이 좋습니다.

## 11. 테이블과 주요 데이터 검증

테이블 개수:

```sql
SELECT
    table_schema,
    COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'app_db'
GROUP BY table_schema;
```

주요 테이블:

```sql
SELECT COUNT(*)
FROM important_table;
```

Procedure:

```sql
SHOW PROCEDURE STATUS
WHERE Db = 'app_db';
```

Trigger:

```sql
SHOW TRIGGERS
FROM app_db;
```

Event:

```sql
SHOW EVENTS
FROM app_db;
```

원본 서버와 결과를 비교합니다.

## 12. 문자셋과 Collation 다시 확인

```sql
SELECT
    schema_name,
    default_character_set_name,
    default_collation_name
FROM information_schema.schemata
WHERE schema_name = 'app_db';
```

테이블:

```sql
SELECT
    table_name,
    table_collation
FROM information_schema.tables
WHERE table_schema = 'app_db';
```

기존 5.7에서 `utf8` 또는 `utf8mb3`를 사용했다면 무조건 변환하지 말고 실제 데이터와 애플리케이션을 테스트한 뒤 `utf8mb4` 전환 여부를 정합니다.

## 13. 최신 인증 방식에 맞게 사용자 재생성

MySQL 9.x에서는 서버 측 `mysql_native_password`가 제거되었습니다.

따라서 새 환경에서는 계정을 새 인증 방식에 맞게 생성하고 애플리케이션 Connector도 호환되는지 확인합니다.

```sql
CREATE USER 'app_user'@'%'
IDENTIFIED BY 'NEW_STRONG_PASSWORD';
```

필요한 권한만 부여합니다.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON app_db.*
TO 'app_user'@'%';
```

## 14. Docker 내부에서는 서비스명을 DB 호스트로 사용

API와 MySQL이 같은 Docker Network에 있다면:

```text
jdbc:mysql://mysql:3306/app_db
```

처럼 서비스명 `mysql`을 사용할 수 있습니다.

예:

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

컨테이너 내부에서 `localhost`는 현재 컨테이너 자신을 의미하므로 다른 MySQL 컨테이너 주소로 사용할 수 없습니다.

## 15. 외부 DB 접속이 필요 없다면 포트를 공개하지 않는다

API 컨테이너만 MySQL을 사용한다면 다음 설정이 꼭 필요하지 않을 수 있습니다.

```yaml
ports:
  - "3306:3306"
```

같은 Docker Network 내부에서는 포트를 외부에 publish하지 않아도 서비스명으로 접근할 수 있습니다.

외부 관리 도구에서 직접 접속해야 하는 경우에만 방화벽과 접근 범위를 함께 고려해 공개합니다.

## 16. 애플리케이션 기능 테스트

최소한 다음 기능을 확인합니다.

```text
로그인
조회
등록
수정
삭제
배치
통계
스케줄러
```

Spring Boot를 Docker로 운영한다면 로그도 확인합니다.

```bash
docker compose logs -f api
```

단순히 애플리케이션이 기동됐다는 것보다 실제 CRUD와 주요 업무 기능이 정상인지 확인해야 합니다.

## 17. 운영 전환

dump/import 방식이라면 최종 이전 시 쓰기 데이터를 통제해야 합니다.

```text
서비스 점검 시작
↓
기존 DB 쓰기 중단
↓
최종 dump
↓
신규 MySQL import
↓
데이터 검증
↓
애플리케이션 DB 주소 변경
↓
서비스 시작
↓
최종 기능 확인
```

DB가 매우 크거나 downtime을 줄여야 한다면 replication 기반 이전도 검토합니다.

## 18. 원복 계획을 준비한다

새 서버가 정상적으로 보인다고 기존 5.7 서버를 즉시 삭제하지 않습니다.

```text
기존 5.7
→ 일정 기간 보존

신규 9.7
→ 운영
```

문제가 생겼을 때는 업그레이드 전 백업 또는 기존 서버를 기준으로 원복합니다.

최신 서버가 변경한 데이터 디렉터리를 5.7로 단순 되돌리는 계획은 사용하지 않습니다.

## 19. Docker 환경의 백업 정책도 다시 만든다

이전이 끝나면 신규 DB의 백업 자동화도 구성합니다.

예:

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

인증정보는 안전한 방식으로 전달해야 합니다.

그리고 백업은 MySQL Volume과 동일한 저장장치 하나에만 두지 않는 것이 좋습니다.

```text
DB Volume
+
별도 Backup Storage
```

## 최종 이전 흐름

```text
MySQL 5.7 현황 분석
↓
원복용 백업
↓
호환성 검사
↓
5.7 → 8.0 → 8.4 → 9.7 단계별 검증
↓
MySQL 9.7 Docker 구성
↓
호환 dump import
↓
사용자와 권한 재생성
↓
데이터 검증
↓
애플리케이션 연결 변경
↓
기능 테스트
↓
운영 전환
↓
기존 서버 일정 기간 보존
```

## 마무리

MySQL 5.7을 Docker 기반 최신 MySQL로 옮길 때 어려운 부분은 Docker 명령 자체보다 **메이저 버전 간 호환성**입니다.

핵심 원칙은 세 가지입니다.

```text
5.7 데이터 디렉터리를 최신 컨테이너에 직접 연결하지 않는다
필요한 중간 버전 호환성을 단계적으로 확인한다
운영 전환 전에 복구 가능한 원본 백업을 확보한다
```

이 원칙을 지키면 오래된 MySQL 서버를 정리하면서 Docker 기반 환경으로 훨씬 안전하게 이전할 수 있습니다.

## 참고 자료

- MySQL Upgrade Paths  
  https://dev.mysql.com/doc/refman/9.7/en/upgrade-paths.html
- MySQL Shell Upgrade Checker  
  https://dev.mysql.com/doc/mysql-shell/9.7/en/mysql-shell-utilities-upgrade.html
- MySQL Official Docker Image  
  https://hub.docker.com/_/mysql
- MySQL Backup and Recovery  
  https://dev.mysql.com/doc/refman/9.7/en/backup-and-recovery.html
