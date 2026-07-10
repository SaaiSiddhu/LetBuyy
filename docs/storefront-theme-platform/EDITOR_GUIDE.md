# LetBuyy Theme Editor — Shell Architecture Guide

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-10 (post Phase R)
**Covers:** editor header, section/block tree, live preview, settings panel, undo/redo, autosave, draft CAS

---

## 1. Overview

The visual editor shell is a single Next.js `'use client'` page at:

```
apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
```

It is a **FOREIGN WIP FILE** — it carries prior user modifications. All phase-level changes to this file are applied as minimal, isolatable hunks. The file is 1810 lines (post Phase R).

Supporting components live under:
```
apps/merchant-control-plane/src/components/theme-editor/
  CenterPanel.tsx         — preview iframe and postMessage bridge (CLEAN)
  ConflictDialog.tsx      — draft CAS conflict resolution dialog (Phase R, CLEAN)
  ExperiencePicker.tsx    — experience list and apply UI (CLEAN)
  SchemaFormRenderer.tsx  — generic settings form renderer (CLEAN)
  SectionTreePanel.tsx    — ARIA section tree with drag-to-reorder (Phase R, CLEAN)
```

All CSS is in `apps/merchant-control-plane/src/app/globals.css` (FOREIGN WIP FILE). The editor uses the `theme-os-*` token system throughout — no raw px or hex values.

---

## 2. Layout

