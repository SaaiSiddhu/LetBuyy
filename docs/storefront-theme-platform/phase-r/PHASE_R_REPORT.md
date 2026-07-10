# Phase R Report — Visual Editor Shell

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** R — Visual Editor Shell
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase R completes the editor shell surface: ConflictDialog for draft CAS conflicts, SectionTreePanel with ARIA tree widget and HTML5 drag-to-reorder, and 26 static contract tests. No SECURITY DEFINER RPCs modified, no frozen apps touched, no gateway lane, no database migration.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase R touches `apps/merchant-control-plane/src/app/globals.css` and `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`, both of which are FOREIGN WIP FILES carrying prior user modifications. **These changes have NOT been staged and MUST NOT be committed or deployed without explicit review of the four disjoint hunks against the surrounding foreign WIP.**

No new database migrations. No gateway changes. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|---|---|---|
| `apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx` | 68 | Draft CAS conflict dialog — clear reload/force choice; no silent overwrite |
| `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` | 447 | Extracted section tree with ARIA tree widget, keyboard nav, HTML5 drag-to-reorder |
| `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` | 212 | 26 static contract tests |

### 1.2 Modified Files

| File | Change | WIP? |
|---|---|---|
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | 4 disjoint hunks (imports / conflict state / 409 detection / JSX + extraction). See Section 2. | FOREIGN WIP — touch is surgical and isolatable |
| `apps/merchant-control-plane/src/app/globals.css` | Added `.theme-os-tree-section--drag-over` rule (5 lines, token-only, no hex). | FOREIGN WIP |
| `apps/merchant-control-plane/package.json` | `theme-editor-r.test.mjs` appended to the `test` script file list. | Clean |

---

## 2. Foreign WIP Files Touched and How the Orchestrator Isolates Them

Both foreign WIP files are modified by inserting new, self-contained content in locations that do not overlap with any other WIP block. All four hunks in `page.tsx` are independently revertible via `git diff` review.

### 2.1 `page.tsx` — Four Disjoint Hunks

**HUNK 1 — Imports** (after the existing clean-component import block, lines 47–48):
```typescript
import ConflictDialog from '@/components/theme-editor/ConflictDialog'
import SectionTreePanel, { TreeGroup } from '@/components/theme-editor/SectionTreePanel'
```
Safe to revert in isolation: removing these two lines reverts HUNK 4 automatically because the JSX that references them would fail typecheck, making any partial revert immediately visible.

**HUNK 2 — Conflict state** (after `isPreviewRefreshing` useState, lines 723–725):
```typescript
// Phase R — conflict state: set when a draft PUT returns HTTP 409 (code 'CONFLICT').
const [hasConflict, setHasConflict] = useState(false)
const [conflictSource, setConflictSource] = useState<'autosave' | 'manual-save'>('autosave')
```
Self-contained state declarations. Reverting removes the state but does not affect any other editor state variable.

**HUNK 3 — 409 detection** (two sub-hunks inside `saveDraft` and `syncPreviewDraft`):
- `saveDraft`: added `force = false` parameter; changed `baseVersion` to `force ? undefined : (draftVersion ?? undefined)`; added 409 guard that sets `hasConflict`/`conflictSource` and throws `ConflictError`; `handleSave` catch suppresses toast for `ConflictError`.
- `syncPreviewDraft`: added 409 guard before `!draftRes.ok` throw that sets `hasConflict`/`conflictSource('autosave')` and returns early.
Reverting HUNK 3 restores the prior behavior (generic error text / toast on 409). No other code path is affected.

**HUNK 4 — JSX + extraction** (the section-panel JSX and inline function deletion):
- `<SectionTree .../>` replaced with `<SectionTreePanel .../>` (identical prop contract).
- `<ConflictDialog open={hasConflict} source={conflictSource} onReload={...} onForce={...} />` added after the block-removal ConfirmDialog.
- ~176 lines of inline `SectionTree`, `TreeGroup`, `TreeSection` function declarations deleted.
- `undo()`: `setIsDirty(true)` replaced with `setIsDirty(previous !== savedState)`.
- `onForce` handler: `void saveDraft(true)` replaced with `saveDraft(true).catch(err => { ... })`.

