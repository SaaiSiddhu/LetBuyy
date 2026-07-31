# Theme System Inventory

**Date:** 2026-06-18
**Scope:** Full read of all theme-engine package files, storefront-runtime theme-engine layer, API gateway theme routes, and merchant-control-plane theme APIs.

---

## 1. Package / Module Map

| Package / App | Role | Key Files |
|---|---|---|
| `packages/theme-engine` | Shared theme contract, renderer, governance | `index.ts`, `theme-bundle.ts`, `theme-renderer.ts`, `theme-registry.ts`, `theme-governance.ts`, `execution-runtime.ts`, `portable-to-liquid.ts`, `built-in-section-schemas.ts` |
| `apps/storefront-runtime/src/lib/theme-engine` | Render pipeline per request | `types.ts`, `template-resolver.ts`, `composition-engine.tsx`, `renderer-registry.tsx`, `data-binding-engine.ts`, `liquid-hydration-islands.tsx`, `editor-preview-section-frame.tsx`, `content-route.ts`, `product-route.ts` |
| `services/api-gateway/src/routes/themes.ts` | REST API surface (Hono) | All theme CRUD, install, publish, marketplace routes |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | Business logic adapter | Draft, publish, release, rollback, install, preview-session |
| `services/api-gateway/src/schemas/theme.schema.ts` | Re-export hub for Zod schemas | Re-exports from `@letbuyy/theme-engine` and `@letbuyy/shared-types` |
| `services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts` | Marketplace auxiliary | suggest, collections, authors, purchases, receipts, downloads, developer listings |
| `apps/merchant-control-plane/src/app/api/themes/route.ts` | MCP proxy — list themes | `GET /api/themes` → gateway |
| `apps/merchant-control-plane/src/app/api/themes/install/route.ts` | MCP proxy — install | `POST /api/themes/install` → gateway |
| `apps/merchant-control-plane/src/app/api/themes/publish/route.ts` | MCP proxy — publish store | `POST /api/themes/publish` (toggles `sites.status`) |

**Grep results:**
- Files in `storefront-runtime/src` that reference `THEME_LIQUID`: `proxy.ts`, `lib/theme-engine/template-resolver.ts`, `lib/store-service.ts`
- Files in `packages/theme-engine/src` that reference installTheme|publishTheme|getTheme|ThemeBundle|ThemeRegistry: `theme-renderer.ts`, `theme-bundle.ts`, `portable-to-liquid.ts`, `theme-registry.ts`, `index.ts`

---

## 2. Dual Render Engine Architecture

### Engine Types

There are exactly two render engines, expressed as the `ThemeRendererEngine` union type:
- `'json-contract'` — React-based, default engine. `JsonContractThemeRenderer` class.
- `'liquid'` — Liquid-based, canary. `LiquidRenderer` class.

### Default State

```
THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false
```
Defined in `packages/theme-engine/src/theme-governance.ts`. Liquid is **off by default for all stores**.

### Engine Selection Logic

`resolveThemeLiquidRenderingEnabled()` in `theme-governance.ts` checks in order:
1. Explicit engine override in `rendererEngine` or `releaseManifest.rendererEngine` (if set to `'liquid'`)
2. Canary flags: 12 candidate keys in `templateConfig` (e.g. `liquidRenderingEnabled`, `canaryLiquid`, `featureFlagLiquid`, `liquidEnabled`, `useNewLiquidEngine`, etc.)
3. `defaultEnabled` (= `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`)

In the storefront runtime, `resolveStorefrontTemplate()` in `template-resolver.ts` calls this and, if a `liquidBundle` resolves from the store config, returns a Liquid `StorefrontRenderPlan`. Otherwise it falls back to the React plan.

### Dev Override

`?engine=liquid` or `?engine=react` forces the render engine. Gated: `process.env.NODE_ENV === 'production'` disables it. Implemented in `resolveDevEngineOverride()`.

### Platform-wide Flip Decision

```
THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = {
  status: 'deferred',
  authority: 'ARB',
}
```
The ARB has not approved a platform-wide Liquid flip. Stores can opt in via canary flags but the default stays React.

---

## 3. Bundle Schema Definitions

### ThemePackageBundleSchema (json-contract)

- Schema version constant: `THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract'`
- The portable JSON template config used by the React engine and the editor
- Primary field: `sections[]`, `sectionGroups`, `templates` map, `themeSettings`, `releaseManifest`

### LiquidThemePackageBundleSchema (liquid)

