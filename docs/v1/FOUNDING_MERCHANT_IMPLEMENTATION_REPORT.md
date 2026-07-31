# Founding Merchant Program + V1 Pricing — Implementation Report

Final certification for the V1 commercial subscription launch. This is an **extension** of the existing canonical billing spine — no parallel billing system was created.

## 1. Architecture summary
- **Plans:** V1 plans (Launch ₹299/founding ₹199, Growth ₹999/founding ₹699, Scale + Commerce OS `coming_soon`) seeded into the existing `plans` catalog + `plan_entitlements`. Prices stored in **INR minor (paise)**.
- **Allocation:** one chokepoint — `SubscriptionExecutionAdapter.activateMerchantSubscription()` calls `allocate_founding_merchant()` (SECURITY DEFINER, `FOR UPDATE`, idempotent, **non-fatal**). Eligibility = `status='active' AND amount_paid>0 AND sites.trial_status='paid'`.
- **Price lock:** `resolveMerchantPricing`/`applyFoundingLockToPlan` (billing-core) applied at every charge site; founders forced to server-authoritative order/mandate mode (`razorpay_plan_id` nulled). Lock lives on `sites` → survives renewal/upgrade/downgrade/cancel/reactivate.
- **Reclaim:** `reclaim_founding_merchant()` (≤14-day window) wired into the Razorpay subscription-refund webhook + admin recovery.
- **Surfaces:** public gateway endpoints (pre-auth) → marketing flag-gated pricing + live counter; merchant `FoundingMerchantCard`; platform-console admin + recovery; LCIS founding intelligence.

## 2. Research findings (gating docs — written before code)
- [`FOUNDING_ALLOCATION_DEFINITION.md`](./FOUNDING_ALLOCATION_DEFINITION.md) — the single canonical eligibility predicate.
- [`FOUNDING_MERCHANT_RESEARCH.md`](./FOUNDING_MERCHANT_RESEARCH.md) — existing billing architecture map + gaps closed.
- [`PRICE_LOCK_ARCHITECTURE.md`](./PRICE_LOCK_ARCHITECTURE.md) — renewal model + enforcement design.
- [`PRICE_LOCK_VERIFICATION.md`](./PRICE_LOCK_VERIFICATION.md) — per-path proof of I1/I2.

## 3. Renewal architecture
Charge amount is computed by `planBillingAmountMinor` at 4 sites (`subscription-checkout.ts`, `payments.ts` verify, `billing.ts` subscribe + mandate). Each now resolves the founding lock first (`resolveFoundingCheckoutLock`) and feeds a lock-applied plan. Native Razorpay subscriptions (catalog-priced `razorpay_plan_id`) are **disabled for founders** — they use order/mandate mode so the locked amount is always charged, every cycle.

