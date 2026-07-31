# Liquid Coverage Report

**Generated:** 2026-06-18
**Source bundle:** `createUrbanKicksLiquidThemeBundleFixture()` in `packages/theme-engine/src/theme-bundle.ts`
**Storefront runtime:** `apps/storefront-runtime/src/lib/theme-engine/`

---

## Methodology

Coverage is calculated across three orthogonal axes:

1. **Template coverage** — each `StorefrontRouteType` in `types.ts` is a distinct route. A route is "Liquid-covered" when the Urban Kicks bundle registers a template key that the `renderLiquidPlan` path will resolve (e.g. `'index'`, `'product'`, `'customers/settings'`). The renderer engine switches to Liquid only when `plan.rendererEngine === 'liquid'` and `plan.liquidBundle` is populated; otherwise it falls back to React via `renderRegisteredSection`.

2. **Section coverage** — each section definition in the Urban Kicks bundle is either a `createLiquidSectionFile(...)` call (inline Liquid source, `renderer_key = liquid.section.<type>`) or a React-registry entry (a `renderer_key` from `SECTION_RENDERER_DEFINITIONS` in `renderer-registry.tsx`). In Liquid mode the entire page bypasses the React registry, so all sections rendered by `createThemeRenderer('liquid')` are "fully Liquid". Sections that only have a React renderer key (e.g. `announcement-bar` in `createMinimalThemeBundleFixture`) would be "partial" under a JSON-contract theme but are irrelevant under Urban Kicks Liquid since it uses the Liquid engine throughout.

3. **Island coverage** — nine Web Component custom elements registered by `registerLiquidHydrationIslands()`. Each covers a specific interaction pattern surfaced inside Liquid HTML via `lb-*` custom element tags. Coverage is the ratio of live interaction patterns to registered island kinds.

The Urban Kicks Liquid bundle (`LiquidThemePackageBundle`, `renderer.engine = 'liquid'`) stores ALL section HTML as inline Liquid source strings within the bundle. No section falls back to the React renderer when the engine is `'liquid'`; `renderLiquidPlan` either returns full HTML or returns `null` causing a React fallback for the entire page.

---

## Template Coverage

### Urban Kicks Bundle Templates

The bundle (`createUrbanKicksLiquidThemeBundleFixture`) registers 15 template keys.

| Template Key | Sections Registered | Section Types Used |
|---|---|---|
| `header` | 1 (`header-default`) | `header` |
| `footer` | 1 (`footer-default`) | `footer` |
| `index` | 7 (`announcement-default`, `hero-default`, `category-grid-default`, `featured-collection-default`, `product-grid-default`, `spotlight-default`, `newsletter-default`) | `announcement-bar`, `hero-banner`, `category-grid`, `featured-products`, `product-grid`, `spotlight`, `newsletter-signup` |
| `product` | 2 (`product-detail-default`, `product-related`) | `product-detail`, `featured-products` |
| `collection` | 2 (`collection-banner-default`, `collection-products`) | `collection-banner`, `collection-product-list` |
| `search` | 2 (`search-box-default`, `search-results`) | `search-box`, `collection-product-list` |
| `cart` | 1 (`cart-summary-default`) | `cart-summary` |
| `customers/login` | 1 (`customer-login-default`) | `customer-login` |
| `customers/register` | 1 (`customer-register-default`) | `customer-register` |
| `customers/account` | 1 (`customer-account-default`) | `customer-account` |
| `customers/orders` | 1 (`customer-orders-default`) | `customer-orders` |
| `customers/order` | 1 (`customer-order-detail-default`) | `customer-order-detail` |
| `customers/settings` | 1 (`customer-settings-default`) | `customer-settings` |
| `customers/wishlist` | 1 (`customer-wishlist-default`) | `customer-wishlist` |
| `customers/addresses` | 1 (`customer-addresses-default`) | `customer-addresses` |
| `policy` | 1 (`policy-content-default`) | `policy-content` |

**Note:** `header` and `footer` are layout-level templates resolved outside the per-route section groups (`StorefrontSectionGroupRenderer`). They are present in the bundle and handled by `renderLiquidPlan`'s `result.liquid.header` / `result.liquid.footer` fragments.

