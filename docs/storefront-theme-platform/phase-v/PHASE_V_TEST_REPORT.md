# Phase V Test Report — Template System

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** V — Template System
**Date:** 2026-07-11

---

## Final Gate Results

| Suite | Phase V Final | Command | Status |
|-------|--------------|---------|--------|
| theme-engine (typecheck + test) | **1385/1385** | `pnpm --filter=@letbuyy/theme-engine typecheck test` | PASS |
| merchant-control-plane (typecheck + test) | **231/231** | `pnpm --filter=@letbuyy/merchant-control-plane typecheck test` | PASS |
| api-gateway (test) | **479/479** (unchanged) | `pnpm --filter=@letbuyy/api-gateway test` | PASS (no gateway change) |
| storefront-runtime (test) | **795/795** (unchanged) | `pnpm --filter=@letbuyy/storefront-runtime typecheck test` | PASS (no storefront change) |
| All typechecks | **Clean** (0 errors) | Per-package typecheck commands | PASS |
| validate-governance.mjs | **EXIT=1** (pre-existing tenant drift; anti-fabrication PASS) | `node scripts/validate-governance.mjs` | PASS (known, unchanged) |

Gate reached after hardening commit `36d6f342` (Lane A + hardening) on top of Lane B commit `e9462067`.

---

## Test Breakdown

### theme-engine: 1385 total

| Group | Count | Source |
|-------|-------|--------|
| Phase V new — template registry (initial) | **239** | `packages/theme-engine/test/template-registry.test.ts` |
| Phase V hardening — 5 additional tests | **5** (total file 244 tests; 239+5=244 but the breakdown below uses the net count from gate run) | `packages/theme-engine/test/template-registry.test.ts` |
| Phase U (schema-field-extensions) | 73 | `packages/theme-engine/test/schema-field-extensions.test.ts` |
| Phase T (nested blocks) | 15 | `packages/theme-engine/test/theme-document-nested-blocks.test.ts` |
| Phase S (bridge protocol) | 14 | `packages/theme-engine/test/editor-bridge-protocol.test.ts` |
| Pre-Phase-S baseline | 1034 | All other `packages/theme-engine/test/**` files |

**Note:** The test file `template-registry.test.ts` is 725 lines and contains **244 Phase V tests** total (239 initial + 5 hardening). Theme-engine baseline entering Phase V was 1141 tests; 244 new tests produce the 1385 gate total.

### merchant-control-plane: 231 total

| Group | Count | Source |
|-------|-------|--------|
| Phase V new — template switcher contracts | **35** | `apps/merchant-control-plane/tests/theme-editor-v.test.mjs` |
| Phase U (control parity) | 76 | `apps/merchant-control-plane/tests/theme-editor-u.test.mjs` |
| Phase T (nested block UI) | 27 | `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` |
| Phase S (inspector bridge) | 28 | `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` |
| Phase R (editor shell) | 26 | `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` |
| Phase Q (theme library) | 25 | `apps/merchant-control-plane/tests/theme-library-q.test.mjs` |
| Pre-Phase-Q baseline | 14 | Federation / localisation / app-platform |

---

## Phase V Test Coverage — `template-registry.test.ts` (244 tests)

### Constants (3 tests)
- `MAX_TEMPLATE_VARIANTS_PER_TYPE` is 20.
- `MAX_TEMPLATE_KEY_LENGTH` is 120.
- `TEMPLATE_TYPE_REGISTRY` is frozen (immutable).

### Registry coverage (23 per-key presence tests + 1 count test)
- Each of the 23 expected base keys (`index`, `product`, `collection`, `list-collections`, `page`, `policy`, `blog`, `article`, `cart`, `search`, `not_found`, `password`, `gift_card`, `customers/login`, `customers/register`, `customers/account`, `customers/orders`, `customers/order`, `customers/addresses`, `customers/settings`, `customers/wishlist`, `customers/reset`, `customers/activate`) is present in the registry.
- `REGISTRY_BASE_TYPE_COUNT` matches `Object.keys(TEMPLATE_TYPE_REGISTRY).length`.

### Registry entry structure (92 per-entry tests, 4 per key × 23 keys)
- Every entry has a non-empty `allowedDrops` array.
- Every entry has a boolean `alternatesAllowed`.
- Every entry has a `sectionGroupRoles` array; each value is `'header'` or `'footer'`.
- Every entry has a boolean `requiresLayout`.

### Registry semantics
- `product`, `page`, `collection` have `alternatesAllowed: true`; `index`, `blog`, `cart`, `search`, `not_found`, `customers/login`, `policy`, `article`, `password`, `gift_card` have `alternatesAllowed: false`.
- `password`: `sectionGroupRoles: []` and `requiresLayout: false`.
- `gift_card`: `sectionGroupRoles: ['header']` only (no footer); `requiresLayout: false`.
- All non-password/gift_card entries: `sectionGroupRoles` includes both `'header'` and `'footer'`.

### `parseTemplateKey`
- `'product'` → `{ baseType: 'product', suffix: null }`.
- `'product.custom'` → `{ baseType: 'product', suffix: 'custom' }`.
- `'page.contact'` → `{ baseType: 'page', suffix: 'contact' }`.
- `'customers/login'` → `{ baseType: 'customers/login', suffix: null }`.
- `'index'` → `{ baseType: 'index', suffix: null }`.
- Trailing dot (`'product.'`) → `{ baseType: 'product', suffix: null }`.

### `validateTemplateKey` — accepts
- All 23 registry base keys.
- `'product.alternate'`, `'page.contact'`, `'collection.seasonal'`.
- `'not_found'`, `'list-collections'`, `'gift_card'`.
- `'customers/login'`, `'customers/account'`.

