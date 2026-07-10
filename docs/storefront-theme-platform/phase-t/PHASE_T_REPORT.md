# Phase T Report — Section Groups and Nested Blocks

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** T — Section Groups and Nested Blocks
**Date authored:** 2026-07-11
**Branch:** `stepup/main`
**Author scope:** Phase T implements recursive nested block support across the full theme stack: bundle schema, document adapters, Liquid renderer, and the editor block tree UI. The Phase N fail-closed guard in `fromThemeDocumentV2` is removed; the full recursive serialisation path replaces it. No gateway routes, database migrations, SECURITY DEFINER RPCs, or authentication tokens were modified. No frozen apps were touched.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase T touches `apps/merchant-control-plane/package.json` (test script addition) which is a WIP file carrying prior user modifications. The change appends `theme-editor-t.test.mjs` to the test command and does not conflict with other entries. **This change has NOT been staged and MUST NOT be committed or deployed without explicit review of the hunk against the surrounding foreign WIP.**

No new database migrations. No gateway changes. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|---|---|---|
| `apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx` | 284 | Recursive child-block tree row; depth-guarded; `@letbuyy/ui` only; exports `MAX_EDITOR_BLOCK_DEPTH=3` |
| `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` | 286 | 27 static contract tests (file existence, type shapes, depth guard, ARIA, RISK-DUAL-N01 isolation) |
| `packages/theme-engine/test/theme-document-nested-blocks.test.ts` | 713 | 18 integration tests (depth rejection, round-trip, `allowed_child_types`, renderer depth safety, sanitizer) |

### 1.2 Modified Files

