# 05 — Reconciliation

**Verdict:** On the audited happy paths, money **cannot disappear, duplicate, or diverge**.
Detailed audit: `docs/v1-execution/pre-launch-wave/08-reconciliation.md`.

## Proof (design-verified, canonical-ledger validator PASS)
Every money mutation routes through a SECURITY DEFINER RPC → `post_ledger_transaction` with a 4-tuple unique constraint `(site_id, source_type, source_id, idempotency_key)` + `ON CONFLICT DO NOTHING` (the global dedup seal) + `FOR UPDATE` row locks.

| Path | Disappear / Duplicate / Diverge | Mechanism |
|---|---|---|
| Capture / Failure / Refund | No / No / No | FOR UPDATE + over-refund guard + ledger 4-tuple dedup |
| Gift-card redeem / issue / full-restore | No / No / No | FOR UPDATE + ledger projection + idempotency |
| Partial-GC + partial-refund | **Yes (by design)** | migration 174 comment — flag for product (R-02) |
| Reconciliation cron (6h) | detects, no alert | R-04 — wire an alert before scale (CAP-C04) |
| COD reconciliation | operator-entry risk | R-05 — no server cross-check vs order.total |

## Open
R-02 (product decision), R-04 (mismatch alert path), R-05 (COD amount cross-check). None corrupt the happy path; all gate CAP-C04 (scale).

**Live cert:** CAP-C01/C02 (capture/refund), CAP-C04 (variance=0 across staging sites + alert wired) — need real Razorpay + staging.