The editor shell has a three-column layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ Header / Topbar (.theme-os-topbar)                              │
│ [←] [Sections|Settings|Exp|Versions]  [Theme pill][Template]   │
│                          [Undo][Redo] [Save] [Publish]          │
├──────────────────┬──────────────────────┬───────────────────────┤
│ Left sidebar     │   Center panel       │  Right properties     │
│ .theme-os-       │   .theme-os-preview- │  .theme-os-properties │
│  sidebar         │    panel             │                       │
│ (panel tabs)     │  (device selector    │  (AI hooks + settings │
│                  │   + iframe)          │   SchemaFormRenderer) │
│                  │                      │                       │
└──────────────────┴──────────────────────┴───────────────────────┘
```

The left sidebar switches between four panel modes (`PanelMode` type): `'sections'` | `'settings'` | `'experiences'` | `'versions'`.

---

## 3. Editor Header

### 3.1 Left Zone

Icon buttons keyed on `panelMode` state. Active state via `theme-os-icon-btn--active`.

| Icon | `panelMode` | aria-label |
|---|---|---|
| `Layers3` | `'sections'` | Sections |
| `Settings` | `'settings'` | Theme settings |
| `Sparkles` | `'experiences'` | Experiences |
| `FileJson` | `'versions'` | Versions |

### 3.2 Center Zone

- **Theme-name pill**: `Blocks` icon + `themeName` state + `@letbuyy/ui Badge` (`'Draft'` / `'Saved'` variant driven by `isDirty`).
- **Template selector**: native `<select>` driven by `templateOptions` array; calls `handleTemplateChange` on change; disabled during `isSaving || isPublishing`.

### 3.3 Right Zone

- **Undo / Redo**: `Undo2` / `Redo2` buttons; disabled via `canUndo` / `canRedo`; keyboard: `Cmd+Z` / `Cmd+Shift+Z` / `Cmd+Y`.
- **Save**: disabled when `isSaving || isPublishing || !isDirty`; shows `Loader2` spinner during save.
- **Publish**: disabled when `isSaving || isPublishing || isDirty` (draft must be saved clean before publishing); shows `Loader2` spinner during publish.

---

## 4. Left Sidebar — Panel Modes

### 4.1 Sections Panel (`SectionTreePanel`)

Source: `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`

Renders three groups:
- **Header** (pinned, not draggable): single `SectionEntry` row for `state.sections.header`.
- **Template** (ARIA tree widget, draggable): list of `SectionEntry` rows for `state.sections.template`.
- **Footer** (pinned, not draggable): single `SectionEntry` row for `state.sections.footer`.

Below the footer group: a section-type selector (`Select`) and "Add" button.

**ARIA tree widget pattern** (WAI-ARIA authoring practices):
- `role="tree"` on the template list container with `aria-label="Template sections"`.
- `role="treeitem"` + `aria-selected` + roving `tabIndex` on each section row.
- Active item (selected section or parent section of selected block): `tabIndex=0`. All others: `tabIndex=-1`.
- Action buttons inside each treeitem: `tabIndex={-1}` (not in the Tab sequence; roving tabindex is on the outer div only).

**Keyboard navigation**: `ArrowDown` / `ArrowUp` on any focused treeitem moves focus to the next/previous treeitem. Event delegation on the `role="tree"` container — no per-row handler needed.

**HTML5 drag-to-reorder**: template section rows are `draggable={true}`. `handleDrop` computes the full step distance (`Math.abs(toIndex - dragIndex)`) and loops `onMoveSection(section.id, direction)`. Drag-over visual: `.theme-os-tree-section--drag-over` CSS class (token-only). Dragging row: `opacity: 0.45` inline.

**Block selection state**: when `selection.kind === 'block'`, the parent section row is the "active parent" — it receives `aria-selected=true` and `tabIndex=0` but does NOT get the visual selection highlight (`selected` prop stays `false`). This lets screen readers announce the structural context while the visual highlight correctly shows the parent as active-but-not-selected.

**Block sub-rows**: rendered as `Button unstyled` elements inside the section row when `section.blocks.length > 0`.

### 4.2 Settings Panel (`ThemeSettingsTree`)

Inline function in `page.tsx`. Renders a nav list of theme-settings groups from `settingsSchema.settings`. Each group is a `Button unstyled` with active class. Uses `TreeGroup` (imported from `SectionTreePanel`).

### 4.3 Experiences Panel (`ExperiencePicker`)

Source: `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx`

Calls `listExperiences()` from `@letbuyy/theme-engine`. Renders the 10 merchant experiences as swatches. Apply button with `aria-pressed` on the active experience.

### 4.4 Versions Panel (`VersionTree`)

Inline function in `page.tsx`. Renders a draft card (version + saved-at) and a published-releases list. Each release row shows version, date, and a rollback button. Uses `TreeGroup` (imported from `SectionTreePanel`).

---

## 5. Center Panel (`CenterPanel`)

Source: `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`

### 5.1 Preview Iframe

URL: `{storefrontBaseUrl}/preview?subdomain={store}&editor=1&viewport={device}&theme_preview_token={token}`

Keyed on `previewUrl` — a new iframe is mounted only when the URL changes. Device CSS classes: `te-preview-frame--desktop` / `te-preview-frame--tablet` / `te-preview-frame--mobile`.

### 5.2 PostMessage Bridge

**Outbound** (editor → storefront): after `iframeLoadedRef.current === true`, both `EDITOR_LEGACY_SELECTION_MESSAGE` (`'LETBUYY_THEME_EDITOR_SELECTION'`) and `EDITOR_SELECTION_MESSAGE` (`'letbuyy:theme-editor:section-selected'`) are posted with `{ selectedSectionId }`. The `iframeLoadedRef` guard prevents posting to an unloaded frame.

**Inbound** (storefront → editor): `EDITOR_SECTION_SELECT_MESSAGE` (`'letbuyy:theme-editor:section-select'`) from the storefront drives `onSelectSection` in the editor.

Constants: `@letbuyy/theme-engine/editor-bridge-protocol` (`editor-bridge-protocol.ts`).

### 5.3 Device Switcher

Three buttons (`Monitor`, `Tablet`, `Smartphone`) in a `role="group" aria-label="Preview device"` container. Each button has `aria-pressed`. CSS: `.theme-os-device-toggle__btn--active` on the active button.

### 5.4 States

- **Syncing overlay**: shown when `isPreviewRefreshing` — spinner with "Syncing" label overlaid on the iframe.
- **Preview error overlay**: shown when `previewError` — error message with "Try again" button wired to `syncPreviewDraft()`.

---

## 6. Right Panel (`PropertyPanel`)

Inline function in `page.tsx` (lines 1658–1793). Rendered in `<aside.theme-os-properties aria-label="Theme properties">`.

### 6.1 AI Hooks Card (STUB)

Three buttons: Copy / Layout / Block. All call `applyAiHook(mode)` which applies hardcoded string/value changes to the selected section's settings. **This is a stub** — no AI service is called. See RISK-SEC-002. Phase AC must wire the real AI pipeline.

### 6.2 Settings Form

Rendered via `SchemaFormRenderer` from `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`.

Three view modes keyed on `selection.kind`:
- `'theme'`: renders the selected `ThemeSettingsGroup.fields` from `settingsSchema`.
- `'section'`: renders `selectedSectionSchema.settings_schema` fields; block sub-list (click to enter block mode); add-block control.
- `'block'`: renders `selectedBlockSchema.fields` fields; back-to-section button (`X` icon).

`SchemaFormRenderer` supports field types: `text`, `textarea`, `richtext`, `radio`, `color`, `image` (uploads to `/api/stores/[store]/upload`), `select`, `toggle`, `range`, `url`, `number`.

---

## 7. Undo / Redo

**State:** `EditorHistory` = `{ past: EditorState[], future: EditorState[] }`. Max depth: 50 (`past.slice(-49)` in `applyChange`).

**`undo()`:**
1. Pops `current.past[-1]` → `previous`.
2. `setEditorState(previous)`.
3. `setIsDirty(previous !== savedState)` — reference equality. If `previous` IS `savedState`, the SaveBar shows "Saved" (Phase R hardening; pre-Phase-R always set `true`).
4. Pushes `editorState` onto `future`.

**`redo()`:**
1. Pops `current.future[0]` → `next`.
2. `setEditorState(next)`.
3. `setIsDirty(true)` (always dirty after redo — redo reinstates an unsaved edit).
4. Pushes `editorState` onto `past`.

**Keyboard:** `Cmd+Z` → `undo()`, `Cmd+Shift+Z` / `Cmd+Y` → `redo()`, `Cmd+S` → `handleSave()`. Bound via `window.addEventListener('keydown', ...)` in `useEffect`.

**History cleared on save:** `saveDraft()` sets `setHistory({ past: [], future: [] })` on success, making undo unavailable after a save.

---

## 8. Autosave and Draft CAS

### 8.1 Autosave Trigger

`useEffect` on `[isDirty, isLoading, loadError, store, syncPreviewDraft, themeId]`:
- When `isDirty`: schedules `syncPreviewDraft()` after **900 ms**.
- When first loaded (not dirty): runs `syncPreviewDraft()` immediately (0 ms).
- Effect cleanup cancels the pending timeout on every re-render.

### 8.2 `syncPreviewDraft`

1. POST `/api/themes/[themeId]/editor/draft?store_name=&template=` with:
   ```json
   { "draftConfig": ..., "templateKey": "...", "baseVersion": <draftVersion | undefined> }
   ```
2. **409 guard:** if `res.status === 409` → sets `hasConflict=true`, `conflictSource='autosave'`, returns early (autosave is paused until the merchant resolves the conflict).
3. On success: extracts `version` and `savedAt` from the draft response; updates `draftVersion`, `savedAt`.
4. POST `/api/themes/[themeId]/preview-session` to obtain a fresh `preview_token`.
5. Updates `previewToken` in state → `CenterPanel` re-renders the iframe URL.
6. `previewRequestCounter` ref guards against stale responses from concurrent requests.

### 8.3 `saveDraft` (Manual Save and Force-Save)

```typescript
saveDraft(force = false)
```

Same POST as `syncPreviewDraft` but:
- When `force=true` (force-save from ConflictDialog): sends `baseVersion: undefined` to bypass the CAS check.
- **409 guard:** if `res.status === 409` → sets `hasConflict=true`, `conflictSource='manual-save'`, throws `ConflictError`.
- `handleSave` suppresses the toast for `ConflictError` (let the ConflictDialog handle it).
- On success: sets `setSavedState(editorState)`, clears history, sets `isDirty=false`.

### 8.4 Draft Proxy Route

`apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts`

- **POST**: Calls `createMerchantApiClient().themes.saveDraft()` → api-client PUT `/themes/:slug/editor/draft` → gateway. Returns `{ success, savedAt, version, templateKey }`.
- **DELETE**: Calls `api-client.themes.deleteDraft()` for discarding drafts.
- HTTP 409 from the gateway propagates through `LetbuyyApiError` → `merchantApiErrorResponse` → `NextResponse 409` to the browser.

### 8.5 `baseConfig` and RISK-DUAL-N01

`baseConfig` holds the draft configuration as returned by the editor API at load time. `buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` merges the mutable `editorState` (sections, settings, selected template) over `baseConfig`. The immutable `section_definitions` and `block_definitions` (Liquid source) always come from `baseConfig`, never from `editorState`. This mechanically enforces RISK-DUAL-N01.

---

## 9. ConflictDialog (Phase R)

Source: `apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx`

Shown when `hasConflict === true`. Two props drive behavior:

| Prop | Action |
|---|---|
| `onReload` | Reload from server — calls `setHasConflict(false)` then `loadEditor()`. Local changes are discarded. This is the **safe** path. |
| `onForce` | Keep my changes — calls `setHasConflict(false)` then `saveDraft(true)` (force-save, bypasses `base_version`). Force-save failures surface a critical toast. |

**Light-dismiss contract:** Escape key and outside-click trigger `onClose` → `onReload` (the safe default). Force-save only fires on explicit "Keep my changes" button click (`onConfirm` → `onForce`). This mapping (`onConfirm={onForce}`, `onClose={onReload}`) is intentional and matches the `@letbuyy/ui ConfirmDialog` / Modal `useDismiss` behavior.

**`conflictSource`:** `'autosave'` (background 409) vs `'manual-save'` (explicit Save click 409) — drives different description text.

---

## 10. CSS Token System

All editor CSS uses the `theme-os-*` naming convention in `apps/merchant-control-plane/src/app/globals.css`.

### Key Classes

| Class | Purpose |
|---|---|
| `.theme-os` | Root layout container |
| `.theme-os--centered` | Loading / error full-screen center |
| `.theme-os-topbar` | Editor header bar |
| `.theme-os-topbar__left/center/right` | Topbar zones |
| `.theme-os-theme-pill` | Theme name + badge pill |
| `.theme-os-page-pill` | Template selector pill |
| `.theme-os-icon-btn` | Icon-only button; `.--active` for active state |
| `.theme-os-btn` | Text button (Save/Publish); `.--primary` for primary |
| `.theme-os-workspace` | Three-column layout container |
| `.theme-os-sidebar` | Left panel |
| `.theme-os-sidebar__header` | Sidebar schema-source + version badge header |
| `.theme-os-preview-panel` | Center panel |
| `.theme-os-preview-panel__header` | Preview header with device toggle |
| `.theme-os-preview-panel__canvas` | Iframe container |
| `.theme-os-properties` | Right properties aside |
| `.theme-os-properties__header` | Properties title + back button |
| `.theme-os-properties__body` | Properties form body |
| `.theme-os-tree` | Generic tree container |
| `.theme-os-tree__group` | Group header section |
| `.theme-os-tree__label` | Group label text |
| `.theme-os-tree__add` | Add-section control row |
| `.theme-os-tree-section` | Section row (`role="treeitem"`) |
| `.theme-os-tree-section--selected` | Active selection highlight |
| `.theme-os-tree-section--hidden` | Visibility toggled off |
| `.theme-os-tree-section--dragging` | Being dragged (`opacity: 0.45`) |
| `.theme-os-tree-section--drag-over` | Drop target indicator (token-only outline) |
| `.theme-os-tree-section__row` | Main row button |
| `.theme-os-tree-section__handle` | Grip / panel icon |
| `.theme-os-tree-section__actions` | Row action buttons |
| `.theme-os-tree-blocks` | Block sub-list |
| `.theme-os-tree-block` | Individual block row; `.--selected`; `.--hidden` |
| `.theme-os-tree-block__line` | Block connector line |
| `.theme-os-ai-card` | AI hooks card |
| `.theme-os-property-card` | Settings form card |
| `.theme-os-settings-link` | Theme-settings group nav link |
| `.theme-os-settings-link--active` | Active settings group |
| `.theme-os-version-card` | Draft version card |
| `.theme-os-release-row` | Published release row |
| `.theme-os-device-toggle` | Device switcher group |
| `.theme-os-device-toggle__btn` | Individual device button; `.--active` |
| `.theme-os-spin` | CSS `@keyframes spin` animation |
| `.theme-os-rotate-up` / `.theme-os-rotate-down` | ChevronRight rotation for move-up/move-down arrows |
| `.theme-os-state` | Loading/error state container |
| `.theme-os-muted` | Muted/empty state text |

CenterPanel and SchemaFormRenderer use `te-*` classes (also in `globals.css`).

---

## 11. Editor State Model

```typescript
type EditorState = {
    themeSettings: JsonRecord           // flat key→value map for all theme settings
    sections: {
        header: SectionEntry | null     // pinned, always present in a valid theme
        footer: SectionEntry | null     // pinned, always present in a valid theme
        template: SectionEntry[]        // ordered list; drag/move-up/move-down mutate this
    }
}

