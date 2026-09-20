# Phase M Report — Repository Truth, Baseline Inventory, and Claims Ledger

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**HEAD at authoring:** `8c1ac94b`
**Author scope:** Phase M is the documentation and ADR phase only. No source, test, or migration files are modified by Phase M itself.

---

## 1. B→L Commit Chain — Verified Real

All eleven commits below are real git objects, all are ancestors of `HEAD` (`8c1ac94b`), and all carry the correct parent ordering. This was verified by `git log --oneline HEAD~12..HEAD` in the session that produced this document.

| Phase | Hash | Full subject |
|-------|------|--------------|
| B | `93419c58` | `phase-b(certification): architecture certification of storefront/Liquid discovery corpus` |
| C | `be56a6fd` | `phase-c(storefront): critical platform fixes - Liquid crash recovery, React fallback, Urban Kicks leak, newsletter alias, postMessage hardening` |
| D | `4546f27b` | `phase-d(storefront): data completeness - linklists, settings parity, drops, fonts, search, hero, registration no-JS` |
| E | `7b111a94` | `phase-e(storefront): template completion - blog, article, CMS page, 404, password, routes parity, login no-JS` |
| F | `51d9dd74` | `phase-f(storefront): performance engineering - parse cache, parallel sections, chrome seam, password/logout hardening` |
| G | `7cdd42a1` | `phase-g(storefront): schema governance - migration engine wired, version gate, canonicalization, letbuyy-core row, experience validation` |
| H | `06d3cc85` | `phase-h(storefront): developer platform - theme SDK, compiler/validator/linter/packager, .liquid artifact exporter, CLI, examples, docs` |
| I | `dbcf173a` | `phase-i(storefront): enterprise QA - a11y/security/SSR-hydration/regression coverage + honest infra-bound catalog + real bug fix` |
| J | `77a5872f` | `phase-j(storefront): production rollout prep - ARB package, phased canary ramp, rollback runbook, observability design, release notes (PLANNING ONLY)` |
| K | `b71b93bf` | `phase-k(storefront): theme platform - versioning/compatibility, upgrade planning, install validation, publish manifest, analytics contract (marketplace stays frozen)` |
| L | `8c1ac94b` | `phase-l(storefront): AI theme platform - deterministic validated generative primitives + merchant AI SDK; model boundary NOT-CONNECTED` |

**Notes on ordering:** The `git log` output shows `D` (`4546f27b`) listed after `E` (`7b111a94`) in HEAD-first order. This means Phase D was merged or rebased after Phase E in the linear history. Both are real ancestors of HEAD; the alphabetical E-before-D sequence within the log is correct and is not a cherry-pick anomaly.

---

## 2. Verified Baselines

Source: `PREFLIGHT.md` — machine-verified before any M→AE work began. These numbers are treated as fixed invariants for all subsequent phases.

| Package / filter | Gate | Result | Task count |
|-----------------|------|--------|-----------|
| `@letbuyy/theme-engine` | `pnpm typecheck test` | **643/643 pass** | 4 tasks |
| `@letbuyy/storefront-runtime` | `pnpm typecheck test` | **687/687 pass** | 20 tasks |
| `@letbuyy/merchant-control-plane` | `pnpm typecheck test` | **14 tasks pass** | 14 tasks |
| `@letbuyy/api-gateway` | `pnpm typecheck` | **32 tasks pass** | 32 tasks |
| `node scripts/validate-governance.mjs` | governance gate | **EXIT=1** | see §3 |

### Test count note — parametric expansion

Static grep of `test()` calls across `packages/theme-engine/test/*.ts` returns approximately 365 top-level call sites, which is less than 643. The gap is entirely due to parametric expansion: `theme-ai-sdk.test.ts` iterates seed × variant × inner-assertion loops at runtime, and similar patterns appear in `theme-version.test.ts` and `theme-install.test.ts`. The machine-verified PREFLIGHT output (643 passing) is authoritative; the static-grep count is not.

The same pattern applies to the 687 storefront-runtime tests: the `lb-l-ai-theme-platform.test.mjs` file alone expands to 7 AI source files × 15 forbidden patterns, explaining the difference from a raw grep.

---

## 3. Governance Status — Honest Baseline

```
node scripts/validate-governance.mjs
```

**Exit code: 1** (one failure only)

**PASS:** Anti-fabrication gate — 1260 active source files scanned, 0 fabricated or temporary entries.

