# Phase T Discovery — Nested Blocks: Existing Surface and Gaps

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** T — Section Groups and Nested Blocks
**Date authored:** 2026-07-11
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase T's discovery catalogued every schema, adapter, renderer, and UI surface that existed for blocks entering Phase T, to determine exactly what was already modelled (Phase N structure + comment), what had a fail-closed placeholder (Phase N guard), and what needed net-new implementation. The goal was to draw the line between "safe pre-existing WIP" and "changes Phase T must own."

---

## 2. Block Model Entering Phase T

### 2.1 `ThemeDocumentBlock` — Document Layer

**Source:** `packages/theme-engine/src/theme-document.ts:141`

```typescript
export interface ThemeDocumentBlock {
  id: string;
  type: string;
  settings: Record<string, ThemeBundleJson>;
  disabled: boolean;
  children: ThemeDocumentBlock[];   // ← recursive; modelled in Phase N
}
```

`ThemeDocumentBlockSchema` was already a `z.lazy()` recursive schema with `children: z.array(ThemeDocumentBlockSchema).max(MAX_BLOCK_COUNT_PER_LEVEL).default([])`. The schema accepted children; the depth cap at `MAX_BLOCK_NESTING_DEPTH=3` in `ThemeDocumentSectionSchema.superRefine` was already in place.

**Gap entering Phase T:** `fromThemeDocumentV2` had a fail-closed guard (lines 560–573 in pre-Phase-T source) that threw `UnsupportedThemeDocumentFeatureError` if any block had `children.length > 0`. The document layer modelled the structure but the adapter refused to serialise it to a bundle. Phase T's mandate was to remove the guard and implement the full recursive serialisation path.

### 2.2 `ThemeBundleTemplateBlock` — Bundle Layer (FLAT entering Phase T)

**Source:** `packages/theme-engine/src/theme-bundle.ts:286`

Pre-Phase-T shape (strictly flat):
```typescript
{ type: string; settings: Record<string, ThemeBundleJson>; disabled: boolean }
```

`ThemeBundleTemplateBlockSchema` was `.strict()` with no `blocks` or `block_order` fields. A bundle containing a nested block tree would fail schema validation before reaching any application code.

### 2.3 `BlockModel` — API / SDK Layer

**Source:** `packages/theme-engine/src/index.ts:138`

```typescript
export interface BlockModel {
  id: string; type: string; order: number;
  rendererKey?: string; schemaVersion?: string;
  settings: Record<string, unknown>; isVisible: boolean;
  // children field absent
}
```

No `children` field. `SectionModel.blocks?: BlockModel[]` was the only nesting point, and it was flat.

### 2.4 `ThemeLiquidReusableBlockSchema` — Block-Type Catalog Entry

**Source:** `packages/theme-engine/src/theme-bundle.ts:218`

```typescript
{
  type: string; name: string;
  limit?: number | null;
  schema: { fields: ..., blocks: ..., settings?: ... };
}
```

No `allowed_child_types` field. Block-type definitions had no mechanism to restrict which child block types could nest under them.

---

## 3. Renderer Surface Entering Phase T

**Source:** `packages/theme-engine/src/theme-renderer.ts`

`renderLiquidSectionBlocks` iterated over `Object.values(section.blocks)` in a flat loop. No `depth` parameter, no recursion, no `sub_blocks` threading into the parent block's Liquid drop.

The `LiquidRenderedBlock` type had no `sub_blocks` field; the Liquid scope exposed `block.settings` and `block.schema` but not a child block array.

---

## 4. Editor Surface Entering Phase T

**Source:** `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`

`BlockEntry` type (lines 49–58):
```typescript
type BlockEntry = {
  id: string; type: string; order: number;
  visible: boolean; settings: JsonRecord;
  // no children field
}
```

`TreeSectionRow` rendered a flat `.theme-os-tree-blocks` div containing a `Button` per `BlockEntry`. No recursion, no `BlockChildRow` component, no child-operation callbacks.

`SectionTreePanelProps` had no `onAddChildBlock`, `onRemoveChildBlock`, or `onMoveChildBlock` callbacks.

