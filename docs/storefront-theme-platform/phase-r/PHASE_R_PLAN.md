# Phase R Plan — Visual Editor Shell

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** R — Visual Editor Shell
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase R delivers the missing pieces of the merchant visual editor shell against a baseline editor page that already contained the header, section tree (inline), settings tree, version panel, property panel, undo/redo, autosave, device switcher, and full CSS token system from prior work.

Specifically, Phase R:

1. Adds a **ConflictDialog** for HTTP 409 (draft CAS conflict) — replacing silent error text with a clear merchant choice between reload and force-save.
2. Extracts the inline **SectionTree/TreeGroup/TreeSection** to a standalone `SectionTreePanel.tsx` with WAI-ARIA tree widget pattern, roving tabindex, keyboard arrow navigation, and HTML5 drag-and-drop reorder.
3. Wires **four minimal hunks** into the foreign WIP `page.tsx`: imports, conflict state declarations, 409 detection in both autosave and manual-save paths, and JSX replacement of the inline section tree.
4. Adds **26 static contract tests** in a new `theme-editor-r.test.mjs` file registered in the `package.json` test script.

Phase R introduces **no gateway changes**, **no database migrations**, **no new npm dependencies**, and **no new CSS classes** (other than the single `.theme-os-tree-section--drag-over` token-only rule added to `globals.css`).

---

## 2. Constraints

### 2.1 Foreign WIP File

`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` is a FOREIGN WIP FILE — it carries prior user modifications that must never be staged. Phase R changes to this file are limited to four disjoint hunks that are individually reviewable and revertible.

### 2.2 Design System Ratchet

- No new `rounded-[...px]` raw-pixel radius classes.
- No new raw hex color values.
- All visual rules must use `--lb-*` CSS variables.
- All new components must import from `@letbuyy/ui`, not implement their own primitives.

### 2.3 RISK-SEC-002 Scope

The editor AI hooks (`applyAiHook`) remain stubs — hardcoded strings, no fetch to any AI service. Phase R does not change this. AI wiring is deferred to Phase AC.

### 2.4 RISK-DUAL-N01 Scope

The editor save adapter must reconstruct `section_definitions` and `block_definitions` from the original load-time `baseConfig`, not from `editorState`. Phase R enforces this mechanically: `buildDraftConfig` uses `baseConfig` for all immutable bundle fields. Phase R does not expose a mutation path for `section_definitions`.

### 2.5 RISK-SEC-P01 Scope

`theme_editor_drafts` RLS policies check `user_id` only, not `custom_user_id`. Phase R does not add any client-side realtime subscription over `theme_editor_drafts`, so this risk remains bounded to the gateway-service-role path. The risk disposition is unchanged (targeted at a dedicated security migration before any realtime subscription is added).

---

## 3. Implementation Approach

### 3.1 New Files

**`ConflictDialog.tsx`** (`apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx`)
- Wraps `@letbuyy/ui ConfirmDialog`.
- Props: `open: boolean`, `source?: 'autosave' | 'manual-save'`, `onReload: () => void`, `onForce: () => void`.
- Safe light-dismiss contract (Escape / backdrop): maps `onClose` to `onReload` — the non-destructive default.
- Explicit force-save: maps `onConfirm` to `onForce` — only reachable via the "Keep my changes" button.
- Two description strings keyed on `ConflictSource` — different language for autosave vs manual-save context.

**`SectionTreePanel.tsx`** (`apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`)
- Extracted from `SectionTree`, `TreeGroup`, `TreeSection` inline declarations in `page.tsx`.
- Prop contract identical to the former inline `SectionTree` — no changes to call sites.
- `TreeGroup` re-exported so `ThemeSettingsTree` and `VersionTree` (still in `page.tsx`) continue to work after the inline declaration is removed.
- ARIA: `role="tree"` on the template list container with `aria-label="Template sections"`. `role="treeitem"` + `aria-selected` + roving `tabIndex` on each section row.
- Roving tabindex: the selected section row (or the active-parent row when a child block is selected) receives `tabIndex=0`; all others receive `tabIndex=-1`.
- `isActiveParent` derived for block-selection: when `selection.kind === 'block'`, the section whose `id === selection.sectionId` receives `aria-selected=true` and `tabIndex=0`.
- Action buttons (Toggle visibility, Move up, Move down, Remove): all have `tabIndex={-1}` to keep them out of the Tab stop sequence per WAI-ARIA tree widget spec.
- `rowAriaLabel` on the main section button includes block count when blocks are present (e.g. "Hero, 2 blocks"), since no expand/collapse is implemented and the block count is the only structural indicator.
- Keyboard navigation: event delegation on the `role="tree"` container handles `ArrowDown` and `ArrowUp`. Queries all `[role="treeitem"]` children, finds the currently focused one, moves focus ±1 with bounds clamping.
- Drag-and-drop: `draggable={!pinned}`, `onDragStart` / `onDragOver` / `onDrop` / `onDragEnd` on template-section rows. Header and footer rows are pinned and never draggable. `handleDrop` computes the full step distance (`Math.abs(toIndex - dragIndex)`) and calls `onMoveSection(section.id, direction)` in a loop — each iteration looks up the section by ID so position tracking remains correct under React 18 batched updates.
- Drag-over visual: CSS class `.theme-os-tree-section--drag-over` (token-only, no inline style). Dragging row gets `opacity: 0.45` inline (a dynamic value that cannot be a static CSS class).

