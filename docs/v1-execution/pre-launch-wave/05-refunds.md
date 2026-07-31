# 05 — Refund System (Stream E)

**Readiness: ~85% code-ready.** Cannot over-refund; happy paths idempotent + ledgered. One fix landed; two gaps documented.

## Flow
`POST /orders/:id/refund` (create return+refund, idempotent SECURITY DEFINER RPC) → `POST /orders/:id/refund/complete` (`complete_order_refund`, FOR UPDATE on refunds+orders, over-refund guard, ledger reversal, refund.succeeded outbox) → notifications + gift-card restore.

## Money-safety — CAP-C02
**Cannot over-refund** (deployed B1/B2 `complete_order_refund`, line ~370): sums succeeded refunds under `FOR UPDATE`, raises if `existing + amount > order.total`. Plus `refunds.amount >= 0` CHECK + ledger 4-tuple dedup. Verified.

## Fixed this wave
- **E1 (HIGH) — gift card not restored on the canonical refund path:** added best-effort `restore_gift_card_on_refund` to `POST /orders/:id/refund/complete` (mirrors the PATCH cancel path). Gift-card-funded orders refunded via the canonical 2-step flow now restore balance. Contract-tested.

## Open issues (documented, not fixed — risk/coordination)
| ID | Sev | Finding | Why deferred |
|---|---|---|---|
| E2 | HIGH | `POST /orders/:id/refund/complete` + `POST /returns/:id/refund/complete` lack the step-up gate that `POST /payments/:id/refund` enforces | Adding mandatory step-up without verifying the merchant UI sends `X-Step-Up-Token` to these specific routes would 403 every refund — needs coordinated route+UI+test change on staging. |
| E3 | MED | Over-refund guard lives only in the B1/B2 overlay; a half-migrated dev DB lacks it | Prod runs the B1/B2 version (CREATE OR REPLACE); zero prod risk. |
| E4 | MED | Refund amount not validated against captured total at intent-creation (only at completion) | No money leaves before the completion guard fires; UX-only. |
| R-02 | MED | Partial refund of a gift-card-funded order does not auto-restore GC balance (by design, documented in migration 174 comment) | Design decision — flag for product. |
| E5 | LOW | Refund email can double-send (refund/complete + PATCH refunded) | Both best-effort; UX only. |

## Live gate
CAP-C02 (live refund-ledger cert) needs real Razorpay + staging + step-up secrets.
