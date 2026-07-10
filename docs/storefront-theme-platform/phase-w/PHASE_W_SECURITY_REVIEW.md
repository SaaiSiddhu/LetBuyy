# Phase W Security Review — Dynamic Sources + Custom Data

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** W — Dynamic Sources + Custom Data
**Date:** 2026-07-11
**Scope:** Resource-search route tenancy enforcement, binding descriptor cross-tenant isolation, ResourcePickerControl proxy chain, metafield NOT-CONNECTED honesty.

---

## 1. Threat Model

Phase W introduces three new attack surfaces:

| Surface | Threat |
|---|---|
| `GET /v1/themes/resource-search` | Cross-tenant resource read — Site A merchant queries Site B resources |
| `DynamicSourceDescriptor` stored in settings | Cross-tenant binding — descriptor id from Site B resolves to Site B data on Site A storefront |
| `ResourcePickerControl` combobox fetch | Client-side store_id injection — browser passes arbitrary store_id to the proxy |

---

## 2. Gateway Route Tenancy — W-T01 through W-T15

### 2.1 Auth guard chain

The route is registered in `routes/themes.ts` AFTER `authMiddleware`, which means every request to `/v1/themes/resource-search` has `c.get('auth')` populated before the handler fires.

Inside the handler:
1. `resolveCustomUser(db, auth)` — queries `users_custom` for the JWT subject. Customer HS256 tokens have no row in `users_custom`; `resolveCustomUser` returns `null`.
2. If null → `return c.json({ error: 'FORBIDDEN' }, 403)`. This is the customer token rejection gate.
3. `verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId)` — performs the DB ownership check AND the session-bound fast-fail (`if sessionStoreId && sessionStoreId !== siteId → false`).
4. If `false` → 403.
5. Only then: per-type ilike query with `.eq('store_id', store_id)` bound to the verified `store_id`.

### 2.2 Tenancy proof (test assertions)

| Test ID | Assertion |
|---|---|
| W-T01 | `resolveCustomUser` is called before any search adapter call in the route handler |
| W-T02 | `verifySiteOwnership` is called before any search adapter call in the route handler |
| W-T03 | Null `resolveCustomUser` result produces 403 FORBIDDEN |
| W-T04 | False `verifySiteOwnership` result produces 403 FORBIDDEN |
| W-T05 | All table queries are scoped by `.eq('store_id', store_id)` — Site A search cannot return Site B resources |
| W-T06 | No literal UUID is used as `store_id` argument in table queries |
| W-T07 | Resource type enum includes exactly the 5 approved types |
| W-T08 | `authMiddleware` registered for `/resource-search` in `themes.ts` (before slug routes) |
| W-T09 | `resourceSearchRouter` imported and mounted via `router.route` in `themes.ts` |
| W-T10 | Menu search queries `navigation_menus` table directly (list all menus, not per-location) |
| W-T11 | Page search falls back to legacy `pages` table when `storefront_pages` is missing |
| W-T12 | Results are slim — only `id`, `title`, `handle`, `slug` are selected; no `price`/`email`/`token` |
| W-T13 | Resource-search route is read-only (no insert, update, delete, rpc) |
| W-T14 | Customer HS256 token rejection — `resolveCustomUser` null path logic |
| W-T15 | Cross-site access rejected by `verifySiteOwnership` — Site B merchant cannot access Site A resources |

All 15 tests pass (see PHASE_W_TEST_REPORT.md, gateway lane, 491 total / 0 new failures).

### 2.3 verifySiteOwnership cross-check

`verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId)` performs two independent checks:

1. **DB ownership check:** `SELECT 1 FROM sites WHERE id = store_id AND (custom_user_id = actorId OR user_id = actorId)`. This is the definitive tenancy gate.
2. **Session-bound fast-fail:** if `auth.user.storeId` (the ES256 claim-embedded storeId) is present AND does not match `store_id`, reject immediately without a DB round-trip. This prevents a merchant holding a valid session for Store A from even reaching the DB query when they pass Store B's `store_id`.

The fast-fail requires `storeId` to be present in the token. `auth.user.storeId` is declared optional (`storeId?: string`) in `services/api-gateway/src/lib/auth-user.ts`. When absent — pre-date tokens or internal-SSO flows — the fast-fail is bypassed silently and the DB check still enforces ownership. See RISK-W02.

