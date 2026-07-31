# 02 — LetBuyy Core Activation (Stream B)

**Status:** Alias + Core fixture complete (additive, safe); canonical runtime flip remains staging-gated.

`urban-kicks` is still the persisted canonical slug; real stores carry `sites.theme_id='urban-kicks'`, and `verification/055` + `first-party-liquid-portability` depend on it. The Phase-2 alias (`resolveCanonicalThemeSlug`, `isLetbuyyCoreThemeSlug`, `createLetbuyyCoreLiquidThemeBundleFixture`) makes `letbuyy-core` resolvable with zero breakage.

**Activation steps (documented, NOT executed — each is staging-gated or WIP-sequenced):**
1. Additive DB migration: `INSERT` a `themes` row `slug='letbuyy-core'` cloned from `urban-kicks`; keep `urban-kicks`; update `verification/055`. (Sequence with the untracked-186/187 migration cleanup — adding a migration now compounds the pre-existing untracked-migration gate failure.)
2. Switch compile/fallback defaults (`portable-to-liquid.ts`, `store-service.ts`) to the Core fixture — changes branding for all newly-compiled stores → must be visually verified on staging.
3. Regenerate the Core seed bundle + marketing/demo copy (cosmetic).

**Compatibility:** preserved unconditionally — existing stores resolve via the retained `urban-kicks` row; `resolveCanonicalThemeSlug`/`isLetbuyyCoreThemeSlug` treat both as the same Core theme. No persisted identifier changed.

**Verdict:** activation is a low-code, sequencing-sensitive, staging-verified follow-up. Not flipped here to guarantee no existing-store breakage + because the result needs visual verification.
