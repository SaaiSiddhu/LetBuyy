# Phase AE — Discovery: Marketplace + Partner Readiness

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase AE is the final phase of the M→AE program. It delivers the **Theme Marketplace Partner-Submission Validation Contract**: a single, pure, deterministic, fail-closed gate function (`validateThemeForMarketplace`) that must be passed before any third-party theme bundle could ever be listed in the LetBuyy theme marketplace.

Phase AE also closes **RISK-SEC-001** — the highest-severity open risk carried by the program since Phase M.

| Work item | Owner | Role |
|-----------|-------|------|
| `validateThemeForMarketplace` gate | `packages/theme-engine/src/theme-marketplace-contract.ts` (NEW) | Pure validator composing K/AA/Y/N stages |
| Test coverage | `packages/theme-engine/test/theme-marketplace-contract.test.ts` (NEW) | 31 new AE tests (1695→1726 total) |
| AE export block | `packages/theme-engine/src/index.ts` (ADDITIVE, 5 lines) | Public API export |
| RISK-SEC-001 closure | `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (NEW) | Tightens wide-open `theme_purchases` RLS |

Frozen apps (`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`) are **not touched**. `theme-registry.ts` is **not touched**. No live marketplace pipeline is wired. Marketplace launch remains ARB/human-gated.

---

## 2. Pre-Phase-AE State

### 2.1 What existed entering Phase AE

The four validators that Phase AE composes already existed, having been delivered across M→AD:

| Validator | Phase | File | Role in AE |
|-----------|-------|------|-----------|
| `validateThemeInstall` | AB/K | `packages/theme-engine/src/theme-install.ts` | Stage K — structural + lint + compat + parity |
| `parseLiquidThemePackageBundle` (G4 gate) | B→L | `packages/theme-engine/src/theme-bundle.ts` | Subsumed by Stage K (Stage 1 of `validateThemeInstall`) |
| `lintThemeBundle` (Phase H) | B→L | `packages/theme-engine/src/theme-linter.ts` | Subsumed by Stage K (Stage 2 of `validateThemeInstall`) |
| `isThemeBundleSchemaCompatible` | AB | `packages/theme-engine/src/theme-version.ts` | Subsumed by Stage K (Stage 3 of `validateThemeInstall`) |
| `collectLiquidPortableSectionParityGaps` | AB | `packages/theme-engine/src/theme-governance.ts` | Subsumed by Stage K (Stage 4, advisory) |
| `validateCustomCss` | AA | `packages/theme-engine/src/custom-css-sanitizer.ts` | Stage AA — CSS injection in settings_data.current |
| `BLOCKED_APP_BLOCK_SETTING_KEYS` | Y | `packages/theme-engine/src/app-block-model.ts` | Stage Y — @app block credential-key check |
| `toThemeDocumentV2` + `parseThemeDocument` | N | `packages/theme-engine/src/theme-document.ts` | Stage N — ThemeDocument structure parse |

No new validator logic was required. Phase AE only needed an orchestration layer composing these four validators into one deterministic contract function.

### 2.2 RISK-SEC-001 — open since Phase M

`database/supabase/migrations/000_baseline.sql` contains two wide-open RLS policies on `public.theme_purchases`:

- Line 24159: `CREATE POLICY "Users create theme purchases" ON public.theme_purchases FOR INSERT WITH CHECK (true);`
- Line 24201: `CREATE POLICY "Users view own theme purchases" ON public.theme_purchases FOR SELECT USING (true);`

Both omit a `TO` clause, making them effective for PUBLIC (anon + authenticated + service_role). No subsequent migration (073–190) narrows either policy. This was registered as RISK-SEC-001 (HIGH) at Phase M and carried through every subsequent phase, targeted at Phase AE.

### 2.3 What Phase AE needed to add

1. `validateThemeForMarketplace(rawBundle)` orchestration function — the single partner-submission gate.
2. Test coverage for all gate paths (K/AA/Y/N fail, ok=true clean bundles, determinism, fail-closed on malformed input).
3. Migration 191 to close RISK-SEC-001.
4. Partner readiness documentation.
5. Program capstone documentation (this is the final phase).

### 2.4 Explicit non-scope

- **Frozen apps are untouched.** `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` do not change. `validateThemeForMarketplace` does not import from them.
- **No live marketplace pipeline.** The gate is a pure contract function. Wiring it to an upload endpoint, a review queue, or a listing page requires separate ARB-gated work.
- **No new allow-lists or deny-lists.** No sanitizer relaxation. No new React-per-section code (ART-17 frozen).
- **No money, checkout, or payment RPC is touched.** Migration 191 modifies only RLS policies.
- **No flag flip.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false`. ARB authority.

