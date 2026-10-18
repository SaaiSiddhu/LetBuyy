# F3.7 COD reconciliation replay binding — 5 October 2026

## Result

Migration 298 places the service-role-only
`reconcile_cod_remittance_with_ledger_checked` boundary in front of the
existing canonical accounting transaction. It binds each reconciliation key
to one entry, normalized deposited amount and notes. An exact retry returns the
original result; changing the amount or using the key for another entry raises
a conflict before another ledger or wallet posting. The API route now always
reaches the SQL boundary instead of returning an idempotency-key lookup result
without comparing the request.

The previous implementation remains private and is callable only inside the
checked `SECURITY DEFINER` wrapper. Migrations 297/298 rollbacks retain the
service-only checked boundary rather than reopening direct access to the
unchecked compatibility writer.

## Verification

- Real Gateway COD and refund lifecycle against owned Postgres 16/PostgREST:
  **11/11** passed, zero failures/skips/TODOs/cancellations (`2039d06c1b30`).
  The worker journey records one canonical COD remittance and one compatibility
  wallet row for the exact retry; changed deposit and cross-entry key reuse
  both return 409 and leave the original amount and ledger posting unchanged.
- The suite proves only `service_role` can execute the checked function, API
  roles cannot invoke either writer directly, both paired privilege rollbacks
  preserve the strict boundary, and migration 298 reapplies cleanly. It also continues through the
  existing refund provider-lifecycle journeys.
- Owned database resources were cleaned. No provider sandbox, hosted database,
  payout or live-money transaction was used.

## Remaining

The wider F3.7 source-to-ledger census remains open. The dated correction in
[COD collection atomicity evidence](F3_7_COD_COLLECTION_ATOMICITY_2026-10-05.md)
supersedes the collection gap above: migration 299 now provides a locked,
idempotent SQL mutation with owned-Postgres verification. COD receivable
recognition and remittance accounting direction still need the recorded
finance/ARB resolution before the accounting lifecycle is changed.
