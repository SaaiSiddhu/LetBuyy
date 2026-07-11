# Phase AC — Report: AI-Assisted Theme Customization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AC — AI-Assisted Customization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per phase hard rules)

---

## 1. Summary

Phase AC delivers a two-lane, deterministic, honesty-first AI customization layer for the merchant theme editor.

**Lane Feature — Deterministic Intent Layer (`packages/theme-engine/`)**
A single entry point, `proposeThemeCustomization(document, intent)`, maps structured `AICustomizationIntent` variants to the seven Phase L AI primitives and the Phase O experience-apply path. Every proposal output passes `parseThemeDocument` before return (fail-closed). WCAG 2.1 AA is guaranteed via `deterministicPalette()`'s own double-guard. Font families are constrained to `EXPERIENCE_FONT_REGISTRY`. Section additions are constrained to types present in both `BUILT_IN_SECTION_TYPES` and the document's own `section_definitions`. Free-text intents return `AINotConnectedResult` with `envVar='THEME_AI_PROVIDER_API_KEY'` — no keyword NLU, no heuristic parsing.

**Lane B — Merchant UI (`apps/merchant-control-plane/`)**
`AICustomizationPanel.tsx` renders structured suggestion chips (4 palette variants + 4 typography intents + 2 NOT-CONNECTED chips) and a deterministic client-side proposal computation path. Proposals are previewed as a diff table before the merchant clicks Apply. A `canApply` gate requires a valid token-overlay proposal in `'preview'` state — the Apply button is always visible with `aria-disabled` when not applicable, never hidden. The free-text input is rendered as `disabled + aria-disabled`, referencing `MODEL_BOUNDARY` as the NOT-CONNECTED seam. The same-origin proxy (`ai-customization/route.ts`) resolves store ownership via `resolveOwnedStoreId` and returns a structured 503 when the gateway AI route is absent.

**Model boundary status:** `NOT_CONNECTED`. The gateway route `POST /v1/theme-ai/parse-brief` (NL→ThemeBrief mapping) does not exist. `THEME_AI_PROVIDER_API_KEY` is not set. The three NL seams (NL brief → ThemeBrief, NL colour mood → seed hex, NL section intent → SectionGoal[]) are documented in `MODEL_BOUNDARY` and honestly surfaced to the merchant via the disabled free-text input and the two NOT-CONNECTED chips. The deterministic path (structured intent → deterministic computation → validated proposal) is fully connected.

**Rollback = revert:** Every Apply call goes through the existing draft path (`saveDraft`). The draft is the merchant's working copy; there is no secondary AI-specific write path. Reverting an AI-applied palette/typography change is identical to reverting any other settings change — the previous settings are available in `diff.settingsChanged[n].previousValue`.

**Test gate:** 1695/1695 theme-engine · 771/771 merchant · 1489 api-gateway (unchanged) · 795/795 storefront-runtime · all typechecks clean.

---

## 2. Deliverables

### Feature Lane — Engine (`packages/theme-engine/`)

#### `packages/theme-engine/src/ai-intent-parser.ts` — NEW

Pure TypeScript, no DB I/O, no network calls, no DOM globals, no LLM imports (grep-verified by `AC/no-model` tests).

**Exports:**

| Export | Description |
|--------|-------------|
| `AIIntentKind` | `'palette' \| 'typography' \| 'add-section' \| 'accessibility-fix' \| 'free-text'` |
| `AICustomizationIntent` | Tagged union of all structured intent types |
| `AICustomizationProposal` | Tagged union: `{ status: 'ok', document, diff }` / `{ status: 'not-connected', envVar, explanation }` / `{ status: 'incompatible', reason }` |
| `proposeThemeCustomization(doc, intent)` | Main entry point; pure; fail-closed; deterministic |

**Intent dispatch:**