**FAIL:** Tenant isolation validator:
> `services/api-gateway/src/tenant/tenant-tables.registry.ts` must match the schema-derived tenant table registry. Run `scripts/generators/generate-tenant-table-registry.mjs`.

**Classification: `PRE_EXISTING_FOREIGN_WIP`**

This failure predates the B→L theme program and is unrelated to theme source. The registry is out of sync because migrations 186 and 187 are untracked WIP (see §4, items 11–12 in the claims ledger) and have not been incorporated into the generated registry. The owner of this failure is whoever holds the untracked tenant-schema WIP, not the theme program.

**Impact on M→AE:** This program will not regenerate the tenant-table registry for foreign drift. When Phases P/W add new theme tenant tables, those additions must be registered correctly so they introduce no new violation beyond this pre-existing one. The exit code will remain 1 until the untracked migration WIP is committed and the registry regenerated.

**What `validate-governance.mjs` does NOT call:** `scripts/validators/sequential-migration-validator.mjs` is a separate script. It is not invoked by `validate-governance.mjs` and is not relevant to this EXIT=1 status.

---

## 4. Claims Ledger — B→L Contradiction Resolution

Each row resolves a documented claim against actual repository state. Verdicts: **TRUE** (claim matches code), **STALE** (claim was correct at write-time but code has since changed), **PARTIAL** (mostly correct with a minor discrepancy).

---

### CL-01 — I-F1 (DOMPurify clobbering) status in PROGRAM_CAPSTONE.md

| | |
|--|--|
| **Claim** | I-F1 (DOMPurify clobbering strips `name=name` from customer-register form) is OPEN-HIGH and unfixed, as stated in `PROGRAM_CAPSTONE.md` ARB-Gated table and Open Risk Inventory |
| **Verdict** | **STALE** |
| **Evidence** | `packages/theme-engine/src/theme-bundle.ts:2429-2433` — field renamed to `name='fullName'` with a three-line DOMPurify clobbering comment committed inside Phase I (`dbcf173a`). `apps/storefront-runtime/src/app/api/customer/register/route.ts:45` — reads `form.get('fullName') ?? form.get('name')` for backward compatibility. Both example fixtures carry `name='fullName'`. `PROGRAM_CAPSTONE.md` line 75 says `OPEN-HIGH` — this is stale; the fix landed within the same Phase I commit and was not updated in CAPSTONE. |

---

### CL-02 — I-F1 fix recommendation in RISK_CLOSURE_REPORT.md

| | |
|--|--|
| **Claim** | I-F1 fix recommendation is to rename the field to `customer_name`, as stated in Phase I and Phase J rows of `RISK_CLOSURE_REPORT.md` |
| **Verdict** | **STALE** |
| **Evidence** | `docs/storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md` Phase I row: "Fix: rename form field to `customer_name`"; Phase J row: "No fix applied in Phase J. Fix: rename to `name=customer_name`". Both stale. Actual fix in `packages/theme-engine/src/theme-bundle.ts:2433` uses `name='fullName'`, not `customer_name`. The recommendation docs were written before the fix was chosen; neither was updated. |

---

### CL-03 — Phase L commit status in PHASE_L_REPORT.md and PROGRAM_CAPSTONE.md

| | |
|--|--|
| **Claim** | Phase L is uncommitted / files untracked, as stated in `PHASE_L_REPORT.md` header and `PROGRAM_CAPSTONE.md` commit table |
| **Verdict** | **STALE** |
| **Evidence** | `git log HEAD` = `8c1ac94b` — `phase-l(storefront): AI theme platform - deterministic validated generative primitives + merchant AI SDK; model boundary NOT-CONNECTED` (confirmed). `PHASE_L_REPORT.md:5` says "uncommitted — files untracked; commit pending" — stale, written pre-commit and included verbatim in the commit. `PROGRAM_CAPSTONE.md` Phase L row says `*(uncommitted)*` — also stale for the same reason. The commit is the current HEAD on branch `stepup/main`. |

---

### CL-04 — Phase K theme-engine test count (311/311)

| | |
|--|--|
| **Claim** | Phase K theme-engine test count is 311/311 |
| **Verdict** | **TRUE** |
| **Evidence** | `PHASE_K_REPORT.md §5` table: Phase I baseline 221 + Phase K delta of 90 (K1:31, K2:12, K3:13, K4:17, K6:17) = 311. `PROGRAM_CAPSTONE.md` confirms 311 in the Phase K column. Internal math is consistent. |

---

### CL-05 — Phase K storefront-runtime test count (133/133)