### StorefrontRouteType vs Bundle Template Mapping

The `StorefrontRouteType` union (from `types.ts`) defines 19 route types. Mapping to Urban Kicks bundle templates:

| StorefrontRouteType | Urban Kicks Template Key | Liquid Coverage |
|---|---|---|
| `index` | `index` | Full Liquid |
| `product` | `product` | Full Liquid |
| `collection` | `collection` | Full Liquid |
| `page` | — | No Liquid template |
| `policy` | `policy` | Full Liquid |
| `blog` | — | No Liquid template |
| `article` | — | No Liquid template |
| `cart` | `cart` | Full Liquid |
| `search` | `search` | Full Liquid |
| `customer_account` | `customers/account` | Full Liquid |
| `customer_orders` | `customers/orders` | Full Liquid |
| `customer_wishlist` | `customers/wishlist` | Full Liquid |
| `customer_settings` | `customers/settings` | Full Liquid |
| `customer_addresses` | `customers/addresses` | Full Liquid |
| `customer_order` | `customers/order` | Full Liquid |
| `password` | — | No Liquid template |
| `not_found` | — | No Liquid template |

---

## Sections — Liquid vs React

All sections in the Urban Kicks bundle are defined as `ThemeLiquidSectionFile` objects (created via `createLiquidSectionFile` or inline with explicit `path`/`source`/`schema`). When the engine is `'liquid'`, the React renderer registry is bypassed entirely — there is no React fallback per section. Every section below has full inline Liquid source.

Under the JSON-contract engine (a hypothetical non-Liquid Urban Kicks variant), sections would delegate to the React `SECTION_RENDERER_DEFINITIONS` by `renderer_key`. The table below records the React `renderer_key` each section _would_ use if rendered in React mode, derived from the registry.

