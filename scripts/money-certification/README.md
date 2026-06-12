# Money Certification Scripts — Document 5

Executable evidence harnesses and invariant checks for Phase D of the LetBuyy Launch Readiness Program.

## Overview

These scripts are the repo-side deliverable of P4. They are **run by humans against the staging environment** to produce certification evidence. The live runs and the 7-day soak are human-triggered; this directory provides the harness infrastructure.

## Prerequisites

All scripts require staging environment credentials:

```sh
export STAGING_SUPABASE_URL=https://[STAGING_PROJECT_REF].supabase.co
export STAGING_SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
export STAGING_API_URL=https://api.staging.letbuyy.com
export STAGING_INTERNAL_API_SECRET=[INTERNAL_SECRET]
export STAGING_MERCHANT_SITE_ID=[UUID_OF_TEST_MERCHANT_SITE]
export STAGING_MERCHANT_AUTH_TOKEN=[MERCHANT_JWT_TOKEN]
# Optional:
export STAGING_OPERATOR_USER_ID=[OPERATOR_UUID]
export STAGING_OPERATOR_TOKEN=[OPERATOR_JWT]
export STAGING_DB_URL=postgresql://postgres:[PASS]@[HOST]:5432/postgres
```

## Scenario Harnesses (Document 5 §2)

Run individual scenarios or all 12:

```sh
node scripts/money-certification/run-scenarios.mjs         # all 12
node scripts/money-certification/run-scenarios.mjs s01 s06 # specific
```

| File | Scenario | Pass condition |
|------|----------|----------------|
| `scenarios/s01-upi-capture.mjs` | UPI order → auth → capture → ledger | SLA; capture_posted_to_ledger=true |
| `scenarios/s02-full-refund.mjs` | Card capture → full refund | Reversing entries; payable restored |
| `scenarios/s03-partial-refund.mjs` | Partial refund ×2 + over-refund attempt | Over-refund refused; partials sum correctly |
| `scenarios/s04-cod-remittance.mjs` | COD order → delivery → carrier remittance | I8; remittance reconciles to order |
| `scenarios/s05-webhook-recovery.mjs` | Capture webhook lost → reconciliation recovery | Mismatch queue catches; dual-control resolve |
| `scenarios/s06-duplicate-replay.mjs` | Duplicate webhook replay ×3 | Exactly one entry set (I6) |
| `scenarios/s07-settlement-ingest.mjs` | Settlement 2 days + cross-source duplicate | Dedupe holds (CAP-C05) |
| `scenarios/s08-payout-release.mjs` | Payout release via Route | Idempotent on retry; payable decremented once |
| `scenarios/s09-payout-failure.mjs` | Payout failure (bad beneficiary) → retry | Failure no decrement; retry releases once |
| `scenarios/s10-cross-window-refund.mjs` | Refund after settlement (cross-window) | I3 across windows; suspense cleared |
| `scenarios/s11-ai-credit-purchase.mjs` | AI-credit payment link → webhook → grant | Grant deferred until ledger evidence; distinct |
| `scenarios/s12-crash-recovery.mjs` | Mid-flow crash injection | Recovery completes post; no double entry |

Evidence JSON is written to `LAUNCH_READINESS_2026_06_12/evidence/d-money-certification/`.

## Invariant Queries (Document 5 §1)

Run against the live DB via `psql`:

```sh
export STAGING_DB_URL=postgresql://postgres:[PASS]@[HOST]:5432/postgres
node scripts/money-certification/check-invariants.mjs        # all 8
node scripts/money-certification/check-invariants.mjs i1 i4  # specific
```

| File | Invariant |
|------|-----------|
| `invariants/i1-double-entry.sql` | Every transaction: Σ(debits) = Σ(credits) |
| `invariants/i2-append-only.sql` | Reject-UPDATE/DELETE triggers enabled; no soft-deletes |
| `invariants/i3-provider-conservation.sql` | Provider-captured − refunded − fees = Σ canonical entries |
| `invariants/i4-merchant-conservation.sql` | merchant_payable = captures − refunds − payouts per merchant |
| `invariants/i5-zero-rake.sql` | platform_revenue never touched by capture/refund events |
| `invariants/i6-idempotency.sql` | No duplicate (site, source_type, source_id, key) tuples |
| `invariants/i7-single-writer.sql` | All writer_module = 'settlement' (canonical only) |
| `invariants/i8-cod-symmetry.sql` | COD remittances: cod_receivable:debit + merchant_payable:credit |

## Phase D Exit Gates

These harnesses produce evidence for the G-D1–G-D5 gates in Document 5 §4:

- **G-D1**: all 12 scenarios pass in production with evidence rows
- **G-D2**: 7-day clean soak (human-triggered and monitored)
- **G-D3**: invariant queries I1–I8 green against live DB
- **G-D4**: money alert pages tested (S5 must have actually paged)
- **G-D5**: ARB/finance sign-off row

Evidence rows are appended to `EXECUTION_LEDGER.md` as each human-triggered run completes.
