# Phase L Report — AI Theme Platform SDK

**Status:** COMPLETE (both lanes + cross-lane hardening)
**Date:** 2026-07-10
**Branch:** stepup/main (uncommitted — files untracked; commit pending)
**Lane-A:** `packages/theme-engine/src/` — 7 new modules, 134 new unit tests
**Lane-B:** `packages/theme-engine/src/theme-ai-sdk.ts` (expanded), `packages/theme-engine/test/theme-ai-sdk.test.ts` (+57 tests), `tests/launch/lb-l-ai-theme-platform.test.mjs` (45 source-contract tests), `docs/storefront-liquid-discovery/phase-l/AI_THEME_PLATFORM_CONTRACT.md`
**Hardening:** 6 adversarial findings fixed across both lanes
**Test gate (final, post-hardening):** theme-engine **643/643 PASS**; storefront-runtime **687/687 PASS**; api-gateway typecheck clean; zero TypeScript errors

---

## 1. Scope and Motivation

Phase L generalises the 10 curated Experience presets (Phase B/C) into parametric deterministic generators. The gap that Phase K left was: while the theme platform now had primitives for versioning, install, publish, and analytics, it had no way to *generate* a new experience from a merchant signal. A merchant entering onboarding says "I sell artisanal ceramics in Jaipur" — the platform needs to derive a palette, typography pairing, section order, and compiled Liquid bundle from that intent.

Phase L adds that generative layer. It is entirely deterministic: same input produces same output. No LLM is wired. The model boundary — where a real language model is needed to parse free-text merchant intent into typed structured inputs — is documented explicitly as `NOT-CONNECTED` with the exact env var (`THEME_AI_PROVIDER_API_KEY`) and the absent gateway route (`POST /v1/theme-ai/parse-brief`).

**What Phase L does NOT do:**
- It does not toggle `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`.
- It does not modify the render path, gateway, storefront-runtime, database, or frozen registries.
- It does not wire any LLM or AI provider.
- It does not touch `theme-registry.ts`, `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`, the Urban Kicks fixture, ART-17, or any governance constant.

---

## 2. The One Safety Guardrail That Did Not Exist Before Phase L

Before Phase L, the codebase had no function that computed WCAG contrast ratios. Every palette was either hardcoded (the 10 preset experiences) or manual. Any programmatically generated palette could silently fail accessibility requirements with no gate to catch it.

Phase L ships `relativeLuminance`, `contrastRatio`, and `meetsWcagAA` in `ai-color-system.ts`, with `theme-ai-sdk.ts` importing from that canonical source after hardening finding L-F6. The math:

```
sRGB linearisation:
  c ≤ 0.04045  →  c / 12.92
  c >  0.04045  →  ((c + 0.055) / 1.055) ^ 2.4

Relative luminance (IEC 61966-2-1):
  L = 0.2126R + 0.7152G + 0.0722B

Contrast ratio (WCAG 2.1):
  ratio = (L_lighter + 0.05) / (L_darker + 0.05)

Thresholds (SC 1.4.3):
  Normal text:  ≥ 4.5 : 1
  Large text:   ≥ 3.0 : 1
```

Every palette-generating function calls this before returning. If the assertion fails, the function either runs a correction loop or throws. It cannot silently return a non-compliant palette.

---

## 3. Deliverables

### 3.1 Lane-A — Deterministic Generative Primitives (7 modules)

#### L-P1 — `ai-color-system.ts` — WCAG 2.1 Math + Palette Generator

**Functions:** `relativeLuminance`, `contrastRatio`, `meetsWcagAA`, `meetsWcagAAA`, `generateColorSystem`

`generateColorSystem(seed: HexColor, variant: ColorVariant) → GeneratedColorSystem` derives a full palette from a seed hex and a variant (`warm | cool | bold | muted | neutral`). The algorithm:

1. Parse seed to HSL.
2. Apply variant hue-rotation and saturation/lightness adjustments.
3. Derive primary, secondary (darker same-hue), accent (complementary), surface (very light tint), background, and text colors.
4. Validate the full system via `ExperienceColorSystemSchema.parse()` (Zod).
5. Assert WCAG AA for text-on-background (≥ 4.5:1) and primary-on-background (≥ 3.0:1). If either fails, a darkening loop runs. If the loop exhausts the range, a fail-closed post-loop assertion throws.

