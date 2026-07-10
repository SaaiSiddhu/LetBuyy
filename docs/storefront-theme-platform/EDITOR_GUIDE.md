# LetBuyy Theme Editor — Shell Architecture Guide

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Last updated:** 2026-07-11 (post Phase T)
**Covers:** editor header, section/block tree (incl. nested blocks), live preview inspector, settings panel, undo/redo, autosave, draft CAS

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
  BlockChildRow.tsx            — recursive child-block tree row (Phase T, CLEAN)
  CenterPanel.tsx              — preview iframe, postMessage bridge, and inspector overlay host (CLEAN)
  ConflictDialog.tsx           — draft CAS conflict resolution dialog (Phase R, CLEAN)
  ExperiencePicker.tsx         — experience list and apply UI (CLEAN)
  PreviewInspectorOverlay.tsx  — hover chip overlay for the live preview (Phase S, CLEAN)
  SchemaFormRenderer.tsx       — generic settings form renderer (CLEAN)
  SectionTreePanel.tsx         — ARIA section tree with drag-to-reorder (Phase R, CLEAN)
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

**Block sub-rows**: rendered via `BlockChildRow` (Phase T, see §4.5) inside the section row when `section.blocks.length > 0`. Flat blocks (no children) render byte-identically to Phase R.

**Child block callbacks (Phase T):** Three optional callbacks are available on `SectionTreePanelProps`:
- `onAddChildBlock(sectionId, parentBlockId, childType)` — add a new child block of `childType` under `parentBlockId`.
- `onRemoveChildBlock(sectionId, parentBlockId, childId)` — remove a child block by id.
- `onMoveChildBlock(sectionId, parentBlockId, childId, direction: -1|1)` — reorder a child block.

These are optional; callers that do not pass them (`page.tsx`) continue to function with the static nested block display. Wiring to `applyChange()` + `buildDraftConfig()` is a follow-up for the next phase that touches `page.tsx`.

**Add-child affordance (RISK-T05):** The add-child button in `BlockChildRow` renders only when `allowedChildTypes` is passed from the parent and `depth < MAX_EDITOR_BLOCK_DEPTH`. As of Phase T, `allowedChildTypes` is not yet resolved from the `blocks_schema` at the `SectionTreePanel` → `BlockChildRow` call site. The button is non-functional until RISK-T05 is addressed.

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

### 5.2 PostMessage Bridge (Phase S)

The bridge is a cross-origin protocol between the editor (`http://localhost:9001` dev / `https://admin.letbuyy.com` prod) and the preview iframe (`http://localhost:9000` dev / `https://store.letbuyy.com` prod). All constants are defined in `packages/theme-engine/src/editor-bridge-protocol.ts`.

**Outbound** (editor → preview): after `iframeLoadedRef.current === true`, three messages are posted to `targetOrigin = previewOrigin` (derived from `new URL(previewUrl).origin`):
- `EDITOR_LEGACY_SELECTION_MESSAGE` (`'LETBUYY_THEME_EDITOR_SELECTION'`) — backward compat; bridge translates this without scrolling (double-scroll fix, Phase S).
- `EDITOR_SELECTION_MESSAGE` (`'letbuyy:theme-editor:section-selected'`) — modern name; picked up directly by `EditorPreviewSectionFrame` listeners.
- `EDITOR_SCROLL_MESSAGE` (`'letbuyy:theme-editor:section-scroll'`) — explicit scroll intent; triggers `scrollIntoView` + flash in the bridge.

`previewOrigin` is `null` when `previewUrl` is empty. No message is ever sent when `previewOrigin` is null. No `'*'` wildcard is used.

**Inbound** (preview → editor) — `CenterPanel.handleMessage` with origin guard `if (!previewOrigin || event.origin !== previewOrigin) return`:

| Message type | Action |
|---|---|
| `EDITOR_SECTION_SELECT_MESSAGE` | Calls `onSelectSection(sectionId)` — user clicked a section in preview |
| `INSPECTOR_SECTION_HOVERED` | Sets `hoveredSection` state → `PreviewInspectorOverlay` shows chip; calls `onHoverSection?.(sectionId)` |
| `INSPECTOR_HOVER_CLEARED` | Clears `hoveredSection` state; calls `onHoverSection?.(null)` |
| `INSPECTOR_ADD_SECTION_INTENT` | Validates `adjacentSectionId` + `position` then calls `onAddSectionIntent?.(adjacentSectionId, position)` |

**Preview → editor send rule:** `EditorPreviewSectionFrame` reads `NEXT_PUBLIC_ADMIN_URL` via `getEditorOrigin()` for all sends. Sends are skipped (never `'*'`) when `getEditorOrigin()` returns empty string.

**Same-window dispatches:** The bridge (`StorefrontPreviewBridge`) re-posts `EDITOR_SELECTION_MESSAGE` and `INSPECTOR_SECTION_SCROLLED_TO` to `window.location.origin` only. `EditorPreviewSectionFrame` accepts these via `if (event.origin !== window.location.origin) return`.

**No-echo self-loop guard (preserved from Phase C):** The bridge translation branch matches only `LEGACY_SELECTION_MESSAGE || SCROLL_MESSAGE` — never `EDITOR_SELECTION_MESSAGE`. `INSPECTOR_SECTION_SCROLLED_TO` is excluded from the bridge's cross-origin handler by the origin guard (same-window dispatch origin ≠ editor origin).

### 5.3 PreviewInspectorOverlay (Phase S)

Source: `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx`

Rendered inside `.te-preview-body` by `CenterPanel`. Returns `null` when `hoveredSection` is null. When a section is hovered:
- Renders `.te-inspector-overlay` (`position: absolute; inset: 0; pointer-events: none; aria-hidden="true"`).
- Inside: `.te-inspector-hover-chip` with `MaterialIcon name="touch_app"` + `formatSectionLabel(sectionType)` text.
- The chip uses `--lb-*` tokens for colour, spacing, and radius (no raw hex or px).
- Animation: `te-inspector-chip-in` (0.12s ease; `prefers-reduced-motion: reduce` → `animation: none`).

This component contains no postMessage logic. All messaging is owned by `CenterPanel`. The overlay is purely visual — keyboard selection is handled by the section tree panel.

### 5.4 Device Switcher

Three buttons (`Monitor`, `Tablet`, `Smartphone`) in a `role="group" aria-label="Preview device"` container. Each button has `aria-pressed`. CSS: `.theme-os-device-toggle__btn--active` on the active button.

### 5.5 States

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

CenterPanel, SchemaFormRenderer, and PreviewInspectorOverlay use `te-*` classes (also in `globals.css`).

**Phase S inspector classes (merchant-control-plane):**

| Class | Purpose |
|---|---|
| `.te-inspector-overlay` | `position: absolute; inset: 0; pointer-events: none; z-index: 10` — sits above iframe without intercepting clicks |
| `.te-inspector-hover-chip` | Hover label chip; `--lb-color-primary` background; `--lb-radius-full` border-radius; `te-inspector-chip-in` animation |
| `.te-inspector-hover-chip__label` | Chip text, `line-height: 1` |

**Phase S section-frame classes (storefront-runtime):**

| Class | Purpose |
|---|---|
| `.storefront-editor-section-frame--flash` | Transient 700 ms `sf-section-frame-flash` animation on scroll-to; `prefers-reduced-motion: reduce` → `animation: none` |
| `.storefront-editor-section-insert` | Base insert-button styles (hidden by default, revealed on section hover/focus/selection) |
| `.storefront-editor-section-insert--before` | Positioned above the section |
| `.storefront-editor-section-insert--after` | Positioned below the section |

---

## 4.5 BlockChildRow (Phase T)

Source: `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx`

`BlockChildRow` is a recursive `'use client'` component that renders a single block instance and, when the block has children and `depth < MAX_EDITOR_BLOCK_DEPTH`, renders each child as a nested `<BlockChildRow depth={depth + 1} ...>`.