## 4. Price-lock verification
- **I1 (no catalog charge for founders):** proven by unit test + the single-override-point design.
- **I2 (catalog changes don't affect founders):** proven by unit test — founder price columns are written once at allocation and never by any catalog-change path. Full proof in `PRICE_LOCK_VERIFICATION.md`.

## 5. Files
**Migrations (6):** `176_v1_founding_program_schema.sql`, `177_v1_founding_program_rpcs.sql`, `178_v1_pricing_plans_seed.sql` + matching rollbacks.
**DB objects:** tables `founding_merchant_program`, `founding_merchant_allocations`, `pricing_snapshots`; `sites` + `plans` additive columns; expanded `subscriptions.plan` CHECK; RPCs `allocate_founding_merchant`, `reclaim_founding_merchant`, `get_founding_program_public`, `set_founding_program_state`, `resolve_merchant_locked_price`, `reconcile_founding_program`, `admin_repair_price_lock`, `emit_founding_event`.
**billing-core:** `SubscriptionTier` + tiers extended; `resolveMerchantPricing`, `applyFoundingLockToPlan`, `resolvePlanPublicPricing` (+ tests).
**gateway:** adapter allocation hook; `lib/founding-pricing.ts`, `lib/founding-merchant-email.ts`; routes `founding-public.ts`, `founding.ts`, `internal-founding.ts`; price-lock + `PLAN_NOT_PURCHASABLE` in `subscription-checkout.ts`/`payments.ts`/`billing.ts`; mounts in `index.ts`.
**webhook-service:** automated reclaim in the refund handler.
**api-client:** `foundingProgram` + `foundingAdmin` typed groups.
**apps:** merchant `FoundingMerchantCard` + proxy + dashboard/billing renders; platform-console founding admin page + controls + proxy routes + nav; marketing flag-gated `Pricing` + `api/founding-pricing` proxy.
**LCIS:** `merchant-intelligence.mjs` founding block + `server.mjs` `/api/founding-program`.

## 6. Tests added
- `packages/billing-core/test/founding-pricing.test.ts` — 8 tests (I1, I2, public pricing, lock application, tiers). ✅
- `services/api-gateway/src/__tests__/founding.test.ts` — 11 contract tests (chokepoint, public-before-auth, routes, guards, price-lock, reclaim, RPCs, migrations, api-client). ✅
- Full matrix in [`FOUNDING_PROGRAM_TEST_REPORT.md`](./FOUNDING_PROGRAM_TEST_REPORT.md).

## 7. Governance status
`node scripts/validate-governance.mjs`: **tenant isolation PASS** (262 tenant tables registered incl. founding; 0 bypasses), foundation/production-safety/session-security/operational-lifecycle **PASS**. Founding tables are outside the canonical-ledger money-table list (verified). **Design-system ratchet: RED — but entirely from PRE-EXISTING uncommitted working-tree changes** (identity-platform, merchant-control-plane globals.css, `@letbuyy/ui` package — all modified before this work). My contribution is **net-zero design drift** (`tsxArbitraryRadius` returned to 329 after I converted my 4 arbitraries to `rounded-lg`; no app CSS/TSX drift added). This gate cannot go green until the pre-existing drift is resolved by its owner; it is not caused by the founding program.

## 8. Build status (all green)
| Target | Result |
|---|---|
| billing-core build + test (18) | ✅ |
| api-client build | ✅ |
| api-gateway typecheck + contract tests (11) | ✅ |
| webhook-service typecheck | ✅ |
| merchant-control-plane typecheck + `next build` | ✅ |
| platform-console typecheck + `next build` (founding routes built) | ✅ |
| marketing-site typecheck + `next build` | ✅ |

## 9. LCIS integration status
`graphify-out/merchant-intelligence.json` → `foundingProgram` block: **structuralConnected: true** (all 3 tables + `allocate_founding_merchant` RPC indexed after `graph:db`); 7 RPCs, 6 events, 7 plain-language answers; live counts/revenue/conversion marked **NOT CONNECTED** with exact sources (live-data law honored — nothing fabricated). Served at LCIS `/api/founding-program`.

## 10. Launch readiness verdict
**GO for staged rollout**, with `NEXT_PUBLIC_FOUNDING_PUBLIC_LIVE` **off** by default (public prices hidden until flipped). Backend, merchant dashboard, admin, LCIS, and APIs are production-ready and verified code-only. Required before flipping public + taking live payments: apply migrations 176–178 to the DB, run an integration/concurrency test against a real Postgres, and resolve the pre-existing design-system drift so the gate is green.

## 11. Known risks
1. **No live concurrency test** — race-safety proven by SQL design (`FOR UPDATE` + partial unique + CHECK), not an executed harness. Add pgTAP/integration before public launch.
2. **Live UPI AutoPay sandbox-gated** — recurring lock verified at code path, not against live Razorpay (HUMAN-REQUIRED gate already present).
3. **Pre-existing design-system ratchet red** — blocks the governance gate; not founding-caused.
4. **Welcome emails best-effort** — direct Resend, no retry; consider an outbox consumer if delivery guarantees are needed.
5. **Admin actor attribution** — console mutations record `actor_type='super_admin'` but actor id pass-through (X-Admin-User-Id) is not yet wired from the console session.

## 12. Operational runbooks
- **Pause / resume / disable program:** platform-console → Founding Merchants → controls (→ `set_founding_program_state`). Allocations no-op while paused; paid subscriptions still succeed at regular price.
- **Counter drift:** controls → "Reconcile & repair" (`reconcile_founding_program(p_repair:=true)`); returns healthy|mismatch|repaired.
- **Refund reclaim:** automatic on Razorpay subscription refund ≤14 days; manual via console → "Manual reclaim" (force bypasses 14d).
- **Price-lock drift repair:** console → "Repair price lock" (`admin_repair_price_lock`) re-syncs `sites` lock from the allocation row.
- **Manual allocation recovery:** console → "Manual allocate" (force) if the automatic hook missed an eligible paid merchant.
- **Rollback:** apply `database/supabase/rollback/17{6,7,8}_*.rollback.sql` (pre-launch only — post-allocation rollback discards founder data).