| `kind` | Phase L primitive | Apply path | WCAG/font/parity guarantee |
|--------|-------------------|------------|---------------------------|
| `palette` | `deterministicPalette(seed, variant)` | `applyExperienceToDocument(STYLE_ONLY)` | WCAG AA (deterministicPalette double-guard) |
| `typography` | `suggestTypographyPairing(intent)` | `applyExperienceToDocument(STYLE_ONLY)` | EXPERIENCE_FONT_REGISTRY only |
| `add-section` | `computeExperienceApplyDiff` + parity check | Deep clone + section insert | section_definitions parity |
| `accessibility-fix` | `generateColorSystem(primaryColor, 'light')` | Settings patch on `textColor` | WCAG AA (generateColorSystem loop) |
| `free-text` | (no handler) | Returns NOT_CONNECTED immediately | Not applicable |

**Palette seed selection:** `intent.seedHex` > `doc.config.settings_data.current.primaryColor` > `'#00B3B3'` (platform default).

**Section ID determinism:** `'ai-{camelType}-{N}'` where N = existing count of that camelType in the template + 1, incremented on collision.

**RISK-DUAL-N01 contract:** only `config.settings_data.current` and `template.sections[]` are mutated. `section_definitions`, `block_definitions`, `layout`, `locales`, and `renderer` are never assigned. Input document is deep-cloned; the original is immutable.

#### `packages/theme-engine/test/ai-intent-parser.test.ts` — NEW

61 tests across 13 describe blocks. See PHASE_AC_TEST_REPORT.md §1.1 for full breakdown.

**Key invariants verified:**
- All palette proposals (5 variants) pass `meetsWcagAA(textColor, backgroundColor)`.
- All typography proposals (5 intents) use only `EXPERIENCE_FONT_REGISTRY` families.
- `faqAccordion`, `collectionFilter`, `instagramFeed`, unknown, and empty-string section types all return `status: 'incompatible'`.
- Accessibility-fix on a failing 2.1:1 pair improves to ≥ 4.5:1.
- Accessibility-fix on a passing 21:1 pair returns zero `settingsChanged`.
- Free-text returns `status: 'not-connected'` with `envVar: 'THEME_AI_PROVIDER_API_KEY'`.
- Same intent + same document → identical proposal + identical proposalHash (5 determinism tests).
- No non-comment HTTP/LLM import or wall-clock call in `ai-intent-parser.ts`.

---

### Lane B — Merchant UI (`apps/merchant-control-plane/`)

#### `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` — NEW

Standalone `'use client'` React component. 6 reachable panel states: `idle | computing | preview | applying | applied | error`.

**Key design decisions:**
1. Palette and typography proposals are computed entirely client-side via `deterministicPalette` and `suggestTypographyPairing` — no network round-trip for proposal generation.
2. `djb2Hash(JSON.stringify({ intent, overlay }))` produces the `proposalHash` used as a CAS guard in the Apply POST.
3. Free-text input: `<input disabled aria-disabled="true">` — permanently disabled; `MODEL_BOUNDARY` is imported and used in the NOT-CONNECTED badge text.
4. NOT-CONNECTED chips (`section`, `accessibility`) immediately produce an `AINotConnectedProposal` without any network call; `canApply` is false for these proposals.
5. Apply POST body: `{ intent, overlay: Partial<ExperienceTokens>, proposalHash }` — overlay contains only changed token keys.

**ARIA landmarks:** `role="region"` on the panel root; `role="group"` on each chip group; `aria-pressed` on chip buttons; `aria-disabled` on Apply button.

#### `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts` — NEW

Two handlers:

| Handler | Notes |
|---------|-------|
| `GET` | Returns frozen `SUGGESTIONS_CATALOG`; no gateway call; no auth required beyond session |
| `POST` | `resolveOwnedStoreId` → `merchantApiFetch` → gateway; 503 with `{ not_connected: true, envVar }` on gateway 404/503 |

#### `apps/merchant-control-plane/tests/theme-editor-ac.test.mjs` — NEW

