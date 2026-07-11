# AI Customization Reference: Merchant Intent Layer

**Phase:** AC
**Package:** `@letbuyy/theme-engine`
**File:** `packages/theme-engine/src/ai-intent-parser.ts`
**Date:** 2026-07-11

---

## 1. Overview

The AI customization intent layer is a **pure, deterministic** function that maps structured merchant intents to validated `ThemeDocument` proposals — without any LLM call, HTTP request, or model credential.

**Honesty contract:** `proposeThemeCustomization` is honest about what it can and cannot do. Structured intents (palette, typography, add-section, accessibility-fix) are fully wired — same input always produces the same validated output. Free-text intents return `AINotConnectedResult` immediately, documenting the exact env var and gateway route required to wire the NL seam.

**Law:** every proposal with `status: 'ok'` has been validated by `parseThemeDocument` before return. No corrupted or schema-invalid ThemeDocument can be emitted by this layer.

---

## 2. Exported API

```typescript
import {
  proposeThemeCustomization,
  type AICustomizationIntent,
  type AICustomizationProposal,
} from '@letbuyy/theme-engine';
```

### `proposeThemeCustomization(document, intent): AICustomizationProposal`

Main entry point. Pure function — no side effects, no mutations of the input document, no I/O.

```typescript
function proposeThemeCustomization(
  document: ThemeDocument,
  intent: AICustomizationIntent,
): AICustomizationProposal
```

**Input document:** deep-cloned internally. The original is never mutated.

**Throws:** only when a Phase L primitive throws — specifically:
- `deterministicPalette()` throws if WCAG AA cannot be satisfied for the given seed hex.
- `parseThemeDocument()` throws if the resulting document fails schema validation (should be unreachable in practice; indicates a bug in a Phase L primitive).

Callers should wrap in try/catch and treat throws as `{ status: 'error' }`.

---

## 3. Intent Types

```typescript
type AICustomizationIntent =
  | { kind: 'palette'; tone: PaletteVariant; seedHex?: string }
  | { kind: 'typography'; intent: FontPairingIntent }
  | { kind: 'add-section'; sectionType: string; templateKey?: string }
  | { kind: 'accessibility-fix' }
  | { kind: 'free-text'; text: string };
```

### Palette intent

Changes the color palette toward a given aesthetic. Internally calls `deterministicPalette(seedHex, tone)` which produces a full `ExperienceTokens` set and applies it via `applyExperienceToDocument(STYLE_ONLY)`.

**Seed selection order:** `intent.seedHex` > `document.config.settings_data.current.primaryColor` > `'#00B3B3'` (platform default).

**WCAG AA:** guaranteed by `deterministicPalette` — it loops from L=0.08 downward until `meetsWcagAA(textColor, backgroundColor) === true`. Throws `Error('WCAG AA text guarantee cannot be satisfied')` if the invariant cannot be met (only theoretically possible for certain seed hues; caught by the intent handler and returned as `{ status: 'error' }`).

```typescript
// Example
const proposal = proposeThemeCustomization(doc, {
  kind: 'palette',
  tone: 'warm',
});
// proposal.status === 'ok'
// proposal.document — passes parseThemeDocument
// proposal.diff.settingsChanged — changed token keys with previousValue
```

### Typography intent

Swaps the heading + body font pairing. Internally calls `suggestTypographyPairing(intent)` which returns a `FontPairing` from `EXPERIENCE_FONT_REGISTRY` and applies it via `applyExperienceToDocument(STYLE_ONLY)`.

**Known fonts only:** `suggestTypographyPairing` is constrained at compile time to the `EXPERIENCE_FONT_REGISTRY` set. No arbitrary font string is ever inserted.

**Overlay keys:** `fontFamily`, `headingFontFamily`, `bodyFontFamily` — all three are written. Note: the merchant panel's `TYPOGRAPHY_OVERLAY_KEYS` currently omits `bodyFontFamily` (RISK-AC-03); this is a panel-layer gap, not an engine gap.

```typescript
const proposal = proposeThemeCustomization(doc, {
  kind: 'typography',
  intent: 'editorial',
});
// proposal.diff.settingsChanged — includes fontFamily, headingFontFamily, bodyFontFamily
```

### Add-section intent

