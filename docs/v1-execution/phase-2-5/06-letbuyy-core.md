# Stream F — LetBuyy Core Activation — Report

**Status:** 🟡 Alias + Core fixture done (Phase 2) + a merchant-visible string fixed; full runtime activation documented & deferred (no store breakage)

## Done
- **Phase 2:** `createLetbuyyCoreLiquidThemeBundleFixture()` (neutral-branded Core bundle) + `resolveCanonicalThemeSlug()` / `isLetbuyyCoreThemeSlug()` (the `urban-kicks`→`letbuyy-core` alias), all additive + tested. The Urban Kicks fixture and the persisted `urban-kicks` slug are untouched (zero store breakage; the first-party-liquid-portability governance test still passes).
- **Phase 2.5:** the theme editor's default theme name is now `'LetBuyy Core'` (was `'Urban Kicks'`) — a merchant-visible string fix.

## Compatibility report
Existing stores carry `sites.theme_id = 'urban-kicks'`; the retained `themes` row keeps them resolving. New code adopts `letbuyy-core` and uses `resolveCanonicalThemeSlug`/`isLetbuyyCoreThemeSlug` to treat both as the same Core theme. **No persisted identifier changed.**

## Deferred activation (documented — sequence with the WIP migration cleanup)
To make `letbuyy-core` the canonical runtime identity, three steps remain (all carry store-breakage or WIP-bundling risk in this tree, so they were not applied here):
1. **Switch live compile/fallback paths** to the Core fixture: `compilePortableToLiquidBundle()` (`portable-to-liquid.ts`) and the `store-service.ts` theme fallback. (Both files are pre-existing WIP-modified.)
2. **Additive DB alias migration** — insert a `themes` row `slug='letbuyy-core'` cloned from `urban-kicks`; keep the `urban-kicks` row; update `verification/055` to accept either. (Not added: the migration tree already has a pre-existing untracked-186 failure; sequence with that cleanup.)
3. **Regenerate** the Core seed bundle + update marketing/demo copy (cosmetic).

## Verdict
The compatibility layer and the canonical Core artifact exist and are safe. Flipping the runtime default is a low-code, sequencing-sensitive follow-up — intentionally deferred to guarantee no existing-store breakage.
