# Phase 9 payout statement retry recovery — 5 October 2026

## Result

Payout statement creation previously wrote the statement, its pending wallet
credit and any fee-assessment ledger posting as separate requests. If a required
request failed, an exact idempotent retry returned the existing statement
without repairing the missing effect. The payout route now validates an
existing wallet credit against the statement, creates the credit if absent,
posts fee assessment with its stable ledger idempotency key, and repairs the
statement's canonical-ledger link. A conflicting wallet row is rejected. An
idempotency key reused with a different payout period returns the Gateway's
standard HTTP 409 `CONFLICT` response.

The settlement executor now applies the corresponding pending-wallet-credit
recovery and resolves a concurrent stable statement creation before writing the
credit.

These are retry-repair semantics; the mandatory writes are still separate
requests and are not transactionally atomic. Phase 9/F3.7 acceptance remains
open until source eligibility, money policy, accounting ownership and all
failure/reconciliation paths are closed.

## Verification

- Real API Gateway worker + owned PostgREST/PostgreSQL 16 regression: **1/1**
  (`a8630b90d1fe`, zero failed, skipped, cancelled or TODO). The test injects a
  wallet-write failure, confirms that the original statement exists without a
  wallet credit, rejects a changed-period replay, then retries the original key
  and confirms one matching pending credit and one statement.
- Focused payout/settlement contract tests: **13/13**.
- `pnpm --filter @letbuyy/api-gateway run typecheck`: passed.
- `git diff --check`: passed.
- The suite runner disposed of its owned Postgres/PostgREST resources. No
  restored database, provider sandbox, hosted service, live payment or payout
  was used.

## Open policy and next work

The source payout route still uses a store-level commission schedule and does
not yet perform the accepted item/category-level marketplace allocation.
Storefront zero commission and marketplace category rates are directionally
accepted; exact rates and fee/tax basis remain governed by unresolved D07. Do
not use this retry repair as accounting approval. Next, finish the payout
source-to-ledger census and implement a transaction boundary for mandatory
statement, wallet and canonical fee effects without inventing fee policy; prove
equivalent recovery for settlement execution and release/reversal/reconciliation.

**Superseded later on 5 October:** migration 295 now gives new payout statement,
wallet and fee-journal writes a database transaction boundary. The stronger
owned-worker evidence, including settlement retry recovery and migration
rollback/reapply, is in [F9 atomic payout statement evidence](F9_PAYOUT_STATEMENT_ATOMICITY_2026-10-05.md).
