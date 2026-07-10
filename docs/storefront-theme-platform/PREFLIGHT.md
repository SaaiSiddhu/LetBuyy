# M→AE Program — Preflight Inventory

**Date:** 2026-07-10 · **Branch:** `stepup/main` (not `main`, not production ✓) · **Starting HEAD:** `29f87115`

This is the immutable preflight record for the LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor program (Phases M→AE). It captures the verified repository truth **before** any M→AE work.

## Git safety
- Branch `stepup/main` — safe (not main/production).
- No branch switch, no worktree churn, no destructive git.
- Dirty paths at start: **360** (pre-existing WIP + untracked theme-engine files). All preserved; none staged by this program except each phase's own declared deliverables.

## B→L commit chain — VERIFIED REAL (all `commit` type + ancestors of HEAD)
| Phase | Commit | Type | Ancestor of HEAD |
|-------|--------|------|------------------|
| B | 073bcbfe | commit | ✓ |
| C | 70a40c2a | commit | ✓ |
| E | 0e3d763e | commit | ✓ |
| D | def512cb | commit | ✓ |
| F | fc89b0f1 | commit | ✓ |
| G | 40741cb8 | commit | ✓ |
| H | fb3f660a | commit | ✓ |
| I | 4eaf3e84 | commit | ✓ |
| J | cea10b67 | commit | ✓ |
| K | 9dc84080 | commit | ✓ |
| L | 29f87115 | commit | ✓ (= HEAD) |

The B→L program's commit claims are **TRUE**. Phase L is committed at HEAD.

## Baseline gates — VERIFIED (machine output, not asserted)
| Gate | Result | Notes |
|------|--------|-------|
| `pnpm typecheck test --filter=@letbuyy/theme-engine` | **643/643 pass**, 4 tasks | green |
| `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | **687/687 pass**, 20 tasks | green |
| `pnpm typecheck test --filter=@letbuyy/merchant-control-plane` | **14 tasks pass** | green |
| `pnpm typecheck --filter=@letbuyy/api-gateway` | **32 tasks pass** | green |
| `node scripts/validate-governance.mjs` | **EXIT=1** | see below |

### Governance validator — honest baseline
- Anti-fabrication gate: **PASS** (1260 active source files scanned, 0 fabricated/temporary entries).
- **FAILS on ONE validator only:** `Tenant isolation validator` — `services/api-gateway/src/tenant/tenant-tables.registry.ts` must match the schema-derived registry (`run scripts/generators/generate-tenant-table-registry.mjs`).
- **Classification: `PRE_EXISTING_FOREIGN_WIP`.** This drift predates M→AE and is unrelated to the theme program — it reflects the registry being out of sync with uncommitted schema WIP. Owner = whoever holds the tenant-schema WIP. This program will NOT regenerate the registry for foreign drift. When Phases P/W add new theme tenant tables, those additions must be registered correctly so they introduce **no new** tenant-isolation violation beyond this pre-existing one.

## Dirty-path classification (high level)
- `PRE_EXISTING_FOREIGN_WIP`: ~360 modified/untracked files from prior user work across apps/*, services/*, database/*, tests/launch/lb*.mjs (lb10-dispatch, lb12-registration, etc.), migrations 186/187 (untracked), tenant-tables.registry drift, next-env.d.ts auto-gen.
- `PRE_EXISTING_THEME_WIP`: untracked theme-engine files the build already depends on — `experience-fonts.ts`, `industry-experience-map.ts`, `theme-bundle-core.ts` + their `.test.ts`, `theme-presets.test.ts`. These are load-bearing (imported by committed index.ts) but remain the user's to commit.
- `PROGRAM_CREATED` / `PROGRAM_MODIFIED`: none yet (M→AE begins now).

## Program invariants (enforced every phase)
site_id isolation · forced RLS, no public USING(true) · gateway-only service role behind verifySiteOwnership · merchant ES256 ≠ customer HS256 · React default, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` · sanitizer locked · ART-17 (no new React-per-section) · frozen apps (theme-marketplace/app-marketplace/developer-portal/platform-operations-portal) untouched · money ledger untouched · no production deploy/migration/flag-flip.
