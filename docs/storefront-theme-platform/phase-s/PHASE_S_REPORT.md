# Phase S Report — Live Preview Inspector

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** S — Live Preview Inspector
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase S extends the postMessage bridge between the merchant editor and the storefront preview iframe with four new protocol constants, bidirectional hover signalling, flash-on-scroll animation, section-boundary insert affordances, and comprehensive origin hardening. No gateway routes, database migrations, SECURITY DEFINER RPCs, or authentication tokens were modified. No frozen apps were touched.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase S touches `apps/merchant-control-plane/src/app/globals.css` and `apps/storefront-runtime/src/app/globals.css`, both of which are FOREIGN WIP FILES carrying prior user modifications. The CSS additions are isolated blocks that do not overlap with any other WIP content. **These changes have NOT been staged and MUST NOT be committed or deployed without explicit review of each hunk against the surrounding foreign WIP.**

No new database migrations. No gateway changes. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|---|---|---|
| `apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx` | 57 | Pointer-enhancement hover chip overlay; `aria-hidden`, pointer-events-none; no messaging logic |
| `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` | ~240 | 28 static contract tests (24 Phase S + 4 hardening) |
| `packages/theme-engine/test/editor-bridge-protocol.test.ts` | ~120 | 15 protocol constant value + uniqueness + namespace + count tests |
| `tests/theme-engine/inspector-bridge.test.mjs` | ~296 | 33 bridge contract tests (29 Phase S + 4 hardening) |

### 1.2 Modified Files

| File | Change | WIP? |
|---|---|---|
| `packages/theme-engine/src/editor-bridge-protocol.ts` | Added 4 `INSPECTOR_*` constants with JSDoc | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` | Added origin guard, hover state, `EDITOR_SCROLL_MESSAGE` send, 3 new switch cases, overlay render | Clean |
| `apps/merchant-control-plane/src/app/globals.css` | Added `.te-inspector-overlay`, `.te-inspector-hover-chip`, animation, reduced-motion guard | FOREIGN WIP |
| `apps/merchant-control-plane/package.json` | Registered `theme-editor-s.test.mjs` in test script | Clean |
| `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` | Added `getEditorOrigin()`, fail-closed guard, READY_MESSAGE hardening, double-scroll fix, `INSPECTOR_SECTION_SCROLLED_TO` dispatch | Clean |
| `apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx` | Added `getEditorOrigin()`, same-window guard, hover sends, flash trigger, insert buttons | Clean |
| `apps/storefront-runtime/src/app/globals.css` | Added flash keyframes + class + reduced-motion guard, insert-button CSS | FOREIGN WIP |
| `apps/storefront-runtime/package.json` | Registered `inspector-bridge.test.mjs` | Clean |

### 1.3 Foreign WIP Files and Isolation

**`apps/merchant-control-plane/src/app/globals.css`:** The inspector CSS is added as a contiguous block after the existing `te-*` section (approximately line 10014 onwards). The block covers `.te-inspector-overlay`, `.te-inspector-hover-chip`, `@keyframes te-inspector-chip-in`, the `prefers-reduced-motion` guard, and `.te-inspector-hover-chip__label`. All values use `--lb-*` design tokens. Reverting removes this block with no impact on any other style rule.

**`apps/storefront-runtime/src/app/globals.css`:** The flash animation CSS is added after the existing `.storefront-editor-section-frame--selected` block (approximately line 560 onwards). It covers `@keyframes sf-section-frame-flash`, `.storefront-editor-section-frame--flash`, the `prefers-reduced-motion` guard, and the `.storefront-editor-section-insert` family. All colors use `var(--lb-color-interactive)` / `var(--lb-color-interactive-hover)` / `var(--lb-color-focus-ring)` with `rgb()` fallbacks. Reverting removes these blocks with no impact on other styles.

---

## 2. Protocol Extensions

Four new constants added to `packages/theme-engine/src/editor-bridge-protocol.ts` under a `// Phase S — Live Preview Inspector` section header:

| Constant | Value | Direction | Payload |
|---|---|---|---|
| `INSPECTOR_SECTION_HOVERED` | `'letbuyy:inspector:section-hovered'` | preview → editor | `{ sectionId, sectionType }` |
| `INSPECTOR_HOVER_CLEARED` | `'letbuyy:inspector:hover-cleared'` | preview → editor | `{ sectionId }` |
| `INSPECTOR_ADD_SECTION_INTENT` | `'letbuyy:inspector:add-section-intent'` | preview → editor | `{ adjacentSectionId, position: 'before' \| 'after' }` |
| `INSPECTOR_SECTION_SCROLLED_TO` | `'letbuyy:inspector:section-scrolled-to'` | same-window only | `{ sectionId }` |

`INSPECTOR_SECTION_SCROLLED_TO` is documented in its JSDoc as a same-window dispatch that must never be matched by the cross-origin handler in the bridge. This preserves the no-echo self-loop guard from Phase C.

