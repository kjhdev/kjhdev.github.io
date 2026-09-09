---
title: "Flutter 스와이프 반응을 서버와 안전하게 동기화하기"
pubDate: 2026-09-09T12:16:37+09:00
description: "Flutter 카드 스와이프 UI에서 좋아요·싫어요 반응을 빠르게 처리하면서 서버 API와 안정적으로 동기화하는 방법을 optimistic UI, 중복 요청 방지, 실패 처리, Reset API 관점에서 정리합니다."
category: Flutter
tags:
  - Flutter
  - REST API
  - Optimistic UI
  - State Management
  - Spring Boot
lang: ko
---

Flutter로 카드 스와이프 UI를 만들 때 화면만 넘기는 것은 어렵지 않습니다.

문제는 사용자의 스와이프를 서버에도 저장해야 할 때 시작됩니다.

```text
오른쪽 스와이프 → 좋아요
왼쪽 스와이프 → 싫어요
```

매번 서버 응답을 기다린 다음 카드를 보여주면 UI가 느려지고, 반대로 화면만 빠르게 넘기면 네트워크 실패나 중복 요청 때문에 화면 상태와 서버 데이터가 달라질 수 있습니다.

이 글에서는 다음과 같은 API를 예로 사용합니다.

```text
GET  /api/v1/prd
POST /api/v1/reaction
POST /api/v1/reset
```

## 1. 기본 reaction 흐름

예를 들어 사용자가 상품을 오른쪽으로 넘기면 다음 요청을 보낼 수 있습니다.

```json
{
  "appUserId": 1001,
  "productId": 501,
  "reactionCd": "L"
}
```

왼쪽 스와이프:

```json
{
  "appUserId": 1001,
  "productId": 501,
  "reactionCd": "D"
}
```

예시 코드 기준:

```text
L → Like
D → Dislike
```

서버는 이미 반응한 사용자+상품 조합을 다음 상품 조회에서 제외할 수 있습니다.

## 2. 서버 응답을 기다리면 UI가 느려진다

가장 단순한 코드는 다음과 같습니다.

```dart
await sendReaction(productId, reactionCode);
moveToNextCard();
```

하지만 모바일 네트워크가 느리면 사용자는 스와이프할 때마다 화면이 멈춘 것처럼 느낄 수 있습니다.

카드 UI에서는 보통 다음 경험이 더 자연스럽습니다.

```text
스와이프
→ 즉시 다음 카드 표시
→ 서버 저장은 뒤에서 처리
```

## 3. Optimistic UI로 먼저 화면을 바꾼다

이런 경우 Optimistic UI가 적합합니다.

```dart
Future<void> onSwipe(
    Product product,
    String reactionCd,
) async {
    moveToNextCard();

    try {
        await api.saveReaction(
            productId: product.id,
            reactionCd: reactionCd,
        );
    } catch (e) {
        handleReactionError(product, reactionCd);
    }
}
```

UI 전환을 네트워크 응답에 직접 묶지 않는 것이 핵심입니다.

## 4. 요청을 그냥 보내기만 하면 안 된다

사용자가 빠르게 여러 장을 넘기면 여러 API 요청이 동시에 진행됩니다.

```text
상품 501 → pending
상품 502 → pending
상품 503 → pending
```

따라서 진행 중인 reaction을 추적하는 것이 좋습니다.

```dart
final Set<int> _pendingProductIds = <int>{};
```

```dart
Future<void> saveReaction(
    int productId,
    String reactionCd,
) async {
    if (_pendingProductIds.contains(productId)) {
        return;
    }

    _pendingProductIds.add(productId);

    try {
        await api.saveReaction(
            productId: productId,
            reactionCd: reactionCd,
        );
    } finally {
        _pendingProductIds.remove(productId);
    }
}
```

같은 상품에 대한 중복 요청을 클라이언트에서 한 번 더 막을 수 있습니다.

## 5. 중복 방지는 서버에서도 해야 한다

모바일에서는 다음 상황이 가능합니다.

```text
서버 DB 저장 성공
↓
응답 전 네트워크 끊김
↓
클라이언트는 실패라고 판단
↓
재시도
```

서버에는 같은 reaction이 두 번 들어올 수 있습니다.

따라서 DB에서도 사용자와 상품의 조합을 유일하게 관리하는 것이 안전합니다.

```sql
UNIQUE (app_user_id, product_id)
```

정책에 따라 중복 요청을 거절하거나 기존 reaction을 갱신할 수 있습니다.

## 6. 빠른 연속 스와이프는 허용한다