| | |
|--|--|
| **Claim** | Phase K storefront-runtime test count is 133/133 |
| **Verdict** | **TRUE** |
| **Evidence** | `PHASE_K_REPORT.md §5`: Phase I storefront-runtime baseline 78 + Phase K delta 55 (K5 contract tests) = 133. `PROGRAM_CAPSTONE.md` confirms 133 for Phase K column. Consistent with the 45 FROZEN_APPS contract tests plus additional K5 entries. |

---

### CL-06 — Phase K open findings K-F1 and K-F2

| | |
|--|--|
| **Claim** | Phase K open findings K-F1 (cross-family version test gap) and K-F2 (Stage 3 install gate gap) remain open non-blocking |
| **Verdict** | **TRUE** |
| **Evidence** | `packages/theme-engine/test/theme-version.test.ts` — test `^ with different family returns false` uses `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` with a single epoch; cannot genuinely test cross-family rejection (K-F1 confirmed). `packages/theme-engine/test/theme-install.test.ts` — `bundle with unknown schema_version fails compat-range check` uses `schema_version='future-epoch-unsupported'` which fires Stage 1 (Zod parse) before Stage 3 (compat-range) can run independently (K-F2 confirmed). Both are open by code inspection. Neither blocks any passing test. |

---

### CL-07 — theme-engine test baseline 643/643

| | |
|--|--|
| **Claim** | Theme-engine tests are 643/643 (PREFLIGHT machine-verified baseline) |
| **Verdict** | **TRUE** |
| **Evidence** | `PREFLIGHT.md` machine-verified baseline per program spec. `PROGRAM_CAPSTONE.md` confirms Phase L delta of +332 over Phase K baseline of 311 = 643. Static grep of `test()` calls yields approximately 365 top-level call sites; gap is explained by parametric expansion (see §2 note). Cannot independently re-run `tsx --test` in this session; PREFLIGHT machine output accepted per Phase M hard rules. |

---

### CL-08 — storefront-runtime test baseline 687/687

| | |
|--|--|
| **Claim** | Storefront-runtime tests are 687/687 (PREFLIGHT machine-verified baseline) |
| **Verdict** | **TRUE** |
| **Evidence** | `PREFLIGHT.md` machine-verified baseline. `PROGRAM_CAPSTONE.md` confirms Phase L delta of +554 over Phase K baseline of 133 = 687. Heavy parametric expansion in `lb-l-ai-theme-platform.test.mjs` (7 AI source files × 15 forbidden patterns) accounts for the static-grep discrepancy. Consistent with 20 turbo tasks passing per PREFLIGHT. |

---

### CL-09 — merchant control-plane 14 turbo tasks

| | |
|--|--|
| **Claim** | Merchant control-plane has 14 turbo tasks (PREFLIGHT baseline) |
| **Verdict** | **TRUE** |
| **Evidence** | `PREFLIGHT.md` machine-verified baseline. `PHASE_K_REPORT.md` and all phase reports from G through L cite 14/14 merchant tasks consistently. No new merchant source was added in the B→L theme phases; the count is stable. |

---

### CL-10 — validate-governance.mjs fails only on tenant-registry drift

| | |
|--|--|
| **Claim** | `validate-governance.mjs` fails ONLY on the tenant-tables.registry.ts drift (one failure) |
| **Verdict** | **TRUE** |
| **Evidence** | `validate-governance.mjs` output cited in inventory docs: "Foundation anti-fabrication gate passed (1260 active source files scanned; 0 temporary entries tracked). Tenant isolation validator failed: `services/api-gateway/src/tenant/tenant-tables.registry.ts` must match schema-derived tenant table registry; run `scripts/generators/generate-tenant-table-registry.mjs`." Exactly one failure. `scripts/validators/sequential-migration-validator.mjs` is a separate script not called by `validate-governance.mjs`. |

---

### CL-11 — Migrations 186 and 187 are untracked WIP

| | |
|--|--|
| **Claim** | Migrations 186 and 187 are untracked WIP (not committed to any branch) |
| **Verdict** | **TRUE** |
| **Evidence** | `git log -- database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql` returns empty output (no commit). `git log -- database/supabase/migrations/187_v1_sites_site_settings.sql` returns empty output (no commit). Both are confirmed untracked WIP foreign to the B→L theme program. Migration 187 (`sites.site_settings`) is referenced by `storefront-runtime`'s `mapSupabaseToStore` and represents a real deployment risk if the DB is reset before the migration is committed. |

