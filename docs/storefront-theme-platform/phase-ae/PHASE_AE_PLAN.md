# Phase AE — Plan: Marketplace + Partner Readiness

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AE — Marketplace + Partner Readiness
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** PLAN COMPLETE (phase executed in full)

---

## 1. Objective

Deliver the **Theme Marketplace Partner-Submission Validation Contract** and close **RISK-SEC-001** (theme_purchases wide-open RLS). These are the two remaining open items identified in the Phase AD certification as required for program closure.

## 2. Constraints

| Constraint | Source |
|------------|--------|
| Do NOT touch frozen apps (`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`) | CLAUDE.md runtime policy |
| Do NOT flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | ARB authority; program invariant |
| Do NOT modify money ledger, checkout, payment RPCs | Constitutional hard rule |
| Do NOT add new validator logic or relax any sanitizer | Phase AE design intent: composition only |
| Do NOT add new React-per-section code | ART-17 frozen |
| Migration 191 must pass `migration-safety-validator.mjs` | Program gate requirement |
| No source edits to foreign WIP files | Phase hard rule |

## 3. Deliverable List

### 3.1 Feature lane — `packages/theme-engine/`

**File: `src/theme-marketplace-contract.ts`** (NEW, 354 lines)

- `validateThemeForMarketplace(rawBundle: unknown): ThemeMarketplaceValidationResult`
- Pure, deterministic, fail-closed; never throws.
- Composes Stage K (`validateThemeInstall`), Stage AA (`validateCustomCss` over all string leaves in `settings_data.current`), Stage Y (`BLOCKED_APP_BLOCK_SETTING_KEYS` on @app template blocks), Stage N (`toThemeDocumentV2` + `parseThemeDocument`).
- Exported types: `ThemeMarketplaceStage`, `ThemeMarketplaceViolation`, `ThemeMarketplaceValidationResult`.
- `walkStringLeaves` internal generator (depth-capped at 4, see PHASE_AE_SECURITY_REVIEW.md §4).

**File: `src/index.ts`** (ADDITIVE, 5-line block after ai-intent-parser export)

```typescript
// Phase AE — Theme Marketplace Partner-Submission Validation Contract
// validateThemeForMarketplace: pure, deterministic, fail-closed gate that
// composes all existing validators (K/AA/Y/N) for third-party theme submissions.
// NOT a live marketplace pipeline — frozen apps are untouched.
export * from './theme-marketplace-contract';
```

**File: `test/theme-marketplace-contract.test.ts`** (NEW, 489 lines, 31 tests)

Test groups:
- `AE-OK-*` (5 tests): Clean first-party bundles pass all stages.
- `AE-K-*` (5 tests): Stage K schema/compat/advisory paths.
- `AE-AA-*` (6 tests): CSS injection in `settings_data.current`.
- `AE-Y-*` (4 tests): @app block credential key check.
- `AE-N-*` (2 tests): ThemeDocument parse pass.
- `AE-DET-*` (3 tests): Determinism + violation ordering.
- `AE-FC-*` (4 tests): Fail-closed on malformed input (undefined/string/array/any).

### 3.2 Database migration

**File: `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql`** (NEW, 93 lines)

- Drops `"Users create theme purchases"` (wide-open `WITH CHECK (true)`) and `"Users view own theme purchases"` (wide-open `USING (true)`).
- Creates `tp_service_role FOR ALL TO service_role USING(true) WITH CHECK(true)` — gateway pass-through matching migration 163 D2 pattern.
- Creates `tp_authenticated_select FOR SELECT TO authenticated USING (user_id = auth.uid())`.
- Creates `tp_authenticated_insert FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`.
- Idempotent (`DROP IF EXISTS` before each `CREATE`).
- Passes `migration-safety-validator.mjs` (no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `RENAME`).
- **ARB-gated for production apply.**

### 3.3 Documentation (this phase-ae/ directory)

- `PHASE_AE_DISCOVERY.md` (pre-work, what existed, design decisions)
- `PHASE_AE_PLAN.md` (this document)
- `PHASE_AE_SECURITY_REVIEW.md` (RISK-SEC-001 disposition, gate proof, findings)
- `PHASE_AE_TEST_REPORT.md` (test run evidence, 31 new tests)
- `PHASE_AE_REPORT.md` (canonical phase record)
- `PARTNER_READINESS.md` (third-party submission safety contract)
- `PROGRAM_CAPSTONE.md` (whole-program closure document)
- `PROGRAM_STATE.md` updated (Phase AE COMPLETE — PROGRAM COMPLETE)
- `RISK_REGISTER.md` updated (RISK-SEC-001 FIXED)

## 4. Execution Order

1. Read and verify `000_baseline.sql` lines 24159 + 24201 (confirm RISK-SEC-001 evidence).
2. Write `191_theme_purchases_rls_tenant_scope.sql`.
3. Write `theme-marketplace-contract.ts` composing all four stages.
4. Write `theme-marketplace-contract.test.ts` covering all gate paths.
5. Append AE export block to `index.ts`.
6. Run `pnpm --filter=@letbuyy/theme-engine typecheck test` → verify 1726/1726 pass.
7. Run `node scripts/validators/migration-safety-validator.mjs database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` → verify PASS.
8. Write all documentation files.

## 5. Gate Criteria

| Gate | Criterion | Result |
|------|-----------|--------|
| typecheck | 0 errors in `@letbuyy/theme-engine` | PASS |
| test suite | 1726/1726 pass (1695 baseline + 31 new) | PASS |
| migration safety | `migration-safety-validator.mjs` exits 0 | PASS |
| frozen apps | No source edits to `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace` | CONFIRMED |
| flag invariant | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` at `theme-governance.ts:14` | UNCHANGED |
| money safety | No money ledger / checkout / payment code touched | CONFIRMED |
| RISK-SEC-001 | Migration 191 drops both wide-open policies + replaces with scoped policies | DONE |

## 6. Non-deliverables (explicitly deferred or out of scope)

| Item | Reason |
|------|--------|
| Live marketplace upload pipeline | Frozen apps; requires separate ARB-gated scope |
| Partner review queue | Requires human-operated workflow, ARB gate, legal review |
| Theme listing page | Frozen `apps/theme-marketplace` |
| Developer portal submission flow | Frozen `apps/developer-portal` |
| `app-marketplace` integration | Frozen; not a deploy target |
| Marketplace launch date | Human + ARB authority; not a code decision |
| `walkStringLeaves` depth fix | MEDIUM finding — **hardened in AE**: cap raised to 12 + fail-closed truncation (`AA:settings-too-deep`); locked by AE-AA-07/08 |