- Schema version constant: `THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections'`
- Structure: `package` (slug, name, schema_version), `schema_version`, `layout`, `sections` map (key → `.liquid` source), `templates` map (key → { layout, sections map, order, blocks })
- `MAX_LIQUID_TEMPLATE_BYTES = 200_000` (200 KB per section file)
- Section path validation: `sections/[a-z0-9]+(?:[-_][a-z0-9]+)*\.liquid`
- Both schemas are Zod-validated. `LiquidThemePackageBundleSchema.safeParse()` is called at every ingestion point (template-resolver, theme-execution.adapter, portable-to-liquid compiler)

### ThemeLiquidSourceSchema Forbidden Patterns

The Zod schema for individual Liquid section source strings forbids:
- `<script`, `</script`, `javascript:`, `data:text/html` (XSS vectors)
- `{% include`, `{% layout`, `{% render` (Shopify-style sub-template directives not supported)

---

## 4. Section Registry

### BuiltInSectionType (25 types)

Defined in `packages/theme-engine/src/index.ts`:

```
'header' | 'announcementBar' | 'heroBanner' | 'productDetail' | 'productGrid' |
'footer' | 'featuredProducts' | 'testimonials' | 'aboutSection' | 'collectionFilter' |
'newsletter' | 'contentPage' | 'instagramFeed' | 'faqAccordion' | 'videoHero' |
'trustBadges' | 'appBlockSlot' | 'categoryGrid' | 'brandMarquee' | 'portfolioGrid' |
'servicesGrid' | 'skillsSection' | 'experienceTimeline' | 'contactForm' | 'ctaSection'
```

(Also exported from `built-in-section-schemas.ts` as `BUILT_IN_SECTION_TYPES` const array with 25 entries — note `ctaSection` is present in the array but the summary count is 25 types total including it.)

### Static SECTION_SCHEMAS Registry (theme-registry.ts)

11 schemas in the static registry: `announcementBar`, `heroBanner`, `featuredProducts`, `productGrid`, `categoryGrid`, `brandMarquee`, `testimonials`, `trustBadges`, `newsletter`, `appBlockSlot`, `header`, `footer`.

### Additional Built-in Section Schemas (built-in-section-schemas.ts)

Schemas defined but not in the static registry (in `ADDITIONAL_BUILT_IN_SECTION_SCHEMAS`): `productDetail`, `aboutSection`, `collectionFilter`, `contentPage`, and more. These extend the static registry with full `settings_schema` field definitions.

### Registered React Section Renderers (renderer-registry.tsx)

19 `RegisteredSectionRenderer` entries covering 22+ renderer keys:

| Namespace | Renderer Keys |
|---|---|
| `core.*` | `core.header`, `core.footer`, `core.hero`, `core.product-grid`, `core.product-detail`, `core.featured-products`, `core.testimonials`, `core.about`, `core.newsletter`, `core.portfolio-grid`, `core.skills`, `core.experience-timeline`, `core.contact-form`, `core.cta`, `core.services-grid`, `core.rich-content` |
| `commerce.*` | `commerce.category-grid`, `commerce.brand-marquee`, `commerce.trust-badges` |
| `apps.*` | `apps.app-block-slot` |

`resolveSectionRendererKey()` checks: `section.rendererKey` → `section.settings.rendererKey` → type via `COMPATIBILITY_RENDERER_KEYS` map.

`renderRegisteredSection()` dispatches to the matched renderer or renders `<UnknownSectionFallback>`.

### Liquid Section Registry

`createLiquidParitySectionFiles()` in `theme-bundle.ts` generates 22 canonical `.liquid` section files:
`announcement-bar`, `about-section`, `app-block-slot`, `banner-carousel`, `brand-marquee`, `category-grid`, `contact-form`, `cta-section`, `featured-products`, `experience-timeline`, `footer`, `header`, `hero-banner`, `marquee`, `portfolio-grid`, `product-detail`, `product-grid`, `rich-content`, `services-grid`, `skills-section`, `testimonials`, `trust-badges`, `newsletter-signup`.

### Parity Table

`THEME_LIQUID_PORTABLE_SECTION_PARITY` in `theme-governance.ts` defines 20 React↔Liquid parity entries mapping `reactFile` → `rendererKey` → `liquidSectionType`.
`THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20`

---

## 5. Template Resolver Fallback Chain

`resolveStorefrontTemplate()` in `template-resolver.ts`:

**Liquid path (when `liquidEnabled = true` and `liquidBundle` resolves):**
1. `resolveLiquidBundle(store)` — checks 4 candidate locations in order:
   - `templateConfig.liquidBundle`
   - `releaseManifest.liquidBundle`
   - `releaseManifest.themeBundle`
   - `releaseManifest.bundle`
