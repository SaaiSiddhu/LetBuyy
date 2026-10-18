# Phase 9 payout source-order ledger lineage — 5 October 2026

## Working position

Verified 5 October 2026 in the local `LetBuyy-phase2` checkout on branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD
`0862687a5008d604d0df23357b2eb511293139fa`. The checkout has extensive
pre-existing unrelated changes; these focused files remain unstaged.

## Source trace and result

Payout statements store `source_order_ids` in metadata but had no normalized
link to the canonical transactions that establish each order's money history.
The source audit found that canonical payment captures use
`source_type='payment_capture'`, a provider/payment-derived source ID, and
`metadata.order_id`. COD deposits use a separate `cod_remittance` transaction
per reconciliation entry and also carry `metadata.order_id`. Refund and
reversal transactions can carry the same order identity. Retries of one
provider capture resolve to the same canonical transaction, while an order can
have multiple distinct canonical money transactions across its lifecycle.

Migration `304_payout_statement_source_ledger_lineage.sql` adds a normalized
snapshot for each order in a payout statement and a child link for every
matching canonical `payment_capture`, `cod_remittance`, `refund` or `reversal`
transaction created by the statement timestamp. Each child records the signed
`merchant_payable` delta. The parent records order gross, aggregate signed
delta, total/origin transaction counts and a status: `linked`,
`adjustment_only`, or `missing`. A source with no canonical origin remains
visible as missing; no transaction or balance is fabricated. Existing payout
statements are backfilled idempotently. The rollback removes the capture trigger
and private routines but preserves the recorded relationship tables as audit
evidence.

The first owned run exposed a defect introduced by migration 303: its replacement
`resolve_money_ledger_source_site_id` omitted the established
`payment_transactions` capture source path. Migration 305 restores that branch
and checks that a supplied `metadata.order_id` equals the payment transaction's
actual order before accepting a capture. This preserves the existing payment
capture writer and prevents same-tenant metadata from attributing one order's
payment to another. Migration 305's paired rollback restores migration 303's
resolver; reapplication is tested.

The Gateway payout creation and detail responses now include
`source_order_lineage`, grouped by source order with the transaction IDs,
source types, timestamps and signed amounts. The relationship tables have RLS
enabled, app-role access revoked, and `service_role` read-only access; the
capture helper is unavailable to app/service roles and runs only through the
payout-statement insert trigger or the migration-owner backfill.

This is lineage capture, not a change to payout calculation or permission to
release unresolved funds. The current statement writer still calculates gross
from paid order totals. A partially refunded order can therefore have a
canonical net payable lower than its recorded source-order gross, and a paid
order with no capture/remittance source is marked `missing` without being
blocked. The exact payout eligibility and partial-refund rule remain a business
decision and must be settled before changing money amounts or release gates.

## Verification

The payout owned-Postgres/Gateway suite asserts that a paid COD order with
no canonical remittance produces explicit `missing` lineage; a source order
with a canonical capture returns a linked row with the correct transaction ID
and 10,000-paise payable delta; a same-tenant capture naming a different order
is denied; and the detail endpoint returns tenant-scoped lineage. It checks app
roles cannot read or write the new tables, rollback retains evidence, and
reapplication does not duplicate rows or remove the payment-transaction writer
path. The final owned runner passed **1/1** (run `db600042d67c`), with zero
failures, skips, TODOs or cancellations; its database, PostgREST container and
other disposable resources were cleaned successfully.

The final hermetic runner command was:

```sh
node scripts/governance/run-executable-suites.mjs --kind gateway-db --suite services/api-gateway/src/__tests__/owned-db/payout-statement-replay.postgres.test.ts --jobs 1 --log-dir /private/tmp/letbuyy-f37-payout-lineage-final --json-out /private/tmp/letbuyy-f37-payout-lineage-final.json
```

Runner ID `db600042d67c` completed the subtest with **1 pass, 0 failures** and
confirmed cleanup with no remaining container, network or volume. An earlier
reviewed run provisioned the fixture and caught migration 303's missing capture
source resolver branch; migration 305 fixes that defect. The direct test-file
invocation was correctly refused by `requireOwnedDatabase()` without runner
ownership variables and was not treated as evidence. Focused Gateway
money/settlement/payout-adapter tests pass **17/17**, Gateway typecheck passes,
migration safety/replay tests pass **4/4**, `pnpm run validate:migrations`
passes, and `git diff --check` passes.

The corrected shared resolver is also exercised through the normal Gateway
journeys against migrations 304–305:

```sh
node scripts/governance/run-executable-suites.mjs --kind gateway-db --suite services/api-gateway/src/__tests__/owned-db/checkout-browser.postgres.test.ts --jobs 1 --log-dir /private/tmp/letbuyy-f37-capture-path --json-out /private/tmp/letbuyy-f37-capture-path.json
node scripts/governance/run-executable-suites.mjs --kind gateway-db --suite services/api-gateway/src/__tests__/owned-db/payment-refund-reconciliation.postgres.test.ts --jobs 1 --log-dir /private/tmp/letbuyy-f37-refund-after-resolver --json-out /private/tmp/letbuyy-f37-refund-after-resolver.json
```

The hosted checkout capture suite passed **3/3** (`20ef9b24bc66`), including
one confirmed order, one `payment_transactions` capture, and one canonical
`payment_capture` ledger posting. The provider-refund suite passed **11/11**
(`24d4923520a5`) after the same resolver change. Both runner reports show zero
failures/skips/TODOs/cancellations, zero refused requests and successful
cleanup; the proxy observed two upstream errors in 542 forwarded checkout
requests and one in 218 refund requests, with all assertions passing.

## Next task

Resolve the payout eligibility rule for (1) paid orders with no canonical
capture/remittance, (2) canonical payable below order gross after partial
refunds, and (3) multiple origin transactions. Then implement that rule in the
same atomic statement writer, with safe handling for previously recorded
statements and test statement creation, release denial, retries and tenant
isolation. The owner has been asked to choose between fail-closed eligibility,
canonical-net calculation, or explicit review for exceptions; no answer is
recorded yet. Provider reversal/recovery policy remains separately unresolved;
no active payout-reversal writer was found. No hosted database, provider
sandbox, payout or live money movement was involved.

## 5 October merchant mobile statement detail

The merchant app now opens a read-only detail sheet from each payout statement.
It uses the existing tenant-scoped `GET /payouts/:id` response to show the
statement status/provider mode/reference, recorded gross/fee/tax/net values,
and per-order canonical payable deltas with their linked capture/refund
transactions. A missing lineage row remains visibly `missing`; the screen
does not convert it into a payable amount or decide statement eligibility.

Fresh local verification:

- The statement detail widget tests pass **2/2**, covering a capture plus
  partial-refund ledger explanation and missing-lineage display.
- The focused `MoneyService` test passes **1/1** and confirms the existing
  typed `GET /payouts/:id` client path preserves source lineage.
- Targeted Flutter analysis reports no issues; `git diff --check` passes.
- The existing owned Gateway/Postgres statement-replay journey (`db600042d67c`)
  already verifies tenant-scoped detail-route lineage readback. It was not
  rerun for this UI-only addition.

This changes statement visibility only; it does not change any amount,
eligibility, release, provider or recovery behavior. The owner decision on
missing/short lineage and partial-refund eligibility remains the next
dependency for payout calculation changes; provider reversal/recovery and
Phase 9 acceptance remain open.

## 7 October multiple-transaction lineage revalidation

The owned `payout-statement-replay.postgres.test.ts` suite now seeds a valid
synthetic payment capture and a separate succeeded partial-refund record for
one paid order, posts both through the service-role canonical ledger writer,
then creates a payout statement through the real Gateway and owned
Postgres/PostgREST. The create and tenant-scoped detail responses each retain
both source transactions: a +10,000-paise capture and -2,500-paise refund,
summing to a 7,500-paise `merchant_payable` delta. The lineage reports two
canonical transactions, one origin transaction and `linked`; a same-tenant
decoy capture attributed to another order remains excluded.

The focused owned suite passes **1/1** with zero failures, skips, cancellations
or TODOs (`c0dce10c9acc`). The runner verified ownership before execution and
removed the disposable Postgres/PostgREST resources. It forwarded 325 proxy
requests, refused none, and recorded one upstream error. `git diff --check` and
the sanitized run-record JSON parse pass. Two intermediate test iterations
exposed assertions that were too broad for the new refund projection and that
assumed timestamp-tie ordering; the final test scopes the payout-fee projection
count and selects the capture by source type. A later detail assertion was
corrected to expect the independently observed 7,500-paise lineage delta.
The final typecheck also exposed implicit-`any` tuple elements in the new
source-type ordering assertion; the tuple comparator now has explicit types,
and the subsequent Gateway typecheck passes. The package `tsx` launcher hit a
sandbox `EPERM` while creating its IPC pipe, so the independent 3/3 inventory
source-contract suite was run successfully with direct `node --import tsx
--test` instead.

This is owned local lineage evidence only. No provider refund, payout transfer,
live money movement or hosted database was used. Statement amounts continue to
use the existing gross calculation, and this test deliberately does not assert
that gross is eligible for payout. The owner decision on missing lineage and
partial-refund eligibility remains required before changing calculations or
release gates; see the [sanitized run record](F9_PAYOUT_SOURCE_LEDGER_MULTIPLE_TRANSACTIONS_OWNED_RUN_2026-10-07.json).
