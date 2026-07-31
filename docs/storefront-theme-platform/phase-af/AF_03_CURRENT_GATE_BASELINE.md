# AF_03 — Current Gate Baseline

**Status:** GATE BROKEN — 3 of 4 test suites pass; api-gateway unit tests EXIT=1 (3 pre-existing
failures); governance gate EXIT=1 (tenant-registry drift); sequential-migration gate EXIT=1
(2 untracked migration files on disk). All typecheck passes. No git-status mutation from any
read-only command executed here.

**HEAD:** 7e1441a6  
**Branch:** stepup/main  
**Date observed:** 2026-07-17  
**Baseline dirty-file count (before/after):** 378 / 378 (no delta from any command run here)

---

## 0 — Mutation-side-effect analysis: validate-governance.mjs

Script read: `scripts/validate-governance.mjs` (207 lines).  
The `fs.rmSync` call lives at line 179, inside `removeGeneratedArtifactDirectories()`, which is
called only when the loop reaches `stale-artifact-validator.mjs` (line 191–193). The target
directories are: `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`,
`.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`.

Verification: `git ls-files | grep -E "^\/(\.next|node_modules|\.turbo|dist…)"` returned empty.
All target directory names are confirmed gitignored in root `.gitignore`. Running the script is
therefore **safe** — it only removes gitignored build artifacts.

**Decision:** validate-governance.mjs run is ALLOWED. Ran with `--lane=gate`.  
Git status before: 378. Git status after: 378 (no delta).

---

## 1 — Package script discovery

| Package | Name | typecheck script | test script |
|---|---|---|---|
| `packages/theme-engine/package.json` | `@letbuyy/theme-engine` | `tsc --noEmit` | `tsx --test test/*.test.ts` |
| `apps/storefront-runtime/package.json` | `@letbuyy/storefront-runtime` | `tsc --noEmit` | `cd ../.. && node --test <12 test files>` |
| `apps/merchant-control-plane/package.json` | `@letbuyy/merchant-control-plane` | `tsc --noEmit` | `cd ../.. && node --test <16 test files>` |
| `services/api-gateway/package.json` | `@letbuyy/api-gateway` | `tsc --noEmit` | `pnpm run test:unit && tsx --test ../../tests/contracts/*.test.ts` |

The api-gateway `test` script chains: `test:unit` (runs `services/api-gateway/src/__tests__/*.test.ts`)
then contracts. Due to `&&`, contracts do not run if unit tests exit non-zero.

---

## 2 — Typecheck results

All four packages pass typecheck with EXIT=0. No errors or warnings emitted.

| Package | Command | Exit | Duration |
|---|---|---|---|
| `@letbuyy/theme-engine` | `pnpm --filter @letbuyy/theme-engine typecheck` | **0** | ~3 s |
| `@letbuyy/storefront-runtime` | `pnpm --filter @letbuyy/storefront-runtime typecheck` | **0** | ~8 s |
| `@letbuyy/merchant-control-plane` | `pnpm --filter @letbuyy/merchant-control-plane typecheck` | **0** | ~5 s |
| `@letbuyy/api-gateway` | `pnpm --filter @letbuyy/api-gateway typecheck` | **0** | ~4 s |

Status: **VERIFIED_CURRENT** for all four typechecks.

---

## 3 — Test suite results

### 3.1 — @letbuyy/theme-engine

**Command:** `pnpm --filter @letbuyy/theme-engine test`  
**Runner:** `tsx --test test/*.test.ts`  
**Exit code:** 0  
**Duration:** 6,927 ms  
**Counts:** tests 1726 / pass 1726 / fail 0 / skip 0 / todo 0  
**Status:** VERIFIED_CURRENT

Historical claim: 1726/1726. **Current: 1726/1726 — EXACT MATCH.**

The 56 test suites cover: accessibility analysis, AI theme customization, color system generation,
CSS validator, DOMPurify sanitizer, editor bridge, governance audit (WARN mode), hydration islands,
inspector bridge, Liquid renderer, parity audit, preset engine, schema migration runner, section
schemas (25 built-in types), template resolution, theme bundler, theme governance, theme registry,
theme version compatibility, Urban Kicks bundle. All 1726 pass.

### 3.2 — @letbuyy/storefront-runtime

