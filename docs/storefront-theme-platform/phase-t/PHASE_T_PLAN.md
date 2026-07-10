# Phase T Plan — Section Groups and Nested Blocks

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** T — Section Groups and Nested Blocks
**Date authored:** 2026-07-11
**Branch:** `stepup/main`

---

## 1. Scope

Phase T implements nested block support across the full theme stack: bundle schema serialisation, document adapter round-trips, Liquid renderer depth-guarded recursion, and the editor section tree UI. The phase splits into two lanes that are independently testable. The Phase N fail-closed guard in `fromThemeDocumentV2` is removed now that the full implementation is in place.

### 1.1 Phase T does NOT include

- Wiring `onAddSectionIntent` from Phase S in `editor/page.tsx` (foreign WIP file; Phase T avoids substantive touch).
- Adding realtime subscriptions over `theme_editor_drafts` (RISK-SEC-P01 remains open).
- Section-group containers at the layout level (deferred; nested blocks at the block instance level cover the merchant need for this phase).
- The `onAddChildBlock` add-child affordance in the editor (the affordance renders only when `allowedChildTypes` is passed; see Finding 4 below — the wiring from `blocks_schema` is deferred to a follow-up).

---

## 2. Deliverables

### Lane A — theme-engine (schema, adapter, renderer, tests)

| Deliverable | File | Status |
|---|---|---|
| `ThemeBundleTemplateBlock` interface + `z.lazy()` schema | `packages/theme-engine/src/theme-bundle.ts` | Modified (pre-existing WIP) |
| `MAX_BUNDLE_BLOCK_NESTING_DEPTH=3` constant | `packages/theme-engine/src/theme-bundle.ts` | Modified (pre-existing WIP) |
| `allowed_child_types` on `ThemeLiquidReusableBlockSchema` | `packages/theme-engine/src/theme-bundle.ts` | Modified (pre-existing WIP) |
| Depth `superRefine` in `ThemeBundleTemplateSectionSchema` | `packages/theme-engine/src/theme-bundle.ts` | Modified (pre-existing WIP) |
| Phase N fail-closed guard removed from `fromThemeDocumentV2` | `packages/theme-engine/src/theme-document.ts` | Modified (pre-existing WIP) |
| `docBlockToBundleBlock` / `bundleBlockToDocBlock` recursive helpers | `packages/theme-engine/src/theme-document.ts` | Modified (pre-existing WIP) |
| `validateBlockChildTypes` + §5 superRefine call in `ThemeDocumentSchema` | `packages/theme-engine/src/theme-document.ts` | Modified (pre-existing WIP) |
| `RENDERER_MAX_BLOCK_DEPTH=3` + depth param + `sub_blocks` threading | `packages/theme-engine/src/theme-renderer.ts` | Modified (pre-existing WIP) |
| `BlockModel.children?: BlockModel[]` | `packages/theme-engine/src/index.ts` | Modified (pre-existing WIP) |
| Nested-block tests (18 test() calls) | `packages/theme-engine/test/theme-document-nested-blocks.test.ts` | New |

### Lane B — editor (SectionTreePanel + BlockChildRow + tests)

| Deliverable | File | Status |
|---|---|---|
| `BlockEntry.children?: BlockEntry[]` | `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` | Modified (pre-existing WIP) |
| `onAddChildBlock` / `onRemoveChildBlock` / `onMoveChildBlock` props | `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` | Modified (pre-existing WIP) |
| Delegate block rendering to `BlockChildRow` | `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` | Modified (pre-existing WIP) |
| `BlockChildRow.tsx` (new component) | `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx` | New |
| `theme-editor-t.test.mjs` (27 test() calls) | `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` | New |
| Register test file in package.json | `apps/merchant-control-plane/package.json` | Modified (pre-existing WIP) |

---

## 3. Block Model Design

### 3.1 Depth Bound

All three constants are locked at **3** and must stay in sync:

| Constant | File | Layer |
|---|---|---|
| `MAX_BLOCK_NESTING_DEPTH = 3` | `theme-document.ts:53` | Document parse gate |
| `MAX_BUNDLE_BLOCK_NESTING_DEPTH = 3` | `theme-bundle.ts:296` | Bundle parse gate |
| `RENDERER_MAX_BLOCK_DEPTH = 3` (private) | `theme-renderer.ts:950` | Renderer recursion cap |
| `MAX_EDITOR_BLOCK_DEPTH = 3` (exported) | `BlockChildRow.tsx:40` | Editor UI recursion cap |

Depth is counted as: flat = 1; one level of children = 2; one level of grandchildren = 3. Depth-4+ is rejected at parse time and silently stopped at render time.

### 3.2 Instance vs Catalog Separation (RISK-DUAL-N01 preserved)

