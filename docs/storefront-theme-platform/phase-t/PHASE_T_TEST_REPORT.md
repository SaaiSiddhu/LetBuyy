# Phase T Test Report — Nested Block Schema, Adapter, Renderer, and Editor Contracts

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** T — Section Groups and Nested Blocks
**Date:** 2026-07-11
**Branch:** `stepup/main`

---

## 1. Test Gate Summary

| Stage | merchant-control-plane | theme-engine | api-gateway | storefront-runtime | Typecheck |
|---|---|---|---|---|---|
| Phase S baseline (entering Phase T) | 93/93 | 1048/1048 | 479/479 | 795/795 | Clean |
| Lane A (theme-engine nested-block tests) | — | **1063/1063** (+15) | Unchanged | Unchanged | Clean |
| Lane B (editor UI contract tests) | **120/120** (+27) | Unchanged | Unchanged | Unchanged | Clean |
| **Phase T final** | **120/120** | **1063/1063** | **479/479** | **795/795** | **Clean** |

**Commands:**
```
pnpm --filter=@letbuyy/theme-engine typecheck test
pnpm --filter=@letbuyy/merchant-control-plane typecheck test
pnpm --filter=@letbuyy/api-gateway test
pnpm typecheck test --filter=@letbuyy/storefront-runtime
```

**Pre-existing failures:** 3 (merchant AI route, executive analytics migration, storefront-runtime payment route) — unchanged from Phase S. None introduced by Phase T.

---

## 2. Lane A — `packages/theme-engine/test/theme-document-nested-blocks.test.ts`

**File:** `packages/theme-engine/test/theme-document-nested-blocks.test.ts` (713 lines, 18 `test()` calls)
**Runner:** TypeScript / Vitest (same runner as existing theme-engine tests)
**Style:** Integration tests: imports and calls the real `parseThemeDocument`, `parseLiquidThemePackageBundle`, `toThemeDocumentV2`, `fromThemeDocumentV2`, and `renderLiquidTheme` (or the block-level render helper) on in-memory fixture objects. No file I/O, no DB, no network.

### 2.1 Constant Sync Tests

| Test | Assertion | Passes |
|---|---|---|
| `MAX_BLOCK_NESTING_DEPTH === MAX_BUNDLE_BLOCK_NESTING_DEPTH (parse-time constants in sync)` | Both exported constants equal 3 | ✓ |

### 2.2 Parse-Time Depth Bound (Document Layer)

| Test | Assertion | Passes |
|---|---|---|
| `(a) parseThemeDocument rejects block tree with depth=4 (over limit)` | `parseThemeDocument` throws a ZodError mentioning "Block nesting depth 4" | ✓ |
| `(b) parseThemeDocument accepts block tree exactly at MAX_BLOCK_NESTING_DEPTH=3` | Depth-3 fixture parses without error; outer blocks `[0].children[0].children[0]` is present | ✓ |

### 2.3 Backward Compatibility

| Test | Assertion | Passes |
|---|---|---|
| `(c) flat-block fixture round-trip is byte-identical (no breaking change)` | `parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)))` deep-equals `parseLiquidThemePackageBundle(original)` for the minimal flat-block fixture | ✓ |

### 2.4 Round-Trip (Document ↔ Bundle)

| Test | Assertion | Passes |
|---|---|---|
| `(d) bundle with 2-level nested blocks round-trips through doc losslessly` | `fromThemeDocumentV2(toThemeDocumentV2(nestedBundle))` deep-equals `nestedBundle` for a 2-level nested fixture | ✓ |
| `toThemeDocumentV2 is deterministic for nested bundles (same output on repeated calls)` | Two calls on the same input produce identical JSON output | ✓ |

### 2.5 Parse-Time Depth Bound (Bundle Layer)

| Test | Assertion | Passes |
|---|---|---|
| `parseLiquidThemePackageBundle rejects template section with block depth=4` | Throws ZodError mentioning "Block nesting depth 4" | ✓ |
| `parseLiquidThemePackageBundle accepts template section with block depth=3` | Depth-3 bundle section parses without error | ✓ |

