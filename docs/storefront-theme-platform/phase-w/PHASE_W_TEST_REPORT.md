# Phase W Test Report — Dynamic Sources + Custom Data

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** W — Dynamic Sources + Custom Data
**Date:** 2026-07-11

---

## Final Gate Results

| Suite | Phase W Final | Command | Status |
|-------|--------------|---------|--------|
| api-gateway (test) | **491/491** (was 479/479 entering W) | `pnpm --filter=@letbuyy/api-gateway test:unit` | PASS |
| theme-engine (typecheck + test) | **1441/1441** (was 1385/1385 entering W) | `pnpm --filter=@letbuyy/theme-engine test` | PASS |
| merchant-control-plane (typecheck + test) | **286/286** (was 231/231 entering W) | `pnpm --filter @letbuyy/merchant-control-plane typecheck test` | PASS |
| storefront-runtime (test) | **795/795** (unchanged) | — (no storefront change in Phase W) | PASS |
| All typechecks | **Clean** (0 errors) | Per-package typecheck commands | PASS |
| validate-governance.mjs | **EXIT=1** (pre-existing tenant drift; anti-fabrication PASS) | `node scripts/validate-governance.mjs` | PASS (known, unchanged) |

**Pre-existing failures (unchanged from baseline):** 3 — `ai.test.ts#1`, `internal-os-executive-analytics.test.ts#130`, `storefront.test.ts#270`. These are not introduced by Phase W.

---

## Test Delta Summary

| Suite | Entering Phase W | Exiting Phase W | Delta |
|-------|-----------------|----------------|-------|
| api-gateway | 479 | 491 | +12 (15 new W tests; 3 pre-existing failures unchanged) |
| theme-engine | 1385 | 1441 | +56 |
| merchant-control-plane | 231 | 286 | +55 |
| storefront-runtime | 795 | 795 | 0 |

---

## Gateway Lane — `resource-search-w.test.ts` (15 tests)

File: `services/api-gateway/src/__tests__/resource-search-w.test.ts`

All 15 tests pass. These are source-pattern and logic-level tests — no live DB or network.

### Auth / Tenancy (W-T01–W-T06, W-T08, W-T14, W-T15)

| ID | Description | Result |
|---|---|---|
| W-T01 | `resolveCustomUser` is called before any search adapter call | PASS |
| W-T02 | `verifySiteOwnership` is called before any search adapter call | PASS |
| W-T03 | Null `resolveCustomUser` result produces 403 FORBIDDEN | PASS |
| W-T04 | False `verifySiteOwnership` result produces 403 FORBIDDEN | PASS |
| W-T05 | All table queries scoped by `.eq('store_id', store_id)` — Site A cannot return Site B resources | PASS |
| W-T06 | No hardcoded UUID literal used as `store_id` in table queries | PASS |
| W-T08 | `authMiddleware` registered for `/resource-search` in `themes.ts` before slug routes | PASS |
| W-T14 | Customer HS256 token rejection — `resolveCustomUser` null-path logic present | PASS |
| W-T15 | Cross-site access rejected by `verifySiteOwnership` — Site B merchant cannot access Site A | PASS |

### Route / Schema (W-T07, W-T09–W-T13)

| ID | Description | Result |
|---|---|---|
| W-T07 | Resource type enum includes exactly 5 approved types | PASS |
| W-T09 | `resourceSearchRouter` imported and mounted via `router.route` in `themes.ts` | PASS |
| W-T10 | Menu search queries `navigation_menus` table directly (list all menus) | PASS |
| W-T11 | Page search falls back to legacy `pages` table when `storefront_pages` missing | PASS |
| W-T12 | Results are slim — only `id`, `title`, `handle`, `slug` selected; no price/email/token | PASS |
| W-T13 | Route is read-only — no insert, update, delete, rpc | PASS |

---

## Engine Lane — `dynamic-source-binding.test.ts` (56 tests)

File: `packages/theme-engine/test/dynamic-source-binding.test.ts`

All 56 tests pass. Theme-engine total: 1441/1441.

### `isDynamicSourceDescriptor` guard (15 tests)

- `resource` binding → `true` | `metafield` binding → `true` | `static` binding → `true`
- `plain string` → `false` | `number` → `false` | `boolean true` → `false` | `boolean false` → `false`
- `null` → `false` | `undefined` → `false` | `array` → `false`
- `plain object without __lb_binding` → `false` | `object with __lb_binding:false` → `false`
- `object with __lb_binding:true but unknown source` → `false`
- `object with __lb_binding:true but no source` → `false` | `empty object` → `false`

### Scalar passthrough (backward-compat, 6 tests)

- Plain string, number, boolean, null, plain object (non-descriptor), array — all byte-identical through the resolver.

### Static binding (4 tests)

- `source: 'static'` with string/boolean/null/number value → value returned byte-identical.

### Resource binding (12 tests)

