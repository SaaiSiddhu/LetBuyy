# 02 — COMPLETE MERCHANT FEATURE INVENTORY

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.
Generated/LCIS claims are hypotheses here; only direct source, executed commands, or cited
`path:line` count as evidence.

---

## 1. How to read this

188 merchant-facing capabilities were inventoried by 12 specialised read-only forensic auditors
working in parallel over `bf35062e`, each required to cite `path:line` or command output for every
claim. Scores use the model in [`00_README_AND_AUTHORITY.md`](00_README_AND_AUTHORITY.md):

`10` reachable UI · `8` states/a11y · `10` client integration · `8` typed contracts + validation ·
`12` gateway/BFF/domain · `12` persistence + RLS/FORCE/GUC · `10` invariants/authz/idempotency ·
`8` storefront/async/provider effects · `14` automated test evidence · `8` observability/deploy/rollback.

**Hard caps dominate the results.** The most consequential is *no automated happy-path integration
test ⇒ maximum 69*. A skipped test contributes zero. A flag-off or unreachable route cannot be
launch-proven.

Bands: `0-9` NOT_STARTED · `10-29` SCAFFOLD_ONLY · `30-49` PARTIAL ·
`50-69` INTEGRATED_BUT_NOT_V1_CANDIDATE · `70-84` V1_CANDIDATE ·
`85-99` RELEASE_CANDIDATE_WITH_GAPS · `100` LAUNCH_PROVEN.

> **These scores are the auditors' first pass.** Every capability scoring ≥ 70 was subsequently
> subjected to adversarial falsification; the corrected scores are in
> [`03_70_PERCENT_PLUS_V1_CANDIDATES.md`](03_70_PERCENT_PLUS_V1_CANDIDATES.md) and govern where they
> differ. Treat this document as the breadth map and doc 03 as the authority on the top of the range.

## 2. The distribution — the honest headline

| Band | Range | Count |
|---|---|---:|
| NOT_STARTED | 0–9 | 6 |
| SCAFFOLD_ONLY | 10–29 | 39 |
| PARTIAL | 30–49 | 46 |
| INTEGRATED_BUT_NOT_V1_CANDIDATE | 50–69 | 78 |
| V1_CANDIDATE | 70–84 | 18 |
| RELEASE_CANDIDATE_WITH_GAPS | 85–99 | 1 |
| LAUNCH_PROVEN | 100 | **0** |
| **Total** | | **188** |

**Mean score: 45.5. Nothing scores above 89. Nothing is launch-proven.**

The shape matters more than the mean. The largest single cluster — **78 capabilities at 50–69** —
is the defining fact about this repository: a great deal of real, wired, tenant-aware code that
**cannot be proven to work** because it has no executing integration test. That is a *verification*
deficit far more than a *construction* deficit, and it is why the V1 answer is to freeze a small
scope and prove it, not to build more.

The 6 NOT_STARTED and 39 SCAFFOLD_ONLY entries are mostly capabilities that were never in scope for
a first release (marketplace, extensions, multi-location, subscriptions) plus the genuinely absent
launch essentials registered in
[`04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md`](04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md) —
most importantly **in-app account deletion** and the **iOS privacy manifest**, both of which are
absolute store-submission blockers and both of which are at zero.

## 3. Cross-cutting findings that depress scores platform-wide

| # | Finding | Effect |
|---|---|---|
| X-1 | **The merchant app's only integration test never runs.** `integration_test/merchant_happy_path_test.dart:123` is `skip: !AppConfig.hasTurnstileToken`, and `TURNSTILE_TOKEN` is the sentinel `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN` in both dart-define files. | Caps **every** mobile capability at 69 |
| X-2 | **No CI runs on the active branch.** `ci.yml:3-11` triggers only on `develop`/`main`; the integration branch is `stepup/main`. Branch lag: 106 vs `main`, 291 vs `origin/main`. | Caps observability/deploy points everywhere; nothing is deployed |
| X-3 | **The governance gate is red and fail-fast.** It aborts at validator 5 of 108, so 102 validators never run. | Unknown further failures are masked |
| X-4 | **Storefront host routing is dead code.** `apps/storefront-runtime/src/middleware.ts` does not exist and nothing invokes `proxy()`, though `proxy.ts:61` exports a Next.js `config.matcher`. | Every buyer-visible capability is unreachable by subdomain/custom domain |
| X-5 | **`sites.published` has readers but no writer.** `proxy.ts:380,392` denies unless `published` **and** `status==='published'`; the publish paths wrote only `status`. Fixed by this program (`stores.ts`). | Would have 401'd every storefront the moment X-4 was fixed |
| X-6 | **Route aliasing defeats navigation-level gating.** 91 registered routes, 36 of them `/features/*` aliases; 31 screens are reachable by 2–3 distinct paths (`AppsScreen` by three). | Any V1 exclusion must gate at route resolution, not navigation |

## 4. Full inventory by audit slice

Sorted by score within each slice. "Cap applied" names the hard cap that limited the score.

