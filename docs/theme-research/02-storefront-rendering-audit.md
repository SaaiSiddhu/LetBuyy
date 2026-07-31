# Storefront Rendering Audit

**Generated:** 2026-06-18
**Source root:** `apps/storefront-runtime/src`

---

## How the Rendering Decision Works

### 1. The Canary Flag: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`

Defined in `packages/theme-engine/src/theme-governance.ts`:

```ts
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
```

This constant is the global platform default. It is **hardcoded `false`**. The env var
`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is read only in `apps/storefront-runtime/src/proxy.ts` to
set the `X-Lb-Render-Engine` response header for CDN/monitoring observability — it does **not** feed
into the per-request render decision itself. The per-request decision comes from
`resolveThemeLiquidRenderingEnabled()` in `theme-governance.ts`, which evaluates:

1. `templateConfig.rendererEngine` or `releaseManifest.renderer_engine` set to `'liquid'` → **always
   Liquid** (the Phase-9 per-theme activation switch, set by `buildReleaseArtifacts` when a Liquid
   bundle is present).
2. Various `liquidRenderingCanary` / `liquid_canary` fields in `templateConfig`, `themeSettings`, or
   `releaseManifest` → per-theme opt-in.
3. Falls back to `defaultEnabled` → `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` = `false`.

The `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` object in `theme-governance.ts` documents the ARB
gate: the global flip to Liquid is deferred until render-parity, SSTI/XSS, and performance evidence
is green.

**Local `.env.local` status:** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is **not set** in
`apps/storefront-runtime/.env.local`, so the local default resolves to the hardcoded `false`.

---

### 2. `resolveStorefrontTemplate` (template-resolver.ts)

The central function that produces a `StorefrontRenderPlan`. Called by every Liquid-capable page.

**Decision flow:**

1. Calls `resolveThemeLiquidRenderingEnabled()` (above) to determine if Liquid is active for this
   store/theme.
2. If Liquid is active, calls `resolveLiquidBundle()` to find the `LiquidThemePackageBundle` in
   `templateConfig`.
3. If a valid `liquidBundle` exists and the bundle has the requested template key, returns a
   `StorefrontRenderPlan` with `rendererEngine: 'liquid'`, `liquidBundle`, and `liquidTemplateKey`
   set.
4. Otherwise falls back to the React section-based plan: looks up `templateConfig.templates[key]`,
   then `route.fallbackSections`, then `resolveLegacyTemplate()`. Returns a plan with no
   `rendererEngine` field (undefined = React).

**Dev override:** `resolveDevEngineOverride(engine)` reads the `?engine=liquid|react` query
parameter in non-production environments to bypass the canary gate for local testing.

---

### 3. `resolveAccountLiquid` (account-liquid.ts)

A thin server-only helper used exclusively by the six `/account/*` routes. It calls
`StoreService.getStoreBySubdomain()` and `getSession()` in parallel, then calls
`resolveStorefrontTemplate()` and wraps the result into:

```ts
{ store, plan, isLiquid: plan.rendererEngine === 'liquid', isAuthenticated }
```

Each account page uses `isLiquid` to branch: Liquid path renders via
`StorefrontCompositionEngine`; React path renders a client component.

---

### 4. `StorefrontCompositionEngine` (composition-engine.tsx)

The shared async React Server Component that drives both render modes:

1. Calls `renderLiquidPlan()` with the plan and section data.
2. If `plan.rendererEngine === 'liquid'` and the bundle renders successfully, returns
   `<LiquidRenderedHtml html={...} />` — a `dangerouslySetInnerHTML` div containing the
   sanitized Liquid output (header + contentForLayout + footer fragments from the theme renderer).
   Also mounts `<LiquidHydrationIslands>` for client-side cart/wishlist/auth island hydration.
3. If Liquid does not apply (plan has no `rendererEngine`) or rendering fails (returns `null`),
   falls back to `<RenderSectionList>` which iterates `plan.template.sections` and dispatches
   each section to the registered React renderer.

Emits a structured `lb:canary:render` log event for every render for monitoring pipeline consumption.

---

### 5. `ContentResourceRenderer` (components/content/content-resource-renderer.tsx)

A shared server component used by the four policy/content routes (privacy, terms, shipping, returns)
and the catch-all `[...path]` page and blog. It calls `resolveStorefrontTemplate()` internally with
`routeType: 'policy' | 'page' | 'article'`, builds a `liquidPage` drop (title, content, body_html,
slug, policy_type), and passes everything to `StorefrontCompositionEngine`. This means all four
policy routes and all generic page/blog routes are **HYBRID** — they follow the same Liquid vs React
decision as commerce routes.

---

## Route-by-Route Analysis

### Home — `/store/[subdomain]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx`
- **Route type:** `'index'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'index'` (from `resolveTemplateKey('index')`)
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` over `templateConfig` sections
- **Auth required:** No
- **Notes:** Supports `?engine=liquid|react` dev override and `?theme_preview_token` preview mode.
  Uses `revalidate = 60`.

---

### Product Detail — `/store/[subdomain]/product/[productId]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/page.tsx`
- **Route type:** `'product'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'product'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList`; `createProductDetailFallbackSection()` is provided as `fallbackSections` so React always has a section to render even if no template is configured.
- **Auth required:** No
- **Notes:** Fetches product + reviews in parallel. Injects JSON-LD (Product, BreadcrumbList,
  LocalBusiness). Uses `revalidate = 30`.

---

### Collection — `/store/[subdomain]/collections/[slug]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/collections/[slug]/page.tsx`
- **Route type:** `'collection'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'collection'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList`; `createProductListingFallbackSection(collection.title)` as fallback.
- **Auth required:** No
- **Notes:** Fetches collection + products from gateway. Maps raw product rows to `ProductModel`.
  Passes `collection` drop into `SectionRenderData` for both Liquid and React. Uses `revalidate = 30`.

---

### Products List — `/store/[subdomain]/products`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/products/page.tsx`
- **Route type:** `'collection'` (reuses collection route type with `resourceSlug: 'all-products'`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'collection'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList`; `createProductListingFallbackSection('All Products')` as fallback.
- **Auth required:** No
- **Notes:** Alias for "All Products". `buildSectionDataPlan()` fetches products via data binding engine. Uses `revalidate = 60`.

---

### Shop — `/store/[subdomain]/shop`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/shop/page.tsx`
- **Route type:** `'collection'` (resourceSlug: `'all-products'`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'collection'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList`; `createProductListingFallbackSection('All Products')` as fallback.
- **Auth required:** No
- **Notes:** Functionally identical to `/products`. Both routes resolve the same `collection` route
  type with `all-products` slug. Uses `revalidate = 60`.

---

### Cart — `/store/[subdomain]/cart`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/cart/page.tsx`
- **Route type:** `'cart'`
- **Rendering mode:** HYBRID (explicit `plan.rendererEngine === 'liquid'` branch)
- **Liquid template key:** `'cart'`
- **React fallback:** `<CartPageClient />` (client component, cart is browser-owned)
- **Auth required:** No
- **Notes:** The only route with an **explicit in-page branch** (`if (plan.rendererEngine === 'liquid')`
  check in the page itself, rather than delegating entirely to `StorefrontCompositionEngine`). When
  Liquid is active, sectionData is an empty Map because cart amounts are browser-hydrated (the
  `collectLiquidCart()` function returns a `source: 'browser_hydrated'` stub — all money totals are
  `null` at SSR and hydrated client-side via the `lb-cart-drawer` island). `revalidate = 0` (no
  caching).

---

### Checkout — `/store/[subdomain]/checkout`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx`
- **Route type:** N/A — no `resolveStorefrontTemplate` call
- **Rendering mode:** REACT (React-only, no Liquid path)
- **Liquid template key:** None
- **React fallback:** `<CheckoutClient storeId={...} sellerId={...} .../>` (full client component)
- **Auth required:** No (but redirects to login if unauthenticated inside client)
- **Notes:** Deliberately excluded from the Liquid render path. Checkout is server-authoritative and
  Razorpay-integrated; Liquid is not involved. `noIndex: true` metadata.

---

### Checkout Success — `/store/[subdomain]/checkout/success`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx`
- **Route type:** N/A — `'use client'` directive; no server-side render plan
- **Rendering mode:** REACT (React-only, client component)
- **Liquid template key:** None
- **React fallback:** Static React "Order status" message with link to orders page
- **Auth required:** No
- **Notes:** Marked `'use client'`. This page exists only for legacy stale Stripe redirects — the
  comment says "This route is kept so old links do not 404. Razorpay orders resolve inline via the
  checkout client." Essentially a stub redirect suggestion page.

---

### Account Dashboard — `/store/[subdomain]/account`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/page.tsx`
- **Route type:** `'customer_account'`
- **Rendering mode:** HYBRID with REDIRECT fallback
- **Liquid template key:** `'customers/account'`
- **React fallback:** `redirect(`${basePath}/account/orders`)` — no bare React /account page exists; React stores are redirected to orders list.
- **Auth required:** Yes (unauthenticated = redirect to store home `basePath`)
- **Notes:** Uses `resolveAccountLiquid()`. If `!isLiquid`, the React path is a redirect, not a
  render. Effectively: Liquid stores get an account dashboard; React stores skip straight to orders.

---

### Account Orders List — `/store/[subdomain]/account/orders`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/page.tsx`
- **Route type:** `'customer_orders'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'customers/orders'`
- **React fallback:** `<OrdersClient />` (client component — existing orders page)
- **Auth required:** Yes (Liquid path: unauthenticated = redirect to `basePath`)
- **Notes:** Liquid path fetches `customer.orders` via `getStorefrontCustomerDrop({ includeOrders: true })` inside `renderLiquidPlan()`.

---

### Account Order Detail — `/store/[subdomain]/account/orders/[id]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/[id]/page.tsx`
- **Route type:** `'customer_order'`
- **Rendering mode:** HYBRID with REDIRECT fallback
- **Liquid template key:** `'customers/order'`
- **React fallback:** `redirect(`${basePath}/account/orders`)` — no React order-detail page exists; falls back to orders list.
- **Auth required:** Yes (always — unauthenticated redirects to `basePath` regardless of Liquid/React)
- **Notes:** In `renderLiquidPlan()`, the order ID is extracted from the path tail to fetch
  `getCustomerOrderDetailDrop()` for the `order` drop. React path is a redirect, making this
  effectively Liquid-only for actual rendering.

---

### Account Settings — `/store/[subdomain]/account/settings`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/settings/page.tsx`
- **Route type:** `'customer_settings'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'customers/settings'`
- **React fallback:** `<SettingsPageClient />` (client component)
- **Auth required:** Yes (Liquid path: unauthenticated = redirect to `basePath`)

---

### Account Wishlist — `/store/[subdomain]/account/wishlist`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/wishlist/page.tsx`
- **Route type:** `'customer_wishlist'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'customers/wishlist'`
- **React fallback:** `<WishlistPageClient />` (client component)
- **Auth required:** Yes (Liquid path: unauthenticated = redirect to `basePath`)
- **Notes:** Liquid path enriches the customer's wishlist product IDs into full product drops via
  `ProductService.getProductsByIds()` before passing to the renderer.

---

### Account Addresses — `/store/[subdomain]/account/addresses`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/account/addresses/page.tsx`
- **Route type:** `'customer_addresses'`
- **Rendering mode:** HYBRID
- **Liquid template key:** `'customers/addresses'`
- **React fallback:** `<AddressesPageClient />` (client component)
- **Auth required:** Yes (Liquid path: unauthenticated = redirect to `basePath`)

---

### Privacy Policy — `/store/[subdomain]/privacy`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/privacy/page.tsx`
- **Route type:** `'policy'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'policy'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with `createContentFallbackSection(resource)` providing the rich-content section.
- **Auth required:** No
- **Notes:** Uses `ContentResourceRenderer`. Tries `ContentService.getPolicy(subdomain, 'privacy')` first, then falls back to `ContentService.getPageBySlug(subdomain, 'privacy')`. Liquid gets a `page` drop with `body_html`.

---

### Terms of Service — `/store/[subdomain]/terms`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/terms/page.tsx`
- **Route type:** `'policy'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'policy'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with content fallback section.
- **Auth required:** No
- **Notes:** Same pattern as privacy. Tries `ContentService.getPolicy(subdomain, 'terms')` first.

---

### Shipping Policy — `/store/[subdomain]/shipping`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/shipping/page.tsx`
- **Route type:** `'policy'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'policy'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with content fallback section.
- **Auth required:** No
- **Notes:** Tries `ContentService.getPolicy(subdomain, 'shipping')` first.

---

### Returns Policy — `/store/[subdomain]/returns`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/returns/page.tsx`
- **Route type:** `'policy'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'policy'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with content fallback section.
- **Auth required:** No
- **Notes:** Tries `refund` policy key first, then `returns`, then page slug. Most defensive fallback
  chain of the four policy routes.

---

### Blog Post — `/store/[subdomain]/blog/[slug]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/blog/[slug]/page.tsx`
- **Route type:** `'article'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'article'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with content fallback section.
- **Auth required:** No
- **Notes:** Fetches via `ContentService.getBlogPostBySlug()`. Passes `body_html` in `liquidPage` drop. No `revalidate` constant set (defaults to Next.js default).

---

### Dynamic CMS Page — `/store/[subdomain]/[...path]`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/[...path]/page.tsx`
- **Route type:** `'page'` (via `ContentResourceRenderer`)
- **Rendering mode:** HYBRID
- **Liquid template key:** `'page'`
- **React fallback:** `StorefrontCompositionEngine` → `RenderSectionList` with content fallback section.
- **Auth required:** No
- **Notes:** Catch-all for merchant-created CMS pages. Only handles `path.length === 1` (single slug
  segment); multi-segment paths return `notFound()`. Uses `revalidate = 60`. Supports
  `?theme_preview_token`.

---

### Top-Level Orders — `/store/[subdomain]/orders`

- **File:** `apps/storefront-runtime/src/app/store/[subdomain]/orders/page.tsx`
- **Route type:** N/A — no `resolveStorefrontTemplate` call
- **Rendering mode:** REACT (React-only, no Liquid path)
- **Liquid template key:** None
- **React fallback:** `<OrdersClient subdomain={...} storeName={...} />` (client component)
- **Auth required:** Handled inside `OrdersClient`
- **Notes:** This is the original pre-account-area orders page (predates the `/account/orders`
  route). No Liquid integration. Coexists with the Liquid-capable `/account/orders` route.

---

## Full Route Table

| Route | File (relative to `src/app/store/[subdomain]/`) | Mode | Liquid Template | React Component | Auth | Notes |
|-------|--------------------------------------------------|------|-----------------|-----------------|------|-------|
| `/` (home) | `page.tsx` | HYBRID | `index` | `StorefrontCompositionEngine` → sections | No | `?engine=` dev override |
| `/product/[productId]` | `product/[productId]/page.tsx` | HYBRID | `product` | `StorefrontCompositionEngine` → sections | No | JSON-LD injected |
| `/collections/[slug]` | `collections/[slug]/page.tsx` | HYBRID | `collection` | `StorefrontCompositionEngine` → sections | No | JSON-LD injected |
| `/products` | `products/page.tsx` | HYBRID | `collection` | `StorefrontCompositionEngine` → sections | No | resourceSlug=all-products |
| `/shop` | `shop/page.tsx` | HYBRID | `collection` | `StorefrontCompositionEngine` → sections | No | Alias for /products |
| `/cart` | `cart/page.tsx` | HYBRID | `cart` | `<CartPageClient />` | No | Explicit branch; empty sectionData for Liquid |
| `/checkout` | `checkout/page.tsx` | REACT | — | `<CheckoutClient />` | No | noIndex |
| `/checkout/success` | `checkout/success/page.tsx` | REACT | — | `'use client'` status stub | No | Legacy Stripe stub |
| `/account` | `account/page.tsx` | HYBRID+REDIRECT | `customers/account` | redirect → `/account/orders` | Yes | React path = redirect |
| `/account/orders` | `account/orders/page.tsx` | HYBRID | `customers/orders` | `<OrdersClient />` | Yes | — |
| `/account/orders/[id]` | `account/orders/[id]/page.tsx` | HYBRID+REDIRECT | `customers/order` | redirect → `/account/orders` | Yes | React path = redirect |
| `/account/settings` | `account/settings/page.tsx` | HYBRID | `customers/settings` | `<SettingsPageClient />` | Yes | — |
| `/account/wishlist` | `account/wishlist/page.tsx` | HYBRID | `customers/wishlist` | `<WishlistPageClient />` | Yes | Enriches product drops |
| `/account/addresses` | `account/addresses/page.tsx` | HYBRID | `customers/addresses` | `<AddressesPageClient />` | Yes | — |
| `/privacy` | `privacy/page.tsx` | HYBRID | `policy` | `ContentResourceRenderer` → sections | No | — |
| `/terms` | `terms/page.tsx` | HYBRID | `policy` | `ContentResourceRenderer` → sections | No | — |
| `/shipping` | `shipping/page.tsx` | HYBRID | `policy` | `ContentResourceRenderer` → sections | No | — |
| `/returns` | `returns/page.tsx` | HYBRID | `policy` | `ContentResourceRenderer` → sections | No | 3-level policy fallback |
| `/blog/[slug]` | `blog/[slug]/page.tsx` | HYBRID | `article` | `ContentResourceRenderer` → sections | No | — |
| `/[...path]` (CMS) | `[...path]/page.tsx` | HYBRID | `page` | `ContentResourceRenderer` → sections | No | 1-segment only |
| `/orders` | `orders/page.tsx` | REACT | — | `<OrdersClient />` | In-client | Legacy orders page |

---

## Canary Flag Analysis

### `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`

| Property | Value |
|----------|-------|
| Defined in | `packages/theme-engine/src/theme-governance.ts` |
| Hardcoded value | `false` |
| Set in `apps/storefront-runtime/.env.local` | **No** — not present |
| Effect in proxy (`proxy.ts`) | Sets `X-Lb-Render-Engine` response header to `'react'` for CDN observability only; does not gate rendering |
| Effect on render decisions | Serves as the `defaultEnabled` fallback in `resolveThemeLiquidRenderingEnabled()` — every store with no explicit `rendererEngine` or `liquidRenderingCanary` signal will render React |

### Per-Theme Activation (Phase 9)

A store activates Liquid rendering when **any** of the following is set in its `templateConfig`:
- `templateConfig.rendererEngine === 'liquid'`
- `releaseManifest.renderer_engine === 'liquid'`
- `releaseManifest.renderer.engine === 'liquid'`
- `templateConfig.liquidRenderingCanary` = truthy
- Various snake_case/camelCase aliases of the above in `themeSettings` or `releaseManifest`

The comment in `store-service.ts` references "Per-theme activation lands in Phase 9."

### Dev Override

In non-production environments, adding `?engine=liquid` or `?engine=react` to any
`resolveStorefrontTemplate`-based route bypasses the canary gate for that request. This is
implemented by `resolveDevEngineOverride()` and is used only by the home page route (`page.tsx`).
Other routes do not pass the engine override through.

### Effect on Each Route When Liquid Is Activated

| Route | Liquid active | React active |
|-------|--------------|-------------|
| Home | Full Liquid index template; React header/footer suppressed in layout | React sections via RenderSectionList |
| Product | Full Liquid product template with product/reviews drops | React product-detail section |
| Collection | Full Liquid collection template with products drop | React product-grid section |
| Products / Shop | Full Liquid collection template (`all-products`) | React product-grid section |
| Cart | Full Liquid cart template; cart drop is browser-hydrated null at SSR | `CartPageClient` |
| Account (dashboard) | Liquid `customers/account`; auth required | Redirect to /account/orders |
| Account Orders | Liquid `customers/orders` with orders drop | `OrdersClient` |
| Account Order Detail | Liquid `customers/order` with specific order drop | Redirect to /account/orders |
| Account Settings | Liquid `customers/settings` | `SettingsPageClient` |
| Account Wishlist | Liquid `customers/wishlist` with enriched product drops | `WishlistPageClient` |
| Account Addresses | Liquid `customers/addresses` | `AddressesPageClient` |
| Policies / Blog / CMS | Liquid template + `page` drop with `body_html` | `ContentResourceRenderer` → React content section |
| Checkout | **No change** — always React (`CheckoutClient`) | `CheckoutClient` |
| Checkout Success | **No change** — always React client component | React stub |
| Orders (top-level) | **No change** — always React (`OrdersClient`) | `OrdersClient` |

---

## React-Only Routes (no Liquid path at all)

These routes never call `resolveStorefrontTemplate` and have no Liquid branch. They will remain
React regardless of the canary flag or per-theme `rendererEngine` setting.

| Route | File | Reason |
|-------|------|--------|
| `/checkout` | `checkout/page.tsx` | Deliberately excluded — server-authoritative Razorpay checkout; Liquid not applicable |
| `/checkout/success` | `checkout/success/page.tsx` | `'use client'` directive; legacy Stripe stub with no data fetching |
| `/orders` | `orders/page.tsx` | Legacy pre-account-area orders page; no `resolveStorefrontTemplate` call; parallel route to `/account/orders` |

**Count: 3 routes**

---

## Hybrid Routes (Liquid + React fallback)

These routes call `resolveStorefrontTemplate` (directly or via `resolveAccountLiquid` /
`ContentResourceRenderer`) and branch on `plan.rendererEngine === 'liquid'`.

**Commerce routes:**

| Route | Liquid template | React fallback |
|-------|----------------|----------------|
| `/` (home) | `index` | Section list from templateConfig |
| `/product/[productId]` | `product` | Section list + `ProductDetailFallbackSection` |
| `/collections/[slug]` | `collection` | Section list + `ProductListingFallbackSection` |
| `/products` | `collection` | Section list + `ProductListingFallbackSection` |
| `/shop` | `collection` | Section list + `ProductListingFallbackSection` |
| `/cart` | `cart` | `<CartPageClient />` |

**Account routes:**

| Route | Liquid template | React fallback |
|-------|----------------|----------------|
| `/account` | `customers/account` | Redirect to `/account/orders` |
| `/account/orders` | `customers/orders` | `<OrdersClient />` |
| `/account/orders/[id]` | `customers/order` | Redirect to `/account/orders` |
| `/account/settings` | `customers/settings` | `<SettingsPageClient />` |
| `/account/wishlist` | `customers/wishlist` | `<WishlistPageClient />` |
| `/account/addresses` | `customers/addresses` | `<AddressesPageClient />` |

**Content/policy routes:**

| Route | Liquid template | React fallback |
|-------|----------------|----------------|
| `/privacy` | `policy` | `ContentResourceRenderer` → content section |
| `/terms` | `policy` | `ContentResourceRenderer` → content section |
| `/shipping` | `policy` | `ContentResourceRenderer` → content section |
| `/returns` | `policy` | `ContentResourceRenderer` → content section |
| `/blog/[slug]` | `article` | `ContentResourceRenderer` → content section |
| `/[...path]` (CMS) | `page` | `ContentResourceRenderer` → content section |

**Count: 18 hybrid routes** (6 commerce + 6 account + 6 content/policy)

---

## Fully Liquid Routes

There are **no routes that are Liquid-only** in the current implementation. Every route that
supports Liquid has a React fallback (or redirect). The canary architecture is strictly additive —
Liquid is an opt-in overlay on top of the existing React section engine. Even with
`rendererEngine: 'liquid'` set on a store, `StorefrontCompositionEngine` falls back to React section
rendering if `renderLiquidPlan()` returns `null` (e.g., template not found in bundle, renderer
error).

---

## Routes That Redirect

These routes use `next/navigation`'s `redirect()` as their React fallback (not a render).

| Route | Redirect target | Condition |
|-------|----------------|-----------|
| `/account` (React mode) | `/store/[subdomain]/account/orders` | `!isLiquid` — React stores have no /account page |
| `/account` (Liquid mode, unauthenticated) | `/store/[subdomain]` (store home) | `isLiquid && !isAuthenticated` |
| `/account/orders` (Liquid mode, unauthenticated) | `/store/[subdomain]` (store home) | `isLiquid && !isAuthenticated` |
| `/account/orders/[id]` (unauthenticated) | `/store/[subdomain]` (store home) | `!isAuthenticated` (both modes) |
| `/account/orders/[id]` (React mode) | `/store/[subdomain]/account/orders` | `isAuthenticated && !isLiquid` — no React order-detail page |
| `/account/settings` (Liquid mode, unauthenticated) | `/store/[subdomain]` | `isLiquid && !isAuthenticated` |
| `/account/wishlist` (Liquid mode, unauthenticated) | `/store/[subdomain]` | `isLiquid && !isAuthenticated` |
| `/account/addresses` (Liquid mode, unauthenticated) | `/store/[subdomain]` | `isLiquid && !isAuthenticated` |
| Subdomain with active custom domain | Custom domain (301) | `proxy.ts`: subdomain traffic 301s to `custom_domain` |
| Redirect domain (multi-domain) | Primary host (301) | `proxy.ts`: `matched_domain_role === 'redirect'` |

---

## Summary Counts

| Mode | Count | Routes |
|------|-------|--------|
| HYBRID (Liquid + React) | 18 | home, product, collection, products, shop, cart, account, account/orders, account/orders/[id], account/settings, account/wishlist, account/addresses, privacy, terms, shipping, returns, blog/[slug], [...path] |
| REACT only | 3 | checkout, checkout/success, orders |
| FULLY LIQUID | 0 | — |
| REDIRECT (as React fallback) | 2 of the 18 hybrid routes also redirect: `/account` and `/account/orders/[id]` | — |

**Total page routes audited: 21**

### `StorefrontRouteType` enum coverage

The `StorefrontRouteType` union defines 16 values. Of these, 13 are actively exercised by page
files:

| `StorefrontRouteType` value | Used by route |
|-----------------------------|---------------|
| `'index'` | `/` (home) |
| `'product'` | `/product/[productId]` |
| `'collection'` | `/collections/[slug]`, `/products`, `/shop` |
| `'page'` | `/[...path]` |
| `'policy'` | `/privacy`, `/terms`, `/shipping`, `/returns` |
| `'blog'` | Not used directly (blog uses `'article'`) |
| `'article'` | `/blog/[slug]` |
| `'cart'` | `/cart` |
| `'search'` | **No route file** — defined in type but unimplemented |
| `'customer_account'` | `/account` |
| `'customer_orders'` | `/account/orders` |
| `'customer_wishlist'` | `/account/wishlist` |
| `'customer_settings'` | `/account/settings` |
| `'customer_addresses'` | `/account/addresses` |
| `'customer_order'` | `/account/orders/[id]` |
| `'password'` | **No route file** — defined in type; password gate is handled by `proxy.ts` middleware, not a page |
| `'not_found'` | **No route file** — type reserved for 404 handling |

### Key architectural observations

1. **Canary is globally off by default.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` is
   hardcoded. The flag does not exist in `.env.local`. Liquid only activates per store when
   `templateConfig.rendererEngine === 'liquid'` or a `liquidRenderingCanary` signal is present.

2. **`ContentResourceRenderer` unifies content routes.** All six policy/content routes go through
   the same `ContentResourceRenderer` → `resolveStorefrontTemplate` → `StorefrontCompositionEngine`
   pipeline, making them equally Liquid-capable without per-route duplication.

3. **`resolveAccountLiquid` is account-exclusive.** Only the six `/account/*` routes use this helper.
   The pattern is consistent: Liquid active + authenticated = render; Liquid active + unauthenticated
   = redirect to home; React = render client component (or redirect where no React page exists).

4. **Two routes have no React render — only a redirect.** `/account` and `/account/orders/[id]`
   have no React page implementation; their React fallback is a redirect. These are effectively
   Liquid-only rendering routes with a redirect degradation path.

5. **Checkout is structurally firewalled from Liquid.** Both checkout routes bypass
   `resolveStorefrontTemplate` entirely. This is intentional: checkout is server-authoritative with
   Razorpay HMAC verification, COD logic, and canonical ledger RPC calls that must never be
   delegated to a theme renderer.

6. **`?engine=` dev override only wired to home page.** `resolveDevEngineOverride()` is called only
   in `page.tsx`. Other HYBRID routes would need the override plumbed through their `searchParams`
   to use it.

7. **`'search'`, `'password'`, and `'not_found'` route types are unimplemented.** They exist in
   `StorefrontRouteType` but have no corresponding page files. Password gate is in `proxy.ts`;
   search and not_found have no surface routes.