한 요청이 끝날 때까지 전체 UI를 잠그는 것은 카드 UX와 잘 맞지 않습니다.

상품별 요청을 독립적으로 관리할 수 있습니다.

```dart
final Map<int, Future<void>> _pendingRequests = {};
```

```dart
void enqueueReaction(
    int productId,
    String reactionCd,
) {
    if (_pendingRequests.containsKey(productId)) {
        return;
    }

    final future = _sendReaction(productId, reactionCd);
    _pendingRequests[productId] = future;

    future.whenComplete(() {
        _pendingRequests.remove(productId);
    });
}
```

Provider, Riverpod, Bloc 등 어떤 상태관리 방식을 사용하더라도 개념은 같습니다.

## 7. API 실패 정책을 정한다

Optimistic UI에서는 실패 시 어떤 행동을 할지 미리 정해야 합니다.

### 카드 복원

```text
API 실패
→ 이전 카드 복원
→ 오류 안내
```

### 재시도 큐

```text
API 실패
→ UI 유지
→ retry queue 저장
→ 네트워크 회복 후 재전송
```

### 서버 기준 재조회

프로토타입에서는 다음 방식도 단순합니다.

```text
API 실패
→ 오류 안내
→ 상품 목록 다시 조회
```

reaction의 중요도에 따라 선택합니다.

## 8. 상품 목록은 서버가 필터링하게 한다

이미 반응한 상품을 서버에서 제외하면 Flutter가 단순해집니다.

```text
GET /prd?appUserId=1001
```

개념적인 SQL:

```sql
SELECT ...
FROM product p
WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_reaction r
    WHERE r.app_user_id = ?
      AND r.product_id = p.product_id
)
```

앱을 재실행해도 서버 데이터를 기준으로 이미 처리한 상품을 다시 보여주지 않을 수 있습니다.

## 9. 테스트용 Reset API

개발이나 QA에서는 같은 사용자가 처음부터 다시 테스트해야 할 수 있습니다.

```text
POST /api/v1/reset
```

요청 예:

```json
{
  "appUserId": 1001
}
```

서버에서는 해당 사용자의 reaction 데이터를 삭제합니다.

```sql
DELETE
FROM user_product_reaction
WHERE app_user_id = ?
```

## 10. Reset과 pending reaction의 충돌을 막는다

주의해야 할 순서입니다.

```text
Like 요청 진행 중
↓
Reset 실행
↓
DB reaction 삭제
↓
기존 Like 요청이 뒤늦게 완료
↓
reaction이 다시 생성됨
```

이 문제를 막으려면 Reset 전에 진행 중인 요청을 정리해야 합니다.

```dart
bool _isResetting = false;
```

```dart
Future<void> reset() async {
    if (_isResetting) {
        return;
    }

    _isResetting = true;

    try {
        await waitForPendingReactions();
        await api.resetReactions();
        await reloadProducts();
    } finally {
        _isResetting = false;
    }
}
```

전체 흐름은 다음과 같습니다.

```text
Reset 클릭
↓
새 스와이프 차단
↓
pending reaction 완료 대기
↓
Reset API
↓
상품 목록 재조회
↓
스와이프 다시 활성화
```

## 11. UI 상태와 서버 상태를 분리한다

UI 상태:

```text
현재 카드
다음 카드
스와이프 가능 여부
애니메이션
로딩 상태
```

서버 상태:

```text
Like/Dislike 저장 결과
pending 요청
실패한 요청
이미 처리된 상품
```

둘을 분리하면 코드가 훨씬 이해하기 쉬워집니다.

추천 구조:

```text
SwipePage
    ↓
ReactionController / Store
    ↓
ApiClient
```

UI 위젯 하나에서 HTTP 요청, pending 관리, reset 순서, 애니메이션까지 모두 처리하지 않는 편이 좋습니다.

## 최종 흐름

일반 reaction:

```text
스와이프
↓
카드 즉시 제거
↓
pending 등록
↓
reaction API
↓
성공/실패 처리
↓
pending 제거
```

Reset:

```text
Reset 클릭
↓
새 스와이프 차단
↓
pending 요청 완료
↓
reset API
↓
상품 목록 재조회
```

Flutter 스와이프 UI와 서버를 안정적으로 연결하려면 **빠른 UI 반응, 중복 요청 방지, 실패 처리, Reset과 pending 요청의 순서**를 함께 설계해야 합니다.

UI는 빠르게 반응하고 서버는 데이터 정합성을 책임지도록 역할을 나누는 것이 핵심입니다.