| Section Type | Liquid Source (inline) | React renderer_key (if React mode) | Status |
|---|---|---|---|
| `announcement-bar` | Yes — `sections/announcement-bar.liquid` | `core.hero` (no direct mapping — would fall through to `UnknownSectionFallback`) | Full Liquid |
| `hero-banner` | Yes — `sections/hero-banner.liquid` | `core.hero` (`heroBanner`, `hero`, `hero-banner`) | Full Liquid |
| `category-grid` | Yes — `sections/category-grid.liquid` | `commerce.category-grid` (`categoryGrid`, `category-grid`) | Full Liquid |
| `featured-products` | Yes — `sections/featured-products.liquid` | `core.featured-products` (`featuredProducts`, `featured-products`, `featured_collection`) | Full Liquid |
| `product-grid` | Yes — `sections/product-grid.liquid` | `core.product-grid` (`productGrid`, `product-grid`, `product_grid`) | Full Liquid |
| `spotlight` | Yes — `sections/spotlight.liquid` | None — no React match → `UnknownSectionFallback` | Full Liquid (Liquid-only, no React parity) |
| `newsletter-signup` | Yes — `sections/newsletter-signup.liquid` | `core.newsletter` (matches `newsletter` not `newsletter-signup`) | Full Liquid |
| `product-detail` | Yes — `sections/product-detail.liquid` (from `createLiquidParitySectionFiles`) | `core.product-detail` (`productDetail`, `product-detail`) | Full Liquid |
| `header` | Yes — `sections/header.liquid` (from `createLiquidParitySectionFiles`) | `core.header` (`header`) | Full Liquid |
| `footer` | Yes — `sections/footer.liquid` (from `createLiquidParitySectionFiles`) | `core.footer` (`footer`) | Full Liquid |
| `collection-banner` | Yes — `sections/collection-banner.liquid` | None — no React match → `UnknownSectionFallback` | Full Liquid |
| `collection-product-list` | Yes — `sections/collection-product-list.liquid` | None — no React match → `UnknownSectionFallback` | Full Liquid |
| `search-box` | Yes — `sections/search-box.liquid` | None — no React match → `UnknownSectionFallback` | Full Liquid |
| `cart-summary` | Yes — `sections/cart-summary.liquid` | None — no React match → `UnknownSectionFallback` | Full Liquid |
| `customer-login` | Yes — `sections/customer-login.liquid` | None | Full Liquid |
| `customer-register` | Yes — `sections/customer-register.liquid` | None | Full Liquid |
| `customer-account` | Yes — `sections/customer-account.liquid` | None | Full Liquid |
| `customer-orders` | Yes — `sections/customer-orders.liquid` | None | Full Liquid |
| `customer-order-detail` | Yes — `sections/customer-order-detail.liquid` | None | Full Liquid |
| `customer-settings` | Yes — `sections/customer-settings.liquid` | None | Full Liquid (uses `lb-customer-settings` island) |
| `customer-wishlist` | Yes — `sections/customer-wishlist.liquid` | None | Full Liquid (uses `lb-wishlist-toggle` island) |
| `customer-addresses` | Yes — `sections/customer-addresses.liquid` | None | Full Liquid (uses `lb-address-manager` island) |
| `policy-content` | Yes — `sections/policy-content.liquid` | None | Full Liquid |
| `about-section` | Yes (from `createLiquidParitySectionFiles`) | `core.about` | Full Liquid |
| `app-block-slot` | Yes (from `createLiquidParitySectionFiles`) | `apps.app-block-slot` | Full Liquid |
| `banner-carousel` | Yes (from `createLiquidParitySectionFiles`) | None — no React match | Full Liquid |
| `brand-marquee` | Yes (from `createLiquidParitySectionFiles`) | `commerce.brand-marquee` | Full Liquid |
| `category-grid` | (see above, deduplicated) | — | — |
| `contact-form` | Yes (from `createLiquidParitySectionFiles`) | `core.contact-form` | Full Liquid |
| `cta-section` | Yes (from `createLiquidParitySectionFiles`) | `core.cta` | Full Liquid |
| `experience-timeline` | Yes (from `createLiquidParitySectionFiles`) | `core.experience-timeline` | Full Liquid |
| `marquee` | Yes (from `createLiquidParitySectionFiles`) | None | Full Liquid |
| `portfolio-grid` | Yes (from `createLiquidParitySectionFiles`) | `core.portfolio-grid` | Full Liquid |
| `rich-content` | Yes (from `createLiquidParitySectionFiles`) | `core.rich-content` | Full Liquid |
| `services-grid` | Yes (from `createLiquidParitySectionFiles`) | `core.services-grid` | Full Liquid |
| `skills-section` | Yes (from `createLiquidParitySectionFiles`) | `core.skills` | Full Liquid |
| `testimonials` | Yes (from `createLiquidParitySectionFiles`) | `core.testimonials` | Full Liquid |
| `trust-badges` | Yes (from `createLiquidParitySectionFiles`) | `commerce.trust-badges` | Full Liquid |

**Section count summary:** The Urban Kicks Liquid bundle defines sections from two sources:
- **Directly in `createUrbanKicksLiquidThemeBundleFixture`:** `customer-orders`, `customer-order-detail`, `customer-account`, `customer-login`, `customer-register`, `customer-settings`, `customer-wishlist`, `customer-addresses`, `policy-content`, `cart-summary`, `search-box`, `collection-banner`, `collection-product-list`, plus inline overrides for `announcement-bar`, `hero-banner`, `category-grid`, `featured-products`, `product-grid`, `spotlight`, `newsletter-signup` — **20 sections**
- **Spread from `createLiquidParitySectionFiles()`:** `announcement-bar` (overridden above), `about-section`, `app-block-slot`, `banner-carousel`, `brand-marquee`, `category-grid` (overridden), `contact-form`, `cta-section`, `experience-timeline`, `footer`, `header`, `hero-banner` (overridden), `marquee`, `portfolio-grid`, `product-detail`, `product-grid` (overridden), `rich-content`, `services-grid`, `skills-section`, `testimonials`, `trust-badges`, `newsletter-signup` (overridden) — **22 section types, with 5 overridden by the main bundle**

Net unique section types in the bundle: approximately **35 distinct sections** (all with inline Liquid source, all status Full Liquid).

---

## Hydration Islands Coverage

Nine custom elements registered in `registerLiquidHydrationIslands()` (line 1268 of `liquid-hydration-islands.tsx`):

