# Phase Y — Security Review: App-Block Sandboxing, Isolation, and Crash Isolation

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Y — Theme App Extensions
**Date:** 2026-07-11
**Reviewer:** Phase Y documentation pass (automated, ground-truth verified)
**Status:** REVIEW COMPLETE — 1 LOW finding open, all others resolved

---

## 1. Sandbox Contract

All app-provided HTML that reaches `resolveLiquidAppBlockHtml` in `theme-renderer.ts` **flows through `sanitizeRenderedHtml`** (lines 1156–1157). This function calls DOMPurify with the **locked** `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`:

```typescript
FORBID_TAGS: ['base', 'embed', 'object', 'script']
FORBID_ATTR: ['style']
uponSanitizeAttribute hook: strips data-* with angle brackets; blocks javascript: and data:text/html srcs
ADD_ATTR: ['data-app-block-app-id', 'data-app-block-extension-id',
           'data-app-block-slot', 'data-app-block-type', 'data-letbuyy-app-block']
```

**Phase Y did NOT modify this config.** The config is confirmed locked.

### 1.1 Proof (tests Y-1, Y-2, Y-12)

| Test | Vector | Result |
|------|--------|--------|
| Y-1 | `<script>alert("xss")</script>` in app HTML | `<script>` tag stripped; safe text preserved |
| Y-2 | `<img onerror="alert('xss')">` in app HTML | `onerror` attribute stripped |
| Y-12 | `<img src="javascript:alert('xss')">` | `javascript:` src stripped by `uponSanitizeAttribute` hook |

### 1.2 Placeholder path (no app runtime — miss path)

When `resolveLiquidAppBlockHtml` finds no entry in `input.liquidAppBlocks` (line 1160), it emits a static placeholder `<div>` using `escapeHtmlAttribute` over `blockId` and `block.type`. This path does **NOT** call `sanitizeRenderedHtml`.

**Why this is safe:** `blockId` and `block.type` are produced by `LiquidThemePackageBundleSchema` Zod validation before entering the renderer. The bundle schema enforces block type as an enum/pattern and block id as a keyed Record field. No untrusted merchant input reaches these values at render time without prior schema parsing. Test Y-14 asserts that the placeholder carries no angle brackets even when `block.type` is adversarial.

---

## 2. Credential-Key Isolation (GAP-Y-01 — Closed)

### 2.1 The gap (pre-Phase Y)

`BLOCKED_DROP_KEYS` was applied to global theme settings (theme-renderer.ts lines 905, 919) but NOT to block-level settings entering the Liquid section scope (lines 415–421: `section.blocks[i].settings`). An app-block section template echoing `{{ block.settings.api_key }}` would leak the raw value.

### 2.2 The fix (Phase Y — Lane A)

`filterAppBlockSettings` (new, `app-block-model.ts`) is applied at the `isLiquidAppBlockType` branch in `renderLiquidSectionBlocks`, **before** settings are pushed into `LiquidRenderedBlock.settings` and into the Liquid drop. The function:

1. Iterates own `Object.entries(settings)`.
2. Skips keys that fail `/^[a-zA-Z][a-zA-Z0-9_]*$/` (identifier pattern; same discipline as `filterBlockedSettingsKeys`).
3. Skips keys in `BLOCKED_APP_BLOCK_SETTING_KEYS` (13 keys: `__proto__`, `constructor`, `prototype`, `password`, `password_hash`, `access_token`, `refresh_token`, `signing_secret`, `client_secret`, `api_key`, `secret_key`, `private_key`, `webhook_secret`).

### 2.3 Parity enforcement

Test Y-13 imports both `BLOCKED_APP_BLOCK_SETTING_KEYS` (from `app-block-model.ts`) and `BLOCKED_DROP_KEYS` (from `theme-renderer.ts`) and asserts `deepEqual` of their sorted arrays. A future addition to either set that is not mirrored will fail the test gate.

### 2.4 Proof (tests Y-3, Y-3b, Y-11a)

| Test | Assertion |
|------|-----------|
| Y-3 | `filterAppBlockSettings` strips `api_key`, `access_token`, `webhook_secret`, `password`, `client_secret`, `__proto__`, `constructor`; preserves `title`, `description` |
| Y-3b | Credential settings do not reach `LiquidRenderedBlock.settings`; raw value does not appear in rendered HTML |
| Y-11a | `filterAppBlockSettings` strips ALL 13 `BLOCKED_APP_BLOCK_SETTING_KEYS` |

### 2.5 Scope

This fix covers the **app-block settings path** (isLiquidAppBlockType branch). Regular (non-app) block settings at lines 818 and 824 still pass without `filterBlockedSettingsKeys` — RISK-T03 remains PARTIALLY OPEN for non-app blocks. Phase Y closes the app-block gap only.

---

## 3. Per-Block Crash Isolation (GAP-Y-02 — Closed)

### 3.1 The gap (pre-Phase Y)

No `try/catch` wrapped the `isLiquidAppBlockType` branch. A throwing `resolveLiquidAppBlockHtml` call (e.g., a getter on the `html` property that throws) propagated up the section render loop and could surface as an unhandled exception.

### 3.2 The fix (Phase Y — Lane A)

A `try/catch` now wraps the entire app-block resolution and push:
- **`try`**: apply `filterAppBlockSettings`, call `resolveLiquidAppBlockHtml`, push the `LiquidRenderedBlock`.
- **`catch`**: push an `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` (`'lb-app-block-placeholder--error'`) div; `continue` to the next block.

The raw error message is captured in the catch block and NOT forwarded to the rendered HTML.

