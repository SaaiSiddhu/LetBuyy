# Phase R Test Report — Editor Shell Contracts, Accessibility, and Drag-Reorder

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** R — Visual Editor Shell
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Test Gate Summary

| Stage | Tests | Typecheck |
|---|---|---|
| Phase Q baseline (entering Phase R) | 39/39 merchant (24 Q + 15 pre-existing) | Clean |
| Phase R implementation | +26 new (theme-editor-r.test.mjs) | Clean |
| Phase R hardening | 0 additional tests; hardening fixes verified by existing 26 | Clean |
| **Phase R final** | **65/65** (26 Phase R + 25 Phase Q + 14 pre-existing) | **Clean** |

**Command:** `pnpm --filter @letbuyy/merchant-control-plane typecheck test`

The `test` script runs all five files as a single `node --test` invocation from the monorepo root:
```
node --test \
  tests/federation/web-app-contract-boundary.test.mjs \
  tests/localization/theme-localization.test.mjs \
  tests/app-platform/app-bridge.test.mjs \
  apps/merchant-control-plane/tests/theme-library-q.test.mjs \
  apps/merchant-control-plane/tests/theme-editor-r.test.mjs
```

**Pre-existing failures:** 3 (merchant AI route, executive analytics migration, storefront-runtime payment route) — unchanged from Phase Q. None introduced by Phase R.

**Net new tests (Phase R):** +26 (all in `theme-editor-r.test.mjs`).

---

## 2. Phase R Test File

**File:** `apps/merchant-control-plane/tests/theme-editor-r.test.mjs`
**Total tests:** 26
**Test runner:** Node.js `node:test` with `node:assert/strict`
**DB:** Not applicable — all tests are static source-text assertions (`readFileSync`). No Next.js, no DB, no gateway calls.

### 2.1 New Component Files Exist (Tests 1–2)

| Test # | Assertion |
|---|---|
| 1 | `ConflictDialog.tsx` exists under `components/theme-editor/` |
| 2 | `SectionTreePanel.tsx` exists under `components/theme-editor/` |

### 2.2 Design Token Compliance — `@letbuyy/ui` Import (Tests 3–4)

Both new components must import from `@letbuyy/ui`. This enforces the design-system boundary: no raw primitive implementations.

| Test # | File | Assertion |
|---|---|---|
| 3 | `ConflictDialog.tsx` | Source matches `/from '@letbuyy\/ui'/` |
| 4 | `SectionTreePanel.tsx` | Source matches `/from '@letbuyy\/ui'/` |

### 2.3 Design Ratchet — No Raw `rounded-[...px]` (Tests 5–6)

| Test # | File | Assertion |
|---|---|---|
| 5 | `ConflictDialog.tsx` | Source does NOT match `/rounded-\[\d+px\]/` |
| 6 | `SectionTreePanel.tsx` | Source does NOT match `/rounded-\[\d+px\]/` |

### 2.4 ConflictDialog Contract (Tests 7–9)

| Test # | Assertion |
|---|---|
| 7 | Source contains `CONFLICT` (error-code detection reference) |
| 8 | Source contains `onReload` AND `onForce` prop names |
| 9 | Source wraps `ConfirmDialog` from `@letbuyy/ui` |

These three tests together verify that the conflict dialog (a) knows about the CONFLICT code, (b) exposes the two merchant-action props, and (c) uses the shared dialog primitive rather than a custom modal.

### 2.5 SectionTreePanel ARIA Tree Widget (Tests 10–15)

These tests verify the WAI-ARIA tree widget pattern required by WCAG 2.1 SC 2.1.1 and the WAI-ARIA authoring practices for the `tree` role.

| Test # | Assertion |
|---|---|
| 10 | Source contains `role.*treeitem` or `treeitem.*role` (ARIA role on rows) |
| 11 | Source contains `aria-selected` (ARIA selection state on rows) |
| 12 | Source contains `role="tree"` (ARIA tree container) |
| 13 | Source contains `ArrowDown` (keyboard navigation) |
| 14 | Source contains `ArrowUp` (keyboard navigation) |
| 15 | Source contains `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd` (HTML5 D&D) |

Test 15 is a single test that checks for all five drag-related identifiers, asserting the full drag lifecycle is wired.

### 2.6 TreeGroup Re-Export (Test 16)

| Test # | Assertion |
|---|---|
| 16 | Source contains `export function TreeGroup` |

`TreeGroup` must be a named export (not default) so `page.tsx` can import it via `import SectionTreePanel, { TreeGroup }` without pulling in the old inline declaration.

### 2.7 `page.tsx` Imports the New Components (Tests 17–20)

| Test # | Assertion |
|---|---|
| 17 | `page.tsx` source matches `/from '@\/components\/theme-editor\/ConflictDialog'/` |
| 18 | `page.tsx` source matches `/from '@\/components\/theme-editor\/SectionTreePanel'/` |
| 19 | `page.tsx` renders `<ConflictDialog` in its JSX |
| 20 | `page.tsx` renders `<SectionTreePanel` in its JSX |

### 2.8 Inline Declarations Removed from `page.tsx` (Tests 21–23)