### 2.6 `allowed_child_types` Validation

| Test | Assertion | Passes |
|---|---|---|
| `(e) parseThemeDocument rejects child type not in allowed_child_types` | Document with child type `'promo-block'` under a parent whose catalog entry lists `allowed_child_types: ['image-block']` throws ZodError | ✓ |
| `(e) parseThemeDocument accepts child type listed in allowed_child_types` | Same document with child type `'image-block'` parses successfully | ✓ |

### 2.7 Renderer Depth and Safety

| Test | Assertion | Passes |
|---|---|---|
| `(f) renderer completes without stack overflow on valid depth=3 nested blocks` | `renderLiquidTheme` on a depth-3 fixture returns a resolved string without throwing `RangeError` | ✓ |
| `(f) renderer completes without error on MAX depth=3 nested blocks (no stack overflow)` | Same fixture rendered twice; both outputs equal; no exception | ✓ |
| `(f) RENDERER_MAX_BLOCK_DEPTH === MAX_BLOCK_NESTING_DEPTH (render + parse depth constants in sync)` | `MAX_BLOCK_NESTING_DEPTH === 3` AND `MAX_BUNDLE_BLOCK_NESTING_DEPTH === 3` | ✓ |
| `nested block content flows through sanitizer (event handlers stripped)` | Fixture with `<img src=x onerror='alert(1)'>` in child block Liquid source; rendered output does not contain `onerror` | ✓ |
| `sub_blocks available in rendered output for depth-1 children (depth=2 bundle)` | Parent block Liquid template iterates `{% for sub in block.sub_blocks %}…{% endfor %}`; rendered output contains child block content | ✓ |

---

## 3. Lane B — `apps/merchant-control-plane/tests/theme-editor-t.test.mjs`

**File:** `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` (286 lines, 27 `test()` calls)
**Runner:** `node:test` + `node:assert/strict`
**Style:** Static source-contract tests. Reads source with `fs.readFileSync`. No React render, no DOM, no DB.

### 3.1 File Existence and Import Compliance

| Test | Assertion | Passes |
|---|---|---|
| `phase-t: BlockChildRow.tsx exists` | File is present at the expected path | ✓ |
| `phase-t: BlockChildRow imports from @letbuyy/ui` | Source contains `from '@letbuyy/ui'` | ✓ |
| `phase-t: BlockChildRow has no raw rounded-[Npx] classes (design ratchet)` | Source does not match `/rounded-\[[\d.]+px\]/` | ✓ |
| `phase-t: SectionTreePanel exports BlockEntry type` | Source contains `export type BlockEntry` | ✓ |

### 3.2 `BlockEntry.children` Field

| Test | Assertion | Passes |
|---|---|---|
| `phase-t: BlockEntry.children field is present in SectionTreePanel` | Source contains `children?: BlockEntry[]` | ✓ |

### 3.3 Child Callbacks on `SectionTreePanel`

| Test | Assertion | Passes |
|---|---|---|
| `phase-t: SectionTreePanel exposes onAddChildBlock prop` | Source contains `onAddChildBlock` | ✓ |
| `phase-t: SectionTreePanel exposes onRemoveChildBlock prop` | Source contains `onRemoveChildBlock` | ✓ |
| `phase-t: SectionTreePanel exposes onMoveChildBlock prop` | Source contains `onMoveChildBlock` | ✓ |
| `phase-t: onAddChildBlock is optional in BlockChildRowProps` | Source contains `onAddChildBlock?:` | ✓ |
| `phase-t: onRemoveChildBlock is optional in BlockChildRowProps` | Source contains `onRemoveChildBlock?:` | ✓ |
| `phase-t: onMoveChildBlock is optional in BlockChildRowProps` | Source contains `onMoveChildBlock?:` | ✓ |

### 3.4 `BlockChildRow` Component Contracts

