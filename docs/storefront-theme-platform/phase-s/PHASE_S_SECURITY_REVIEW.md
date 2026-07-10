# Phase S Security Review — PostMessage Origin Model, Send/Receive Validation, and No-Echo Preservation

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** S — Live Preview Inspector
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase S's security surface is entirely within the postMessage bridge between the merchant editor (merchant-control-plane, `http://localhost:9001` dev / `https://admin.letbuyy.com` prod) and the storefront preview iframe (storefront-runtime, `http://localhost:9000` dev / `https://store.letbuyy.com` prod). No gateway routes, database queries, RLS policies, or authentication tokens are modified.

Security review covers:

- Three postMessage participants: `CenterPanel` (editor), `StorefrontPreviewBridge` (preview window), `EditorPreviewSectionFrame` (preview section wrapper).
- Send-side: explicit `targetOrigin` on every outbound message; no `'*'` wildcard.
- Receive-side: `event.origin` validation before acting on any message; fail-closed when the expected origin is unknown.
- Payload validation: shape guards before extracting fields from `event.data`.
- No-echo self-loop preservation: the bridge translation branch must not match `EDITOR_SELECTION_MESSAGE`.
- RISK-DUAL-N01 enforcement: the preview never mutates template sections.

No new network routes, no new database access, no new authentication paths. Phase S is a pure UI extension.

---

## 2. Origin Model

### 2.1 Known Origins at Build Time

| Application | Dev origin | Prod origin | Source |
|---|---|---|---|
| Editor (merchant-control-plane) | `http://localhost:9001` | `https://admin.letbuyy.com` | `NEXT_PUBLIC_ADMIN_URL` env var; dev script `next dev -p 9001` |
| Preview iframe (storefront-runtime) | `http://localhost:9000` | `https://store.letbuyy.com` | `NEXT_PUBLIC_STOREFRONT_URL` env var; dev script `next dev -p 9000` |

**Cross-origin relationship:** The two origins are different in both dev and prod. This is a genuine cross-origin iframe. Every postMessage between them requires explicit `targetOrigin` on the send side and `event.origin` comparison on the receive side.

### 2.2 `getEditorOrigin()` (Preview Side)

Both `StorefrontPreviewBridge` and `EditorPreviewSectionFrame` define identical `getEditorOrigin()` functions:

```typescript
function getEditorOrigin(): string {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
    if (adminUrl) {
        try { return new URL(adminUrl).origin; } catch { /* malformed */ }
    }
    if (typeof document !== 'undefined' && document.referrer) {
        try { return new URL(document.referrer).origin; } catch { /* malformed */ }
    }
    return '';
}
```

Resolution order:
1. `NEXT_PUBLIC_ADMIN_URL` baked in at Next.js build time — the authoritative source.
2. `document.referrer` as fallback when the env var is absent in a non-standard build.
3. Empty string when both are absent — callers must not fall back to `'*'`; they must skip the send or reject the message.

**Verified:** In a correctly built production deployment, `NEXT_PUBLIC_ADMIN_URL` is always baked in. The empty-string path is only reachable in a severely misconfigured deployment.

### 2.3 `previewOrigin` (Editor Side)

`CenterPanel` derives its expected preview origin from `previewUrl`:

```typescript
const previewOrigin = useMemo((): string | null => {
    if (!previewUrl) return null
    try { return new URL(previewUrl).origin } catch { return null }
}, [previewUrl])
```

`previewUrl` is built from `getStorefrontBaseUrl()` (reads `NEXT_PUBLIC_STOREFRONT_URL`). In dev: `http://localhost:9000`. In prod: the merchant's storefront base URL origin.

This memo is the single source of truth for both the send `targetOrigin` and the receive guard on the editor side — they are always consistent.

---

## 3. Send-Side Validation

### 3.1 Editor → Preview (CenterPanel)

All three outbound postMessage calls in `CenterPanel.postSelectionToPreview` target `const targetOrigin = previewOrigin`:

```typescript
const postSelectionToPreview = useCallback(() => {
    const frame = iframeRef.current
    if (!frame?.contentWindow || !previewOrigin || !iframeLoadedRef.current) return
    const targetOrigin = previewOrigin
    frame.contentWindow.postMessage({ type: EDITOR_LEGACY_SELECTION_MESSAGE, selectedSectionId }, targetOrigin)
    frame.contentWindow.postMessage({ type: EDITOR_SELECTION_MESSAGE, sectionId: selectedSectionId, selectedSectionId }, targetOrigin)
    if (selectedSectionId) {
        frame.contentWindow.postMessage({ type: EDITOR_SCROLL_MESSAGE, sectionId: selectedSectionId }, targetOrigin)
    }
}, [previewOrigin, selectedSectionId])
```