2. `resolveLiquidTemplateKey(bundle, route)` — picks `route.templateKey` or `index` or first key
3. `coerceLiquidTemplate(bundle, templateKey)` → returns Liquid `StorefrontRenderPlan` with `rendererEngine: 'liquid'`

**React fallback chain:**
1. `route.templateKey` → `store.templateConfig.templates[templateKey]` (assigned template)
2. `store.templateConfig.templates[routeType]` (route-keyed template)
3. For `index` route: `store.templateConfig.templates.index`
4. `route.fallbackSections` (resource-specific fallback, e.g. product-detail or product-grid)
5. `resolveLegacyTemplate(store)` — flat `templateConfig.sections` minus header/footer

**Section groups (both engines):**
- Header/footer are always resolved as separate `sectionGroups`
- Liquid section groups come from `bundle.templates['header']` / `bundle.templates['footer']`
- Falls back to React store section groups if Liquid template has no header/footer sections

---

## 6. Composition Engine

`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`:

### Liquid Path

`renderLiquidPlan()`:
- Returns `null` if `plan.rendererEngine !== 'liquid' || !plan.liquidBundle`
- Fetches customer drop via server-side session cookie
- Calls `createThemeRenderer('liquid').render(liquidBundle, template, drops)` from `@letbuyy/theme-engine`
- Renders header and footer templates separately, concatenates: `header + contentForLayout + footer`
- Wraps in `<LiquidRenderedHtml dangerouslySetInnerHTML>` + `<LiquidHydrationIslands>`
- Logs `lb:canary:render` event: engine, subdomain, template, route_type, latency_ms, editor_mode

### React Path

`StorefrontCompositionEngine` (default export):
- Renders `<RenderSectionList>` which maps sections to `renderRegisteredSection()` from `renderer-registry.tsx`
- Each section optionally wrapped in `<EditorPreviewSectionFrame>` when in editor mode
- Theme editor section selection uses `postMessage` protocol: `letbuyy:theme-editor:section-select` / `letbuyy:theme-editor:section-selected`

### LiquidCommerceDrops

`buildLiquidCommerceContext()` assembles the `LiquidCommerceDrops` interface:
```typescript
{ shop, request, settings, product, collection, collections, cart, customer, search, order }
```
- `cart`: server-authoritative nulls for money totals at SSR (not computed in browser)
- `product`: assembled via `productToLiquidDrop()` only for product routes
- Drops depth limit 4, keys limit 80, array limit 100
- Blocked drop keys: `__proto__`, `constructor`, `prototype`, `password`, `password_hash`, `access_token`, `refresh_token`, `signing_secret`, `client_secret`

---

## 7. Liquid Sanitization

All Liquid-rendered HTML passes through `sanitizeRenderedHtml()` in `theme-renderer.ts`.

### DOMPurify Config (`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`)

- `ADD_TAGS`: all 9 `lb-*` custom elements + `iframe` + `meta`
- `FORBID_ATTR`: `['style']`
- `FORBID_TAGS`: `['base', 'embed', 'object', 'script']`
- `CUSTOM_ELEMENT_HANDLING tagNameCheck` regex: `/^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager)$/`
- `uponSanitizeAttribute` hook: strips any `data-*` attribute value containing `<` or `>`, strips `javascript:` and `data:text/html` from URL attributes

### Liquid Engine Security Config

- `outputEscape: 'escape'` — HTML-escapes all Liquid output by default
- `strictFilters: true` — unknown filters throw errors rather than silently pass
- `ownPropertyOnly: true` — prevents prototype chain traversal in drop objects
- `parseLimit: 300_000` — limits template parse complexity
- `renderLimit: 250` — limits recursive render depth
- `memoryLimit: 2_000_000` (2 MB) — limits render memory usage

### Lazy-loaded Singleton

DOMPurify + JSDOM is a server-side lazy-loaded singleton (`import('dompurify')` + `new JSDOM('')`). Not instantiated until first Liquid render.

---

## 8. Liquid Hydration Islands

9 custom elements defined in `liquid-hydration-islands.tsx`. All extend `LiquidIslandBase` (a guarded base class that resolves to `HTMLElement` in browsers but a no-op class during SSR, preventing `ReferenceError: HTMLElement is not defined`).

