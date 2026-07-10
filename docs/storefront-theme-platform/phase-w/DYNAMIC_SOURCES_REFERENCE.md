# Dynamic Sources Reference

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Introduced:** Phase W (2026-07-11)
**Source:** `packages/theme-engine/src/dynamic-source-binding.ts`

---

## Overview

A **dynamic-source descriptor** is a plain settings value that tells the renderer to resolve a live commerce resource (or metafield) instead of treating the value as a static scalar. The descriptor is stored inside a section instance's `settings` object. It is structurally valid `ThemeBundleJson` and survives all existing parse/validate/round-trip paths unchanged.

---

## Descriptor Shapes

### 1. Resource Binding (`source: 'resource'`)

The primary Phase W descriptor. References one commerce resource by its site-scoped UUID.

```typescript
type ResourceBinding = {
  __lb_binding: true
  source: 'resource'
  resourceType: 'product' | 'collection' | 'page' | 'blog' | 'menu'
  id: string            // UUID of the resource within the current site
}
```

**Example — featured product:**

```json
{
  "__lb_binding": true,
  "source": "resource",
  "resourceType": "product",
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Resolution:** The renderer looks up `id` in `siteDrops.productsById` (or the appropriate map for the `resourceType`). If found, the drop object replaces the descriptor in the Liquid scope. If absent (unknown id, wrong site, or map not supplied), the value resolves to `null`.

**Liquid access:** After resolution, the Liquid template accesses the resolved value under the field name as normal:

```liquid
{% if section.settings.featured_product %}
  {{ section.settings.featured_product.title }}
{% endif %}
```

### 2. Metafield Binding (`source: 'metafield'`) — NOT-CONNECTED

Models a reference to a store metafield value. Gateway infrastructure is CONNECTED; storefront render hydration is NOT-CONNECTED in Phase W.

```typescript
type MetafieldBinding = {
  __lb_binding: true
  source: 'metafield'
  namespace: string     // e.g. 'custom'
  key: string           // e.g. 'badge_text'
  owner_type: string    // 'product' | 'collection' | 'page' | 'theme'
  owner_id: string      // UUID of the owning resource
}
```

**Resolution in Phase W:** always `null`. The field value in Liquid scope is `null` → empty string in output. No error is raised.

**What is needed to connect:** Create `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts`; add a `metafields` map to `SiteDrops`; update the `source: 'metafield'` branch in `resolveDynamicSourceDescriptors` to perform the lookup. No changes to the descriptor shape or the type guard are required.

### 3. Static Binding (`source: 'static'`)

Wraps any plain value as an explicit binding. Primarily a tooling convenience — allows all settings values to be expressed uniformly as `DynamicSourceDescriptor` in code generation scenarios.

```typescript
type StaticBinding = {
  __lb_binding: true
  source: 'static'
  value: unknown
}
```

**Resolution:** `binding.value` is returned unchanged. Behaves identically to storing the plain scalar directly.

---

## Type Guard

```typescript
isDynamicSourceDescriptor(v: unknown): v is DynamicSourceDescriptor
```

Returns `true` only when:
- `v` is a plain object (not null, not array)
- `v.__lb_binding === true`
- `v.source` is one of `'resource'`, `'metafield'`, `'static'`

Returns `false` for all scalars (string, number, boolean, null), arrays, and plain objects.

---

## Resolver

```typescript
resolveDynamicSourceDescriptors(
  settings: Record<string, unknown>,
  siteDrops: SiteDrops
): Record<string, unknown>
```

**Contract:**
- Pure function. No I/O. No network calls. No DB queries.
- Non-descriptor values pass through byte-identical (backward-compat).
- Descriptor values are replaced with the resolved drop or `null`.
- Applied `BINDING_BLOCKED_KEYS` to strip credential-adjacent keys from resolved drop objects.
- Does not mutate `settings`.
- Never throws. Missing map entry → `null`; absent `siteDrops` sub-map → `null`.

**Where it is called:** `packages/theme-engine/src/theme-renderer.ts` → `renderLiquidTemplateSections` → once per section, on `templateSection.settings`, BEFORE `buildLiquidScope`. Only section-level settings are resolved in Phase W. Block-level settings are not yet resolved (RISK-W06).

---

## SiteDrops Interface

```typescript
interface SiteDrops {
  productsById?: Record<string, unknown>     // product drop objects keyed by product UUID
  collectionsById?: Record<string, unknown>  // collection drop objects keyed by collection UUID
  pagesById?: Record<string, unknown>        // page drop objects keyed by page UUID
  blogsById?: Record<string, unknown>        // blog drop objects keyed by blog UUID
  menusById?: Record<string, unknown>        // menu drop objects keyed by menu UUID
  // metafields?: Record<string, unknown>    // NOT-CONNECTED in Phase W
}
```

**Tenant-safety law:** Every sub-map in `SiteDrops` MUST be pre-scoped to the current site by the caller. The resolver performs no ownership verification — it trusts the map is already site-bounded. In the storefront, `productsById` and `collectionsById` are populated by `data-binding-engine.ts` using `ProductService.getProductsByIds` called with the store's subdomain. Foreign ids (from other sites) are simply absent from the map and resolve to `null`.

---

## BINDING_BLOCKED_KEYS

A set of 14 credential-adjacent key names stripped from resolved resource drops before they enter the Liquid scope:

```
api_key, webhook_secret, access_token, secret_key, private_key, password,
auth_token, bearer_token, client_secret, stripe_key, razorpay_key,
supabase_key, jwt_secret, __proto__
```

These mirror `BLOCKED_DROP_KEYS` in `theme-renderer.ts`. See RISK-W01 for the parity enforcement gap.

---

## Storage Law (RISK-DUAL-N01)

Descriptors are stored exclusively in section instance `settings` values. They MUST NOT be stored in:
- `section_definitions` (Liquid source files — `ThemeLiquidSectionFileSchema`)
- `block_definitions` (Liquid block source files)
- `block_definitions[type].allowed_child_types`
- Any field inside `ThemeDocumentSchema` that is not a section/block instance settings value

The editor's `onChange` for a resource-picker field must emit only the resource id string. The `buildDraftConfig` path (or the editor's `applyChange()` call site) is responsible for wrapping the id in a `ResourceBinding` descriptor if the field's type is a resource field type.

---

## Resource-Search Route

Phase W delivers a unified resource-search gateway route that powers the `ResourcePickerControl` combobox.

```
GET /v1/themes/resource-search
  ?store_id=<uuid>       required — must be owned by the session actor
  &type=<resource-type>  required — one of: product | collection | page | blog | menu
  &q=<string>            optional — search query (max 200 chars, ilike)
  &limit=<int>           optional — result count cap (1–50, default 20)
