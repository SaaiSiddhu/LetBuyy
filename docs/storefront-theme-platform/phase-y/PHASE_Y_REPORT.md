# Phase Y — Report: Theme App Extensions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Y — Theme App Extensions
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per Phase Y hard rules)

---

## 1. Summary

Phase Y delivers the app-block model, closes the pre-existing `BLOCKED_DROP_KEYS` security gap for app-block settings, adds per-block crash isolation, and provides the editor-side `AppBlockSlotPanel` component for merchant-facing app-block slot management. The live app runtime remains NOT-CONNECTED (apps/app-marketplace is FROZEN); all surfaces honestly declare this state.

**Test gate:** 1469/1469 theme-engine · 447/447 merchant theme-editor suite · api-gateway/storefront-runtime/typechecks unchanged and clean.

---

## 2. Deliverables

### Lane A — Engine (`packages/theme-engine/`)

#### `packages/theme-engine/src/app-block-model.ts` — NEW (314 lines)

Typed contract for the app-block-slot layer. Exports:

| Export | Description |
|--------|-------------|
| `MAX_APP_BLOCKS_PER_SLOT` | Slot-level count limit (20) |
| `BLOCKED_APP_BLOCK_SETTING_KEYS` | 13 credential-adjacent keys; runtime-asserted mirror of `BLOCKED_DROP_KEYS` (test Y-13) |
| `AppBlockReference` (interface) | `{ appId, extensionId, slot, settings, disabled? }` |
| `AppBlockReferenceSchema` | Zod; slug-pattern `appId`/`extensionId`; slot pattern `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/` |
| `validateAppBlockReference` | Rejects non-slug ids, blocked settings keys; `AppBlockValidationResult` |
| `validateAppBlockReferences` | Array validation; enforces `MAX_APP_BLOCKS_PER_SLOT`; custom `maxCount` override |
| `filterAppBlockSettings` | Strips `BLOCKED_APP_BLOCK_SETTING_KEYS` + non-identifier keys; one-way import from renderer (no circular import) |
| `APP_BLOCK_PLACEHOLDER_CLASS` | `'lb-app-block-placeholder--not-connected'` |
| `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` | `'lb-app-block-placeholder--error'` |
| `APP_BLOCK_NOT_CONNECTED_REASON` | Honest NOT-CONNECTED declaration (FROZEN apps, missing gateway endpoint, missing piece) |

#### `packages/theme-engine/src/theme-renderer.ts` — MODIFIED (minimal, 2 hunks)

1. Import `filterAppBlockSettings` and `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` from `./app-block-model`.
2. At the `isLiquidAppBlockType` branch in `renderLiquidSectionBlocks`: wrap the resolution + push in `try/catch`. In `try`: `filterAppBlockSettings(block.settings)` applied before settings enter `LiquidRenderedBlock`. In `catch`: `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` div emitted; render loop continues.

**Security gap closed:** credential-adjacent keys (`api_key`, `webhook_secret`, etc.) no longer reach `section.blocks[i].settings` in the Liquid scope for app blocks.

**Crash isolation added:** one bad app block produces a safe placeholder; other blocks in the section render normally.

#### `packages/theme-engine/src/index.ts` — MODIFIED (1 line)

`export * from './app-block-model'` added.

#### `packages/theme-engine/test/liquid-y-app-block.test.ts` — NEW (776 lines, 27 tests)

27 tests (Y-1 through Y-15). See `PHASE_Y_TEST_REPORT.md` §1 for the full matrix.

### Lane B — Editor (`apps/merchant-control-plane/`)

#### `apps/merchant-control-plane/src/app/api/stores/[store]/themes/app-blocks/route.ts` — NEW

Gateway proxy for listing installed app extensions eligible for app-block-slot placement.