| Custom Element | Class | Responsibility |
|---|---|---|
| `lb-add-to-cart` | `LbAddToCartElement` | Handles click/submit, reads `data-product-id`/`data-product-price`/etc., calls `addCartItem()`, fires `letbuyy:cart:open` event |
| `lb-cart-drawer` | `LbCartDrawerElement` | Slide-out cart panel, subscribes to `letbuyy:cart:open` + `letbuyy:cart:changed`, renders items + server-authoritative totals |
| `lb-search` | `LbSearchElement` | Search form submit → navigates to `/shop?search=query` |
| `lb-variant-picker` | `LbVariantPickerElement` | `[data-lb-variant-option][aria-pressed]` pattern, fires `letbuyy:variant:changed` |
| `lb-review-form` | `LbReviewFormElement` | Star rating + review body, Turnstile-gated, POSTs to `/api/reviews`, handles dev bypass |
| `lb-wishlist-toggle` | `LbWishlistToggleElement` | Guest = localStorage `lb_wishlist`; authenticated = `/api/customer/wishlist` POST/DELETE |
| `lb-cart` | `LbCartElement` | Full-page cart with quantity steppers, totals from server cart, checkout link |
| `lb-customer-settings` | `LbCustomerSettingsElement` | Profile PATCH `/api/customer/profile`, password POST `/api/customer/set-password` |
| `lb-address-manager` | `LbAddressManagerElement` | CRUD addresses via `/api/customer/addresses`, all 4 HTTP methods |

### Cart Architecture

- Browser cart: `localStorage` key `lb_cart` (items array)
- Server cart: `localStorage` key `lb_cart_server` (verbatim gateway response `LiquidServerCart`)
- Cart token: `localStorage` key `lb_cart_token`
- Money totals: **always from `lb_cart_server`**. `renderLiquidCartTotals()` renders verbatim backend values. Browser never sums prices or derives any total.
- Cart sync: `syncLiquidCartToServer()` calls `storefrontBrowserApiFetch()` (POST/PATCH `/cart`)
- `ensureLiquidCartDrawer()`: auto-injects a `lb-cart-drawer` if `lb-add-to-cart` is present but no drawer exists

### Registration

`registerLiquidHydrationIslands()` is called client-side (inside `useEffect`) by the `LiquidHydrationIslands` React component. Uses `window.customElements.define()` with an idempotent guard.

---

## 9. Data Binding Engine

`apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts`:

### Precondition

`buildSectionDataPlan()` only runs when `store.siteType === 'store'`. Non-store site types (portfolio, services, etc.) never trigger product data fetching.

### Product Section Detection

A section is identified as requiring product data if ALL THREE conditions are met:
1. Section type is in `PRODUCT_SECTION_TYPES` set
2. Section rendererKey is in `PRODUCT_RENDERER_KEYS` set
3. `section.settings.productIds` exists

### Data Fetching

- If `section.settings.productIds` is provided: `ProductService.getProductsByIds()`
- Otherwise (collection/listing page): `ProductService.getProductsByStoreSubdomain()`

### Fallback Sections

`product-route.ts` exports:
- `createProductListingFallbackSection(title)` — `type: 'productGrid'`, `rendererKey: 'core.product-grid'`, 6 default settings (columns 4/3/2, rows 12, showPrice/showRating/showAddToCart true)
- `createProductDetailFallbackSection()` — `type: 'productDetail'`, `rendererKey: 'core.product-detail'`, `showReviews: true`

`content-route.ts` exports:
- `createContentFallbackSection(resource)` — `type: 'contentPage'`, `rendererKey: 'core.rich-content'`, title + content from resource

---

## 10. Theme Governance

`packages/theme-engine/src/theme-governance.ts`:

### Constants

| Constant | Value |
|---|---|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | `false` |
| `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT` | `20` |
| `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` | `'deferred'` |
| `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.authority` | `'ARB'` |

### Audit Function

`auditThemeRendererRegistry()` operates in two modes:
- `warn` — logs violations but does not throw
- `enforce` — throws on any violation

Checks:
- Section types exist in the schema registry
- Renderer keys are in `approvedRendererKeys` list

### Schema Migration

`migrateThemeTemplateSchemas()` iterates `sections`, `sectionGroups`, `templates`. Applies a migration chain with a maximum of 20 hops per section/block.

### L13 Desync Guard

`liquidBundlePublishWouldDesync()` in `portable-to-liquid.ts`:
- Returns `true` if the current store config has a `liquidBundle` and the proposed publish config does not
- Prevents a Liquid-enabled store from accidentally having its `liquidBundle` stripped on publish

---

## 11. API Gateway Theme Routes

`services/api-gateway/src/routes/themes.ts` (Hono router, mounted at `/themes`):

### Authentication Middleware