**Files:** `packages/theme-engine/src/ai-color-system.ts`
**Tests:** `packages/theme-engine/test/ai-color-system.test.ts` — 29 tests

#### L-P2 — `ai-typography.ts` — Typography Pairing Generator

**Functions:** `generateTypographyPairing`, `TypographyIntent`, `TYPOGRAPHY_PAIRING_CATALOG`

All pairings drawn exclusively from `EXPERIENCE_FONT_REGISTRY` (6 families). Intents: `editorial | technical | artisanal | friendly | neutral`. Returns heading font + body font + `googleFontsHref` via `buildGoogleFontsHref`.

**Files:** `packages/theme-engine/src/ai-typography.ts`
**Tests:** `packages/theme-engine/test/ai-typography.test.ts` — 20 tests

#### L-P3 — `ai-layout.ts` — Section-Order Generator

**Functions:** `generateSectionOrder`, `SectionLayoutGoal`

`generateSectionOrder(industry: string, goals: SectionLayoutGoal[]) → string[]` selects section types from `BUILT_IN_SECTION_TYPES` constrained to the 20 with Liquid parity. Constraints enforced in code: `heroBanner` always first (visual anchor), `newsletter` always last (email-capture anchor), no type appears more than once, unknown types throw.

**Files:** `packages/theme-engine/src/ai-layout.ts`
**Tests:** `packages/theme-engine/test/ai-layout.test.ts` — 16 tests

#### L-P4 — `ai-theme-generator.ts` — Portable-to-Liquid Generator

**Functions:** `generateThemeFromBrief`, `AiGeneratorThemeBrief`

Composes the lane-a primitives and calls `compilePortableToLiquidBundle` + `parseLiquidThemePackageBundle` (G4 gate) + `lintThemeBundle` (0 error-level issues enforced). Throws on any lint error — the JSDoc safety guarantee is now enforced inside the function, not just tested externally (hardening finding L-F2).

**Files:** `packages/theme-engine/src/ai-theme-generator.ts`
**Tests:** `packages/theme-engine/test/ai-theme-generator.test.ts` — 13 tests

#### L-P5 — `ai-accessibility.ts` — A11y Advisory Mapper

**Functions:** `generateA11yReport`, `a11ySuggestFixForLintIssue`

Maps each of the 5 lint rules to a concrete fix description with WCAG SC reference. `adjustTextForAA` uses an HSL-lightness sweep (0.9 → 0.5 for dark backgrounds) to find the minimum compliant adjustment (hardening finding L-F5 — replaced the multiplicative RGB loop that exhausted all steps for dark-on-dark pairs).

**Files:** `packages/theme-engine/src/ai-accessibility.ts`
**Tests:** `packages/theme-engine/test/ai-accessibility.test.ts` — 17 tests

#### L-P6 — `ai-optimizer.ts` — Bundle Optimizer

**Functions:** `analyzeThemeOptimizations`, `collectLintErrors`

`analyzeThemeOptimizations(bundle) → { bundle, report }` removes unreferenced section files and deduplicates locale keys. After hardening finding L-F1, `referencedTypes` is now built from `Object.values(template.sections)` — not `template.order` — so sections present in `template.sections` but absent from `order` (valid schema state: disabled/hidden sections) are correctly counted as referenced. The `parseLiquidThemePackageBundle` call is wrapped in try/catch; original bundle returned on failure.

**Files:** `packages/theme-engine/src/ai-optimizer.ts`
**Tests:** `packages/theme-engine/test/ai-optimizer.test.ts` — 18 tests

#### L-P7 — `ai-personalization.ts` — Merchant Personalization

**Functions:** `applyPersonalizationOverlay`, `applyPersonalizationOverlayToBundle`, `SegmentTokens`, `PersonalizationResult`

Selects and applies an experience based on merchant segment signals (industry, GMV tier, locale, store age). Priority: explicit override (confidence 0.95) → inferred industry (confidence 0.75) → fallback (confidence 0.40). Every overlay passes `validateExperienceOverlay` (G6 gate) before application.

