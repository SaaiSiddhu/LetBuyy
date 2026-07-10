# Phase L — AI Theme Platform Contract

**Status:** IMPLEMENTED (Lane B complete)
**Module:** `packages/theme-engine/src/theme-ai-sdk.ts`
**Gate file:** `tests/launch/lb-l-ai-theme-platform.test.mjs`
**Date:** 2026-07-10

---

## 1. Overview

Phase L generalises the 10 curated Experience presets (Phase B/C) into parametric
deterministic generators wrapped behind a Merchant AI SDK facade. The platform is
honest about what is and is not connected:

- **Deterministic generative primitives** (CONNECTED, fully implemented): WCAG contrast
  math, parametric palette generation, typography pairing, section-order generation,
  A11y advisories, bundle optimisation, merchant personalisation.
- **LLM / AI generation provider** (NOT-CONNECTED): the natural-language-brief →
  structured-input seam requires a real model. No provider is imported or wired. The
  env var that would connect it is `THEME_AI_PROVIDER_API_KEY`. The gateway route that
  would call it (`POST /v1/theme-ai/parse-brief`) does not exist.

Everything Phase L ships is deterministic: same input → same output. It is tested.

---

## 2. Deterministic Generative Primitives

### 2.1 WCAG 2.1 Contrast Math

Functions: `relativeLuminance(hex)`, `contrastRatio(hex1, hex2)`, `meetsWcagAA(fg, bg, largeText?)`

These implement the WCAG 2.1 relative-luminance formula:

```
sRGB linearisation:
  c <= 0.04045  →  c / 12.92
  c >  0.04045  →  ((c + 0.055) / 1.055) ^ 2.4

Relative luminance:
  L = 0.2126R + 0.7152G + 0.0722B  (on linearised channels)

Contrast ratio:
  ratio = (L_lighter + 0.05) / (L_darker + 0.05)

WCAG 2.1 AA thresholds:
  Normal text:  ratio >= 4.5 : 1  (SC 1.4.3)
  Large text:   ratio >= 3.0 : 1  (SC 1.4.3)
```

This is the **one safety guardrail** that did not exist before Phase L.

### 2.2 Parametric Palette Generator

Function: `deterministicPalette(seed: HexColor, variant: PaletteVariant) → ExperienceTokens`

**Variants:** `warm | cool | bold | muted | neutral`

The generator:
1. Parses the seed colour to HSL.
2. Applies variant-specific hue-rotation + saturation/lightness adjustments.
3. Derives secondary (darker same-hue), accent (complementary hue), surface (very light tint).
4. Derives text colour at HSL L=0.10 (near-dark with slight hue tint).
5. Validates the full token set via `ExperienceTokensSchema.parse()` (G6).
6. **Asserts WCAG AA before returning (fail-closed):**
   - `textColor` on `backgroundColor` >= 4.5 : 1 (normal text)
   - `primaryColor` on `backgroundColor` >= 3.0 : 1 (large text / headings)
   If either assertion fails, a darkening loop runs until the threshold is met. Last resort: `#111111`.

**Guarantee:** the generator never emits a palette that violates WCAG AA. If it somehow did,
it throws rather than returning invalid data.

### 2.3 Typography Pairing

Functions: `suggestTypographyPairing(intent: FontPairingIntent) → FontPairing`, `FONT_PAIRING_CATALOG`

**Intents:** `editorial | technical | artisanal | friendly | neutral`

All pairings are drawn exclusively from `EXPERIENCE_FONT_REGISTRY` (6 families: Inter,
Playfair Display, Cormorant Garamond, Libre Baskerville, Source Sans Pro, Lato).
Every pairing includes a `googleFontsHref` computed via `buildGoogleFontsHref`.

### 2.4 Section-Order Generator

Function: `generateSectionOrder(industry: string, goals: SectionGoal[]) → string[]`

**Goals:** `brand_story | product_showcase | trust_building | email_capture | social_proof | engagement`

Constraints (all enforced in code):
- Every emitted type is a member of `BUILT_IN_SECTION_TYPES` with Liquid parity.
- `heroBanner` is always first (visual anchor).
- `newsletter` is always last (email-capture anchor).
- No type appears more than once (deduplication set).
- Unknown section types cause a throw — the generator cannot emit unregistered types.

### 2.5 A11y Advisory Mapper

Function: `a11yAdvisories(lintIssues: ThemeLintIssue[]) → A11yAdvisory[]`

Maps each of the 5 lint rules to a concrete, actionable fix description including
the specific WCAG success criterion (where applicable). The WCAG references:
- `forbidden-attr` (style=) → SC 1.4.3 Contrast (use `--lb-*` tokens)
- `forbidden-tag` (<script>, etc.) → SC 4.1.2 Name, Role, Value
- `setting-referenced-not-in-schema` → SC 1.1.1 Non-text Content (alt/aria-label)