Routes requiring `authMiddleware`: `/packages/upload`, `/:slug/editor`, `/:slug/editor/*`, `/:slug/publish`, `/:slug/preview-session`, `/:slug/releases`, `/:slug/releases/*`, `/:slug/install`, `/:slug/purchase`, `/:slug/purchase/*`, `/purchases/list`, `/purchases/:purchaseId/receipt`, `/installations/list`, `/downloads/list`, `/settings`, `/saved-searches`, `/developer/*`, `/:slug/downloads/*`, `/:slug/refunds`, `/:slug/reports`, `/:slug/reviews/*`

Route `/` uses `optionalAuth` (auth optional for public catalog, required for store-scoped state).

### Core Theme Routes

| Method | Path | Action |
|---|---|---|
| `GET` | `/` | List themes catalog. Filter by category/siteType/pricing/industry/layout/tag/feature/price range/search. Sort: popular/trending/rating/new/name/price_low/price_high. If `store_id` provided: enriches with `installed`/`active` state |
| `GET` | `/categories` | List unique theme categories |
| `GET` | `/industries` | List unique industries (array-flattened) |
| `GET` | `/:slug/schema` | Return editable section/block/settings schemas via `ThemeExecutionAdapter.getEditableSchema()` |
| `GET` | `/:slug/editor` | Load store-scoped editor state (draft + release + template config + schemas) |
| `PUT` | `/:slug/editor/draft` | Save a draft (`SaveThemeDraftSchema`) |
| `DELETE` | `/:slug/editor/draft` | Discard a draft |
| `POST` | `/:slug/publish` | Publish draft to live store config (`PublishThemeSchema`); calls `purgeThemeStorefrontCache()` |
| `POST` | `/:slug/preview-session` | Create signed draft preview token (`PreviewTokenSchema`) |
| `GET` | `/:slug/releases` | List immutable release history |
| `POST` | `/:slug/releases/:releaseId/rollback` | Rollback to older release snapshot; calls `purgeThemeStorefrontCache()` |
| `POST` | `/packages/upload` | Validate and persist portable theme bundle (`UploadThemePackageSchema`); creates marketplace review record + emits `theme.submitted` event |
| `GET` | `/:slug/reviews` | List published reviews + rating summary |
| `POST` | `/:slug/reviews` | Create review (verified-purchase-gated) |
| `POST` | `/:slug/reviews/:reviewId/reply` | Developer reply (author-only) |
| `GET` | `/:slug/downloads/:platform` | Entitlement-checked artifact + signed URL |
| `POST` | `/:slug/reports` | Report theme problem |
| `POST` | `/:slug/refunds` | Request refund |
| `GET` | `/:slug` | Get theme detail by slug |
| `POST` | `/:slug/install` | Install theme to store |
| `POST` | `/:slug/purchase` | Create Razorpay order for paid theme (server-priced; sandbox mode in non-production) |
| `POST` | `/:slug/purchase/verify` | Verify Razorpay HMAC signature, complete purchase, issue receipt |

### Purchase / Marketplace

- Pricing type resolved server-side: `letbuyy_pricing_type` or `is_premium` flag
- Amount in paise: `Math.round(priceInr * 100)`
- Free themes: immediate `status: 'completed'` upsert with `payment_method: 'free'`
- Sandbox mode (non-production without Razorpay keys): sandbox purchase auto-completes; idempotency via `payment_idempotency_key`
- Razorpay HMAC: `hmacSha256Hex(secret, ${orderId}|${paymentId})` + `timingSafeEqualHex`
- GST: 18% inclusive on theme price, stored in `theme_purchase_receipts`
- License key format: `LB-THEME-{16 hex chars uppercase}`

### Cache Invalidation

`purgeThemeStorefrontCache()`: fetches `sites.subdomain`, `sites.store_name`, `sites.custom_domain`, calls `bumpStorefrontCacheVersion()` + `purgeStorefrontCache()` on all handles.

### Auxiliary Routes (theme-marketplace-auxiliary-routes.ts)

Mounted via `mountThemeMarketplaceAuxiliaryRoutes(router)` before `/:slug` routes:
- `GET /suggest` — autocomplete (themes/tags/industries/features)
- `GET /collections` — list published theme collections
- `GET /collections/:slug` — collection detail with themes (manual or rule-based)
- `GET /authors/:handle` — developer profile + themes
- `GET /purchases/list` — auth: user's purchases
- `GET /purchases/:purchaseId/receipt` — receipt generation/retrieval
- `GET /installations/list` — auth: all stores' installations
- `GET /downloads/list` — auth: download artifacts with signed URLs
- `GET /settings` + `PUT /settings` — marketplace user preferences
- `GET /saved-searches` + `POST /saved-searches` — saved search management
- `GET /developer/dashboard` — developer listings + payout account
- `POST /developer/listings` — submit/update developer listing with local asset scan