**Props:**
```typescript
type BlockChildRowProps = {
    block: BlockEntry;           // the block instance (may have .children)
    depth: 1 | 2 | 3;           // current nesting level (1 = direct section child)
    sectionId: string;
    parentBlockId: string;       // section.id at depth=1; parent block.id at depth 2+
    selectedBlockId?: string;
    blockLabel?: string;         // resolved from blocks_schema[block.type].name
    allowedChildTypes?: string[]; // types the parent allows as children
    onSelectBlock?: (blockId: string) => void;
    onAddChildBlock?: (sectionId: string, parentBlockId: string, childType: string) => void;
    onRemoveChildBlock?: (sectionId: string, parentBlockId: string, childId: string) => void;
    onMoveChildBlock?: (sectionId: string, parentBlockId: string, childId: string, direction: -1 | 1) => void;
}
```

**Depth cap:** `MAX_EDITOR_BLOCK_DEPTH = 3` (exported from `BlockChildRow.tsx`). The nested children container is rendered only when `depth < MAX_EDITOR_BLOCK_DEPTH && hasChildren`. Beyond depth 3 the recursion stops silently — any block at the depth cap displays without a child list.

**ARIA:** Each block row is wrapped in `div[role="treeitem"][aria-level={depth + 1}]` (1-indexed from section level). The `theme-os-tree-block--depth-N` CSS class modifier is applied for styling hooks.

**CSS classes (existing, no new rules required):**
- `.theme-os-tree-block` — the block button row (same as Phase R flat blocks)
- `.theme-os-tree-block--selected` — active selection highlight
- `.theme-os-tree-block--hidden` — visibility toggled off
- `.theme-os-tree-block--depth-N` — depth level modifier (N = 1, 2, or 3)

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

// Phase T: BlockEntry is the canonical type; exported from SectionTreePanel.tsx.
// children is optional so all existing flat-block callers compile unchanged.
type BlockEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: JsonRecord
    children?: BlockEntry[]   // Phase T — nested child blocks; absent on flat/legacy blocks
}

type EditorSelection =
    | { kind: 'section'; sectionId: string }
    | { kind: 'block'; sectionId: string; blockId: string }
    | { kind: 'theme'; groupKey: string }
```

**Nested block depth:** `BlockEntry.children` supports up to `MAX_EDITOR_BLOCK_DEPTH = 3` levels. The `applyChange()` + `buildDraftConfig()` path serialises this to `ThemeBundleTemplateBlock.blocks` (keyed Record) + `block_order` (ordered ids). `block_definitions` (the type catalog, including `allowed_child_types`) always comes from `baseConfig` and is never mutated by child operations (RISK-DUAL-N01 preserved).

`applyChange(updater)` is the only mutation entry point. It: (1) derives the next state from the updater, (2) pushes the current state onto `history.past`, (3) sets `isDirty=true`, (4) sets the next state.

---

## 12. Key Risks Affecting This Module

| Risk ID | Severity | Description | Target |
|---|---|---|---|
| RISK-DUAL-N01 | MEDIUM | Editor save must reconstruct `section_definitions`/`block_definitions` from `baseConfig`, not `editorState` | Enforced mechanically by `buildDraftConfig`; Phase T child callbacks mutate instance tree only (RISK preserved) |
| RISK-SEC-P01 | MEDIUM | `theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id` | No client-side realtime subscription may be added until fixed |
| RISK-PERF-N01 | LOW | Large document serialization on each draft save | `buildDraftConfig` sends only mutable state; Liquid source comes from `baseConfig` not re-serialized |
| RISK-SEC-002 | INFO | AI hooks are stubs; must not be presented as connected | Phase AC |
| RISK-R01 | LOW | **CLOSED (Phase T)** — `BlockEntry.children` added to canonical type; remaining four shared types still mirrored | Next substantive `page.tsx` touch |
| RISK-T05 | MEDIUM | `allowedChildTypes` not passed from `SectionTreePanel` to `BlockChildRow` — add-child button dead | Phase U or first `SectionTreePanel.tsx` touch |
| RISK-T04 | LOW | `RENDERER_MAX_BLOCK_DEPTH` is private — depth parity test cannot directly assert it | Phase U or first `theme-renderer.ts` touch |