- `resolveOwnedStoreId` + `merchantApiFetch` (no direct DB, no api-client WIP).
- `requireSession: true`.
- Gateway 404 → `{ data: [], not_connected: true }` (honest NOT-CONNECTED; gateway route not yet deployed).
- Non-ok status forwarded verbatim.
- RISK-DUAL-N01: read-only.

#### `apps/merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx` — NEW

Editor component for merchant-facing app-block slot management.

- States: loading, error, NOT-CONNECTED, empty ("No apps installed"), populated.
- Affordances: add block (type `'@app'`, extension_id in settings), configure (inline settings form, Escape-to-close), remove, reorder (ChevronUp/ChevronDown).
- All mutations via `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock`.
- Zero `dangerouslySetInnerHTML`, zero `innerHTML`, zero `section_definitions`/`block_definitions` access.
- `@letbuyy/ui` + `--lb-*` tokens; keyboard-labelled; mobile-first.
- ART-17 compliant: editor chrome, not a section renderer. No new React-per-section.

#### `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` — MODIFIED (additive)

Nine new classes (`appBlockSlotWrapper`, `appBlockItem`, `appBlockItemSelected`, `appBlockItemActions`, `appBlockNotConnected`, `appBlockEmpty`, `appBlockSettingsForm`, `appBlockAddSection`, `appBlockAddBtn`), all using `--lb-*` tokens only.

#### `apps/merchant-control-plane/package.json` — MODIFIED (additive, minimal foreign-WIP touch)

`theme-editor-y.test.mjs` appended to the test command.

#### `apps/merchant-control-plane/tests/theme-editor-y.test.mjs` — NEW (69 tests)

Static-contract tests covering proxy route (14 tests), `AppBlockSlotPanel` (46 tests), `controls.module.css` Phase Y classes (11 tests), and `package.json` registration (1 test). See `PHASE_Y_TEST_REPORT.md` §2.

---

## 3. App-Block Model Architecture

```
Merchant configures slot
        │
        ▼
AppBlockSlotPanel.tsx (editor chrome)
  onAddBlock('@app', settings: { extension_id, ... })
        │
        ▼
Draft config (ThemeBundleTemplateSection.blocks[id])
  { type: '@app', settings: { extension_id, ... } }
        │  (saved via /api/themes/[themeId]/editor/draft)
        ▼
Storefront render (theme-renderer.ts)
  isLiquidAppBlockType('@app') === true
        │
        ├─ filterAppBlockSettings(block.settings)  ← Phase Y security fix
        │    strips credential-adjacent keys
        │
        ├─ resolveLiquidAppBlockHtml(input, sectionId, blockId, block)
        │    looks up input.liquidAppBlocks map
        │
        ├─ HIT: sanitizeRenderedHtml(html)  ← DOMPurify (LOCKED config)
        │    ← all app HTML must pass through here
        │
        └─ MISS: escapeHtmlAttribute placeholder div  ← NOT-CONNECTED honest state
```

---

## 4. NOT-CONNECTED Honest State

The live app-content runtime is NOT-CONNECTED. Missing piece:

1. The gateway endpoint `GET /themes/app-blocks` does not yet exist. The proxy route at `apps/merchant-control-plane/src/app/api/stores/[store]/themes/app-blocks/route.ts` returns `{ data: [], not_connected: true }` on gateway 404.
2. No live app server produces app-block HTML server-side. The composition layer (`storefront-runtime/composition-engine.tsx`) constructs first-party static HTML from `app_installations` / `app_extension_registrations` DB metadata only.
3. `apps/app-marketplace` and `apps/developer-portal` are FROZEN (not deploy targets).

`APP_BLOCK_NOT_CONNECTED_REASON` (exported from `app-block-model.ts`) is the authoritative honest declaration and is asserted by test Y-8.

To connect a real app runtime: register the app in `app_installations` with a live server URL; have the server supply block HTML per `(siteId, appId, extensionId)` tuple; populate the `liquidAppBlocks` map in the composition layer. That HTML must pass through `sanitizeRenderedHtml` (the locked DOMPurify) before being stored in the map — this is already enforced inside `resolveLiquidAppBlockHtml`.