### 2.4 Cross-tenant test scenario

**W-T15 scenario:** Merchant B holds a valid ES256 token for `store_id = SITE_B_UUID`. They submit `GET /resource-search?store_id=SITE_A_UUID`. `verifySiteOwnership` receives `(db, SITE_A_UUID, merchantB.id, SITE_B_UUID)`. The session-bound fast-fail fires: `SITE_B_UUID !== SITE_A_UUID` → returns `false` → 403. Even without the fast-fail, the DB check would fail (`sites.custom_user_id = merchantB.id AND sites.id = SITE_A_UUID` has no row).

---

## 3. Binding Descriptor Cross-Tenant Isolation

### 3.1 Threat

A malicious merchant could craft a settings payload where a `ResourceBinding` descriptor contains the id of a resource belonging to a different site:

```json
{
  "featured_product": {
    "__lb_binding": true,
    "source": "resource",
    "resourceType": "product",
    "id": "SITE_B_PRODUCT_UUID"
  }
}
```

If the resolver performed an independent DB query using the raw `id`, it could return Site B's product drop to Site A's Liquid template.

### 3.2 Defence: pure function bounded by caller-supplied siteDrops

`resolveDynamicSourceDescriptors` is a **pure function with no I/O**. It accepts a `siteDrops` map supplied by the caller — a map pre-populated by the storefront-runtime data-binding engine using only `ProductService.getProductsByIds` scoped to the current store's subdomain. The function cannot reach beyond this map:

```typescript
// If id is not in siteDrops.productsById → resolve to null, not a DB query
const drop = siteDrops.productsById?.[binding.id] ?? null
```

An id from Site B is simply absent from Site A's `siteDrops.productsById` and resolves to `null`. Liquid sees `null` in scope, which renders as an empty string or a `{% if %}` check failing. No data leak occurs.

### 3.3 Test proof (engine lane)

| Test | Assertion |
|---|---|
| `W resolve resource: unknown id returns null (no cross-tenant leak)` | An id absent from `siteDrops` resolves to `null` |
| `W resolve resource: Site B id not in Site A siteDrops → null (tenancy boundary)` | `SITE_B_PRODUCT_ID` not in `siteADrops` → `null` |
| `W resolve resource: empty siteDrops → all bindings resolve to null` | Empty map → all descriptors → `null`; no DB call possible |
| `W resolve resource: productsById map absent → null` | Missing map key → null; no error thrown |

**56 engine tests pass.** Determinism tests confirm the function is pure: calling twice with identical inputs produces identical outputs, and the original settings object is not mutated.

---

## 4. Merchant Proxy Chain Tenancy

### 4.1 Proxy route design

`apps/merchant-control-plane/src/app/api/stores/[store]/resource-search/route.ts`:

```
Browser → same-origin /api/stores/{storeName}/resource-search → resolveOwnedStoreId → merchantApiFetch → gateway /themes/resource-search?store_id={server-resolved-UUID}
```

The browser never supplies `store_id` as a query parameter. `storeName` is the path segment from the URL (`[store]`). `resolveOwnedStoreId(store)` resolves the store name to a UUID using the merchant ES256 session, verifying the actor owns the store. If the actor does not own `storeName` → 401/404; the gateway is never reached.

The gateway adds a second layer: `resolveCustomUser` + `verifySiteOwnership` using the forwarded auth token.

### 4.2 Test proof (merchant lane)

| Test | Assertion |
|---|---|
| `phase-w: proxy route imports resolveOwnedStoreId (tenancy law)` | Static import present |
| `phase-w: proxy route passes store_id in gateway URL (tenant scoping)` | URL construction uses server-resolved UUID |
| `phase-w: proxy route does NOT import createMerchantApiClient` | Raw `merchantApiFetch` used; no api-client edit |
| `phase-w: ResourcePickerControl calls /api/stores/ proxy via raw fetch` | Component never calls gateway directly |

### 4.3 ResourcePickerControl storeName binding

`storeName` is resolved server-side (page URL param → `resolveOwnedStoreId` chain). The component receives it as a prop. When `storeName` is absent (Phase U fallback path), the NOT-CONNECTED badge renders and no fetch is issued. The browser cannot inject a different `storeName` — it is controlled by the Next.js URL routing.

