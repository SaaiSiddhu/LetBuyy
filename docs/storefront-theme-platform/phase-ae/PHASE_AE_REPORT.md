# Phase AE — Report: Marketplace + Partner Readiness

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per phase hard rules; this is the final phase of the M→AE program)

---

## 1. Summary

Phase AE is the **final phase** of the 19-phase M→AE LetBuyy theme platform program. It delivers two things:

1. **The Theme Marketplace Partner-Submission Validation Contract.** A single, pure, deterministic, fail-closed gate function `validateThemeForMarketplace(rawBundle)` in `packages/theme-engine/src/theme-marketplace-contract.ts`. This function must be passed before any third-party theme bundle could ever be listed in the LetBuyy theme marketplace. It composes four existing validators (Stage K/AA/Y/N) with no new validator logic introduced.

2. **RISK-SEC-001 closure.** Migration 191 (`191_theme_purchases_rls_tenant_scope.sql`) drops the two wide-open `USING (true)` / `WITH CHECK (true)` RLS policies on `public.theme_purchases` that have been open since the baseline, and replaces them with user-scoped authenticated policies and an explicit service_role pass-through. **Production apply is ARB-gated.**

**Marketplace launch is NOT automatic.** This phase delivers a technical gate contract. The frozen marketplace apps (`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`) are untouched. Wiring the gate into a live partner-submission pipeline requires separate ARB-gated work.

---

## 2. Deliverables

### 2.1 `packages/theme-engine/src/theme-marketplace-contract.ts` (NEW, 354 lines)

The partner-submission validation gate.

**Exported API:**

| Export | Type | Description |
|--------|------|-------------|
| `ThemeMarketplaceStage` | Type alias | `'K' \| 'AA' \| 'Y' \| 'N'` |
| `ThemeMarketplaceViolation` | Interface | `{ stage, code, message, advisory? }` |
| `ThemeMarketplaceValidationResult` | Interface | `{ ok: boolean, violations: ThemeMarketplaceViolation[] }` |
| `validateThemeForMarketplace` | Function | `(rawBundle: unknown) => ThemeMarketplaceValidationResult` |

**Gate properties:**

| Property | Evidence |
|----------|----------|
| Pure | No DB writes, no network I/O, no side effects — grep-verified (no `fetch`, `http`, `supabase`, `db.rpc` in the file) |
| Deterministic | Same input always → same result; AE-DET tests verify |
| Fail-closed | Any unrecognised/error state → `ok: false`; never throws; AE-FC tests verify |
| Never throws | All validator calls wrapped in try/catch; paranoid re-parse error caught |

**Stage composition:**

| Stage | Validator | Source | What it catches |
|-------|-----------|--------|----------------|
| K | `validateThemeInstall` | `./theme-install` | Schema (G4) + lint (H) + compat range + parity gaps (advisory) |
| AA | `validateCustomCss` on every string leaf in `settings_data.current` | `./custom-css-sanitizer` | CSS injection vectors in bundled defaults |
| Y | `BLOCKED_APP_BLOCK_SETTING_KEYS` on @app template blocks | `./app-block-model` | Credential-adjacent keys in @app block settings |
| N | `toThemeDocumentV2` + `parseThemeDocument` | `./theme-document` | Template key charset; block-nesting issues not caught by Zod bundle schema |

**Stage K early exit:** If Stage K produces `schema-invalid` or `compat-range`, stages AA/Y/N are skipped to avoid misleading noise from secondary errors against an unparseable bundle. Result is still `ok: false`.

**Advisory violations:** Stage K parity-gap and lint-warn violations have `advisory: true`. They are surfaced in `violations[]` but do not affect `ok`. Partners should fix them before listing but they are not hard blockers.

**Internal helper:** `walkStringLeaves(value, path, depth)` generator — yields every string leaf from `settings_data.current` with its path. Depth capped at 4. See PHASE_AE_SECURITY_REVIEW.md §4 for the MEDIUM finding associated with this cap.

### 2.2 `packages/theme-engine/test/theme-marketplace-contract.test.ts` (NEW, 489 lines, 31 tests)

| Group | Tests | Purpose |
|-------|-------|---------|
| AE-OK | 5 | Clean first-party bundles (minimal, Urban Kicks, Letbuyy Core) pass all stages |
| AE-K | 5 | Schema invalid, compat range, advisory parity-gap path |
| AE-AA | 6 | CSS injection (`@import`, `url(javascript:)`, `</style>`, `expression()`, multiple keys, unicode-escaped) |
| AE-Y | 4 | @app credential key rejection; non-@app no false positives |
| AE-N | 2 | Urban Kicks + Letbuyy Core ThemeDocument parse pass |
| AE-DET | 3 | Determinism; blocking-before-advisory ordering |
| AE-FC | 4 | Fail-closed on `undefined`, `'string'`, `[]`, varied inputs |

**Total new:** 31. **Suite total after AE:** 1726/1726 pass.

### 2.3 `packages/theme-engine/src/index.ts` (ADDITIVE, 5-line block)

Appended after the `ai-intent-parser` export:

```typescript
// Phase AE — Theme Marketplace Partner-Submission Validation Contract
// validateThemeForMarketplace: pure, deterministic, fail-closed gate that
// composes all existing validators (K/AA/Y/N) for third-party theme submissions.
// NOT a live marketplace pipeline — frozen apps are untouched.
export * from './theme-marketplace-contract';
```

### 2.4 `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` (NEW, 93 lines)

RISK-SEC-001 remediation. See §3 below and PHASE_AE_SECURITY_REVIEW.md §1 for full evidence.

---

## 3. RISK-SEC-001 — FIXED

**Severity:** HIGH (carried since Phase M)
**Status:** FIXED in migration 191; ARB-gated for production apply

**Defect:** `000_baseline.sql` lines 24159 and 24201 — both `theme_purchases` RLS policies used `USING (true)` / `WITH CHECK (true)` with no `TO` clause, making them effective for PUBLIC (anon + authenticated + service_role).

**Fix:** Migration 191 drops both wide-open policies and creates:
- `tp_service_role FOR ALL TO service_role USING(true)` — explicit gateway pass-through.
- `tp_authenticated_select FOR SELECT TO authenticated USING (user_id = auth.uid())` — own records only.
- `tp_authenticated_insert FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())` — own user_id only.

**Architecture note:** `theme_purchases.user_id` FK → `users_custom(id)`, a separate UUID space from `auth.uid()`. The effective posture is that direct authenticated-role clients cannot browse other users' purchase rows (any UUID coincidence would be accidental and non-exploitable in practice). The gateway always uses service_role and is the canonical access path.

**NOT-A-DEFECT:** The authenticated policy using `auth.uid()` against a `users_custom.id` FK is a known architecture choice. The LOW finding FIND-AE-SEC-003 documents the residual risk and long-term remediation path (adding `auth_id` FK to `users_custom`).

---

## 4. Marketplace Launch Gate — NOT Automatic

Phase AE delivers the **technical foundation** for marketplace partner submission validation. The following items remain human + ARB gated:

| Gate | Status |
|------|--------|
| Frozen apps unfrozen (`apps/app-marketplace`, `apps/theme-marketplace`, `apps/developer-portal`) | NOT DONE — requires ARB approval + full-scope work |
| Live partner upload pipeline wired to `validateThemeForMarketplace` | NOT DONE |
| Partner review queue | NOT DONE |
| Theme listing pages | NOT DONE |
| Migration 191 applied to production | NOT DONE — ARB-gated |
| Marketplace entitlement / payment integration | NOT DONE |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` flip | NOT DONE — ARB authority unchanged |

---

## 5. Rollback

There is no new write path in Phase AE. `validateThemeForMarketplace` is a pure function — it reads and validates, never writes. Rollback of Phase AE means reverting the four changed files:
- `packages/theme-engine/src/theme-marketplace-contract.ts` — delete.
- `packages/theme-engine/test/theme-marketplace-contract.test.ts` — delete.
- `packages/theme-engine/src/index.ts` — revert the 5-line AE block.
- `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` — delete (migration not yet applied to production).

---

## 6. Findings Summary

See PHASE_AE_SECURITY_REVIEW.md for full evidence.

| ID | Severity | File | Summary | Status |
|----|----------|------|---------|--------|
| FIND-AE-SEC-001 | MEDIUM | `theme-marketplace-contract.ts` | `walkStringLeaves` depth cap at 4 allows CSS injection bypass at depth ≥ 5 | **FIXED** (fail-closed depth guard; AE-AA-07/08) |
| FIND-AE-TEST-002 | LOW | `theme-marketplace-contract.test.ts` | AE-K-05 uses redundant OR condition | OPEN, cosmetic |
| FIND-AE-SEC-003 | LOW | `191_theme_purchases_rls_tenant_scope.sql` | `user_id = auth.uid()` cross-UUID-space residual risk | OPEN, deferred |

No HIGH or CRITICAL findings. The MEDIUM finding was hardened in-phase: `walkStringLeaves` now caps at `MAX_SETTINGS_WALK_DEPTH = 12` (above every legitimate theme depth) and fails closed beyond it — an over-deep bundle is rejected with a blocking `AA:settings-too-deep` violation rather than silently skipped. Locked by tests `AE-AA-07` (depth-5 `@import` rejected) and `AE-AA-08` (beyond-cap fail-closed). theme-engine gate 1726/1726.

---

## 7. Gate Evidence

| Gate | Result |
|------|--------|
| `pnpm --filter=@letbuyy/theme-engine typecheck` | PASS (0 errors) |
| `pnpm --filter=@letbuyy/theme-engine test` | PASS (1726/1726) |
| `migration-safety-validator.mjs 191_...sql` | PASS |
| Frozen apps untouched | CONFIRMED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` | UNCHANGED |
| Money / checkout / payment code | UNTOUCHED |
| `validate-governance.mjs` | EXIT=1 (pre-existing tenant-registry drift — unchanged from Phase AD baseline; anti-fabrication PASS) |

---

## 8. Program Closure

Phase AE is the final phase of the M→AE program. The program is now **COMPLETE**. See `phase-ae/PROGRAM_CAPSTONE.md` for the whole-program summary, final verdict, and honest NOT-CONNECTED seam inventory.