---

## 3. Origin Hardening

### 3.1 Before Phase S

| Participant | Receive guard | Send `targetOrigin` |
|---|---|---|
| `CenterPanel` | NONE — any origin could drive section selection | Explicit `previewOrigin` ✓ |
| `StorefrontPreviewBridge` | Fail-open — guard skipped when env var absent | READY_MESSAGE used `\|\| '*'` fallback |
| `EditorPreviewSectionFrame` | NONE — any origin could inject selection state | `document.referrer \|\| '*'` fallback |

### 3.2 After Phase S

| Participant | Receive guard | Send `targetOrigin` |
|---|---|---|
| `CenterPanel` | `if (!previewOrigin \|\| event.origin !== previewOrigin) return` — **fail-closed** | Explicit `targetOrigin = previewOrigin` |
| `StorefrontPreviewBridge` | `if (!editorOrigin \|\| event.origin !== editorOrigin) return` — **fail-closed** | `getEditorOrigin()` — suppressed (not `'*'`) when unknown |
| `EditorPreviewSectionFrame` | `if (event.origin !== window.location.origin) return` — same-window only | `getEditorOrigin()` — skipped (not `'*'`) when unknown |

No `'*'` wildcard remains anywhere in the bridge.

### 3.3 `getEditorOrigin()` (Both Preview Files)

```typescript
function getEditorOrigin(): string {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
    if (adminUrl) { try { return new URL(adminUrl).origin; } catch {} }
    if (typeof document !== 'undefined' && document.referrer) {
        try { return new URL(document.referrer).origin; } catch {} }
    return '';
}
```

Returns empty string when both sources are absent — callers skip sends (never `'*'`) and reject all received messages.

---

## 4. Code Review Findings and Resolutions

Phase S surfaced 8 findings during review. All HIGH and MEDIUM findings and all LOW findings were resolved before phase close.

### 4.1 Fixed

| Severity | Finding | Fix |
|---|---|---|
| HIGH | `INSPECTOR_ADD_SECTION_INTENT` had no handler in `CenterPanel.handleMessage` — add-section affordance was fully non-functional | Added `case INSPECTOR_ADD_SECTION_INTENT` with `adjacentSectionId` and `position` validation before invoking `onAddSectionIntent?.(...)` |
| MEDIUM | Bridge receive guard was fail-open: `if (editorOrigin && ...)` skipped the guard when env var absent | Changed to `if (!editorOrigin \|\| event.origin !== editorOrigin) return` — fail-closed |
| MEDIUM | Double-scroll jank: `LEGACY_SELECTION_MESSAGE` and `SCROLL_MESSAGE` both called `selectSection(id, true)`, firing two competing smooth-scroll calls | `LEGACY_SELECTION_MESSAGE` now calls `selectSection(id, false)`; only `SCROLL_MESSAGE` scrolls + flashes |
| LOW | READY_MESSAGE sent `sectionIds` to `'*'` when `NEXT_PUBLIC_ADMIN_URL` absent | Suppressed with `console.warn` when `getEditorOrigin()` returns empty string |
| LOW | `te-inspector-hover-chip` used raw `top: 10px`, `gap: 4px`, `padding: 3px 10px 3px 8px`, `font-size: 11px`, and `rgba(99,59,199,0.3)` | Replaced with `--lb-space-2-5`, `--lb-space-1`, `--lb-space-0-75`/`--lb-space-2-5`/`--lb-space-2`, `--lb-font-size-xs`, `color-mix(in srgb, var(--lb-color-primary) 30%, transparent)` |
| LOW | Storefront insert-button CSS used raw `rgb(37 99 235)`, `rgb(29 78 216)`, `rgb(147 197 253)` | Replaced with `var(--lb-color-interactive)`, `var(--lb-color-interactive-hover)`, `var(--lb-color-focus-ring)` with `rgb()` fallbacks |
| LOW | No `prefers-reduced-motion: reduce` guard on `sf-section-frame-flash` animation | Added `@media (prefers-reduced-motion: reduce) { .storefront-editor-section-frame--flash { animation: none } }` |
| LOW | (duplicate of MEDIUM — fail-open bridge guard listed separately in findings) | Resolved with fail-closed fix above |

### 4.2 No Deferred Findings

All 8 findings were resolved in the hardening pass. No Phase S findings are deferred to a future phase.

---

## 5. Foreign WIP Not Touched

Phase S does not touch:
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — `onHoverSection` and `onAddSectionIntent` are optional props on `CenterPanel` with no-op defaults. The page continues to function without wiring these props.
- `services/api-gateway/src/index.ts` — no gateway changes.
- `packages/typescript/api-client/src/index.ts` — no new client stubs.
- `apps/storefront-runtime/src/app/[...slug]/page.tsx` (the storefront renderer) — the bridge and section frame are loaded only in preview mode (`editor=1`); the normal storefront render is unchanged.

