# Stream D — Font System — Report

**Status:** 🟡 CORE DONE + tested; head-wiring documented (the reusable engine is complete; emitting the `<link>` in the storefront heads + cross-device verification remain)

## What shipped
- **NEW** `packages/theme-engine/src/experience-fonts.ts` — `EXPERIENCE_FONT_REGISTRY` (6 families: Inter, Playfair Display, Cormorant Garamond, Libre Baskerville, Source Sans Pro, Lato) with Google Fonts specs + fallback stacks, and:
  - `buildExperienceFontLinkHref(experience)` → the `https://fonts.googleapis.com/css2?family=…&display=swap` stylesheet href the head should inject (or `null` for system-only).
  - `buildGoogleFontsHref(families)`, `collectExperienceFontFamilies()`, `fontFamilyWithFallback()`, `collectExperienceFontIssues()`.
- Barrel-exported from `@letbuyy/theme-engine`.

## Why this matters
Before this, experiences naming non-system fonts (Sense→Playfair Display, Aura→Cormorant Garamond, Craft/Dawn→Libre Baskerville, Aura→Lato, Craft/Dawn→Source Sans Pro) silently fell back to system-ui. The registry guarantees a real, loadable spec for every font any experience references (`collectExperienceFontIssues() === []`, enforced by tests).

## Evidence
`packages/theme-engine/test/experience-fonts.test.ts` — 6 tests: every experience font is registered; each experience yields a valid `css2?...&display=swap` href or a system-only load; Sense emits Playfair Display + Inter; dedupe + unknown-family + empty handling; fallback stacks. theme-engine suite 82/82.

## Remaining integration (the wiring — documented, not yet applied)
The registry is the shared core; two heads must inject the link:
1. **React storefront** (`apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx`): in `generateMetadata`/the head, add `<link rel="stylesheet" href={buildExperienceFontLinkHref(...)} />` (or `next/font`) derived from the resolved `themeSettings.headingFontFamily`/`fontFamily`. A `FONT_MAP` already maps font names → CSS vars there; this supplies the actual `@font-face` source.
2. **Liquid head** (`packages/theme-engine/src/theme-renderer.ts` `buildLiquidThemeHeadAssets`): prepend the same `<link>` to `content_for_header`.

These two edits + **cross-device verification (desktop/tablet/mobile)** on the running stack are the remaining work to fully close Stream D. Deferred here because both target files are pre-existing WIP-modified and font rendering can only be confirmed visually with the stack.