### LCIS Reconciliation Auditor  (12 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Shopper registration end-to-end (LCIS blocker LB-12) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | services/api-gateway/src/routes/storefront/customer-registration.ts +  | No automated happy-path integration test => max 69; the exis | tests/launch/lb12-registration.test.mjs (91 lines, readFileSync + asse |
| Appearance bridge sites.site_settings → storefront tokens (LCIS blocker LB-9) | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | services/api-gateway/src/routes/storefront.ts + apps/storefront-runtim | No automated happy-path integration test => max 69 | tests/launch/lb9-appearance-bridge.test.mjs (31 lines, source-text reg |
| Announcement bar storefront section (LCIS blocker LB-8) | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | HIDE_OR_GATE | apps/storefront-runtime/src/components/layout/announcement-bar.tsx + r | No automated happy-path integration test => max 69; further  | tests/launch/lb8-announcement-bar.test.mjs (58 lines) — run by test:be |
| LCIS compliance engine R001-R008 | 40 | PARTIAL | DEFER | packages/lcis-governance (invoked via `pnpm lcis compliance`) | Backend exists but no persistent tenant-safe path (its own R | NONE — no test asserts R001/R004 precision against known-good source |
| LCIS live adapters + live-source honesty contract | 34 | PARTIAL | V1_CANDIDATE | packages/lcis-live (invoked via `pnpm lcis live adapters\|health\|stat | Mock/absent data source => cannot exceed a partial score; no | NONE executed here — no adapter could be probed without credentials |
| LCIS structural code graph (graphify-out/graph.json) | 32 | PARTIAL | HIDE_OR_GATE | tools/graph-server/refresh-graph.mjs + packages/lcis-core/src/graph/Gr | No automated happy-path integration test => max 69; further  | NONE — no test in packages/lcis-core/test asserts graph freshness or g |
| Canonical money ledger tenant isolation (ledger_accounts / ledger_transactions / ledger_en | 30 | PARTIAL | MANDATORY_V1 | database/supabase/migrations/139_executable_foundation_ledger_core.sql | Known S0/S1 security defect => not launchable regardless of  | tests/executable/money-ledger-postgres.test.mjs (append-only + paralle |
| Merchant mobile app (Flutter) automated evidence — 'mobile' domain of this slice | 30 | PARTIAL | V1_CANDIDATE | apps/mobile/merchant-app | No automated happy-path integration test for the majority of | apps/mobile/merchant-app/test/{mobile_services,merchant_goldens,analyt |
| Governance gate (`pnpm validate:governance --lane=gate`, LCIS's '107/107 green') | 28 | SCAFFOLD_ONLY | MANDATORY_V1 | scripts/validate-governance.mjs | Feature flag OFF or unreachable => cannot be launch-proven;  | tests/governance/phase-b-validators.test.mjs exists but exercises vali |
| Executable Postgres tenant red-team (CAP-C11) — the repo's only real RLS proof | 25 | SCAFFOLD_ONLY | MANDATORY_V1 | tests/executable/tenant-redteam-postgres.test.mjs | Skipped/never-executed test contributes ZERO to continuous e | tests/executable/tenant-redteam-postgres.test.mjs — exists, is real, i |
| LCIS decision engine — launch verdict, blockers LB-7..LB-12, risk ranking | 24 | SCAFFOLD_ONLY | HIDE_OR_GATE | packages/lcis-core/src/decision/DecisionService.ts + graphify-out/exec | Generated report without direct verification contributes ZER | packages/lcis-core/test/decision.test.ts:118-149 asserts LB-8 ranks fi |
| RLS FORCE coverage governance ratchet (rls-force-coverage-validator) | 8 | NOT_STARTED | MANDATORY_V1 | scripts/validators/rls-force-coverage-validator.mjs | UI/route only equivalent — the enforcement surface exists bu | tests/governance/phase-b-validators.test.mjs:147 — a self-test that in |

### Commerce Core  (29 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Inventory reservations + oversell prevention | 72 | V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/141_executable_inventory_reservations.sql | Happy path but no failure/security verification => N/A (fail | tests/executable/inventory-postgres.test.mjs:189 (real Postgres, verif |
| Reservation expiry sweeper (scheduled) | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/queue-workers/src/inventory-reservations.ts + src/index.ts sc | No automated happy-path integration test of the scheduled wi | tests/executable/inventory-postgres.test.mjs:189 covers expire_invento |
| Products — list / create / edit / delete (soft) / archive / bulk | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/products.ts + src/execution/product-ex | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/products.test.ts (source-regex, con |
| Gift cards — issuance, redemption, balance, status, refund restore — prior claim (e) | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/gift-cards.ts (mounted on /products/gi | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/money-b3-b5-convergence.test.ts, mo |
| Product variants (matrix create/update/diff) — prior claim (a) | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/execution/product-execution.adapter.ts replac | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/products.test.ts (source-regex); NO |
| Order status transitions | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/execution/order-execution.adapter.ts transiti | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/orders-v1.test.ts (source-regex); t |
| Coupons — CRUD, discount types, usage limits, checkout application | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/coupons.ts + evaluate_checkout_promoti | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/discounts.test.ts (11/17 source-reg |
| Media upload (R2) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/upload.ts + routes/media.ts | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/upload.security.test.ts, media-libr |
| Inventory levels + adjustments + bulk adjust + history/receipts | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/inventory.ts | No automated happy-path integration test => max 69 | tests/executable/inventory-postgres.test.mjs (RPC-level, real Postgres |
| Order cancellation | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/orders.ts:1142 (status='cancelled' bra | No automated happy-path integration test => max 69 | NONE executing (mobile test is MockClient) |
| Product options | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/execution/product-execution.adapter.ts replac | No automated happy-path integration test => max 69 | NONE executing |
| Orders — list + detail | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/orders.ts | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/orders-v1.test.ts (100% source-rege |
| Product import (CSV) | 55 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | services/api-gateway/src/routes/export.ts POST /import-products | No automated happy-path integration test => max 69 | NONE executing |
| Customers — list / detail / search / history / notes / tags / addresses / merge / export | 54 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/customers.ts | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/customer-pagination.test.ts, custom |
| Fulfillment + tracking + shipping labels | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/orders.ts:1292 + routes/shipping-label | Required provider mock-only without honest V1 mock/sandbox p | services/api-gateway/src/__tests__/shipping-labels.test.ts (source-reg |
| COD lifecycle (confirmation, timeout, reconciliation) | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/order-risk.ts + routes/cod-reconciliat | Required provider mock-only with honest sandbox decision =>  | services/api-gateway/src/__tests__/orders-v1.test.ts (source-regex) |
| Collections (manual) + collection_products write path — prior claim (b) | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/products.ts (collections sub-routes) | No automated happy-path integration test => max 69 | NONE executing |
| Inventory locations / suppliers / purchase orders / transfers | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | DEFER | services/api-gateway/src/routes/inventory.ts | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart:2643/2681/2727 |
| GST — place of supply, CGST/SGST/IGST split, HSN, invoices — prior claim (d) | 48 | PARTIAL | MANDATORY_V1 | packages/checkout-core/src/index.ts (generateGstInvoice/calculateGstLi | Happy path but no failure/security verification => max 84; N | tests/gst/gst-invoice.test.mjs (3 EXECUTED tests of the pure function  |
| Customer segments | 46 | PARTIAL | DEFER | services/api-gateway/src/routes/customers.ts:497-660 | No automated happy-path integration test => max 69 | NONE executing |
| Shipping zones + rates (merchant configuration) | 44 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/shipping-tax.ts | Backend exists but no persistent tenant-safe path to the buy | services/api-gateway/src/__tests__/shipping-tax.test.ts (28/28 source- |
| Smart collections | 42 | PARTIAL | DEFER | services/api-gateway/src/routes/smart-collections.ts | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/smart-collection-eval.test.ts (sour |
| Catalog/order/customer search, filter, sort, pagination | 38 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/products.ts:440 / orders.ts:542 / cust | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/customer-pagination.test.ts (source |
| Returns / RMA | 34 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/returns.ts | Known S0/S1 security defect => not launchable regardless of  | services/api-gateway/src/__tests__/returns.test.ts (13/13 source-regex |
| Order refund (merchant-initiated + completion) | 32 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/orders.ts:1427 (intent) + :1342 (compl | Known S0/S1 security defect => not launchable regardless of  | services/api-gateway/src/__tests__/money.test.ts (87/87 source-regex a |
| Shipping applied at checkout (merchant rates → buyer → order) — prior claim (c) | 25 | SCAFFOLD_ONLY | MANDATORY_V1 | database/supabase/migrations/170_v1_shipping_rates_gst.sql create_chec | Real UI + client but no working backend contract => max 35;  | services/api-gateway/src/__tests__/shipping-tax.test.ts, checkout.test |
| Pincode serviceability + COD eligibility | 22 | SCAFFOLD_ONLY | HIDE_OR_GATE | services/api-gateway/src/routes/shipping.ts:90 GET /serviceability/:pi | Mock service returning fabricated data => max 25 | services/api-gateway/src/__tests__/shipping.test.ts (29/29 source-rege |
| Automatic discounts + discount combination (combines_with / discount_class / priority) | 16 | SCAFFOLD_ONLY | DEFER | NONE — no runtime owner | Schema/DDL exists but no verified live writer AND reader =>  | packages/checkout-core/test/checkout-core.test.ts:100,:138 (pure-funct |
| Commerce test evidence (cross-cutting) | 12 | SCAFFOLD_ONLY | MANDATORY_V1 | services/api-gateway/src/__tests__ (80 files) + tests/ + .github/workf | Skipped test contributes ZERO; source-regex 'test' is not di | tests/executable/inventory-postgres.test.mjs (PASSES, real Postgres, n |

### Database Schema Migrations Rls Tenancy  (8 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Canonical money RPCs - SECURITY DEFINER, idempotency, locking | 71 | V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/139, 151, 160, 165, 166, 168, 170, 173, 1 | Happy path but no failure/security verification => max 84 | tests/executable/money-ledger-postgres.test.mjs (real PG, migration 13 |
| Tenant-table indexing on site_id / store_id | 63 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | database/supabase/migrations/000_baseline.sql + 110_fk_hygiene_and_ord | NONE | NONE - no test or validator asserts index coverage on tenant columns. |
| Tenant RLS schema coverage (ENABLE / FORCE / tenant-GUC policy) | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/164_d4_tenant_role_guc.sql + 139_executab | Happy path but no failure/security verification against the  | tests/executable/tenant-redteam-postgres.test.mjs (real PG, synthetic  |
| Ephemeral Postgres harness + executable DB test evidence | 54 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | scripts/governance/foundation-ephemeral-postgres.mjs + tests/executabl | Skipped test contributes ZERO (theme-tenant-isolation, human | tests/executable/{billing,checkout,discount,email,foundation-reference |
| Migration set integrity and rollback pairing (MIG-R3) | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/** + database/supabase/rollback/** | No automated happy-path integration test for the full migrat | tests/migrations/migration-safety.test.mjs, tests/migrations/v2-migrat |
| Canonical-ledger-only rule in TypeScript (no direct money-table writes) | 33 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/** + services/queue-workers/src/** | Backend exists but no persistent tenant-safe path => max 50 | NONE - no test asserts that a money table is unwritable from the gatew |
| Runtime tenancy enforcement - gateway DB connection role (SEC-R9) | 30 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/lib/supabase.ts + src/lib/tenant-context.ts + | Backend exists but no persistent tenant-safe path => max 50; | services/api-gateway/src/__tests__/tenant-load-bearing-d4.test.ts:39 a |
| Permissive / PUBLIC RLS policy hygiene (SEC-R6) | 28 | SCAFFOLD_ONLY | MANDATORY_V1 | database/supabase/migrations/000_baseline.sql + 107 + 163 + 196 | Known S0/S1 security defect => not launchable regardless of  | tests/executable/security-rls-hardening-postgres.test.mjs:150 covers m |

### Deployment Infrastructure Environments Operations Auditor  (11 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Frozen-app and reserved-service containment (ART-19 / ART-22) | 74 | V1_CANDIDATE | MANDATORY_V1 | scripts/validators/deploy-matrix-topology-validator.mjs + config/runti | NONE | tests/operations/deployment-safety.test.mjs, tests/contracts/manifest- |
| Cloudflare Worker runtime configuration (wrangler) | 71 | V1_CANDIDATE | MANDATORY_V1 | services/{api-gateway,webhook-service,queue-workers,mobile-bff}/wrangl | NONE | tests/cloudflare/cloudflare-binding-governance.test.mjs (passes); serv |
| Local development environment | 70 | V1_CANDIDATE | V1_CANDIDATE | scripts/dev/setup-local-env.mjs + scripts/dev/ports.mjs | NONE | NONE directly; docs/LOCAL_DEV.md referenced at scripts/dev/ports.mjs:6 |
| Queue consumers, producers and scheduled/cron handlers | 68 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/queue-workers/src/index.ts + services/api-gateway/src/executi | No automated integration test of an end-to-end enqueue->cons | services/queue-workers/test/*.test.mjs, services/api-gateway/src/__tes |
| Production deploy pipeline (workers + Vercel apps + migrations) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | .github/workflows/production-deploy.yml | No verified live production run in 2 months; happy path but  | tests/operations/production-deploy-workflow.test.mjs, tests/operations |
| Environment + secret contract (names, ownership, provisioning) | 57 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | config/env/staging-production-secret-matrix.json + scripts/github/set- | NONE | tests/contracts/manifest-lineage-governance.test.mjs; validators above |
| CI quality gate (typecheck / lint / unit / contract / Flutter / build) | 38 | PARTIAL | MANDATORY_V1 | .github/workflows/ci.yml | Feature flag OFF or unreachable route => cannot be launch-pr | tests/operations/production-deploy-workflow.test.mjs (14 passing stati |
| DNS / edge routing | 37 | PARTIAL | MANDATORY_V1 | infrastructure/dns/dns.tf | Declared config with no verified apply path => max 50 | NONE |
| Rollback (deploy, migration, feature-flag) | 36 | PARTIAL | MANDATORY_V1 | infrastructure/scripts/deploy/production-rollback.mjs + config/runtime | Schema/contract exists but no verified executor for migratio | tests/operations/rollback-lineage-governance.test.mjs (passes — assert |
| Observability, monitoring and crash reporting | 31 | PARTIAL | MANDATORY_V1 | Cloudflare native observability + infrastructure/observability/** | Config artifacts with no verified live writer AND reader =>  | NONE that proves a metric or trace reaches a backend |
| Staging deploy pipeline | 22 | SCAFFOLD_ONLY | MANDATORY_V1 | .github/workflows/deploy-staging.yml (active) + staging-deploy.yml + s | Mock/no-op path reporting success => max 25 | NONE for deploy-staging.yml. tests/operations/production-deploy-workfl |

### Evidence  (9 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Production deploy lane (.github/workflows/production-deploy.yml) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | .github/workflows/production-deploy.yml | HAPPY_PATH_BUT_NO_FAILURE_VERIFICATION (max 84) — actual sco | tests/e2e/ via production-deploy.yml:198 and tests/e2e/smoke/ via :515 |
| Governance validator gate (scripts/validate-governance.mjs) | 54 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | scripts/validate-governance.mjs, scripts/validators/** | NONE | scripts/validators/*.mjs (112 files); executed in GitHub Actions run 2 |
| CI merge gate (.github/workflows/ci.yml) | 41 | PARTIAL | MANDATORY_V1 | .github/workflows/ci.yml | FEATURE_FLAG_OFF_OR_UNREACHABLE — the gate is unreachable fr | ci.yml itself; GitHub Actions runs 27188393935 (executed, failed on mi |
| Mobile merchant release pipeline (Flutter) | 36 | PARTIAL | MANDATORY_V1 | .github/workflows/mobile-merchant-release.yml, apps/mobile/merchant-ap | MOCK_SERVICE_RETURNING_FABRICATED_DATA applies to the integr | apps/mobile/merchant-app/test/mobile_services_test.dart, merchant_gold |
| Automated test evidence for product code (unit/integration) | 31 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/__tests__, tests/**, packages/*/test | NO_AUTOMATED_HAPPY_PATH_INTEGRATION_TEST (max 69) — actual s | tests/executable/money-ledger-postgres.test.mjs, tests/executable/inve |
| Deploy execution history / release evidence | 22 | SCAFFOLD_ONLY | MANDATORY_V1 | GitHub Actions (SaaiSiddhu/Letbuyy_Store) | GENERATED_REPORT_WITHOUT_DIRECT_VERIFICATION does not apply  | GitHub Actions run logs 27188393935, 30664883269, 27189338043, 2696852 |
| End-to-end / vertical-slice test coverage (Playwright) | 19 | SCAFFOLD_ONLY | MANDATORY_V1 | tests/e2e/**, playwright.config.ts | SKIPPED_TESTS_CONTRIBUTE_ZERO + NO_AUTOMATED_HAPPY_PATH_INTE | tests/e2e/smoke/release-gates.spec.ts (partial, conditional); all othe |
| Staging deploy lane (.github/workflows/deploy-staging.yml) | 13 | SCAFFOLD_ONLY | MANDATORY_V1 | .github/workflows/deploy-staging.yml | MOCK_OR_NOOP_PATH (silent SKIP reported as success) | NONE — this lane runs no tests |
| Branch lag / release integration state (DEPLOY-R1) | 0 | NOT_STARTED | MANDATORY_V1 | git refs; scripts/validators/branch-lag-guard-validator.mjs; .github/w | FEATURE_FLAG_OFF_OR_UNREACHABLE — production deploy cannot p | NONE |

### Gateway Bff Contracts  (11 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Gateway/BFF observability, deployment and rollback readiness | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/middleware/observability.ts + wrangler.toml ( | NONE | services/api-gateway/src/__tests__/observability.test.ts and observabi |
| Mobile screen -> Flutter service -> endpoint -> handler traceability | 63 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/** (64 screens) -> lib/services/* | No automated happy-path integration test => max 69 | packages/dart/api_client/test/api_client_test.dart, packages/dart/api_ |
| Mobile BFF composite + proxy (services/mobile-bff) | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/mobile-bff/src/index.ts (511 LOC, Hono on Cloudflare Workers) | No automated happy-path integration test => max 69 | services/mobile-bff/test/session-token.test.ts (8 cases, all passing;  |
| Idempotency on mutation / money endpoints | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/middleware/idempotency.ts (protectedMutationI | Happy path but no failure/security verification => max 84 | services/api-gateway/src/__tests__/idempotency.test.ts — readFileSync  |
| API Gateway HTTP route surface (services/api-gateway/src/routes/**) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway (Hono modular monolith, mounted in src/index.ts:7 | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/ (80 files, 551 cases). Only 7 file |
| Merchant / customer auth verification chain (ES256 vs HS256, BFF verify-only) | 55 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/middleware/auth.ts (authMiddleware) + src/lib | Happy path but no failure/security verification => max 84 | services/api-gateway/src/__tests__/identity-issuer-d3.test.ts (execute |
| List-endpoint pagination (CODE-R4) | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/lib/supabase.ts:40 paginated() / :83 cursorPa | NONE | services/api-gateway/src/__tests__/customer-pagination.test.ts (execut |
| Tenant authorization + site-ownership enforcement | 48 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/lib/auth-user.ts:40 verifySiteOwnership + src | NONE | services/api-gateway/src/__tests__/tenant-isolation.test.ts and tenant |
| Inbound payload validation (Zod schemas, services/api-gateway/src/schemas/**) | 45 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/middleware/validation.ts + src/schemas/*.sche | NONE | Schema shape is asserted only by source-text regex, e.g. services/api- |
| Shared typed contracts (TypeScript <-> Dart) | 45 | PARTIAL | MANDATORY_V1 | packages/shared-types/src/index.ts (4856 lines) consumed by 65 gateway | NONE | packages/dart/models/test/shared_contracts_conformance_test.dart (23 s |
| Automated test evidence for gateway + mobile-bff | 30 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/__tests__/** (80 files) + tests/contracts/**  | No automated happy-path integration test => max 69; and sour | Executed: services/api-gateway/src/__tests__/*.test.ts (551/7 fail), t |

### Governance And Scope  (9 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Evidence-package placement law (root markdown budget + program-directory convention) | 78 | V1_CANDIDATE | MANDATORY_V1 | scripts/validators/whole-repo-end-state-validator.mjs:16-38 | NONE | tests/governance/whole-repo-end-state.test.mjs — 2/2 pass, asserts the |
| Constitutional decision-class escalation (Class A / B / C) | 74 | V1_CANDIDATE | MANDATORY_V1 | GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md §11-§14 | NONE | NONE |
| Foundation freeze instrument + ARB freeze-exception protocol | 72 | V1_CANDIDATE | MANDATORY_V1 | LAUNCH_READINESS_2026_06_12/FOUNDATION_FREEZE_CERTIFICATION.md (Doc 1, | NONE | NONE — no validator or test asserts freeze-exception compliance; enfor |
| Human-seam supersession register (SKIPPED_HUMAN_DECISIONS + CAPABILITY_BACKLOG + EXECUTABL | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | SKIPPED_HUMAN_DECISIONS.md (SKIP-*), CAPABILITY_BACKLOG.md (CAP-C*), E | No automated happy-path integration test (max 69) | tests/governance/whole-repo-end-state.test.mjs (covers presence/duplic |
| Prompt supersession / change-control registry (PROMPTS.md + prompt-perimeter-validator) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | PROMPTS.md (registry) + scripts/validators/prompt-perimeter-validator. | No automated happy-path integration test (max 69) | NONE — `grep -rln "prompt-perimeter" tests/` returns no test file; tes |
| V1 launch-scope authority (LETBUYY_V1_SCOPE_LOCK) — the MANDATORY/FORBIDDEN feature lists | 47 | PARTIAL | MANDATORY_V1 | V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md (report-class eviden | Generated report without direct verification contributes ZER | tests/launch/*.test.mjs (75 assertions per V1_LAUNCH_EXECUTION_REPORT. |
| apps/mobile/merchant-app as a V1 launch capability | 44 | PARTIAL | DEFER | apps/mobile/merchant-app (Flutter) — canonical winner for the Mobile d | Feature flag OFF or unreachable route => cannot be launch-pr | apps/mobile/merchant-app/test/mobile_services_test.dart (referenced at |
| EXECUTION_LEDGER change-control row format and append discipline | 40 | PARTIAL | MANDATORY_V1 | EXECUTION_LEDGER.md (append-only), asserted by scripts/validators/whol | Backend exists but no persistent enforcement path (max 50) | tests/governance/whole-repo-end-state.test.mjs — passes (2/2), but onl |
| Governance gate execution (108 validators, fail-fast runner) | 35 | PARTIAL | MANDATORY_V1 | scripts/validate-governance.mjs | Backend exists but no verified end-to-end path (max 50) | tests/governance/whole-repo-end-state.test.mjs asserts the end-state v |

### Honesty  (15 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Honest-stub surfaces (positive findings) | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/merchant-control-plane/src/components/settings/BackendNeededPane. | NONE | scripts/validators/provider-mode-badge-validator.mjs (label-level asse |
| App marketplace + embedded App Bridge (CONSTITUTIONALLY FORBIDDEN) | 61 | INTEGRATED_BUT_NOT_V1_CANDIDATE | FORBIDDEN | apps/merchant-control-plane/src/app/[store]/apps/** + apps/mobile/merc | FORBIDDEN — constitutionally never-build; score reflects imp | tests/contracts/mobile-app-bridge-runtime.test.ts, tests/contracts/mar |
| Merchant-entered Razorpay credentials (never-custody PA-split constraint) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | HIDE_OR_GATE | apps/mobile/merchant-app/lib/screens/subscription/connect_razorpay_scr | Required provider mock-only without an honest V1 mock/sandbo | tests/executable/human-required-live-paths.test.mjs:6 — `test.skip('[H |
| Gift cards merchant surface (constrained stored-value liability) | 57 | INTEGRATED_BUT_NOT_V1_CANDIDATE | DEFER | apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.t | No automated happy-path integration test for the merchant UI | tests/launch/lb11-giftcards.test.mjs (ledger-level, not merchant-UI-le |
| Warehousing scope creep: purchase orders, transfers, multi-location, suppliers, receipts,  | 55 | INTEGRATED_BUT_NOT_V1_CANDIDATE | DEFER | apps/merchant-control-plane/src/app/[store]/products/** + apps/mobile/ | No automated happy-path integration test => max 69 | NONE found for the merchant UI paths of these six surfaces |
| Provider-mode honesty badge (constitutionally mandatory) | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/merchant-control-plane/src/components/ProviderModeBadge.tsx + app | Happy path but no failure/security verification => max 84 | scripts/validators/provider-mode-badge-validator.mjs (string-presence  |
| Merchant navigation registries and dead links | 48 | PARTIAL | MANDATORY_V1 | apps/merchant-control-plane/src/components/merchantNavigation.ts (MODI | No automated happy-path integration test => max 69 | NONE for nav-target reachability |
| Wallet + Commission merchant money surfaces (CONSTITUTIONALLY FORBIDDEN) | 44 | PARTIAL | FORBIDDEN | apps/mobile/merchant-app/lib/screens/money/money_screen.dart + apps/me | FORBIDDEN (GMV/transaction fee, cross-merchant wallet) | tests/executable/settlement-postgres.test.mjs and tests/federation/app |
| Deep-link / direct-URL reachability of nav-hidden features | 38 | PARTIAL | MANDATORY_V1 | apps/merchant-control-plane/src/proxy.ts + apps/mobile/merchant-app/li | UI/route only => scored against gating completeness rather t | apps/mobile/merchant-app/test/mobile_services_test.dart:3794-3800 test |
| Storefront checkout shipping-rate honesty | 31 | PARTIAL | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-cl | Mock service returning fabricated data => max 25 (relaxed to | tests/launch/lb-checkout-hardening.test.mjs exists but no test found a |
| Capability-gate / V1 feature-exclusion primitive — Flutter merchant app | 24 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/mobile/merchant-app/lib/widgets/shared/capability_gate.dart + lib | UI/route only => max 20 (relaxed to 24: the widget has real  | NONE — no test asserts any feature is gated |
| AI Studio / AI Operator merchant surfaces (constitutionally constrained) | 21 | SCAFFOLD_ONLY | HIDE_OR_GATE | apps/merchant-control-plane/src/app/[store]/ai/page.tsx + apps/mobile/ | Mock service returning fabricated data => max 25 | NONE for the merchant AI UI surfaces |
| Demo fixture data served by the production storefront runtime | 20 | SCAFFOLD_ONLY | HIDE_OR_GATE | apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts | Mock service returning fabricated data => max 25 | NONE |
| Plan-selection and subscription-checkout commercial claims | 19 | SCAFFOLD_ONLY | HIDE_OR_GATE | apps/merchant-control-plane/src/lib/billing/plan-ui.ts | Mock service returning fabricated data => max 25 | NONE |
| Capability-gate / V1 feature-exclusion primitive — Next merchant apps | 18 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/merchant-control-plane/src/components/merchantNavigation.ts + src | UI/route only => max 20 | NONE |

### Identity Sessions Security  (18 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Merchant (ES256) vs customer (HS256) realm separation | 76 | V1_CANDIDATE | MANDATORY_V1 | packages/auth-core/src/customer-session.ts + services/api-gateway/src/ | Happy path but no failure/security verification => max 84 | tests/auth/customer-session-gateway.test.mjs, tests/auth/session-verif |
| Secret handling / no committed provider credentials | 74 | V1_CANDIDATE | MANDATORY_V1 | config/env/* templates + per-runtime secret stores | Happy path but no failure/security verification => max 84 | tests/security/environment-honesty.test.mjs (3 tests, pass) |
| Turnstile bot defense (web + mobile path) | 72 | V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform/src/lib/turnstile.ts + services/mobile-bff/src/ | Required provider mock-only without an honest V1 mock/sandbo | apps/identity-platform/src/__tests__/turnstile-proof.test.ts (2/2 pass |
| Merchant session issue / validate / rotate / revoke | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform/src/lib/auth/{session,identity-issued-session}. | Happy path but no failure/security verification => max 84 (n | services/api-gateway/src/__tests__/identity-issuer-d3.test.ts (6/6 pas |
| Flutter merchant app authentication, secure storage, session expiry | 64 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/services/store_auth_service.dart | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart:4461-4678; app |
| Rate limiting on auth surfaces | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform/src/lib/rate-limit.ts (gateway-owned) + service | No automated happy-path integration test => max 69 | apps/identity-platform/src/__tests__/rate-limit.test.ts (2/2 pass) |
| Merchant signup + email OTP verification (identity-platform) | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform (UI+routes) → services/api-gateway /auth/custom | No automated happy-path integration test => max 69 | apps/identity-platform/src/__tests__/auth-flow.test.ts (source-grep st |
| Step-up (HMAC) authorization for refunds/payouts + TOTP MFA | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/lib/security-controls.ts + routes/security.ts | Known S0/S1 security defect => not launchable regardless of  | services/api-gateway/src/__tests__/stepup-crypto.test.ts (2/2 pass, re |
| Internal service-to-service auth (identity-platform ↔ gateway ↔ mobile-bff) | 57 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/lib/internal-auth.ts + packages/auth-core | Happy path but no failure/security verification => max 84 | tests/auth/session-verifier.test.mjs (9 tests, pass) |
| Password reset / magic link / set-password | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform/src/app/api/auth/{send-reset,reset-password,sen | No automated happy-path integration test => max 69 | tests/auth/identity-password-intent.test.mjs (passes; assertion style  |
| Merchant password login (identity-platform) | 55 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/identity-platform/src/app/api/auth/login/route.ts | No automated happy-path integration test => max 69 | NONE (behavioral). apps/identity-platform/src/__tests__/rate-limit.tes |
| S0 (b): anon-writable super_admin_allowlist | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/163_d2_live_data_leak_rls.sql | Schema/DDL exists but no verified live writer AND reader =>  | tests/auth/rbac-categories.test.mjs (passes, source/logic level, not l |
| S0 (c): anon/PUBLIC grants on orders, customers, billing, products, sites, subscriptions | 48 | PARTIAL | MANDATORY_V1 | database/supabase/migrations/163_d2_live_data_leak_rls.sql | Schema/DDL exists but no verified live writer AND reader =>  | NONE (no live-DB RLS test in tests/security/**) |
| Account switch (/api/auth/switch) — former S0 | 40 | PARTIAL | DEFER | apps/identity-platform/src/app/api/auth/switch/route.ts | Feature flag OFF or unreachable route => cannot be launch-pr | apps/identity-platform/src/__tests__/auth-switch-guard.test.ts (source |
| Tenant isolation enforcement (RLS ENABLE+FORCE + per-transaction GUC) | 36 | PARTIAL | MANDATORY_V1 | database/supabase/migrations/164_d4_tenant_role_guc.sql + services/api | Schema/DDL exists but no verified live writer AND reader =>  | tests/security/theme-tenant-isolation.test.mjs (6 tests, theme scope o |
| IDN-R1: identity-platform is the SOLE session/token issuer | 20 | SCAFFOLD_ONLY | HIDE_OR_GATE | apps/identity-platform (intended) — VIOLATED by services/api-gateway/s | Known S0/S1 security defect => not launchable regardless of  | NONE — no test asserts that the gateway rejects Supabase-issued bearer |
| OIDC / OAuth2 provider surfaces (constitutionally deferred) | 14 | SCAFFOLD_ONLY | FORBIDDEN | apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts | UI/route only => max 20 | apps/identity-platform/src/__tests__/oidc-jwks.test.ts (3 tests) |
| Flutter deep links / capability gating | 8 | NOT_STARTED | DEFER | apps/mobile/merchant-app (none registered) | UI/route only => max 20 | NONE |

### Mobile Merchant App  (32 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Orders — list, detail, fulfillment, cancel, draft orders, packing slip | 64 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart + order | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'OrderService  |
| Authentication — login, signup OTP, Turnstile challenge, session persistence | 63 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/services/store_auth_service.dart + apps/i | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart (mocked http.M |
| Dashboard / Home (BFF composite, payout visibility, quick actions) | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart + lib/ | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'Dashboard qui |
| Products catalog — list, create, edit, delete, bulk, image upload, barcode, CSV import | 61 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/products/products_screen.dart + p | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'ProductServic |
| Customers CRM — list, detail, addresses, segments, CSV export | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/customers/customers_screen.dart + | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'CustomerServi |
| Store creation wizard / merchant onboarding | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/wizard/create_store_wizard.dart ( | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'StoreService  |
| Store settings — store details, domain settings, SEO, localization/markets, store health | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/settings/* + lib/services/store_s | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/mobile_services_test.dart 'StoreDetailsS |
| Analytics screen (revenue / orders / top products / traffic) | 55 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/analytics/analytics_screen.dart + | No automated happy-path integration test => max 69 | apps/mobile/merchant-app/test/analytics_model_test.dart (1 test); test |
| Feature flags, capability gates and platform-blocked seams | 45 | PARTIAL | V1_CANDIDATE | apps/mobile/merchant-app/lib/services/platform_blocked_service.dart, l | Feature flag OFF => cannot be launch-proven for the gated ca | apps/mobile/merchant-app/test/mobile_services_test.dart 'CapabilityGat |
| Accessibility, dark mode and design-token adoption | 40 | PARTIAL | V1_CANDIDATE | apps/mobile/merchant-app/lib/theme/app_theme_colors.dart, lib/theme/st | Happy path but no accessibility verification => max 84 | apps/mobile/merchant-app/test/mobile_services_test.dart 'core custom t |
| Subscription / plan upgrade / in-app Razorpay checkout | 38 | PARTIAL | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/subscription/pricing_screen.dart, | Required provider unconfigured without an honest V1 decision | apps/mobile/merchant-app/test/mobile_services_test.dart 'SubscriptionS |
| Home-screen widget, Apple Watch companion and app badge | 35 | PARTIAL | DEFER | apps/mobile/merchant-app/lib/services/home_widget_service.dart, lib/se | Happy path but no failure verification => max 84; a stub ret | apps/mobile/merchant-app/test/mobile_services_test.dart 'HomeWidgetSer |
| Money — payouts, wallet, commission, COD reconciliation | 34 | PARTIAL | HIDE_OR_GATE | apps/mobile/merchant-app/lib/screens/money/money_screen.dart + lib/ser | Backend exists but the mobile path cannot complete (step-up) | apps/mobile/merchant-app/test/mobile_services_test.dart 'Money feature |
| Crash reporting, telemetry and observability | 28 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/mobile/merchant-app/lib/services/crash_reporting_service.dart (39 | Provider unconfigured in every shipped config => NOT CONNECT | apps/mobile/merchant-app/test/mobile_services_test.dart 'CrashReportin |
| Route table integrity and navigation reachability (cross-cutting) | 25 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/mobile/merchant-app/lib/app/routes.dart (841 LOC) | Unreachable route => cannot be launch-proven | apps/mobile/merchant-app/test/mobile_services_test.dart 'AppRoutes res |
| Order refunds — issue refund + complete provider refund | 22 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart:9 | Real UI + client but no working backend contract => max 35 | NONE — no test asserts the refund request body; test/mobile_services_t |
| AI Studio (credits, generation, operator sheet) | 22 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/ai/ai_screen.dart + lib/widgets/s | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'AiScreen rend |
| Release engineering — Android/iOS signing, store metadata, permissions, CI | 20 | SCAFFOLD_ONLY | MANDATORY_V1 | apps/mobile/merchant-app/android/app/build.gradle.kts, ios/Runner.xcod | The release path is unproven and would ship a non-functional | NONE — there is no release smoke test and CI never builds a release va |
| Inventory — levels, locations, suppliers, purchase orders, transfers | 19 | SCAFFOLD_ONLY | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/inventory/* (2,742 LOC) + lib/ser | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'InventoryScre |
| Discounts — coupons, coupon form, gift cards | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/discounts/* + lib/services/coupon | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'CouponsScreen |
| Returns / RMA | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/orders/returns_screen.dart + lib/ | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'ReturnsScreen |
| Shipping rates/zones and taxes (GST) settings | 18 | SCAFFOLD_ONLY | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/settings/shipping_screen.dart, ta | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'ShippingScree |
| Staff, roles and invitations | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/settings/staff_screen.dart + lib/ | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'StaffScreen r |
| KYC document submission | 18 | SCAFFOLD_ONLY | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/kyc/kyc_screen.dart + lib/service | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'KYC feature r |
| Two-factor authentication (TOTP enroll / verify / disable) | 18 | SCAFFOLD_ONLY | V1_CANDIDATE | apps/mobile/merchant-app/lib/screens/security/two_factor_screen.dart + | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'Two-factor fe |
| CMS — pages, blog, storefront navigation, media library | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/content/* (3,715 LOC) + lib/servi | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'PagesScreen r |
| Marketing — reviews moderation, leads / form submissions, email campaigns | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/marketing/* + lib/services/review | Unreachable route => cannot be launch-proven; UI/route only  | apps/mobile/merchant-app/test/mobile_services_test.dart 'ReviewsScreen |
| App marketplace and embedded third-party app-bridge WebView | 15 | SCAFFOLD_ONLY | FORBIDDEN | apps/mobile/merchant-app/lib/screens/apps/apps_screen.dart, app_bridge | FORBIDDEN surface — the score is advisory only | apps/mobile/merchant-app/test/mobile_services_test.dart 'AppMarketplac |
| Localization / i18n (7 Indian languages) | 12 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/l10n/*.arb + lib/l10n/app_localizations.d | UI/route only => max 20 | apps/mobile/merchant-app/test/mobile_services_test.dart 'LanguageServi |
| Theme editor / storefront customization (ThemeScreen, SectionEditorScreen, theme versions, | 8 | NOT_STARTED | DEFER | apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart (634) | Unreachable/dead code => cannot be launch-proven | apps/mobile/merchant-app/test/mobile_services_test.dart 'Section edito |
| Deep links / universal links / app links | 8 | NOT_STARTED | V1_CANDIDATE | apps/mobile/merchant-app/lib/app/routes.dart:246-271 resolveDeepLink | Not started | apps/mobile/merchant-app/test/mobile_services_test.dart 'P4 deep links |
| Push notifications (FCM / APNs) | 5 | NOT_STARTED | MANDATORY_V1 | apps/mobile/merchant-app/lib/services/push_service.dart | Not started | apps/mobile/merchant-app/test/mobile_services_test.dart 'app icon badg |

### Money  (15 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Canonical double-entry ledger kernel (append-only, balanced, derived balance) | 82 | V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/139_executable_foundation_ledger_core.sql | NONE | tests/executable/money-ledger-postgres.test.mjs; tests/executable/foun |
| Fail-closed behaviour with no provider credentials | 80 | V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/* credential guards + packages/payment | NONE | packages/payments/test/payments.test.ts (behavioral: livePaymentCreden |
| commission_bps = 0 (0% transaction fee, permanent) — PAY-R3 | 74 | V1_CANDIDATE | MANDATORY_V1 | database/supabase/migrations/119 + 162 + scripts/validators/commission | NONE | scripts/validators/commission-bps-zero-validator.mjs (executed by vali |
| Step-up second factor for money actions (real cryptography) | 64 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/lib/security-controls.ts + services/api-gatew | Happy path but no failure/security verification at the integ | services/api-gateway/src/__tests__/stepup-crypto.test.ts (2 behavioral |
| Payouts / merchant settlement release (Razorpay Route PA-split) | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/payouts.ts + packages/infrastructure/p | Feature flag OFF (RAZORPAY_ROUTE_PROVIDER_ENABLED !== 'true' | services/api-gateway/src/__tests__/payout-provider-client.test.ts (3 b |
| Razorpay online payment — buyer checkout to captured, ledgered, notified order | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/storefront/checkout-payment-routes.ts  | No automated happy-path integration test => max 69 | packages/payments/test/payments.test.ts (4 behavioral unit tests of pu |
| Subscription / plan billing (the monetization spine) | 56 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/payments.ts (/subscription/*) + servic | No automated happy-path integration test => max 69 | packages/billing-core/test/billing-core.test.ts (10 behavioral) + foun |
| Provider-mode honesty (a stub must never read as success) | 54 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/merchant-control-plane/src/components/ProviderModeBadge.tsx + app | NONE | scripts/validators/provider-mode-badge-validator.mjs (executed by vali |
| Gift cards as tenant money (issuance, redemption, refund restore) | 52 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | database/supabase/migrations/173_v1_gift_card_issuance_lifecycle.sql + | No automated happy-path integration test => max 69 | tests/launch/lb11-refund-restore.test.mjs (5 tests, all readFileSync s |
| Settlement ingest + reconciliation (recon_breaks, no auto-plug) | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | services/api-gateway/src/routes/settlements.ts + packages/billing-core | No automated happy-path integration test of the route => max | tests/executable/settlement-postgres.test.mjs (real Postgres, migratio |
| COD — order placement, collection, remittance reconciliation | 42 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/routes/cod-reconciliation.ts + database/supab | No automated happy-path integration test => max 69 | NONE for the COD route/RPC path. tests/executable/foundation-wave1-mon |
| Tenant safety of the money path at runtime (RLS FORCE + per-transaction GUC) | 38 | PARTIAL | MANDATORY_V1 | database/supabase/migrations/164_d4_tenant_role_guc.sql (declared) vs  | Backend exists but no persistent tenant-safe path => max 50 | tests/executable/tenant-redteam-postgres.test.mjs and security-rls-har |
| Merchant KYC (submission + review) | 30 | PARTIAL | V1_CANDIDATE | services/api-gateway/src/routes/kyc.ts + packages/infrastructure/kyc-v | Required provider mock-only without an honest V1 mock/sandbo | services/api-gateway/src/__tests__/kyc.test.ts (4 tests, all readFileS |
| Money-truth single-recognition discipline (one credit per captured rupee) | 28 | SCAFFOLD_ONLY | MANDATORY_V1 | UNDEFINED — three independent writers post merchant_payable credits fo | Known S0 security/correctness defect => not launchable regar | NONE — no test asserts that a single captured order produces exactly o |
| Refunds — merchant-initiated, provider-executed, step-up gated, ledgered | 26 | SCAFFOLD_ONLY | MANDATORY_V1 | CONTESTED — services/api-gateway/src/routes/payments.ts:467 (step-up + | Feature flag OFF or unreachable route => cannot be launch-pr | services/api-gateway/src/__tests__/returns.test.ts (3 tests, all readF |

### Storefront Theme Content  (19 capabilities)

| Capability | Score | Band | V1 | Canonical owner | Cap applied | Test evidence |
|---|---:|---|---|---|---|---|
| Theme sanitizer + Liquid sandbox (THEME-R4) | 82 | RELEASE_CANDIDATE_WITH_GAPS | MANDATORY_V1 | packages/theme-engine/src/theme-renderer.ts | NONE | packages/theme-engine/test/qi-security.test.ts, qi-a11y.test.ts, custo |
| Theme render engine selection (React default vs Liquid canary) | 74 | V1_CANDIDATE | MANDATORY_V1 | packages/theme-engine/src/theme-governance.ts + apps/storefront-runtim | Happy path but no failure/security verification => max 84 (n | packages/theme-engine/test/liquid-*.test.ts (real LiquidJS renders, no |
| Theme editor — web (merchant-control-plane) | 72 | V1_CANDIDATE | V1_CANDIDATE | apps/merchant-control-plane/src/app/[store]/online-store/themes/[theme | No automated happy-path integration test => max 69 | tests/theme-engine/editor-bridge-contract.test.mjs, tests/theme-engine |
| React section renderer registry (storefront) | 70 | V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx | No automated happy-path integration test => max 69 (registry | packages/theme-engine/test/template-registry.test.ts, tests/launch/lb- |
| Domains: subdomain + custom-domain connect + Vercel attach | 70 | V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/custom-domains.ts + src/lib/vercel-dom | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/domain-purchase.test.ts:52 (regex o |
| Storefront access gate: password / preview_only / offline + preview sessions | 68 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/proxy.ts + services/api-gateway/src/routes | No automated happy-path integration test => max 69 | NONE that executes the gate; only source-text assertions |
| Collections route (storefront) | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/collections/[slug]/p | No automated happy-path integration test => max 69 | NONE specific to the collections route |
| Navigation, pages, blog (content) | 66 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/[...path]/ + blog/ + | No automated happy-path integration test => max 69 | NONE |
| Appearance / branding bridge (site_settings → storefront tokens) | 65 | INTEGRATED_BUT_NOT_V1_CANDIDATE | V1_CANDIDATE | apps/storefront-runtime/src/lib/store-service.ts + apps/merchant-contr | No automated happy-path integration test => max 69 | NONE for the appearance bridge |
| Storefront checkout (routing/UI layer only — money path owned by the payments slice) | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/checkout/ + apps/sto | No automated happy-path integration test => max 69 | NONE in the storefront-runtime test script |
| SEO: metadata, sitemap, robots, JSON-LD | 62 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/app/robots.ts, sitemap.ts, src/lib/seo.ts | No automated happy-path integration test => max 69 | NONE |
| Storefront host routing (subdomain + custom domain) via proxy.ts | 60 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/proxy.ts + services/api-gateway/src/routes | No automated happy-path integration test => max 69 | tests/launch/lb1-storefront-middleware.test.mjs (source-text only); te |
| Product visibility: merchant create → storefront render | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | services/api-gateway/src/routes/products.ts + services/api-gateway/src | No automated happy-path integration test => max 69 | services/api-gateway/src/__tests__/products.test.ts (source-text regex |
| Storefront cart | 58 | INTEGRATED_BUT_NOT_V1_CANDIDATE | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/cart/ + apps/storefr | No automated happy-path integration test => max 69 | NONE |
| Media (storefront-facing) | 50 | INTEGRATED_BUT_NOT_V1_CANDIDATE | DEFER | services/api-gateway/src/routes/media.ts (merchant-only) | Backend exists but no persistent tenant-safe path (for store | NONE |
| Order confirmation on the storefront | 40 | PARTIAL | MANDATORY_V1 | apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/pag | UI/route only => max 20 does not apply (it links to a real o | NONE |
| Storefront cache invalidation on merchant change | 30 | PARTIAL | MANDATORY_V1 | services/api-gateway/src/lib/storefront-cache.ts + apps/storefront-run | Backend exists but no persistent tenant-safe path => not app | NONE |
| Store publication / public storefront visibility | 25 | SCAFFOLD_ONLY | MANDATORY_V1 | services/api-gateway/src/routes/stores.ts + apps/storefront-runtime/sr | Schema/DDL exists but no verified live writer AND reader =>  | NONE — no test covers publish → public reachability |
| Theme editor — Flutter merchant app | 18 | SCAFFOLD_ONLY | DEFER | apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart + scr | Feature flag OFF or unreachable route => cannot be launch-pr | apps/mobile/merchant-app/test/mobile_services_test.dart:4228-4358 (ser |
