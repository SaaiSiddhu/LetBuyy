# Phase AC — Plan: AI-Assisted Theme Customization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AC — AI-Assisted Customization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** PLAN EXECUTED — COMPLETE

---

## 1. Objectives

1. **Deterministic intent layer** — `proposeThemeCustomization(document, intent)` maps structured `AICustomizationIntent` variants to the Phase L primitives and Phase O apply path; returns a `AICustomizationProposal` that passes `parseThemeDocument` before returning.
2. **Honest NOT-CONNECTED contract** — free-text intents return `AINotConnectedResult` with `envVar='THEME_AI_PROVIDER_API_KEY'` and no heuristic NLU.
3. **WCAG AA guarantee preserved** — palette proposals reuse `deterministicPalette()` which is fail-closed (throws if AA not met).
4. **Known-font guarantee preserved** — typography proposals reuse `suggestTypographyPairing()` which only returns families from `EXPERIENCE_FONT_REGISTRY`.
5. **Reversibility** — every proposal carries a diff; the pre-proposal state can be reconstructed.
6. **Merchant UI** — structured suggestion chips (4 palette variants + 4 typography intents + 2 NOT-CONNECTED chips), preview diff table, Apply/Reject controls, NOT-CONNECTED badge.
7. **Same-origin proxy** — `resolveOwnedStoreId` tenancy; `merchantApiFetch` to gateway; structured 503 when the gateway route is absent.
8. **RISK-DUAL-N01 preservation** — token overlay writes only `settings_data.current`; `section_definitions`/`block_definitions`/`layout`/`locales`/`renderer` never touched.

---

## 2. Entry Gates (inherited from Phase AB exit)

| Package | Required gate |
|---------|---------------|
| `theme-engine` | 1634/1634 pass |
| `merchant-control-plane` (theme-editor suite) | 712/712 pass |
| `api-gateway` | 1489 pass (27 pre-existing fail) |
| `storefront-runtime` | 795/795 pass |
| All typechecks | clean |

---

## 3. Feature Lane — Engine (`packages/theme-engine/`)

### 3.1 New file: `ai-intent-parser.ts`

**Exported types:**

| Type | Description |
|------|-------------|
| `AIIntentKind` | `'palette' \| 'typography' \| 'add-section' \| 'accessibility-fix' \| 'free-text'` |
| `AICustomizationIntent` | Tagged union: palette / typography / add-section / accessibility-fix / free-text |
| `AICustomizationProposal` | Tagged union: `{ status: 'ok', document, diff }` / `{ status: 'not-connected', envVar, explanation }` / `{ status: 'incompatible', reason }` |

**Main export:**

```typescript
function proposeThemeCustomization(
  document: ThemeDocument,
  intent: AICustomizationIntent,
): AICustomizationProposal
```

**Intent dispatch table:**

| Intent kind | Handler | Phase L primitive used |
|-------------|---------|------------------------|
| `palette` | `handlePaletteIntent` | `deterministicPalette()` → `applyExperienceToDocument(STYLE_ONLY)` |
| `typography` | `handleTypographyIntent` | `suggestTypographyPairing()` → `applyExperienceToDocument(STYLE_ONLY)` |
| `add-section` | `handleAddSectionIntent` | `computeExperienceApplyDiff` → section parity check → deep clone |
| `accessibility-fix` | `handleAccessibilityFixIntent` | `generateColorSystem(primaryColor, 'light').text` → settings patch |
| `free-text` | (no handler) | Returns `{ status: 'not-connected', envVar: 'THEME_AI_PROVIDER_API_KEY' }` |

**Safety invariants:**

