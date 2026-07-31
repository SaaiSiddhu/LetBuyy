# Founding Merchant Program — Test Report

Verification approach: **code-only** (agreed) — TypeScript build/typecheck, governance validators, and unit + source-assertion contract tests. No live Postgres/Razorpay run, so concurrency/RLS are verified by SQL design review + contract assertions (FOR UPDATE, partial unique index, CHECK), not a live concurrency harness. Each row states exactly how it was verified.

## Automated suites (all green)

| Suite | File | Tests | Result |
|---|---|---|---|
| billing-core price lock | `packages/billing-core/test/founding-pricing.test.ts` | 8 | ✅ pass |
| billing-core (existing) | `packages/billing-core/test/billing-core.test.ts` | 10 | ✅ pass (unaffected) |
| gateway founding contract | `services/api-gateway/src/__tests__/founding.test.ts` | 11 | ✅ pass |

Run: `pnpm --filter ./packages/billing-core test` · `npx tsx --test services/api-gateway/src/__tests__/founding.test.ts`

## Coverage matrix (per spec)

| Requirement | How verified | Status |
|---|---|---|
| **Slot allocation** | Contract: adapter calls `allocate_founding_merchant` at the chokepoint, gated on `amountPaid>0`, non-fatal | ✅ |
| **Reclaim** | Contract: `reclaim_founding_merchant` wired in the Razorpay refund webhook (`reclaimFoundingOnRefund`); RPC enforces 14-day window | ✅ |
| **Idempotency** | SQL design: partial unique index `(site_id) WHERE released_at IS NULL` + replay-returns-existing; contract asserts the RPC + index | ✅ (design) |
| **Race safety** | SQL design: `SELECT … FOR UPDATE` on the singleton + `CHECK (used_slots <= total_slots)`; contract asserts `FOR UPDATE` | ✅ (design; no live concurrency run) |
| **Price lock — initial** | Unit I1: founder charged locked price, never catalog; contract: lock applied at all 4 charge sites | ✅ |
| **Renewals** | Unit: lock-applied plan → `planBillingAmountMinor` = locked; founders forced to order/mandate mode (`razorpay_plan_id` nulled) | ✅ |
| **Future catalog change** | Unit I2: catalog price raised → founder price unchanged | ✅ |
| **Upgrades / downgrades** | Unit: `resolveMerchantPricing(growth/launch, lock)` = locked target price; lock lives on `sites` so it persists | ✅ |
| **Cancellations / reactivations** | SQL design: founding columns on `sites` survive subscription cancel; re-allocation idempotent on `site_id` | ✅ (design) |
| **Public endpoints** | Contract: `/founding-program`, `/stats`, `/remaining`, `/pricing`, `/plans` exist + mounted before auth | ✅ |
| **Admin endpoints** | Contract: `/internal/founding/{overview,allocations,export,state,allocate,reclaim,repair-lock,reconcile}` | ✅ |
| **Plan availability** | Contract: `PLAN_NOT_PURCHASABLE` guard in checkout/payments/billing; seed marks scale/commerce_os `coming_soon` | ✅ |
| **Counter drift** | SQL design + contract: `remaining_slots` GENERATED column; `reconcile_founding_program()` compares counters vs active rows | ✅ |
| **LCIS integration** | Verified live: `graphify-out/merchant-intelligence.json` → `foundingProgram` block (`structuralConnected: true`, 7 RPCs, 6 events, 7 answers); `/api/founding-program` route added | ✅ |
| **Governance** | `node scripts/validate-governance.mjs` — tenant registry regenerated; founding tables outside the canonical-ledger money list | ⚠ see Implementation Report (design-system ratchet is red from PRE-EXISTING working-tree changes, not founding) |
| **Route ownership** | App routes proxy the gateway (merchant `founding/route.ts`, console `api/founding/*`, marketing `api/founding-pricing`); never DB-direct | ✅ |
| **RLS** | SQL design: ENABLE + FORCE RLS on all 3 tables; service_role + super_admin policies; `pricing_snapshots` append-only | ✅ (design) |

## Honest limitations
- No live Postgres → concurrency/idempotency/RLS are proven by SQL construction + contract assertions, not an executed concurrency test. A pgTAP/integration test is the recommended follow-up when a DB harness is available.
- Razorpay live AutoPay is sandbox-gated (`LETBUYY_AUTOPAY_MODE`); the recurring-charge lock is verified at the code path, not against the live provider.
- Founding welcome/price-lock emails are best-effort (direct Resend); delivery is not unit-tested (no Resend in tests).
