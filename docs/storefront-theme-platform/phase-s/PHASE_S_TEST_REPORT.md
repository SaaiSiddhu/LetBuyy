# Phase S Test Report — Inspector Bridge Contracts, Origin Hardening, and Accessibility

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** S — Live Preview Inspector
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Test Gate Summary

| Stage | merchant-control-plane | storefront-runtime | theme-engine | Typecheck |
|---|---|---|---|---|
| Phase R baseline (entering Phase S) | 65/65 | 762/762 | 1034/1034 | Clean |
| Lane A (editor side) | 89/89 (+24 Phase S) | — | 1048/1048 (+15 protocol) | Clean |
| Lane B (storefront side) | — | 791/791 (+29 inspector-bridge) | Unchanged | Clean |
| Hardening pass | 93/93 (+4 new) | 795/795 (+4 new) | Unchanged | Clean |
| **Phase S final** | **93/93** | **795/795** | **1048/1048** | **Clean** |

**Commands:**
```
pnpm --filter=@letbuyy/merchant-control-plane test
pnpm --filter=@letbuyy/merchant-control-plane typecheck
pnpm --filter=@letbuyy/theme-engine test
pnpm --filter=@letbuyy/theme-engine typecheck
pnpm typecheck test --filter=@letbuyy/storefront-runtime
```

**Pre-existing failures:** 3 (merchant AI route, executive analytics migration, storefront-runtime payment route) — unchanged from Phase R. None introduced by Phase S.

---

## 2. Phase S Test Files

### 2.1 `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` (24 + 4 hardening = 28 tests)

**Runner:** Node.js `node:test` + `node:assert/strict`  
**Style:** Static source-text assertions (`readFileSync`). No Next.js, no DB, no network.  
**Test subject files:** `packages/theme-engine/src/editor-bridge-protocol.ts`, `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx`, `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx`

#### Protocol Constants (Tests 1–5)

| Test | Assertion |
|---|---|
| 1 | Protocol exports `INSPECTOR_SECTION_HOVERED` |
| 2 | Protocol exports `INSPECTOR_HOVER_CLEARED` |
| 3 | Protocol exports `INSPECTOR_ADD_SECTION_INTENT` |
| 4 | Protocol exports `INSPECTOR_SECTION_SCROLLED_TO` |
| 5 | `INSPECTOR_SECTION_SCROLLED_TO` has string value `'letbuyy:inspector:section-scrolled-to'` |

#### New Component Existence and Compliance (Tests 6–8)

| Test | Assertion |
|---|---|
| 6 | `PreviewInspectorOverlay.tsx` exists |
| 7 | `PreviewInspectorOverlay` imports from `@letbuyy/ui` |
| 8 | `PreviewInspectorOverlay` has no `rounded-[Npx]` class (design ratchet) |

#### PreviewInspectorOverlay Accessibility (Test 9)

| Test | Assertion |
|---|---|
| 9 | `PreviewInspectorOverlay` is `aria-hidden` — keyboard selection is owned by the section tree, not by the overlay chip |

#### CenterPanel Protocol Imports (Tests 10–12)

| Test | Assertion |
|---|---|
| 10 | `CenterPanel` imports `INSPECTOR_SECTION_HOVERED` |
| 11 | `CenterPanel` imports `INSPECTOR_HOVER_CLEARED` |
| 12 | `CenterPanel` imports `EDITOR_SCROLL_MESSAGE` |

#### CenterPanel Component Integration (Tests 13–14)

| Test | Assertion |
|---|---|
| 13 | `CenterPanel` imports `PreviewInspectorOverlay` |
| 14 | — (covered by hardening; see below) |

#### PostMessage Security — Receive Guard (Tests 15–16)

| Test | Assertion |
|---|---|
| 15 | `CenterPanel` references `event.origin` and `previewOrigin` in its message handler |
| 16 | `CenterPanel` short-circuits with `!previewOrigin` (rejecting all messages when no preview is configured) |

#### PostMessage Security — Send Side (Tests 17–18)

| Test | Assertion |
|---|---|
| 17 | `CenterPanel` has no bare `'*'` as `postMessage` `targetOrigin` anywhere in the file (whitespace-collapsed source check) |
| 18 | `CenterPanel.postSelectionToPreview` assigns `targetOrigin` from `previewOrigin` |