### 2.6 Bundle Optimiser

Function: `optimizeThemeBundle(bundle) → { bundle: LiquidThemePackageBundle, report: OptimizationReport }`

Steps:
1. Collects all section types referenced across `templates.*.sections.*.type`.
2. Removes section files in `bundle.sections` not in the referenced set.
3. **Validates via `parseLiquidThemePackageBundle` before returning.**
4. If the trimmed bundle fails validation, returns the original unmodified.

**Guarantee:** the optimiser can never emit an invalid bundle.

### 2.7 Merchant Personalisation

Function: `selectExperienceForMerchant(profile: MerchantProfile) → MerchantExperienceResolution`

Precedence:
1. `preferredExperienceId` (explicit choice, confidence 0.95)
2. `industry` → `INDUSTRY_EXPERIENCE_MAP` (confidence 0.75)
3. Fallback: Summit / General (confidence 0.40)

Returns a `reasoning` string explaining the selection path.

---

## 3. Merchant AI SDK Facade

Module export: `THEME_AI_SDK` (frozen singleton), individual functions also exported.

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

`generateTheme(brief: ThemeBrief)` is the primary entry point. It composes all
primitives and guarantees:
- Returned bundle passes `validateTheme()` and `lintTheme()` with **0 error-level issues**.
- WCAG AA is satisfied on the generated palette.
- Every section type in `sectionOrder` is a `BUILT_IN_SECTION_TYPE`.

---

## 4. Safety Guardrails (all enforced, all real)

| Guardrail | Enforcer | Phase L status |
|-----------|----------|---------------|
| Bundle schema validity | `parseLiquidThemePackageBundle` (G4) | CONNECTED |
| Lint errors (0 allowed) | `lintThemeBundle` (5 rules) | CONNECTED |
| Experience overlay validity | `ExperienceSettingsOverlaySchema` (G6) | CONNECTED |
| WCAG AA normal text ≥ 4.5:1 | `meetsWcagAA` (new in Phase L) | CONNECTED |
| WCAG AA large text ≥ 3.0:1 | `meetsWcagAA` (new in Phase L) | CONNECTED |

---

## 5. The Model Boundary (NOT-CONNECTED)

The `MODEL_BOUNDARY` constant documents the exact seam where an LLM plugs in:

```ts
MODEL_BOUNDARY.status        // 'NOT_CONNECTED'
MODEL_BOUNDARY.envVar        // 'THEME_AI_PROVIDER_API_KEY'
MODEL_BOUNDARY.gatewayRoute  // 'POST /v1/theme-ai/parse-brief (does not exist)'
```

**Three NOT-CONNECTED seams:**

1. **NL brief → ThemeBrief**
   A merchant typing "I sell artisanal leather bags in Jaipur, earthy feel" needs an LLM
   to extract `{ industry: 'furniture', primaryColor: '#3E2723', mood: 'muted' }`.
   The downstream `generateTheme(brief)` is fully deterministic from this struct.

2. **NL colour mood → seed hex**
   "Earthy and warm" → `#3E2723` requires semantic colour grounding.
   `deterministicPalette(seed, variant)` takes a typed seed; only seed selection needs a model.

3. **NL section intent → SectionGoal[]**
   "Tell my brand story first, then showcase products, then drive signups"
   → `['brand_story', 'product_showcase', 'email_capture']` requires NL parsing.
   `generateSectionOrder(industry, goals)` takes typed goals; only NL→enum needs a model.

**Architecture constraint:** the provider call must live in `services/api-gateway`
(never in `packages/theme-engine`). The library is edge/server-agnostic pure code
with no outbound HTTP capability or credential access.

---

## 6. No Fabricated Model Calls

The contract test (`lb-l-ai-theme-platform.test.mjs`) asserts that no file in
`packages/theme-engine/src/` contains real AI provider imports. Specifically, none of:
- `openai`, `@anthropic-ai`, `@google/generative-ai`, `@ai-sdk/`
- `ai-sdk`, `langchain`, `llm`, `gpt`, `claude`, `gemini`
- `process.env.OPENAI_`, `process.env.ANTHROPIC_`, `process.env.GEMINI_`

are present in any source file. Every function that appears to do "AI generation" is
a deterministic algorithm (hue-rotation math, catalogue lookup, set intersection) with
no LLM dependency.

---

## 7. Exports from @letbuyy/theme-engine

All Phase L symbols are exported from `packages/theme-engine/src/index.ts`:

```ts
// WCAG math
relativeLuminance, contrastRatio, meetsWcagAA
// Palette
PaletteVariant, deterministicPalette
// Typography
FontPairingIntent, FontPairing, FONT_PAIRING_CATALOG, suggestTypographyPairing
// Layout
SectionGoal, generateSectionOrder
// A11y
A11yAdvisory, a11yAdvisories
// Optimizer
OptimizationReport, optimizeThemeBundle
// Personalization
MerchantProfile, MerchantExperienceResolution, selectExperienceForMerchant
// Facade
ThemeBrief, GenerateThemeResult, ThemeAISDK, generateTheme
checkAccessibility, MODEL_BOUNDARY, THEME_AI_SDK
```

---

## 8. Test Coverage

- **Theme-engine gate (packages/theme-engine):** `test/theme-ai-sdk.test.ts`
  Tests: 197 new tests (312 → 509 total). Run: `pnpm --filter @letbuyy/theme-engine test`.
- **Storefront-runtime gate (source contract):** `tests/launch/lb-l-ai-theme-platform.test.mjs`
  Tests: source-contract assertions (exports, no-provider-imports, contract-doc, MODEL_BOUNDARY).
  Run: `pnpm --filter @letbuyy/storefront-runtime test`.

---

## 9. Adversarial Findings and Hardening Disposition

Six findings were identified in a cross-lane adversarial review and fixed before Phase L was considered complete. All fixes are present on `stepup/main` and are covered by the test gate (643/643 theme-engine).

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| **L-F1** | HIGH | `ai-optimizer.ts` | `optimizeThemeBundle` iterated only `template.order` to build `referencedTypes`, silently dropping sections present in `template.sections` but absent from `order` (a valid schema state: disabled/hidden sections). The trimmed bundle then failed `parseLiquidThemePackageBundle` and threw instead of returning the original. | Replaced order-scoped loop with `Object.values(template.sections)`. Wrapped `parseLiquidThemePackageBundle` in try/catch; returns original bundle on failure. |
| **L-F2** | HIGH | `ai-theme-generator.ts` | `generateThemeFromBrief` JSDoc documented "zero error-level lint issues" but never called `lintThemeBundle`. `parseLiquidThemePackageBundle` does not catch `style=` attribute violations; a future section source change could silently return a lint-failing bundle. | Added `lintThemeBundle` call after `compilePortableToLiquidBundle`; throws on any error-level issue. The documented guarantee is now enforced inside the function. |
| **L-F3** | MEDIUM | `ai-color-system.ts` | Dark-mode safety loop exited when `textL >= 1.0` with no post-loop assertion that WCAG AA actually passed. `ExperienceColorSystemSchema.parse` validates hex format, not contrast math. A future change to starting lightness values would silently break the guarantee. | Post-loop `meetsWcagAA` assertion added after both light-mode and dark-mode loops; throws on failure with a diagnostic message (fail-closed). |
| **L-F4** | MEDIUM | `theme-ai-sdk.ts` | `FONT_PAIRING_CATALOG` `friendly` intent mapped `headingFontFamily='Lato'`, `fontFamily='Inter'`; `ai-typography.ts` `TYPOGRAPHY_PAIRING_CATALOG` mapped the reverse. Same merchant brief produced different heading fonts depending on which code path was used (integration-level non-determinism). | `FONT_PAIRING_CATALOG` `friendly` entry corrected to `headingFontFamily='Inter'`, `fontFamily='Lato'`. Both catalogs now agree. |
| **L-F5** | LOW | `ai-accessibility.ts` | `adjustTextForAA` used multiplicative RGB lightening (r × (1 + step/100)). For dark starting colors (e.g. `#0A0A0A`) the loop exhausted all 100 steps without finding a viable candidate and always fell back to `#FFFFFF`, skipping valid mid-range options like `#D0D0D0`. | Replaced with an HSL-lightness sweep (L=0.9 → 0.5 for dark backgrounds, L=current → 0.05 for light), matching `darkenToContrast` pattern in `theme-ai-sdk.ts`. |
| **L-F6** | LOW | `theme-ai-sdk.ts` | ~90 lines of WCAG math (`relativeLuminance`, `contrastRatio`, `meetsWcagAA`, helper functions) were duplicated from `ai-color-system.ts`. A future WCAG fix would need to be applied in two places. | `relativeLuminance`, `contrastRatio`, `meetsWcagAA` are now imported from `./ai-color-system` and re-exported for backward compatibility. `ai-color-system.ts` is the single source of truth for all WCAG math. |

All six findings are CLOSED. No finding remains open from Phase L.

---

*Phase L complete. The AI Theme Platform is deterministic generative code, not a pretend brain.*
