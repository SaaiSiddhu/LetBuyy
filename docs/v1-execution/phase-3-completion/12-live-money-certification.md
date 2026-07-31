# 12 — Live Money Certification Plan (CAP-C01..C04)

These are **procedures**, not results. Each requires real Razorpay credentials + a staging Supabase + at least one real store — none performable in this engineering environment. Run on staging before any real-money launch. **Do not mark any CAP green without executing it on staging with real artifacts.**

## CAP-C01 — Live capture-ledger certification (before 1st paid order)
1. Provision real `RAZORPAY_KEY_ID`/`_SECRET` + register the webhook endpoint (`webhook-service`) with the signing secret.
2. Place a real test order; pay via Razorpay test mode → `payment.captured` webhook.
3. Assert: `confirm_order_payment_with_ledger` ran once (idempotent on the provider payment id); `orders.payment_status='paid'`; `ledger_account_balance_minor('merchant_payable')` increased by exactly `order.total_minor`; exactly one `ledger_transactions` row for the capture (4-tuple).
4. Re-deliver the same webhook → assert no change (ON CONFLICT DO NOTHING).

## CAP-C02 — Live refund-ledger certification (before 1st refund)
1. With step-up secrets set, refund the CAP-C01 order via `POST /payments/:id/refund` (step-up) and via `POST /orders/:id/refund` → `/refund/complete`.
2. Assert: `complete_order_refund` rejects over-refund; `merchant_payable` debited back by the refund amount; `orders.payment_status='refunded'`; refund email enqueued; gift-card balance restored if the order used a gift card (E1).
3. Run `refresh_money_ledger_site_reconciliation` → `status='verified'`, `variance_minor=0`.

## CAP-C03 — Live payout provider certification (before 1st payout)
1. Complete Razorpay Route PA onboarding (H8); set `RAZORPAY_ROUTE_ACCOUNT_ID` + `RAZORPAY_ROUTE_PROVIDER_ENABLED=true`.
2. **Pre-req:** land the R-03 fix (DB-level order claim) so concurrent statement creation cannot double-include orders.
3. Create a `payout_statement`, `POST /:id/settle` (step-up) → assert a real Razorpay transfer id is returned; ledger posts `merchant_payable Dr / pa_clearing Cr`; balance guard held.

## CAP-C04 — Live money reconciliation (before 100 merchants)
1. Wire the mismatch alert path (R-04) — the 6h `refresh_money_ledger_site_reconciliation` cron must emit an outbox/alert on `variance_minor != 0`.
2. Run across all staging sites → assert `variance_minor=0` everywhere; force a deliberate mismatch → assert the alert fires.

## Status: ALL FOUR — NOT STARTED (blocked on real Razorpay + staging + H8). The code paths each CAP exercises are design-verified (see `05-reconciliation.md`) and the canonical-ledger validator passes; live execution is the remaining, un-fakeable step.