#### CenterPanel Scroll and Hover Wiring (Tests 19–24)

| Test | Assertion |
|---|---|
| 19 | `CenterPanel` sends `EDITOR_SCROLL_MESSAGE` in a `postMessage` call |
| 20 | `CenterPanel` declares optional `onHoverSection` prop |
| 21 | `CenterPanel` renders `<PreviewInspectorOverlay` in its JSX |
| 22 | `CenterPanel` passes `hoveredSection` to `PreviewInspectorOverlay` |
| 23 | `CenterPanel` calls `setHoveredSection(null)` when `previewUrl` changes (stale chip prevention) |
| 24 | — (covered by hardening; see below) |

#### Foreign WIP Isolation (Test 25)

| Test | Skip condition | Assertion |
|---|---|---|
| 25 | skipped if `page.tsx` does not exist in working tree | `page.tsx` does NOT reference `INSPECTOR_SECTION_HOVERED`, `INSPECTOR_HOVER_CLEARED`, or `PreviewInspectorOverlay` — Phase S must not touch the foreign WIP file |

#### No Supabase in New Component (Test 26)

| Test | Assertion |
|---|---|
| 26 | `PreviewInspectorOverlay` has no `@supabase/`, `createSupabase`, `createMerchantApiClient`, or `merchantApiFetch` imports |

#### Hardening Tests (Tests 27–30)

| Test | Assertion |
|---|---|
| 27 | `CenterPanel` imports `INSPECTOR_ADD_SECTION_INTENT` |
| 28 | `CenterPanel` declares optional `onAddSectionIntent` prop |
| 29 | `CenterPanel.handleMessage` has `case INSPECTOR_ADD_SECTION_INTENT` |
| 30 | `INSPECTOR_ADD_SECTION_INTENT` handler references `adjacentSectionId` and validates `'before'` / `'after'` |

---

### 2.2 `packages/theme-engine/test/editor-bridge-protocol.test.ts` (15 tests)

**Runner:** Vitest (theme-engine test suite)  
**Style:** Pure import + value assertions. No external dependencies.  
**Test subject:** `packages/theme-engine/src/editor-bridge-protocol.ts`

These tests lock the string values of all 11 constants against accidental rename or typo, verify uniqueness across all constants, check the `letbuyy:` namespace prefix on modern constants, and assert the no-echo guard documentation exists.

| Test group | Count | Coverage |
|---|---|---|
| Value contracts for all 7 pre-existing constants | 7 | String equality for each exported constant |
| Value contracts for all 4 new INSPECTOR_* constants | 4 | String equality for each |
| Uniqueness check | 1 | All 11 constant values are distinct (no collision) |
| Namespace assertion | 1 | All `letbuyy:*` constants share the `letbuyy:` prefix |
| No-echo guard documentation | 1 | `INSPECTOR_SECTION_SCROLLED_TO` JSDoc contains `same-window` or equivalent |
| Protocol count | 1 | Exactly 11 constants exported (prevents silent addition without a test) |

---

### 2.3 `tests/theme-engine/inspector-bridge.test.mjs` (29 + 4 hardening = 33 tests)

**Runner:** Node.js `node:test` + `node:assert/strict`  
**Style:** Static source-text assertions (`readFileSync`).  
**Test subject files:** `packages/theme-engine/src/editor-bridge-protocol.ts`, `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`, `apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx`, `apps/storefront-runtime/src/app/globals.css`

#### Protocol Constants (Tests 1–5)

| Test | Assertion |
|---|---|
| 1 | `INSPECTOR_SECTION_HOVERED` has value `'letbuyy:inspector:section-hovered'` |
| 2 | `INSPECTOR_HOVER_CLEARED` has value `'letbuyy:inspector:hover-cleared'` |
| 3 | `INSPECTOR_ADD_SECTION_INTENT` has value `'letbuyy:inspector:add-section-intent'` |
| 4 | `INSPECTOR_SECTION_SCROLLED_TO` has value `'letbuyy:inspector:section-scrolled-to'` |
| 5 | Protocol JSDoc for `INSPECTOR_SECTION_SCROLLED_TO` documents same-window-only constraint |

#### Origin Hardening — `getEditorOrigin()` (Tests 6–8)

