# Phase 9 canonical-to-wallet projection reconciliation — 5 October 2026

## Working position

Verified 5 October 2026 in the local `LetBuyy-phase2` checkout on branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD
`0862687a5008d604d0df23357b2eb511293139fa`. The checkout contains extensive
pre-existing unrelated changes; these focused changes remain unstaged.

## Result

Migration `303_canonical_wallet_reconciliation_projection.sql` closes a known
Phase 9 reconciliation gap for recognized canonical merchant-payable debits.
When a fee assessment or provider refund is posted through the canonical money
writer, the same database transaction now writes one posted wallet adjustment
linked by `canonical_ledger_transaction_id`. Recognized historical fee and
refund transactions are repaired by the migration. Exact canonical replays do
not add another projection. The owner-controlled historical wallet backfill
also resolves legacy payout debit rows through their wallet source, which the
previous source resolver could not resolve.

The projection is intentionally limited to canonical settlement transactions
with `metadata.ledger_role='fee_assessment'` and canonical refund/reversal
transactions. Other wallet/canonical differences remain visible as
reconciliation mismatches; the implementation does not blanket-adjust balances
to make them agree. The paired rollback restores the prior writer/resolver
definitions and removes the private helper while retaining posted financial
rows as audit evidence.

## Verification

The focused PostgreSQL regression first observes the historical fee/refund
variance, applies migration 303, and verifies two linked repair rows. It then
posts a fee and refund through the canonical writer, replays both exact
requests, and confirms four projections total with a `9225:9225:verified`
reconciliation result. A legacy payout debit backfill produces one canonical
entry and `9215:9215:verified`. An unrelated one-paisa wallet adjustment still
returns `mismatch:-1`. The source test also exercises the 303 rollback and
checks that recorded wallet evidence remains present.

The real Gateway Worker → owned PostgREST → disposable PostgreSQL refund suite
passed **11/11** tests (runner `06b5624721a1`):

```sh
node scripts/governance/run-executable-suites.mjs --kind gateway-db --suite services/api-gateway/src/__tests__/owned-db/payment-refund-reconciliation.postgres.test.ts --jobs 1 --log-dir /private/tmp/letbuyy-f37-wallet-projection --json-out /private/tmp/letbuyy-f37-wallet-projection.json
```

It verifies a processed refund writes one linked posted adjustment, an exact
provider retry leaves that single projection in place, and reconciliation
returns zero variance. The fixture runner reported no failures, skips, TODOs,
cancellations, refused requests or cleanup failures; its disposable database,
container, network and volume were removed. The proxy recorded one upstream
error during 218 forwarded requests, with all 11 tests passing.

The focused Wave 1 money test previously passed with migration 303 and its
historical, idempotency, payout-debit backfill, unexplained-drift and rollback
assertions. Its 25 supporting source tests also passed on final rerun via
`node --import tsx --test ...` (25/25). The packaged `tsx --test` command could
not create its IPC pipe in the sandbox (`EPERM`), and the separate attempt to
start the local foundation database could not access the Docker socket. This
prevented a fresh repeat of that database suite; the final real Gateway-owned
Postgres/PostgREST suite did pass after the added Gateway assertions. Migration
history validation and final `git diff --check` passed. The checkout is the
local `LetBuyy-phase2` worktree. No hosted database, provider sandbox, payout
or live money movement was involved.

## Remaining scope

This verifies local database and Gateway refund integration only. It does not
establish historical payout-credit lineage, source-order-to-capture-transaction
linkage, active provider-reversal integration, provider statement reconciliation,
weekly settlement eligibility, ambiguous payout recovery, or Phase 9 closure.
No active payout-reversal writer was found in the current source audit. The
reversal projection path is present for a canonical reversal transaction, but
it still needs a policy-backed writer and end-to-end test before being treated
as an operationally supported journey.

**5 October follow-up:** migration 304 subsequently added source-order-to-ledger
lineage snapshots to payout statement creation/detail. Its missing-source and
partial-refund behavior, decision boundary and owned-runner limitation are
recorded in [payout source-lineage evidence](F9_PAYOUT_SOURCE_LEDGER_LINEAGE_2026-10-05.md).
The first payout-lineage run also exposed that migration 303 replaced the
payment-capture resolver without its `payment_transactions` branch. Migration
305 restores capture resolution with an order-ownership check. The payout
lineage suite passes through rollback/reapply (**1/1**); the normal Gateway
checkout capture journey passes **3/3** (`20ef9b24bc66`), and the provider-
refund journey passes **11/11** (`24d4923520a5`) against migrations 304–305.
See [payout source-lineage evidence](F9_PAYOUT_SOURCE_LEDGER_LINEAGE_2026-10-05.md).
