# Phase W Report — Dynamic Sources + Custom Data

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** W — Dynamic Sources + Custom Data
**Date authored:** 2026-07-11
**Branch:** `stepup/main`
**Author scope:** Phase W delivers a tenant-safe unified resource-search gateway route, a typed dynamic-source binding descriptor model in `packages/theme-engine` with section-level resolution wired into `theme-renderer.ts`, and a live WAI-ARIA 1.2 combobox `ResourcePickerControl` replacing the Phase U text-input placeholder. No new database migrations. No SECURITY DEFINER RPCs modified. No frozen apps touched. Rollback = revert all Phase W commits.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase W touches `apps/merchant-control-plane/package.json` (test script addition — `theme-editor-w.test.mjs` appended). This file carries prior user modifications; the hunk appends one entry and does not conflict. **This change MUST NOT be committed without review of the hunk against surrounding foreign WIP.**

No new database migrations. No gateway auth changes. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Lane | Purpose |
|------|------|---------|
| `services/api-gateway/src/routes/resource-search.ts` | Gateway | Unified resource-search Hono sub-router; `GET /v1/themes/resource-search` |
| `services/api-gateway/src/__tests__/resource-search-w.test.ts` | Gateway | 15 cross-tenant negative + auth tests (W-T01–W-T15) |
| `packages/theme-engine/src/dynamic-source-binding.ts` | Engine | `DynamicSourceDescriptor` union, `isDynamicSourceDescriptor` guard, `resolveDynamicSourceDescriptors` pure function, `SiteDrops` interface |
| `packages/theme-engine/test/dynamic-source-binding.test.ts` | Engine | 56 Phase W tests |
| `apps/merchant-control-plane/src/app/api/stores/[store]/resource-search/route.ts` | Merchant | Next.js GET proxy; `resolveOwnedStoreId` → `merchantApiFetch` |
| `apps/merchant-control-plane/tests/theme-editor-w.test.mjs` | Merchant | 55 Phase W static-contract tests |

### 1.2 Modified Files

| File | Change | WIP? |
|------|--------|------|
| `services/api-gateway/src/routes/themes.ts` | `authMiddleware` + `router.route('/resource-search', …)` mount | Clean |
| `packages/theme-engine/src/index.ts` | `export * from './dynamic-source-binding'` | Clean |
| `packages/theme-engine/src/theme-renderer.ts` | Import `resolveDynamicSourceDescriptors`/`SiteDrops`; optional `siteDrops` on `LiquidCommerceDrops`; resolver call in `renderLiquidTemplateSections` before `buildLiquidScope` | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` | Replace Phase U text-input with WAI-ARIA 1.2 combobox; Phase U fallback retained when `storeName` absent | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` | 8 new Phase W classes using `--lb-*` tokens | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` | `storeName={storeName}` forwarded to `ResourcePickerControl` | Clean |
| `apps/merchant-control-plane/package.json` | `theme-editor-w.test.mjs` appended to test script | WIP (foreign) |

### 1.3 FROZEN / Untouched Files

| File | Reason |
|------|--------|
| `services/api-gateway/src/index.ts` | FOREIGN WIP — resource-search mounted in `themes.ts`, not `index.ts` |
| `packages/typescript/api-client/src/index.ts` | FOREIGN WIP — proxy uses raw `merchantApiFetch`; no api-client edit |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | FOREIGN WIP |
| `apps/merchant-control-plane/src/app/globals.css` | FOREIGN WIP — no CSS change required; all W styles in `controls.module.css` |
| `packages/theme-engine/src/theme-bundle.ts` | Unchanged — `ThemeBundleJson` already accepts descriptor-shaped objects |
| `packages/theme-engine/src/theme-document.ts` | Unchanged — `ThemeDocumentSchema` round-trips descriptors as opaque `ThemeBundleJson` |
| `services/api-gateway/src/routes/smart-collections.ts` | FOREIGN WIP |
| `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx` | FOREIGN WIP |

---

## 2. Dynamic-Source Binding Model

### 2.1 Descriptor Type

A `DynamicSourceDescriptor` is a tagged-union stored as the value of a section settings field. The discriminant is `{ __lb_binding: true }`. Three source variants:

```typescript
// Resource binding — references a site-scoped commerce resource
type ResourceBinding = {
  __lb_binding: true
  source: 'resource'
  resourceType: 'product' | 'collection' | 'page' | 'blog' | 'menu'
  id: string              // UUID of the resource in the current site
}

