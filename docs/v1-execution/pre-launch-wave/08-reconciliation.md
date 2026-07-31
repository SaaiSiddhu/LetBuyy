# 08 — Money Reconciliation (Stream H)

**Central question — can money disappear, duplicate, or diverge?**

## Verdict: On the happy paths, NO. The canonical ledger design is sound.
Every money mutation routes through a SECURITY DEFINER RPC → `post_ledger_transaction`, which inserts into `ledger_transactions` with a 4-tuple unique constraint `(site_id, source_type, source_id, idempotency_key)` and `ON CONFLICT DO NOTHING`. This is the global dedup seal.

| Path | Disappear? | Duplicate? | Diverge? | Mechanism |
|---|---|---|---|---|
| Payment capture | No | No | No | FOR UPDATE + ledger 4-tuple idempotency (key = provider payment id) |
| Payment failure | No | No | No | status gate + idempotency |
| Refund | No | No | No | FOR UPDATE + over-refund guard + status gate + ledger reversal |
| Gift-card redemption | No | No | No | FOR UPDATE on GC account + balance is a pure ledger projection + idempotency |
| Gift-card issuance | No | No | No | idempotency required |
| **GC refund restore (partial)** | **Yes — by design** | No | No | Partial refund of a GC-funded order does NOT auto-restore (migration 174 comment) — R-02 |
| Reconciliation cron | — | — | Detects divergence | `refresh_money_ledger_site_reconciliation` every 6h — but **no alert on mismatch** (R-04) |
| COD reconciliation | No (code) | No | Operator-entry risk | idempotency keys; no server cross-check of entered amount vs order.total (R-05) |

## Issue register
- **R-02 (MED):** partial-GC + partial-refund silently voids GC balance (documented design limitation) — flag for product.
- **R-04 (LOW):** reconciliation cron logs mismatches to worker logs only — no outbox/alert/pager. A real variance would be invisible. Wire an alert before scale.
- **R-05 (LOW):** COD `expected_amount_minor` operator-entered, no server cross-check vs `orders.total`.
- **R-06 (cosmetic):** `gift_card_ledger_entries.balance_after` is denormalized (not the authority; projection is correct).

## Live certification gates
- **CAP-C01** live capture-ledger · **CAP-C02** live refund-ledger · **CAP-C04** live money reconciliation (variance=0 across staging sites + alert path wired). All require real Razorpay + staging.

## Verdict
Foundation is **reconciliation-sound** for staging certification. The mismatch-alert path (R-04) and the partial-GC restore decision (R-02) should be closed before scaling to many merchants (CAP-C04).
