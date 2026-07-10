# Phase R Discovery — Visual Editor Shell: Existing Surface and Gaps

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** R — Visual Editor Shell
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase R's discovery catalogued every component, hook, state machine, CSS class, proxy route, and gateway endpoint that the visual editor shell already had entering Phase R. The goal was to determine exactly what existed from prior phases, what was missing, and what Phase R needed to add without duplicating or breaking prior work.

The editor shell lives in a single large page that is a FOREIGN WIP FILE — it carries prior user work that must never be staged. Phase R applies four disjoint, isolatable hunks to that file and extracts component logic into clean, separate files.

---

## 2. Existing Editor Shell (Entering Phase R)

The following pieces existed in `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (1810 lines after Phase R) or in clean component files under `apps/merchant-control-plane/src/components/theme-editor/`, and were **reused without modification** by Phase R (except where noted in Section 3).

### 2.1 Editor Header / Topbar

`page.tsx` lines 1344–1420 (post-Phase-R line numbers).

- Theme-name pill: `Blocks` icon + `themeName` + `Badge` (`'Draft'` / `'Saved'` variant keyed on `isDirty`).
- Template selector: `<select>` keyed on `selectedTemplateKey`; each `<option>` from `templateOptions`; calls `handleTemplateChange` on change; disabled during saving/publishing.
- Panel-mode tabs (icon buttons): Sections (`Layers3`), Settings (`Settings`), Experiences (`Sparkles`), Versions (`FileJson`) — each sets `panelMode` state and shows an active class via `theme-os-icon-btn--active`.
- Undo/Redo icon buttons: `Undo2` / `Redo2`; disabled via `canUndo` / `canRedo`.
- Save button: disabled when `isSaving || isPublishing || !isDirty`; shows `Loader2` spinner while saving.
- Publish button: disabled when `isSaving || isPublishing || isDirty`; shows `Loader2` spinner while publishing.

### 2.2 Inline SectionTree / TreeGroup / TreeSection

Prior to Phase R, `SectionTree`, `TreeGroup`, and `TreeSection` were three inline function declarations in `page.tsx`. They rendered:
- **Header group** (pinned, not reorderable): single `SectionEntry` row for `state.sections.header`.
- **Template group** (moveable): list of `SectionEntry` rows for `state.sections.template`, each with a `GripVertical` handle, visibility toggle, move-up/down buttons, and remove button. Blocks were listed as sub-rows.
- **Footer group** (pinned): single `SectionEntry` row for `state.sections.footer`.
- **Add-section control**: `Select` + `Button` (Add) for `addSectionType`.

**Gaps entering Phase R:** `GripVertical` was rendered but not wired to any drag handler. No `role="tree"` / `role="treeitem"` / `aria-selected` ARIA widget pattern. No keyboard tree navigation (arrow keys). No HTML5 drag-and-drop handlers.

### 2.3 ThemeSettingsTree

`page.tsx` lines 1591–1617 (post-Phase-R). Renders a nav list of theme-settings groups from the schema. Each group is a `Button unstyled` with an active class. Uses imported `TreeGroup` (from SectionTreePanel after Phase R extraction).

### 2.4 VersionTree

`page.tsx` lines 1619–1657 (post-Phase-R). Renders a draft card (version label, saved-at timestamp) and a published-releases list. Each release row shows version number, published-at date, and a rollback button (wired to the existing `handleRollback` function). Uses imported `TreeGroup`.

### 2.5 PropertyPanel

`page.tsx` lines 1658–1793 (inline function). The right-hand settings sidebar, rendered in an `aside.theme-os-properties`. Contains:
- A title derived from the current selection kind (`theme` / `block` / `section`).
- An **AI hooks card** (stub — `applyAiHook()` sets hardcoded values; no fetch to any AI service; see RISK-SEC-002). Buttons: Copy / Layout / Block.
- `SchemaFormRenderer` for theme-settings, section-settings, and block-settings views.
- A back-to-section button (`X` icon) when in block-selection mode.
- A remove-block button (`Trash2`, triggers `setBlockPendingRemoval`).

### 2.6 Undo / Redo

Full `EditorHistory` stack (`{ past: EditorState[], future: EditorState[] }`). Max history depth = 50 (`existing.past.slice(-49)`). State: `canUndo = history.past.length > 0`, `canRedo = history.future.length > 0`. Keyboard: `Cmd+Z` → undo, `Cmd+Shift+Z` / `Cmd+Y` → redo. Buttons in topbar also fire `undo()` / `redo()`.

**Phase R hardening to undo:** after Phase R, `undo()` calls `setIsDirty(previous !== savedState)` rather than the pre-existing `setIsDirty(true)`. This prevents the SaveBar from showing "unsaved" after an undo returns the editor to the last saved snapshot.

### 2.7 Autosave (900 ms debounce)

`useEffect` on `[isDirty, isLoading, loadError, store, syncPreviewDraft, themeId]`. On `isDirty` change: schedules `syncPreviewDraft()` after 900 ms; on first load (not dirty): runs immediately (0 ms timeout). `syncPreviewDraft` POSTs to `/api/themes/[themeId]/editor/draft?store_name=&template=` with `{ draftConfig, templateKey, baseVersion }`, then POSTs to `/api/themes/[themeId]/preview-session` for a fresh preview token. The `previewRequestCounter` ref guards against stale async race conditions.

**Gap entering Phase R:** `syncPreviewDraft` and `saveDraft` did not distinguish HTTP 409 (conflict) from other errors — both fell through to `setPreviewError` or a generic toast. Phase R adds specific 409 detection in both paths.

### 2.8 SaveBar

`@letbuyy/ui SaveBar` component wired to `isDirty` / `isSaving` states. Discard handler reverts `editorState` to `savedState` and resets `isDirty`.

### 2.9 ConfirmDialogs

Two existing `@letbuyy/ui ConfirmDialog` instances in the JSX:
- **Section removal:** `open={Boolean(sectionPendingRemoval)}`, destructive, confirms `removeSection()`.
- **Block removal:** `open={Boolean(blockPendingRemoval)}`, destructive, confirms `removeBlock()`.

### 2.10 EditorLoading and Load-Error State

`EditorLoading` function (lines 1801–1810): centered `Loader2` spinner with `role="status"`. Load-error state (lines 1327–1340): `role="alert"`, `FileJson` icon, error message, Retry button wired to `void loadEditor()`.

### 2.11 Keyboard Shortcuts

`window.addEventListener('keydown', ...)` in a `useEffect`. Fires: `Cmd+S` → `handleSave()`, `Cmd+Z` → `undo()`, `Cmd+Shift+Z` / `Cmd+Y` → `redo()`. Modifier check uses `event.metaKey || event.ctrlKey`.

### 2.12 Device Switcher

`PREVIEW_DEVICES` array (`[{ value: 'desktop', label: 'Desktop', icon: Monitor, width: 1280 }, ...]`). Rendered as a `role="group"` button row in the center panel header. Each button has `aria-pressed={previewDevice === device.value}`. CSS class `theme-os-device-toggle__btn--active` on the active button.

### 2.13 CenterPanel (CLEAN file)

`apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`. Preview iframe keyed on `previewUrl` (built from storefront base URL + subdomain + `editor=1` + `viewport` + `theme_preview_token`). Outbound `postMessage`: `EDITOR_LEGACY_SELECTION_MESSAGE` + `EDITOR_SELECTION_MESSAGE` (both from `@letbuyy/theme-engine/editor-bridge-protocol`) post `selectedSectionId` to the iframe after the `load` event fires (`iframeLoadedRef` guard). Inbound: listens for `EDITOR_SECTION_SELECT_MESSAGE` to drive selection from the storefront side. Device CSS classes: `te-preview-frame--desktop/tablet/mobile`.

### 2.14 ExperiencePicker (CLEAN file)

`apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx`. Calls `listExperiences()` from `@letbuyy/theme-engine` to get the 10 experiences. Renders experience swatches, apply button with `aria-pressed`, active-experience highlight.

### 2.15 SchemaFormRenderer (CLEAN file)

`apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`. Renders all field types from a `Record<string, SchemaField>` schema:
- `text`, `textarea`, `richtext`, `radio`, `color`, `image` (with upload to `/api/stores/[store]/upload`), `select`, `toggle`, `range`, `url`, `number`.

### 2.16 CSS Token System (globals.css — FOREIGN WIP FILE)

All required CSS classes for the editor shell were already defined in `apps/merchant-control-plane/src/app/globals.css` entering Phase R. The full `theme-os-*` token system covers: topbar, sidebar, workspace, properties, tree, tree-section, tree-block, version-card, release-row, ai-card, property-card, block-tools, danger-btn, spin, rotate-up/down, device-toggle. The `te-*` classes cover CenterPanel and SchemaFormRenderer.

**Phase R addition to globals.css (HUNK):** `.theme-os-tree-section--drag-over` — drag-target outline indicator using `var(--lb-color-brand-default)` with no hex fallback. Added after the existing `.theme-os-tree-section--hidden` block at line 12582.

---

## 3. Missing Pieces Entering Phase R

### 3.1 ConflictDialog

**Gap:** When `syncPreviewDraft` or `saveDraft` received HTTP 409 from the draft CAS route, the existing code either set `previewError` text in the center panel or surfaced a generic critical toast, with no detection of the specific HTTP 409 status or `CONFLICT` error code. There was no `hasConflict` state, no pause-autosave mechanism, and no merchant-facing choice between "Reload from server" and "Keep my changes."

**Required:** A new component `apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx` wrapping `@letbuyy/ui ConfirmDialog`. Minimal edits to `page.tsx`: add `hasConflict` + `conflictSource` state; detect 409 in both `saveDraft` and `syncPreviewDraft`; render `<ConflictDialog>` with `onReload` and `onForce` handlers.

### 3.2 SectionTreePanel with ARIA Tree Pattern and Keyboard Drag

**Gap:** The inline `SectionTree` rendered `GripVertical` icons but wired no drag handlers. Move-up/move-down buttons implemented keyboard reorder. No `role="tree"` / `role="treeitem"` / `aria-selected` on any node. No arrow-key tree navigation. No HTML5 drag-and-drop.

**Required:** Extract the three inline functions (`SectionTree`, `TreeGroup`, `TreeSection`) to a new clean file `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`. Additions: `role="tree"` on the template list container, `role="treeitem"` + `aria-selected` + roving `tabIndex` on each section row, `ArrowUp` / `ArrowDown` keyboard navigation via event delegation on the tree container, `draggable` + `onDragStart` / `onDragOver` / `onDrop` / `onDragEnd` on template-section rows (pinned header/footer rows excluded). Re-export `TreeGroup` so the still-inline `ThemeSettingsTree` and `VersionTree` can use it.

### 3.3 Tests

**Gap:** No test file existed for Phase R editor shell contracts.

**Required:** `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` — 26 static contract tests using `node:test` + `node:assert/strict` + `readFileSync` source assertions. Registered in `package.json` test script alongside the existing Phase Q and pre-existing federation/localization/app-platform tests.

---

## 4. Draft / Autosave Wiring (Reused As-Is)

The following wiring was correct entering Phase R and required no structural change — only the 409-specific detection path was added:

- **Autosave trigger:** `useEffect` on `[isDirty, isLoading, loadError, store, syncPreviewDraft, themeId]`. 900 ms timeout when dirty; 0 ms on first load.
- **`syncPreviewDraft`:** POST `/api/themes/[themeId]/editor/draft?store_name=&template=` with `{ draftConfig, templateKey, baseVersion: draftVersion ?? undefined }`. On success: updates `previewToken`, `draftVersion`, `savedAt`. On failure: sets `previewError`. **Phase R adds:** 409 guard before the `!draftRes.ok` throw that sets `hasConflict` + `conflictSource('autosave')` and returns early.
- **`saveDraft`:** Same POST with optional `force` parameter. When `force=true`, sends `baseVersion: undefined` (bypasses CAS). **Phase R adds:** 409 guard that sets `hasConflict` + `conflictSource('manual-save')` and throws a `ConflictError` before the generic `!res.ok` throw. `handleSave` suppresses the toast for `ConflictError` (let the dialog handle it).
- **Draft proxy (`apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts`):** POST handler calls `createMerchantApiClient().themes.saveDraft()` → api-client PUT `/themes/:slug/editor/draft`. Returns `{ success, savedAt, version, templateKey }`. DELETE handler calls `api-client.themes.deleteDraft()`. The 409-CONFLICT from the gateway propagates through `LetbuyyApiError` → `merchantApiErrorResponse` → `NextResponse 409` to the browser, where Phase R now detects it.

---

## 5. Gateway Baseline Entering Phase R

| Test suite | Count entering Phase R |
|---|---|
| api-gateway (all passing, post-Phase-Q) | 438 (Phase P baseline) + 41 (Phase Q file-scoped, `theme-library-q.test.ts`) |
| theme-engine | 1034 |
| api-gateway typecheck | 32/32 turbo tasks clean |

Phase R introduces no gateway changes — the Phase P draft CAS route and Phase Q library routes are consumed as-is.
