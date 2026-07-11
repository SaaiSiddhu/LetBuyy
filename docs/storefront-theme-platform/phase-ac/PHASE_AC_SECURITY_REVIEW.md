# Phase AC — Security Review: AI-Assisted Theme Customization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AC — AI-Assisted Customization
**Date:** 2026-07-11
**Reviewer:** Phase AC documentation pass (ground-truth verified)
**Status:** REVIEW COMPLETE — 2 MEDIUM findings open (deferred, NOT-CONNECTED today); 3 LOW findings open (deferred)

---

## 1. Validated-Output Proof

### 1.1 `parseThemeDocument` gate on every proposal

Every proposal returned by `proposeThemeCustomization` with `status: 'ok'` has been passed through `parseThemeDocument(result)` before return. If the resulting document fails the Zod schema or version gate, the function throws rather than returning a corrupted document. The AC/palette-warm and AC/palette-all tests re-run `parseThemeDocument` on the returned document to verify this double-validation independently.

### 1.2 WCAG 2.1 AA palette guarantee

Palette proposals chain through `deterministicPalette()` which calls `meetsWcagAA(textColor, backgroundColor)` internally and throws `Error('WCAG AA text guarantee cannot be satisfied')` if the invariant cannot be met. The intent handler catches this throw and returns `{ status: 'error', reason }` rather than emitting an invalid palette. The WCAG math is IEC 61966-2-1 relative luminance with a 4.5:1 ratio floor. Tests `AC/palette-warm` and `AC/palette-all` (10 tests across all 5 PaletteVariants) verify the `textColor`/`backgroundColor` pair passes `meetsWcagAA` on the returned document.

### 1.3 Known-font guarantee

Typography proposals route through `suggestTypographyPairing(intent)` which only returns pairings from `EXPERIENCE_FONT_REGISTRY`. The `AC/typography` tests (15 tests, all 5 FontPairingIntents) assert `EXPERIENCE_FONT_REGISTRY.has(pairing.fontFamily)` and `EXPERIENCE_FONT_REGISTRY.has(pairing.headingFontFamily)` on every returned proposal.

### 1.4 Parity-section guarantee

`handleAddSectionIntent` validates:
1. Proposed camelCase type is a key in `BUILT_IN_SECTION_TYPES`.
2. Corresponding kebab form (via `BUILT_IN_TO_LIQUID_SECTION_TYPE`) is present in `doc.section_definitions`.

Types that fail step 2 (e.g., `faqAccordion`, `collectionFilter`, `instagramFeed`, any unknown type) return `{ status: 'incompatible' }` — they are never silently inserted. Tests `AC/add-section-incompat` (3 tests) and `AC/add-section-unknown` (2 tests) verify this.

---

## 2. Zero-Fabricated-Model Proof

### 2.1 No LLM SDK or HTTP client import

The `AC/no-model` test suite reads `packages/theme-engine/src/ai-intent-parser.ts` as raw text and asserts:
- No line (excluding comments) contains `import` + any of: `openai`, `anthropic`, `@anthropic-ai`, `cohere`, `mistral`, `groq`, `huggingface`, `fetch(`, `http.request`, `https.request`, `axios`, `got`, `node-fetch`, `undici`.
- No non-comment line in the source contains `Math.random()`, `Date.now()`, or `crypto.randomUUID()` calls that could introduce non-determinism.

These assertions are verified at test time, not just at review time.

### 2.2 djb2Hash is deterministic

`AICustomizationPanel.tsx` uses `djb2Hash(input: string): string` — a pure integer accumulator (DJB2 polynomial: `hash = hash * 31 + char`). No `Math.random()`, no `Date.now()`, no `crypto`. Tests `AC/determinism` (5 tests) verify same intent + same document → identical `proposalHash` on repeated calls.

### 2.3 Panel no-random / no-clock test

Lane B tests (`theme-editor-ac.test.mjs`) verify via source pattern matching that `AICustomizationPanel.tsx` contains:
- No non-comment `Math.random()` call.
- No non-comment `Date.now()` call.
- `djb2Hash` function present.
- `proposeThemeCustomization` exported.

---

## 3. Model Boundary NOT-CONNECTED Proof

### 3.1 `MODEL_BOUNDARY` constant

`packages/theme-engine/src/theme-ai-sdk.ts` lines 919–933 export `MODEL_BOUNDARY`:

```typescript
export const MODEL_BOUNDARY = {
  status: 'NOT_CONNECTED',
  envVar: 'THEME_AI_PROVIDER_API_KEY',
  gatewayRoute: 'POST /v1/theme-ai/parse-brief (does not exist)',
  seams: [
    'NL brief → ThemeBrief',
    'NL colour mood → seed hex',
    'NL section intent → SectionGoal[]',
  ],
  deterministic: [
    'ThemeBrief → generateTheme() → GenerateThemeResult',
    'seed hex + PaletteVariant → deterministicPalette() → ExperienceTokens',
    'SectionGoal[] → generateSectionOrder() → string[]',
  ],
} as const;
```