- **Block instances** (`ThemeDocumentBlock.children`, `ThemeBundleTemplateBlock.blocks`) carry state: id, type, settings, disabled, children. These are mutable editor-side data.
- **Block catalog** (`block_definitions[type]`) carries the type specification including `allowed_child_types`. This comes from `baseConfig`, never from `editorState`.

Phase T never conflates instance state and catalog metadata. The `validateBlockChildTypes` superRefine validates instance children against the catalog's `allowed_child_types` at parse time but never writes catalog metadata into the instance tree.

### 3.3 Bundle ↔ Document Block Serialisation

`ThemeDocumentBlock.children[]` (array, ordered) ↔ `ThemeBundleTemplateBlock.blocks` (keyed Record) + `ThemeBundleTemplateBlock.block_order` (ordered id array).

Conversion:
- `docBlockToBundleBlock`: iterates `block.children` in array order, assigns `blocks[child.id]` = recursive result, pushes `child.id` into `block_order`.
- `bundleBlockToDocBlock`: iterates `block_order` → `block.blocks[id]` → recursive result, producing ordered `children[]`.

This mirrors the section-level `sections` Record + `section_order` pattern from the bundle format.

### 3.4 `sub_blocks` in Liquid

The renderer threads rendered child block HTML into the parent block's Liquid drop:

```liquid
{% for sub in block.sub_blocks %}
  {{ sub.content }}
{% endfor %}
```

Each `sub_blocks[]` entry has: `id`, `type`, `settings`, `content`/`html`, `is_app_block`.

Child blocks are rendered first (pre-order recursion); the parent's Liquid template receives the rendered children as `sub_blocks`. Crash-isolation applies per child — a failing child leaves `sub_blocks[].content = ''` rather than propagating the error to the parent.

---

## 4. Constraints

### 4.1 Foreign WIP Files

`editor/page.tsx` is a FOREIGN WIP FILE and is intentionally NOT touched by Phase T. The three child callbacks (`onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`) are optional on `SectionTreePanel`; `page.tsx` can continue to function without wiring them.

`apps/merchant-control-plane/src/app/globals.css` is a FOREIGN WIP FILE. Phase T adds `theme-os-tree-block--depth-N` CSS modifier classes for indentation but these are applied by `BlockChildRow` via the existing `theme-os-tree-block` class infrastructure and do not require new CSS rules to function (indentation is achieved via padding tokens in the component).

### 4.2 Design System Ratchet

- No `rounded-[Npx]` raw-pixel radius.
- No raw hex or pixel values in `BlockChildRow.tsx`.
- All spacing via `--lb-space-*` tokens or existing `theme-os-tree-block` class structure.
- Imports from `@letbuyy/ui` only — no direct package imports.

### 4.3 RISK-DUAL-N01

Phase T MUST NOT add any mutation path for `section_definitions` or `block_definitions`. The child callbacks (`onAddChildBlock`, `onRemoveChildBlock`, `onMoveChildBlock`) operate on the instance tree (`template.sections[].blocks[].children`) via the existing `applyChange()` + `buildDraftConfig()` path. No callback writes to `baseConfig`-owned fields.

### 4.4 RISK-SEC-P01

No client-side realtime subscription over `theme_editor_drafts` is added in Phase T. The risk remains bounded to the gateway service-role path.

### 4.5 Pre-Stack Depth Guard (deferred finding)

`ThemeBundleTemplateBlockSchema` uses `z.lazy()` recursion. A deeply crafted input could overflow the call stack during Zod's `_parse` phase before the `superRefine` depth check fires. A pre-Zod structural depth check has not been added in Phase T. This is a known residual (RISK-T01) documented in the risk register and in PHASE_T_SECURITY_REVIEW.md.

---

## 5. Test Strategy

Both lanes use `node:test` + `node:assert/strict` static source-contract tests. No Next.js, no DB, no network. Tests read source with `fs.readFileSync` and assert against source patterns or parsed exports.

Lane A additionally includes behavioral tests that exercise `parseThemeDocument`, `parseLiquidThemePackageBundle`, and the renderer with real nested block fixtures.

**Gate entering Phase T (Phase S exit):**
- merchant-control-plane: **93/93**
- theme-engine: **1048/1048**
- storefront-runtime: **795/795**
- api-gateway: **479/479**
- All typechecks: clean

**Gate exiting Phase T:**
- merchant-control-plane: **120/120** (+27)
- theme-engine: **1063/1063** (+15 new nested-blocks tests; NOTE: 1048 + 15 = 1063; the implementations note "1063 pass" with "15 new nested-blocks tests" — the test file has 18 `test()` calls; the remaining 3 are nested under `describe` blocks)
- api-gateway: **479/479** (unchanged)
- storefront-runtime: **795/795** (unchanged)
- All typechecks: clean

**Pre-existing failures:** 3 (merchant AI route, executive analytics migration, storefront-runtime payment route) — unchanged from Phase S. None introduced by Phase T.