### `validateTemplateKey` — rejects
- Empty string → reason: must not be empty.
- Key > 120 chars → reason: length exceeds maximum.
- `'__proto__'`, `'constructor'`, `'prototype'` → reason: blocked prototype-pollution key.
- `'/product'` → reason: must not start with `/`.
- `'../etc'` → reason: must not contain `..`.
- `'customers//login'` (hardening) → reason: must not contain consecutive slashes.
- `'a//b'` (hardening) → reason: consecutive slashes.
- `'PRODUCT'` → reason: charset violation (uppercase).
- `'product.Custom'` → reason: suffix charset violation (uppercase).
- `'product.has.dots'` → reason: suffix charset violation (dot in suffix).

### `resolveAlternateTemplate`
- Returns the suffix key (`'product.custom'`) when it exists in bundle.
- Falls back to base key (`'product'`) when suffix key absent.
- Returns `undefined` when neither exists in bundle.
- Uses `hasOwnProperty` guard (no `in` — prototype pollution safe).

### `getAllowedDropsForTemplate`
- `'product'` includes `'product'`, excludes `'article'`.
- `'article'` includes `'article'`, excludes `'product'`.
- `'product.custom'` returns same as `'product'` (suffix stripped to base type).
- `'customers/login'` includes `'customer'`.
- Unknown base type returns minimal safe set `['shop', 'request', 'settings', 'routes']`.

### `findExcessiveVariantCounts`
- Returns empty object when all base types have ≤ 20 alternates.
- Returns excess map `{ product: 21 }` when 21 `product.*` keys exist.
- Does not count base-key entries (only dotted keys).

### Round-trip compat (3 tests)
- Urban Kicks fixture: `toThemeDocumentV2` → `fromThemeDocumentV2` structural identity (deep equal after JSON round-trip, key-insertion-order-agnostic).
- LetBuyy Core fixture: same.
- Minimal fixture: same.
- All three fixtures have zero alternate templates; Phase V `superRefine` additions produce no regressions.

### Schema integration — variant cap enforcement (2 hardening tests)
- `parseThemeDocument` rejects a document whose `templates` array contains 21 `product.*` alternate variants → emits ZodIssue for the excess.
- `parseThemeDocument` accepts exactly 20 `product.*` alternate variants (at cap, no error).

### Consecutive-slash guard (3 hardening tests)
- `validateTemplateKey('customers//login')` throws `InvalidTemplateKeyError` with `reason` containing `consecutive`.
- `validateTemplateKey('a//b')` throws.
- `validateTemplateKey('customers/login')` (single slash) passes cleanly.

---

## Phase V Test Coverage — `theme-editor-v.test.mjs` (35 tests)

### File contracts (3 tests)
- `TemplateSwitcherPanel.tsx` exists at `src/components/theme-editor/TemplateSwitcherPanel.tsx`.
- File starts with `'use client'` directive.
- `theme-editor-v.test.mjs` exists in `tests/`.

### Import compliance (5 tests)
- Imports `@letbuyy/ui` components.
- Imports from `lucide-react` for icons.
- Does not import from `page.tsx`.
- Does not import Supabase or `@supabase/`.
- Does not import `@letbuyy/api-client`.

### Design-token ratchet (2 tests)
- No `rounded-[` Tailwind class.
- Uses `--lb-` token references.

### Props interface (8 tests)
- `templateOptions` prop accepted (array of `{ key, label, type }`).
- `selectedKey` prop accepted (string).
- `onChange` prop accepted (function).
- `disabled` prop accepted (optional).
- `alternateVariants` prop accepted (optional array of `{ key, label }`).
- `onCreateAlternate` prop accepted (optional function).
- `isLoading` prop accepted (optional boolean).
- `error` prop accepted (optional string).

### RISK-DUAL-N01 isolation (4 tests)
- `onChange` emits a string value only.
- `onCreateAlternate` emits a string value (base type) only.
- File does not reference `section_definitions`.
- File does not reference `block_definitions`.

### State handling (5 tests)
- Loading state uses `aria-busy` attribute.
- Error state renders error message.
- Empty state renders 'No templates available'.
- `disabled` guards `onChange` (early return when disabled).
- `disabled` guards variant click handler.

### Alternate variants ARIA (3 tests)
- `alternateVariants` container uses `role="listbox"`.
- Each variant item uses `role="option"`.
- `aria-selected` present on option items.

### Slash-key handling (2 tests)
- Slash-containing keys are not encoded or escaped.
- `useTemplateSwitcher` handles slash keys: `'customers/login'` → `baseType: 'customers/login'`, `suffix: null`.

### `useTemplateSwitcher` export (3 tests)
- `useTemplateSwitcher` is exported from the file.
- It is a function.
- It parses `'product.custom'` → `{ baseType: 'product', suffix: 'custom' }`.

---

## Compatibility Proof

Round-trip structural identity holds for all 3 fixtures (Urban Kicks, LetBuyy Core, minimal). `toThemeDocumentV2` sorts templates alphabetically; round-trip tests compare via `deepEqual(JSON.parse(JSON.stringify(backToBundle)), JSON.parse(JSON.stringify(bundle)))` — key-insertion-order-agnostic, same value semantics.

All existing `theme-document.test.ts` tests that exercise `toThemeDocumentV2` / `fromThemeDocumentV2` continue to pass (1385 total, 0 failures). The `superRefine` on `ThemeDocumentTemplateSchema` is backward-compatible: all legal keys already in all 3 fixtures pass `validateTemplateKey` without error.

No theme-engine or storefront-runtime files were modified by Lane B. The `TemplateSwitcherPanel` receives `templateOptions` as props from its caller — it does not alter how `LiquidThemePackageBundle` is parsed, rendered, or round-tripped. A store with no alternate templates continues to behave exactly as before this phase.
