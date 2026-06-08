# Task 010 - Notifications
Status: done
DependsOn: [001]
Covers: notification router and outbound webhooks
Conforms-to: V1 section 3, Appendix C row 010

## Goal

Implement WhatsApp-first notification routing, consent/preferences/suppression, retries, delivery logs, and signed outbound webhooks.

## Scope

In: monolith router plus queue-worker sends and existing webhook-service. Out: `notification-service` activation.

## Reuse

`notifications.ts`, queue workers, webhook operations tables/routes, migration `114`.

## Database

Migration `148_executable_notifications_router.sql` adds `notification_logs`, `notification_suppressions`, webhook replay metadata (`replay_window_seconds`, `nonce`, DLQ reason), tenant-GUC RLS/FORCE, and rollback. No partitioning.

## APIs

`POST /notifications/send`; `GET/POST/PATCH/DELETE /notifications/webhooks`; existing notification preferences and device-token routes preserved.

## Events

Subscribes to `order.*`, `payment.refunded.v1`, `cart.abandoned.v1`, `shipment.*`; publishes `notification.sent.v1`, `notification.failed.v1`.

## Acceptance

Event routes WhatsApp-first through the monolith, suppression/preferences are honored, delivery logs are idempotent, `notification.sent|failed` emits through outbox, webhook subscriptions are merchant-scoped, and webhook-service signs timestamp plus nonce headers.

## Tests

PASS: notification-core typecheck; gateway typecheck; webhook-service typecheck/test 12/12; real-PG notification proof; focused notification tests 4/4; gateway unit 192/192; route-line validator; stale-artifact validator; `validate-architecture.mjs`; `validate-governance.mjs` 172.

## Rollback

Disable sends at the route/config layer and run `database/supabase/rollback/148_executable_notifications_router.rollback.sql` to remove additive log/suppression/replay schema.

## [HUMAN-REQUIRED]

`HR-DLT-TRAI-LIVE`.
