# LB-10 — Lifecycle Emails (shipped / cancelled / refunded): Implementation Strategy

**Date:** 2026-06-13 · **Mode:** research/blueprint · all claims cite file:line.

## TL;DR

Two email mechanisms exist; **copy Mechanism A** (the order-confirmation path: direct `NOTIFICATION_QUEUE` enqueue → worker `sendResendEmail`). The order lifecycle **events already fire and are enqueued**; what's missing is **email** side-effects for shipped/cancelled/refunded. Add 3 transactional job types + builders, extend the worker allowlist, and call them from the order transition handlers. Idempotency reuses deterministic per-(store,order,stage) keys. **Live delivery is gated by human seam H6 (Resend).**

## Architecture (the two mechanisms)

- **Mechanism A — direct queue (REUSE THIS).** `order-confirmation-email.ts:116-130` enqueues `{jobType:'email.order_confirmation', idempotencyKey:'email.order_confirmation:${storeId}:${orderId}'}` to Cloudflare `NOTIFICATION_QUEUE` (tenant-signed). Worker consumes: `dispatchEmailDeliveries` filters by allowlist `isTransactionalEmailJob` (`queue-workers/src/index.ts:468-472`), validates `emailPayload` (`:441-466`), **sends at `:500-507` via `sendResendEmail`** (`RESEND_FROM_EMAIL` default `'LetBuyy <noreply@letbuyy.com>'`). Generic helper to mirror: `transactional-email.ts` `TransactionalEmailJobType` union (`:17-19`) + `enqueueTransactionalEmail` (`:85-119`).
- **Mechanism B — outbox → platform queue (NOT email).** Drives WhatsApp + in-app only; the email template route `/email/send` (`email.ts`) is an owner-triggered MJML path, not automatic. **Do not use for LB-10.**

## Events — already firing & enqueued

`orderEventsForStatus` (`orders.ts:433-439`): `shipped→['order.fulfilled']`, `cancelled→['order.cancelled']`, `refunded→['order.returned','order.refunded']`. Emitted by `PATCH /orders/:id` (`:1161-1170`), `POST /:id/fulfill` (`:1271-1278`), `POST /:id/refund/complete` (`:1316-1323`) via `emitOrderEvent`→`emitDomainEvent`→**`outbox_events` upsert** (`event-execution.adapter.ts:60-77`). All four are contracted with the `notifications` consumer (`event-core/src/index.ts:488-512`). So they already reach `processNotificationSideEffect` (`platform-queue-consumer.ts:610-627`) — but that switch has **no email branch** and **no case** for cancelled/refunded.

## Existing vs missing

| Event | WhatsApp/in-app | Email | Tracking # available? |
|---|---|---|---|
| `order.fulfilled` (shipped) | ✅ wired (`notification-core:327-336,390-397`); WA vars include `tracking_number` (`platform-queue-consumer.ts:909-921`) | ❌ **no shipped email** | ✅ `orders.tracking_number,carrier` (set by `create_order_fulfillment` RPC, `order-execution.adapter.ts:465-476`) |
| `order.cancelled` | ❌ none | ❌ none | n/a |
| `order.refunded`/`order.returned` | ❌ none | ❌ none | n/a |

## Recommended implementation (Mechanism A)

1. **`services/api-gateway/src/lib/transactional-email.ts`** — add `email.order_shipped`, `email.order_cancelled`, `email.order_refunded` to `TransactionalEmailJobType` (`:17-19`); add `enqueueOrderShippedEmail` / `enqueueOrderCancelledEmail` / `enqueueOrderRefundedEmail` that load the order (+ `tracking_number`/`carrier` for shipped), build `{to,subject,text,html,order_id,store_id,order_number}` (mirror `buildOrderConfirmationEmail`, `order-confirmation-email.ts:43-86`), and call `enqueueTransactionalEmail` with keys `email.order_<stage>:${storeId}:${orderId}`. No-recipient short-circuit `{queued:false, reason:'missing-recipient'}` (`:126,169`).
2. **`services/queue-workers/src/index.ts`** — extend `isTransactionalEmailJob` (`:468-472`) to include the 3 new job types. **This single allowlist is the gate**; the existing `emailPayload`/`sendResendEmail` path handles them unchanged.
3. **`services/api-gateway/src/routes/orders.ts`** — call the helpers after the event emits: `PATCH /:id` loop (`:1160-1170`) for shipped/cancelled/refunded; `/:id/fulfill` (`:1271-1278`) for shipped; `/:id/refund/complete` (`:1316-1323`) for refunded. Handlers already have `c.env` (queue binding) + `tenant` (siteId/requestId).

**Optional (heavier, not recommended for V1):** outbox-driven email via a new `processEmailSideEffect` in `platform-queue-consumer.ts:610-627` + a `planLifecycleEmailForEvent` in `notification-core`. Downsides: touches the consumer/contract layer, needs a new `email_logs` table for DB idempotency, and the worker auto-cancel path (`expireDueCodConfirmations`, `platform-queue-consumer.ts:1120-1133`) sets `status:'cancelled'` **without re-emitting `order.cancelled`**, so an outbox-only cancelled email would miss auto-cancels. Mechanism A (enqueue at the transition handler) avoids all of this.

## Idempotency (reuse)

- Outbox: `outbox_events` upsert `onConflict:'idempotency_key'`, key `'${eventType}:${siteId}:${orderId}:${requestId}'` (`event-execution.adapter.ts:74`, `orders.ts:427`).
- Queue fanout: `platform_queue_jobs` upsert `onConflict:'queue_name,idempotency_key'` (`outbox-execution.adapter.ts:141,151`).
- **Email (the relevant one):** deterministic queue-body key per stage — `email.order_shipped:${storeId}:${orderId}` etc. The worker does **no DB-level email dedupe**; the deterministic key + Cloudflare Queues delivery is the only guard, so the key MUST be stage-scoped (independent dedupe per lifecycle stage).

## Test plan

- **Mirror `services/api-gateway/src/__tests__/order-confirmation-email.test.ts`**: per stage — enqueues exactly one job with correct `jobType` + deterministic stage-scoped `idempotencyKey` (`:66-92`); tenant-envelope signed (`:94-154`); the **source-assertion test** (`:156-166`) that greps `queue-workers/src/index.ts` for the allowlist → add the 3 new job types there.
- Shipped: assert payload carries `tracking_number`.
- `whatsapp.test.ts:147-150` already asserts the `order_shipped` WA mapping — extend only if adding cancelled/refunded notification plans.
- `tests/executable/email-postgres.test.mjs` (mig 149) — only if DB email-logging is added.

## H6 dependency (do not mark complete)

Every send path **fails closed** on a placeholder `RESEND_API_KEY`: worker logs `missing-resend-secret` and `continue`s (`queue-workers/src/index.ts:487-498`); `/email/send` throws `HumanRequiredError HR-ESP-LIVE` in live mode (`email.ts:42-48`). LB-10 can be **built, wired, unit-tested** with skip/sandbox keys, but real emails don't leave the system until a human installs live Resend creds + SPF/DKIM/DMARC (**H6**).

## Rollout / rollback

- **Rollout:** one PR (no migration if Mechanism A). Validate gate + the order-confirmation-mirror tests. Live-verify after H6.
- **Rollback:** revert the PR; lifecycle emails simply stop enqueuing — no schema/state.

**Effort: ~2 days. Risk: low (proven path). Commit: 1 (separate). Live: blocked on H6.**
