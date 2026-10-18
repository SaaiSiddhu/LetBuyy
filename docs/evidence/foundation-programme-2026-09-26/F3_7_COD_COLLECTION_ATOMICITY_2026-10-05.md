# F3.7 COD collection atomicity — 5 October 2026

## Result

Migration 299 adds a service-role-only SQL transaction for COD collection. It
locks the tenant's COD order and reconciliation entry, binds a collection key
to the order, requested amount and notes, and writes the collected state once.
An exact replay returns the recorded entry; changing request data or reusing a
key for another order conflicts. The Gateway route now delegates its mutation
to this boundary rather than performing separate reads and an update. The
paired rollback removes only the function and preserves reconciliation data.

This records the merchant's COD collection report. It does not recognize a COD
receivable, post a ledger entry, move funds or resolve the pending finance/ARB
accounting-direction decision.

## Verification

- Owned PostgreSQL 16/PostgREST and real API Gateway suite:
  **3/3** passed, zero failures/skips/TODOs/cancellations
  (`a3def307f166`). It verifies a partial collection and exact replay, changed
  amount/notes/order conflicts, unauthorized tenant denial, one winner for
  concurrent different-key requests, same-key retry after an in-flight
  conflict, service-role-only RPC privileges and rollback/reapply preserving
  collection rows.
- Gateway typecheck passed; `pnpm run validate:migrations` passed; focused
  money/ledger contracts passed **15/15**; `git diff --check` passed for the
  implementation files.
- Disposable owned database resources were removed by the runner. No provider
  sandbox, hosted database or live-money transaction was used.

## Remaining

The route-level COD collection mutation is now locally verified. The broader
F3.7 source-to-ledger census remains open across capture, settlement, refund,
COD receivable recognition and Phase 10 attribution ownership. Reconcile the
global zero-commission doctrine with the accepted storefront-zero / marketplace
category direction, and resolve D07 rates, fee/tax basis, rounding and COD
accounting direction before wiring commercial or receivable postings. The
separate settlement payout instruction/item/outbox atomicity review was
subsequently closed for local database atomicity under migration 300; see [F9
settlement payout-instruction evidence](F9_SETTLEMENT_PAYOUT_INSTRUCTION_ATOMICITY_2026-10-05.md).
Payout provider reconciliation remains open. A later migration 301 also closed
the local post-adapter release-finalization transaction boundary, with
provider unknown-outcome recovery and reconciliation still open; see [F9
payout-release finalization evidence](F9_PAYOUT_RELEASE_FINALIZATION_ATOMICITY_2026-10-05.md).
