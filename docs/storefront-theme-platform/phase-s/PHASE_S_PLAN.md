# Phase S Plan — Live Preview Inspector

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** S — Live Preview Inspector
**Date authored:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase S adds the live preview inspector to the merchant theme editor: bidirectional hover signalling between the preview iframe and the editor, a flash animation on section scroll-to, section-boundary insert affordances, and origin hardening across all three postMessage participants. The phase splits into two implementation lanes that are independently testable.

### 1.1 Deliverables

**Lane A — Editor side (merchant-control-plane)**

| Deliverable | File | Status |
|---|---|---|
| 4 new protocol constants | `packages/theme-engine/src/editor-bridge-protocol.ts` | Modified |
| `PreviewInspectorOverlay.tsx` | `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx` | New |
| CenterPanel — origin guard + hover state + EDITOR_SCROLL_MESSAGE send + INSPECTOR_ADD_SECTION_INTENT handler | `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` | Modified |
| Inspector overlay CSS (`.te-inspector-overlay`, `.te-inspector-hover-chip`) + prefers-reduced-motion guard | `apps/merchant-control-plane/src/app/globals.css` | Modified (FOREIGN WIP) |
| Phase S contract tests (24 tests) | `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` | New |
| Protocol unit tests (15 tests) | `packages/theme-engine/test/editor-bridge-protocol.test.ts` | New |
| Register new test files in package.json | `apps/merchant-control-plane/package.json` | Modified |

**Lane B — Storefront preview side (storefront-runtime)**

| Deliverable | File | Status |
|---|---|---|
| `getEditorOrigin()` in both bridge and section frame | `storefront-preview-bridge.tsx`, `editor-preview-section-frame.tsx` | Modified |
| Fail-closed inbound origin guard in bridge | `storefront-preview-bridge.tsx` | Modified |
| Same-window origin guard in section frame | `editor-preview-section-frame.tsx` | Modified |
| Hover sends (`notifyHover`) in section frame | `editor-preview-section-frame.tsx` | Modified |
| `INSPECTOR_SECTION_SCROLLED_TO` dispatch in bridge after `scrollIntoView` | `storefront-preview-bridge.tsx` | Modified |
| Flash animation (`triggerFlash`) in section frame | `editor-preview-section-frame.tsx` | Modified |
| Insert-before/after buttons + `sendAddIntent` in section frame | `editor-preview-section-frame.tsx` | Modified |
| `@keyframes sf-section-frame-flash` + `.storefront-editor-section-frame--flash` + insert-button CSS | `apps/storefront-runtime/src/app/globals.css` | Modified |
| `prefers-reduced-motion` guard for flash | `apps/storefront-runtime/src/app/globals.css` | Modified |
| Inspector bridge tests (29 tests) | `tests/theme-engine/inspector-bridge.test.mjs` | New |

**Hardening pass (both lanes)**

| Finding severity | Finding | Fix |
|---|---|---|
| HIGH | `INSPECTOR_ADD_SECTION_INTENT` never handled in `CenterPanel.handleMessage` | Added `case INSPECTOR_ADD_SECTION_INTENT` with payload validation and `onAddSectionIntent` prop |
| MEDIUM | Fail-open receive guard in bridge | Changed to `!editorOrigin \|\| event.origin !== editorOrigin` |
| MEDIUM | Double-scroll jank (LEGACY + SCROLL both triggered scroll+flash) | `LEGACY_SELECTION_MESSAGE` calls `selectSection(id, false)`; only `SCROLL_MESSAGE` triggers scroll+flash |
| LOW | READY_MESSAGE broadcasts to `'*'` when env var absent | Suppressed entirely when `getEditorOrigin()` returns empty string |
| LOW | Raw px/hex in inspector CSS | Replaced with `--lb-*` tokens |
| LOW | No `prefers-reduced-motion` guard on flash animation | Guard added to storefront globals.css |

---

## 2. Constraints

### 2.1 Foreign WIP Files