### 2.2 `globals.css` — Single CSS Rule Block

Added 5 lines after the existing `.theme-os-tree-section--hidden` block at line 12582:
```css
/* Drop-target indicator for drag-and-drop reorder.
   Uses --lb-color-brand-default token — no raw hex fallback. */
.theme-os-tree-section--drag-over {
  outline: 2px solid var(--lb-color-brand-default);
  outline-offset: -2px;
}
```
Uses only `--lb-*` design tokens. No hex fallback. Reverting removes 5 lines with no impact on other styles.

---

## 3. Rollback

**Full rollback:** `git checkout -- apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx apps/merchant-control-plane/src/app/globals.css apps/merchant-control-plane/package.json` + `git rm apps/merchant-control-plane/src/components/theme-editor/ConflictDialog.tsx apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx apps/merchant-control-plane/tests/theme-editor-r.test.mjs`.

Rollback restores the inline `SectionTree`/`TreeGroup`/`TreeSection` declarations, removes conflict state and 409 detection, and removes the test file. The editor continues to function with the pre-Phase-R behavior (generic error text on 409, no ARIA tree widget, no HTML5 drag).

---

## 4. Test Results

| Suite | Count | Result |
|---|---|---|
| Phase R (theme-editor-r.test.mjs) | 26 | PASS |
| Phase Q (theme-library-q.test.mjs) | 25 | PASS |
| Pre-existing (federation/localization/app-platform) | 14 | PASS |
| **Total (pnpm --filter @letbuyy/merchant-control-plane test)** | **65/65** | **PASS** |
| Typecheck | — | Clean (0 errors) |

Pre-existing failures (3): merchant AI route, executive analytics migration, storefront-runtime payment route. All three are unchanged from Phase Q. None introduced by Phase R.

---

## 5. Code Review Findings and Resolutions

Phase R surfaced 10 findings during review. All HIGH and MEDIUM severity findings were fixed before phase close. Two LOW findings were deferred.

### 5.1 Fixed (HIGH/MEDIUM)

| Severity | Finding | Fix |
|---|---|---|
| HIGH | `ConflictDialog` mapped `onClose` to `onForce`, so Escape/backdrop triggered force-save | Swapped: `onConfirm={onForce}`, `onClose={onReload}`. Light-dismiss now always resolves to the safe "Reload from server" path. |
| HIGH | `handleDrop` moved section only ±1 step regardless of drag distance | `handleDrop` now loops `Math.abs(toIndex - dragIndex)` times, calling `onMoveSection(section.id, direction)` each iteration. Multi-step drag-to-reorder now works correctly. |
| MEDIUM | Roving tabindex broke when `selection.kind === 'block'` (all section rows got `tabIndex=-1`) | Added `isActiveParent` check: when a block is selected, the parent section row receives `tabIndex=0` and `aria-selected=true`. |
| MEDIUM | Drag-over visual used inline `style` with raw `2px`/`-2px` and `#4F46E5` hex fallback | Replaced with CSS class `.theme-os-tree-section--drag-over` using `var(--lb-color-brand-default)`, no hex fallback. |
| MEDIUM | Action buttons inside `role="treeitem"` had `tabIndex=0`, creating O(n×actions) Tab stops | All action buttons set `tabIndex={-1}`. Roving tabindex is on the outer `role="treeitem"` div only. |
| MEDIUM | `ChevronDown` icon in section row implied expand/collapse affordance without a toggle | Removed `ChevronDown`. Block presence is communicated via `rowAriaLabel` on the main section button ("Hero, 2 blocks"). |
| MEDIUM | `undo()` called `setIsDirty(true)` unconditionally, even when restored state equalled `savedState` | `undo()` now calls `setIsDirty(previous !== savedState)`. After save + undo-back-to-saved, SaveBar correctly shows "Saved". |
| MEDIUM | `onForce` handler had `void saveDraft(true)` with no error handling | Replaced with `saveDraft(true).catch(err => { if (err.name !== 'ConflictError') notify({...critical...}) })`. Force-save failures now surface a toast. |