---

## 3. Design Decisions

### 3.1 Pure / deterministic / fail-closed

`validateThemeForMarketplace` is a pure function — no DB writes, no network I/O, no side effects. Same input always produces the same result. Any unrecognised or erroring state produces `ok: false`.

### 3.2 Stage ordering: K first; early exit on hard structural failure

If Stage K produces a hard structural failure (`schema-invalid` or `compat-range`), the bundle is unparseable. Stages AA/Y/N are skipped to avoid misleading noise from secondary errors. Advisory K violations (parity-gap, lint-warn) are collected but do not cause early exit.

### 3.3 Advisory violations do not affect ok

Stage K parity-gap and lint-warn violations are `advisory: true`. Partners should fix them before listing, but they are not hard blockers — they do not set `ok: false`. This matches the design of `validateThemeInstall` where `level: 'warn'` is non-blocking.

### 3.4 Stage AA walks settings_data.current string leaves

A partner theme may ship bundled default values in `settings_data.current` (background gradients, font-face declarations, colour hex strings). Stage AA passes every string leaf through `validateCustomCss` to catch CSS injection vectors (`@import`, `url(javascript:)`, `expression()`, `</style>` breakout). Non-CSS values (plain colour names, hex strings, numbers-as-strings) produce no false positives.

The `walkStringLeaves` generator originally capped depth at 4 (the source of the MEDIUM finding). It was hardened in-phase to cap at `MAX_SETTINGS_WALK_DEPTH = 12` with fail-closed truncation. See PHASE_AE_SECURITY_REVIEW.md §4.

### 3.5 Stage Y checks only @app block default settings

Stage Y checks the `settings` of every `isLiquidAppBlockType()` template block against `BLOCKED_APP_BLOCK_SETTING_KEYS`. It does NOT check runtime `AppBlockReference` objects — those require a live app runtime (NOT-CONNECTED). The Y check catches credential leaks in statically-bundled `@app` default settings only.

### 3.6 Migration 191 pattern matches migration 163

Migration 163 (D2 live data leak fix) established the pattern: explicit `TO service_role USING(true)` + authenticated-scoped user policy. Migration 191 follows this exact pattern for `theme_purchases`.

---

## 4. Key Gap Identified: walkStringLeaves Depth Cap

The `walkStringLeaves` generator originally stopped at `depth > 4`. The `ThemeBundleSettingsDataSchema` (a recursive `z.lazy()`) has no equivalent depth bound, so a bundle with a string at depth ≥ 5 in `settings_data.current` would pass Stage K schema validation but have the CSS-injection string silently skipped by Stage AA.

**Status:** ✅ FIXED in Phase AE hardening. The cap was raised to `MAX_SETTINGS_WALK_DEPTH = 12` (above every legitimate theme depth) and truncation is fail-closed — an over-deep bundle is rejected with a blocking `AA:settings-too-deep` violation rather than skipped. Locked by tests AE-AA-07 (depth-5 `@import` rejected) and AE-AA-08 (beyond-cap fail-closed). See PHASE_AE_SECURITY_REVIEW.md §4.

---

## 5. Summary Table: Phase AE Deliverables vs. Pre-Existing

| Deliverable | Status | Note |
|-------------|--------|------|
| `validateThemeForMarketplace` gate | NEW | Pure, deterministic, fail-closed, 354 lines |
| 31 AE tests (AE-OK/K/AA/Y/N/DET/FC) | NEW | 1695→1726 total, all pass |
| AE export block in `index.ts` | ADDITIVE (5 lines) | After ai-intent-parser export |
| Migration 191 (RLS tighten) | NEW | Closes RISK-SEC-001; ARB-gated for production apply |
| Stage K validator (`validateThemeInstall`) | PRE-EXISTING | Phase AB; no change |
| Stage AA validator (`validateCustomCss`) | PRE-EXISTING | Phase AA; no change |
| Stage Y blocked keys (`BLOCKED_APP_BLOCK_SETTING_KEYS`) | PRE-EXISTING | Phase Y; no change |
| Stage N document parse (`parseThemeDocument`, `toThemeDocumentV2`) | PRE-EXISTING | Phase N; no change |
| Frozen apps | UNCHANGED | `apps/app-marketplace` etc. — not touched |
| `theme-registry.ts` | UNCHANGED | Frozen; not touched |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | UNCHANGED | `false`; ARB authority |