`apps/merchant-control-plane/src/app/globals.css` is a FOREIGN WIP FILE. Phase S additions are: `.te-inspector-overlay`, `.te-inspector-hover-chip`, `.te-inspector-hover-chip__label`, `@keyframes te-inspector-chip-in`, and the `prefers-reduced-motion` guard for the chip animation. All additions use `--lb-*` design tokens. No raw hex or pixel values (after hardening).

`editor/page.tsx` is a FOREIGN WIP FILE and is intentionally NOT touched by Phase S. The `onHoverSection` and `onAddSectionIntent` props are optional (with no-op defaults) so `CenterPanel` can be extended without touching the foreign page.

### 2.2 Design System Ratchet

- No new `rounded-[...px]` raw-pixel radius classes.
- No raw hex color values — `--lb-color-primary`, `--lb-color-interactive`, `--lb-color-focus-ring`, `color-mix(in srgb, var(--lb-color-primary) 30%, transparent)` only.
- All spacing via `--lb-space-*` tokens (e.g. `--lb-space-2-5`, `--lb-space-1`, `--lb-space-0-75`).
- Font size via `--lb-font-size-xs` (not `11px`).
- Radius via `--lb-radius-full` (not `9999px` inline).

### 2.3 RISK-DUAL-N01

Phase S MUST NOT add any mutation path for `section_definitions` or `block_definitions`. The preview sends intent-only messages (`INSPECTOR_ADD_SECTION_INTENT`). The editor decides whether to open the add-section panel. The preview never modifies the template document. Mechanical enforcement: `EditorPreviewSectionFrame.sendAddIntent()` posts `{ adjacentSectionId, position }` only — no section object, no template mutation.

### 2.4 RISK-SEC-P01

No client-side realtime subscription over `theme_editor_drafts` is added in Phase S. The risk remains bounded to the gateway service-role path.

### 2.5 No-Echo Self-Loop Guard

The Phase C Liquid transformation program established a guard in `StorefrontPreviewBridge.handleMessage`: the translation branch matches only `LEGACY_SELECTION_MESSAGE || SCROLL_MESSAGE` (not `EDITOR_SELECTION_MESSAGE`). Phase S must preserve this exactly. `INSPECTOR_SECTION_SCROLLED_TO` is also excluded from the translation branch — it is a same-window dispatch whose `event.origin` equals `window.location.origin` (not `editorOrigin`), so it is naturally rejected by the origin guard before the translation branch is reached.

### 2.6 `page.tsx` Not Touched

Phase S does not modify `editor/page.tsx` (FOREIGN WIP). The new `onHoverSection` and `onAddSectionIntent` props on `CenterPanel` are optional and default to no-ops. Until `page.tsx` is next touched substantively, the editor panel will not open on add-section intent — that wiring is a follow-up for Phase T or the first phase that touches `page.tsx` for non-trivial changes.

---

## 3. Protocol Design

### 3.1 New Constants

All four constants added to `packages/theme-engine/src/editor-bridge-protocol.ts` under a `// Phase S — Live Preview Inspector` section:

| Constant | String value | Direction | Payload |
|---|---|---|---|
| `INSPECTOR_SECTION_HOVERED` | `'letbuyy:inspector:section-hovered'` | preview → editor | `{ sectionId: string; sectionType: string }` |
| `INSPECTOR_HOVER_CLEARED` | `'letbuyy:inspector:hover-cleared'` | preview → editor | `{ sectionId: string }` |
| `INSPECTOR_ADD_SECTION_INTENT` | `'letbuyy:inspector:add-section-intent'` | preview → editor | `{ adjacentSectionId: string; position: 'before' \| 'after' }` |
| `INSPECTOR_SECTION_SCROLLED_TO` | `'letbuyy:inspector:section-scrolled-to'` | same-window (preview internal) | `{ sectionId: string }` |

**Key design decision — `INSPECTOR_SECTION_SCROLLED_TO`:** This constant is intentionally different from `EDITOR_SELECTION_MESSAGE`. Both `EditorPreviewSectionFrame` handlers listen on the same `window`, and the bridge dispatches both. Using a separate constant means the flash trigger (transient, single-section) and the selection state (persistent, all frames compare their own `sectionId`) are clearly separated. The JSDoc on the constant documents that it is a same-window dispatch and must never be matched in the cross-origin `handleMessage` in the bridge.