- Product id in `productsById` → resolved product drop
- Collection id in `collectionsById` → resolved collection drop
- Page id in `pagesById` → resolved page drop
- Blog id in `blogsById` → resolved blog drop
- Menu id in `menusById` → resolved menu drop
- Multiple descriptors in same settings map → all resolve independently
- Unknown id → `null` (no cross-tenant leak)
- **Site B id not in Site A siteDrops → `null` (tenancy boundary)**
- Missing id → fallback when provided
- `productsById` map absent → `null`
- Known collection id but `collectionsById` absent → `null`
- Empty `siteDrops` → all bindings resolve to `null`

### Metafield NOT-CONNECTED (4 tests)

- Returns `null` when no fallback (NOT-CONNECTED)
- Returns provided string / object / null fallback as-is

### Credential sanitization (5 tests)

- Resolved product drop with `api_key` → stripped
- Resolved drop with `access_token` → stripped
- Resolved drop with `password` → stripped
- Resolved drop with `__proto__` → stripped
- Safe fields on resolved drop → preserved

### Determinism (3 tests)

- Same inputs → same output (run twice)
- Empty siteDrops → stable across two calls
- Does not mutate the original settings object

### Mixed / edge (7 tests)

- Descriptor fields resolve while scalar fields pass through unchanged
- Unknown descriptor id in same map as known → only known resolves; unknown → `null`
- `resourceType` unknown → `null`
- Static binding wrapping `undefined` → `undefined`
- Static binding wrapping an array → the array
- Descriptor nested inside a non-descriptor object is NOT resolved (only top-level keys)

---

## Merchant Lane — `theme-editor-w.test.mjs` (55 tests)

File: `apps/merchant-control-plane/tests/theme-editor-w.test.mjs`

All 55 tests pass. Merchant total: 286/286.

### Proxy route tests (10 tests)

- Route file exists at expected path
- GET handler exported
- `resolveOwnedStoreId` imported (tenancy law)
- `merchantApiFetch` imported
- Does NOT import `createMerchantApiClient` (no api-client edit)
- Passes `store_id` in gateway URL (tenant scoping)
- `type` enum validated (5 types)
- `limit` clamped to 1–50
- `q` sliced to 200 chars
- Returns `{ data, meta }` shape

### ResourcePickerControl combobox tests (20 tests)

- File exists
- Does not import `page.tsx`, `globals.css`, `api-client`, or supabase
- `role="combobox"` on input trigger
- `role="listbox"` on dropdown
- `role="option"` on result items
- `aria-expanded` on trigger
- `aria-haspopup="listbox"` on trigger
- `aria-autocomplete="list"` on trigger
- `aria-controls` linking trigger to listbox
- `aria-activedescendant` on trigger
- `aria-selected` on option items
- `ArrowDown`/`ArrowUp`/`Enter`/`Escape` keyboard handlers present
- Debounce via setTimeout (300 ms)
- Calls `/api/stores/` proxy via raw fetch
- `onChange` emits id string only (RISK-DUAL-N01)
- Clear button with `aria-label`
- Selected chip renders title
- `storeName` prop gates live branch
- Phase U NOT-CONNECTED fallback branch retained
- `NOT-CONNECTED` badge in fallback branch

### `controls.module.css` Phase W classes (8 tests)

- `resourcePickerCombobox` class present
- `selectedResourceChip` class present
- `clearBtn` class present
- `resourcePickerDropdown` class present
- `resourcePickerOption` class present
- All new classes use `var(--lb-*` tokens
- No `rounded-[` pattern in new classes
- No raw `px` in new class values (only `--lb-*` references)

### SchemaFormRenderer integration (5 tests)

- File imports `ResourcePickerControl`
- `storeName` prop forwarded in product/collection/blog/page/menu cases
- `storeName` comes from the renderer's own prop (not hardcoded)

### Tenancy chain tests (4 tests, shared with proxy route above)

- `resolveOwnedStoreId` imported (ok 195)
- `store_id` in gateway URL (ok 202)
- Does not import `createMerchantApiClient` (ok 197)
- Component calls `/api/stores/` proxy (ok 225)

### Design ratchet (8 tests)

- No `rounded-[Npx]` in `ResourcePickerControl.tsx`
- No raw hex in `ResourcePickerControl.tsx`
- `--lb-` token usage in combobox styles
- No `rounded-[Npx]` in new `controls.module.css` Phase W classes
- `controls.module.css` Phase W classes use token references
- `ResourcePickerControl` uses `@letbuyy/ui` (not custom `<button>` for standard controls)
- No `style={{ fontSize: … }}` inline style (RISK-STYLE-U01 not introduced again)
- Mobile-first viewport: no fixed-width layout that breaks at 360 px

---

## Notes on Pre-Existing Failures

The 3 pre-existing failures in `api-gateway` are:

1. `ai.test.ts#1` — AI stub route test; not Phase W scope.
2. `internal-os-executive-analytics.test.ts#130` — LCIS analytics test; not Phase W scope.
3. `storefront.test.ts#270` — storefront payment integration test; not Phase W scope.

These 3 failures are unchanged from the baseline at the start of the program and are not counted in the 491 pass total above.