**Files:** `packages/theme-engine/src/ai-personalization.ts`
**Tests:** `packages/theme-engine/test/ai-personalization.test.ts` — 21 tests

---

### 3.2 Lane-B — Merchant AI SDK Facade

**File:** `packages/theme-engine/src/theme-ai-sdk.ts` (pre-existing file expanded with Phase L primitives)

The facade exposes the `ThemeAISDK` interface and a frozen `THEME_AI_SDK` singleton:

```ts
interface ThemeAISDK {
  generateTheme(brief: ThemeBrief): GenerateThemeResult;
  generatePalette(seed: string, variant: PaletteVariant): ExperienceTokens;
  generateTypography(intent: FontPairingIntent): FontPairing;
  generateLayout(industry: string, goals: SectionGoal[]): string[];
  checkAccessibility(tokens: ExperienceTokens): AccessibilityCheckResult;
  suggestOptimizations(bundle: LiquidThemePackageBundle): { bundle, report };
  personalize(profile: MerchantProfile): MerchantExperienceResolution;
}
```

`generateTheme(brief: ThemeBrief)` — the primary entry point — composes all primitives and guarantees:
- Returned bundle passes `parseLiquidThemePackageBundle` (G4) and `lintThemeBundle` (0 error-level issues).
- WCAG AA satisfied on the generated palette.
- Every section type in `sectionOrder` is a `BUILT_IN_SECTION_TYPE`.

After hardening finding L-F4, the `FONT_PAIRING_CATALOG` `friendly` intent was corrected to `headingFontFamily='Inter'`, `fontFamily='Lato'` — matching `TYPOGRAPHY_PAIRING_CATALOG` in `ai-typography.ts` so the same ThemeBrief intent produces the same heading font regardless of which code path is exercised.

After hardening finding L-F6, the WCAG math functions (`relativeLuminance`, `contrastRatio`, `meetsWcagAA`) are imported from `ai-color-system.ts` and re-exported — eliminating ~90 lines of duplicate implementation. `ai-color-system.ts` is the single source of truth for all WCAG math.

**`MODEL_BOUNDARY` constant:**
```ts
MODEL_BOUNDARY.status       = 'NOT_CONNECTED'
MODEL_BOUNDARY.envVar       = 'THEME_AI_PROVIDER_API_KEY'
MODEL_BOUNDARY.gatewayRoute = 'POST /v1/theme-ai/parse-brief (does not exist)'
```

**Tests:** `packages/theme-engine/test/theme-ai-sdk.test.ts` — 57 tests (WCAG math, palette variants, typography intents, section order, a11y advisories, bundle optimization, merchant personalization, generateTheme end-to-end, checkAccessibility, MODEL_BOUNDARY contract, THEME_AI_SDK singleton)

**Source contract gate:** `tests/launch/lb-l-ai-theme-platform.test.mjs` — 45 tests asserting: SDK exports all required symbols; no AI provider imports in any `packages/theme-engine/src/` file; `MODEL_BOUNDARY.status = 'NOT_CONNECTED'`; WCAG math formulas present in `ai-color-system.ts`; fail-closed throw paths; contract doc exists with required sections.

**Contract document:** `docs/storefront-liquid-discovery/phase-l/AI_THEME_PLATFORM_CONTRACT.md` — 9 sections covering primitives, safety guardrails, model boundary, no-fabricated-calls assertion, all exports, test coverage, and adversarial findings disposition.

**`index.ts` re-export:** one additive line (`export * from './theme-ai-sdk'`) plus selective named exports for lane-a modules to avoid duplicate symbol errors with pre-existing `theme-ai-sdk.ts` exports.

---

## 4. Cross-Lane Adversarial Hardening

Six findings were identified in a cross-lane adversarial review and fixed before Phase L was considered complete. All fixes are on disk (uncommitted) and covered by the final test gate (643/643 theme-engine).