### 3.2 Message Flow (Post-Phase-S)

```
User hover enters section in preview:
  EditorPreviewSectionFrame → window.parent.postMessage(INSPECTOR_SECTION_HOVERED, editorOrigin)
    → CenterPanel.handleMessage → setHoveredSection({ sectionId, sectionType }) → PreviewInspectorOverlay renders chip
                                 → onHoverSection?.(sectionId)

User hover leaves section:
  EditorPreviewSectionFrame → window.parent.postMessage(INSPECTOR_HOVER_CLEARED, editorOrigin)
    → CenterPanel.handleMessage → setHoveredSection(null) → overlay disappears
                                 → onHoverSection?.(null)

User clicks section in preview:
  EditorPreviewSectionFrame → window.parent.postMessage(EDITOR_SECTION_SELECT_MESSAGE, editorOrigin)
    → CenterPanel.handleMessage → onSelectSection(sectionId)

Editor tree selection change:
  CenterPanel.postSelectionToPreview →
    postMessage(EDITOR_LEGACY_SELECTION_MESSAGE, previewOrigin)  ← backward compat
    postMessage(EDITOR_SELECTION_MESSAGE, previewOrigin)          ← persistent selection
    postMessage(EDITOR_SCROLL_MESSAGE, previewOrigin)             ← explicit scroll intent

  Bridge receives EDITOR_LEGACY_SELECTION_MESSAGE:
    selectSection(sectionId, false)  ← no scroll on legacy (double-scroll fix)
    → window.postMessage(EDITOR_SELECTION_MESSAGE, window.location.origin)
      → all EditorPreviewSectionFrame instances: setIsSelected(sectionId === myId)

  Bridge receives EDITOR_SCROLL_MESSAGE:
    selectSection(sectionId, true)
    → window.postMessage(EDITOR_SELECTION_MESSAGE, window.location.origin)
    → scrollIntoView({ behavior: 'smooth', block: 'center' })
    → window.postMessage(INSPECTOR_SECTION_SCROLLED_TO, window.location.origin)
      → that section's EditorPreviewSectionFrame: triggerFlash()

User clicks +insert button in preview:
  EditorPreviewSectionFrame → window.parent.postMessage(INSPECTOR_ADD_SECTION_INTENT, editorOrigin)
    → CenterPanel.handleMessage → onAddSectionIntent?.(adjacentSectionId, position)
```

---

## 4. Component Design

### 4.1 `PreviewInspectorOverlay`

`apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx`

- Returns `null` when `hoveredSection` is null.
- Renders a `.te-inspector-overlay` container: `position: absolute; inset: 0; pointer-events: none; z-index: 10`. The container is `aria-hidden="true"` — it is a pointer-enhancement annotation only; keyboard selection is owned by the section tree.
- Inside: a `.te-inspector-hover-chip` span with a `MaterialIcon name="touch_app"` + `formatSectionLabel(sectionType)` text. The chip uses `--lb-*` tokens for colour, spacing, and radius.
- No postMessage logic of any kind — CenterPanel owns all messaging.
- Cleared (`setHoveredSection(null)`) when `previewUrl` changes so stale chips do not linger across page navigations.

### 4.2 CenterPanel Changes

The three new additions are self-contained and do not require `page.tsx` to change:

1. **`hoveredSection` state** (`useState<{ sectionId: string; sectionType: string } | null>(null)`) — tracking what the preview currently hovers.
2. **`onHoverSection?: (sectionId: string | null) => void`** — optional prop; no-op default.
3. **`onAddSectionIntent?: (adjacentSectionId: string, position: 'before' | 'after') => void`** — optional prop; no-op default.
4. **`previewOrigin` memo** — `new URL(previewUrl).origin` computed once; used as both `targetOrigin` for sends and the expected value for the receive guard.
5. **Receive guard:** `if (!previewOrigin || event.origin !== previewOrigin) return` — fail-closed.
6. **Three new switch cases:** `INSPECTOR_SECTION_HOVERED`, `INSPECTOR_HOVER_CLEARED`, `INSPECTOR_ADD_SECTION_INTENT`.
7. **`EDITOR_SCROLL_MESSAGE` send** in `postSelectionToPreview` (alongside the existing two selection messages) — makes scroll intent an explicit separate message so the bridge can distinguish it from selection state.
8. **`<PreviewInspectorOverlay hoveredSection={hoveredSection} />`** rendered inside `.te-preview-body`.
9. **Clear on URL change:** `setHoveredSection(null)` in the `useEffect` that resets `iframeLoadedRef` when `previewUrl` changes.

### 4.3 EditorPreviewSectionFrame Changes

1. **`getEditorOrigin()`** function — reads `NEXT_PUBLIC_ADMIN_URL` first, then `document.referrer`, returns `''` if both absent. All outbound sends skip rather than using `'*'` when origin is empty.
2. **`notifyHover(hovered: boolean)`** — `useCallback`; sends `INSPECTOR_SECTION_HOVERED` or `INSPECTOR_HOVER_CLEARED` to parent at `editorOrigin`.
3. **`sendAddIntent(position: 'before' | 'after')`** — `useCallback`; sends `INSPECTOR_ADD_SECTION_INTENT` to parent at `editorOrigin`. Never mutates template sections (RISK-DUAL-N01).
4. **`triggerFlash()`** — removes `.storefront-editor-section-frame--flash`, forces reflow (`void el.offsetWidth`), re-adds the class, schedules class removal after `FLASH_DURATION_MS = 700`.
5. **`handleMessage`** receive guard: `if (event.origin !== window.location.origin) return` — accepts only same-window dispatches from the bridge.
6. **New branch in `handleMessage`:** on `INSPECTOR_SECTION_SCROLLED_TO` where `data.sectionId === sectionId` → calls `triggerFlash()`.
7. **`onMouseEnter={() => notifyHover(true)}`** and **`onMouseLeave={() => notifyHover(false)}`** on the outer `div`.
8. **Insert-before button** (`.storefront-editor-section-insert--before`, `tabIndex={-1}`, `stopPropagation`, calls `sendAddIntent('before')`).
9. **Insert-after button** (`.storefront-editor-section-insert--after`, `tabIndex={-1}`, `stopPropagation`, calls `sendAddIntent('after')`).
10. **`flashTimerRef`** cleanup in `useEffect` unmount guard.

### 4.4 StorefrontPreviewBridge Changes

1. **`getEditorOrigin()`** — same function as in section frame; `NEXT_PUBLIC_ADMIN_URL` → `document.referrer` → `''`.
2. **Receive guard hardened to fail-closed:** `if (!editorOrigin || event.origin !== editorOrigin) return`.
3. **READY_MESSAGE suppressed when origin unknown:** `if (editorOriginForReady) { window.parent?.postMessage(..., editorOriginForReady) } else { console.warn(...) }`. The `|| '*'` fallback is removed.
4. **`INSPECTOR_SECTION_SCROLLED_TO` dispatch in `selectSection`:** after `scrollIntoView`, posts `{ type: SCROLLED_TO_MESSAGE, sectionId }` to `window.location.origin`. This is same-window only and cannot be spoofed cross-origin.
5. **Double-scroll fix:** `selectSection(sectionId, type === SCROLL_MESSAGE)` — `LEGACY_SELECTION_MESSAGE` passes `shouldScroll = false`; only `SCROLL_MESSAGE` passes `shouldScroll = true`.

---

## 5. CSS Design

### 5.1 Merchant-Control-Plane Inspector CSS

Added to `apps/merchant-control-plane/src/app/globals.css` (FOREIGN WIP):