**Command:** `pnpm --filter @letbuyy/storefront-runtime test`  
**Runner:** `cd ../.. && node --test` over 12 test files:
`tests/federation/web-app-contract-boundary.test.mjs`,
`tests/theme-engine/storefront-liquid-runtime.test.mjs`,
`tests/theme-engine/liquid-hydration-islands.test.mjs`,
`tests/theme-engine/liquid-hydration-islands-parity.test.mjs`,
`tests/theme-engine/editor-bridge-contract.test.mjs`,
`tests/theme-engine/inspector-bridge.test.mjs`,
`tests/launch/lb-e9-template-resolution.test.mjs`,
`tests/launch/lb-g-schema-governance.test.mjs`,
`tests/launch/lb-storefront-ssr-contracts.test.mjs`,
`tests/localization/theme-localization.test.mjs`,
`tests/launch/lb-k-theme-platform.test.mjs`,
`tests/launch/lb-l-ai-theme-platform.test.mjs`  
**Exit code:** 0  
**Duration:** 367 ms  
**Counts:** tests 930 / pass 930 / fail 0 / skip 0 / todo 0  
**Status:** VERIFIED_CURRENT

Historical claim: 915/915. **Current: 930/930 — 15 tests ADDED since historical count.**
The historical count (915) is STALE. The 15 extra tests are from Phase AE/AF additions to the
theme platform and AI theme test files (`lb-l-ai-theme-platform.test.mjs`).

### 3.3 — @letbuyy/merchant-control-plane

**Command:** `pnpm --filter @letbuyy/merchant-control-plane test`  
**Runner:** `cd ../.. && node --test` over 16 test files:
`tests/federation/web-app-contract-boundary.test.mjs`,
`tests/localization/theme-localization.test.mjs`,
`tests/app-platform/app-bridge.test.mjs`,
`apps/merchant-control-plane/tests/theme-library-q.test.mjs`,
`apps/merchant-control-plane/tests/theme-editor-r.test.mjs` through `theme-editor-ac.test.mjs`  
**Exit code:** 0  
**Duration:** 525 ms  
**Counts:** tests 771 / pass 771 / fail 0 / skip 0 / todo 0  
**Status:** VERIFIED_CURRENT

Historical claim: 771/771. **Current: 771/771 — EXACT MATCH.**

### 3.4 — @letbuyy/api-gateway

**Command:** `pnpm --filter @letbuyy/api-gateway test`  
**Exit code:** 1  
**Phase 1 — unit tests** (`pnpm run test:unit`):  
Duration: 3,542 ms  
Counts: tests 540 / pass 537 / fail **3** / skip 0 / todo 0  
Exit: **1**

**Phase 2 — contract tests** (`tsx --test ../../tests/contracts/*.test.ts`):  
**NOT RUN** — blocked by `&&` operator after unit test exit 1.

Historical claim: ~537/540 (EXIT=1). **Current: 537/540 unit (EXIT=1) — EXACT MATCH.
Contract tests also historically not run for same reason.**

#### 3.4.1 — Failing tests (stable names, not ordinals)

**Failure 1 — `merchant AI route is mounted, mobile allowlisted, and provider-backed`**  
File: `services/api-gateway/src/__tests__/ai.test.ts:32` (line 32, assert.match)  
Error: `The input did not match the regular expression /adapter\.purchase/`  
Root cause: Test asserts the AI route source calls `adapter.purchase(...)`, but
`services/api-gateway/src/routes/ai.ts` line 1031 shows the `/credits/purchase` route returns
`501 Not Implemented` unconditionally — it is retired pending SKIP-B6-AI-CREDIT-DESIGN-ARB.
The `createAiCreditPurchaseAdapter` is imported (line 3) and used for status fields
(`adapter.available`, `adapter.mode`, `adapter.provider`) but `adapter.purchase()` is never
called in the route source. This is a code-test mismatch: the test expects the purchase method
to be wired but the route intentionally does not wire it.  
Classification: **BROKEN** (pre-existing at HEAD 7e1441a6, not introduced by this workstream).

