# Phase W Discovery — Dynamic Sources + Custom Data

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** W — Dynamic Sources + Custom Data
**Date:** 2026-07-11
**Scope:** Pre-phase inventory of resource-search capabilities, dynamic-source binding model, metafield infrastructure, and the state of `ResourcePickerControl` entering Phase W.

---

## 1. Pre-Phase-W State of `ResourcePickerControl`

`ResourcePickerControl` was introduced in Phase U as a placeholder for five resource field types (`product`, `collection`, `blog`, `page`, `menu`). It rendered a plain text-input accepting an id/handle string, together with a NOT-CONNECTED badge:

```
[ id or handle _____________________ ]  NOT-CONNECTED
```

No live search, no combobox, no debounced query. The badge truthfully described the gap: no resource-search route existed in the gateway or a proxy in merchant-control-plane. Merchants could type a known id but had no picker UI.

---

## 2. Pre-Phase-W Resource Endpoints

Five separate routes existed but none were unified for a picker:

| Route | File | Search capability |
|---|---|---|
| `GET /products?store_id=uuid&search=q` | `routes/products.ts:440` | `ilike` on `products.name` (line 478); merchant-auth + tenant-scoped |
| `GET /products/collections?store_id=uuid` | `routes/products.ts:583` | No search param; small set; client-side filter only |
| `GET /pages?store_id=uuid&status=published` | `routes/pages.ts:276` | `ListPagesQuery` has no search field |
| `GET /blog/posts?store_id=uuid` | `routes/blog.ts:69` | No search param |
| `GET /pages/navigation?store_id=uuid&location=loc` | `routes/pages.ts:547` | Returns ONE menu by location — not a menu list |

**Gap:** No unified resource-search route existed. Picker queries would need five separate call sites, each with different auth shapes and result shapes. A `/v1/themes/resource-search` unified route was absent.

---

## 3. Dynamic Source Binding — Pre-Phase-W State

### 3.1 Section settings model

`ThemeBundleJson` (`packages/theme-engine/src/theme-bundle.ts:113`) is a recursive type:

```typescript
type ThemeBundleJson =
  | string | number | boolean | null
  | { [key: string]: ThemeBundleJson }
  | ThemeBundleJson[]
```

Section instance settings are `Record<string, ThemeBundleJson>`. Before Phase W, every value was expected to be a scalar (string/number/boolean/null) or a plain nested object (e.g. a colour object). No mechanism existed to mark a settings value as a **reference to a live commerce resource** rather than a static scalar.

### 3.2 What Shopify provides (parity gap)

Shopify themes support `type: product`, `type: collection`, `type: blog`, `type: page`, and `type: link_list` (menu) schema fields. These fields store a **resource handle** in settings; the Liquid renderer resolves the handle to the full resource drop before rendering. The merchant picks from a searchable combobox in the editor — not a blank text field.

LetBuyy entering Phase W had:
- The field types registered in `ExtendedSchemaField` (Phase U).
- `ResourcePickerControl` as a placeholder with no live search.
- No resolver in `theme-renderer.ts` that could look up a resource id from settings and substitute the full commerce drop.
- No "binding descriptor" type distinguishing a resource reference from a plain string in `ThemeBundleJson`.

### 3.3 Metafield infrastructure state

Metafields were **CONNECTED** at the gateway: `services/api-gateway/src/routes/metafields.ts` implements full CRUD for `store_metafield_definitions` and `store_metafield_values`. `owner_type` enum includes `product`, `collection`, `page`, and `theme`. All routes are tenant-safe via `resolveOwnedMetafieldStore`.

However the **storefront-runtime render path** had no metafield hydration:
- `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` does not exist.
- `buildLiquidScope` (`theme-renderer.ts:855`) and `renderLiquidTemplateSections` do not fetch or inject metafield values.
- A metafield descriptor stored in section settings would reach Liquid as a raw object `{ owner_type: 'product', namespace: 'custom', key: 'badge_text', ... }` — not a resolved value.

