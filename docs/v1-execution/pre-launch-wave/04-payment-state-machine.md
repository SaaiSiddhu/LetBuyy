# 04 — Payment State Machine (Stream D)

**Verdict:** Core transitions are guarded; **cannot double-charge**. A few orphan/unused states exist (low risk).

## State spaces
- `orders.payment_status`: pending → paid → refunded (+ failed).
- `payment_transactions.status`: pending → captured → partially_refunded/refunded/voided (authorized/completed declared but unused).
- `orders.status`: pending/pending_cod → confirmed → processing → shipped → delivered → (refunded); cancelled/refunded terminal.

## Findings (issue register)
| ID | Sev | Finding |
|---|---|---|
| F1 | MED | `payment_transactions.status='authorized'` in CHECK enum but no RPC writes it; no `authorized→captured` transition (no pre-auth flow). Orphan/dead state. |
| F2 | LOW | `payment_transactions.status='completed'` declared, never written. |
| F3 | MED | `orders.financial_state` column (migration 147) declared with full enum but **never written** by any RPC/TS — dead schema vector. |
| F4 | LOW-MED | No explicit terminal guard at the `payment_transactions` level for already-captured; safe because the ledger's `ON CONFLICT DO NOTHING` (4-tuple) deduplicates and `confirm_order_payment` returns early when `payment_status='paid'`. |
| F6 | INFO | `cancelled` of an unpaid order sets `payment_status='refunded'` (semantically imprecise; no money moved). |

## Money-safety — CAP-C01
**Cannot double-capture.** Layered guards: `FOR UPDATE` on the order row + `confirm_order_payment` early-return on `paid` + ledger 4-tuple `ON CONFLICT DO NOTHING` + idempotency key = provider payment id. Verified in `168_b1_b2_capture_refund_ledgering.sql`.

## Recommendation
The orphan states (F1/F2/F3) should be either activated (if a pre-auth flow is planned) or removed for clarity — **not a launch blocker** (no code path reaches them). Live capture certification (CAP-C01) requires real Razorpay keys + staging.
