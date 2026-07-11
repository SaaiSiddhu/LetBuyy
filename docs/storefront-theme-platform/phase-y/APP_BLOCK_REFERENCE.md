# App-Block Reference

**Module:** `packages/theme-engine/src/app-block-model.ts`
**Phase:** Y — Theme App Extensions
**Last updated:** 2026-07-11

---

## 1. Overview

The app-block model defines the typed contract between the LetBuyy theme engine and installed app extensions placed into **app-block-slot** sections. An app-block-slot section is a Liquid section of type `'app-block-slot'` whose `blocks` map may contain one or more blocks of type `'@app'` (or `'app:{extensionHandle}'`). Each such block holds an `AppBlockReference` in its settings.

**NOT-CONNECTED honest state:** No live app runtime currently produces app-block HTML. `apps/app-marketplace` and `apps/developer-portal` are FROZEN (not deploy targets). The composition layer constructs first-party static HTML from `app_installations` / `app_extension_registrations` DB metadata only. See §9.

---

## 2. AppBlockReference

```typescript
interface AppBlockReference {
  /** Installed-app identifier. Must match app_installations.app_id. */
  appId: string;
  /** Extension within the app that supplies block HTML. */
  extensionId: string;
  /**
   * Slot position. Convention: '{surface}.{page}.{position}'.
   * Example: 'storefront.home.after-hero'
   */
  slot: string;
  /**
   * Merchant-configured settings. Filtered through filterAppBlockSettings
   * before any Liquid scope exposure.
   */
  settings: Record<string, unknown>;
  /** When true, block is skipped at render time but kept in the draft. */
  disabled?: boolean;
}
```

---

## 3. Constants

### `MAX_APP_BLOCKS_PER_SLOT`

```typescript
export const MAX_APP_BLOCKS_PER_SLOT = 20;
```

Maximum number of `AppBlockReference` entries allowed in a single slot instance. Enforced at reference-construction time by `validateAppBlockReferences`. The render loop does not currently enforce this limit (RISK-Y01, LOW, defence-in-depth gap).

### `BLOCKED_APP_BLOCK_SETTING_KEYS`

```typescript
export const BLOCKED_APP_BLOCK_SETTING_KEYS: ReadonlySet<string>;
```

The 13 credential-adjacent setting keys that must never reach the Liquid template scope from app-block settings:

```
__proto__, constructor, prototype,
password, password_hash,
access_token, refresh_token,
signing_secret, client_secret,
api_key, secret_key, private_key,
webhook_secret
```

This set mirrors `BLOCKED_DROP_KEYS` in `theme-renderer.ts`. Test Y-13 asserts runtime equality of the two sorted arrays. When adding a key to either set, add it to both and update SEC-7 in `qi-security.test.ts`.

### `APP_BLOCK_PLACEHOLDER_CLASS`

```
'lb-app-block-placeholder--not-connected'
```

CSS class on the placeholder `<div>` rendered when no app runtime HTML is available for a given block (NOT-CONNECTED state). The div carries `data-letbuyy-app-block` and `data-app-block-type` attributes (both in the DOMPurify `ADD_ATTR` allowlist).

### `APP_BLOCK_ERROR_PLACEHOLDER_CLASS`

```
'lb-app-block-placeholder--error'
```

CSS class on the placeholder `<div>` rendered when a single app-block resolution throws. Per-block crash isolation: the throwing block emits this placeholder; all other blocks in the section continue rendering normally.

### `APP_BLOCK_NOT_CONNECTED_REASON`

A human-readable string exported for logging and honest-state documentation. Includes 'NOT-CONNECTED', 'FROZEN' (apps/app-marketplace), and the missing-piece description.

---

## 4. Zod Schema

```typescript
export const AppBlockReferenceSchema = z.object({
  appId:       z.string().min(1).max(120).regex(/^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/),
  extensionId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/),
  slot:        z.string().min(1).max(200).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  settings:    z.record(z.string(), z.unknown()).default({}),
  disabled:    z.boolean().optional(),
});
```

**`appId` / `extensionId` slug pattern:** `^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$` — alphanumeric with hyphens/underscores as separators. Rejects dots, slashes, angle brackets, and other characters used for path traversal or tag injection.