This honest NOT-CONNECTED gap is modelled in Phase W's `DynamicSourceDescriptor` type (`source: 'metafield'` → `null` at resolution time) with the exact missing piece documented.

---

## 4. Data Binding Engine (Pre-Phase-W)

`apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts` provides `productsById` and `collectionsById` maps — already site-scoped via `ProductService.getProductsByIds` calling the store's subdomain. These maps are the tenant-safe lookup surface for Phase W's `resolveDynamicSourceDescriptors`. No independent DB query with an arbitrary id is needed or permitted.

---

## 5. Cross-Tenant Baseline

### 5.1 Auth model entering Phase W

Two token issuers, never crossed:
- **Merchant ES256**: identity-platform; `resolveCustomUser` checks `users_custom` table; `verifySiteOwnership` cross-checks `sites.custom_user_id` = actor.
- **Customer HS256**: `CUSTOMER_SESSION_SECRET`; `issueCustomerSession`; `resolveCustomUser` returns `null` for customer tokens (no `users_custom` row).

The gateway `authMiddleware` (registered at `index.ts:711`) populates `c.get('auth')` for all routes.

### 5.2 Resource routes entering Phase W

Existing resource routes (`/products`, `/pages`, `/blog/posts`) are already merchant-gated via `resolveCustomUser` + `verifySiteOwnership`. Each performs tenant-scoped queries using `ownedStoreIds` from the auth session. Customer tokens cannot reach these routes because `resolveCustomUser` returns `null` → 403.

### 5.3 What Phase W must not do

- Introduce any resource lookup using a caller-supplied store_id that is not validated against the session actor's ownership.
- Allow binding resolution in `resolveDynamicSourceDescriptors` to perform an independent DB query using the descriptor's `id` field against arbitrary stores.
- Store binding descriptors in `section_definitions` or `block_definitions` (RISK-DUAL-N01).

---

## 6. ResourcePickerControl Phase U NOT-CONNECTED surface

Phase U shipped `ResourcePickerControl` as:

```tsx
// Phase U (pre-W) — plain text-input with NOT-CONNECTED badge
<Input value={value ?? ''} onChange={e => onChange(e.target.value)} />
<Badge>NOT-CONNECTED</Badge>
```

The `storeName` prop was absent from the Phase U component props. `SchemaFormRenderer.tsx` did not pass a `storeName` to the picker. The proxy route `apps/merchant-control-plane/src/app/api/stores/[store]/resource-search/route.ts` did not exist.

Phase W must:
1. Create the gateway route `/v1/themes/resource-search` (gateway lane).
2. Create the Next.js proxy route (merchant lane).
3. Upgrade `ResourcePickerControl` to a live combobox (merchant lane).
4. Model the binding descriptor in `packages/theme-engine` (engine lane).
5. Wire section-level descriptor resolution into `theme-renderer.ts` (engine lane).

---

## 7. ThemeDocument Binding Storage Model

**Where descriptors live (RISK-DUAL-N01 constraint):** A dynamic-source descriptor is stored as the **value** of a setting field inside a section instance's `settings` object — not in `section_definitions`, not in `block_definitions`. The discriminant is `{ __lb_binding: true }`. This is structurally compatible with `ThemeBundleJson` (which allows `{ [key: string]: ThemeBundleJson }` objects at any depth) and survives `parseThemeDocument` + `parseLiquidThemePackageBundle` round-trips without corruption, since those parsers accept arbitrary `ThemeBundleJson` shapes in settings values.

**Example:** A section with a `product` field set to a resource binding looks like:

```json
{
  "id": "hero-abc",
  "type": "hero-section",
  "settings": {
    "featured_product": {
      "__lb_binding": true,
      "source": "resource",
      "resourceType": "product",
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    },
    "heading": "Our Best Seller"
  }
}
```

The heading is a plain scalar (unchanged code path). The `featured_product` key holds a descriptor that the renderer resolves to a `ProductDrop` before Liquid sees the settings.