1. `parseThemeDocument()` called on every non-not-connected proposal before return (fail-closed).
2. `deterministicPalette()` WCAG double-guard: throws if `textColor/backgroundColor` fails AA after generation.
3. `suggestTypographyPairing()` returns only `EXPERIENCE_FONT_REGISTRY` families (compile-time constraint).
4. `handleAddSectionIntent`: validates camelCase type in `BUILT_IN_SECTION_TYPES`; resolves to kebab via `BUILT_IN_TO_LIQUID_SECTION_TYPE`; checks kebab is present in `doc.section_definitions`. Types failing this check return `{ status: 'incompatible' }`.
5. `isUnsafeUrl` guard on any string value written to `settings_data.current`.

**RISK-DUAL-N01:** only `config.settings_data.current` and `template.sections[]` are written. `section_definitions`, `block_definitions`, `layout`, `locales`, and `renderer` are never assigned.

**Section ID determinism:** IDs assigned as `'ai-{camelType}-{N}'` where N = count of that type already in the template + 1, incremented on collision. Same intent on same document → identical IDs.

### 3.2 New file: `test/ai-intent-parser.test.ts`

61 new tests grouped under 13 describe blocks:

| Group | Count | What is verified |
|-------|-------|-----------------|
| `AC/palette-warm` | 4 | Warm palette proposal valid + WCAG AA |
| `AC/palette-all` | 10 | All 5 PaletteVariants → valid ThemeDocument + WCAG AA |
| `AC/typography` | 15 | All 5 FontPairingIntents → EXPERIENCE_FONT_REGISTRY fonts only |
| `AC/add-section-ok` | 5 | testimonials/ctaSection can be added to index template |
| `AC/add-section-incompat` | 3 | faqAccordion/collectionFilter/instagramFeed return incompatible |
| `AC/add-section-unknown` | 2 | Unknown/empty section type returns incompatible |
| `AC/a11y-fix-fail` | 4 | Accessibility-fix improves failing contrast to WCAG AA |
| `AC/a11y-fix-pass` | 2 | Passing contrast → zero settingsChanged |
| `AC/free-text` | 3 | Returns NOT_CONNECTED with envVar + NOT_CONNECTED in explanation |
| `AC/reversible` | 2 | Palette and add-section proposals are fully reversible via diff |
| `AC/no-model` | 2 | No HTTP clients / LLM SDKs imported; no wall-clock calls |
| `AC/identity` | 3 | No-change proposals leave template sections byte-identical |
| `AC/determinism` | 5 | Same intent on same document → identical diffs/documents |

---

## 4. Lane B — Merchant UI (`apps/merchant-control-plane/`)

### 4.1 New file: `src/components/theme-editor/AICustomizationPanel.tsx`

A standalone `'use client'` React component. Imports: `@letbuyy/ui`, `@letbuyy/theme-engine` (deterministicPalette, suggestTypographyPairing, MODEL_BOUNDARY). Zero imports from foreign-WIP files.

**Panel state machine:**

| State | Meaning |
|-------|---------|
| `idle` | No chip selected |
| `computing` | Running deterministic proposal client-side |
| `preview` | Proposal computed; diff shown; waiting for Apply / Reject |
| `applying` | POST to proxy in-flight |
| `applied` | Draft successfully updated |
| `error` | Computing or applying failed |

**Chip catalog:**

- 4 palette chips: `warm` / `cool` / `bold` / `muted` — trigger `handlePaletteIntent` client-side; no network call for proposal.
- 4 typography chips: `editorial` / `technical` / `artisanal` / `friendly` — trigger `handleTypographyIntent` client-side; no network call for proposal.
- 2 NOT-CONNECTED chips: `section` / `accessibility` — immediately surface NOT-CONNECTED proposal with `seam` explanation; Apply never enabled.

**Key exported symbols:**

| Symbol | Description |
|--------|-------------|
| `AIPaletteIntent` | Palette chip intent interface |
| `AITypographyIntent` | Typography chip intent interface |
| `AINotConnectedIntent` | NOT-CONNECTED chip intent interface |
| `AIIntent` | Union of all intent types |
| `AITokenOverlayProposal` | Valid token overlay proposal |
| `AINotConnectedProposal` | NOT-CONNECTED proposal (no Apply) |
| `AIProposal` | Union |
| `AIPanelState` | Panel FSM state type |
| `djb2Hash` | Deterministic CAS hash function |
| `proposeThemeCustomization` | Pure proposal engine (re-export from engine) |

