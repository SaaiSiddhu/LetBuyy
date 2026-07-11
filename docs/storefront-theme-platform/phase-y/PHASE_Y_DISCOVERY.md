# Phase Y — Discovery: Theme App Extensions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Y — Theme App Extensions
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase Y formalises the theme engine's contract with **app-block-slot** sections — sections that allow installed app extensions to inject block-level HTML into the Liquid render tree. Two lanes:

| Lane | Owner | Files |
|------|-------|-------|
| A — Engine (Lane A) | theme-engine | `app-block-model.ts` (NEW), `theme-renderer.ts` (MODIFIED), `index.ts` (MODIFIED), `liquid-y-app-block.test.ts` (NEW) |
| B — Editor (Lane B) | merchant-control-plane | `route.ts` proxy (NEW), `AppBlockSlotPanel.tsx` (NEW), `controls.module.css` (MODIFIED), `package.json` (MODIFIED), `tests/theme-editor-y.test.mjs` (NEW) |

---

## 2. Existing App-Block Infrastructure (Pre-Phase Y)

### 2.1 Render path (`theme-renderer.ts`)

The renderer already understood app blocks before Phase Y:

- `isLiquidAppBlockType(block.type)` detects `'@app'` or `'app:*'` type strings.
- `resolveLiquidAppBlockHtml(input, sectionId, blockId, block)` looks up candidate keys in `input.liquidAppBlocks` (`sectionId.blockId`, `blockId`, `block.type`, `block.settings.extension_handle`, `block.settings.slot`).
- On a cache hit: calls `sanitizeRenderedHtml(configured)` (line 1156–1157, locked DOMPurify with `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`).
- On a cache miss: emits a static placeholder `<div>` using `escapeHtmlAttribute` at line 1160 (safe without `sanitizeRenderedHtml` because `blockId` and `block.type` are bundle-schema-validated at parse time).
- The section HTML itself is sanitised at line 443 via `sanitizeRenderedHtml`.

### 2.2 Composition layer (`storefront-runtime/composition-engine.tsx`)

`buildLiquidAppBlocks` (line 138) normalises `store.templateConfig.appBlocks` via `normalizeAppBlockInstances`, then calls `renderLiquidAppBlockHtml` (line 109) to produce first-party HTML from `app_installations` / `app_extension_registrations` DB metadata (`title`, `content.heading/body/cta`, `iframe_url`). No external app server is called server-side. `render_mode: 'iframe'` defers actual app content to the browser loading `iframe_url`.

### 2.3 Gateway (`storefront.ts` line 921)

`loadPublicStorefrontAppBlocks` reads installed-app DB metadata. No app server is called. The gateway's `/themes/app-blocks` endpoint does **NOT** exist yet (missing piece; the proxy route returns `not_connected: true` on 404).

---

## 3. Security Gaps Found in Discovery

### GAP-Y-01 — BLOCKED_DROP_KEYS gap in app-block section-level drop (CRITICAL pre-Phase Y)

`BLOCKED_DROP_KEYS` was applied only to global `settings` drops (theme-renderer.ts lines 905, 919), **not** to app-block settings entering the section-level Liquid scope (lines 415–421: `section.blocks[i].settings`). A Liquid template echoing `{{ block.settings.api_key }}` would expose any app-block credential-adjacent key without stripping.

**Resolution in Phase Y (Lane A):** `filterAppBlockSettings` (new, `app-block-model.ts`) is applied at the app-block push point inside `renderLiquidSectionBlocks`, stripping `BLOCKED_APP_BLOCK_SETTING_KEYS` (13 keys, identical to `BLOCKED_DROP_KEYS`) before settings enter the `LiquidRenderedBlock` and the Liquid scope.

### GAP-Y-02 — No per-block crash isolation for app blocks (MEDIUM pre-Phase Y)

Before Phase Y there was no `try/catch` wrapping the `isLiquidAppBlockType` branch. A throwing app block resolution would surface as an unhandled exception in the section render loop, potentially taking down the entire section.

**Resolution in Phase Y (Lane A):** A `try/catch` now wraps the branch; on throw, an `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` div is emitted and rendering continues for the next block.

### GAP-Y-03 — No typed AppBlockReference contract

The `liquidAppBlocks` map was an untyped runtime bag. No slug-pattern enforcement, no per-slot count limit, no blocked-key validation at the point of reference construction.

**Resolution in Phase Y (Lane A):** `AppBlockReferenceSchema` (Zod), `validateAppBlockReference`, `validateAppBlockReferences` (MAX_APP_BLOCKS_PER_SLOT = 20 enforced), all exported from `app-block-model.ts`.

### GAP-Y-04 — Editor had no app-block slot management UI (FUNCTIONAL pre-Phase Y)

No component existed to let a merchant add, configure, remove, or reorder app blocks in an app-block-slot section.

**Resolution in Phase Y (Lane B):** `AppBlockSlotPanel.tsx` provides full CRUD affordance over app-block slot instances via `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock` callbacks. `dangerouslySetInnerHTML` is absent by design.

---

## 4. Runtime Reality — NOT-CONNECTED Honest State

The app-block live runtime does not exist. Specifically:

- `apps/app-marketplace` and `apps/developer-portal` are FROZEN (not deploy targets).
- No live app server produces app-block HTML. The composition layer constructs first-party static HTML from DB-stored metadata only.
- The gateway endpoint `GET /themes/app-blocks` is not yet deployed. The Phase Y proxy route returns `{ data: [], not_connected: true }` on 404 and `AppBlockSlotPanel` renders an honest "No apps installed — NOT-CONNECTED" state.

This honest state is codified in `APP_BLOCK_NOT_CONNECTED_REASON` (exported from `app-block-model.ts`) and asserted by tests Y-5, Y-8.

---

## 5. Foreign WIP in Scope

The following files were pre-identified as foreign WIP that Phase Y must not stage:

- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- `services/api-gateway/src/index.ts`
- `packages/shared-types/src/index.ts`
- `apps/merchant-control-plane/src/app/globals.css`
- `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx`

Phase Y confirmed zero touches to all five files.

---

## 6. DOMPurify Config — Confirmed Locked

The `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` in `theme-renderer.ts` was **NOT modified** by Phase Y. The existing config:

- `FORBID_TAGS: ['base', 'embed', 'object', 'script']`
- `FORBID_ATTR: ['style']`
- `uponSanitizeAttribute` hook: strips `data-*` attrs with angle brackets; blocks `javascript:` and `data:text/html` srcs.
- `ADD_ATTR: ['data-app-block-app-id', 'data-app-block-extension-id', 'data-app-block-slot', 'data-app-block-type', 'data-letbuyy-app-block']`

This config is sufficient for both the existing and Phase Y app-block render paths.

---

## 7. Open Finding from Discovery

One defence-in-depth gap was found at discovery time and carried forward as a LOW finding (not a security regression — the render cap is enforced at the validation layer):

**LOW — MAX_APP_BLOCKS_PER_SLOT not enforced in render loop**: `validateAppBlockReferences` enforces the 20-block-per-slot limit at save time, but the render loop in `renderLiquidSectionBlocks` iterates `orderedKeys(input.section.blocks, ...)` without a corresponding render-time count cap. A crafted bundle bypassing the validator could render more than 20 app blocks. All data flows through `LiquidThemePackageBundleSchema` before storage, so this is a defence-in-depth gap, not an exploitable path today.

See `PHASE_Y_SECURITY_REVIEW.md` §5.