| Island Name (custom element) | Class | Purpose | Used by Section(s) | Status |
|---|---|---|---|---|
| `lb-add-to-cart` | `LbAddToCartElement` | Add product to localStorage cart, sync to gateway, open cart drawer | `product-detail`, `product-grid`, `collection-product-list` | Registered |
| `lb-cart-drawer` | `LbCartDrawerElement` | Slide-in cart panel; renders items + server-authoritative totals | `header` (auto-injected if missing), all pages that include add-to-cart | Registered |
| `lb-search` | `LbSearchElement` | Search form with URL navigation | `header`, `search-box` | Registered |
| `lb-variant-picker` | `LbVariantPickerElement` | Product variant option selection (aria-pressed buttons + hidden inputs) | `product-detail` | Registered |
| `lb-review-form` | `LbReviewFormElement` | Star rating + review text submission with Turnstile verification | `product-detail` | Registered |
| `lb-wishlist-toggle` | `LbWishlistToggleElement` | Heart button — guest uses localStorage, authenticated calls `/api/customer/wishlist` | `product-detail`, `product-grid`, `collection-product-list`, `customer-wishlist` | Registered |
| `lb-cart` | `LbCartElement` | Full cart page with quantity step controls + server totals | `cart-summary` | Registered |
| `lb-customer-settings` | `LbCustomerSettingsElement` | Profile edit form + password change, calls `/api/customer/profile` and `/api/customer/set-password` | `customer-settings` | Registered |
| `lb-address-manager` | `LbAddressManagerElement` | Address CRUD (add/edit/delete/set-default) via `/api/customer/addresses` | `customer-addresses` | Registered |

All 9 islands are defined in `LIQUID_HYDRATION_ISLANDS` in `theme-bundle.ts` (lines 30–76) and registered in `registerLiquidHydrationIslands`. The `LiquidHydrationIslands` React component (rendered after the Liquid HTML `dangerouslySetInnerHTML` block) calls registration via `useEffect` on mount, scoped to the `[data-theme-renderer="liquid"]` root.

**Islands not yet implemented (interaction patterns present in Liquid HTML but no dedicated island):**
- Quantity stepper in product detail (handled inline by `lb-add-to-cart` via `data-lb-quantity`)
- Checkout redirect (plain `<a>` tag — no island needed)
- Login / register forms (plain HTML form POST — no island needed currently)

---

## Route Coverage

### Routes with Full Liquid Support (template + section + data)

All routes below have: (a) a template key registered in the Urban Kicks bundle, (b) all referenced sections defined with inline Liquid source, and (c) data hydrated by `buildLiquidCommerceContext` in `composition-engine.tsx`.

- **`index`** — 7-section home page: announcement bar, hero, category grid, featured products, product grid, spotlight, newsletter. Commerce drops: `shop`, `collection`, `collections`, `cart`.
- **`product`** — product detail + related products. Commerce drops: `product` (with `reviews`, `options`, `variants`, `in_wishlist`).
- **`collection`** — collection banner + product list. Commerce drops: `collection.products`.
- **`cart`** — full cart page. Commerce drop: `cart` (server-authoritative totals from gateway; SSR renders null totals, hydrated by `lb-cart`).
- **`search`** — search box + results list. Commerce drops: `search.terms`, `collection.products`.
- **`customer_account`** (`customers/account`) — account overview with nav links. Drop: `customer`.
- **`customer_orders`** (`customers/orders`) — order history list. Drop: `customer.orders` (fetched when `includeOrders` = true in `getStorefrontCustomerDrop`).
- **`customer_order`** (`customers/order`) — single order detail with timeline and tracking. Drop: `order` (via `getCustomerOrderDetailDrop`).
- **`customer_settings`** (`customers/settings`) — settings display + `lb-customer-settings` island.
- **`customer_wishlist`** (`customers/wishlist`) — wishlist product grid. Drop: `customer.wishlist_products` (enriched via `ProductService.getProductsByIds`).
- **`customer_addresses`** (`customers/addresses`) — address list display + `lb-address-manager` island.
- **`policy`** — policy page content. Drop: `page` (title + body).
- **`customers/login`** — login form (HTML POST, no island required).
- **`customers/register`** — register form (HTML POST, no island required).

