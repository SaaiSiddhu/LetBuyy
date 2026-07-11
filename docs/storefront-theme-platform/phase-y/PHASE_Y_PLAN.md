# Phase Y — Plan: Theme App Extensions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Y — Theme App Extensions
**Date:** 2026-07-11
**Branch:** `stepup/main`

---

## 1. Objectives

1. Formalise the typed `AppBlockReference` contract used by app-block-slot sections.
2. Close the `BLOCKED_DROP_KEYS` gap for app-block settings (GAP-Y-01).
3. Add per-block crash isolation for app-block resolution (GAP-Y-02).
4. Deliver the `AppBlockSlotPanel` editor component for merchant-facing app-block slot management (GAP-Y-04).
5. Deliver the `GET /api/stores/[store]/themes/app-blocks` proxy route with honest NOT-CONNECTED handling.
6. Add 27 engine tests and 69 editor static-contract tests (gate: ALL green).
7. Preserve the locked DOMPurify config — no modifications to `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`.
8. Touch zero foreign WIP files.

---

## 2. Non-Objectives

- Connecting the live app runtime (FROZEN: `apps/app-marketplace`, `apps/developer-portal`).
- Adding the gateway `GET /themes/app-blocks` route (future phase; proxy handles 404 honestly).
- Deploying any new DB migration (no schema changes required for Phase Y).
- Modifying the DOMPurify sanitizer config.
- Addressing RISK-T01, RISK-T02, RISK-T04, RISK-T05, RISK-T06 (none of these files are in Phase Y scope beyond `theme-renderer.ts` for the app-block push point).

---

## 3. Lane A — Engine

### 3.1 New file: `packages/theme-engine/src/app-block-model.ts`

**Exports:**

| Export | Kind | Purpose |
|--------|------|---------|
| `MAX_APP_BLOCKS_PER_SLOT` | `const number` | Slot-level count limit (20) |
| `BLOCKED_APP_BLOCK_SETTING_KEYS` | `ReadonlySet<string>` | 13 credential-adjacent keys; mirrors `BLOCKED_DROP_KEYS` |
| `AppBlockReference` | `interface` | Typed slot datum (`appId`, `extensionId`, `slot`, `settings`, `disabled?`) |
| `AppBlockReferenceSchema` | Zod schema | Slug-pattern `appId`/`extensionId`; slot pattern; settings record |
| `validateAppBlockReference` | `function` | Single reference; rejects non-slug ids, blocked settings keys |
| `validateAppBlockReferences` | `function` | Array; enforces `MAX_APP_BLOCKS_PER_SLOT`; custom `maxCount` override |
| `filterAppBlockSettings` | `function` | Strips `BLOCKED_APP_BLOCK_SETTING_KEYS` + non-identifier keys; no circular import |
| `APP_BLOCK_PLACEHOLDER_CLASS` | `const string` | `'lb-app-block-placeholder--not-connected'` |
| `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` | `const string` | `'lb-app-block-placeholder--error'` |
| `APP_BLOCK_NOT_CONNECTED_REASON` | `const string` | Honest NOT-CONNECTED declaration |

**Import rule:** `app-block-model.ts` must NOT import from `theme-renderer.ts` (would create a circular import). `BLOCKED_APP_BLOCK_SETTING_KEYS` is defined independently here; test Y-13 asserts parity with `BLOCKED_DROP_KEYS` at runtime.

### 3.2 Modified: `packages/theme-engine/src/theme-renderer.ts`

Two additions at the `isLiquidAppBlockType` branch in `renderLiquidSectionBlocks`:

1. Import `filterAppBlockSettings` and `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` from `./app-block-model`.
2. Wrap the app-block push with `try/catch`:
   - In the `try` block: apply `filterAppBlockSettings(block.settings)` before settings enter the `LiquidRenderedBlock.settings` and the Liquid scope.
   - In the `catch` block: push an `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` div and continue to the next block (crash isolation).

### 3.3 Modified: `packages/theme-engine/src/index.ts`

Add `export * from './app-block-model'`.

### 3.4 New file: `packages/theme-engine/test/liquid-y-app-block.test.ts`

27 tests across 15 test IDs (Y-1 through Y-15). See `PHASE_Y_TEST_REPORT.md` for the full list.

---

## 4. Lane B — Editor

### 4.1 New file: `apps/merchant-control-plane/src/app/api/stores/[store]/themes/app-blocks/route.ts`