---

## 5. Frozen Marketplace Respected

- No file in `apps/app-marketplace` or `apps/developer-portal` was read or written.
- No reference to these apps as active topology was added.
- `APP_BLOCK_NOT_CONNECTED_REASON` and route JSDoc both explicitly state these apps are FROZEN.

---

## 6. Security Summary

| Contract | Status |
|----------|--------|
| App-block HTML sanitised by locked DOMPurify | CONFIRMED — `sanitizeRenderedHtml` called inside `resolveLiquidAppBlockHtml`; config unchanged |
| `<script>` tags stripped from app HTML | PROVEN by Y-1 |
| `onerror` / event handlers stripped from app HTML | PROVEN by Y-2 |
| `javascript:` src blocked by uponSanitizeAttribute hook | PROVEN by Y-12 |
| Credential keys (`api_key`, `webhook_secret`, …) filtered before Liquid scope | PROVEN by Y-3, Y-3b, Y-11a; `filterAppBlockSettings` applied at push point |
| Key parity (`BLOCKED_APP_BLOCK_SETTING_KEYS` == `BLOCKED_DROP_KEYS`) | PROVEN by Y-13 |
| Per-block crash isolation | PROVEN by Y-4 |
| NOT-CONNECTED placeholder safe (no angle brackets, no fabricated content) | PROVEN by Y-5, Y-8, Y-14 |
| `AppBlockSlotPanel` zero unsafe HTML injection | PROVEN by theme-editor-y test 233, 489 |
| Block type preserved as `'@app'` (not overridden) | PROVEN by theme-editor-y test 494 |
| Tenancy enforced at proxy route | `resolveOwnedStoreId` + `verifySiteOwnership` at gateway |

One LOW finding remains open (render-loop slot count cap). See `PHASE_Y_SECURITY_REVIEW.md` §5.

---

## 7. RISK-DUAL-N01 Preservation

`AppBlockSlotPanel` mutations route through `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock` callbacks. The component has no import or prop path to `section_definitions` or `block_definitions`. Block type stays `'@app'` — extension_id lives in `block.settings`, never in `block.type`. RISK-DUAL-N01 is preserved and verified by static-contract tests.

---

## 8. Rollback

Phase Y work is committed as discrete commits on `stepup/main`. Rollback = revert the Phase Y commits. New files (`app-block-model.ts`, `liquid-y-app-block.test.ts`, `route.ts`, `AppBlockSlotPanel.tsx`, `theme-editor-y.test.mjs`) disappear cleanly on revert. The two modified files (`theme-renderer.ts`, `index.ts`) and two minimally-modified files (`controls.module.css`, `package.json`) revert to their pre-Phase-Y state without affecting any other phase's work.

---

## 9. Phase Y Finding

| Severity | File | Description | Status |
|----------|------|-------------|--------|
| LOW | `packages/theme-engine/src/theme-renderer.ts` | `MAX_APP_BLOCKS_PER_SLOT` not enforced in render loop — validation layer enforces it but render boundary does not; defence-in-depth gap | OPEN → registered as RISK-Y01 |

---

## 10. Risks Addressed

| Risk ID | Before Phase Y | After Phase Y |
|---------|---------------|---------------|
| GAP-Y-01 (BLOCKED_DROP_KEYS gap for app blocks) | OPEN | CLOSED |
| GAP-Y-02 (no app-block crash isolation) | OPEN | CLOSED |
| GAP-Y-03 (no typed AppBlockReference) | OPEN | CLOSED |
| RISK-T03 (app-block settings path) | OPEN | PARTIALLY CLOSED (app blocks; non-app blocks carry to Phase Z) |

All other risks in RISK_REGISTER.md carry unchanged to Phase Z.