### 3.3 Proof (test Y-4)

Test Y-4 uses two app blocks (`good-app`, `bad-app`). `bad-app`'s `html` property getter throws. Assertions:
- Render status is `'rendered'` (not an error).
- Good app block content (`good-app-content`) is present in output.
- `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` is present in output.
- Raw error message `'Simulated app-block runtime failure'` does NOT appear in HTML.

---

## 4. App-Block Validation (AppBlockReference Schema)

### 4.1 ID pattern enforcement

`AppBlockReferenceSchema` applies `APP_BLOCK_SLUG_PATTERN` (`/^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/`) to `appId` and `extensionId`. This rejects:
- Path traversal sequences (`../evil/path` — rejected by Y-9b)
- Tag injection attempts (`ext<script>` — rejected by Y-9c)
- Dots, angle brackets, slashes, colons

### 4.2 Slot pattern

`APP_BLOCK_SLOT_PATTERN` (`/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`) enforces the `surface.page.position` convention and rejects arbitrary strings.

### 4.3 Credential key rejection at validation time

`validateAppBlockReference` additionally rejects any settings record containing `BLOCKED_APP_BLOCK_SETTING_KEYS` keys. This surfaces a validation error at reference construction time — before the key reaches storage or the render path — so the double-filter (validate + filterAppBlockSettings at render time) is defence-in-depth (test Y-9d).

### 4.4 Slot count cap

`validateAppBlockReferences` enforces `MAX_APP_BLOCKS_PER_SLOT = 20`. Tests Y-10c (exceeds limit), Y-10d (exactly at limit), Y-10e (custom maxCount override).

---

## 5. Open Findings

### FINDING-Y-01 — LOW — MAX_APP_BLOCKS_PER_SLOT not enforced in the render loop

**Severity:** LOW
**File:** `packages/theme-engine/src/theme-renderer.ts`
**Status:** OPEN — not fixed in Phase Y; registered in RISK_REGISTER.md as RISK-Y01.

**Description:** `validateAppBlockReferences` enforces the 20-block-per-slot limit at reference-construction / save time. The render loop in `renderLiquidSectionBlocks` iterates `orderedKeys(input.section.blocks, ...)` without a corresponding per-slot app-block count check. A crafted bundle that bypasses the validator (which is applied before storage) could cause the renderer to process more than 20 app blocks per section.

**Attack surface:** Requires an authenticated merchant-supplied bundle whose `section.blocks` contains more than 20 `@app` entries. All bundle data flows through `LiquidThemePackageBundleSchema.parse` before storage; that parse enforces the `superRefine` depth check and other structural guards. The missing defence-in-depth is at the render boundary only.

**Suggested fix:** Track app block renders per section in `renderLiquidSectionBlocks`; once the count exceeds `MAX_APP_BLOCKS_PER_SLOT`, emit `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` instead of continuing to resolve. Import `MAX_APP_BLOCKS_PER_SLOT` from `app-block-model.ts`.

---

## 6. Editor Sandbox Audit (Lane B)

### 6.1 dangerouslySetInnerHTML — ABSENT

`AppBlockSlotPanel.tsx` contains zero uses of `dangerouslySetInnerHTML`, `innerHTML` assignment, or raw HTML injection of any kind. The component manages `AppBlockReference` metadata (extension_id, app_id, title, slot) only. Tests: theme-editor-y.test.mjs lines 233 (source pattern check), 489 (innerHTML absence).

### 6.2 Block type preservation — ENFORCED

The component calls `onAddBlock(sectionId, '@app')`. `extension_id` is stored in `block.settings`, never used as a `block.type` override. `isLiquidAppBlockType('@app') === true` is guaranteed, ensuring the renderer always routes the block through the sanitiser path. Test: line 494 (`'@app'` type preserved).

### 6.3 section_definitions / block_definitions — ISOLATED

`AppBlockSlotPanel.tsx` has no import or prop path to `section_definitions` or `block_definitions`. Mutations route through `onAddBlock` / `onUpdateBlockSettings` / `onRemoveBlock` / `onMoveBlock` only (value-carrying, no schema fields). Tests: lines 477 (no `section_definitions` assignment), 484 (no `block_definitions` assignment).

### 6.4 Tenancy

`route.ts`: `resolveOwnedStoreId` verifies the session merchant owns the store. `store_id` passed to the gateway always comes from `resolved.storeId` (server-side verified), never from the browser-supplied `[store]` param directly. The gateway further verifies `verifySiteOwnership`. Cross-tenant extension IDs cannot reach the browser.

---

## 7. Risks Addressed by Phase Y

| Risk ID | Pre-Phase Y Status | Post-Phase Y Status |
|---------|-------------------|---------------------|
| GAP-Y-01 (BLOCKED_DROP_KEYS gap for app blocks) | OPEN (design audit) | CLOSED — `filterAppBlockSettings` applied in render loop |
| GAP-Y-02 (no crash isolation for app blocks) | OPEN (design audit) | CLOSED — `try/catch` wrapping app-block branch |
| GAP-Y-03 (no typed AppBlockReference) | OPEN (design audit) | CLOSED — `AppBlockReferenceSchema` + validators exported |
| RISK-T03 (block settings bypass filterBlockedSettingsKeys) | OPEN — app-block path unprotected | PARTIALLY CLOSED — app-block path now protected via `filterAppBlockSettings`; non-app block settings still unprotected |
| RISK-Y01 (render-loop slot count not capped) | NEW (found in Phase Y) | OPEN — LOW; defence-in-depth gap |

All other risks listed in RISK_REGISTER.md carry to Phase Z or first file touch unchanged.