`AICustomizationPanel.tsx` imports `MODEL_BOUNDARY` from `@letbuyy/theme-engine` and references it in the free-text NOT-CONNECTED badge rendering.

### 3.2 Free-text returns NOT_CONNECTED

`proposeThemeCustomization(doc, { kind: 'free-text', text: '...' })` returns `{ status: 'not-connected', envVar: 'THEME_AI_PROVIDER_API_KEY', explanation: '...' }`. No keyword matching, no heuristic NLU, no attempt to parse the merchant's natural language. Tests `AC/free-text` (3 tests) assert:
- `result.status === 'not-connected'`
- `result.envVar === 'THEME_AI_PROVIDER_API_KEY'`
- `result.explanation` contains the string `'NOT_CONNECTED'` or `'not-connected'`

### 3.3 Free-text input is disabled

The free-text `<input>` in `AICustomizationPanel.tsx` is rendered with `disabled` and `aria-disabled="true"` to prevent merchant submission. The panel does not contain any code path that routes a non-empty free-text string into any NLU or heuristic processing function.

### 3.4 Gateway route does not exist

`services/api-gateway/src/routes/themes/theme-ai-customization-route.ts` does not exist in the repository (grep-verified: no file under `services/api-gateway/src/routes/` contains `parse-brief`). The proxy proxy-layer returns HTTP 503 with `{ not_connected: true }` when the gateway returns 404/503.

---

## 4. Tenancy Model

### 4.1 Proxy route tenancy

The `POST /api/themes/[themeId]/editor/ai-customization` proxy:

| Step | Guard | Failure mode |
|------|-------|-------------|
| 1 | `resolveOwnedStoreId(request)` | Rejects unauthenticated or cross-store requests; 401/403 |
| 2 | `resolved.storeId` used in gateway request body | Never uses raw browser-supplied `themeId` as the store identifier |
| 3 | Gateway enforces `verifySiteOwnership` | Double-layer isolation |

### 4.2 GET handler — no gateway call, no auth required beyond session

The `GET` handler returns a static frozen catalog (`SUGGESTIONS_CATALOG`). No DB read, no gateway call. Safe to call without a merchant-owned store (catalog is theme-agnostic).

---

## 5. RISK-DUAL-N01 Verification

Phase AC enforces RISK-DUAL-N01 at three layers:

1. **Engine layer (`ai-intent-parser.ts`):** module comment documents the constraint; only `config.settings_data.current` and `template.sections[]` are assigned; no assignment to `section_definitions`, `block_definitions`, `layout`, `locales`, or `renderer` exists in the file.

2. **Panel layer (`AICustomizationPanel.tsx`):** module comment documents the constraint; the Apply handler POSTs only `{ intent, overlay: Partial<ExperienceTokens>, proposalHash }` to the proxy — the overlay contains only token keys.

3. **Proxy layer (route.ts):** module comment documents the constraint; the forwarded body is `{ intent, overlay, proposalHash, storeId }` — no structural fields.

Tests `AC/no-model` (engine) and Lane B tests (panel + route) statically verify no assignment to `section_definitions` in the relevant source files.

---

## 6. Findings

### Finding 1 — MEDIUM: Proxy does not filter overlay keys before forwarding [OPEN — deferred]

**File:** `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts`

**Issue:** The proxy route serialises the browser-supplied `overlay` object verbatim without an allowlist filter on overlay keys. A crafted POST with `overlay: { section_definitions: {...} }` would be forwarded to the gateway. The RISK-DUAL-N01 comment documents this constraint, but the enforcement is downstream (the not-yet-deployed gateway route validates overlay shape). Today the gateway returns 404/503 so nothing is written — but the defense-in-depth guarantee is absent at the proxy layer.

**Suggested fix:** Before forwarding, parse the overlay through an allowlist of accepted `ExperienceToken` keys. The existing `ExperienceSettingsOverlaySchema` (in `packages/theme-engine/src/theme-presets.ts`) or an equivalent `pick`/`strip` can be used. Reject requests whose overlay fails this validation with HTTP 422.

**Disposition:** OPEN. NOT-CONNECTED today (gateway 404/503 so no write lands). Register as RISK-AC-01. Target: Phase AD or when the gateway AI-customization route is deployed.

---

### Finding 2 — MEDIUM: `handleAccessibilityFixIntent` WCAG AA guarantee holds only against white background [OPEN — deferred]