---

## 12. ThemeExecutionAdapter (API Gateway)

`services/api-gateway/src/execution/theme-execution.adapter.ts`:

### Role

Database adapter only. Handles draft, publish, release, rollback, install, preview-session workflows. Does not own business sequencing. Declared responsibilities: `'database-rpc'`, `'response-formatting'`.

### DB Tables Used

`sites`, `themes`, `store_themes`, `theme_releases`, `theme_instances`, `theme_instance_drafts`, `theme_draft_patches`, `theme_editor_drafts`, `theme_preview_sessions`

### Key Methods

| Method | DB Operation |
|---|---|
| `verifyStoreOwner()` | SELECT from `sites` with ownership check (`custom_user_id` or `user_id`) |
| `getTheme()` | SELECT from `themes` WHERE `slug` and `is_active=true` |
| `getEditableSchema()` | Calls `schemaRegistry.resolveThemeRuntime()`, returns sections/blocks/settings/templates/layouts schemas |
| `installTheme()` | Upserts `store_themes`, validates template config, calls `publishReleaseSnapshot()`, emits `theme.installed` event |
| `loadEditor()` | Loads draft + current release + template config + runtime schemas |
| `saveDraft()` | Upserts `theme_editor_drafts`; also saves `theme_instance_drafts` + appends `theme_draft_patches` |
| `deleteDraft()` | Deletes `theme_editor_drafts`, emits `theme.draft.discarded` |
| `publish()` | Loads draft, validates, calls `publishReleaseSnapshot()`, deletes draft, emits event |
| `listReleases()` | SELECT from `theme_releases` ordered by `release_version DESC` |
| `rollbackRelease()` | Loads old release snapshot, publishes as new release with `rollbackOfReleaseId` |
| `createPreviewSession()` | Inserts into `theme_preview_sessions` with SHA-256 token hash |

### publish_theme_release RPC

`publishReleaseSnapshot()` calls `db.rpc('publish_theme_release', {...})`. If the RPC is missing (migration not applied), falls back to `publishReleaseSnapshotFallback()` which manually manages `theme_releases` + `sites` update.

### Release Artifacts

`buildReleaseArtifacts()` builds `release_manifest` including:
- `engine`, `store_id`, `theme_id`, `release_id`, `release_version`
- `renderer_engine`: `'liquid'` if `liquidBundle` present, else from `rendererManifest.engine`, else `'json-contract'`
- `liquid_ready`: `true` if liquidBundle present
- `approved_renderer_keys[]`
- `liquidBundle` + `themeBundle` (both set to the same value if liquid)
- `cache_manifest.tags`: `['store:X', 'theme:Y', 'theme_release:Z', 'theme_package_version:W']`

### Schema Version Compatibility

Multiple guards handle missing columns/tables gracefully (`isMissingDeletedAtError`, `isMissingPublishReleaseFunction`, `isThemeEngineSchemaUnavailable`, `isMissingColumnError`). The adapter degrades rather than throws when schema migrations have not been applied.

---

## 13. L3 Portable-to-Liquid Compiler

`packages/theme-engine/src/portable-to-liquid.ts`:

### Role

Translator only — not a plugin/extension/remote runtime. Compiles a `StorefrontTemplateConfig` (JSON-contract) into a `LiquidThemePackageBundle`. Source of truth for the "compile portable JSON → Liquid" path.

### Type Overrides

`PORTABLE_TO_LIQUID_TYPE_OVERRIDES` maps portable section types to Liquid section names:

| Portable Type | Liquid Section |
|---|---|
| `hero`, `heroBanner` | `hero-banner` |
| `newsletter`, `newsletterSignup` | `newsletter-signup` |
| `announcement`, `announcementBar` | `announcement-bar` |
| `appBlockSlot` | `app-block-slot` |
| `richContent` | `rich-content` |
| `productDetail` | `product-detail` |

### Key Exports

- `compilePortableToLiquidBundle()`: uses `createUrbanKicksLiquidThemeBundleFixture()` as the base fixture; outputs a validated `LiquidThemePackageBundle`
- `compilePortableConfigForPublish()`: returns `{ rendererEngine: 'liquid', liquidBundle, layout, schema_version }`
- `liquidBundlePublishWouldDesync()`: L13 guard
- `plainSettings()`: drops non-serializable or unsafe-keyed values; strings are NOT pre-escaped (Liquid engine `outputEscape` handles it)

### Urban Kicks Fixture

`createUrbanKicksLiquidThemeBundleFixture()` is the canonical first-party Liquid theme. It provides the base `LiquidThemePackageBundle` that `compilePortableToLiquidBundle()` uses as a template for compilation output.