- `GET` handler only; read-only.
- `resolveOwnedStoreId` for tenancy (merchant ES256 session must own store).
- `merchantApiFetch` to gateway `/themes/app-blocks?store_id={resolvedStoreId}`.
- Gateway 404 → `{ data: [], not_connected: true }` (honest NOT-CONNECTED).
- Non-ok gateway status forwarded verbatim.
- `requireSession: true` — unauthenticated requests rejected.
- RISK-DUAL-N01: read-only; never mutates `section_definitions`/`block_definitions`.

### 4.2 New file: `apps/merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx`

- `'use client'` component.
- Fetches `InstalledAppExtension[]` via same-origin `/api/stores/{storeName}/themes/app-blocks`.
- States: loading (`aria-busy`), error (`role="alert"`), NOT-CONNECTED, empty ("No apps installed"), populated.
- Affordances: add block (type `'@app'`, `extension_id` in settings), configure (inline `BlockSettingsForm` with Escape-to-close), remove (`onRemoveBlock`), reorder (`onMoveBlock` + `ChevronUp`/`ChevronDown`).
- All mutations via `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock` callbacks.
- Zero `dangerouslySetInnerHTML`, zero `innerHTML`, zero `section_definitions`/`block_definitions` access.
- Block type stays `'@app'`; `extension_id` goes into `block.settings`, never overrides `block.type`.
- `@letbuyy/ui` + `--lb-*` tokens; keyboard-labelled buttons; mobile-first.

### 4.3 Modified: `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css`

Nine new CSS classes all using `--lb-*` tokens:
`appBlockSlotWrapper`, `appBlockItem`, `appBlockItemSelected`, `appBlockItemActions`, `appBlockNotConnected`, `appBlockEmpty`, `appBlockSettingsForm`, `appBlockAddSection`, `appBlockAddBtn`.

### 4.4 Modified: `apps/merchant-control-plane/package.json`

Append `theme-editor-y.test.mjs` to the test command (additive; foreign WIP file touched minimally).

### 4.5 New file: `apps/merchant-control-plane/tests/theme-editor-y.test.mjs`

69 static-contract tests. See `PHASE_Y_TEST_REPORT.md` §2.

---

## 5. Gate

| Scope | Baseline | Phase Y adds | Target |
|-------|----------|--------------|--------|
| theme-engine tests | 1441 | +27 (1469 after rounding from 1442 baseline) | 1469/1469 pass |
| merchant-control-plane theme-editor suite | 378 | +69 | 447/447 pass |
| api-gateway | 519 pass | 0 | unchanged |
| storefront-runtime | 795 | 0 | unchanged |
| Typechecks | all clean | 0 errors | clean |

---

## 6. Constraints

- DOMPurify config: LOCKED — do NOT modify `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`.
- Foreign WIP: ZERO touches to `page.tsx`, `api/src/index.ts`, `shared-types/src/index.ts`, `globals.css`, `ExperiencePicker.tsx`.
- Commits: uncommitted at phase close (Phase Y hard rules).
- Design tokens: `--lb-*` only in all new CSS. No raw `px`, no `rounded-[Npx]`.
- RISK-DUAL-N01: mutations route through callbacks only; no `section_definitions`/`block_definitions` writes.

---

## 7. Risk Carry-Forward

Risks targeted at Phase Y but deferred (files not in scope or not yet justified):

| Risk ID | Severity | Reason deferred |
|---------|----------|-----------------|
| RISK-T01 | MEDIUM | `parseLiquidThemePackageBundle` pre-Zod depth; `theme-bundle.ts` not in Phase Y scope |
| RISK-T02 | MEDIUM | `assertNoBlockedKeysInRaw` absent in bundle path; same |
| RISK-T04 | LOW | `RENDERER_MAX_BLOCK_DEPTH` private; `theme-renderer.ts` touched, but export addition is a trivial follow-up — deferred to Phase Z |
| RISK-T05 | MEDIUM | `allowedChildTypes` wiring; `SectionTreePanel.tsx` not in Phase Y scope |
| RISK-T06 | LOW | `UnsupportedThemeDocumentFeatureError` dead export; `theme-document.ts` not in Phase Y scope |
| RISK-SEC-U01/U02/U03 | MEDIUM | `schema-field-extensions.ts`/controls not in Phase Y scope |
| RISK-A11Y-U01/U02 | MEDIUM/LOW | Same |
| RISK-STYLE-U01/U02 | LOW | Same |
| RISK-W01 | MEDIUM | `dynamic-source-binding.ts` not in Phase Y scope |
| RISK-W04/W05 | LOW | `ResourcePickerControl.tsx` not in scope |
| RISK-W06 | LOW | Block-level binding resolution; `theme-renderer.ts` touched but block-level loop not in Phase Y change |
| RISK-X01 | LOW | Storage key structure; not in Phase Y scope |