type SectionEntry = {
    id: string           // stable UUID across edits
    type: string         // e.g. 'hero-section', 'product-grid'
    order: number        // rendered order (matches array index post-sort)
    visible: boolean     // visibility toggle
    settings: JsonRecord // section-level settings
    blocks: BlockEntry[] // ordered blocks within this section
}

type BlockEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: JsonRecord
}

type EditorSelection =
    | { kind: 'section'; sectionId: string }
    | { kind: 'block'; sectionId: string; blockId: string }
    | { kind: 'theme'; groupKey: string }
```

`applyChange(updater)` is the only mutation entry point. It: (1) derives the next state from the updater, (2) pushes the current state onto `history.past`, (3) sets `isDirty=true`, (4) sets the next state.

---

## 12. Key Risks Affecting This Module

| Risk ID | Severity | Description | Target |
|---|---|---|---|
| RISK-DUAL-N01 | MEDIUM | Editor save must reconstruct `section_definitions`/`block_definitions` from `baseConfig`, not `editorState` | Enforced mechanically by `buildDraftConfig`; must be preserved in Phase S+ |
| RISK-SEC-P01 | MEDIUM | `theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id` | No client-side realtime subscription may be added until fixed |
| RISK-PERF-N01 | LOW | Large document serialization on each draft save | `buildDraftConfig` sends only mutable state; Liquid source comes from `baseConfig` not re-serialized |
| RISK-SEC-002 | INFO | AI hooks are stubs; must not be presented as connected | Phase AC |