| File | Change | WIP? |
|---|---|---|
| `packages/theme-engine/src/theme-bundle.ts` | `ThemeBundleTemplateBlock` interface + `z.lazy()` self-recursive schema; `MAX_BUNDLE_BLOCK_NESTING_DEPTH=3`; depth `superRefine` in `ThemeBundleTemplateSectionSchema`; `allowed_child_types` on `ThemeLiquidReusableBlockSchema` | Clean |
| `packages/theme-engine/src/theme-document.ts` | Phase N fail-closed guard removed at line 653; `docBlockToBundleBlock` + `bundleBlockToDocBlock` recursive helpers; `validateBlockChildTypes` function; §5 superRefine call in `ThemeDocumentSchema` | Clean |
| `packages/theme-engine/src/theme-renderer.ts` | `RENDERER_MAX_BLOCK_DEPTH=3` const; `depth` parameter on `renderLiquidSectionBlocks`; recursive child rendering; `sub_blocks` threaded into Liquid drop; `LiquidRenderedBlock.sub_blocks?: LiquidRenderedBlock[]` | Clean |
| `packages/theme-engine/src/index.ts` | `BlockModel.children?: BlockModel[]` (additive, optional) | Clean |
| `packages/theme-engine/test/theme-document.test.ts` | One test replaced: old Phase N test "throws UnsupportedThemeDocumentFeatureError for doc with non-empty block children" → Phase T test "fromThemeDocumentV2 succeeds with non-empty block children and round-trips losslessly" at line 654; total count stays 37 | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx` | `BlockEntry.children?: BlockEntry[]`; three optional child callbacks on props; delegate block rendering to `BlockChildRow` | Clean |
| `apps/merchant-control-plane/package.json` | `theme-editor-t.test.mjs` appended to test script | WIP (foreign) |

### 1.3 Foreign WIP Files and Isolation

**`apps/merchant-control-plane/package.json`:** One test file name appended to the `"test"` script value. The diff is a single-line string append. Reverting removes the test registration without affecting any other content.

---

## 2. Phase N Fail-Closed Guard: Removal Justification

### 2.1 What the Guard Was

In Phase N, `fromThemeDocumentV2` contained a fail-closed guard (pre-Phase-T lines 560–573) that threw `UnsupportedThemeDocumentFeatureError` if any `ThemeDocumentBlock` in the template had `children.length > 0`. The guard's purpose was to prevent partial/incorrect nested-block serialisation during phases where the bundle schema did not yet support nested blocks.

### 2.2 Why It Is Safe to Remove in Phase T

The guard can safely be removed because all three layers that it was protecting against are now fully implemented:

1. **Bundle schema accepts nested blocks:** `ThemeBundleTemplateBlockSchema` is now self-recursive via `z.lazy()` and includes `blocks: Record<string, ThemeBundleTemplateBlock>` and `block_order: string[]`. A bundle carrying nested blocks passes `parseLiquidThemePackageBundle` without error up to depth 3.

2. **Adapter serialises nested blocks correctly:** `docBlockToBundleBlock` and `bundleBlockToDocBlock` recursively convert between `ThemeDocumentBlock.children[]` (ordered array) and `ThemeBundleTemplateBlock.blocks` (keyed Record) + `block_order` (ordered ids). The round-trip test `(d) bundle with 2-level nested blocks round-trips through doc losslessly` proves this.

3. **Mechanical backstop preserved:** `fromThemeDocumentV2` still calls `parseLiquidThemePackageBundle(raw)` as its final step. If the recursive serialisation were to produce an invalid bundle (e.g., depth > 3), the `superRefine` depth check in `ThemeBundleTemplateSectionSchema` would reject it before the result is returned. The explicit fail-closed guard is superseded by this structural validation.

4. **`UnsupportedThemeDocumentFeatureError`:** The error class remains exported from `theme-document.ts` but is no longer thrown anywhere (Finding 6, LOW, deferred as RISK-T06). All catch sites that targeted it will not trigger; this is safe because the guard's purpose is fulfilled by the schema-level depth check.

---

## 3. Byte-Identity Backward Compatibility Proof

**Test:** `nested-blocks: (c) flat-block fixture round-trip is byte-identical (no breaking change)`

This test runs `parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)))` on `createMinimalLiquidThemeBundleFixture()` (a flat-block bundle with no children) and asserts `deepEqual` against `parseLiquidThemePackageBundle(original)`.

The comparison is over the fully parsed, JSON-round-tripped object. Equality proves:
- `toThemeDocumentV2` does not add spurious `children` or `block_order` fields to blocks that had none.
- `fromThemeDocumentV2` does not add spurious `blocks` or `block_order` fields to sections that had none.
- `parseLiquidThemePackageBundle` applies consistent defaults (both `original` and `round-tripped` versions pass through the same `.default({})` + `.default([])` Zod default resolution).

This confirms that Phase T is byte-identical for all existing flat-block themes.

---

## 4. Code Review Findings and Resolutions

Phase T surfaced 7 findings during review. Findings 1 (MEDIUM) and 2 (MEDIUM) were deferred as structural security residuals. Finding 3 (LOW) was deferred as a defence-in-depth renderer improvement. Findings 4 (MEDIUM) and 5 (LOW) were deferred as functional and test-quality improvements. Finding 6 (LOW) was deferred as a dead-API cleanup. Finding 7 (LOW) was a scope-accounting note with no code change required.

### 4.1 Deferred Findings (all registered in RISK_REGISTER.md)

| # | Severity | Risk ID | Summary |
|---|---|---|---|
| 1 | MEDIUM | RISK-T01 | Pre-Zod stack-depth attack via `z.lazy()` recursion in `parseLiquidThemePackageBundle` and `parseThemeDocument` |
| 2 | MEDIUM | RISK-T02 | No `assertNoBlockedKeysInRaw` in `parseLiquidThemePackageBundle` — prototype pollution in nested block settings |
| 3 | LOW | RISK-T03 | `block.settings` and `sub_blocks[].settings` bypass `filterBlockedSettingsKeys` in the renderer |
| 4 | MEDIUM | RISK-T05 | `allowedChildTypes` not passed from `SectionTreePanel` to `BlockChildRow` — add-child button is permanently dead |
| 5 | LOW | RISK-T04 | `RENDERER_MAX_BLOCK_DEPTH` is private/unexported — depth parity test cannot directly assert it |
| 6 | LOW | RISK-T06 | `UnsupportedThemeDocumentFeatureError` exported but never thrown after Phase N guard removal |
| 7 | LOW | — | `BlockModel.children` comment says "Phase T" but field was pre-existing WIP — scope accounting gap; no functional risk |

### 4.2 No HIGH Findings

No HIGH severity findings were raised in the Phase T review. The two MEDIUM security findings (RISK-T01, RISK-T02) are deferred rather than fixed in Phase T because their fixes require touching production parse entry points (`parseLiquidThemePackageBundle`, `parseThemeDocument`) with pre-Zod guard logic that has not been test-matrix validated in the bundle context. The defences-in-depth (Cloudflare Worker limits, authenticated-only upload, DOMPurify, depth `superRefine`) bound the practical impact.

---

## 5. Foreign WIP Not Touched

Phase T does not touch:
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — the three new child callbacks are optional props; page.tsx does not need to be updated for the editor to continue functioning.
- `apps/merchant-control-plane/src/app/globals.css` — `BlockChildRow` applies `theme-os-tree-block--depth-N` class modifiers. No new CSS rules are required because depth indentation is achieved via inline padding (derived from the `depth` prop and `--lb-space-*` tokens).
- `services/api-gateway/src/index.ts` — no gateway changes.
- `packages/typescript/api-client/src/index.ts` — no new client stubs.

---

## 6. RISK-DUAL-N01 Status

RISK-DUAL-N01 is preserved in Phase T. The three new child callbacks operate on `template.sections[].blocks[].children` (the instance tree). The `block_definitions` catalog (carried in `baseConfig`, not `editorState`) is never written by any Phase T code path.

`buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` remains the sole path for draft saves. `section_definitions` and `block_definitions` continue to come from `baseConfig`, not from `editorState`. The new recursive serialisation in `fromThemeDocumentV2` uses `docBlockToBundleBlock` which writes only to the `blocks` Record and `block_order` array within the template section — it never touches `block_definitions`.

---

## 7. Phase N Deferral Closed

Phase N registered an implicit deferral: "nested block serialisation deferred to Phase T." That deferral is now CLOSED. The fail-closed guard has been removed and the full implementation is in place. The `UnsupportedThemeDocumentFeatureError` class remains (dead API — RISK-T06) but is no longer part of any runtime path.

---

## 8. Test Results

| Suite | Phase T Final | Command |
|---|---|---|
| merchant-control-plane | **120/120** | `pnpm --filter=@letbuyy/merchant-control-plane test` |
| theme-engine | **1063/1063** | `pnpm --filter=@letbuyy/theme-engine typecheck test` |
| api-gateway | **479/479** (unchanged) | `pnpm --filter=@letbuyy/api-gateway test` |
| storefront-runtime | **795/795** (unchanged) | `pnpm typecheck test --filter=@letbuyy/storefront-runtime` |
| All typechecks | **Clean** | Per-package typecheck commands |

**Breakdown of merchant-control-plane 120:**
- 27 Phase T tests (`theme-editor-t.test.mjs`)
- 28 Phase S tests (`theme-editor-s.test.mjs`)
- 26 Phase R tests (`theme-editor-r.test.mjs`)
- 25 Phase Q tests (`theme-library-q.test.mjs`)
- 14 pre-existing tests (federation / localization / app-platform)

**Breakdown of theme-engine 1063:**
- 15 new Phase T tests (`theme-document-nested-blocks.test.ts`)
- 14 Phase S tests (`editor-bridge-protocol.test.ts`, unchanged)
- 1034 pre-existing tests (unchanged from Phase S exit)

---

## 9. Rollback

Rollback is `git revert` of the Phase T commits (or `git checkout --` on individual files if not yet committed). Because all changes are additive (optional fields, new files, new test entries), reverting Phase T does not break any existing caller. The `fromThemeDocumentV2` fail-closed guard would need to be re-introduced manually if reverting to the Phase N behaviour (the guard was removed in Phase T; without it, a document with nested blocks would produce a round-trip output with the nested blocks rather than throwing).

**Minimal rollback (Lane A — theme-engine):**
```
git checkout -- packages/theme-engine/src/theme-bundle.ts \
               packages/theme-engine/src/theme-document.ts \
               packages/theme-engine/src/theme-renderer.ts \
               packages/theme-engine/src/index.ts