| Test | Assertion |
|---|---|
| 6 | Section frame defines `getEditorOrigin()` reading `NEXT_PUBLIC_ADMIN_URL` |
| 7 | Bridge defines `getEditorOrigin()` reading `NEXT_PUBLIC_ADMIN_URL` |
| 8 | Section frame has no `postMessage` call with `'*'` as target (iterates all `postMessage(...)` calls in source) |

#### Origin Hardening — Same-Window vs Cross-Origin (Test 9)

| Test | Assertion |
|---|---|
| 9 | Bridge outbound `window.postMessage` targeting `window.location.origin` is present (same-window selectSection dispatch) |

#### Inbound Origin Validation (Tests 10–11)

| Test | Assertion |
|---|---|
| 10 | Bridge `handleMessage` contains `event.origin !== editorOrigin` |
| 11 | Section frame `handleMessage` contains `event.origin !== window.location.origin` |

#### Hover Wiring (Tests 12–14)

| Test | Assertion |
|---|---|
| 12 | Section frame imports `INSPECTOR_SECTION_HOVERED` and `INSPECTOR_HOVER_CLEARED` |
| 13 | Section frame has `onMouseEnter` handler calling `notifyHover` |
| 14 | Section frame has `onMouseLeave` handler |

#### Flash Wiring (Tests 15–18)

| Test | Assertion |
|---|---|
| 15 | Section frame imports `INSPECTOR_SECTION_SCROLLED_TO` |
| 16 | Section frame listens for `SCROLLED_TO_MESSAGE` and calls flash logic |
| 17 | Storefront globals.css defines `@keyframes sf-section-frame-flash` and `.storefront-editor-section-frame--flash` |
| 18 | — (merged into group below) |

#### Add-Section Intent Wiring (Tests 18–22)

| Test | Assertion |
|---|---|
| 18 | Section frame imports `INSPECTOR_ADD_SECTION_INTENT` |
| 19 | Section frame has `--before` and `--after` insert button CSS classes, `sendAddIntent`, and `'before'` / `'after'` strings |
| 20 | Storefront globals.css defines `.storefront-editor-section-insert`, `--before`, and `--after` |
| 21 | Insert buttons call `stopPropagation` (does not trigger outer section-select on add-intent click) |
| 22 | Insert buttons have `tabIndex=-1` (excluded from tab order; keyboard users use the section tree) |

#### RISK-DUAL-N01 (Test 23)

| Test | Assertion |
|---|---|
| 23 | Section frame never references `template.sections`, `sections.push`, `sections.splice`, or `sections.filter`; and does reference `adjacentSectionId` and `position` (intent-only protocol) |

#### No-Echo Self-Loop Guard (Tests 24–26)

| Test | Assertion |
|---|---|
| 24 | Bridge translation branch still matches only `LEGACY_SELECTION_MESSAGE \|\| SCROLL_MESSAGE` (not `SELECTED_MESSAGE`) |
| 25 | Bridge dispatches `SCROLLED_TO_MESSAGE` to `window.location.origin` after scroll |
| 26 | `type === SCROLLED_TO_MESSAGE` is absent from the bridge translation branch; origin guard exists (`event.origin !== editorOrigin`) |

#### Keyboard Accessibility Not Regressed (Tests 27–28)

| Test | Assertion |
|---|---|
| 27 | Section frame preserves `onKeyDown` handling for `Enter` and `Space` keys (selection via keyboard) |
| 28 | Insert buttons have `tabIndex={-1}` (confirmed again in accessibility context) |

#### Import Hygiene (Tests 29–30)

| Test | Assertion |
|---|---|
| 29 | Bridge imports `INSPECTOR_SECTION_SCROLLED_TO` from `@letbuyy/theme-engine/editor-bridge-protocol`; does not inline the string |
| 30 | Section frame imports all four inspector constants from the shared protocol module; does not inline any `'letbuyy:inspector:'` string |

#### Hardening Tests (Tests 31–34)

| Test | Assertion |
|---|---|
| 31 | Bridge receive guard is fail-closed: `!editorOrigin \|\| event.origin !== editorOrigin` is present; the fail-open pattern `editorOrigin && event.origin !== editorOrigin` is absent |
| 32 | Bridge READY_MESSAGE send does not contain `getEditorOrigin() \|\| '*'` |
| 33 | `selectSection` does NOT pass `type === LEGACY_SELECTION_MESSAGE \|\| type === SCROLL_MESSAGE` as the `shouldScroll` argument; DOES pass `type === SCROLL_MESSAGE` only |
| 34 | Storefront globals.css has `@media (prefers-reduced-motion: reduce)` guard suppressing `.storefront-editor-section-frame--flash` animation |