```

**Auth:** `authMiddleware` (global ES256/HS256 parse) + `resolveCustomUser` (must have `users_custom` row — customer tokens rejected) + `verifySiteOwnership` (DB ownership check + session-bound fast-fail).

**Response:**
```json
{
  "results": [
    { "id": "...", "title": "...", "handle": "...", "slug": "..." }
  ]
}
```

Fields `handle` and `slug` are present only for the resource types that have them.

**Proxy:** `apps/merchant-control-plane/src/app/api/stores/[store]/resource-search/route.ts` — the Next.js same-origin proxy that resolves `storeName` to a UUID via `resolveOwnedStoreId` before calling the gateway.

---

## Merchant-Side Integration

`ResourcePickerControl` in `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx`:

- **Requires `storeName` prop** to activate the live combobox. Without it, the Phase U text-input fallback renders.
- Calls `GET /api/stores/{storeName}/resource-search?type={resourceType}&q={query}&limit=20`.
- The `type` is derived from the schema field type (`product`, `collection`, `page`, `blog`, `menu`).
- `onChange(id: string)` — emits the selected resource UUID. The caller decides whether to store it as a plain string or wrap it in a `ResourceBinding` descriptor.

---

## Phase Honesty Contract

| Capability | Status |
|---|---|
| Resource binding descriptor type | CONNECTED |
| `isDynamicSourceDescriptor` guard | CONNECTED |
| `resolveDynamicSourceDescriptors` pure function | CONNECTED |
| Section-level descriptor resolution in renderer | CONNECTED (Phase W) |
| Block-level descriptor resolution in renderer | NOT-CONNECTED (RISK-W06; Phase X target) |
| Metafield binding descriptor type | CONNECTED (type modelled) |
| Metafield resolution in renderer | NOT-CONNECTED (storefront hydration service absent) |
| `GET /v1/themes/resource-search` gateway route | CONNECTED |
| Resource-search Next.js proxy | CONNECTED |
| `ResourcePickerControl` live combobox | CONNECTED (when `storeName` supplied) |
| `ResourcePickerControl` NOT-CONNECTED fallback | CONNECTED (Phase U; when `storeName` absent) |