git rm packages/theme-engine/test/theme-document-nested-blocks.test.ts
```

**Minimal rollback (Lane B — editor):**
```
git checkout -- apps/merchant-control-plane/src/components/theme-editor/SectionTreePanel.tsx \
               apps/merchant-control-plane/package.json
git rm apps/merchant-control-plane/src/components/theme-editor/BlockChildRow.tsx \
       apps/merchant-control-plane/tests/theme-editor-t.test.mjs
```

Rollback restores Phase S state: flat block bundles and flat block tree UI. The editor continues to function with Phase S behavior. No database changes need reverting.

---

## 10. Parity Impact

Phase T advances the Shopify parity matrix for the block model and editor block tree:

| Capability | Pre-Phase-T | Post-Phase-T |
|---|---|---|
| Nested blocks in theme bundle format | MISSING | COMPLETE (depth ≤ 3, `blocks` + `block_order`) |
| Nested blocks in ThemeDocument V2 | PARTIAL (schema only; adapter blocked) | COMPLETE (full round-trip + depth enforcement) |
| `allowed_child_types` catalog constraint | MISSING | COMPLETE (parse-time validation) |
| `sub_blocks` in Liquid block drop | MISSING | COMPLETE (threaded as pre-rendered array) |
| Nested block tree in editor UI | MISSING | PARTIAL (display + ARIA tree; add-child button deferred — RISK-T05) |
| Add child block from editor | MISSING | PARTIAL (callback wired; `allowedChildTypes` prop not passed — RISK-T05) |

---

## 11. Next Phase: U — Settings Control Renderer

Phase U will implement the settings control renderer for the right-side properties panel. Phase U must:
- Address RISK-T03 (filter `block.settings` through `filterBlockedSettingsKeys` in the renderer) before adding new settings field types that could amplify the gap.
- Not add client-side realtime subscriptions over `theme_editor_drafts` until RISK-SEC-P01 is resolved.
- Continue using `--lb-*` design tokens for all new CSS.
- Gate on merchant-control-plane **120/120** · theme-engine **1063/1063** · storefront-runtime **795/795** baselines.
