# Phase AC — Test Report: AI-Assisted Theme Customization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AC — AI-Assisted Customization
**Date:** 2026-07-11
**Status:** ALL PASS (pre-existing failures unchanged)

---

## 1. Feature Lane — `packages/theme-engine/`

**Command:** `pnpm typecheck test --filter=@letbuyy/theme-engine`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 1695 total · 1695 pass · 0 fail · 0 skip
- Baseline entering AC: 1634
- AC new tests: 61
- Total new: 61

---

### 1.1 New Tests — `test/ai-intent-parser.test.ts`

#### AC/palette-warm (4 tests)

| Test | Assertion |
|------|-----------|
| warm tone proposal has status ok | `result.status === 'ok'` |
| warm tone proposal returns a validated ThemeDocument | `parseThemeDocument(result.document)` does not throw |
| warm tone proposal textColor passes WCAG AA on backgroundColor | `meetsWcagAA(textColor, backgroundColor) === true` |
| warm tone proposal diff.settingsChanged is not empty | `diff.settingsChanged.length > 0` |

#### AC/palette-all (10 tests)

Tests all 5 PaletteVariant values: `warm` / `cool` / `bold` / `muted` / `neutral`. For each:

| Test | Assertion |
|------|-----------|
| `{variant}` palette proposal has status ok | `result.status === 'ok'` |
| `{variant}` palette textColor passes WCAG AA | `meetsWcagAA(textColor, backgroundColor) === true` |

#### AC/typography (15 tests)

Tests all 5 FontPairingIntent values: `editorial` / `technical` / `artisanal` / `friendly` / `neutral`. For each:

| Test | Assertion |
|------|-----------|
| `{intent}` typography proposal has status ok | `result.status === 'ok'` |
| `{intent}` typography fontFamily is in EXPERIENCE_FONT_REGISTRY | `EXPERIENCE_FONT_REGISTRY.has(settings.fontFamily)` |
| `{intent}` typography headingFontFamily is in EXPERIENCE_FONT_REGISTRY | `EXPERIENCE_FONT_REGISTRY.has(settings.headingFontFamily)` |

#### AC/add-section-ok (5 tests)

| Test | Assertion |
|------|-----------|
| add testimonials section returns status ok | `result.status === 'ok'` |
| add testimonials section: result passes parseThemeDocument | Does not throw |
| add testimonials section: new section id is deterministic | `sectionId === 'ai-testimonials-1'` |
| add ctaSection returns status ok | `result.status === 'ok'` |
| add ctaSection: result passes parseThemeDocument | Does not throw |

#### AC/add-section-incompat (3 tests)

| Test | Assertion |
|------|-----------|
| faqAccordion returns status incompatible | `result.status === 'incompatible'` |
| collectionFilter returns status incompatible | `result.status === 'incompatible'` |
| instagramFeed returns status incompatible | `result.status === 'incompatible'` |

#### AC/add-section-unknown (2 tests)

| Test | Assertion |
|------|-----------|
| unknown section type returns status incompatible | `result.status === 'incompatible'` |
| empty string section type returns status incompatible | `result.status === 'incompatible'` |

#### AC/a11y-fix-fail (4 tests)

Setup: document with `primaryColor='#FF6600'`, `textColor='#FF6600'`, `backgroundColor='#FFFFFF'` — a failing 2.1:1 contrast pair.

| Test | Assertion |
|------|-----------|
| accessibility-fix on failing contrast returns status ok | `result.status === 'ok'` |
| accessibility-fix result passes parseThemeDocument | Does not throw |
| fixed textColor passes WCAG AA on backgroundColor | `meetsWcagAA(newTextColor, '#FFFFFF') === true` |
| fix diff.settingsChanged includes textColor | `diff.settingsChanged.some(e => e.key === 'textColor')` |

#### AC/a11y-fix-pass (2 tests)

Setup: document with `textColor='#000000'`, `backgroundColor='#FFFFFF'` — a passing 21:1 contrast pair.

| Test | Assertion |
|------|-----------|
| accessibility-fix on passing contrast returns status ok | `result.status === 'ok'` |
| no settingsChanged when contrast already passes | `diff.settingsChanged.length === 0` |

#### AC/free-text (3 tests)

| Test | Assertion |
|------|-----------|
| free-text intent returns status not-connected | `result.status === 'not-connected'` |
| free-text result has envVar THEME_AI_PROVIDER_API_KEY | `result.envVar === 'THEME_AI_PROVIDER_API_KEY'` |
| free-text explanation references NOT_CONNECTED | `result.explanation` includes `'NOT_CONNECTED'` or `'not-connected'` |

#### AC/reversible (2 tests)

| Test | Assertion |
|------|-----------|
| palette proposal diff contains previousValue for each changed key | `diff.settingsChanged.every(e => 'previousValue' in e)` |
| add-section proposal diff contains the added section with its id | `diff.sectionsAdded.length > 0` |

#### AC/no-model (2 tests)

Source text of `ai-intent-parser.ts` is read via `readFileSync`.

| Test | Assertion |
|------|-----------|
| ai-intent-parser.ts imports no HTTP client or LLM SDK | No non-comment line matches any `FORBIDDEN_PATTERN` |
| ai-intent-parser.ts has no wall-clock or random calls outside comments | No non-comment line matches `Math.random` / `Date.now` / `crypto.randomUUID` |

#### AC/identity (3 tests)

| Test | Assertion |
|------|-----------|
| no-change accessibility-fix leaves template sections byte-identical | `JSON.stringify(original.templates) === JSON.stringify(result.document.templates)` (when no contrast failure exists) |
| no-change palette proposal does not mutate the input document | Input document reference is unchanged after call |
| no-change typography proposal does not mutate the input document | Input document reference is unchanged after call |