Guard: `if (!frame?.contentWindow || !previewOrigin || !iframeLoadedRef.current) return` — no message is ever sent when `previewOrigin` is null (preview URL not yet configured). No `'*'` wildcard on any editor-to-preview send.

**Contract test:** `theme-editor-s.test.mjs` test "CenterPanel does not use bare '*' as postMessage targetOrigin anywhere in the file" — checks the collapsed-whitespace source for the pattern `postMessage([^)]*,\s*['"]\\*['"]\s*\)`. This test passes on the current source.

### 3.2 Preview → Editor (EditorPreviewSectionFrame)

`notifyHover`, `notifySelection`, and `sendAddIntent` all call `getEditorOrigin()` and skip the send when it returns empty string:

```typescript
const notifyHover = useCallback((hovered: boolean) => {
    const editorOrigin = getEditorOrigin();
    if (!editorOrigin) return;   // ← skip, not '*'
    window.parent?.postMessage(
        hovered ? { type: HOVERED_MESSAGE, sectionId, sectionType } : { type: HOVER_CLEARED_MESSAGE, sectionId },
        editorOrigin,
    );
}, [sectionId, sectionType]);
```

No `postMessage` call in `EditorPreviewSectionFrame` uses `'*'` as the second argument. Verified by contract test: "section frame does not use wildcard origin for outbound inspector messages" (iterates over `src.match(/postMessage\([^)]+\)/g)` and asserts no call contains `'*'`).

### 3.3 Preview → Editor (StorefrontPreviewBridge — READY_MESSAGE)

After hardening:

```typescript
const editorOriginForReady = getEditorOrigin();
if (editorOriginForReady) {
    window.parent?.postMessage({ type: READY_MESSAGE, viewport: initialViewport, sectionIds }, editorOriginForReady);
} else if (process.env.NODE_ENV !== 'production') {
    console.warn('[StorefrontPreviewBridge] NEXT_PUBLIC_ADMIN_URL not configured — READY_MESSAGE suppressed');
}
```

The `|| '*'` fallback is removed. When `NEXT_PUBLIC_ADMIN_URL` is absent and referrer is unavailable, the READY_MESSAGE is suppressed entirely. `sectionIds` (theme layout metadata) are never broadcast to an unknown embedder.

**Pre-hardening vulnerability:** `getParentTargetOrigin() || '*'` broadcast `sectionIds` to any embedder when the env var was absent. This was LOW severity because `sectionIds` are not authentication credentials, but broadcasting internal merchant theme structure to arbitrary origins violates the least-privilege principle.

### 3.4 Same-Window Dispatches (Preview Internal)

Two same-window dispatches in `StorefrontPreviewBridge.selectSection()`:

```typescript
window.postMessage({ type: SELECTED_MESSAGE, sectionId }, window.location.origin);
// ... scrollIntoView ...
window.postMessage({ type: SCROLLED_TO_MESSAGE, sectionId }, window.location.origin);
```

Both target `window.location.origin` — strictly same-window. `window.location.origin` is the authenticated origin of the current page and cannot be spoofed by a cross-origin sender. The section frame's receive guard (`event.origin !== window.location.origin`) accepts only these same-window posts.

---

## 4. Receive-Side Validation

### 4.1 CenterPanel (Editor — Receive from Preview)

```typescript
function handleMessage(event: MessageEvent) {
    if (!previewOrigin || event.origin !== previewOrigin) return

    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return
    const message = event.data as Record<string, unknown>
    if (typeof message.type !== 'string') return

    switch (message.type) {
        case EDITOR_SECTION_SELECT_MESSAGE: { ... }
        case INSPECTOR_SECTION_HOVERED: { ... }
        case INSPECTOR_HOVER_CLEARED: { ... }
        case INSPECTOR_ADD_SECTION_INTENT: { ... }
        default: break
    }
}
```

**Origin guard:** `if (!previewOrigin || event.origin !== previewOrigin) return` — **fail-closed**. When `previewOrigin` is null (no preview URL configured), ALL messages are rejected. When `previewOrigin` is set, only messages from that exact origin are processed.

**Shape guard:** Non-object or non-string-type payloads are dropped before the switch.

**Unknown types:** Fall to `default: break` — no `eval`, no `innerHTML`, no navigation from payload.