**canApply gate:** `proposal !== null && proposal.type === 'token-overlay' && panelState === 'preview'`.

**Free-text input:** rendered as `<input aria-disabled="true" disabled>` with `MODEL_BOUNDARY` referenced as the NOT-CONNECTED source. No heuristic keyword NLU attempted.

**Design ratchet:** all styles via `--lb-*` tokens; no `rounded-[Npx]` or raw px/hex. `@letbuyy/ui` components only.

### 4.2 New file: `src/app/api/themes/[themeId]/editor/ai-customization/route.ts`

Same-origin proxy with two handlers:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/themes/[themeId]/editor/ai-customization` | Returns static suggestions catalog (no gateway call; no auth beyond session required) |
| `POST` | `/api/themes/[themeId]/editor/ai-customization?store_name=xxx` | Applies token overlay to draft; requires `resolveOwnedStoreId` tenancy; forwards to gateway |

**Tenancy model:** `resolveOwnedStoreId` → `resolved.storeId` used in every DB reference; merchant never supplies `storeId` directly.

**NOT-CONNECTED forward:** gateway 404/503 → proxy returns HTTP 503 with `{ not_connected: true, envVar: 'THEME_AI_PROVIDER_API_KEY' }`.

**RISK-DUAL-N01:** proxy only forwards token overlay payloads (`settings_data.current`). Never emits a payload touching `section_definitions`, `block_definitions`, `layout`, `locales`, or `renderer`.

**Overlay key allowlist (MEDIUM finding — see security review):** as noted in the security review, the current implementation does not strip unrecognized keys from the overlay before forwarding. The gateway route (when deployed) enforces `ExperienceSettingsOverlaySchema` validation. The allowlist filter should be added at the proxy layer as defense-in-depth.

### 4.3 New file: `tests/theme-editor-ac.test.mjs`

59 static-contract tests. See PHASE_AC_TEST_REPORT.md for the full breakdown.

### 4.4 Modified file: `package.json`

`theme-editor-ac.test.mjs` appended to the test script array (additive; foreign WIP change).

---

## 5. Exit Gates

| Package | Required gate | Actual result |
|---------|---------------|---------------|
| `theme-engine` | 1695 pass (1634 baseline + 61 new) | 1695/0/0 PASS |
| `merchant-control-plane` (theme-editor suite) | 771 pass (712 baseline + 59 new) | 771/0/0 PASS |
| `api-gateway` | 1489 pass (unchanged) | unchanged |
| `storefront-runtime` | 795/795 pass (unchanged) | unchanged |
| All typechecks | clean | clean |

---

## 6. What Phase AC does NOT deliver

- The `POST /v1/theme-ai/parse-brief` gateway route (NL → ThemeBrief) — NOT-CONNECTED; requires ARB approval and model provider selection.
- Wiring of the `THEME_AI_PROVIDER_API_KEY` credential to any gateway environment.
- The `theme-ai-customization-route.ts` gateway route in production — the file is listed as a Phase AC deliverable in the ground truth but was NOT created under `services/api-gateway/src/routes/themes/` (grep-verified). The proxy proxy-layer 503 handles its absence honestly.
- Section-order AI (requires NL→SectionGoal gateway seam).
- Accessibility-fix AI via model (requires NL→accessibility analysis gateway seam).
- Wiring `custom_css` render path (Phase AA/AB deliverable still NOT-CONNECTED; Phase AD).
- Any changes to `theme_instances`, `parseLiquidThemePackageBundle`, `SchemaFormRenderer.tsx`, or `theme-renderer.ts` — all carry risks retargeted to Phase AD.