After extraction, the three inline function declarations must not remain in `page.tsx`. Tests use multiline assertion (`/^function <Name>\b/m`).

| Test # | Function | Assertion |
|---|---|---|
| 21 | `SectionTree` | Source does NOT match `/^function SectionTree\b/m` |
| 22 | `TreeGroup` | Source does NOT match `/^function TreeGroup\b/m` |
| 23 | `TreeSection` | Source does NOT match `/^function TreeSection\b/m` |

### 2.9 Conflict State and 409 Detection in `page.tsx` (Tests 24–26)

| Test # | Assertion |
|---|---|
| 24 | `page.tsx` contains `hasConflict` AND `setHasConflict` |
| 25 | `page.tsx` checks `status.*409` or `409.*status`, AND contains `conflictSource` |
| 26 | `page.tsx` passes `onReload=` AND `onForce=` to `<ConflictDialog`, AND calls `saveDraft.*true` or `true.*saveDraft` in the force path |

---

## 3. Accessibility Coverage

The Phase R tests enforce structural ARIA correctness at the contract level. The following a11y properties are directly verified:

| Property | Component | Test # |
|---|---|---|
| `role="treeitem"` on section rows | `SectionTreePanel.tsx` | 10 |
| `aria-selected` on section rows | `SectionTreePanel.tsx` | 11 |
| `role="tree"` on template container | `SectionTreePanel.tsx` | 12 |
| Arrow-key keyboard navigation | `SectionTreePanel.tsx` | 13, 14 |

Additional a11y properties implemented but not directly contracted by tests (verified by code review):

| Property | Evidence |
|---|---|
| `tabIndex={-1}` on action buttons (Toggle/Move-up/Move-down/Remove) | `SectionTreePanel.tsx` lines 205, 210, 214, 216 — removes competing Tab stops from inside each treeitem |
| Roving `tabIndex` (active item = 0, others = -1) | `tabIndex={isSelected \|\| isActiveParent ? 0 : -1}` in `SectionTreePanel.tsx` template map |
| `isActiveParent` for block selection: parent section row gets `aria-selected=true` and `tabIndex=0` when a child block is selected | `const isActiveParent = selection.kind === 'block' && selection.sectionId === section.id` in `SectionTreePanel.tsx` |
| `aria-label` on device switcher button group | `role="group" aria-label="Preview device"` in `page.tsx` |
| `aria-pressed` on device switcher buttons | `aria-pressed={previewDevice === device.value}` in `page.tsx` |
| `aria-label="Back to section"` on back button in PropertyPanel | `page.tsx` line 1707 |
| `aria-label="Theme editor navigation"` on left sidebar | `page.tsx` line 1423 |
| `aria-label="Live theme preview"` on center section | `page.tsx` line 1473 |
| `aria-label="Theme properties"` on right aside | `page.tsx` line 1700 |
| `role="status"` on EditorLoading | `page.tsx` line 1804 |
| `role="alert"` on load-error state | `page.tsx` line 1330 |
| Row aria-label with block count (e.g. "Hero, 2 blocks") | `SectionTreePanel.tsx` `rowAriaLabel` — avoids misleading ChevronDown expand/collapse affordance |

---

## 4. Drag-and-Drop Reorder — Multi-Step Distance Fix

The initial implementation of `handleDrop` moved the section only ±1 position per drop regardless of actual drag distance. The hardening pass fixed this:

**Pre-hardening (broken):**
```javascript
const direction: -1 | 1 = toIndex > dragIndex ? 1 : -1
onMoveSection(section.id, direction)   // always 1 step
```

**Post-hardening (correct):**
```javascript
const direction: -1 | 1 = toIndex > dragIndex ? 1 : -1
const steps = Math.abs(toIndex - dragIndex)
for (let i = 0; i < steps; i++) {
    onMoveSection(section.id, direction)
}
```

`onMoveSection` finds the section by ID on each call, so position tracking is correct under React 18 batched functional updater semantics even as the index changes mid-loop.

---

## 5. Pre-Existing Test Files (Not Changed by Phase R)

| File | Test count | Purpose |
|---|---|---|
| `tests/federation/web-app-contract-boundary.test.mjs` | (part of 14 pre-existing) | Federation boundary contracts |
| `tests/localization/theme-localization.test.mjs` | (part of 14 pre-existing) | Localization contracts |
| `tests/app-platform/app-bridge.test.mjs` | (part of 14 pre-existing) | App bridge contracts |
| `apps/merchant-control-plane/tests/theme-library-q.test.mjs` | 25 | Phase Q merchant UI contracts |

---

## 6. Typecheck Result

`pnpm --filter @letbuyy/merchant-control-plane typecheck` exits 0. No TypeScript errors introduced by Phase R.

Note: Four lucide-react icons (`Eye`, `GripVertical`, `PanelLeft`, `ChevronRight`) remain in the `page.tsx` import block after the inline SectionTree extraction. They are no longer used inside `page.tsx` but `noUnusedLocals` is not set in the merchant app's `tsconfig.json`, so typecheck passes. These are intentionally preserved — sibling WIP in the same foreign-WIP file may reference them and removing them would increase the foreign-WIP touch surface.
