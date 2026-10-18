# F3.7 / Phase 9 money reconciliation RPC privileges — 5 October 2026

## Result

Migration 302 removes default `PUBLIC` execute access from four `SECURITY
DEFINER` helpers created by migration 160 and the payout-release claim RPC
maintained through migration 294:

- `backfill_wallet_ledger_to_canonical(uuid)` can write canonical ledger rows
  across sites when called without a site filter.
- `refresh_money_ledger_site_reconciliation(uuid)` returns tenant money balances.
- `assert_money_ledger_site_reconciliation(uuid)` refreshes and returns the
  corresponding reconciliation result.
- `claim_payout_statement_release(uuid,uuid,text,uuid)` can claim a payout and
  accepts its actor id as an argument.

The refresh, assert and payout-claim RPCs remain executable by `service_role`,
which owns their current server-side call paths. The cross-site backfill has no
active application caller and is restricted to the privileged migration
owner. No client role or application service role can invoke the backfill.

The paired rollback intentionally restores the pre-migration `PUBLIC` grants so
the local migration-pair test can verify reversibility. That rollback reopens
the vulnerabilities above and is unsuitable for a hosted or production rollback;
use a forward privilege correction there.

## Verification

`pnpm run test:foundation:wave1` passed: **25/25** focused source tests and
**1/1** executable PostgreSQL test. The database test first confirms the
pre-migration calls can cross tenant boundaries, expose reconciliation balances,
and claim a payout; it rolls those probe transactions back, applies migration
302, verifies API roles are denied, confirms `service_role` can still refresh,
assert and claim, confirms it cannot invoke the all-sites backfill, then
exercises rollback and reapplication. Expected permission and business
rejections are negative controls in the passing test.

`pnpm run validate:migrations` passed, and `git diff --check` passed. The suite
used only the disposable local PostgreSQL fixture; no hosted database, external
provider, payout or live money movement was involved. The changes remain local
to the `LetBuyy-phase2` worktree at source HEAD
`0862687a5008d604d0df23357b2eb511293139fa`.

## Remaining work

This closes only the direct RPC privilege gap. The broader F3.7 source-to-ledger
census remains open, including historical payout-credit writers, reversal paths
and canonical source linkage. Phase 9 still requires provider reconciliation,
weekly eligibility and controlled recovery for ambiguous outcomes. See the
[F3.7 ledger contract](F3_7_LEDGER_IDEMPOTENCY_CONTRACT_2026-10-05.md) and
[Phase 9 payout claim evidence](F9_PAYOUT_CLAIM_RESERVATION_2026-10-05.md).