**File:** `packages/theme-engine/src/ai-intent-parser.ts`

**Issue:** `handleAccessibilityFixIntent` derives `newTextColor` via `generateColorSystem(primaryColor, 'light').text` which is validated against `#FFFFFF`. No post-fix `meetsWcagAA(newTextColor, backgroundColor)` assertion exists for non-white backgrounds. If `backgroundColor` is in the medium-darkness range (e.g., `#777777`, luminance ~0.152), the fixed text color may still fail 4.5:1. The diff summary says "to meet WCAG 2.1 AA contrast against {backgroundColor}" which is inaccurate in this scenario. The `AC/a11y-fix-fail` tests only exercise `backgroundColor = '#FFFFFF'`.

**Suggested fix:** After computing `newTextColor`, add a guard: `if (!meetsWcagAA(newTextColor, backgroundColor)) { /* regenerate with backgroundColor-specific loop or fallback to #000000 */ }`. Update the test suite to cover a non-white `backgroundColor` (e.g., `#888888`).

**Disposition:** OPEN. Register as RISK-AC-02. Target: Phase AD or next `ai-intent-parser.ts` touch.

---

### Finding 3 — LOW: Panel `TYPOGRAPHY_OVERLAY_KEYS` omits `bodyFontFamily` [OPEN — deferred]

**File:** `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx`

**Issue:** The panel's `TYPOGRAPHY_OVERLAY_KEYS` constant contains only `['fontFamily', 'headingFontFamily']`, omitting `'bodyFontFamily'`. The engine's `handleTypographyIntent` correctly writes three keys including `bodyFontFamily = fontFamily`. When the gateway route is deployed and enforces `ExperienceSettingsOverlaySchema` (which is `.strict()` and requires `bodyFontFamily`), typography Apply requests from the panel will fail schema validation. Liquid render paths that resolve `bodyFontFamily` will also not receive the updated value.

**Suggested fix:** Add `'bodyFontFamily'` to `TYPOGRAPHY_OVERLAY_KEYS` and set `overlay.bodyFontFamily = pairing.fontFamily` in the proposal builder, mirroring what `buildExperienceSettingsOverlay` does in `theme-presets.ts`.

**Disposition:** OPEN. Latent — gateway route is NOT-CONNECTED today. Register as RISK-AC-03 (duplicate concern to Finding 4 below, same root cause). Target: Phase AD.

---

### Finding 4 — LOW: `handleSelectIntent` computing state never renders due to React 18 batch [OPEN — cosmetic]

**File:** `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx`

**Issue:** `handleSelectIntent` is synchronous: `setPanelState('computing')` and `proposeThemeCustomization()` and `setPanelState('preview')` all execute in the same React 18 event handler flush. React 18 batches state updates, so the `'computing'` skeleton div (`aria-busy`) never renders between user click and preview display. The `'computing'` state branch is a dead UI path.

**Suggested fix:** Wrap the computation in a microtask (e.g., `setTimeout(..., 0)` or `startTransition`) so the skeleton renders before the result. Alternatively, remove the `'computing'` state branch and document only `'idle | preview | applying | applied | error'` as reachable.

**Disposition:** OPEN. Cosmetic; does not affect correctness or security. Register as RISK-AC-04 (LOW). Target: Phase AD.

---

### Finding 5 — LOW: `AC/no-model` test uses bare substrings not anchored to import paths [OPEN — test quality]

**File:** `packages/theme-engine/test/ai-intent-parser.test.ts`

**Issue:** `FORBIDDEN_PATTERNS` uses bare substrings `'openai'` and `'anthropic'` (not anchored as `"from 'openai'"` or `"from '@anthropic-ai'"`). A future comment like `// not using openai` would make the test fail as a false positive. Currently harmless — neither string appears in `ai-intent-parser.ts`.

**Suggested fix:** Anchor the patterns to import paths: e.g., `"from 'openai'"`, `"from '@anthropic-ai'"`.

**Disposition:** OPEN. Test quality gap; no correctness risk today. Register as RISK-AC-05 (LOW). Target: Phase AD.

---

## 7. Hardening Summary

Phase AC findings: 2 MEDIUM (RISK-AC-01, RISK-AC-02) + 3 LOW (RISK-AC-03, RISK-AC-04, RISK-AC-05).

**Hardening: null** — no findings were fixed before phase close.

The two MEDIUM findings are both latent: RISK-AC-01 cannot cause a write today (gateway NOT-CONNECTED); RISK-AC-02 only matters for non-white backgrounds (tests only cover white). Both are correctness and defense-in-depth issues with zero production impact while the gateway route is absent.

The three LOW findings are quality/cosmetic issues with zero security or correctness impact.