**RISK-R01 (Phase R):** `BlockEntry`, `SectionEntry`, `EditorState`, `EditorSelection`, `AvailableSection` were duplicated as local types in both `SectionTreePanel.tsx` and `editor/page.tsx`. Phase T was the targeted resolution for this drift risk.

---

## 5. Gap Summary

| Surface | State entering Phase T | Phase T work |
|---|---|---|
| `ThemeDocumentBlock.children` | Modelled in schema; `fromThemeDocumentV2` refused to serialise (fail-closed guard) | Remove guard; implement recursive `docBlockToBundleBlock` helper |
| `ThemeBundleTemplateBlockSchema` | Flat, `.strict()`, no `blocks`/`block_order` fields | Make self-recursive via `z.lazy()`; add `blocks` + `block_order`; add depth `superRefine` |
| `ThemeLiquidReusableBlockSchema` | No `allowed_child_types` | Add optional `allowed_child_types?: string[]` |
| `ThemeDocumentSchema.superRefine` | Validates block types in section; no child-type check | Add `validateBlockChildTypes` pass (§5 of the section loop) |
| `renderLiquidSectionBlocks` | Flat loop, no depth, no `sub_blocks` | Add `depth` param, recurse when `depth < RENDERER_MAX_BLOCK_DEPTH`, thread `sub_blocks` into Liquid drop |
| `BlockModel` | No `children` field | Add `children?: BlockModel[]` (optional, additive) |
| `BlockEntry` (editor) | No `children` field | Add `children?: BlockEntry[]` (optional, additive) |
| `SectionTreePanel` | Inline flat block map, no child callbacks | Add `onAddChildBlock`/`onRemoveChildBlock`/`onMoveChildBlock` props; delegate block rendering to `BlockChildRow` |
| `BlockChildRow` | Did not exist | New component with depth-guarded self-recursion |
| Nested-block tests | Did not exist | New `theme-document-nested-blocks.test.ts` (18 tests) + `theme-editor-t.test.mjs` (27 tests) |

---

## 6. Pre-Existing WIP Accounting

The following Phase T source changes were already present in the working tree as pre-committed WIP on the branch at discovery time (not authored by this documentation phase):

- `packages/theme-engine/src/theme-document.ts`: Phase N fail-closed guard comment at line 653 (guard removed); `bundleBlockToDocBlock` and `docBlockToBundleBlock` recursive helpers; `validateBlockChildTypes` function; §5 superRefine call; `MAX_BLOCK_NESTING_DEPTH=3` (already existed from Phase N).
- `packages/theme-engine/src/theme-bundle.ts`: `ThemeBundleTemplateBlock` interface with `blocks`/`block_order`; `ThemeBundleTemplateBlockSchema` self-recursive via `z.lazy()`; `MAX_BUNDLE_BLOCK_NESTING_DEPTH=3`; `allowed_child_types` on `ThemeLiquidReusableBlockSchema`; depth `superRefine` in `ThemeBundleTemplateSectionSchema`.
- `packages/theme-engine/src/theme-renderer.ts`: `RENDERER_MAX_BLOCK_DEPTH=3`; `depth` parameter on `renderLiquidSectionBlocks`; recursive child rendering with `sub_blocks` threading; `LiquidRenderedBlock.sub_blocks?: LiquidRenderedBlock[]`.
- `packages/theme-engine/src/index.ts`: `BlockModel.children?: BlockModel[]` (comment says `Phase T`).
- `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx`: `BlockEntry.children?: BlockEntry[]`; three optional child callbacks on props; `BlockChildRow` import and usage.
- `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx`: new file.
- `apps/merchant-control-plane/tests/theme-editor-t.test.mjs`: new file.
- `packages/theme-engine/test/theme-document-nested-blocks.test.ts`: new file.

The documentation phase's work was to verify all claims against the actual source, write the phase docs, and update the permanent docs (EDITOR_GUIDE, PROGRAM_STATE, RISK_REGISTER, API_CONTRACTS).