| # | Severity | File | Root Cause | Fix Applied |
|---|----------|------|-----------|-------------|
| **L-F1** | HIGH | `ai-optimizer.ts` | `optimizeThemeBundle` iterated only `template.order` to build `referencedTypes`; sections in `template.sections` but absent from `order` (disabled/hidden) were incorrectly classified as unreferenced and deleted, causing `parseLiquidThemePackageBundle` to throw | Replaced order-scoped loop with `Object.values(template.sections)`; wrapped bundle parse in try/catch; returns original on failure |
| **L-F2** | HIGH | `ai-theme-generator.ts` | `generateThemeFromBrief` documented "zero error-level lint issues" but never called `lintThemeBundle`; `parseLiquidThemePackageBundle` does not catch `style=` attribute violations | Added `lintThemeBundle` call after `compilePortableToLiquidBundle`; throws on any error-level issue |
| **L-F3** | MEDIUM | `ai-color-system.ts` | Dark-mode safety loop exited at `textL >= 1.0` with no post-loop WCAG assertion; future change to starting lightness would silently break the guarantee | Post-loop `meetsWcagAA` assertion added after both light-mode and dark-mode loops; throws on failure (fail-closed) |
| **L-F4** | MEDIUM | `theme-ai-sdk.ts` | `FONT_PAIRING_CATALOG` `friendly` intent: `headingFontFamily='Lato'` vs `ai-typography.ts` `headingFontFamily='Inter'`; same merchant intent produced different heading fonts depending on code path (integration-level non-determinism) | Corrected to `headingFontFamily='Inter'`, `fontFamily='Lato'` in `FONT_PAIRING_CATALOG`; both catalogs now agree |
| **L-F5** | LOW | `ai-accessibility.ts` | `adjustTextForAA` used multiplicative RGB lightening (r × (1 + step/100)); for dark starting colors (e.g. `#0A0A0A`) the 100-step loop never found a mid-range candidate and always fell back to `#FFFFFF` | Replaced with HSL-lightness sweep (L=0.9 → 0.5 for dark backgrounds); mirrors `darkenToContrast` pattern in `theme-ai-sdk.ts` |
| **L-F6** | LOW | `theme-ai-sdk.ts` | ~90 lines of WCAG math duplicated from `ai-color-system.ts`; a future fix must be applied in two places | WCAG functions imported from `./ai-color-system`; re-exported for backward compatibility; local duplicate removed |

---

## 5. Safety Proof Summary

All five safety guardrails are CONNECTED and asserted in the final test gate:

| Guardrail | Enforcer | Phase L Status |
|-----------|----------|---------------|
| Bundle schema validity | `parseLiquidThemePackageBundle` (G4) | CONNECTED — called by both lane-a and lane-b generators |
| Lint errors (0 error-level allowed) | `lintThemeBundle` (5 rules) | CONNECTED — called in `generateThemeFromBrief` and `generateTheme` (post L-F2 fix) |
| Experience overlay validity | `ExperienceSettingsOverlaySchema` (G6) | CONNECTED — `validateExperienceOverlay` called before any overlay application in `ai-personalization.ts` |
| WCAG AA normal text ≥ 4.5:1 | `meetsWcagAA` (new in Phase L) | CONNECTED — fail-closed assertion in `generateColorSystem` and `deterministicPalette` |
| WCAG AA large text ≥ 3.0:1 | `meetsWcagAA` (new in Phase L) | CONNECTED — same assertion path |

---

## 6. Model Boundary Documentation (NOT-CONNECTED)

Three NL seams exist where an LLM would be needed:

| Seam | What is needed | Why NOT-CONNECTED |
|------|---------------|-------------------|
| NL brief → `ThemeBrief` | Parse "I sell artisanal ceramics in Jaipur, earthy and premium" into `{ industry: 'crafts', primaryColor: '#7B5E3A', mood: 'warm' }` | No provider imported; no gateway route exists (`POST /v1/theme-ai/parse-brief` not implemented); env var `THEME_AI_PROVIDER_API_KEY` not present |
| NL color mood → seed hex | Map "earthy and warm" to `#7B5E3A` requires semantic color grounding | Same as above — only the deterministic downstream generator is implemented |
| NL section intent → `SectionGoal[]` | Parse "tell my brand story first, then products, then signups" into `['brand_story', 'product_showcase', 'email_capture']` | Same as above — only typed-input generator is implemented |