---

## 5. Response Slimness — No PII or Credential Fields

The gateway route selects only `id`, `title`, `handle?`, `slug?` from each table. W-T12 proves via source-pattern assertion that `price`, `email`, `token`, `phone`, `address`, and similar fields are not selected. The mapper function explicitly constructs a slim object — it does not spread the full DB row.

---

## 6. Metafield NOT-CONNECTED — Honest Disclosure

`source: 'metafield'` descriptors **always resolve to `null`** in Phase W. The exact missing piece is documented in `packages/theme-engine/src/dynamic-source-binding.ts`:

```
// Metafield resolution is NOT-CONNECTED in Phase W.
// Missing piece: apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts
// This file must be created and the fetched values passed into siteDrops.metafields
// before live metafield binding can work.
```

The gateway metafield routes (`/v1/metafields`) are CONNECTED and tenant-safe. The gap is exclusively in the storefront render path. A theme that stores `source: 'metafield'` descriptors will render as if those settings are empty — no error, no crash, and no data from other sites.

---

## 7. BINDING_BLOCKED_KEYS — Credential Sanitization

`resolveDynamicSourceDescriptors` applies `filterDropKeys` to every resolved resource drop before returning it. `BINDING_BLOCKED_KEYS` is a copy of `BLOCKED_DROP_KEYS` from `theme-renderer.ts` containing 14 credential-adjacent key names (`api_key`, `webhook_secret`, `access_token`, `password`, `secret`, `private_key`, etc.).

**Gap (RISK-W01):** `BINDING_BLOCKED_KEYS` is a hand-maintained copy. If `BLOCKED_DROP_KEYS` gains new entries in a future patch and `BINDING_BLOCKED_KEYS` is not updated, the new credential-adjacent keys would survive `filterDropKeys` on resolved drops and reach Liquid scope via a `ResourceBinding` descriptor. This risk is MEDIUM because:
- All rendered HTML passes DOMPurify, bounding the XSS surface.
- The gap requires a future credential-adjacent key addition that is missed in two files — a process failure, not a code design failure.

**Mitigation path (RISK-W01):** Export `BLOCKED_DROP_KEYS` from `theme-renderer.ts` and import it into `dynamic-source-binding.ts` as the single source of truth. Alternatively, add a unit test asserting the two sets are identical.

---

## 8. Open Risks Introduced by Phase W

| Risk ID | Severity | One-line summary |
|---|---|---|
| RISK-W01 | MEDIUM | `BINDING_BLOCKED_KEYS` parity with `BLOCKED_DROP_KEYS` not enforced at compile or test time |
| RISK-W02 | LOW | `auth.user.storeId` optional — fast-fail bypassed when storeId absent from token |
| RISK-W03 | LOW | `siteDrops` tenant-scoping trust boundary comment-only; no `siteId` assertion or integration test |
| RISK-W04 | LOW | `ArrowUp` from `activeIndex=-1` computes `Math.max(-2,0)=0` — violates WAI-ARIA 1.2 combobox |
| RISK-W05 | LOW | Loading spinner inside `{isOpen?…}` — invisible during the 300 ms debounce window |
| RISK-W06 | LOW | Block-level settings not resolved through `resolveDynamicSourceDescriptors` — raw descriptor objects reach Liquid for block settings |

---

## 9. Pre-Existing Risks Unchanged

| Risk ID | Phase W impact |
|---|---|
| RISK-SEC-001 (theme_purchases wide-open RLS) | Not touched; no marketplace routes added |
| RISK-SEC-P01 (theme_editor_drafts RLS user_id only) | Not touched; no realtime subscription added |
| RISK-T01 (pre-Zod stack depth attack) | Not touched; `parseLiquidThemePackageBundle` unchanged |
| RISK-T02 (no assertNoBlockedKeysInRaw in bundle parser) | Not touched |
| RISK-T03 (block settings bypass filterBlockedSettingsKeys) | Partially addressed at section level; block level remains (RISK-W06) |
| RISK-SEC-U01/U02/U03 | Not touched; `schema-field-extensions.ts` unchanged |