**Per-field payload validation in each case:**
- `EDITOR_SECTION_SELECT_MESSAGE`: `typeof message.sectionId === 'string'` before invoking `onSelectSection`.
- `INSPECTOR_SECTION_HOVERED`: `typeof message.sectionId === 'string' && typeof message.sectionType === 'string'` before `setHoveredSection`.
- `INSPECTOR_HOVER_CLEARED`: no field extraction required (clears state unconditionally when origin valid).
- `INSPECTOR_ADD_SECTION_INTENT`: `typeof adjacentSectionId === 'string'` AND `pos === 'before' || pos === 'after'` before invoking `onAddSectionIntent`. Both fields must pass before the callback fires.

**Verified by contract test:** "CenterPanel validates event.origin before acting on inbound messages" + "CenterPanel handleMessage rejects messages when previewOrigin is falsy".

### 4.2 StorefrontPreviewBridge (Preview — Receive from Editor)

```typescript
function handleMessage(event: MessageEvent) {
    const editorOrigin = getEditorOrigin();
    if (!editorOrigin || event.origin !== editorOrigin) return;   // ← fail-closed
    ...
    if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE) {
        const sectionId = typeof data.sectionId === 'string'
            ? data.sectionId
            : typeof data.selectedSectionId === 'string' ? data.selectedSectionId : '';
        if (sectionId) {
            selectSection(sectionId, type === SCROLL_MESSAGE);
        }
        return;
    }
    if (type === VIEWPORT_MESSAGE || type === LEGACY_VIEWPORT_MESSAGE) {
        const viewport = normalizeViewport(data.viewport);
        if (viewport) applyViewport(viewport);
    }
}
```

**Origin guard (fail-closed after hardening):** `if (!editorOrigin || event.origin !== editorOrigin) return`. When `NEXT_PUBLIC_ADMIN_URL` is absent and referrer is unavailable, `editorOrigin` is empty string — ALL messages are rejected. This is fail-closed behavior.

**Pre-hardening vulnerability (MEDIUM severity, now fixed):** The guard was `if (editorOrigin && event.origin !== editorOrigin) return`. When `editorOrigin` was empty string, the condition `editorOrigin && ...` was falsy — the guard was entirely skipped, and all messages from any origin were processed. An attacker embedding the preview in their own iframe could have sent `LEGACY_SELECTION_MESSAGE` or `SCROLL_MESSAGE` to trigger section scrolling and the flash animation. No data exfiltration was possible; the impact was limited to UI manipulation.

**Field validation:** `sectionId` extracted with string type check and `''` fallback; only non-empty sectionIds are passed to `selectSection`. `normalizeViewport` has an explicit whitelist (`'desktop' | 'tablet' | 'mobile'`) and returns `null` for any other value.

**Verified by contract test:** "hardening: bridge receive guard is fail-closed".

### 4.3 EditorPreviewSectionFrame (Preview — Receive from Bridge)

```typescript
function handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;   // ← same-window only
    const data = asRecord(event.data);
    const type = data.type;

    if (type === SELECTED_MESSAGE) {
        setIsSelected(typeof data.sectionId === 'string' && data.sectionId === sectionId);
        return;
    }
    if (type === SCROLLED_TO_MESSAGE && typeof data.sectionId === 'string' && data.sectionId === sectionId) {
        triggerFlash();
    }
}
```

**Origin guard:** `event.origin !== window.location.origin` — accepts only same-window dispatches. The bridge posts `SELECTED_MESSAGE` and `INSPECTOR_SECTION_SCROLLED_TO` both to `window.location.origin`. Any cross-origin sender is rejected — no attacker can inject false selection or flash triggers cross-origin.

**Why `window.location.origin` (not `editorOrigin`) here:** This handler processes same-window messages dispatched by the bridge (not cross-origin messages from the editor parent). The bridge dispatches these after it has already validated the cross-origin message from the editor. The section frame's receive guard enforces a different trust boundary: "only the bridge, running in the same window, can update my selection state."

---

## 5. No-Echo Self-Loop Preservation

The no-echo self-loop guard is a pre-existing invariant from the Phase C Liquid transformation program. It prevents infinite message loops in the bridge:

**The loop that must not exist:**
```
Editor → EDITOR_SELECTION_MESSAGE → bridge.handleMessage
  → selectSection → window.postMessage(EDITOR_SELECTION_MESSAGE, same-window)
    → bridge.handleMessage → selectSection → ... [∞]
```

**Phase C guard (preserved in Phase S):**
```typescript
if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE) { ... }
// EDITOR_SELECTION_MESSAGE is NOT in this condition.
```