#### AC/determinism (5 tests)

| Test | Assertion |
|------|-----------|
| same warm palette intent on same document produces identical result twice | `deepStrictEqual(result1, result2)` |
| same typography intent on same document produces identical result twice | `deepStrictEqual(result1, result2)` |
| same add-section intent produces identical section id on repeated call | `result1.document.templates.index.sections === result2...` |
| same palette intent produces identical proposalHash | `result1.proposalHash === result2.proposalHash` |
| same add-section intent produces identical proposalHash | `result1.proposalHash === result2.proposalHash` |

---

## 2. Lane B — `apps/merchant-control-plane/`

**Command:** `pnpm --filter=@letbuyy/merchant-control-plane test && pnpm --filter=@letbuyy/merchant-control-plane typecheck`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 771 total · 771 pass · 0 fail · 0 skip
- Baseline entering AC: 712
- AC new tests: 59
- Total new: 59

---

### 2.1 New Tests — `tests/theme-editor-ac.test.mjs` (59 tests)

#### File existence (2 tests)

| Test |
|------|
| AICustomizationPanel.tsx exists |
| ai-customization/route.ts exists |

#### Component structure (7 tests)

| Test |
|------|
| Panel is `'use client'` |
| Panel imports from `@letbuyy/ui` |
| Panel imports `deterministicPalette` from `@letbuyy/theme-engine` |
| Panel imports `suggestTypographyPairing` from `@letbuyy/theme-engine` |
| Panel imports `MODEL_BOUNDARY` from `@letbuyy/theme-engine` |
| Panel exports `proposeThemeCustomization` |
| Panel has `djb2Hash` function |

#### Structured suggestion chips (8 tests)

| Test |
|------|
| Panel contains `warm` PaletteVariant |
| Panel contains `cool` PaletteVariant |
| Panel contains `bold` PaletteVariant |
| Panel contains `muted` PaletteVariant |
| Panel contains `editorial` FontPairingIntent |
| Panel contains `technical` FontPairingIntent |
| Panel contains `artisanal` FontPairingIntent |
| Panel contains `friendly` FontPairingIntent |

#### ARIA / accessibility (7 tests)

| Test |
|------|
| Panel has `role="region"` + `aria-label` or `aria-labelledby` |
| Chip groups have `role="group"` + `aria-label` |
| Panel has `aria-pressed` on chip buttons |
| Apply button has `aria-disabled` |
| Apply button has `aria-label` |
| Free-text input has `aria-disabled` |
| Free-text input has `disabled` attribute |

#### NO-AUTO-APPLY LAW (5 tests)

| Test |
|------|
| Panel has `canApply` guard |
| `canApply` requires `proposal !== null` |
| `canApply` requires proposal type `'token-overlay'` |
| Apply button carries `aria-disabled` when `canApply` is false |
| `handleSelectIntent` does not call `handleApply` |

#### MODEL BOUNDARY / NOT-CONNECTED (5 tests)

| Test |
|------|
| Panel imports `MODEL_BOUNDARY` |
| Panel has NOT_CONNECTED disclosure text |
| Panel shows free-text field as `NOT-CONNECTED` (`disabled` + `aria-disabled`) |
| Panel does not perform keyword NLU on free-text |
| Route documents NOT-CONNECTED in comments |

#### DETERMINISM LAW (4 tests)

| Test |
|------|
| Panel has no non-comment `Math.random()` |
| Panel has no non-comment `Date.now()` |
| `djb2Hash` is present |
| `proposeThemeCustomization` is exported |

#### RISK-DUAL-N01 (6 tests)

| Test |
|------|
| Panel documents `RISK-DUAL-N01` in comments |
| Panel does not assign to `section_definitions` |
| No `dangerouslySetInnerHTML` in Panel |
| Route documents `RISK-DUAL-N01` in comments |
| Route overlay payload never includes `section_definitions` |
| Route overlay is constrained to token keys |

#### Tenancy (5 tests)

| Test |
|------|
| Route imports `resolveOwnedStoreId` |
| Route imports `merchantApiFetch` |
| Route does NOT import `createMerchantApiClient` |
| Route uses `resolved.storeId` |
| Route does NOT import `@letbuyy/api-client` |

#### Design ratchet (4 tests)

| Test |
|------|
| Panel has no `rounded-[Npx]` raw Tailwind class |
| Panel uses `--lb-*` design tokens |
| Route has no `rounded-[Npx]` |
| No raw hex color literals in Panel |

#### Foreign WIP isolation (6 tests)

| Test |
|------|
| Panel does not import from `editor/page.tsx` |
| Panel does not import `globals.css` |
| Panel does not import from `@letbuyy/api-client` |
| Panel does not import `ExperiencePicker` |
| Route does not import from gateway `src/index.ts` |
| Route does not import `@letbuyy/api-client` |

---

## 3. Unchanged packages

| Package | Gate | Status |
|---------|------|--------|
| `api-gateway` | 1489 pass (27 pre-existing fail) | UNCHANGED |
| `storefront-runtime` | 795/795 | UNCHANGED |
| All typechecks | clean | UNCHANGED |

Pre-existing failures: 27 merchant DB-migration failures and 27 api-gateway pre-existing failures remain unchanged. No new failures introduced.

---

## 4. Typecheck notes

One TypeScript fix applied during the session: `ToastMessage.description` used instead of `.message` in `AICustomizationPanel.tsx`. Typecheck exits 0 after this fix. No other type errors introduced.
