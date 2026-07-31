# LB-10 — Lifecycle Emails (order_cancelled / order_refunded) — Report

**Stream:** D · **Severity:** 🟠 High · **Status:** ✅ CLOSED (contract met + dispatch gaps closed + tested)

## Root cause / verified state
The audit's premise ("missing templates") was **stale**. Already present in source:
- `order_cancelled` + `order_refunded` templates in `DEFAULT_EMAIL_TEMPLATES` (`packages/notification-core/src/index.ts`).
- `planEmailNotificationForEvent` mapping `order.cancelled → order_cancelled`, `order.refunded → order_refunded`, `order.fulfilled → shipment_update`.
- `buildOrderLifecycleEmail` + `enqueueOrderLifecycleEmail` producer (`order-confirmation-email.ts`), idempotency-keyed, HTML-escaped.
- `PATCH /orders/:id` dispatches the email for `cancelled`/`refunded`.
- Queue worker `isTransactionalEmailJob` recognizes `email.order_cancelled` / `email.order_refunded`.

Both `lb10-order-emails` (3/3) and `lb10-dispatch` (4/4) passed at baseline — the **template contract was already satisfied**.

## Gaps found and closed (the real remaining work)
Recon found **two terminal paths that emit the event but never dispatched the customer email** — so customers got no notification on these flows:
1. **`POST /orders/:id/refund/complete`** (the canonical "refund succeeded" path) — emitted `order.refunded`, no email.
2. **COD cancellations** in `order-risk.ts` — both `/cod/confirm` (rejection) and `/cod/timeout` emitted `order.cancelled`, no email. (COD is a primary payment method on an India-first platform, so these matter.)

Closed both with the **same proven best-effort pattern** already used in the PATCH route (post-emit, `try/catch`, never blocks the state change, no money-logic change — purely a notification side-effect):
- `orders.ts` `/refund/complete`: enqueue `kind: 'refunded'`.
- `order-risk.ts` `/cod/confirm` (gated on `!confirmed`) and `/cod/timeout`: enqueue `kind: 'cancelled'` (added the `enqueueOrderLifecycleEmail` import).

**Governance:** no canonical-ledger mutation, no money RPC touched — the refund/cancel is already complete when the email is enqueued; the enqueue is best-effort and idempotency-keyed.

## Files changed
- `services/api-gateway/src/routes/orders.ts` (refund/complete dispatch)
- `services/api-gateway/src/routes/order-risk.ts` (import + 2 COD dispatch sites)
- `tests/launch/lb10-dispatch.test.mjs` (+2 assertions covering refund/complete + both COD paths)

## Tests & validation
- `tests/launch/lb10-order-emails.test.mjs`: **3/3 pass**.
- `tests/launch/lb10-dispatch.test.mjs`: **6/6 pass** (was 4/4; +2 for refund/complete + COD reject/timeout).
- `pnpm --filter @letbuyy/api-gateway typecheck`: **clean**.

## Evidence
```
PASS  lb10-order-emails  (3 ok)
PASS  lb10-dispatch  (6 ok)
api-gateway typecheck EXIT=0
```

## Live-delivery boundary (honest)
Actual email send requires `RESEND_API_KEY` (human seam **H6** / CAP-C18). Verification here is render + dispatch-path (template lookup, event→template mapping, queue enqueue, worker recognition) — not a live send. The `POST /v1/email/render` route renders `order_cancelled`/`order_refunded` without Resend for preview.