**`theme-editor-r.test.mjs`** (`apps/merchant-control-plane/tests/theme-editor-r.test.mjs`)
- 26 tests using `node:test` + `node:assert/strict` + `readFileSync` source assertions.
- Categories: file existence (2), `@letbuyy/ui` import compliance (2), design ratchet no raw px class (2), `ConflictDialog` CONFLICT detection + `onReload`/`onForce` + `ConfirmDialog` wrap (3), `SectionTreePanel` ARIA tree widget (`role=treeitem`, `aria-selected`, `role=tree`, `ArrowDown`/`ArrowUp`, `draggable`/`onDragStart`/`onDragOver`/`onDrop`/`onDragEnd`, `export function TreeGroup`) (6), `page.tsx` imports (`ConflictDialog`, `SectionTreePanel`, JSX renders both) (4), `page.tsx` no longer contains inline function declarations for `SectionTree`, `TreeGroup`, `TreeSection` (3), `page.tsx` conflict state (`hasConflict`, `setHasConflict`, `conflictSource`, 409 detection) (3), `page.tsx` `onReload=` and `onForce=` wired to `ConflictDialog` + `saveDraft(true)` force path (2), no Supabase or direct gateway access in new components (1).

### 3.2 Foreign WIP `page.tsx` Hunks (Minimal, Isolatable)

**HUNK 1 — Imports** (after existing SchemaFormRenderer/CenterPanel/ExperiencePicker imports):
```
import ConflictDialog from '@/components/theme-editor/ConflictDialog'
import SectionTreePanel, { TreeGroup } from '@/components/theme-editor/SectionTreePanel'
```

**HUNK 2 — Conflict state** (after `isPreviewRefreshing` state declaration):
```
const [hasConflict, setHasConflict] = useState(false)
const [conflictSource, setConflictSource] = useState<'autosave' | 'manual-save'>('autosave')
```

**HUNK 3 — 409 detection** (two sub-hunks):
- In `saveDraft`: add `force = false` parameter; change `baseVersion` to `force ? undefined : (draftVersion ?? undefined)`; add 409 guard before the generic `!res.ok` throw that sets `hasConflict`/`conflictSource` and throws `ConflictError`; in `handleSave` catch, suppress toast for `ConflictError`.
- In `syncPreviewDraft`: add 409 guard before the `!draftRes.ok` throw that sets `hasConflict`/`conflictSource('autosave')` and returns early.

**HUNK 4 — JSX + extraction**:
- Replace `<SectionTree ... />` with `<SectionTreePanel ... />` (identical prop contract).
- Add `<ConflictDialog open={hasConflict} source={conflictSource} onReload={...} onForce={() => saveDraft(true).catch(...)} />` after the block-removal ConfirmDialog.
- Delete inline declarations for `SectionTree`, `TreeGroup`, `TreeSection` (~176 lines).
- In `undo()`: change `setIsDirty(true)` to `setIsDirty(previous !== savedState)`.
- In `onForce` handler: add `.catch(err => notify({...critical...}))` for non-ConflictError failures.

### 3.3 `globals.css` Addition (FOREIGN WIP FILE)

Single CSS rule added after `.theme-os-tree-section--hidden` block (line 12582):
```css
/* Drop-target indicator for drag-and-drop reorder.
   Uses --lb-color-brand-default token — no raw hex fallback. */
.theme-os-tree-section--drag-over {
  outline: 2px solid var(--lb-color-brand-default);
  outline-offset: -2px;
}
```

### 3.4 `package.json` Addition

`theme-editor-r.test.mjs` appended to the `test` script's file list.

---

## 4. Not In Scope (Phase R)

| Item | Reason |
|---|---|
| Gateway route changes | Phase P draft route handles 409-CONFLICT correctly already |
| Database migrations | No new tables or columns needed |
| Live realtime subscriptions over `theme_editor_drafts` | Blocked by RISK-SEC-P01 until RLS is patched |
| Expand/collapse of block sub-lists in the tree | Out of scope for Phase R; Section T (nested blocks) |
| AI wiring | Phase AC |
| Type extraction to shared module | LOW-severity tech debt; deferred |
| Dead lucide icon cleanup in `page.tsx` imports | Sibling WIP may reference them; deferred |

---

## 5. Gate Entering Phase R

| Metric | Baseline |
|---|---|
| api-gateway (all tests) | 438 (Phase P) + 41 (Phase Q file-scoped) passing |
| theme-engine | 1034 passing |
| merchant-control-plane (pnpm test) | 39/39 (24 Phase Q + 15 pre-existing federation/localization/app-platform) |
| api-gateway typecheck | 32/32 turbo tasks clean |
| merchant-control-plane typecheck | Clean (0 errors) |

---

## 6. Gate Exiting Phase R

| Metric | Target |
|---|---|
| merchant-control-plane (pnpm test) | 65/65 (26 new Phase R + 25 Phase Q + 14 pre-existing) |
| merchant-control-plane typecheck | Clean (0 errors) |
| api-gateway + theme-engine | Unchanged from Phase Q baseline |
| `ConflictDialog.tsx` exists | Required |
| `SectionTreePanel.tsx` exists | Required |
| `theme-editor-r.test.mjs` exists and passes | Required |
| `page.tsx` has no inline `SectionTree` / `TreeGroup` / `TreeSection` | Required |
| `page.tsx` detects HTTP 409 in both `saveDraft` and `syncPreviewDraft` | Required |