---

## 14. Theme Settings and CSS

### ThemeSettings Schema

`THEME_SETTINGS_SCHEMA` in `theme-registry.ts` defines 5 groups:

| Group | Fields |
|---|---|
| colors | 5 fields (primaryColor, secondaryColor, accentColor, backgroundColor, textColor) |
| typography | 2 fields (fontFamily, headingFontFamily) |
| layout | 3 fields (maxWidth, spacing, borderRadius) |
| header | 5 fields (sticky, transparent, showSearch, showCart, showWishlist) |
| footer | 4 fields (showSocialLinks, showNewsletter, copyrightText, showPoweredBy) |

### Token Map

`LIQUID_THEME_TOKEN_MAP` in `theme-renderer.ts` maps ThemeSettings keys to CSS custom properties:

| Setting Key | CSS Variable |
|---|---|
| `primaryColor` | `--primary` |
| `secondaryColor` | `--secondary` |
| `accentColor` | `--accent` |
| `backgroundColor` | `--background` |
| `textColor` | `--text` |
| (3 more token mappings) | — |

### CSS Injection

`LIQUID_THEME_BASE_CSS` is injected inline as a `<style>` tag at the top of every Liquid-rendered page. It provides the CSS custom property defaults that `--lb-*` design tokens reference.

### Design Token Constraint

The `--lb-*` design tokens are the only permitted CSS custom properties. The design-system ratchet forbids raw `rounded-[...]` Tailwind arbitrary values and raw px values in new components.

---

## 15. Default Storefront Template

`getDefaultStorefrontThemeTemplate()` in `theme-registry.ts` returns:
- `themeId: 'urban-kicks'`
- Default sections (in order): `header` (id: `header-default`), `footer` (id: `footer-default`), `announcement-default` (announcementBar), `hero-default` (heroBanner), `category-grid-default` (categoryGrid), `featured-collection-default` (featuredProducts), `product-grid-default` (productGrid), `newsletter-default` (newsletter)
- `hasRenderableThemeTemplate()` checks: sections array, legacy slots (header/footer/template array), templates map, sectionGroups

---

## 16. Execution Runtime

`packages/theme-engine/src/execution-runtime.ts`:

- `composeStorefrontTheme()`: selects `routeTemplate.sections` or `storeTemplate.sections`, filters `isVisible !== false`, sorts by `order`
- `hydrateAndComposeStorefrontTheme()`: compose → `injectRuntimeSections()` → `hydrateSectionSchemas()`
- `injectRuntimeSections()`: supports `before`/`after`/`replace` injection positions
- `InMemorySectionRegistryRuntime` + `InMemoryBlockRegistryRuntime`: `Map`-based in-process registries
- `hydrateSectionSchemas()`: merges `definition.defaultSettings` with `section.settings`, resolves `rendererKey` and `schemaVersion`

---

## 17. Storefront Route Types

17 values defined in `StorefrontRouteType` (`types.ts`):

```
'index' | 'product' | 'collection' | 'page' | 'policy' | 'blog' | 'article' |
'cart' | 'search' | 'customer_account' | 'customer_orders' | 'customer_wishlist' |
'customer_settings' | 'customer_addresses' | 'customer_order' | 'password' | 'not_found'
```

---

## 18. Editor Preview Protocol

`editor-preview-section-frame.tsx` (client component):

- Wraps each React section in a `div[role="button"]` with `data-section-id`, `data-letbuyy-editor-section-id`, `data-renderer-key`
- Click/keydown (Enter/Space) → `postMessage({ type: 'letbuyy:theme-editor:section-select', sectionId, sectionType, rendererKey })` to `window.parent`
- Listens for `letbuyy:theme-editor:section-selected` from parent to toggle `isSelected` state (adds `storefront-editor-section-frame--selected` class)
- Target origin: derived from `document.referrer` or `'*'` as fallback

---

## 19. Merchant Control Plane Proxies

All MCP theme routes are thin Next.js API route handlers that proxy to the gateway via `createMerchantApiClient()`:

| Route | Handler |
|---|---|
| `GET /api/themes?store_name=` | Lists theme catalog + enriches with current theme for the store |
| `POST /api/themes/install` | Optionally uploads a bundle (`private_install` mode), then installs by slug |
| `POST /api/themes/publish` | Toggles store status: `'publish'` → `api.stores.publish(storeId)`, `'unpublish'` → `api.stores.update(storeId, { status: 'draft' })` |

Note: The MCP `/api/themes/publish` route is a **store publish toggle** (draft ↔ published), not a theme-draft-to-live publish. Theme draft publishing goes through `PUT /:slug/editor/draft` + `POST /:slug/publish` on the gateway directly.