---

## 3. Accessibility Coverage

Phase S tests enforce the following accessibility properties:

| Property | Component | Test | Notes |
|---|---|---|---|
| `aria-hidden` on inspector overlay | `PreviewInspectorOverlay` | MCP test 9 | Overlay is pointer-enhancement only; keyboard via section tree |
| No `rounded-[Npx]` design ratchet | `PreviewInspectorOverlay` | MCP test 8 | Token-only CSS |
| Insert buttons excluded from tab order (`tabIndex=-1`) | `EditorPreviewSectionFrame` | Bridge tests 21, 28 | Keyboard users use the section tree panel |
| Keyboard selection (`onKeyDown`, `Enter`, `Space`) preserved | `EditorPreviewSectionFrame` | Bridge test 27 | Phase S does not regress prior keyboard selection |
| `prefers-reduced-motion: reduce` guard on flash animation | storefront globals.css | Bridge test 34 | Flash only in editor/preview mode but guard required |

Additional a11y properties implemented and verified by code review (not contracted by tests):

| Property | Evidence |
|---|---|
| `aria-label` on insert buttons (`"Add section before <type>"` / `"Add section after <type>"`) | `EditorPreviewSectionFrame` lines 205, 222 |
| `<span aria-hidden="true">+</span>` inside insert buttons | Prevents `+` from being read by screen reader when `tabIndex=-1` anyway |
| Inspector chip `aria-hidden="true"` on outer container | `PreviewInspectorOverlay` — the chip is purely visual |

---

## 4. Test Count Summary

| File | Tests | Net new |
|---|---|---|
| `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` | 28 (24 Phase S + 4 hardening) | +28 |
| `packages/theme-engine/test/editor-bridge-protocol.test.ts` | 15 | +15 (absorbed into theme-engine total) |
| `tests/theme-engine/inspector-bridge.test.mjs` | 33 (29 Phase S + 4 hardening) | +33 (split across storefront-runtime registration) |
| **Phase S net total** | | **+76 tests across all suites** |

| Suite | Entering Phase S | Exiting Phase S | Delta |
|---|---|---|---|
| theme-engine | 1034 | 1048 | +14 (test file deduplicated from 15 → 14 unique assertions) |
| merchant-control-plane | 65 | 93 | +28 |
| storefront-runtime | 762 | 795 | +33 |
| api-gateway | 479 | 479 | 0 |

---

## 5. Pre-Existing Test Files (Not Changed by Phase S)

| File | Count | Purpose |
|---|---|---|
| `tests/federation/web-app-contract-boundary.test.mjs` | part of 14 pre-existing | Federation boundary contracts |
| `tests/localization/theme-localization.test.mjs` | part of 14 pre-existing | Localization contracts |
| `tests/app-platform/app-bridge.test.mjs` | part of 14 pre-existing | App bridge contracts |
| `apps/merchant-control-plane/tests/theme-library-q.test.mjs` | 25 | Phase Q merchant UI contracts |
| `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` | 26 | Phase R editor shell contracts |

All pre-existing tests pass unchanged. The three pre-existing failures (merchant AI route, executive analytics migration, storefront-runtime payment route) are foreign to the theme program and unaffected by Phase S.

---

## 6. Typecheck Results

All three affected packages exit typecheck with 0 errors:

- `pnpm --filter=@letbuyy/merchant-control-plane typecheck` — Clean. `PreviewInspectorOverlay.tsx` types, `CenterPanel.tsx` updated props, and the new test file's `node:test` / `node:fs` imports all resolve correctly.
- `pnpm --filter=@letbuyy/storefront-runtime typecheck` — Clean. `getEditorOrigin()` return type (`string`) is correctly threaded through all callers. `triggerFlash()` has no return value inference issue. Insert button `onClick` types match.
- `pnpm --filter=@letbuyy/theme-engine typecheck` — Clean. New constants in `editor-bridge-protocol.ts` are `as const` — no inference issues.