// Metafield binding — NOT-CONNECTED in Phase W
type MetafieldBinding = {
  __lb_binding: true
  source: 'metafield'
  namespace: string
  key: string
  owner_type: string      // 'product' | 'collection' | 'page' | 'theme'
  owner_id: string
}

// Static binding — explicit wrapper for tooling (rare in practice)
type StaticBinding = {
  __lb_binding: true
  source: 'static'
  value: unknown
}

type DynamicSourceDescriptor = ResourceBinding | MetafieldBinding | StaticBinding
```

Structural compatibility: `DynamicSourceDescriptor` is a valid `ThemeBundleJson` (an object with string keys). It passes `parseThemeDocument`, `parseLiquidThemePackageBundle`, and Zod's `z.record(z.string(), ThemeBundleJsonSchema)` without modification. No schema changes required.

### 2.2 Resolver

`resolveDynamicSourceDescriptors(settings, siteDrops)` is a **pure function with no I/O**:

- Non-descriptor values (plain scalars, arrays, non-binding objects) pass through byte-identical.
- `source: 'resource'` → looks up `binding.id` in the appropriate `siteDrops` sub-map; returns the drop object or `null` if absent.
- `source: 'metafield'` → returns `null` unconditionally (NOT-CONNECTED).
- `source: 'static'` → returns `binding.value`.
- After resolution: applies `filterDropKeys` with `BINDING_BLOCKED_KEYS` to strip credential-adjacent keys from drop objects before they enter Liquid scope.
- Does not mutate the input settings object.
- Never throws; an absent map or missing id → `null`.

### 2.3 Renderer integration

`renderLiquidTemplateSections` in `theme-renderer.ts` calls the resolver on each section's `templateSection.settings` before passing them to `buildLiquidScope`. The resolved copy (descriptors replaced by drops or null) is what Liquid sees. The original settings object is not mutated.

```
templateSection.settings ──→ resolveDynamicSourceDescriptors ──→ resolved ──→ buildLiquidScope ──→ LiquidJS
```

Backward-compat: when no `siteDrops` is supplied (current default) and the settings contain no descriptors, the output is byte-identical to the pre-Phase-W output. No existing themes are affected.

---

## 3. Metafield NOT-CONNECTED — Honest Disclosure

The metafield backend is CONNECTED at the gateway (`/v1/metafields`, `store_metafield_definitions` + `store_metafield_values`, tenant-safe via `resolveOwnedMetafieldStore`). The storefront render path is NOT-CONNECTED.

**Exact missing piece:** `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` does not exist. This file must:
1. Accept a `site_id` and a list of `(owner_type, owner_id)` pairs.
2. Fetch the corresponding `store_metafield_values` rows via the gateway or service-role DB.
3. Return a `siteDrops.metafields` map keyed by `${owner_type}:${owner_id}:${namespace}.${key}`.
4. Be called from the data-binding-engine before the render starts.

Phase W models the descriptor type and resolution function so that when this service is built, the only change to `resolveDynamicSourceDescriptors` is to look up `siteDrops.metafields` instead of returning `null`. No structural changes to `DynamicSourceDescriptor` or the resolver signature are required.

---

## 4. Resource Search Route

### 4.1 Route contract

```
GET /v1/themes/resource-search
?store_id=<uuid>
&type=product|collection|page|blog|menu
&q=<string, max 200 chars>
&limit=<int, 1–50, default 20>

Auth:   authMiddleware (global) + resolveCustomUser + verifySiteOwnership
Errors: 400 (invalid type | store_id missing) · 403 (auth fail | cross-tenant) · 500 (unexpected)

