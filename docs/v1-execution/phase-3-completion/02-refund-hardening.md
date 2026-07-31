# 02 — Refund Hardening

**Readiness: ~85% code.** Cannot over-refund (CAP-C02 design-verified); gift-card restore on the canonical path was fixed in the pre-launch wave (E1).
Detailed audit: `docs/v1-execution/pre-launch-wave/05-refunds.md`.

## Verified
- Over-refund guard (B1/B2 `complete_order_refund`, `FOR UPDATE` + sum-check). `refunds.amount >= 0`. Ledger reversal + dedup.
- **E1 (done, pre-launch wave):** `restore_gift_card_on_refund` on `/orders/:id/refund/complete` — contract-tested.

## Open (documented — deferred: needs coordinated UI + live verification, per "every fix must be verified")
- **E2 (HIGH):** refund step-up gate missing on `orders.ts` `/refund/complete` + `returns.ts` `/refund/complete` (present on `payments.ts`). NOT applied blind: adding mandatory step-up without verifying the merchant UI sends `X-Step-Up-Token` to these routes would 403 every refund. Needs a coordinated route+UI+test change on staging.
- E4 amount validated only at completion (no money leaves before the guard). R-02 partial-GC + partial-refund doesn't auto-restore (by design, migration 174). E5 possible double email.

Live refund cert = CAP-C02 (real Razorpay + staging + step-up secrets).