Adds a known parity section to a template. The section type must satisfy two conditions:

1. `sectionType` (camelCase) is a key in `BUILT_IN_SECTION_TYPES`.
2. The corresponding kebab form (via `BUILT_IN_TO_LIQUID_SECTION_TYPE[sectionType]`) is present in `document.section_definitions`.

If either condition fails, returns `{ status: 'incompatible', reason }`. Types not yet added to the bundle (e.g., `faqAccordion`, `collectionFilter`, `instagramFeed`) are correctly surfaced as incompatible.

**Section ID:** `'ai-{camelType}-{N}'` where N = count of the same camelType already in the target template + 1. Incremented on collision. Deterministic: same intent on same document → identical ID.

**Target template:** `intent.templateKey ?? 'index'`.

```typescript
const proposal = proposeThemeCustomization(doc, {
  kind: 'add-section',
  sectionType: 'testimonials',    // must be in BUILT_IN_SECTION_TYPES
  templateKey: 'index',
});
// proposal.status === 'ok' → new section in proposal.document
// proposal.status === 'incompatible' → section not in section_definitions
```

### Accessibility-fix intent

Fixes WCAG AA contrast failures in `settings_data.current`. Reads `primaryColor` and `backgroundColor` from the document's current settings. Derives a new `textColor` via `generateColorSystem(primaryColor, 'light').text` (which guarantees ≥ 4.5:1 contrast against `#FFFFFF`). If the current textColor already passes `meetsWcagAA(textColor, backgroundColor)`, returns `status: 'ok'` with zero `settingsChanged`.

**Limitation (RISK-AC-02):** The WCAG AA guarantee holds reliably against `#FFFFFF`. For medium-darkness backgrounds (e.g., `#777777`), the derived `newTextColor` may still fail 4.5:1. A post-fix `meetsWcagAA(newTextColor, backgroundColor)` guard is not yet present. See PHASE_AC_SECURITY_REVIEW.md.

### Free-text intent

Returns `AINotConnectedResult` immediately. No keyword matching, no heuristic NLU, no attempt to parse the text string. The exact seam is documented:

```typescript
const proposal = proposeThemeCustomization(doc, {
  kind: 'free-text',
  text: 'earthy and warm, premium feel',
});
// proposal.status === 'not-connected'
// proposal.envVar === 'THEME_AI_PROVIDER_API_KEY'
// proposal.explanation — describes the NL→ThemeBrief seam
```

---

## 4. Proposal Types

```typescript
type AICustomizationProposal =
  | {
      status: 'ok';
      document: ThemeDocument;      // validated; passes parseThemeDocument
      diff: AICustomizationDiff;    // preview; contains previousValue for reversibility
      proposalHash: string;         // djb2 hash; CAS guard for Apply
    }
  | {
      status: 'not-connected';
      envVar: 'THEME_AI_PROVIDER_API_KEY';
      explanation: string;          // describes the NL seam; references NOT_CONNECTED
    }
  | {
      status: 'incompatible';
      reason: string;               // e.g., section not in section_definitions
    }
  | {
      status: 'error';
      reason: string;               // only on deterministicPalette WCAG throw
    };
```

### `AICustomizationDiff`

```typescript
interface AICustomizationDiff {
  /** Changed token key entries (palette and typography proposals). */
  settingsChanged: Array<{
    key: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
  /** Added sections (add-section proposals). */
  sectionsAdded: Array<{
    id: string;
    sectionType: string;    // camelCase
    templateKey: string;
  }>;
}
```

**Reversibility:** `diff.settingsChanged[n].previousValue` contains the pre-proposal value for every changed key. To revert: apply `{ [key]: previousValue }` for each entry. This is the standard draft-revert path — no AI-specific rollback mechanism.

### `proposalHash`

`djb2Hash(JSON.stringify({ intent, overlay }))` — a pure integer accumulator. Same intent + same overlay → same hash. Used as a CAS guard in the proxy POST body (`proposalHash` field). The proxy (when gateway is deployed) would validate this to prevent stale-preview application.

---

## 5. RISK-DUAL-N01 Contract

The intent layer enforces RISK-DUAL-N01 at every point:

| Field category | Written by intent layer? |
|----------------|--------------------------|
| `config.settings_data.current` (token overlay) | YES — palette, typography, accessibility-fix |
| `templates[key].sections[]` | YES — add-section only; appends; never removes existing sections |
| `section_definitions` | NO — never |
| `block_definitions` | NO — never |
| `layout` | NO — never |
| `locales` | NO — never |
| `renderer` | NO — never |

The input document is deep-cloned before any modification. The original `ThemeDocument` reference is never mutated.

---

## 6. Model Boundary

```typescript
import { MODEL_BOUNDARY } from '@letbuyy/theme-engine';

// MODEL_BOUNDARY.status === 'NOT_CONNECTED'
// MODEL_BOUNDARY.envVar === 'THEME_AI_PROVIDER_API_KEY'
// MODEL_BOUNDARY.gatewayRoute === 'POST /v1/theme-ai/parse-brief (does not exist)'
// MODEL_BOUNDARY.seams === [
//   'NL brief → ThemeBrief',
//   'NL colour mood → seed hex',
//   'NL section intent → SectionGoal[]',
// ]
// MODEL_BOUNDARY.deterministic === [
//   'ThemeBrief → generateTheme() → GenerateThemeResult',
//   'seed hex + PaletteVariant → deterministicPalette() → ExperienceTokens',
//   'SectionGoal[] → generateSectionOrder() → string[]',
// ]
```

`packages/theme-engine` is an edge/server-agnostic pure library. It contains zero imports of any HTTP client, LLM SDK, or provider credential. The `NOT_CONNECTED` status is not a flag to be toggled — it is the honest state of the NL seams until the gateway route and credential are deployed.

**To connect the NL seam (future phase):**
1. Implement `POST /v1/theme-ai/parse-brief` in `services/api-gateway/src/routes/themes/`.
2. Set `THEME_AI_PROVIDER_API_KEY` in the gateway deployment environment.
3. Update `AICustomizationPanel.tsx` to POST free-text to the same-origin proxy.
4. Update the proxy to forward to the parse-brief route and return the structured intent.
5. Enable the free-text input (remove `disabled`/`aria-disabled`).

No changes to `ai-intent-parser.ts` or the deterministic path are required — only the NL → structured intent translation step needs to be added.

---

## 7. Proxy Apply Path

```
Merchant clicks Apply
  → POST /api/themes/[themeId]/editor/ai-customization?store_name=xxx
      body: { intent, overlay: Partial<ExperienceTokens>, proposalHash }
      resolveOwnedStoreId → resolved.storeId
  → merchantApiFetch → POST /themes/:themeId/ai-customization (gateway)
      [NOT-CONNECTED today → gateway returns 404/503]
  → proxy returns 503 { not_connected: true, envVar: 'THEME_AI_PROVIDER_API_KEY' }
  → panel renders error state
```

When the gateway route is deployed:
```
  → gateway: resolveCustomUser + verifySiteOwnership
  → overlay validated against ExperienceSettingsOverlaySchema
  → applyExperienceToDocument(STYLE_ONLY, overlay)
  → saveDraft path (existing Phase P draft persistence)
  → panel renders 'applied' state
```

---

## 8. Comparison with Phase AB Pattern

| Dimension | Phase AB (safe-update) | Phase AC (AI customization) |
|-----------|------------------------|----------------------------|
| Entry point | `planThemeSafeUpdate(params)` | `proposeThemeCustomization(doc, intent)` |
| Preview-only variant | `computeThemeUpdateDiff(params)` | `diff` in proposal (always present) |
| Fail-closed gate | `parseThemeDocument(merged)` | `parseThemeDocument(result)` |
| Reversibility | `diff.conflicts[n].lostContent` | `diff.settingsChanged[n].previousValue` |
| Determinism | same (currentDoc, nextBundle) → same result | same (doc, intent) → same result + same hash |
| RISK-DUAL-N01 | structural merge, never writes section_definitions | token overlay only, never writes section_definitions |
| Rollback mechanism | Phase P `rollbackRelease` | Standard draft revert (no AI-specific path) |
| Apply path | `publishReleaseSnapshot` (Phase P) | `saveDraft` (existing draft path) |
| NOT-CONNECTED seam | none (fully wired) | NL seams NOT-CONNECTED; structured path fully wired |