Response 200:
{ "results": [ { "id": "...", "title": "...", "handle"?: "...", "slug"?: "..." } ] }
```

### 4.2 Per-type query table

| Type | Table | ilike column | Slim fields |
|------|-------|-------------|-------------|
| `product` | `products` | `name` | `id`, `title` (= name), `handle` |
| `collection` | `collections` | `title` | `id`, `title`, `handle` |
| `page` | `storefront_pages` (fallback: `pages`) | `title` | `id`, `title`, `slug` |
| `blog` | `blog_posts` | `title` | `id`, `title`, `slug` |
| `menu` | `navigation_menus` | `name` | `id`, `title` (= name) |

All queries include `.eq('store_id', store_id)` — enforced by W-T05.

### 4.3 Menu design choice

Menus are fetched as a list from `navigation_menus` (all menus for the store). The existing `GET /pages/navigation?location=loc` route returns a single menu by location, making it unsuitable for a picker. The new route lists all menus and filters by name ilike.

### 4.4 Page fallback

`storefront_pages` is the primary table for CMS pages (Phase-level addition). If a store's DB doesn't have this table yet (pre-migration state), the route falls back to the legacy `pages` table. This prevents a hard error during the migration window.

---

## 5. ResourcePickerControl Upgrade (Phase U → Phase W)

### 5.1 Architecture

```
Phase U (fallback, storeName absent):   [ id or handle ______ ] NOT-CONNECTED
Phase W (live, storeName present):      [ search resource ▼ ] ──→ combobox
```

### 5.2 WAI-ARIA 1.2 Combobox Pattern

| ARIA attribute | Element | Value |
|---|---|---|
| `role="combobox"` | Input trigger | — |
| `aria-expanded` | Input trigger | `true` / `false` |
| `aria-haspopup="listbox"` | Input trigger | — |
| `aria-controls` | Input trigger | → listbox id |
| `aria-autocomplete="list"` | Input trigger | — |
| `aria-activedescendant` | Input trigger | → active option id |
| `role="listbox"` | Dropdown `<ul>` | — |
| `role="option"` | Each result `<li>` | — |
| `aria-selected` | Each option | `true` if active |

Keyboard: `ArrowDown` → next option; `ArrowUp` → previous option; `Enter` → select active; `Escape` → close; `Tab` → close without selecting.

### 5.3 RISK-DUAL-N01 compliance

`onChange` emits the resource `id` string only — never a descriptor object, never a drop, never a section definition. The binding descriptor is assembled by the editor's `applyChange()` call site, which is responsible for wrapping the id in a `ResourceBinding` shape if the field's `type` is a resource type. The control itself knows nothing about the descriptor shape.

### 5.4 Debounce and states

- **300 ms debounce** via `setTimeout`/`clearTimeout` on each keystroke.
- **States:** `idle` (selected chip or placeholder) · `loading` (spinner) · `results` (option list) · `no-results` (empty state) · `error` (fetch fail message).
- **Selected chip:** shows `title` of selected resource + clear button (`aria-label="Clear selection"`).
- **Backward compat:** when `storeName` prop is absent, the Phase U plain text-input + NOT-CONNECTED badge renders.

---

## 6. Phase W Findings Summary

### 6.1 Findings from code review (7 total)

| Severity | Finding | Status |
|---|---|---|
| MEDIUM | `BINDING_BLOCKED_KEYS` parity with `BLOCKED_DROP_KEYS` — no compile or test enforcement | OPEN → RISK-W01 |
| LOW | `auth.user.storeId` optional — fast-fail bypassed when storeId absent | OPEN → RISK-W02 |
| LOW | `siteDrops` trust boundary comment-only; no siteId assertion or block-level integration test | OPEN → RISK-W03 |
| LOW | `ArrowUp` from `activeIndex=-1` → `Math.max(-2,0)=0` snap — violates WAI-ARIA 1.2 | OPEN → RISK-W04 |
| LOW | Loading spinner inside `{isOpen?}` conditional — invisible during 300 ms debounce window | OPEN → RISK-W05 |
| LOW | Block-level settings not resolved through `resolveDynamicSourceDescriptors` (CONFIRMED) | OPEN → RISK-W06 |
| LOW | BINDING_BLOCKED_KEYS parity test gap (PLAUSIBLE) | Merged into RISK-W01 |

No findings were fixed in a hardening pass (Hardening: null). All 7 findings are registered in the Risk Register.

### 6.2 Deferred Phase T / U risks (unchanged)

RISK-T04, RISK-T05, RISK-T06, RISK-SEC-U01, RISK-SEC-U02, RISK-SEC-U03, RISK-A11Y-U01, RISK-A11Y-U02 are all retargeted to Phase X or first relevant file touch. None were addressed in Phase W.

---

## 7. Gate Summary

| Gate | Result |
|---|---|
| api-gateway 491/491 | PASS |
| theme-engine 1441/1441 | PASS |
| merchant 286/286 | PASS |
| storefront-runtime 795/795 | PASS (unchanged) |
| All typechecks | PASS (0 errors) |
| validate-governance.mjs | EXIT=1 (pre-existing; unchanged) |
| 3 pre-existing failures | Unchanged |
