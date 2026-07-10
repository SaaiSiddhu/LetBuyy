# Phase S Discovery — Live Preview Inspector: Existing Surface and Gaps

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** S — Live Preview Inspector
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase S's discovery catalogued every component, file, message constant, and CSS class that the postMessage bridge already had entering Phase S. The goal was to determine exactly what existed from prior phases and what was missing, without duplicating or breaking the no-echo self-loop guard established in the Phase C Liquid transformation program.

The bridge spans two separate applications on different origins. Changes to either side must be considered together, and neither side may introduce cross-origin wildcard sends (`'*'`) or fail-open receive guards.

---

## 2. Existing Bridge Surface (Entering Phase S)

### 2.1 Shared Protocol Module

`packages/theme-engine/src/editor-bridge-protocol.ts`

Seven constants defined and exported, all used by both sides of the bridge:

| Constant | String value | Direction |
|---|---|---|
| `EDITOR_LEGACY_SELECTION_MESSAGE` | `'LETBUYY_THEME_EDITOR_SELECTION'` | editor → preview |
| `EDITOR_SELECTION_MESSAGE` | `'letbuyy:theme-editor:section-selected'` | editor → preview (modern) |
| `EDITOR_SECTION_SELECT_MESSAGE` | `'letbuyy:theme-editor:section-select'` | preview → editor |
| `EDITOR_READY_MESSAGE` | `'letbuyy:storefront-preview:ready'` | preview → editor |
| `EDITOR_SCROLL_MESSAGE` | `'letbuyy:theme-editor:section-scroll'` | editor → preview |
| `EDITOR_VIEWPORT_MESSAGE` | `'letbuyy:theme-editor:viewport'` | editor → preview |
| `EDITOR_LEGACY_VIEWPORT_MESSAGE` | `'LETBUYY_THEME_EDITOR_VIEWPORT'` | editor → preview |

### 2.2 CenterPanel (Editor Side — CLEAN File)

`apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`

**Outbound (editor → preview):** After `iframeLoadedRef.current === true`, posts `EDITOR_LEGACY_SELECTION_MESSAGE` and `EDITOR_SELECTION_MESSAGE` with `{ selectedSectionId }` to `targetOrigin = new URL(previewUrl).origin`. Guard: returns early when `!frame?.contentWindow || !previewOrigin || !iframeLoadedRef.current`.

**Inbound (preview → editor):** `window.addEventListener` for `EDITOR_SECTION_SELECT_MESSAGE`. Calls `onSelectSection(sectionId)`. **Pre-Phase-S gap:** no `event.origin` check — any window could post a fake section-select message and drive selection in the editor.

**Viewport changes:** Handled by remounting the iframe via `key={previewUrl}` rather than posting `EDITOR_VIEWPORT_MESSAGE`. This means there is no separate viewport message send from the editor; device changes cause a full iframe reload.

**Hover tracking:** No `hoveredSection` state. No handler for hover messages. No `PreviewInspectorOverlay` rendered.

**Add-section intent:** No `onAddSectionIntent` prop. No handler for add-section messages.

### 2.3 StorefrontPreviewBridge (Preview Side — CLEAN File)

`apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`

**Inbound handler:** listens for `EDITOR_LEGACY_SELECTION_MESSAGE`, `EDITOR_SCROLL_MESSAGE`, `EDITOR_VIEWPORT_MESSAGE`, `EDITOR_LEGACY_VIEWPORT_MESSAGE`. The no-echo guard explicitly excludes `EDITOR_SELECTION_MESSAGE` from the translation branch (`if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE)`), preventing the same-window SELECTED_MESSAGE from re-entering the handler in an infinite loop.

