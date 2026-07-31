# Stream B — LetBuyy Core Activation — Report

**Status:** 🟡 Alias + Core fixture complete (additive, safe); canonical runtime flip is **staging-gated** (not executed here).

## Current canonical identity
`urban-kicks` remains the persisted canonical theme slug. Real stores carry `sites.theme_id = 'urban-kicks'`; the `themes` row + the `first-party-liquid-portability` governance test + `verification/055` all depend on it. The Phase-2 alias makes `letbuyy-core` resolvable alongside it.

## Done (safe, additive, verified)
- `createLetbuyyCoreLiquidThemeBundleFixture()` (neutral-branded Core bundle), `resolveCanonicalThemeSlug()`, `isLetbuyyCoreThemeSlug()` — tested (6/6), additive, Urban Kicks fixture untouched.
- Editor default theme name `'Urban Kicks'` → `'LetBuyy Core'` (merchant-visible).

## Activation strategy (the canonical flip — documented, staging-gated)
To make `letbuyy-core` canonical with **zero store breakage**:
1. **Additive DB migration** — `INSERT` a `themes` row `slug='letbuyy-core'` cloned from `urban-kicks`; **keep** the `urban-kicks` row; update `verification/055` to accept either. (Additive `ON CONFLICT DO NOTHING`.)
2. **Switch new-store/compile defaults** to the Core fixture/slug: `compilePortableToLiquidBundle()` (`portable-to-liquid.ts`) base fixture, and the `store-service.ts` fallback (`|| 'urban-kicks'` → `|| 'letbuyy-core'`). Existing stores keep resolving via the retained `urban-kicks` row + `resolveCanonicalThemeSlug`.
3. **Regenerate** the Core seed bundle; update marketing/demo copy (cosmetic).

## Why staging-gated (not executed here)
- The migration **cannot be verified live** (no DB in this environment), and the working tree's migration chain already has a **pre-existing untracked-186** failure — adding another migration must be sequenced with that cleanup, not stacked onto it.
- The compile/fallback switch changes branding for **all newly-compiled stores** — a behaviour change that must be visually verified on staging (existing-store regression, new-store branding, editor, publish, runtime rendering) before it goes canonical.

## Compatibility (preserved regardless)
The alias layer means existing stores never break: `urban-kicks` stays resolvable; new code adopts `letbuyy-core`; `resolveCanonicalThemeSlug`/`isLetbuyyCoreThemeSlug` treat both as the same Core theme. **No persisted identifier was changed.**