**Failure 2 — `executive analytics migration creates rollup tables with service-role and super-admin RLS`**  
File: `services/api-gateway/src/__tests__/internal-os-executive-analytics.test.ts:21`  
Error: `ENOENT: no such file or directory, open '.../database/supabase/migrations/129_internal_os_executive_analytics_rollups.sql'`  
Root cause: The test reads `database/supabase/migrations/129_internal_os_executive_analytics_rollups.sql`
which does not exist. The only migration 129 on disk is `129_mobile_customer_segments.sql`. Migration
169 (`169_internal_os_executive_analytics_rollups.sql`) contains the analytics rollup tables, but the
test hardcodes the wrong migration number/name.  
Classification: **BROKEN** (pre-existing at HEAD 7e1441a6; the test was written with the wrong
migration number).

**Failure 3 — `storefront runtime no longer owns payment route handlers`**  
File: `services/api-gateway/src/__tests__/payments.test.ts`  
Error: `The input did not match the regular expression /storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/`  
Root cause: Test asserts `checkout-client.tsx` calls `storefrontBrowserApiFetch(subdomain, '/payments/stripe/checkout')`.
The actual file at `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`
line 99 has comment: `// V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)`. The file only
calls `storefrontBrowserApiFetch(subdomain, '/payments/razorpay/order')` and `.../razorpay/verify`.
Stripe and PayPal are not wired. The test was written to enforce a future state (full provider migration
from storefront-owned routes to gateway-proxied calls) that is explicitly deferred to LB-2.  
Classification: **BROKEN** (pre-existing at HEAD 7e1441a6; Stripe/PayPal deferred per LB-2).

---

## 4 — Validator results

### 4.1 — theme-governance-validator

**Command:** `node scripts/validators/theme-governance-validator.mjs`  
**Exit code:** 0  
**Output:** `Theme governance validator passed (25 built-in section schemas, WARN mode, Liquid default OFF, fallback placeholder, schema migration runner).`  
**Status:** VERIFIED_CURRENT

Confirms:
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (ART-17 invariant HOLDS)
- `THEME_RENDERER_GOVERNANCE_DEFAULT_MODE = 'warn'` (WARN mode HOLDS)
- `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` status = `'deferred'` (HOLDS)
- `resolveThemeLiquidRenderingEnabled` per-theme canary function present (HOLDS)
- 20 Liquid parity entries for frozen React sections (ART-17 freeze count HOLDS)
- `auditThemeRendererRegistry` present (HOLDS)
- `migrateThemeTemplateSchemas` present (HOLDS)
- `BUILT_IN_SECTION_SCHEMAS` merged before runtime schemas (HOLDS)
- `UnknownSectionFallback` + `data-theme-section-fallback="true"` in renderer registry (HOLDS)
- Template resolver gates Liquid behind per-theme canary (HOLDS)
- DOMPurify with `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` + `outputEscape: 'escape'` (HOLDS)
- React section freeze validator enumerates exactly 20 frozen sections (HOLDS)
- No `production-ready` claim in active roadmap (HOLDS)
- CAP-C08 cross-referenced in roadmap and CAPABILITY_BACKLOG.md (HOLDS)

### 4.2 — migration-safety-validator

**Command:** `node scripts/validators/migration-safety-validator.mjs`  
**Exit code:** 0  
**Output:** `Migration safety validator passed (Supabase migration history checked for destructive replay hazards).`  
**Status:** VERIFIED_CURRENT

All committed migrations pass forbidden-pattern checks (no DROP TABLE, DROP SCHEMA, DROP COLUMN,
TRUNCATE, RENAME COLUMN, physical table renames). The 19 merchant-mobile V2 migrations verified
for replayability (IF NOT EXISTS). Migration orchestration YAML, partition maintenance scripts,
and custom-domain migration fragments all verified present.

### 4.3 — sequential-migration-validator

**Command:** `node scripts/validators/sequential-migration-validator.mjs`  
**Exit code:** 1  
**Output:**
```
Sequential migration validator failed:
- Untracked migration file found on disk but not committed: database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql — run 'git add database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql' or delete it
- Untracked migration file found on disk but not committed: database/supabase/migrations/187_v1_sites_site_settings.sql — run 'git add database/supabase/migrations/187_v1_sites_site_settings.sql' or delete it
```
**Status:** BROKEN

Root cause: Two migration files exist on disk (verified via `git status --porcelain`):  
- `database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql` (?? untracked) — contains only an `UPDATE public.plans` (sets Scale/Commerce OS to coming_soon; no table DDL).  
- `database/supabase/migrations/187_v1_sites_site_settings.sql` (?? untracked) — `ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_settings jsonb` (the LB-9 appearance bridge column).  