- `.te-inspector-overlay`: `position: absolute; inset: 0; pointer-events: none; z-index: 10`.
- `.te-inspector-hover-chip`: absolutely positioned at `top: var(--lb-space-2-5)`, horizontally centered, `display: inline-flex`, gaps via `--lb-space-1`, padding via `--lb-space-0-75` / `--lb-space-2-5` / `--lb-space-2`, `border-radius: var(--lb-radius-full)`, `background: var(--lb-color-primary)`, `color: var(--lb-color-text-inverse)`, `font-size: var(--lb-font-size-xs)`, `box-shadow: color-mix(in srgb, var(--lb-color-primary) 30%, transparent)`, `animation: te-inspector-chip-in 0.12s ease both`.
- `@media (prefers-reduced-motion: reduce) { .te-inspector-hover-chip { animation: none } }`.
- `@keyframes te-inspector-chip-in`: opacity 0 + translateY(-6px) → opacity 1 + translateY(0).
- `.te-inspector-hover-chip__label`: `line-height: 1`.

### 5.2 Storefront-Runtime Inspector CSS

Added to `apps/storefront-runtime/src/app/globals.css`:

- `@keyframes sf-section-frame-flash`: keyframes with `outline` / `box-shadow` from `var(--lb-color-primary, ...)` at 0% to transparent at 100%.
- `.storefront-editor-section-frame--flash`: `animation: sf-section-frame-flash 700ms ease-out forwards`.
- `@media (prefers-reduced-motion: reduce) { .storefront-editor-section-frame--flash { animation: none } }` — added immediately after the flash rule.
- `.storefront-editor-section-insert`: base insert-button styles with `var(--lb-color-interactive)` background, `var(--lb-color-interactive-hover)` hover, `var(--lb-color-focus-ring)` focus outline, `tabIndex=-1` (keyboard users use the section tree panel).
- `.storefront-editor-section-insert--before` / `--after`: absolute positioning above and below sections.

---

## 6. Gates

### 6.1 Gate Entering Phase S

| Metric | Baseline |
|---|---|
| theme-engine | 1034/1034 |
| merchant-control-plane (pnpm test) | 65/65 (26 Phase R + 25 Phase Q + 14 pre-existing) |
| storefront-runtime (pnpm test) | 762/762 |
| api-gateway tests | 479 |
| All typechecks | Clean |

### 6.2 Gate Exiting Phase S

| Metric | Target |
|---|---|
| theme-engine | 1048/1048 (+15 new editor-bridge-protocol tests) |
| merchant-control-plane | 93/93 (+24 Phase S + 4 hardening = 28 new, total 89 Phase-S final; +4 hardening = 93) |
| storefront-runtime | 795/795 (+29 new inspector-bridge tests + 4 hardening) |
| api-gateway | Unchanged (479) |
| All typechecks | Clean |
| `PreviewInspectorOverlay.tsx` exists | Required |
| `packages/theme-engine/test/editor-bridge-protocol.test.ts` exists | Required |
| `tests/theme-engine/inspector-bridge.test.mjs` exists | Required |
| All 4 `INSPECTOR_*` constants in `editor-bridge-protocol.ts` | Required |
| No `'*'` as `targetOrigin` in CenterPanel, bridge, or section frame | Required |
| Receive guard fail-closed in bridge | Required |
| No-echo self-loop guard preserved | Required |
| `prefers-reduced-motion` guard on flash animation | Required |
| No `section_definitions` mutation from preview (RISK-DUAL-N01) | Required |

---

## 7. Not In Scope (Phase S)

| Item | Reason |
|---|---|
| Opening the add-section panel in the editor when INSPECTOR_ADD_SECTION_INTENT arrives | `page.tsx` is FOREIGN WIP; `onAddSectionIntent` prop wired to no-op until Phase T or next substantive `page.tsx` touch |
| Realtime subscriptions over `theme_editor_drafts` | Blocked by RISK-SEC-P01 |
| Type extraction to `@/lib/theme-editor-types.ts` | RISK-R01 LOW tech debt; deferred |
| RISK-PERF-N01 hard byte bound on `ThemeDocument` | Deferred from Phase R; still open |
| Gateway changes | Phase S is pure UI + protocol extension |
| Database migrations | Not required |
| New npm dependencies | Not required |