`EDITOR_SELECTION_MESSAGE` is deliberately excluded from the translation branch. The bridge's `selectSection` re-posts `EDITOR_SELECTION_MESSAGE` same-window for `EditorPreviewSectionFrame` to consume — but the bridge's own `handleMessage` does NOT re-process it because:
1. The origin guard rejects same-window posts: `event.origin` for a same-window dispatch equals `window.location.origin`, which is NOT equal to `editorOrigin` (the admin app origin). The guard `!editorOrigin || event.origin !== editorOrigin` fires and returns early.
2. The type-check fallback: even without the origin guard, `EDITOR_SELECTION_MESSAGE` is not in the `if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE)` branch.

**`INSPECTOR_SECTION_SCROLLED_TO` loop that must not exist:**
```
bridge.selectSection → window.postMessage(INSPECTOR_SECTION_SCROLLED_TO, window.location.origin)
  → bridge.handleMessage?
```

**Why it cannot loop:** The origin guard catches it first. `INSPECTOR_SECTION_SCROLLED_TO` is dispatched same-window, so `event.origin = window.location.origin ≠ editorOrigin` → guard fires → message never reaches the type dispatcher in the bridge. The constant is also not in the translation branch. Double exclusion.

**Contract test:** "bridge translation branch still does not match SELECTED_MESSAGE (self-loop guard)" — asserts `type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE` is present and that neither `type === SELECTED_MESSAGE || type === SCROLL_MESSAGE` nor `LEGACY_SELECTION_MESSAGE || type === SELECTED_MESSAGE` appears. "bridge INSPECTOR_SECTION_SCROLLED_TO is naturally excluded from translation handler by origin guard" — asserts the origin guard exists and `type === SCROLLED_TO_MESSAGE` does not appear in the translation branch.

---

## 6. RISK-DUAL-N01 Enforcement

RISK-DUAL-N01 (the editor save must reconstruct `section_definitions`/`block_definitions` from `baseConfig`, not `editorState`) must be preserved by Phase S. The inspector bridge adds a new potential mutation surface — the preview could theoretically send section objects to the editor, which could mutate the draft config.

**Phase S enforcement:** `INSPECTOR_ADD_SECTION_INTENT` carries only `{ adjacentSectionId: string, position: 'before' | 'after' }`. No section object, no type, no settings. `EditorPreviewSectionFrame.sendAddIntent()` contains no reference to any template document state (`template.sections`, `sections.push`, `sections.splice`, `sections.filter` are all absent from the file).

**Contract test:** "section frame never mutates template sections — sends intent only" — asserts these patterns are absent and that `adjacentSectionId` and `position` are the only fields sent.

`CenterPanel.handleMessage` for `INSPECTOR_ADD_SECTION_INTENT` extracts `adjacentSectionId` and `position`, validates both, and calls `onAddSectionIntent?.(adjacentSectionId, position)`. The callback in the editor page is responsible for opening the add-section UI — it decides whether and how to mutate the section list. The bridge never mutates sections itself.

---

## 7. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| No `USING (true)` on tenant tables | MAINTAINED — no DB changes |
| Canonical ledger (`canonical-ledger-only-validator`) | MAINTAINED — no money table mutations |
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| `publish_theme_release` SECURITY DEFINER RPC unchanged | MAINTAINED |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps (app-marketplace, developer-portal, theme-marketplace) unchanged | MAINTAINED |
| No client-side realtime subscription over `theme_editor_drafts` | MAINTAINED (RISK-SEC-P01 remains open) |
| No `'*'` wildcard as postMessage `targetOrigin` (all sends) | CONFIRMED — CenterPanel, bridge, section frame |
| Receive-side: `event.origin` validation before acting | CONFIRMED — all three participants |
| Fail-closed: bridge receive guard rejects all messages when editorOrigin unknown | CONFIRMED |
| No-echo self-loop guard for `EDITOR_SELECTION_MESSAGE` preserved | CONFIRMED |
| `INSPECTOR_SECTION_SCROLLED_TO` excluded from cross-origin handler by origin guard | CONFIRMED |
| RISK-DUAL-N01: preview sends intent only, never mutates sections | CONFIRMED |
| No new gateway routes | CONFIRMED |
| No new database migrations | CONFIRMED |
| No new authentication paths | CONFIRMED |

---

## 8. Open Residuals

All HIGH and MEDIUM findings were addressed before phase close. The following are LOW findings that were also resolved in the hardening pass:

| Finding ID | Severity | Status |
|---|---|---|
| READY_MESSAGE wildcard fallback | LOW | FIXED — suppressed when origin unknown |
| Raw px/hex in inspector overlay CSS | LOW | FIXED — `--lb-*` tokens throughout |
| No `prefers-reduced-motion` guard on flash | LOW | FIXED — guard added to storefront globals.css |

No new residual risks were introduced. RISK-SEC-P01 (`theme_editor_drafts` RLS gap) remains open from Phase P and is untouched by Phase S.
