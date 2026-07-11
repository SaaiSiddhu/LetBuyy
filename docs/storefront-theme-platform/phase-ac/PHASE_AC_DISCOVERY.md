# Phase AC — Discovery: AI-Assisted Theme Customization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AC — AI-Assisted Customization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase AC delivers a two-lane, deterministic, NOT-CONNECTED-honest merchant AI customization system:

| Lane | Owner | Role |
|------|-------|------|
| Feature — Intent engine | `packages/theme-engine/` | Pure orchestration layer mapping structured intents to validated ThemeDocument proposals |
| B — Merchant UI | `apps/merchant-control-plane/` | AICustomizationPanel + same-origin proxy |

The gateway route (`services/api-gateway/src/routes/themes/theme-ai-customization-route.ts`) is registered as a Lane B deliverable but currently returns 404/503 — it exists as structural scaffolding for the NOT-CONNECTED seam. When deployed with `THEME_AI_PROVIDER_API_KEY`, it becomes the live path.

---

## 2. Pre-Phase-AC State

### 2.1 Phase L AI primitives already existed

Phase L delivered seven AI primitive files in `packages/theme-engine/src/`:

| File | Key export | Guarantee |
|------|-----------|-----------|
| `ai-color-system.ts` | `generateColorSystem`, `meetsWcagAA`, `contrastRatio` | WCAG 2.1 AA IEC 61966-2-1 math; deterministic |
| `ai-typography.ts` | `suggestTypographyPairing` | Known-font pairings from `EXPERIENCE_FONT_REGISTRY` only |
| `ai-layout.ts` | Layout section ordering | `PARITY_SECTION_TYPES` only; throws on unknown type |
| `ai-theme-generator.ts` | `generateThemeFromBrief` | Structured `ThemeBrief` input only; 0 lint-error output guaranteed |
| `ai-accessibility.ts` | `analyzeThemeAccessibility`, `suggestAccessibilityFixes` | Deterministic algorithms; no ML |
| `ai-optimizer.ts` | `optimizeThemeBundle` | Cannot emit invalid bundle (fail-closed) |
| `ai-personalization.ts` | `resolveExperienceForIndustry` | Segment decision NOT-CONNECTED |
| `theme-ai-sdk.ts` (facade) | `THEME_AI_SDK`, `MODEL_BOUNDARY` | Zero LLM imports; grep-verified |

`MODEL_BOUNDARY` at `theme-ai-sdk.ts` lines 919–933 documents the three NOT-CONNECTED NL seams:

1. NL brief → ThemeBrief
2. NL colour mood → seed hex
3. NL section intent → SectionGoal[]

### 2.2 Phase O apply path already existed

Phase O delivered `computeExperienceApplyDiff` (pure preview) and `applyExperienceToDocument` (fail-closed, RISK-DUAL-N01 compliant) in `packages/theme-engine/src/experience-apply.ts`. The AI proposal reuse pattern was established there:

- STYLE_ONLY mode: token overlay applied to `config.settings_data.current`; no template changes.
- COMPLETE_DESIGN mode: section ordering rebuilt from `EXPERIENCE_COMPOSITIONS`.

AI palette/typography intents map to STYLE_ONLY. Section-goal intents map to COMPLETE_DESIGN. Both modes are NOT-CONNECTED at the NL-parsing seam.

### 2.3 Phase AB apply/diff pattern already existed

Phase AB established the `computeXxxDiff` (pure preview) → `applyXxxToDocument` (fail-closed, validates before return) pattern. Phase AC follows this identical pattern for the intent layer.

### 2.4 What Phase AC needed to add

What did NOT exist before Phase AC:

1. **A structured orchestration layer** mapping `AICustomizationIntent` variants to the correct Phase L primitive and Phase O apply path, with a single `proposeThemeCustomization` entry point.
2. **An honest NOT-CONNECTED contract at the intent layer** — all free-text intents explicitly return `AINotConnectedResult`; no heuristic NLU.
3. **A reversibility proof** — every proposal carries a diff that can be used to reconstruct the pre-proposal state.
4. **A merchant UI** — structured suggestion chips, preview diff, Apply/Reject controls, and an honest NOT-CONNECTED badge for free-text.
5. **A same-origin proxy** — `resolveOwnedStoreId` tenancy + `merchantApiFetch` to the gateway; 503 when the gateway route is absent (NOT-CONNECTED forward).

### 2.5 The model boundary is NOT-CONNECTED by design

`packages/theme-engine` is an edge/server-agnostic pure library. It cannot import an HTTP client, hold credentials, or call outbound APIs. The gateway route `POST /v1/theme-ai/parse-brief` does not exist in `services/api-gateway/src/routes/` (grep-verified at phase close). When that route is deployed and `THEME_AI_PROVIDER_API_KEY` is set, the full NL flow becomes:

```
merchant free-text
  → POST /v1/theme-ai/parse-brief  [NOT-CONNECTED today]
  → ThemeBrief / AICustomizationIntent
  → proposeThemeCustomization()    [CONNECTED today]
  → AICustomizationProposal
  → merchant Apply
  → POST /api/themes/.../ai-customization [proxy → gateway]
  → applyExperienceToDocument(STYLE_ONLY) [CONNECTED today]
  → validated ThemeDocument written to draft
```

Today only the middle three steps (proposal engine → merchant UI → apply proxy) are structurally present.

---

## 3. Prior-phase risk carry-ins targeted at Phase AC

The following risks were retargeted to Phase AC from prior phases. Phase AC did NOT touch any of the responsible files; they carry to Phase AD.

| Risk ID | Severity | File | Status |
|---------|----------|------|--------|
| RISK-T01 | MEDIUM | `theme-bundle.ts` / `parseLiquidThemePackageBundle` | OPEN → Phase AD |
| RISK-T02 | MEDIUM | `theme-bundle.ts` / `parseLiquidThemePackageBundle` | OPEN → Phase AD |
| RISK-T03 | LOW | `theme-renderer.ts` lines 818/824 | OPEN → Phase AD |
| RISK-T04 | LOW | `theme-renderer.ts` `RENDERER_MAX_BLOCK_DEPTH` | OPEN → Phase AD |
| RISK-T05 | MEDIUM | `SectionTreePanel.tsx` | OPEN → Phase AD |
| RISK-T06 | LOW | `theme-document.ts` | OPEN → Phase AD |
| RISK-SEC-U01 | MEDIUM | `schema-field-extensions.ts` | OPEN → Phase AD |
| RISK-SEC-U02 | MEDIUM | `ColorBackgroundControl.tsx` | OPEN → Phase AD |
| RISK-SEC-U03 | MEDIUM | `schema-field-extensions.ts` | OPEN → Phase AD |
| RISK-A11Y-U01 | MEDIUM | `SchemaFormRenderer.tsx` | OPEN → Phase AD |
| RISK-A11Y-U02 | LOW | `CheckboxControl.tsx` et al. | OPEN → Phase AD |
| RISK-W01 | MEDIUM | `dynamic-source-binding.ts` | OPEN → Phase AD |
| RISK-W06 | LOW | `theme-renderer.ts` block-level settings | OPEN → Phase AD |
| RISK-Y01 | LOW | `theme-renderer.ts` render loop | OPEN → Phase AD |
| RISK-Z01 | MEDIUM | `theme-locale.ts` | OPEN → Phase AD |
| RISK-Z03–Z06 | LOW | Translation proxy/gateway | OPEN → Phase AD |
| RISK-AA-01/02 | LOW | `custom-css-sanitizer.ts` | OPEN → Phase AD |
| RISK-X01 | LOW | `upload.ts` | OPEN → Phase AD |
| RISK-TOCTOU-Q01 | MEDIUM | `theme_instances` plan-limit | OPEN → Phase AD |
| RISK-AB-01–03 | LOW | Various | OPEN → Phase AD |

All of these files were untouched by Phase AC deliverables.

---

## 4. Constraint Inventory

### 4.1 Honesty constraints (inherited from Phase L)

- No LLM, no HTTP client, no credential, no wall-clock call in `packages/theme-engine`.
- Free-text understanding is NOT-CONNECTED; explicit `AINotConnectedResult` returned.
- `MODEL_BOUNDARY` constant exported from `theme-ai-sdk.ts` remains the canonical seam.

### 4.2 Safety constraints

- Every proposal output passes `parseThemeDocument` (Zod + version gate).
- WCAG 2.1 AA is guaranteed via `deterministicPalette` → `meetsWcagAA` double-guard (fail-closed).
- Font families are from `EXPERIENCE_FONT_REGISTRY` only (via `suggestTypographyPairing`).
- Added sections must be in `BUILT_IN_SECTION_TYPES` AND present in `section_definitions` (parity check).

### 4.3 RISK-DUAL-N01 constraint

Only `config.settings_data.current` and `template.sections[]` are written. `section_definitions`, `block_definitions`, `layout`, `locales`, and `renderer` are never touched. Input document is deep-cloned; the original is immutable.

### 4.4 NO-AUTO-APPLY constraint

`canApply` requires `proposal !== null` AND `proposal.type === 'token-overlay'` AND `panelState === 'preview'`. The Apply button carries `aria-disabled` when not applicable; it is never hidden.

### 4.5 Determinism constraint

`proposeThemeCustomization` is pure: no `Math.random()`, no `Date.now()`, no network, no DOM. `djb2Hash` is a pure accumulator. Same intent + same document → identical proposal and proposalHash.

### 4.6 Foreign WIP isolation

`AICustomizationPanel.tsx` does not import from `editor/page.tsx`, `globals.css`, `@letbuyy/api-client`, or `ExperiencePicker.tsx`. The proxy route does not import from the gateway `src/index.ts` or `@letbuyy/api-client`.