**`slot` pattern:** `^[a-zA-Z0-9][a-zA-Z0-9._-]*$` — allows dots for the `surface.page.position` convention.

---

## 5. Validation Functions

### `validateAppBlockReference`

```typescript
function validateAppBlockReference(input: unknown): AppBlockValidationResult;

interface AppBlockValidationResult {
  valid: boolean;
  ref?: AppBlockReference;  // present only when valid === true
  errors: string[];
}
```

Validates a single `AppBlockReference`. Rejects:
- Any input that fails `AppBlockReferenceSchema.safeParse` (non-object, missing required fields, bad slug patterns).
- Settings containing any key from `BLOCKED_APP_BLOCK_SETTING_KEYS` (early-validation — surfaces the error before storage; `filterAppBlockSettings` is the runtime defence-in-depth).

### `validateAppBlockReferences`

```typescript
function validateAppBlockReferences(
  inputs: unknown,
  maxCount?: number,  // default: MAX_APP_BLOCKS_PER_SLOT
): AppBlockReferencesValidationResult;

interface AppBlockReferencesValidationResult {
  valid: boolean;
  refs: AppBlockReference[];  // passing entries only
  errors: string[];
}
```

Validates an array of references. Enforces `maxCount` limit. Accumulates per-reference errors (prefixed with `[i]`); returns a partial `refs` array of passing entries alongside collected errors.

---

## 6. `filterAppBlockSettings`

```typescript
function filterAppBlockSettings(
  settings: Record<string, unknown>,
): Record<string, unknown>;
```

Strips credential-adjacent keys and non-identifier keys from app-block settings before they enter any Liquid scope.

**Algorithm:**
1. For each `[key, value]` in `Object.entries(settings)`:
   - Skip if key does not match `/^[a-zA-Z][a-zA-Z0-9_]*$/` (identifier pattern).
   - Skip if key is in `BLOCKED_APP_BLOCK_SETTING_KEYS`.
   - Otherwise include in output.
2. Returns a new object (never mutates input).

**Call site:** `theme-renderer.ts` `renderLiquidSectionBlocks` — applied at the `isLiquidAppBlockType` branch before settings enter `LiquidRenderedBlock.settings` and the section-level Liquid drop (`section.blocks[i].settings`).

**Import rule:** `app-block-model.ts` must NOT import from `theme-renderer.ts`. `filterAppBlockSettings` is defined here independently to avoid a circular import cycle. `theme-renderer.ts` imports from `app-block-model.ts` (one-way, safe).

---

## 7. Render Path

```
theme-renderer.ts — renderLiquidSectionBlocks
  │
  ├─ isLiquidAppBlockType(block.type)? YES
  │    │
  │    ├─ try {
  │    │    filteredSettings = filterAppBlockSettings(block.settings)
  │    │    html = resolveLiquidAppBlockHtml(input, sectionId, blockId, block)
  │    │    │
  │    │    ├─ HIT in liquidAppBlocks map:
  │    │    │    sanitizeRenderedHtml(configured)  ← DOMPurify LOCKED CONFIG
  │    │    │
  │    │    └─ MISS (NOT-CONNECTED):
  │    │         escapeHtmlAttribute placeholder div
  │    │         (safe: blockId + block.type are bundle-schema-validated)
  │    │
  │    │    push LiquidRenderedBlock {
  │    │      id, type, settings: filteredSettings,  ← credential keys stripped
  │    │      content, isAppBlock: true
  │    │    }
  │    │
  │    └─ } catch {
  │         push APP_BLOCK_ERROR_PLACEHOLDER_CLASS div
  │         continue  ← crash isolation: other blocks render normally
  │       }
  │
  └─ isLiquidAppBlockType(block.type)? NO
       normal block render path (unchanged from pre-Phase-Y)
```

---

## 8. Editor Integration

