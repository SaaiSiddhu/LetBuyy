# Phase 9 atomic payout statement creation and retry — 5 October 2026

## Result

Migration 295 adds service-role-only `create_payout_statement_with_effects`.
One PostgreSQL transaction locks payout creation per site, validates/locks the
paid INR source orders, rejects orders already claimed by another statement,
and creates the statement, pending wallet credit, optional balanced canonical
fee journal and statement-to-ledger link together. It checks the gross/fee/tax/
net arithmetic but does not select a fee rate. The main payout route and
settlement executor use this transaction.

The settlement-ingest retry path now resumes after a settlement row exists:
the canonical settlement ledger post replays by its stored key, then the payout
statement, wallet projection, payout instruction, payout item and outbox events
are ensured without duplicates. The test also exposed a producer/schema mismatch
for `payout.scheduled` and incorrect minor-unit event shapes; the event contract
now describes the actual tenant settlement payout, and the event amounts use
the typed INR minor-unit shape.

## Verification

- Real Gateway worker + owned PostgREST/PostgreSQL 16: **1/1** test passed,
  zero failures/skips/TODOs/cancellations (`12f331d46017`). It injects a wallet
  insert failure and a fee-ledger insert failure; both roll the whole payout
  transaction back. It then verifies one statement, matching pending credit and
  balanced canonical fee journal; conflicting source-order claims yield one
  winner and one conflict. For settlement ingestion, an injected wallet failure
  rolls back the payout statement transaction; retry finishes the payout path,
  and another replay preserves one payout, item and each outbox event.
- The owned test rolls migration 295 back and reapplies it successfully.
- Focused Gateway payout/settlement contracts: **13/13**.
- Event-core contracts: **5/5**, including positive and negative
  `payout.scheduled` payload validation.
- API Gateway typecheck, migration safety validator and `git diff --check`:
  passed.
- The runner disposed its owned database resources. The commission schedule is
  a synthetic fixture to exercise balanced posting; it does not establish a
  business fee rate. No provider sandbox, hosted database, external payment,
  payout, or deployment was used.

See the [sanitized owned-run record](F9_PAYOUT_STATEMENT_ATOMICITY_OWNED_RUN_2026-10-05.json).

## Remaining Phase 9 work

The main payout route still reads a store-level commission schedule; it does
not yet allocate the accepted category-based marketplace commission by item.
Exact D07 rates and fee/tax basis remain unresolved, so this change preserves
the already-computed route amounts and sets no policy. Continue the F3.7
source-to-ledger census, then complete weekly eligibility, holds/refunds/COD,
provider reconciliation, release/reversal and merchant statement behavior.
Razorpay Route direct-transfer versus payment-linked split approval also remains
unverified. Phase 9 and the eleven-phase goal remain open.