---

## 20. Schema / Zod Exports

`services/api-gateway/src/schemas/theme.schema.ts` is a pure re-export barrel:
- From `@letbuyy/shared-types`: `ThemeBlockContractSchema`, `ThemeBundleContractSchema`, `ThemeContractSchema`, `ThemeSectionContractSchema`, `ThemeTemplateContractSchema` (and their TypeScript types)
- From `@letbuyy/theme-engine`: All operation input schemas (`InstallThemeSchema`, `SaveThemeDraftSchema`, `PublishThemeSchema`, `PreviewTokenSchema`, `RollbackThemeReleaseSchema`, `UploadThemePackageSchema`, purchase/review/report/refund/marketplace/developer schemas) and their input types

---

## 21. DB Tables Referenced

Core theme tables touched by the theme system:

| Table | Purpose |
|---|---|
| `themes` | Theme catalog (`is_active`, `slug`, `is_premium`, `letbuyy_pricing_type`, `letbuyy_price_inr`) |
| `store_themes` | Per-store installation record (`is_active`, `config_overrides`) |
| `sites` | `theme_id` (slug), `template_config` (JSON), `current_theme_release_id`, `storefront_release_version` |
| `theme_releases` | Immutable release snapshots (`release_config`, `release_manifest`, `is_current`, `release_status`, `rollback_of_release_id`) |
| `theme_instances` | Per-store per-package instance (`instance_status`, `active_release_id`, `current_draft_id`) |
| `theme_instance_drafts` | Active draft for a theme instance (`working_manifest`, `draft_status`) |
| `theme_draft_patches` | Append-only patch log per draft |
| `theme_editor_drafts` | Legacy per-template draft record (`draft_config`, `version`, `template_key`) |
| `theme_preview_sessions` | Signed preview tokens with SHA-256 hash + expiry |
| `theme_purchases` | Purchase records (`status`, `payment_method`, `license_key`) |
| `theme_purchase_receipts` | GST receipts (18% inclusive, `invoice_json`, `seller_gstin`) |
| `theme_reviews` | Verified-purchase-gated reviews (`status: pending/published`) |
| `theme_reports` | Abuse/problem reports |
| `theme_refund_requests` | Refund requests (`status: requested`) |
| `theme_download_artifacts` | Download artifacts per platform (letbuyy/wordpress/html/react) |
| `theme_collections` / `theme_collection_items` | Marketplace curated collections |
| `theme_marketplace_settings` | Per-user marketplace preferences |
| `theme_saved_searches` | Saved search queries |
| `theme_developer_listings` | Third-party developer submissions |
| `theme_developer_payout_accounts` | Developer payout configuration |
| `developer_profiles` | Developer public profiles |

---

## 22. Key Invariants / Constraints

1. **Liquid is default-off.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`. No store gets Liquid unless explicitly opted in via canary flag or engine override.
2. **ARB governs the platform-wide flip.** `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`. No code change can bypass this without ARB approval.
3. **L13 desync guard.** `liquidBundlePublishWouldDesync()` prevents stripping a `liquidBundle` from a Liquid store on publish.
4. **All Liquid HTML is DOMPurify-sanitized.** Server-side, lazy-loaded JSDOM singleton. `outputEscape: 'escape'` also HTML-escapes all Liquid expression output.
5. **Liquid source schema forbids `<script`, `{% include`, `{% layout`, `{% render`.** Enforced at bundle ingestion time via Zod.
6. **Money totals never computed in browser.** Cart totals in `lb-cart-drawer` and `lb-cart` come verbatim from the gateway cart response (`LiquidServerCart`) stored in `lb_cart_server`. `renderLiquidCartTotals()` only formats server values.
7. **ART-17 freezes new React-per-section after freeze date.** New React section renderers cannot be added to frozen surfaces.
8. **`--lb-*` tokens only.** New components cannot introduce raw px or arbitrary Tailwind bracket values.
9. **Publish calls `publish_theme_release` RPC.** Falls back to manual insert if RPC missing (schema compatibility mode).
10. **Premium themes require completed purchase before install.** `installTheme()` checks `theme_purchases` for `status = 'completed'` when `is_premium = true` or `letbuyy_pricing_type !== 'free'`.
11. **Razorpay signature verified server-side.** `hmacSha256Hex` + `timingSafeEqualHex`. Never trusted from client.
12. **Section renderer keys are allowlisted.** `auditThemeRendererRegistry()` with `enforce` mode rejects unknown renderer keys not in `approvedRendererKeys`.