**Component:** `apps/merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `storeName` | `string` | Store URL path param; used to build proxy URL |
| `sectionId` | `string` | ID of the app-block-slot section |
| `section` | section object | Current section state (blocks array) |
| `onAddBlock` | `(sectionId, type, settings) => void` | Add block; type always `'@app'` |
| `onUpdateBlockSettings` | `(sectionId, blockId, settings) => void` | Update block settings |
| `onRemoveBlock` | `(sectionId, blockId) => void` | Remove block |
| `onMoveBlock` | `(sectionId, blockId, direction) => void` | Reorder block |

**Proxy route:** `GET /api/stores/{storeName}/themes/app-blocks`

Returns `{ data: InstalledAppExtension[], not_connected: false }` on success, or `{ data: [], not_connected: true }` when the gateway endpoint is not yet deployed (honest NOT-CONNECTED state).

**SANDBOX LAW:** `AppBlockSlotPanel` never injects raw app HTML into the DOM. App HTML is rendered at storefront time through `resolveLiquidAppBlockHtml` → `sanitizeRenderedHtml` (locked DOMPurify). Zero `dangerouslySetInnerHTML` in the component.

**RISK-DUAL-N01:** mutations route through callbacks only; `section_definitions`/`block_definitions` never accessed or mutated.

---

## 9. NOT-CONNECTED State

| Surface | Behaviour |
|---------|-----------|
| `AppBlockSlotPanel` (editor) | Shows "No apps installed — NOT-CONNECTED" badge when proxy returns `not_connected: true` |
| `route.ts` proxy | Returns `{ data: [], not_connected: true }` when gateway 404 (endpoint not deployed) |
| `resolveLiquidAppBlockHtml` (renderer) | Emits `APP_BLOCK_PLACEHOLDER_CLASS` placeholder div when `liquidAppBlocks` map has no entry for the block |
| `APP_BLOCK_NOT_CONNECTED_REASON` | Exported honest string; asserted by test Y-8 |

**Missing pieces to connect a real app runtime:**
1. Deploy gateway `GET /themes/app-blocks` (reads `app_extension_registrations WHERE surface = 'theme.app_block'`).
2. Register apps in `app_installations` with live server URLs.
3. Have app servers supply sanitized HTML per `(siteId, appId, extensionId)` tuple.
4. Populate the `liquidAppBlocks` map in `storefront-runtime/composition-engine.tsx` from live server responses.
5. Ensure that HTML passes through `sanitizeRenderedHtml` before entering the map (already enforced inside `resolveLiquidAppBlockHtml`).

---

## 10. Security Contracts

| Contract | Mechanism | Test |
|----------|-----------|------|
| `<script>` stripped from app HTML | `sanitizeRenderedHtml` → DOMPurify `FORBID_TAGS: ['script']` | Y-1 |
| `onerror` / event handlers stripped | DOMPurify default behaviour | Y-2 |
| `javascript:` src blocked | `uponSanitizeAttribute` hook in locked config | Y-12 |
| `api_key`, `webhook_secret`, … never in Liquid scope | `filterAppBlockSettings` at push point | Y-3, Y-3b |
| Key blocklist parity (`BLOCKED_APP_BLOCK_SETTING_KEYS` == `BLOCKED_DROP_KEYS`) | Runtime deepEqual assertion | Y-13 |
| Crash isolation (one bad block → placeholder, rest render) | `try/catch` in `renderLiquidSectionBlocks` | Y-4 |
| Placeholder safe with adversarial block.type | `escapeHtmlAttribute` over schema-validated values | Y-14 |
| Editor: zero unsafe HTML injection | No `dangerouslySetInnerHTML` or `innerHTML` | theme-editor-y tests 233, 489 |
| Tenancy: cross-tenant extensions impossible | `resolveOwnedStoreId` + `verifySiteOwnership` | theme-editor-y tests 2, 7 |

---

## 11. Known Limitation (RISK-Y01)

`MAX_APP_BLOCKS_PER_SLOT` is enforced at the validation layer (save time) but NOT in the renderer's block iteration loop. A crafted bundle bypassing the validator could render more than 20 app blocks per section. All data flows through `LiquidThemePackageBundleSchema` before storage, so exploitation requires bypassing the bundle parser. Severity: LOW (defence-in-depth gap, not a direct exploit path).

Fix: add an app-block counter per section in `renderLiquidSectionBlocks`; emit `APP_BLOCK_ERROR_PLACEHOLDER_CLASS` once `MAX_APP_BLOCKS_PER_SLOT` is exceeded.
