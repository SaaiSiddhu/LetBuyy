# 01 — Payment State Machine

**Verdict:** Core transitions guarded; **cannot double-charge** (CAP-C01 design-verified). Orphan states are low-risk.
Detailed audit: `docs/v1-execution/pre-launch-wave/04-payment-state-machine.md`.

## States & guards (verified)
`orders.payment_status`: pending → paid → refunded (+ failed); double-capture blocked (`confirm_order_payment` early-returns on `paid`; ledger 4-tuple `ON CONFLICT DO NOTHING`; `FOR UPDATE`).

## Open (documented; low-risk, not blockers)
- F1 `payment_transactions.status='authorized'` — declared, no `authorized→captured` RPC (no pre-auth flow). Orphan.
- F2 `='completed'` — declared, never written.
- F3 `orders.financial_state` — column declared, never written.
- F6 unpaid `cancelled` sets `payment_status='refunded'` (semantically loose; no money moves).

**Recommendation:** activate or remove the orphan enum values for clarity (not a launch blocker — no code path reaches them). Live capture cert = CAP-C01 (needs real Razorpay + staging).
