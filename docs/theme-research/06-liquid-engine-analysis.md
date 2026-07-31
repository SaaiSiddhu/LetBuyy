# Liquid Engine Deep Analysis

## Overview

The Liquid engine is the server-side HTML rendering system for LetBuyy storefronts. It is built on top of [LiquidJS](https://liquidjs.com/) v10.27.0, a JavaScript implementation of the Liquid template language. The engine compiles a validated `LiquidThemePackageBundle` (theme layouts, sections, blocks, locales, and settings stored as an in-process object) into sanitized HTML on every SSR pass. The output is sanitized with DOMPurify backed by a JSDOM window and then injected verbatim into the Next.js page tree via `dangerouslySetInnerHTML`. Interactive commerce functionality (add-to-cart, variant picker, cart drawer, search, wishlists, reviews, account, addresses) is delivered through nine custom HTML elements (`lb-*`) registered as Web Components on the client side.

The engine is currently a canary feature. The flag `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` keeps React as the default renderer. A store opts into Liquid rendering by setting `rendererEngine: 'liquid'` and supplying a `liquidBundle` in its `template_config`.

---

## Architecture

### Rendering Pipeline

The following is the step-by-step flow from a storefront route request to returned HTML.

**Step 1: Route hits the Next.js page.**
A storefront page component in `apps/storefront-runtime/src/app/` constructs a `StorefrontRenderPlan` (containing route type, subdomain, template ID, sections, `rendererEngine`, and `liquidBundle`) and calls `StorefrontCompositionEngine`.

**Step 2: `StorefrontCompositionEngine` (composition-engine.tsx)**
This is the top-level async React server component. It calls `renderLiquidPlan(...)`. If `plan.rendererEngine !== 'liquid'` or `plan.liquidBundle` is absent, it falls through to the React `RenderSectionList` path.

**Step 3: `renderLiquidPlan` (composition-engine.tsx: line 399)**
Checks whether to run the Liquid path. It then:
- Calls `getStorefrontCustomerDrop(store.id, { includeOrders })` (server-only, resolves HS256 session).
- Optionally calls `getCustomerOrderDetailDrop` for `customer_order` routes.
- Optionally enriches wishlist products for `customer_wishlist` routes via `ProductService.getProductsByIds`.
- Calls `createThemeRenderer('liquid')` to get a `LiquidRenderer` instance.
- Builds `liquidContext` via `buildLiquidCommerceContext(...)`.
- Calls `renderer.render(input)`.

**Step 4: `LiquidRenderer.render` (theme-renderer.ts: line 333)**
- Validates that `input.liquidBundle` is present; if not, returns `status: 'unsupported'`.
- Calls `parseLiquidThemePackageBundle(input.liquidBundle)` to re-validate the bundle through the Zod schema.
- Resolves the template key with `resolveLiquidTemplateKey`.
- Builds `themeHeadAssets` (`:root` CSS token block + `LIQUID_THEME_BASE_CSS` inline stylesheet) via `buildLiquidThemeHeadAssets`.
- Renders app-block embed regions (header/footer slots) via `renderLiquidEmbedRegion`.
- Creates the LiquidJS engine instance with `createLiquidEngine`.
- Renders the main template sections via `renderLiquidTemplateSections`.
- Renders the Liquid chrome: `bundle.templates.header` and `bundle.templates.footer` via the same helper (L4).
- Renders the layout wrapper (`layout/theme.liquid`) via `engine.parseAndRender`.
- Sanitizes the full layout document with `sanitizeRenderedHtml(..., { wholeDocument: true })`.

**Step 5: `renderLiquidTemplateSections` (theme-renderer.ts: line 271)**
Iterates sections in `template.order` order. For each section:
- Calls `renderLiquidSectionBlocks` to render all blocks.
- Calls `engine.parseAndRender(stripLiquidSchemaBlocks(sectionFile.source), buildLiquidScope(...), liquidRenderOptions)`.
- Calls `sanitizeRenderedHtml(String(sectionHtml))` on each section's output.

**Step 6: `renderLiquidSectionBlocks` (theme-renderer.ts: line 480)**
For each block in `section.block_order` order:
- If `@app` block type: resolves HTML from `input.liquidAppBlocks` or returns a placeholder `<div data-letbuyy-app-block>`.
- If reusable block file exists: renders via `engine.parseAndRender` with `buildLiquidScope`.
- Sanitizes with `sanitizeRenderedHtml`.

**Step 7: `sanitizeRenderedHtml` (theme-renderer.ts: line 903)**
Loads DOMPurify lazily (singleton promise), backed by a JSDOM window. Applies `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` for fragments, or `LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG` (adds `WHOLE_DOCUMENT: true`) for the layout pass and head metadata.

**Step 8: Back in `renderLiquidPlan`**
Receives `result.liquid.{ header, contentForLayout, footer }` and concatenates them: `\`${header}${contentForLayout}${footer}\``.

**Step 9: `LiquidRenderedHtml` React component (composition-engine.tsx: line 75)**
Injects the concatenated HTML string via `dangerouslySetInnerHTML={{ __html: html }}`. Renders `<LiquidHydrationIslands basePath storeId />` alongside it.

**Step 10: `LiquidHydrationIslands` (liquid-hydration-islands.tsx: line 1292)**
A `'use client'` component. On `useEffect`, calls `registerLiquidHydrationIslands()` which defines all nine `lb-*` custom elements via `window.customElements.define`. Also auto-inserts a `<lb-cart-drawer>` if the page has add-to-cart islands but no drawer.

---

### LiquidJS Configuration

The `createLiquidEngine` function (`theme-renderer.ts: line 429`) instantiates LiquidJS with the following options:

| Option | Value | Effect |
|--------|-------|--------|
| `cache` | `false` | No template caching (safe for SSR, avoids stale state between requests) |
| `dynamicPartials` | `false` | Dynamic `{% render %}` resolution disabled |
| `strictFilters` | `true` | Unknown filters throw an error |
| `strictVariables` | `false` | Unknown variables resolve to empty string (not an error) |
| `ownPropertyOnly` | `true` | Only own properties accessible on drop objects (prototype pollution guard) |
| `outputEscape` | `'escape'` | All template output is HTML-escaped by default |
| `jsTruthy` | `false` | Liquid truthy semantics (empty string and 0 are falsy) |
| `parseLimit` | `300,000` | Maximum bytes parsed per template |
| `renderLimit` | `250` | Maximum render operations |
| `memoryLimit` | `2,000,000` | Maximum memory usage in bytes |
| `templates` | Pre-loaded map | All section/block/layout sources loaded upfront from the bundle |
| `globals` | `{ content_for_header, content_for_footer }` | Theme chrome injected as Liquid globals |

**Custom filters registered** (via `registerLetbuyyLiquidFilters`):

| Filter | Signature | Description |
|--------|-----------|-------------|
| `money` | `(value)` | Formats minor-unit integer as `INR X.XX` using `en-IN` locale |
| `money_with_currency` | `(value, currency?)` | Same with explicit currency code (defaults to `INR`) |
| `json` | `(value)` | `JSON.stringify` with `toLiquidDrop` sanitization; replaces `<` with `<` |
| `asset_url` | `(value)` | Returns safe URL; relative paths prefixed with `/assets/` |
| `image_url` | `(value)` | Same as `asset_url` |
| `t` | `(key, replacements?)` | Looks up a translation key in `bundle.locales[locale]`; supports `{{ name }}` interpolation |

No custom Liquid tags are registered. The `{% render %}` and `{% include %}` tags are forbidden at the source-validation level (`ThemeLiquidSourceSchema`).

---

## Commerce Drops

### LiquidCommerceDrops Interface

Defined in `theme-renderer.ts: line 41`. This is the top-level context object passed into the Liquid scope.

```typescript
interface LiquidCommerceDrops {
  shop?:       Record<string, unknown>;   // store identity
  request?:    Record<string, unknown>;   // current request metadata
  settings?:   Record<string, unknown>;   // theme settings overrides
  product?:    unknown;                   // single product (product routes)
  collection?: unknown;                   // active collection or synthesized all-products
  collections?: unknown;                  // array of collections
  cart?:       unknown;                   // cart state (browser-hydrated at SSR)
  customer?:   unknown;                   // authenticated customer drop or null
  search?:     unknown;                   // search query and results
  order?:      unknown;                   // customer order detail (order-detail routes)
}
```

### buildLiquidCommerceContext

Defined in `composition-engine.tsx: line 339`. Accepts:

```typescript
{
  store: StoreModel,
  plan: StorefrontRenderPlan,
  sectionData: Map<string, SectionRenderData>,
  customer: LiquidCustomerDrop | null,
  orderDetail?: LiquidCustomerOrderDetail | null,
  page?: Record<string, unknown> | null,
}
```

Returns a `LiquidCommerceDrops` object. Population logic:

- **`shop`**: `{ id, name, subdomain, url, locale, currency: 'INR' }` — from `StoreModel`.
- **`product`**: First product found across all section render data, mapped via `productToLiquidDrop`. If reviews are present they are merged in. Wishlist membership is resolved from the customer drop.
- **`collection`**: Synthesized from route type and `sectionData.collection`. For `collection` routes or pages with products, builds `{ id, handle, title, description, products[] }`.
- **`collections`**: Array containing the single collection if one is resolved, otherwise `[]`.
- **`cart`**: If a section has a cart object, uses it. Otherwise returns a server-side placeholder with all money totals as `null` and `source: 'browser_hydrated'` — browser islands hydrate them on load.
- **`customer`**: The `LiquidCustomerDrop` from `getStorefrontCustomerDrop`, or `null` for anonymous users.
- **`order`**: The `LiquidCustomerOrderDetail` from `getCustomerOrderDetailDrop`, or `null`.
- **`page`**: Optional free-form record for page-type routes.

### Per-Route Drop Population

| Route Type | Drops Populated | Key Function |
|------------|----------------|--------------|
| `home` / `index` | `shop`, `cart`, `customer`, `settings` | `buildLiquidCommerceContext` |
| `product` | All of the above + `product` (with reviews + variants), `collection` (all-products) | `buildLiquidCommerceContext` + `ProductService` |
| `collection` | `shop`, `cart`, `customer`, `collection` (with `products[]`), `collections` | `buildLiquidCommerceContext` + `ProductService` |
| `customer_orders` | `shop`, `cart`, `customer` (with `orders[]`) | `getStorefrontCustomerDrop({ includeOrders: true })` |
| `customer_order` | `shop`, `cart`, `customer`, `order` (full detail with line_items and timeline) | `getCustomerOrderDetailDrop` |
| `customer_wishlist` | `shop`, `cart`, `customer` (with `wishlist_products[]` enriched) | `ProductService.getProductsByIds` |
| `search` | `shop`, `cart`, `customer`, `search` | Passed through from plan/sectionData |
| `page` | `shop`, `cart`, `customer`, `page` | `liquidPage` prop |

---

## Customer Drop

Defined in `apps/storefront-runtime/src/lib/customer-drop.ts`. This is a `server-only` module.

### LiquidCustomerDrop

```typescript
interface LiquidCustomerDrop {
  id:                string;
  name:              string | null;
  email:             string;
  phone:             string | null;
  tags:              string[];
  total_orders:      number;
  total_spent:       number;
  accepts_marketing: boolean;
  default_address:   LiquidCustomerAddressDrop | null;
  addresses:         LiquidCustomerAddressDrop[];
  wishlist:          string[];           // product IDs
  wishlist_products: unknown[];          // enriched only on customer_wishlist routes
  orders:            LiquidCustomerOrder[];  // populated only on customer_orders routes
}
```

**`LiquidCustomerAddressDrop`** fields: `id`, `label`, `address1`, `address2`, `city`, `province`, `zip`, `country`, `landmark`, `full_name`, `is_default`.

**`LiquidCustomerOrderDetail`** fields: `id`, `number`, `status`, `currency`, `created_at`, `subtotal`, `discount_total`, `shipping_total`, `total`, `payment_method`, `payment_status`, `tracking_number`, `carrier`, `line_items[]`, `shipping_address`, `timeline[]`.

### getStorefrontCustomerDrop

- Entry: `getStorefrontCustomerDrop(storeId, { includeOrders? })`
- Reads HS256 customer session via `getSession()` (server-only).
- Performs tenant safety check: `session.storeId !== storeId` returns `null`.
- Fetches customer record via `getCustomerByEmail(storeId, session.email)`.
- Fetches wishlist via `getCustomerWishlist(customer.id, storeId)`.
- Orders fetched only when `includeOrders: true`.
- Maps through `mapCustomerDrop(customer, wishlist, orders)`.

### getCustomerOrderDetailDrop

- Fetches all orders via `getCustomerOrders(storeId, session.email)`, finds by ID.
- Maps through `mapOrderDetailDrop(row)` which builds a 5-step timeline (`pending → confirmed → processing → shipped → delivered`).

---

## Section Rendering

### Section Pipeline

1. Bundle template JSON declares `{ sections: { [id]: { type, settings, blocks, block_order, disabled } }, order: [...] }`.
2. `renderLiquidTemplateSections` iterates `orderedKeys(template.sections, template.order)` (respects explicit order; appends any unordered sections).
3. For each non-disabled section, looks up `bundle.sections[templateSection.type]` for the `.liquid` source file.
4. Calls `renderLiquidSectionBlocks` to produce `LiquidRenderedBlock[]`.
5. Calls `engine.parseAndRender(stripLiquidSchemaBlocks(sectionFile.source), buildLiquidScope(...), liquidRenderOptions)`.
6. `buildLiquidScope` merges: `shop`, `request`, `settings` (from `bundle.config.settings_data.current` merged with any `liquidContext.settings` override), `routes`, commerce drops, and the section-specific scope `{ section: { id, type, settings, blocks, block_order, schema } }`.
7. Sanitizes the rendered string with `sanitizeRenderedHtml`.

### Schema Parsing

The `{% schema %}...{% endschema %}` block is **stripped before rendering** via `stripLiquidSchemaBlocks` (a regex replace). The schema is parsed at bundle-load time by the Zod `ThemeLiquidSectionFileSchema` validator, which expects `containsLiquidSchemaBlock` to be true.

- Schema is parsed from the `.source` string during `parseLiquidThemePackageBundle` and stored in `section.schema` on the `ThemeLiquidSectionFile` object.
- At render time, `section.schema` is made available in the Liquid scope as `section.schema` on the section object.
- Setting field types: `text`, `textarea`, `richtext`, `color`, `image`, `select`, `toggle`, `range`, `number`, `url`, `radio`.
- Section schemas must include `{% schema %}` + `{% endschema %}` blocks; the Zod validator rejects files without them.

### Built-in Section Schemas

Defined in `packages/theme-engine/src/built-in-section-schemas.ts`. These are the React-path section schema definitions used by the JSON-contract engine for validation. The canonical list of 24 built-in types:

`header`, `announcementBar`, `heroBanner`, `productDetail`, `productGrid`, `footer`, `featuredProducts`, `testimonials`, `aboutSection`, `collectionFilter`, `newsletter`, `contentPage`, `instagramFeed`, `faqAccordion`, `videoHero`, `trustBadges`, `appBlockSlot`, `categoryGrid`, `brandMarquee`, `portfolioGrid`, `servicesGrid`, `skillsSection`, `experienceTimeline`, `contactForm`, `ctaSection`.

The Liquid-path counterparts are `.liquid` files in the bundle (`createLiquidParitySectionFiles` in `theme-bundle.ts`). There are 21 Liquid section file definitions: `announcement-bar`, `about-section`, `app-block-slot`, `banner-carousel`, `brand-marquee`, `category-grid`, `contact-form`, `cta-section`, `featured-products`, `experience-timeline`, `footer`, `header`, `hero-banner`, `marquee`, `portfolio-grid`, `product-detail`, `product-grid`, `rich-content`, `services-grid`, `skills-section`, `testimonials`, `trust-badges`, `newsletter-signup`.

---

## Snippet Support

The engine does **not** support `{% render %}` or `{% include %}` tags. Both are in the `forbiddenFragments` list in `ThemeLiquidSourceSchema` (theme-bundle.ts: line 126). Any section source containing `{% render %}` or `{% include %}` fails Zod validation and is rejected at bundle parse time. The `{% layout %}` tag is similarly forbidden. Blocks are rendered by the TypeScript layer (not by Liquid `{% render %}`); their HTML is passed into the section scope as `block.content` / `block.html`.

---

## Sanitization

### DOMPurify Configuration

DOMPurify is initialized lazily as a singleton in `getThemeDomPurify()` (theme-renderer.ts: line 870). It uses a JSDOM window (server-only; `/* webpackIgnore: true */` keeps JSDOM out of the client bundle).

**`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`** (fragment-level, used for individual sections and blocks):

```
USE_PROFILES: { html: true }

ADD_TAGS (non-default elements allowed):
  lb-add-to-cart, lb-cart-drawer, lb-search, lb-variant-picker,
  lb-review-form, lb-wishlist-toggle, lb-cart, lb-customer-settings,
  lb-address-manager, iframe, meta

ADD_ATTR (non-default attributes allowed):
  aria-live, aria-pressed, class, content,
  data-app-block-app-id, data-app-block-extension-id, data-app-block-slot, data-app-block-type,
  data-block-id, data-columns, data-editor-mode,
  data-lb-add-to-cart, data-lb-add-to-cart-status, data-authenticated, data-base-path,
  data-in-wishlist, data-lb-island, data-lb-variant-option, data-store-id,
  data-letbuyy-app-block, data-product-currency, data-product-id, data-product-name,
  data-product-price, data-product-url, data-email, data-name, data-phone,
  data-search-url, data-section-id, data-theme-renderer, data-variant-name, data-variant-value,
  height, href, loading, name, sandbox, src, title, type, width

CUSTOM_ELEMENT_HANDLING:
  tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager)$/
  attributeNameCheck: /^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|class|id|role|slot|title|type|name|value|href|src)$/i
  allowCustomizedBuiltInElements: false

FORBID_ATTR: ['style']     — inline style attributes stripped from all elements
FORBID_TAGS: ['base', 'embed', 'object', 'script']  — these tags are removed entirely
```

**`LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG`**: Same as above plus `WHOLE_DOCUMENT: true`. Used for the `layoutHtml` pass and for `allowHeadMetadata` head-content sanitization.

**`uponSanitizeAttribute` hook** (registered on the DOMPurify instance):
- Strips any `data-*` attribute whose value contains `<` or `>`.
- Strips `href`, `src`, and `*url` attributes whose value starts with `javascript:` or `data:text/html`.

**outputEscape mode**: LiquidJS is configured with `outputEscape: 'escape'`, meaning all `{{ variable }}` interpolations are HTML-escaped at the template level before DOMPurify even sees them. DOMPurify is a defense-in-depth layer.

**Security implications**: Inline styles are forbidden (preventing CSS injection / data exfiltration). Script tags, embed, object, and base tags are forbidden. App-block HTML supplied by third parties passes through the same `sanitizeRenderedHtml` path. Token values for CSS custom properties pass through `sanitizeCssTokenValue` which strips `<>{};@()` and truncates to 120 characters before being embedded in a `<style>` tag.

---

## Hydration Islands

### Island Architecture

After the sanitized Liquid HTML is injected into the DOM via `dangerouslySetInnerHTML`, a companion `LiquidHydrationIslands` client component runs a `useEffect` that registers all nine custom elements. The islands are declared directly inside the Liquid template source as `<lb-*>` HTML elements with `data-*` attributes carrying server-rendered values (product IDs, prices, store IDs, customer auth state). The browser's Custom Elements API upgrades them into interactive components.

This is a "progressive enhancement" island architecture: the server renders static markup that is meaningful without JS, and the custom elements layer interactivity on top.

### Island Registration Pattern

```typescript
// Guarded base class (safe for SSR evaluation)
const LiquidIslandBase: typeof HTMLElement =
    typeof HTMLElement !== 'undefined'
        ? HTMLElement
        : (class {} as unknown as typeof HTMLElement);

// Each island extends LiquidIslandBase and uses connectedCallback/disconnectedCallback

function defineLiquidIsland(name: string, constructor: CustomElementConstructor) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, constructor);
    }
}

export function registerLiquidHydrationIslands() {
    if (typeof window === 'undefined') return;
    defineLiquidIsland('lb-add-to-cart', LbAddToCartElement);
    // ...
}
```

The guarded base (`LiquidIslandBase`) is essential because Next.js evaluates `'use client'` modules during the SSR pass, and `HTMLElement` is undefined in Node.js. Without it, `class ... extends HTMLElement` at module scope throws `ReferenceError`.

### Complete Island Registry

| Island | Custom Element | Purpose | Key Data Attributes |
|--------|---------------|---------|---------------------|
| `LbAddToCartElement` | `lb-add-to-cart` | Adds product to localStorage cart + syncs to server | `data-product-id`, `data-product-name`, `data-product-price`, `data-product-currency`, `data-product-url` |
| `LbCartDrawerElement` | `lb-cart-drawer` | Slide-in cart panel; listens to `letbuyy:cart:open` and `letbuyy:cart:changed` events | `data-base-path` |
| `LbSearchElement` | `lb-search` | Search form; navigates to `data-search-url?search=<query>` | `data-search-url` |
| `LbVariantPickerElement` | `lb-variant-picker` | Manages `aria-pressed` state on variant option buttons; emits `letbuyy:variant:changed` | `data-product-id` |
| `LbReviewFormElement` | `lb-review-form` | Review submission form with Cloudflare Turnstile; POSTs to `/api/reviews` | `data-product-id`, `data-store-id` |
| `LbWishlistToggleElement` | `lb-wishlist-toggle` | Heart toggle; guest = localStorage, authenticated = `/api/customer/wishlist` POST/DELETE | `data-product-id`, `data-store-id`, `data-in-wishlist`, `data-authenticated` |
| `LbCartElement` | `lb-cart` | Full-page cart with quantity stepper; all money totals from gateway server cart | `data-base-path` |
| `LbCustomerSettingsElement` | `lb-customer-settings` | Profile and password edit forms; calls `/api/customer/profile` and `/api/customer/set-password` | `data-email`, `data-name`, `data-phone` |
| `LbAddressManagerElement` | `lb-address-manager` | Address CRUD list; calls `/api/customer/addresses` | `data-base-path` |

### Island Security

Data attributes are sanitized by two layers before reaching the islands:
1. **LiquidJS `outputEscape: 'escape'`** — all `{{ variable }}` values written into `data-*` attributes in Liquid source are HTML-escaped at render time.
2. **DOMPurify `uponSanitizeAttribute` hook** — strips any `data-*` attribute whose value contains `<` or `>`.

Inside the island JavaScript, all user-visible string values are passed through `escapeHtml()` before being set as `innerHTML`. Money totals displayed in the cart drawer come verbatim from the server gateway response (`renderLiquidCartTotals`) and are never computed in the browser.

---

## Theme Bundle Integration

A `LiquidThemePackageBundle` (schema version `2026-06-liquid-sections`) contains:

- **`layout.theme`** — single `layout/theme.liquid` file; provides the `<!doctype html>` wrapper that references `{{ content_for_header | raw }}`, `{{ content_for_layout | raw }}`, `{{ content_for_footer | raw }}`.
- **`config.settings_schema`** + **`config.settings_data`** — theme-level settings. `settings_data.current` provides CSS token values.
- **`templates`** — map of template JSON configs (e.g. `index`, `product`, `collection`, `header`, `footer`). Each template declares which sections are on it, their settings, and block configurations.
- **`sections`** — map of `ThemeLiquidSectionFile` objects (`path`, `source`, `schema`). Sections may be up to 200,000 bytes.
- **`blocks`** — map of `ThemeLiquidBlockFile` objects for reusable blocks.
- **`locales`** — map of locale codes to translation dictionaries.
- **`renderer`** — manifest with `engine: 'liquid'`, `renderer_version`, `liquid_ready: true`, and asset declarations.

The bundle is re-validated on every `LiquidRenderer.render` call by `parseLiquidThemePackageBundle`, which runs the full Zod schema. This ensures a corrupt or tampered bundle is caught at render time rather than silently producing bad output.

**Compiler** (`portable-to-liquid.ts`): `compilePortableToLiquidBundle` translates a store's portable JSON `template_config` (React-path) into a valid `LiquidThemePackageBundle`. It uses `createUrbanKicksLiquidThemeBundleFixture()` as the canonical base, maps portable section types (with camelCase-to-kebab-case conversion and explicit overrides), and re-validates the result. The function `compilePortableConfigForPublish` wraps this to produce the `templateConfigPatch` the editor publish route accepts.

---

## Asset Injection

CSS design tokens and the base stylesheet are injected as a single `<style data-theme-renderer="liquid">` tag in `content_for_header`:

1. **`buildLiquidRootTokenBlock`** reads `bundle.config.settings_data.current` and maps 8 token keys (`primaryColor`, `secondaryColor`, `accentColor`, `surfaceColor`, `backgroundColor`, `textColor`, `bodyFontFamily`, `headingFontFamily`) to CSS custom properties (`--primary`, `--secondary`, `--accent`, `--surface`, `--background`, `--foreground`, `--font-body`, `--font-display`). Each value is sanitized by `sanitizeCssTokenValue` which strips `<>{};@()` and truncates at 120 characters.

2. **`LIQUID_THEME_BASE_CSS`** (theme-renderer.ts: line 189) is a multi-rule inline stylesheet covering all `lb-*` section classes. It uses only `var(--*)` custom property references — no hardcoded colors — so the store's token block applies cleanly.

3. The combined `:root{...}` + base CSS is passed into `content_for_header` and thence to `{{ content_for_header | raw }}` in the layout. The `| raw` filter bypasses LiquidJS output escaping for this trusted first-party string (it was not exposed to merchant input).

---

## Execution Flow Diagram

```
Storefront route (Next.js page)
  |
  v
StorefrontCompositionEngine (composition-engine.tsx)
  |-- checks plan.rendererEngine === 'liquid' && plan.liquidBundle
  |
  v
renderLiquidPlan (composition-engine.tsx:399)
  |-- getStorefrontCustomerDrop(store.id, { includeOrders })   [server-only, HS256 session]
  |-- getCustomerOrderDetailDrop (if customer_order route)
  |-- ProductService.getProductsByIds (if customer_wishlist)
  |-- createThemeRenderer('liquid') -> LiquidRenderer
  |-- buildLiquidCommerceContext({ store, plan, sectionData, customer, orderDetail, page })
  |
  v
LiquidRenderer.render (theme-renderer.ts:333)
  |-- parseLiquidThemePackageBundle(input.liquidBundle)   [Zod re-validation]
  |-- resolveLiquidTemplateKey
  |-- buildLiquidThemeHeadAssets(bundle)                  [:root tokens + base CSS]
  |-- renderLiquidEmbedRegion (app-block header/footer embeds)
  |-- createLiquidEngine(bundle, { contentForHeader, contentForFooter, locale })
  |
  v
renderLiquidTemplateSections (for main template + header chrome + footer chrome)
  |-- for each section in order:
  |     |-- renderLiquidSectionBlocks
  |     |     |-- for each block: engine.parseAndRender -> sanitizeRenderedHtml
  |     |
  |     |-- engine.parseAndRender(stripLiquidSchemaBlocks(source), buildLiquidScope(...))
  |     |-- sanitizeRenderedHtml(sectionHtml)          [DOMPurify fragment pass]
  |
  v
buildLiquidScope (theme-renderer.ts:552)
  |-- shop, request, settings (from bundle.config.settings_data.current)
  |-- routes: { root_url, cart_url, search_url }
  |-- buildLiquidCommerceDrops(input.liquidContext)
  |     |-- toLiquidDrop (depth ≤4, keys ≤80, array items ≤100, BLOCKED_DROP_KEYS filter)
  |
  v
engine.parseAndRender(layout/theme.liquid, { content_for_layout, content_for_header, content_for_footer })
  |
  v
sanitizeRenderedHtml(layoutHtml, { wholeDocument: true })   [DOMPurify full-document pass]
  |
  v
renderLiquidPlan concatenates: header + contentForLayout + footer
  |
  v
LiquidRenderedHtml React component
  |-- dangerouslySetInnerHTML={{ __html: html }}
  |-- <LiquidHydrationIslands basePath storeId />
  |
  v
LiquidHydrationIslands (useEffect, client-only)
  |-- registerLiquidHydrationIslands()
  |-- defineLiquidIsland x9 (lb-add-to-cart ... lb-address-manager)
  |-- ensureLiquidCartDrawer (auto-injects drawer if add-to-cart exists without one)
```

---

## Error Handling

- **Bundle absent**: `LiquidRenderer.render` returns `{ status: 'unsupported', warnings: ['Liquid rendering requires a validated portable Liquid theme bundle.'] }`. The caller (`renderLiquidPlan`) receives `null` and falls through to the React render path.
- **Template key not found**: Returns `status: 'unsupported'` with a warning naming the missing template. Falls through to React.
- **Section file not found**: Skipped with a warning string pushed to `warnings[]`; rendering continues with the remaining sections.
- **Block file not found**: If the block type is declared as an inline block in the section schema, an empty-HTML `LiquidRenderedBlock` is emitted. Otherwise the block is silently skipped.
- **LiquidJS render error**: The `liquidRenderOptions` enforce `renderLimit: 250` and `memoryLimit: 2,000,000`. Exceeding these causes LiquidJS to throw. This exception propagates out of `renderLiquidTemplateSections` and would surface as an unhandled rejection in the Next.js render. There is no explicit try/catch around the LiquidJS calls in the renderer itself.
- **`renderLiquidPlan` result `!== 'rendered'` or `!result.liquid`**: Returns `null`; React fallback renders.
- **DOMPurify / JSDOM load failure**: `getThemeDomPurify` is a singleton promise; if it rejects, subsequent `sanitizeRenderedHtml` calls would throw. No explicit recovery.

---

## Performance Characteristics

**Async operations awaited sequentially in `renderLiquidPlan`:**
1. `getStorefrontCustomerDrop` (customer session + DB reads — server-only)
2. Optionally `getCustomerOrderDetailDrop`
3. Optionally `ProductService.getProductsByIds` (wishlist enrichment)
4. `renderer.render(...)` — which itself awaits:
   - `renderLiquidEmbedRegion` (parallel sanitization via `Promise.all`)
   - `renderLiquidTemplateSections` — sections rendered **sequentially** (loop with `await`)
   - Each section's `renderLiquidSectionBlocks` — blocks rendered **sequentially**
   - `sanitizeRenderedHtml` — lazy JSDOM/DOMPurify singleton, synchronous after first load
   - Layout `engine.parseAndRender` + final `sanitizeRenderedHtml`

**Parallelism**: App-block embed regions use `Promise.all` for concurrent sanitization. Section and block rendering is sequential. The DOMPurify singleton loads once (parallel import of `dompurify` + `jsdom` via `Promise.all`).

**LiquidJS render limits**: `parseLimit: 300,000` bytes, `renderLimit: 250` operations, `memoryLimit: 2,000,000` bytes, `templateLimit: 20,000` per render call. These prevent runaway templates from consuming unbounded server resources.

**No caching**: `cache: false` on the LiquidJS instance; the engine is constructed fresh on each request from the bundle's pre-loaded template map.

---

## Test Coverage

Tests are in `packages/theme-engine/test/`. The `tsx --test` runner is used. 13 test files:

| File | Layer / Scenario |
|------|-----------------|
| `theme-engine.test.ts` | Core engine contracts: draft/preview schemas, section validation, sanitize function, bundle fixtures, `LiquidRenderer` basic render, `resolveThemeLiquidRenderingEnabled`, parity gaps |
| `liquid-l2-assets.test.ts` | L2 asset pipeline: CSS token injection, `buildLiquidThemeHeadAssets`, `--lb-*` custom property presence |
| `liquid-l3-compiler.test.ts` | L3 portable-to-Liquid compiler: `compilePortableToLiquidBundle`, type mappings, unmapped section warnings, settings passthrough |
| `liquid-l4-chrome.test.ts` | L4 Liquid chrome: header/footer templates rendered as Liquid (not React); store name and nav links present in `result.liquid.header` |
| `liquid-l5-product.test.ts` | L5 product experience: `product` template renders `product-detail` section with title, images, money-formatted price, add-to-cart island |
| `liquid-l6-collection.test.ts` | L6 collection: `collection` template, `lb-product-grid` renders product cards from `collection.products` drop |
| `liquid-l7-search.test.ts` | L7 search: search template with search drop, result rendering |
| `liquid-l8-cart.test.ts` | L8 cart: cart template, `lb-cart` island presence, `lb-cart-drawer` auto-injection |
| `liquid-l9-auth.test.ts` | L9 authentication gating: customer drop presence/absence, conditional rendering |
| `liquid-l10-account.test.ts` | L10 account page: `customer-settings` island, profile fields from customer drop |
| `liquid-l11-orders.test.ts` | L11 order history: `customer_orders` route, orders array in customer drop |
| `liquid-l12-tracking.test.ts` | L12 order tracking: `customer_order` route, `order` drop with timeline and line items |
| `liquid-l13-authoring.test.ts` | L13 authoring/desync guard: `liquidBundlePublishWouldDesync`, editor publish contracts, `compilePortableConfigForPublish` |