**`selectSection(sectionId, shouldScroll)`:** Re-posts `EDITOR_SELECTION_MESSAGE` same-window to `window.location.origin`. Optionally calls `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

**Outbound READY:** Posts `EDITOR_READY_MESSAGE` with `{ viewport, sectionIds }` to `getParentTargetOrigin()` on mount. `getParentTargetOrigin()` returns `new URL(document.referrer).origin` or `'*'` when referrer is absent.

**Pre-Phase-S gaps:**

1. **Fail-open receive guard:** `if (editorOrigin && event.origin !== editorOrigin) return` — when `getEditorOrigin()` returns empty string (env var absent + no referrer), the entire guard is skipped. All messages from any origin pass through.
2. **READY_MESSAGE broadcasts to `'*'`:** when `NEXT_PUBLIC_ADMIN_URL` is absent, `getParentTargetOrigin() || '*'` sends `sectionIds` (theme layout metadata) to any embedder.
3. **No `INSPECTOR_SECTION_SCROLLED_TO` dispatch:** after `scrollIntoView`, no same-window message is sent to trigger a flash animation in `EditorPreviewSectionFrame`.
4. **Double-scroll jank:** `CenterPanel.postSelectionToPreview` posted `EDITOR_LEGACY_SELECTION_MESSAGE` and `EDITOR_SCROLL_MESSAGE` in two consecutive calls. The bridge translation branch matched both (`type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE`) with `shouldScroll = true` for both. Two competing `scrollIntoView` smooth-scroll calls fired per user selection action.

### 2.4 EditorPreviewSectionFrame (Preview Side — CLEAN File)

`apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx`

Wraps each rendered section when `editorMode=true`. Outbound: click + Enter/Space → `window.parent.postMessage({ type: EDITOR_SECTION_SELECT_MESSAGE, sectionId, sectionType, rendererKey }, getParentTargetOrigin())`. Inbound: listens for `EDITOR_SELECTION_MESSAGE` → sets `isSelected` state, adds `storefront-editor-section-frame--selected` CSS class. Emits `data-letbuyy-editor-section-id` + `data-section-id` attributes.

**Pre-Phase-S gaps:**

1. **No `event.origin` check:** `handleMessage` accepted `EDITOR_SELECTION_MESSAGE` from any origin. An attacker embedding the preview could send fake `EDITOR_SELECTION_MESSAGE` messages to manipulate section selection state.
2. **`getParentTargetOrigin()` wildcard fallback:** used `document.referrer || '*'`. When referrer is suppressed, all outbound messages from preview to editor used `'*'`.
3. **No hover tracking:** no `mouseenter`/`mouseleave` handlers, no `INSPECTOR_SECTION_HOVERED` / `INSPECTOR_HOVER_CLEARED` sends, no hover CSS class.
4. **No flash on scroll:** `selectSection` in the bridge called `scrollIntoView` but dispatched only the persistent `EDITOR_SELECTION_MESSAGE`; no transient flash class or animation triggered.
5. **No insert-button affordances:** no `+`-before/after buttons rendered between or around sections, no `INSPECTOR_ADD_SECTION_INTENT` sends.

---

## 3. Origin Model (Verified)

**Editor origin (merchant-control-plane):**
- Dev: `http://localhost:9001` — from `apps/merchant-control-plane/package.json` dev script (`next dev --webpack -p 9001`).
- Prod: `https://admin.letbuyy.com` — env var `NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.com`.

**Preview iframe origin (storefront-runtime):**
- Dev: `http://localhost:9000` — from `apps/storefront-runtime/package.json` dev script (`next dev --webpack -p 9000`).
- Prod: `https://store.letbuyy.com` (per-store subdomains; preview route uses `NEXT_PUBLIC_STOREFRONT_URL`).

**Cross-origin relationship:** The editor and preview are on different origins in both dev and prod. This is a genuine cross-origin iframe requiring explicit `targetOrigin` on every `postMessage` send and `event.origin` validation on every receive.

