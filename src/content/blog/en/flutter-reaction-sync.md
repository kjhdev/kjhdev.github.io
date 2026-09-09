---
title: "Safely Sync Flutter Swipe Reactions with a Server"
pubDate: 2026-09-09T12:16:37+09:00
description: "Keep a Flutter swipe-card UI responsive while safely syncing like and dislike reactions with a REST API using optimistic UI, duplicate protection, failure handling, and reset coordination."
category: Flutter
tags:
  - Flutter
  - REST API
  - Optimistic UI
  - State Management
  - Spring Boot
lang: en
---

A swipe-card UI in Flutter is easy to build until every swipe also needs to be stored on a server.

A typical interaction is:

```text
Swipe right → Like
Swipe left  → Dislike
```

If the app waits for every server response before showing the next card, the interface feels slow. If it advances immediately without tracking network requests, UI state and server state can drift apart.

This article uses the following API shape as an example:

```text
GET  /api/v1/prd
POST /api/v1/reaction
POST /api/v1/reset
```

## 1. Basic reaction flow

A right swipe might send:

```json
{
  "appUserId": 1001,
  "productId": 501,
  "reactionCd": "L"
}
```

A left swipe:

```json
{
  "appUserId": 1001,
  "productId": 501,
  "reactionCd": "D"
}
```

For this example:

```text
L → Like
D → Dislike
```

The backend can exclude already-reacted products from future product requests.

## 2. Waiting for the server makes swiping feel slow

The simplest code is:

```dart
await sendReaction(productId, reactionCode);
moveToNextCard();
```

But mobile latency can make every swipe appear to pause.

A better interaction is usually:

```text
Swipe
→ show next card immediately
→ save reaction in the background
```

## 3. Use optimistic UI

Optimistic UI updates the screen first and persists the action afterward.

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

The key idea is to avoid tying the animation directly to network latency.

## 4. Track in-flight requests

Fast swiping can create several concurrent API requests:

```text
Product 501 → pending
Product 502 → pending
Product 503 → pending
```

Track them explicitly.

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

This adds client-side duplicate protection for the same product.

## 5. The backend must also prevent duplicates

Mobile networks can produce this sequence:

```text
Server commits reaction
↓
Network fails before response arrives
↓
Client assumes failure
↓
Client retries
```

The server can receive the same logical reaction twice.

A database uniqueness rule is useful:

```sql
UNIQUE (app_user_id, product_id)
```

The API can reject duplicates or update the existing reaction depending on product rules.

Data integrity should not depend only on Flutter.

## 6. Allow fast consecutive swipes

Blocking all swipes until one request completes usually feels wrong for a card interface.

Track requests independently per product.

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

The same concept works with Provider, Riverpod, Bloc, or another state-management library.

## 7. Define an API failure policy

Optimistic UI needs a clear failure strategy.

### Restore the card

```text
API fails
→ restore previous card
→ show error
```

### Retry later

```text
API fails
→ keep UI state
→ add to retry queue
→ resend when network recovers
```

### Reload from the server

For a prototype:

```text
API fails
→ notify user
→ reload products from server
```

Choose based on how important each reaction is.

## 8. Let the server filter reacted products

The product endpoint can exclude products that already have a reaction.

```text
GET /prd?appUserId=1001
```

Conceptual SQL:

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

This also keeps processed items hidden after an app restart.

## 9. Add a development Reset API

During development or QA, a test user may need to start from the beginning.

```text
POST /api/v1/reset
```

Example request:

```json
{
  "appUserId": 1001
}
```

The backend can remove all reactions for that user:

```sql
DELETE
FROM user_product_reaction
WHERE app_user_id = ?
```

## 10. Prevent Reset from racing with pending reactions

This sequence creates a subtle bug:

```text
Like request is still pending
↓
Reset deletes all reactions
↓
Old Like request completes afterward
↓
Reaction appears again
```

Before resetting, coordinate with current requests.

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

The sequence becomes:

```text
Reset pressed
↓
Disable new swipes
↓
Wait for pending reactions
↓
Call Reset API
↓
Reload products
↓
Enable swiping
```

## 11. Separate UI state from server state

UI state:

```text
Current card
Next card
Swipe enabled
Animation
Loading state
```

Server state:

```text
Saved likes/dislikes
Pending requests
Failed requests
Already-reacted products
```

Keeping those responsibilities separate makes the code easier to reason about.

A small application can use:

```text
SwipePage
    ↓
ReactionController / Store
    ↓
ApiClient
```

Avoid placing HTTP calls, request tracking, reset sequencing, and animation logic in one widget.

## Final flow

Normal reaction:

```text
Swipe
↓
Remove card immediately
↓
Register pending request
↓
Call reaction API
↓
Handle success/failure
↓
Remove pending state
```

Reset:

```text
Press Reset
↓
Disable new swipes
↓
Wait for pending requests
↓
Call reset API
↓
Reload products
```

A reliable swipe application needs to balance **responsive UI, duplicate protection, network failure handling, and correct ordering between Reset and pending requests**.

Let the UI react quickly while the backend remains responsible for data consistency.