These files are in the working tree but not committed. Meanwhile, tracked migrations 188-191 exist
that were committed after these. The validator detects the gap (185 → 188 in tracked files while
186/187 exist untracked on disk) and fails. Both files were present in the working tree at session
start (part of the 378 pre-existing dirty files).

Human action required: `git add database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql database/supabase/migrations/187_v1_sites_site_settings.sql` then commit (or delete them if they should not be committed).

Historical claim: EXIT=1. **Current: EXIT=1 — SAME exit code, though the specific failures reported
here are the untracked 186/187 files; the historical claim cited different failures. Cannot verify
if this is the same root cause as historical or a new one since history does not record the exact
error messages from this validator.**

### 4.4 — validate-governance.mjs (gate lane, 107 validators)

**Command:** `node scripts/validate-governance.mjs --lane=gate`  
**Exit code:** 1  
**Stops at:** validator 2 of 107 — `tenant-isolation-validator.mjs`  
**Output (captured from piped run):**
```
Foundation anti-fabrication gate passed (1320 active source files scanned; 0 temporary entries tracked).
Tenant isolation validator failed:
- services/api-gateway/src/tenant/tenant-tables.registry.ts must match schema-derived tenant table registry; run scripts/generators/generate-tenant-table-registry.mjs
```
**Status:** BROKEN

Root cause: The committed `services/api-gateway/src/tenant/tenant-tables.registry.ts` (last
regenerated at commit `b921623f`) does not match what `deriveTenantTablesFromMigrations()` would
produce from the current migration set. Three tracked migrations added after the registry was last
regenerated create new site-scoped tables that are absent from the committed registry:

- Migration 176 (`database/supabase/migrations/176_v1_founding_program_schema.sql`): creates
  `public.founding_merchant_allocations` with `site_id uuid NOT NULL` — NOT in registry.
- Migration 184 (`database/supabase/migrations/184_v1_subscription_coupons.sql`): creates new
  table(s) with `site_id uuid not null references public.sites(id)` — NOT in registry.
- Migration 185 (`database/supabase/migrations/185_v1_site_domains.sql`): creates
  `site_domains` table with `site_id uuid not null references public.sites(id)` — NOT in registry.

Confirmed absence: `grep "founding_merchant|subscription_coupon|site_domains"` in
`services/api-gateway/src/tenant/tenant-tables.registry.ts` returns no output.

The registry generator (`scripts/generators/generate-tenant-table-registry.mjs`) rewrites the
tracked file — running it is PROHIBITED under AF.0 mutation rules.

Human action required: A developer must run `node scripts/generators/generate-tenant-table-registry.mjs`
(verifying it is still read-only except for the registry file) and commit the updated
`tenant-tables.registry.ts`.

Historical claim: governance EXIT=1. **Current: EXIT=1 — gate fails at same validator position
(tenant-isolation). However, historical records do not document whether this was the root cause
then. The root cause now is definitively the drift from migrations 176, 184, 185.**

Foundation anti-fabrication gate (validator 1) PASSED before the failure. Validators 3-107 are
UNKNOWN — they did not run because the gate halts on first failure.

---

## 5 — ART-17 / Key invariant spot-checks

These were verified as side effects of the theme-governance-validator (EXIT=0, see 4.1):

