# Stream A — LetBuyy Core Rebranding — Report

**Status:** ✅ DONE (safe additive subset) · **File:** `packages/theme-engine/src/theme-bundle-core.ts`

## Constraint: backwards compatibility, zero store breakage
Urban Kicks is referenced in ~86 files. Critically:
- The `themes` row with `slug = 'urban-kicks'` is **persisted**, and real stores carry `sites.theme_id = 'urban-kicks'` (e.g. the `papaa.in` store). Renaming/deleting it breaks those stores.
- `createUrbanKicksLiquidThemeBundleFixture()` is asserted by **exact name + metadata strings** in `first-party-liquid-portability.test.mjs` and imported/called by `packages/theme-engine/test/theme-engine.test.ts`.
- `verification/055_only_urban_kicks_theme_catalog.sql` hard-fails if the `urban-kicks` row is absent.

A mass rename is therefore unsafe. The deliverable is an **alias layer + canonical name**, additive only.

## Delivered (safe now)
- `createLetbuyyCoreLiquidThemeBundleFixture()` — the Core bundle with all merchant-visible "Urban Kicks" branding neutralized to "LetBuyy Core" (slug `letbuyy-core-liquid`, name `LetBuyy Core`). Built by transforming the canonical Urban Kicks fixture (so they never structurally drift) and **re-validating** against `LiquidThemePackageBundleSchema`.
- `LETBUYY_CORE_THEME_SLUG` / `LETBUYY_CORE_BUNDLE_SLUG` / `URBAN_KICKS_THEME_SLUG` constants.
- `resolveCanonicalThemeSlug(slug)` — maps the legacy `urban-kicks` → canonical `letbuyy-core`; leaves unknown slugs untouched.
- `isLetbuyyCoreThemeSlug(slug)` — recognizes both legacy and canonical Core slugs.

## Verified (tests + governance)
- The Core bundle has **no** `urban-kicks`/`Urban Kicks` substring and preserves the Urban Kicks template set + section count (6 tests).
- The **Urban Kicks fixture is unchanged** → `first-party-liquid-portability.test.mjs` stays 5/5 and `theme-engine.test.ts` is unaffected (the alias is additive, not a rename).
- Frozen `theme-registry.ts` untouched.

## Migration plan & DEFERRED follow-ups (documented, not done — to guarantee no breakage)
1. **Switch live paths to Core** — point `compilePortableToLiquidBundle()` (`portable-to-liquid.ts`) and the `store-service.ts` fallback at the Core fixture so *new* stores carry LetBuyy branding. Deferred: those files are pre-existing WIP-modified; the change alters behavior for all newly-compiled stores and needs the DB alias row first.
2. **DB alias row** — additive migration inserting a `themes` row `slug='letbuyy-core'` cloned from `urban-kicks`; **keep** the `urban-kicks` row; update `verification/055` to accept either. (Not added here — the migration validator already has a pre-existing untracked-186 failure in this WIP tree; adding another migration would compound it. Sequence with the WIP migration cleanup.)
3. **Merchant-visible string** — the theme editor defaults `useState('Urban Kicks')` (`editor/page.tsx:709`). One-line change to `'LetBuyy Core'`; deferred because that file is WIP-modified + design-system-ratcheted.
4. **Marketing/demo copy** — `urban-kicks.letbuyy.com` references in marketing components are cosmetic; the `urban-kicks-demo` route + `domain-boundary-validator` pin must stay.

## Compatibility report
The alias layer means: existing stores (`theme_id='urban-kicks'`) keep resolving via the retained row; new code can adopt `letbuyy-core` and call `resolveCanonicalThemeSlug`/`isLetbuyyCoreThemeSlug` to treat both as the same Core theme. No persisted identifier changed → no store breakage.