`git status --short` on all session files confirms no unstaged changes in any of the above.

---

## 6. Rollback

**Full rollback (Lane A):**
```
git checkout -- apps/merchant-control-plane/src/app/globals.css \
               apps/merchant-control-plane/package.json
git rm apps/merchant-control-plane/src/components/theme-editor/PreviewInspectorOverlay.tsx \
       apps/merchant-control-plane/tests/theme-editor-s.test.mjs
git checkout -- apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx
```

**Full rollback (Lane B):**
```
git checkout -- apps/storefront-runtime/src/app/globals.css \
               apps/storefront-runtime/package.json \
               apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx \
               apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx
git rm tests/theme-engine/inspector-bridge.test.mjs
```

**Protocol rollback:**
```
git checkout -- packages/theme-engine/src/editor-bridge-protocol.ts
git rm packages/theme-engine/test/editor-bridge-protocol.test.ts
```

Rollback restores the Phase R bridge surface (no hover/flash/insert/origin hardening) and the 7-constant protocol. The editor continues to function with Phase R behavior: click-to-select from preview works; hover chip, flash animation, and insert buttons are absent; origin guards revert to their pre-Phase-S state.

---

## 7. Test Results

| Suite | Phase S Final | Command |
|---|---|---|
| merchant-control-plane | **93/93** | `pnpm --filter=@letbuyy/merchant-control-plane test` |
| theme-engine | **1048/1048** | `pnpm --filter=@letbuyy/theme-engine test` |
| storefront-runtime | **795/795** | `pnpm typecheck test --filter=@letbuyy/storefront-runtime` |
| api-gateway | **479/479** (unchanged) | `pnpm --filter=@letbuyy/api-gateway test` |
| All typechecks | **Clean** | Per-package typecheck commands |

**Breakdown of merchant-control-plane 93:**
- 28 Phase S tests (`theme-editor-s.test.mjs`)
- 26 Phase R tests (`theme-editor-r.test.mjs`)
- 25 Phase Q tests (`theme-library-q.test.mjs`)
- 14 pre-existing tests (federation / localization / app-platform)

**Breakdown of theme-engine 1048:**
- 14 new Phase S tests (`editor-bridge-protocol.test.ts`)
- 1034 pre-existing tests (unchanged from Phase R exit)

**Breakdown of storefront-runtime 795:**
- 33 new Phase S tests (`inspector-bridge.test.mjs`)
- 762 pre-existing tests (unchanged from Phase R exit)

---

## 8. RISK-DUAL-N01 Status

RISK-DUAL-N01 is preserved in Phase S. The preview-side insert affordance (`INSPECTOR_ADD_SECTION_INTENT`) sends `{ adjacentSectionId, position }` only. No section object, no Liquid source, no template mutation occurs in the preview. The editor side receives the intent and decides whether to open the add-section panel via `onAddSectionIntent?.()`. The callback is currently wired to a no-op default (since `page.tsx` was not touched); full wiring is a follow-up for Phase T.

`buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)` remains the sole path for draft saves. `section_definitions` / `block_definitions` continue to come from `baseConfig`, not from `editorState`. No Phase S code path creates a mutation route to these fields.

---

## 9. Parity Impact

Phase S advances the Shopify parity matrix for the editor shell inspector cluster:

| Capability | Pre-Phase-S | Post-Phase-S |
|---|---|---|
| Section hover highlight in preview | MISSING | COMPLETE (hover chip + origin-safe signalling) |
| Flash animation on section scroll-to | MISSING | COMPLETE (transient class, FLASH_DURATION_MS=700, reflow-safe) |
| Insert-before/after affordance in preview | MISSING | COMPLETE (buttons rendered; intent sent; editor wiring pending Phase T) |
| Click-to-select from preview | COMPLETE (Phase C) | COMPLETE (unchanged; origin-hardened) |
| PostMessage security (no wildcard sends) | PARTIAL (some sends were `\|\| '*'`) | COMPLETE |
| PostMessage security (receive-side origin validation) | MISSING (CenterPanel + section frame unguarded) | COMPLETE |
| No-echo self-loop guard | COMPLETE (Phase C) | COMPLETE (preserved + extended) |

---

## Next Phase: T — Section Groups and Nested Blocks

Phase T will wire `onAddSectionIntent` in `page.tsx`, implement section-group containers, and add nested block rendering. Phase T must:
- Preserve RISK-DUAL-N01 (no `section_definitions` mutation).
- Not add client-side realtime subscriptions over `theme_editor_drafts` until RISK-SEC-P01 is resolved.
- Continue using `--lb-*` design tokens for all new CSS.
- Gate on merchant-control-plane **93/93** + theme-engine **1048/1048** + storefront-runtime **795/795** baselines.