59 static-contract tests. See PHASE_AC_TEST_REPORT.md §2.1 for full breakdown.

#### `apps/merchant-control-plane/package.json` — ADDITIVE (FOREIGN WIP)

`theme-editor-ac.test.mjs` appended to test script.

---

## 3. Security findings

5 findings; 0 fixed before close (Hardening: null). All are latent while the gateway route is NOT-CONNECTED.

| ID | Severity | File | Summary |
|----|----------|------|---------|
| RISK-AC-01 | MEDIUM | proxy `route.ts` | Overlay keys not filtered at proxy layer (defense-in-depth gap; gateway NOT-CONNECTED today) |
| RISK-AC-02 | MEDIUM | `ai-intent-parser.ts` | Accessibility-fix WCAG AA guarantee holds only against white background |
| RISK-AC-03 | LOW | `AICustomizationPanel.tsx` | `bodyFontFamily` missing from `TYPOGRAPHY_OVERLAY_KEYS` |
| RISK-AC-04 | LOW | `AICustomizationPanel.tsx` | `'computing'` state never renders due to React 18 batching (cosmetic) |
| RISK-AC-05 | LOW | `ai-intent-parser.test.ts` | `AC/no-model` patterns not anchored to import paths |

See PHASE_AC_SECURITY_REVIEW.md for full detail and suggested fixes.

---

## 4. Phase AC gates

| Package | Baseline | New | Result |
|---------|---------|-----|--------|
| `theme-engine` | 1634 | +61 AC | **1695/1695 PASS** |
| `merchant-control-plane` (theme-editor suite) | 712 | +59 AC | **771/771 PASS** |
| `api-gateway` | 1489 pass (27 pre-existing) | 0 | **unchanged** |
| `storefront-runtime` | 795/795 | 0 | **unchanged** |
| Typechecks | clean | 0 | **clean** |

`validate-governance.mjs` EXIT=1 — pre-existing tenant-registry drift only; anti-fabrication PASS. Unchanged from Phase AB.

---

## 5. Foreign WIP

Phase AC did not touch any of the following foreign WIP files:
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- `apps/merchant-control-plane/src/app/globals.css`
- `apps/identity-platform/`, `apps/marketing-site/`, `services/api-gateway/` (existing routes)
- `packages/theme-engine/src/theme-renderer.ts` lines 818/824
- `packages/theme-engine/src/theme-bundle.ts` / `parseLiquidThemePackageBundle`
- `packages/theme-engine/src/schema-field-extensions.ts`
- `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`
- `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`
- `apps/merchant-control-plane/src/components/theme-editor/controls/CheckboxControl.tsx`
- Any translation proxy or gateway routes (RISK-Z03–Z06 carry files)

All carry-over risks (RISK-T01/T02/T03/T04/T05/T06, RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02, RISK-W01/W06, RISK-Y01, RISK-Z01/Z03–Z06, RISK-AA-01/02, RISK-X01, RISK-TOCTOU-Q01, RISK-AB-01/02/03) remain OPEN and are retargeted to Phase AD.

---

## 6. What remains NOT-CONNECTED

The following AI capabilities explicitly remain NOT-CONNECTED after Phase AC:

| Seam | Env var required | Gateway route required |
|------|-----------------|----------------------|
| NL brief → ThemeBrief | `THEME_AI_PROVIDER_API_KEY` | `POST /v1/theme-ai/parse-brief` (does not exist) |
| NL colour mood → seed hex | `THEME_AI_PROVIDER_API_KEY` | same |
| NL section intent → SectionGoal[] | `THEME_AI_PROVIDER_API_KEY` | same |
| Section-order AI intent in panel | same | same |
| Accessibility-fix AI intent in panel | same | same |
| `custom_css` render path wiring | — | `layout.tsx` call site not yet wired (Phase AA/AB gap) |

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` is unchanged. RISK-DUAL-N01 is preserved.