| Invariant | Source | Status |
|---|---|---|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | `packages/theme-engine/src/theme-governance.ts` | VERIFIED_CURRENT |
| Renderer governance default mode = 'warn' | `packages/theme-engine/src/theme-governance.ts` | VERIFIED_CURRENT |
| Liquid platform-wide flip = 'deferred' | `packages/theme-engine/src/theme-governance.ts` | VERIFIED_CURRENT |
| 20 frozen React sections in freeze validator | `scripts/validators/no-new-react-sections-validator.mjs` | VERIFIED_CURRENT |
| 25 built-in section types (no duplicates) | `packages/theme-engine/src/built-in-section-schemas.ts` | VERIFIED_CURRENT |
| DOMPurify with outputEscape='escape' | `packages/theme-engine/src/theme-renderer.ts` | VERIFIED_CURRENT |
| UnknownSectionFallback + data-theme-section-fallback | `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` | VERIFIED_CURRENT |
| Template resolver gates Liquid per-theme canary | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` | VERIFIED_CURRENT |
| No DROP TABLE in committed migrations | All migration files | VERIFIED_CURRENT |
| No bare `.from(money_table).insert/update` | Checked via canonical-ledger-only-validator (validator 103 in gate) | UNKNOWN (gate did not reach it) |

---

## 6 — Summary table

| Suite / Validator | Command | Exit | Pass | Fail | Skip | Status |
|---|---|---|---|---|---|---|
| @letbuyy/theme-engine typecheck | `pnpm --filter @letbuyy/theme-engine typecheck` | 0 | — | — | — | VERIFIED_CURRENT |
| @letbuyy/theme-engine test | `pnpm --filter @letbuyy/theme-engine test` | 0 | 1726 | 0 | 0 | VERIFIED_CURRENT |
| @letbuyy/storefront-runtime typecheck | `pnpm --filter @letbuyy/storefront-runtime typecheck` | 0 | — | — | — | VERIFIED_CURRENT |
| @letbuyy/storefront-runtime test | `pnpm --filter @letbuyy/storefront-runtime test` | 0 | 930 | 0 | 0 | VERIFIED_CURRENT |
| @letbuyy/merchant-control-plane typecheck | `pnpm --filter @letbuyy/merchant-control-plane typecheck` | 0 | — | — | — | VERIFIED_CURRENT |
| @letbuyy/merchant-control-plane test | `pnpm --filter @letbuyy/merchant-control-plane test` | 0 | 771 | 0 | 0 | VERIFIED_CURRENT |
| @letbuyy/api-gateway typecheck | `pnpm --filter @letbuyy/api-gateway typecheck` | 0 | — | — | — | VERIFIED_CURRENT |
| @letbuyy/api-gateway test:unit | `pnpm --filter @letbuyy/api-gateway test` (unit phase) | 1 | 537 | **3** | 0 | BROKEN |
| @letbuyy/api-gateway test:contracts | (blocked by unit exit 1) | — | — | — | — | BLOCKED |
| theme-governance-validator | `node scripts/validators/theme-governance-validator.mjs` | 0 | — | — | — | VERIFIED_CURRENT |
| migration-safety-validator | `node scripts/validators/migration-safety-validator.mjs` | 0 | — | — | — | VERIFIED_CURRENT |
| sequential-migration-validator | `node scripts/validators/sequential-migration-validator.mjs` | 1 | — | **2** | — | BROKEN |
| validate-governance.mjs gate (107) | `node scripts/validate-governance.mjs --lane=gate` | 1 | 1/107 | at #2 | 105 not reached | BROKEN |

---

## 7 — Reconciliation against historical claims

| Claim | Historical | Current | Match? |
|---|---|---|---|
| theme-engine pass/total | 1726/1726 | 1726/1726 | EXACT MATCH |
| storefront-runtime pass/total | 915/915 | 930/930 | DIVERGED — 15 tests added |
| merchant-control-plane pass/total | 771/771 | 771/771 | EXACT MATCH |
| api-gateway unit pass/total | ~537/540 | 537/540 | EXACT MATCH |
| api-gateway exit code | 1 | 1 | EXACT MATCH |
| governance EXIT | 1 | 1 | EXACT MATCH |
| sequential-migration EXIT | 1 | 1 | EXACT MATCH |

The 930 vs 915 storefront-runtime discrepancy is NOT a regression — 15 tests were added to
`tests/launch/lb-l-ai-theme-platform.test.mjs` and related files as part of Phase AF theme AI
work. All 930 pass.

---

## 8 — Blockers (items that prevent a clean gate run)

1. **BLOCKER-1** (BROKEN): api-gateway unit test #1 — AI route does not call `adapter.purchase()`.
   Root cause: `/credits/purchase` route retired (SKIP-B6-AI-CREDIT-DESIGN-ARB). Human action:
   either implement the purchase route via the canonical ledger or update the test to reflect the
   501-deferred state.
   Evidence: `services/api-gateway/src/__tests__/ai.test.ts:32`, `services/api-gateway/src/routes/ai.ts:1031`.

2. **BLOCKER-2** (BROKEN): api-gateway unit test #130 — missing migration file `129_internal_os_executive_analytics_rollups.sql`.
   Root cause: Test was written with wrong migration number; actual file is `169_internal_os_executive_analytics_rollups.sql`.
   Human action: Fix test at `services/api-gateway/src/__tests__/internal-os-executive-analytics.test.ts:21`
   to reference migration 169.

3. **BLOCKER-3** (BROKEN): api-gateway unit test #298 — Stripe payment route not wired in storefront checkout-client.
   Root cause: Stripe + PayPal deferred per LB-2. Comment at `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:99`.
   Human action: Either implement Stripe/PayPal checkout routes (LB-2 scope) or adjust test to
   reflect the V1 Razorpay+COD-only state.

4. **BLOCKER-4** (BROKEN): sequential-migration-validator EXIT=1 — migrations 186 and 187 are on
   disk but untracked by git.
   Human action: `git add database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql database/supabase/migrations/187_v1_sites_site_settings.sql` then commit.

5. **BLOCKER-5** (BROKEN): governance gate EXIT=1 — `tenant-tables.registry.ts` is stale (missing
   `founding_merchant_allocations`, `subscription_coupon_redemptions`, `site_domains`).
   Human action: run `node scripts/generators/generate-tenant-table-registry.mjs` and commit the
   updated registry. Validators 3-107 are UNKNOWN until this blocker is cleared.

---

## 9 — Unknowns

- Validators 3-107 in the governance gate: **UNKNOWN** — did not run because gate halts at
  validator 2 (tenant-isolation). Status of any new violations introduced by Phase AE/AF work in
  those validators cannot be confirmed without clearing BLOCKER-5 first.
- api-gateway contract tests (`tests/contracts/*.test.ts`): **BLOCKED** — not run because unit
  test exit 1 prevents `&&` chaining. Historical count is unknown (the `~537/540` figure was for
  unit tests only per the historical `test:unit` script definition).
- canonical-ledger-only-validator (validator 103 of 107): **UNKNOWN** — gate did not reach it;
  cannot confirm ART-10/R-5/R-6 money-mutation invariant from this workstream run.

---

## 10 — STOP/GO inputs for AF_1

The following concrete gate observations feed the AF_1 STOP/GO decision:

1. **Typechecks: PASS (all 4 packages, EXIT=0)** — no type-system regressions. This is a GO
   signal for static correctness.

2. **theme-engine tests: PASS (1726/1726, EXIT=0)** — full theme-engine test suite green.
   ART-17 invariants verified via theme-governance-validator. Liquid default OFF, DOMPurify
   locked, 20 frozen sections, 25 built-in schemas. GO signal for theme platform.

3. **storefront-runtime tests: PASS (930/930, EXIT=0)** — all storefront contract tests pass.
   The 930 count supersedes the historical 915 claim; 15 extra tests added and all pass.
   GO signal for storefront.

4. **merchant-control-plane tests: PASS (771/771, EXIT=0)** — GO signal for merchant UI.

5. **api-gateway unit tests: FAIL (537/540, EXIT=1)** — 3 pre-existing failures documented
   above (BLOCKER-1/2/3). STOP signal for api-gateway gate; requires human resolution before
   this gate can be called clean.

6. **api-gateway contract tests: BLOCKED** — cannot assess contract compliance. STOP signal.

7. **theme-governance-validator: PASS (EXIT=0)** — all ART-17, DOMPurify, and Liquid invariants
   hold at HEAD. GO signal for theme governance.

8. **migration-safety-validator: PASS (EXIT=0)** — no destructive SQL patterns in committed
   migrations. GO signal for migration safety.

9. **sequential-migration-validator: FAIL (EXIT=1)** — 2 untracked migration files (BLOCKER-4).
   STOP signal. Cannot confirm schema-commit alignment until 186/187 are committed or deleted.

10. **governance gate (107 validators): FAIL at validator 2 (EXIT=1)** — tenant registry stale
    (BLOCKER-5). STOP signal. Validators 3-107 status UNKNOWN. Cannot certify ART-08/09 RLS
    coverage, ART-10 canonical-ledger-only, or any of the 105 unrun validators.

**Verdict for AF_1:** Theme-engine, storefront, and merchant typechecks and tests are green.
The gate cannot be called PASS because the governance gate is BROKEN at validator 2, the
sequential-migration gate fails on untracked files, and the api-gateway has 3 pre-existing unit
test failures with contract tests blocked. A developer must resolve BLOCKER-4 (commit 186/187),
BLOCKER-5 (regenerate tenant registry), and BLOCKER-1/2/3 (api-gateway test fixes) before the
full 107-validator gate can return EXIT=0.