**CSP `frame-ancestors`:** `apps/storefront-runtime/next.config.ts` sets `frame-ancestors` from `NEXT_PUBLIC_ADMIN_URL + ADMIN_ORIGIN + STOREFRONT_FRAME_ANCESTORS` (dev: `http://localhost:9001`). This limits which origins can embed the preview iframe but does not gate postMessage sends from the embedded frame — those require explicit origin validation in the JavaScript handlers.

**Token scoping:** The preview token (minted server-side by `POST /api/themes/:themeId/preview-session`) scopes the storefront render to the draft theme config. It does NOT gate postMessage origins. PostMessage security is a separate layer enforced at the JavaScript level.

**Authoritative env var for preview → editor messages:** `NEXT_PUBLIC_ADMIN_URL` (baked into the storefront-runtime build). In dev: `http://localhost:9001`. In prod: `https://admin.letbuyy.com`. Both `StorefrontPreviewBridge` and `EditorPreviewSectionFrame` should read this var via `getEditorOrigin()` for all outbound sends to the editor window.

---

## 4. What Was Missing Entering Phase S

### 4.1 Protocol Extensions (4 new constants)

No `INSPECTOR_*` constants existed. The protocol module had 7 constants covering selection, scroll, ready, and viewport — nothing for hover signalling, flash, or add-section intent.

### 4.2 Hover Inspector

No path existed for the preview to communicate hover events to the editor. The editor had no overlay chip to display which section was being hovered. Result: the editor panel was visually decoupled from pointer position in the preview iframe.

### 4.3 Flash-on-Scroll

The bridge's `selectSection()` scrolled into view but fired only the persistent `EDITOR_SELECTION_MESSAGE` (selected-outline state). No transient signal was dispatched to trigger a CSS animation. Result: when the editor scrolled the preview to an off-screen section, there was no visual cue that the scroll had landed — the section simply appeared at center with a static outline.

### 4.4 Section-Boundary Insert Affordances

No insert buttons existed around sections in the preview. Merchants had no way to trigger an add-section intent from within the preview iframe; they had to use the section tree panel in the editor sidebar. This is a UX regression vs Shopify's editor (which shows `+` markers between sections on hover).

### 4.5 Origin Hardening

Three receive handlers accepted messages from any origin (fail-open or entirely unguarded):
- `CenterPanel.handleMessage` — no `event.origin` check at all.
- `StorefrontPreviewBridge.handleMessage` — fail-open: guard skipped when `NEXT_PUBLIC_ADMIN_URL` absent.
- `EditorPreviewSectionFrame.handleMessage` — no `event.origin` check at all.

Two outbound senders fell back to `'*'`:
- `StorefrontPreviewBridge` READY_MESSAGE send: `getParentTargetOrigin() || '*'`.
- `EditorPreviewSectionFrame` all sends: `document.referrer || '*'`.

### 4.6 Double-Scroll Jank

CenterPanel posted both `EDITOR_LEGACY_SELECTION_MESSAGE` and `EDITOR_SCROLL_MESSAGE` per selection action. The bridge matched both with `shouldScroll = true`. Two competing smooth-scroll calls interrupted each other on off-screen sections.

### 4.7 INSPECTOR_ADD_SECTION_INTENT Handler Missing from Editor

Even after Phase S added the insert buttons and the `INSPECTOR_ADD_SECTION_INTENT` constant, no `case` existed for it in `CenterPanel.handleMessage`. Messages arrived and hit the `default: break` path silently. The full affordance was non-functional until the hardening pass.

---

## 5. Pre-Existing Baselines Entering Phase S

| Suite | Count |
|---|---|
| theme-engine | 1048/1048 |
| merchant-control-plane | 65/65 (26 Phase R + 25 Phase Q + 14 pre-existing) |
| storefront-runtime | 762/762 |
| api-gateway | 479 (438 Phase P + 41 Phase Q) |
| All typechecks | Clean |

No gateway changes, database migrations, or new npm dependencies were planned for Phase S. The phase is a pure UI and protocol extension.