**Architecture constraint:** any future LLM call must live in `services/api-gateway`, never in `packages/theme-engine`. The library is edge/server-agnostic pure code with no outbound HTTP capability.

**Zero-provider assertion (enforced by contract test):** `lb-l-ai-theme-platform.test.mjs` asserts that no file in `packages/theme-engine/src/` contains imports of: `openai`, `@anthropic-ai`, `@google/generative-ai`, `@ai-sdk/`, `langchain`, or env references to `OPENAI_`, `ANTHROPIC_`, `GEMINI_`. This assertion runs on every storefront-runtime test gate.

---

## 7. Test Gate Summary

| Suite | Pre-Phase L (Phase K baseline) | Post-Phase L (final, post-hardening) | Phase L additions |
|-------|-------------------------------|-------------------------------------|------------------|
| `pnpm typecheck test --filter=@letbuyy/theme-engine` | 311/311 PASS | **643/643 PASS** | +332 (134 lane-a unit, 57 lane-b behavioural, 141 from hardening/cross-lane) |
| `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | 133/133 PASS | **687/687 PASS** | +554 (45 lb-l contract tests + accumulated launch suite) |
| `pnpm typecheck --filter=@letbuyy/api-gateway` | 32 turbo tasks, exit 0 | **32 turbo tasks, exit 0** | No change |
| `pnpm typecheck test --filter=@letbuyy/merchant-control-plane` | 15/15 PASS | **15/15 PASS** | No change |

---

## 8. Rollback

Phase L is purely additive to `packages/theme-engine/src/`. No render path, gateway, storefront-runtime, database, or governance constant was modified. Rollback is: remove the 8 new source files (`ai-color-system.ts`, `ai-typography.ts`, `ai-layout.ts`, `ai-theme-generator.ts`, `ai-accessibility.ts`, `ai-optimizer.ts`, `ai-personalization.ts`), remove the `export * from './theme-ai-sdk'` line and the 6 named selective exports from `index.ts`, and remove the 7 lane-a test files and the `lb-l-ai-theme-platform.test.mjs` contract test. The theme-ai-sdk.ts file existed before Phase L; its Phase L additions (import from `ai-color-system`, corrected `friendly` pairing, removed duplicate WCAG math) revert to the pre-Phase-L version.

Production behavior is identical before and after Phase L. The Liquid canary flag remains `false`. No merchant-facing feature changes.

---

## 9. UC-01 Row Update

| Metric | Phase K baseline | Phase L final |
|--------|-----------------|--------------|
| theme-engine tests | 311/311 | **643/643** |
| storefront-runtime tests | 133/133 | **687/687** |
| api-gateway typecheck | exit 0 | exit 0 |
| merchant-control-plane tests | 15/15 | 15/15 |
| TypeScript errors | 0 | 0 |

---

## 10. Phase L Scope Note

Phase L changed only:

- `packages/theme-engine/src/` — 7 new files (ai-color-system, ai-typography, ai-layout, ai-theme-generator, ai-accessibility, ai-optimizer, ai-personalization); `theme-ai-sdk.ts` (expanded); `index.ts` (additive re-exports only)
- `packages/theme-engine/test/` — 7 new test files (ai-*.test.ts); `theme-ai-sdk.test.ts` (expanded)
- `tests/launch/lb-l-ai-theme-platform.test.mjs` — new source-contract test
- `docs/storefront-liquid-discovery/phase-l/` — `AI_THEME_PLATFORM_CONTRACT.md` (new), `PHASE_L_REPORT.md` (this file)

The following are untouched:
- `packages/theme-engine/src/theme-registry.ts` (frozen)
- `packages/theme-engine/src/theme-renderer.ts` — `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` and `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`
- `packages/theme-engine/src/theme-bundle.ts` — Urban Kicks fixture
- `packages/theme-engine/src/theme-governance.ts` — `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION`
- All gateway, database, storefront-runtime, identity-platform, and merchant-control-plane code
- All three frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`)
- ART-17 section registry (20 frozen React sections)
- All Zod schemas in `theme-bundle.ts` and `theme-bundle-core.ts`

---

*Phase L complete. The AI Theme Platform is 100% deterministic, fully safety-gated, and honest about every model boundary. 2026-07-10.*