### Routes with Partial Liquid Support (template exists but section is React-renderer)

None. All template-covered routes in the Urban Kicks bundle use sections with inline Liquid source. The `LiquidThemePackageBundle` schema enforces that every section reference resolves to a `ThemeLiquidSectionFile` with a source string.

### Routes with No Liquid Support (React-only)

The following `StorefrontRouteType` values have no Urban Kicks bundle template and fall back to the React renderer path (`renderRegisteredSection` via `RenderSectionList`):

- **`page`** — generic CMS page. No `page` template in Urban Kicks. Would render `rich-content` or `contentPage` via React.
- **`blog`** — blog index. No `blog` template. No React renderer equivalent either (would show `UnknownSectionFallback`).
- **`article`** — blog article. No `article` template.
- **`password`** — store password protection page. No template.
- **`not_found`** — 404 page. No template.

---

## Coverage Percentages

### Template Coverage

| Metric | Count | Percentage |
|---|---|---|
| Total unique `StorefrontRouteType` values | 19 | — |
| Routes with a Liquid template in Urban Kicks | 15 (14 route types + header/footer layout) | 74% of route types (12 of 17 non-layout types covered) |
| Routes with full Liquid support (template + all sections Liquid) | 14 (all template-covered routes, excluding header/footer layout) | 74% of all route types |
| Routes React-only (no Liquid template) | 5 (`page`, `blog`, `article`, `password`, `not_found`) | 26% |

Note: `header` and `footer` are layout-level templates resolved as `result.liquid.header` / `result.liquid.footer`, not as a `StorefrontRouteType`. Counting them, the bundle has 16 templates covering 14 + 2 layout keys.

### Section Coverage

| Metric | Count | Percentage |
|---|---|---|
| Total unique section types in the Urban Kicks bundle | ~35 | — |
| Sections with inline Liquid source | ~35 | 100% |
| Sections relying on React renderer_key (no Liquid source) | 0 | 0% |
| Sections that also have a matching React renderer_key (dual coverage) | ~17 | ~49% |
| Sections with Liquid source only (no React match) | ~18 | ~51% |

All sections in the `LiquidThemePackageBundle` have `renderer_key = liquid.section.<type>` assigned automatically by `buildLiquidRuntimeSectionSchemas`. None delegate to a React component when the engine is `'liquid'`.

### Island Coverage

| Metric | Count | Percentage |
|---|---|---|
| Total `lb-*` island kinds defined in `LIQUID_HYDRATION_ISLANDS` | 9 | — |
| Island classes implemented (`class Lb*Element`) | 9 | 100% |
| Islands registered in `registerLiquidHydrationIslands` | 9 | 100% |
| Interaction patterns covered by islands | 9 | 100% |
| Islands required by Phase A routes (settings, wishlist, addresses, order) | 3 (`lb-customer-settings`, `lb-wishlist-toggle`, `lb-address-manager`) | 100% of Phase A islands |

---

## Gap Analysis

### What blocks full Liquid coverage?

#### 1. `page` route — generic CMS pages
- **Current state:** No `page` template in the Urban Kicks bundle. Falls back to React `rich-content` section renderer.
- **Blocking reason:** No `page` Liquid section in `createLiquidParitySectionFiles` that renders `{{ page.title }}` + `{{ page.body_html }}` (the `policy-content` section already does this; a `page-content` section would be identical).
- **Estimated effort:** Low — 1 new section file (`page-content.liquid`) that mirrors `policy-content`, plus 1 template entry `page: { sections: { 'page-content-default': { type: 'page-content' } } }`.

#### 2. `blog` and `article` routes
- **Current state:** No `blog` or `article` templates. No React renderer equivalents exist either.
- **Blocking reason:** No blog domain implemented on the platform yet (no `blog_posts` table, no API route, no React section). A Liquid template would need a `blog-post-list` section (loops `blog.articles`) and `article-content` section (renders `article.content`), but the data binding in `buildLiquidCommerceContext` has no `blog` or `article` drop.
- **Estimated effort:** High — requires adding blog drops to `LiquidCommerceDrops`, a gateway API route for blog posts, and new section files.