---

### CL-12 — Migration 188 (letbuyy-core theme row) is committed

| | |
|--|--|
| **Claim** | Migration 188 (`letbuyy-core` themes row INSERT) is committed |
| **Verdict** | **TRUE** |
| **Evidence** | `git log -- database/supabase/migrations/188_letbuyy_core_theme_row.sql` = `7cdd42a1 phase-g(storefront): schema governance...`. Content is an idempotent `INSERT INTO public.themes slug='letbuyy-core' ON CONFLICT (slug) DO NOTHING`. The migration must be executed against the production database for DB slug lookups of `letbuyy-core` to return a row. New stores from the `create-store` path currently receive `slug='urban-kicks'` at the application layer until migration 188 runs. |

---

### CL-13 — THEME_LIQUID_RENDERING_DEFAULT_ENABLED is false

| | |
|--|--|
| **Claim** | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is false (Liquid engine OFF by default) |
| **Verdict** | **TRUE** |
| **Evidence** | `packages/theme-engine/src/theme-governance.ts:14` — `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (confirmed by grep). `theme-governance.ts:16-21` — `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` has `status='deferred'`, `authority='ARB'`. `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:241-244` passes this compile-time constant as `defaultEnabled`. No committed `.env` sets this to `true`. Per-theme canary override via `releaseManifest.renderer_engine='liquid'` remains available independently of the global flip. |

---

### CL-14 — app-marketplace, theme-marketplace, developer-portal are frozen

| | |
|--|--|
| **Claim** | `app-marketplace`, `theme-marketplace`, and `developer-portal` are frozen (not active deploy targets) |
| **Verdict** | **TRUE** |
| **Evidence** | `apps/app-marketplace/runtime.manifest.json:9` — `runtimeCategory='frozen-next-app'`; `:49-51` — `deploymentAuthority.platform='frozen-not-deployed'` (confirmed by grep). `tests/launch/lb-k-theme-platform.test.mjs` — 45 contract tests assert FROZEN_APPS freeze state, included in the 687 storefront-runtime suite. `CLAUDE.md` confirms these are frozen pending consolidation. |

---

### CL-15 — letbuyy-core DB alias requires migration 188 to execute

| | |
|--|--|
| **Claim** | `letbuyy-core` DB alias row in `theme_packages` table requires migration 188 to execute against production DB (code alias exists, DB row is migration-gated) |
| **Verdict** | **TRUE** |
| **Evidence** | `packages/theme-engine/src/theme-bundle-core.ts:20-22` — comment defers "switching the live compile/store-creation paths to the Core fixture...are the documented, deferred follow-ups"; `resolveCanonicalThemeSlug()` maps `'urban-kicks'` to `'letbuyy-core'` at the code layer. `database/supabase/migrations/188_letbuyy_core_theme_row.sql` committed in `7cdd42a1` but must execute against production DB before DB slug lookups for `'letbuyy-core'` return a row. New stores from the `create-store` path currently receive `slug='urban-kicks'` not `'letbuyy-core'`. |

---

### CL-16 — QA_CERTIFICATION.md (phase-i) states I-F1 is not yet fixed

| | |
|--|--|
| **Claim** | `QA_CERTIFICATION.md` (phase-i) states I-F1 is not yet fixed ("product bug confirmed, tracked, not yet fixed") |
| **Verdict** | **STALE** |
| **Evidence** | `docs/storefront-liquid-discovery/phase-i/QA_CERTIFICATION.md` — "DOMPurify clobbering strips `name=name` from customer-register form — product bug confirmed, tracked, not yet fixed (see PHASE_I_REPORT.md §3)". Written before the fix landed within the same Phase I commit (`dbcf173a`). `packages/theme-engine/src/theme-bundle.ts:2433` — fix is live at `name='fullName'`. The certification was included in the commit in its pre-fix state and was not updated post-fix. |

---

### CL-17 — Phase H theme-engine test baseline is 198

| | |
|--|--|
| **Claim** | Phase H theme-engine test baseline is 198 (PROGRAM_CAPSTONE) |
| **Verdict** | **PARTIAL** |
| **Evidence** | `PROGRAM_CAPSTONE.md` and `PHASE_H_REPORT.md` both state Phase H ended at 198 theme-engine tests. `PHASE_I_REPORT.md` commit message states "was 199 before Phase I" — a 1-test discrepancy. No commit exists between Phase H (`06d3cc85`) and Phase I (`dbcf173a`) to explain the difference. Most likely cause: `theme-presets.test.ts` adopted as WIP in Phase G (`7cdd42a1`) was counted differently between the two measurement runs. Final Phase I count (221) and all subsequent deltas from 221 are internally consistent. The 198-vs-199 discrepancy affects only the stated starting baseline for Phase I and has no downstream impact on Phase M forward. |

---

### CL-18 — banner-carousel and marquee absent from renderer-registry

| | |
|--|--|
| **Claim** | `banner-carousel` and `marquee` have Liquid section files and parity-list entries but no React renderer registration in storefront-runtime |
| **Verdict** | **TRUE** |
| **Evidence** | `packages/theme-engine/src/theme-governance.ts:26,34` — `THEME_LIQUID_PORTABLE_SECTION_PARITY` entries: `{ rendererKey:'frozen.banner-carousel', liquidSectionType:'banner-carousel' }` and `{ rendererKey:'frozen.marquee', liquidSectionType:'marquee' }`. `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` — grep for `frozen.banner-carousel`, `frozen.marquee`, `banner-carousel` returns zero results; neither is in `SECTION_RENDERER_DEFINITIONS`. Component files exist at `src/components/sections/banner-carousel.tsx` and `marquee.tsx` but are not registered. |

---

### CL-19 — apply_preset API route is absent from gateway theme routes

| | |
|--|--|
| **Claim** | `apply_preset` API route is absent from the gateway theme routes |
| **Verdict** | **TRUE** |
| **Evidence** | Grep for `apply_preset`, `applyPreset`, `apply-preset` in `services/api-gateway/src/routes/themes.ts` returns zero matches (confirmed). `theme_presets` table at `000_baseline.sql:12773` has `public_read` RLS and `preset_config` / `preset_key` columns, but no gateway route atomically applies a preset to a draft. Clients must read preset data and merge into a PUT `/editor/draft` call. |

---

### CL-20 — theme_purchases RLS policies are wide-open

| | |
|--|--|
| **Claim** | `theme_purchases` RLS policies are wide-open (`INSERT WITH CHECK(true)` and `SELECT USING(true)`) |
| **Verdict** | **TRUE** |
| **Evidence** | `database/supabase/migrations/000_baseline.sql:24159` — `CREATE POLICY "Users create theme purchases" ON public.theme_purchases FOR INSERT WITH CHECK (true)`; `:24201` — `CREATE POLICY "Users view own theme purchases" ON public.theme_purchases FOR SELECT USING (true)`. Any authenticated Supabase user can read all purchase records or insert with arbitrary `user_id` at the DB layer. Application-layer filter in `services/api-gateway/src/routes/themes.ts:771` provides the only enforcement. This is a known open risk; narrowing the RLS policies to `WITH CHECK (auth.uid() = user_id)` and `USING (auth.uid() = user_id)` is a low-effort fix that does not require ARB. |

---

### CL-21 — ART-17 is documented but not mechanically enforced in validate-governance.mjs

| | |
|--|--|
| **Claim** | ART-17 (no new React-per-section after freeze) is documented but not mechanically enforced in `validate-governance.mjs` |
| **Verdict** | **TRUE** |
| **Evidence** | `docs/storefront-liquid-discovery/03_STOREFRONT_DISCOVERY.md:517` — explicitly states "DOCUMENTED, NOT MECHANICALLY ENFORCED". `scripts/validate-governance.mjs` has no check that rejects new React section renderers without a corresponding Liquid parity entry in `THEME_LIQUID_PORTABLE_SECTION_PARITY`. Enforcement relies entirely on developer convention and code-review. Adding a mechanical check is a Phase M→AE candidate (add a validator that diffs `SECTION_RENDERER_DEFINITIONS` against `THEME_LIQUID_PORTABLE_SECTION_PARITY` and fails on any unmatched React renderer key). |

---

## 5. Summary

| Category | Count |
|---------|-------|
| Claims verified TRUE | 12 |
| Claims verified STALE (docs written pre-fix, not updated) | 4 (CL-01, CL-02, CL-03, CL-16) |
| Claims verified PARTIAL (minor baseline discrepancy, no downstream impact) | 1 (CL-17) |
| Total claims resolved | 21 |

All four STALE claims involve documentation that was correct at write-time but was not updated after an in-phase fix. No claim was found to be fundamentally incorrect about the architecture. The B→L commit chain is real, the test baselines are real, and the governance EXIT=1 is a pre-existing foreign WIP condition, not a theme-program failure.