### 5.2 Deferred (LOW)

| Severity | Finding | Reason for deferral |
|---|---|---|
| LOW | Local type mirrors (`SectionEntry`, `BlockEntry`, `EditorState`, `EditorSelection`, `AvailableSection`) duplicated in both `page.tsx` and `SectionTreePanel.tsx` | Extracting to `@/lib/theme-editor-types.ts` requires additional `page.tsx` surface in a foreign WIP file. Deferred — LOW risk, types are structurally stable across M→R. |
| LOW | Dead lucide imports (`Eye`, `GripVertical`, `PanelLeft`, `ChevronRight`) remain in `page.tsx` after extraction | Intentionally preserved: sibling WIP in the foreign file may reference them; `noUnusedLocals` is not set; removing increases foreign-WIP churn. |

---

## 6. RISK-DUAL-N01 Mechanical Enforcement

RISK-DUAL-N01 (editor save must not mutate `section_definitions` / `block_definitions`) is mechanically enforced by the draft save flow:

- `buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` merges `editorState` (mutable templates/settings) over `baseConfig` (the load-time bundle including `section_definitions` / `block_definitions`). The immutable fields come from `baseConfig`, not from `editorState`.
- `baseConfig` is set to the initial `loadedBaseConfig` from the API response and updated only on successful save (not on editor mutations).
- No Phase R code path writes `section_definitions` or `block_definitions` from `editorState`.

RISK-DUAL-N01 status: OPEN — the risk persists for any future phase that might add an editor mutation path for these fields. The mechanical guard in Phase R's `buildDraftConfig` is the primary defense. Phase S (live preview inspector) must also respect this constraint.

---

## 7. RISK-PERF-N01 Profiling Note

RISK-PERF-N01 (large document size, deferred to Phase R) was profiled during Phase R development:

- The `buildDraftConfig` function serializes only the mutable editor state (template JSON), not the full `ThemeDocument` (which includes `section_definitions` Liquid source). The draft POST body is therefore proportional to the number of sections and their settings, not to the Liquid source size.
- `section_definitions` / `block_definitions` are preserved from `baseConfig` in the draft payload but are not re-serialized from the Liquid source on each save — the Liquid source is the `baseConfig` snapshot loaded at editor open.
- No hard size-limit enforcement was added in Phase R. A `superRefine` total-source-byte bound (RISK-PERF-N01 mitigation candidate (a)) is deferred to Phase S or a dedicated hardening pass.

---

## 8. Parity Impact

Phase R advances the Shopify parity matrix for the editor shell cluster:

| Capability | Pre-Phase-R | Post-Phase-R |
|---|---|---|
| Editor shell layout (header/sidebar/preview/properties) | PARTIAL | PARTIAL (structure complete; live data hooks pending Phase S) |
| Section tree ARIA widget | MISSING | COMPLETE |
| Section drag-to-reorder | MISSING | COMPLETE (keyboard move-up/down pre-existing; drag now added) |
| Draft CAS conflict handling | MISSING | COMPLETE |
| Undo/redo dirty-state accuracy | PARTIAL (always dirty after undo) | COMPLETE |
| Editor loading / error states | COMPLETE | COMPLETE (unchanged) |
| Device preview switcher | COMPLETE | COMPLETE (unchanged) |

The remaining PARTIAL/MISSING editor capabilities (live preview inspector, template system, nested blocks, media library, markets, code editor) are tracked in Phases S–AA of the program.