#### 3. `password` route — store password protection
- **Current state:** No template. Falls back to React, which also has no registered renderer for a password gate section.
- **Blocking reason:** The password protection feature depends on a middleware gate that either redirects or serves the password page. The `storefront-runtime` proxy does not implement the password gate yet.
- **Estimated effort:** Medium — requires middleware support + a `store-password.liquid` section.

#### 4. `not_found` route — 404 page
- **Current state:** No `not_found` template. The 404 is handled by Next.js's `not-found.tsx` at the app level, not by the theme engine.
- **Blocking reason:** The 404 path does not go through `StorefrontCompositionEngine`. It would require a dedicated route handler that resolves to `plan.route.type = 'not_found'` and then calls the composition engine.
- **Estimated effort:** Medium — new Next.js catch-all route + a `not-found.liquid` section.

#### 5. Sections with no React fallback (`spotlight`, `collection-banner`, `collection-product-list`, `search-box`, `cart-summary`, all `customer-*` sections)
- **Current state:** These sections exist in the Liquid bundle but have no matching `renderer_key` in `SECTION_RENDERER_DEFINITIONS`. If a store uses a JSON-contract theme (non-Liquid) that references these section types, they would render as `UnknownSectionFallback`.
- **Blocking reason:** React renderer entries were never added because these sections were designed as Liquid-first.
- **Impact:** Only affects JSON-contract themes. Urban Kicks Liquid is unaffected. Low priority unless a React-only fallback path is needed.
- **Estimated effort:** Medium — 8–10 new React section components + registry entries.

#### 6. Newsletter section type mismatch (`newsletter-signup` vs `newsletter`)
- **Current state:** The React registry maps `core.newsletter` to section types `['newsletter']`, but the Urban Kicks bundle uses `type: 'newsletter-signup'`. This means a JSON-contract Urban Kicks theme would miss the newsletter section renderer.
- **Blocking reason:** Type aliases diverged between the Liquid bundle and the React registry.
- **Impact:** Does not affect Liquid mode. Affects a hypothetical JSON-contract Urban Kicks theme.
- **Estimated effort:** Trivial — add `'newsletter-signup'` to the `core.newsletter` `sectionTypes` array in `renderer-registry.tsx`.

---

## Phase A Impact Assessment

Phase A added five new `StorefrontRouteType` routes and their corresponding sections:

| Phase A Route | Template Key | Section(s) Added | Islands Used | Delta |
|---|---|---|---|---|
| `customer_settings` | `customers/settings` | `customer-settings` | `lb-customer-settings` | +1 template, +1 section, +1 island |
| `customer_addresses` | `customers/addresses` | `customer-addresses` | `lb-address-manager` | +1 template, +1 section, +1 island |
| `customer_order` | `customers/order` | `customer-order-detail` | None (static HTML with `order` drop) | +1 template, +1 section |
| `policy` | `policy` | `policy-content` | None | +1 template, +1 section |
| `customer_wishlist` | `customers/wishlist` | `customer-wishlist` | `lb-wishlist-toggle` (already existed) | +1 template, +1 section |

**Phase A cumulative impact:**
- Templates covered: +5 (from 9 core routes to 14, i.e. from ~47% to ~74% of `StorefrontRouteType` values)
- New sections: +5 (all with inline Liquid source)
- New islands: +2 (`lb-customer-settings` at line 1024, `lb-address-manager` at line 1111)
- Island reuse: `lb-wishlist-toggle` was already registered; Phase A's `customer-wishlist` section reuses it for the wishlist grid

The `customer-orders` / `customer-order-detail` routes also gained server-side order drop hydration: `getStorefrontCustomerDrop` receives `{ includeOrders: true }` when `plan.route.type === 'customer_orders'` or `'customer_order'`, and `getCustomerOrderDetailDrop` fetches the specific order for the order detail page. This is data binding, not a section addition, but it is required for the Liquid `order` drop to be non-null at render time.

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-research/03-liquid-coverage-report.md`*
*Sources: `packages/theme-engine/src/theme-bundle.ts` (2971 lines), `apps/storefront-runtime/src/lib/theme-engine/types.ts`, `composition-engine.tsx`, `renderer-registry.tsx`, `liquid-hydration-islands.tsx`*