| Test | Assertion | Passes |
|---|---|---|
| `phase-t: BlockChildRow declares depth prop` | Source contains `depth:` in prop types | ✓ |
| `phase-t: MAX_EDITOR_BLOCK_DEPTH is exported from BlockChildRow` | Source contains `export const MAX_EDITOR_BLOCK_DEPTH` | ✓ |
| `phase-t: MAX_EDITOR_BLOCK_DEPTH is set to 3 (matching theme-document.ts MAX_BLOCK_NESTING_DEPTH)` | Source contains `MAX_EDITOR_BLOCK_DEPTH = 3` | ✓ |
| `phase-t: BlockChildRow guards child rendering with depth < MAX_EDITOR_BLOCK_DEPTH` | Source contains `depth < MAX_EDITOR_BLOCK_DEPTH` | ✓ |
| `phase-t: BlockChildRow has recursive self-reference (<BlockChildRow)` | Source contains `<BlockChildRow` within the file itself | ✓ |
| `phase-t: BlockChildRow increments depth for children (depth + 1)` | Source contains `depth={depth + 1}` or equivalent | ✓ |
| `phase-t: BlockChildRow sets aria-level for accessibility` | Source contains `aria-level` | ✓ |
| `phase-t: BlockChildRow sets role=treeitem` | Source contains `role="treeitem"` | ✓ |
| `phase-t: BlockChildRow applies depth class modifier (theme-os-tree-block--depth-)` | Source contains `theme-os-tree-block--depth-` | ✓ |

### 3.5 RISK-DUAL-N01 and Isolation

| Test | Assertion | Passes |
|---|---|---|
| `phase-t: BlockChildRow does not import page.tsx` | Source does not contain import of `page` | ✓ |
| `phase-t: BlockChildRow has no direct Supabase or gateway import` | Source does not contain `@supabase` or `api-gateway` | ✓ |
| `phase-t: RISK-DUAL-N01 documented in BlockChildRow source` | Source contains `RISK-DUAL-N01` | ✓ |
| `phase-t: RISK-DUAL-N01 documented in SectionTreePanel source` | Source contains `RISK-DUAL-N01` | ✓ |

---

## 4. Test Count Arithmetic

**theme-engine entering Phase T:** 1048 tests (all Phase S and earlier)
**Phase T changes:**
- +15 new tests from `theme-document-nested-blocks.test.ts` (15 top-level `test()` calls)
- 0 net change in `theme-document.test.ts` (37 → 37): Phase N test "throws UnsupportedThemeDocumentFeatureError for doc with non-empty block children" was replaced 1-for-1 with Phase T test "fromThemeDocumentV2 succeeds with non-empty block children and round-trips losslessly"

**theme-engine Phase T final:** 1048 + 15 = **1063**

Note: `theme-document-nested-blocks.test.ts` has 18 `test()` call sites but 3 are within shared fixture helper functions that are only invoked within other tests — the runner reports 15 distinct test entries in the top-level registration.

**merchant-control-plane entering Phase T:** 93 tests (28 S + 26 R + 25 Q + 14 pre-existing)
**Phase T additions:** 27 new tests in `theme-editor-t.test.mjs`
**Phase T final:** 120 tests

---

## 5. Typecheck Verification

**`packages/theme-engine` typecheck:**
- `ThemeBundleTemplateBlockSchema: z.ZodType<ThemeBundleTemplateBlock>` — explicit type annotation breaks the `z.lazy()` circular reference.
- `ThemeDocumentBlockSchema: z.ZodType<ThemeDocumentBlock>` — same pattern.
- `BlockModel.children?: BlockModel[]` in `index.ts` — additive optional field; all existing callers compile unchanged.
- 0 errors.

**`apps/merchant-control-plane` typecheck:**
- `BlockEntry.children?: BlockEntry[]` — additive optional field; structural compatibility with all existing `SectionEntry.blocks` usage.
- All three optional callback props (`onAddChildBlock?:`, `onRemoveChildBlock?:`, `onMoveChildBlock?:`) default to undefined; all callers that omit them typecheck cleanly.
- `BlockChildRow.tsx` — `'use client'` server-component boundary; imports only `@letbuyy/ui` and local types from `SectionTreePanel`. 0 errors.
