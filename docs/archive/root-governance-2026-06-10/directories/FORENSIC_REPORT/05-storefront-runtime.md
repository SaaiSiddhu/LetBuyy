# Phase 5 — Storefront Runtime Investigation

Investigation date: 2026-06-05 (second pass, post-remediation)

## Method

Full source inspection of `apps/storefront-runtime` (all `src/**` files outside excluded dirs), the gateway read-side (`services/api-gateway/src/routes/storefront.ts`, **4,833 lines at second pass**, plus the newly extracted `src/routes/storefront/internal-payment-routes.ts`, 233 lines), `packages/runtime-composition/storefront-query-layer`, `packages/theme-engine` runtime contracts, and `apps/storefront-runtime/runtime.manifest.json` / `next.config.ts` / `proxy.ts`. Claims cite file paths and line numbers. Prior 05 report claims were re-verified (results in report 04 §7 and inline below). The second pass re-verified findings C-7/C-9/C-10/H-14 against HEAD and documented the storefront.ts refactor; verdicts in "Changes since first pass" below.

## Changes since first pass

`git log` over the remediation window shows **zero commits touching `apps/storefront-runtime/src`** — every storefront-runtime file cited in this report (proxy.ts, store-service.ts, renderer-registry.tsx, composition-engine.tsx, template-resolver.ts, liquid-hydration-islands.tsx, cart-context.tsx, preview page/bridge, layout/pages) is content-identical to the first pass; the most recent commits on those paths (`4652b0fd`, `d0c90f4f`, `c4a05f0d`, `5166b5d7`, `16925eaa`) all predate the window. The gateway read-side did change:

1. **storefront.ts split (commit `f1b3253b refactor(storefront): split internal payment routes`, 2026-06-05 20:50 IST).** The five internal server-to-worker payment endpoints — `GET /internal/orders/:orderId/payable`, `POST /internal/payments/reference`, `POST /internal/payments/confirm`, `POST /internal/payments/failure`, `POST /internal/payments/event` — plus their four body types and the helpers `isInternalRequest`/`assertProvider`/`loadInternalPayableOrder` were moved from `storefront.ts` into `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (233 lines), exported as `registerStorefrontInternalPaymentRoutes(router, { getRequestId, emitStorefrontOrderPaidEvent })` (:106) with the two cross-cutting helpers injected as a deps object (:57–69) — the only textual changes to handler bodies are `getRequestId(c)` → `deps.getRequestId(c)` and `emitStorefrontOrderPaidEvent(…)` → `deps.emitStorefrontOrderPaidEvent(…)`; validation, status codes, `PaymentExecutionAdapter` calls, and the order-paid event on confirm are otherwise identical line-for-line to the removed hunk (internal-payment-routes.ts:108–232 vs the deletion in the commit diff). **Route order is preserved**: the diff shows the inline route definitions were deleted at exactly the position where the single `registerStorefrontInternalPaymentRoutes(router, …)` call now sits — between `sha256Hex` and the `GET /storefront/lookup` handler (storefront.ts:1826–1832 at HEAD), so the Hono registration sequence is unchanged. Measured (git numstat + blob `wc -l`): `cdd33494 fix(webhooks): route payment order mutations through gateway` (19:54 IST) first **added 32 lines** to storefront.ts (4,993 → 5,025) along with 172 adapter lines (`payment-execution.adapter.ts`) and the new caller `services/webhook-service/src/gateway-order-transitions.ts` (111 lines — the only repo file outside the gateway and tests that references `/internal/payments|/internal/orders`); the split then removed 196 / added 4 (5,025 → **4,833 at HEAD**; import added at :33).
2. **Characterization tests added**: `tests/contracts/storefront-internal-payment-routes.test.ts` (31 lines) — for each of the five endpoints it fetches the route with `ENVIRONMENT: 'production'` and no `X-Internal-API-Secret` header and asserts HTTP 403 + `error.code === 'FORBIDDEN'` (lines 7–31). That is the entire characterization scope: the auth gate only; no happy-path or payload behavior is exercised.
3. **GraphQL cart fail-loud (gateway).** `services/api-gateway/src/graphql/storefront.ts` now rejects any storefront GraphQL document selecting `cart` with `CART_NOT_SUPPORTED`: "Storefront GraphQL cart reads are not supported until server-side cart persistence is enabled" (:386–392) — the absence of server-side carts (finding C-10) is now acknowledged in code rather than silently unsupported.
4. **Theme write-path changes upstream of this runtime** (template-scoped drafts, migration 087) are documented in report 04; they do not alter any storefront-runtime read path — the theme-preview route still resolves instance-draft-then-legacy-draft by ids stored on the preview session (storefront.ts:2105–2152), and the published read still uses `loadCurrentThemeRelease` (:1108).

### Second-pass verdicts on first-pass findings

| Finding | Verdict | Evidence |
|---|---|---|
| C-7 — section vocabulary statically compiled in `renderer-registry.tsx`; unknown types render null | **STILL-OPEN** | `renderer-registry.tsx:385–393` (`renderRegisteredSection` returns `null` at :387 when no rendererKey resolves and :390 when no approved renderer exists); static import block + `SECTION_RENDERER_DEFINITIONS` unchanged; `RUNTIME_SECTION_SCHEMAS` still app-local at :66, fallback `schemaFor` at :191 |
| C-9 — `content_for_header`/`content_for_footer` hardwired empty; Liquid scope lacks commerce objects | **STILL-OPEN** | `packages/theme-engine/src/theme-renderer.ts:190–191` (layout scope) and `:247–248` (engine globals) hardwire `''`; `buildLiquidScope` (:332–362) exposes only `shop`/`request`/`settings`/`routes` (+ caller-supplied `liquidContext` passthrough) — no `product`, `collection`, `collections`, `cart`, or `customer` objects |
| C-10 — cart is client-localStorage only; `public.carts` table unwired | **STILL-OPEN** (now explicitly acknowledged) | `cart-context.tsx:28, 43` and `liquid-hydration-islands.tsx:5` still use localStorage `lb_cart`; checkout still POSTs the local cart to `/api/orders` (`checkout/checkout-client.tsx:375`); `public.carts` exists with RLS (baseline :8633, :24169, :24277) and zero gateway code references (`from('carts')` grep over `services/api-gateway/src`: no matches); NEW: gateway GraphQL explicitly throws `CART_NOT_SUPPORTED` (graphql/storefront.ts:386–392) |
| H-14 — `urban-kicks-demo` short-circuit in store-service.ts | **STILL-OPEN** | `store-service.ts:55–57, 73–75, 92–94, 116–118` unchanged; fixture `lib/demo/urban-kicks-demo.ts` unchanged |
| storefront.ts size / structure | **CHANGED** | 4,826 (first-pass measurement) → 4,833 lines at HEAD via interim growth to 5,025 then the −196/+4 extraction; internal payment routes extracted move-only with order preserved (item 1 above) |

---

## 1. Rendering engine: framework and rendering mode

- **Framework**: Next.js App Router, React server components. `apps/storefront-runtime/package.json` deps include `next`, `react`, `react-dom` (also listed in `AGENTS.md:23`). Deployment platform declared as Vercel (`runtime.manifest.json:58–63`).
- **Rendering mode is ISR-by-route with SSR for previews**:
  - Store home: `export const revalidate = 60` (`src/app/store/[subdomain]/page.tsx:11`).
  - Store layout: `revalidate = 60` (`src/app/store/[subdomain]/layout.tsx:17`).
  - Product page: `revalidate = 30` (`src/app/store/[subdomain]/product/[productId]/page.tsx:11`).
  - Catch-all content page: `revalidate = 60` (`src/app/store/[subdomain]/[...path]/page.tsx:9`).
  - Editor preview route: `export const dynamic = 'force-dynamic'; export const revalidate = 0` (`src/app/preview/page.tsx:18–19`) — pure SSR, never cached.
  - Data fetches carry Next cache tags + revalidate via `storefrontReadInit(revalidate, tags)` (`src/lib/api/client.ts:22–29`), e.g. tags `storefront:${subdomain}`, `storefront:${subdomain}:published`, `storefront:${subdomain}:navigation:${location}` (`store-service.ts:441–452, 483–488`). `STOREFRONT_REVALIDATE_SECONDS = 60` (`store-service.ts:51`).
  - HTTP layer: pages get `Cache-Control: public, max-age=300, stale-while-revalidate=3600`; static assets 1-year immutable; CSP `frame-ancestors` allow-list for merchant/console origins; HSTS, nosniff, Referrer-Policy, Permissions-Policy (`next.config.ts:52–89`).
- **CSR islands**: cart/auth/wishlist contexts are client providers (`src/context/{cart,customer-auth,wishlist}-context.tsx`, mounted in `layout.tsx:208–232`); product detail interactions, checkout, account pages are client components; Liquid-rendered themes hydrate via custom-element islands (`liquid-hydration-islands.tsx`, 369 lines — see §5.2).

---

## 2. Request lifecycle: middleware → tenant resolution → render

### 2.1 Edge proxy (tenant routing)

`src/proxy.ts` (Next middleware-equivalent; `config.matcher` excludes `/api/`, `_next/`, static files — lines 5–9):
1. Path already `/store/<subdomain>/…` → pass through, set preview cookie if `theme_preview_token` query present (lines 17–20, cookie helper 54–66: httpOnly, sameSite lax, 15-min maxAge, name from `getThemePreviewCookieName(subdomain)`).
2. Otherwise tenant subdomain resolution order: header `x-store-subdomain` (Cloudflare-injected) → `x-forwarded-host` ending `.letbuyy.store` → raw `Host` ending `.letbuyy.store` (≥3 labels, non-www) → vercel.app root passes through (lines 22–37).
3. Reserved subdomain `storefront` passes through (39–41); any other resolved subdomain is **rewritten** to `/store/<subdomain><path>` (43–48).

There is no auth/session middleware here; customer sessions are cookie-forwarded per-request to the gateway (`api/client.ts:67–73`, header `X-LetBuyy-Customer-Session`).

### 2.2 Tenant/store resolution (data plane)

The storefront app holds **no database client**. All reads go through `createStorefrontApiClient()` → `@letbuyy/api-client` → HTTPS to the gateway base URL (`LETBUYY_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`, default `https://api.letbuyy.store/v1` — `api/client.ts:13, 31–58`). Selected internal-only customer paths are HMAC-signed (`X-LetBuyy-Internal-*`, lines 90–116).

`StoreService` (`src/lib/store-service.ts`):
- `getStoreBySubdomain` → gateway `GET /storefront/:subdomain` (published-only) + navigation bundle (main/footer/policies) in parallel (54–70, 497–505).
- `getStoreBySubdomainAnyStatus` → gateway `GET /storefront/:subdomain/status` first; non-published stores get a minimal `mapStatusOnlyStore` model (91–113, 514–548) used by the Coming Soon gate.
- `getPreviewStoreBySubdomain(subdomain, token)` → gateway `GET /storefront/:subdomain/theme-preview?token=` (72–89, 455–458).
- **Demo short-circuit**: subdomain `urban-kicks-demo` (and store id `demo-urban-kicks-store`) returns a fully hardcoded fixture before any network call (55–57, 73–75, 92–94, 116–118; fixture `src/lib/demo/urban-kicks-demo.ts`, 340 lines).

Gateway side (`services/api-gateway/src/routes/storefront.ts`, second-pass anchors): site lookup by `subdomain OR store_name` with pooled-SQL fast path and Supabase fallback + column-compat retries (`loadSiteByHandle` :1060; pooled `loadSiteByHandleFromPooledSql` :926); current release via `loadCurrentThemeRelease` (:1108; pooled SQL `loadCurrentThemeReleaseFromPooledSql` :941 with `and is_current = true` :950 + `release_status='published' ORDER BY release_version DESC LIMIT 1`); app blocks via `loadPublicStorefrontAppBlocks` (:1197, merging `app_extension_registrations` surface `theme.app_block` via `loadRegisteredThemeAppBlocks` :1209–1220 with the legacy `app_installations`→`marketplace_apps`→`app_extensions` path :1229+); response cached via `cachedJson` keyed by a versioned storefront cache key (:2201; purge/bump on theme publish — report 04 §2.2).

### 2.3 Page render sequence (home route)

`src/app/store/[subdomain]/page.tsx:27–82`:
1. `resolveThemePreviewToken(subdomain, query.theme_preview_token)` — explicit token else preview cookie (`theme-preview-server.ts:5–14`).
2. `composeStorefrontRuntimeProjection(...)` from `@letbuyy/runtime-composition/storefront-query-layer` — a 4-step declarative aggregation (load-store → load-template → load-products → load-content) with projection metadata + cache policy (key `storefront:${subdomain}:${path}:${preview|published}`, ttl 60/300 SWR for published, 0 for preview — `packages/runtime-composition/storefront-query-layer/index.ts:41–103`). The page injects loaders that call StoreService (preview store first when a token exists) and return `store.templateConfig` as the template (page.tsx:50–57).
3. `resolveStorefrontTemplate(store, {type:'index', path, subdomain})` → `StorefrontRenderPlan` (§3).
4. `buildSectionDataPlan(...)` → per-section data map (§6).
5. `<StorefrontCompositionEngine store plan sectionData editorMode={query.editor==='1'}>` (§5).

The layout (`layout.tsx:63–256`) independently resolves the store (preview-aware, 65–69), gates non-published stores to `<ComingSoonRouter>` (77–86), fetches products for header search (89–101), resolves the same render plan to extract header/footer **section groups**, emits a `<style>` block of CSS variables derived from `templateConfig.themeSettings` (`--primary`, `--font-main`, dark-mode token set — 124–205), and renders `<StorefrontSectionGroupRenderer groupKey="header"/footer>` around `{children}` inside Cart/Auth/Wishlist providers for store-type sites (207–253).

---

## 3. Templates, layouts, section groups — who owns what

### 3.1 Render-plan resolution (`src/lib/theme-engine/template-resolver.ts`, 257 lines)

`resolveStorefrontTemplate(store, route)`:
1. **Liquid first**: `resolveLiquidBundle` validates `templateConfig.liquidBundle` or `releaseManifest.{liquidBundle,themeBundle,bundle}` against `LiquidThemePackageBundleSchema` (108–123). If valid, pick template key by `route.templateKey` → route type → `index` → first key (125–135), convert Liquid template sections/blocks into `SectionModel[]` with rendererKeys `liquid.section.<type>` / `liquid.block.<type>` / `liquid.app-block` (137–184), and return a plan with `rendererEngine: 'liquid'`, **empty header/footer groups** (202–205), and cache tags `store:/theme:/release:/route:/template:` (210–216).
2. **JSON-contract path**: template precedence = route-assigned template (`route.templateKey` into `templateConfig.templates`) → `templates[<routeType>]` → `templates.index` (index only) → route `fallbackSections` (synthesized per-route) → `resolveLegacyTemplate` (flat `sections[]` minus header/footer) (221–236). Section groups resolved from `templateConfig.sectionGroups` with header/footer fallback by `section.type` filter (39–63). Plan carries `themeSettings`, `releaseId/Version`, cache tags (238–255).

### 3.2 Route types and fallback sections

`StorefrontRouteType` union (15 values: index, product, collection, page, policy, blog, article, cart, search, customer_account, customer_orders, customer_wishlist, password, not_found — `types.ts:5–19`). Callers observed:
- index: home page + layout (`page.tsx:64`, `layout.tsx:106`).
- product: product page with `fallbackSections: [createProductDetailFallbackSection()]` (`product/[productId]/page.tsx:43–49`; fallback = single `productDetail` section, `product-route.ts:28–40`).
- collection: `/products` and `/shop` pages (`products/page.tsx:48`, `shop/page.tsx:44`) with `createProductListingFallbackSection` (`product-route.ts:3–26`).
- page/policy/blog/article: `ContentResourceRenderer` passes `routeType`, `resource.assignedTemplateKey`, and `createContentFallbackSection(resource)` (single `contentPage` section — `content-route.ts:4–17`; renderer `components/content/content-resource-renderer.tsx:22–35`), used by the catch-all `[...path]/page.tsx:57–65` and blog route.

### 3.3 Layout ownership

- The HTML/document layout, theme CSS variable emission, font mapping (`FONT_MAP`, layout.tsx:20–31), and header/footer group placement are owned by **`apps/storefront-runtime`** (`store/[subdomain]/layout.tsx`).
- For Liquid themes, the bundle's `layout/theme.liquid` exists and `LiquidRenderer` can render it (`theme-renderer.ts:186–194`), but the storefront consumes only `result.liquid.contentForLayout` — the section HTML join — not `layoutHtml` (`composition-engine.tsx:189`); the Next layout shell remains authoritative. Liquid plans also return empty header/footer groups (template-resolver.ts:202–205), so a Liquid theme's header/footer must be sections inside its templates.
- `layoutKey` is carried on plans/templates (default `'theme'`) but no alternate layout implementations exist in the storefront — grep for consumers of `layoutKey` beyond pass-through assignment found none. `theme_layouts` DB table is unreferenced (report 04 §4.2).

---

## 4. Sections and blocks — exhaustive inventory of what exists

### 4.1 Registered section renderers (the only sections that can render on the JSON-contract path)

`src/lib/theme-engine/renderer-registry.tsx` — `SECTION_RENDERER_DEFINITIONS` (198–345), 20 renderer keys with type aliases:

| rendererKey | sectionTypes (aliases) | Component file | Notes |
|---|---|---|---|
| core.header | header | `components/layout/dynamic-header.tsx` | receives products for search |
| core.footer | footer | `components/layout/dynamic-footer.tsx` | receives blocks (footerLink) |
| core.hero | heroBanner, hero, hero-banner | `components/sections/hero.tsx` | |
| core.product-grid | productGrid, product-grid, product_grid | `sections/product-grid.tsx` | store siteType only (line 233) |
| core.product-detail | productDetail, product-detail | `sections/product-detail-section.tsx` | store only |
| core.featured-products | featuredProducts, featured-products, featured_collection | `sections/featured-products.tsx` | store only |
| core.testimonials | testimonials | `sections/testimonials.tsx` | |
| core.about | aboutSection, about-section, about | `sections/about-section.tsx` | |
| core.newsletter | newsletter | `sections/newsletter.tsx` | |
| core.portfolio-grid | portfolioGrid, … | `sections/portfolio-grid.tsx` | |
| core.skills | skillsSection, … | `sections/skills-section.tsx` | |
| core.experience-timeline | experienceTimeline, … | `sections/experience-timeline.tsx` | |
| core.contact-form | contactForm, … | `sections/contact-form.tsx` | |
| core.cta | ctaSection, … | `sections/cta-section.tsx` | |
| core.services-grid | servicesGrid, … | `sections/services-grid.tsx` | |
| core.rich-content | contentPage, content-page, richContent, rich-content | `sections/rich-content-section.tsx` | |
| commerce.category-grid | categoryGrid, category-grid | `sections/category-grid.tsx` | |
| commerce.brand-marquee | brandMarquee, brand-marquee | `sections/brand-marquee.tsx` | |
| commerce.trust-badges | trustBadges, trust-badges | `sections/trust-badges.tsx` | |
| apps.app-block-slot | appBlockSlot, app-block-slot, app_block_slot | `sections/app-block-slot.tsx` | app surface (§7) |

Resolution: `resolveSectionRendererKey` — section.rendererKey (or settings.rendererKey) mapped through a compatibility table; else section.type (374–383). **Unknown types render `null`** (`renderRegisteredSection`, 385–393). Additional component files exist but are not registered as sections (banner-carousel.tsx, marquee.tsx — present under `components/sections/` per file listing, absent from `SECTION_RENDERER_DEFINITIONS`).

Schemas: `SECTION_SCHEMAS` from theme-engine + 10 app-local `RUNTIME_SECTION_SCHEMAS` (66–188) + generic fallback (`schemaFor`, 190–196). Exported manifest helpers `getRegisteredSectionRendererManifest`/`getRegisteredSectionSchemas` (358–372) exist; grep found no external consumer of these exports — not wired to the gateway registry.

Section type normalization (legacy aliases like `hero→heroBanner`, `featured_collection→featuredProducts`) is duplicated in `store-service.ts:713–743`.

### 4.2 Blocks

- Contract: `BlockModel` (theme-engine index.ts:89–97); store-service normalizes array or keyed-map+`block_order` forms (`normalizeBlockCollection`, store-service.ts:164–183).
- Block-consuming sections on the JSON path: footer (`footerLink` blocks passed to DynamicFooter, registry 215–221), categoryGrid (`category` blocks, schema theme-registry.ts:209–211), brandMarquee (`brand`), trustBadges (`badge`), servicesGrid (`service`, registry 166–177), header (`navPage`), testimonials (`testimonialCard` sample), appBlockSlot (`app-block` blocks, schema theme-registry.ts:336–353).
- Liquid path blocks: rendered server-side per `theme-renderer.ts:271–330`; reusable block files (`blocks/*.liquid`), inline section blocks, and `@app` blocks all supported (theme-bundle.ts:125–169, 421–427).

---

## 5. Composition engine: who renders, and how Liquid integrates

`src/lib/theme-engine/composition-engine.tsx` (252 lines), default export `StorefrontCompositionEngine` (192–224):

1. **Liquid attempt first**: `renderLiquidPlan` (152–190) — only when `plan.rendererEngine === 'liquid' && plan.liquidBundle`. Calls `createThemeRenderer('liquid')` from `@letbuyy/theme-engine` with context (storeId, subdomain, path, previewMode=editorMode, locale), the store template + bundle, the resolved template key, and `liquidAppBlocks` built from `store.templateConfig.appBlocks` (124–150: each app block keyed by id, extension_id, slot, and `app:<extension_id>`; HTML generated by `renderLiquidAppBlockHtml` 95–122 — escaped inline article or sandboxed iframe). On success the **pre-rendered, sanitized HTML** is injected via `dangerouslySetInnerHTML` inside `<div data-theme-renderer="liquid">` plus `<LiquidHydrationIslands>` (63–84, 203–213). Note `sanitizeRenderedHtml` ran inside the renderer (theme-renderer.ts:471–476).
2. **JSON-contract fallback**: `RenderSectionList` maps plan sections through `renderRegisteredSection`; in `editorMode` each section is wrapped in `EditorPreviewSectionFrame` (selection postMessage + `data-letbuyy-editor-section-*` attrs — `editor-preview-section-frame.tsx:31–92`), else a plain `div[data-section-id][data-renderer-key]` (composition-engine 29–58).
3. `StorefrontSectionGroupRenderer` renders a named group (header/footer) through the same list renderer (226–251).

### 5.2 Liquid client hydration

`liquid-hydration-islands.tsx` (369 lines, client): binds behavior to server-rendered markers `lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker` / `[data-lb-island=…]` (tags defined centrally in theme-bundle.ts:30–51). Cart state is **localStorage `lb_cart`** with custom events `letbuyy:cart:open/changed`, `letbuyy:variant:changed` (lines 5–8, 35–69) — the same storage key the React `cart-context` uses, so Liquid and React carts share state.

### 5.3 Ownership answers (explicit)

| Question | Owner | Evidence |
|---|---|---|
| Rendering execution | `apps/storefront-runtime` (composition-engine + renderer-registry) for JSON path; `packages/theme-engine` `LiquidRenderer` for Liquid HTML generation, invoked from the storefront | composition-engine.tsx:152–224; theme-renderer.ts:104–211 |
| Layout shell, theme CSS vars, fonts | `apps/storefront-runtime` `store/[subdomain]/layout.tsx` | layout.tsx:124–205 |
| Templates (data) | per-store JSONB: `theme_releases.template_snapshot`/`release_config` → fallback `sites.template_config`; for Liquid, the bundle inside the release manifest | store-service.ts:556–564; report 04 §4 |
| Template resolution logic | `apps/storefront-runtime` `template-resolver.ts` | §3.1 |
| Section implementations | `apps/storefront-runtime` (compiled-in React components) on JSON path; **theme data** (`sections/*.liquid`) on Liquid path | §4.1; theme-bundle.ts:185–197 |
| Section/block contracts + validation | `packages/theme-engine` | report 04 §2.1 |
| Configuration writes (drafts/releases) | `services/api-gateway` `ThemeExecutionAdapter` | report 04 §4–5 |
| Runtime behavior governance | `runtime.manifest.json` declares "thin composition runtime… no durable business orchestration"; forbidden deps `apps/*`, `services/*` (lines 51–57, 74–81) | file |

---

## 6. Data access map (tables, caches, services)

The storefront app touches **no database directly**; every read/write is an HTTPS call to the gateway (`api/client.ts`). Effective data surface per render:

| Data | Storefront service | Gateway endpoint → tables | Cache |
|---|---|---|---|
| Store + current theme release + app blocks | `StoreService.getStoreBySubdomain*` | `GET /storefront/:subdomain` → `sites`, `theme_releases` (current published), `app_extension_registrations` + `app_installations`/`marketplace_apps`/`app_extensions` | Next tags `storefront:${subdomain}(:published/:status)` revalidate 60; gateway `cachedJson` versioned key (second pass storefront.ts:2201) |
| Draft preview store | `getPreviewStoreBySubdomain` | `GET /storefront/:subdomain/theme-preview?token` → `theme_preview_sessions` (sha-256 token hash, expiry check — second pass :2068–2096), `theme_instance_drafts` (:2105–2125) then `theme_editor_drafts` by exact `draft_id` (:2127–2152), live `theme_releases` for manifest defaults (:2158–2181) | no-store (client default when no `next` opts, api/client.ts:83–85) |
| Navigation (main/footer/policies) | `fetchWorkerNavigationBundle` | `GET /storefront/:subdomain/navigation?location=` | tags `storefront:${subdomain}:navigation:${location}` |
| Products | `ProductService` | `storefront.listProducts/listProductsByStoreId` (`limit: 100` hardcoded — product-service.ts:45, 62), `productsByIds`, `getProduct` → `products` (+ `search_documents` full-text path on gateway, second pass storefront.ts:885) | tags + revalidate per call |
| Content pages/blog | `ContentService` | storefront content endpoints → CMS tables | revalidate 60 |
| Customer/session/wishlist/orders/reviews/coupons | `/api/*` BFF routes (21 route files under `src/app/api`, enumerated by directory listing) proxying gateway customer/order endpoints with session cookie + HMAC for internal paths | gateway tables | no-store |
| Theme catalog (read-only) | `/api/themes` proxy (`route.ts:9–42`) | gateway `GET /themes` | none |
| Cart | client-side only: localStorage `lb_cart` (re-verified second pass: cart-context.tsx:28/43, liquid-hydration-islands.tsx:5; checkout submits the local cart to `/api/orders`, checkout-client.tsx:375; `public.carts` exists with RLS in DB — baseline :8633/:24169/:24277 — with zero application readers/writers; gateway GraphQL explicitly returns `CART_NOT_SUPPORTED` for cart selections, graphql/storefront.ts:386–392) | — | — |

Demo bypass: subdomain `urban-kicks-demo` serves the in-repo fixture (products, navigation, full templateConfig with releaseId `demo-urban-kicks-release` — `urban-kicks-demo.ts:7–11`) without touching any of the above.

---

## 7. Apps integration surface (does it exist?) — yes, two mechanisms

1. **JSON-contract path — `appBlockSlot` sections**: gateway attaches `app_blocks` to every public store payload (§2.2). `store-service.ts` normalizes them (`normalizeAppBlockInstances` from `@letbuyy/app-engine`) and injects them as `app-block` blocks into matching `appBlockSlot` sections by slot id (default slot `storefront.home.after-hero` — 192–197); unmatched blocks get auto-generated `appBlockSlot` sections appended after the last section (262–288); templates get the same injection per template (290–305). Rendering: `sections/app-block-slot.tsx` — inline card (escaped text fields, theme-colored CTA) or sandboxed iframe (`sandbox="allow-forms allow-popups allow-scripts allow-same-origin"`, loading=lazy — 30–42, 53–63).
2. **Liquid path — `@app` blocks**: Liquid sections can declare `{ "type": "@app" }` blocks (theme-bundle.ts:132–136, app-block allowance check 488–499); the composition engine supplies real HTML for installed app blocks via the `liquidAppBlocks` lookup map (composition-engine.tsx:124–150); unresolved app blocks render an empty placeholder `div[data-letbuyy-app-block]` (theme-renderer.ts:390).
3. A separate `components/checkout-extensions/CheckoutExtensionHost.tsx` exists for checkout-surface extensions (present in file listing; outside theme scope).

Constraint observed: app-block content rendered inline is limited to the normalized fields (title/heading/body/cta) or an iframe URL — there is no script-extension execution surface in the storefront (Liquid sanitizer strips `<script>`; theme-renderer.ts:471–476; bundle schema forbids `<script` in sources, theme-bundle.ts:101–109).

---

## 8. Preview & editor-mode behavior inside the runtime

- `/preview` page (`src/app/preview/page.tsx`, force-dynamic): accepts `subdomain|store|storeName`, `viewport`, `theme_preview_token`, `settings_data`/`settings_data_b64` (≤12,000 chars, base64url JSON — 36, 99–119); loads preview store (token) else any-status store (260–267); overlays sanitized draft theme settings (color regex, font allow-list, radius clamp 0–32 — 72–97, 121–173); renders header group + `StorefrontCompositionEngine` + footer group **with `editorMode`** (337–361); emits its own theme CSS (`buildThemeCss`, 198–258); mounts `StorefrontPreviewBridge` (367).
- `StorefrontPreviewBridge` (`preview/storefront-preview-bridge.tsx`): posts `letbuyy:storefront-preview:ready` (with sectionIds + viewport) to `document.referrer` origin; listens for `letbuyy:theme-editor:section-selected/section-scroll/viewport` plus legacy `LETBUYY_THEME_EDITOR_SELECTION`/`LETBUYY_THEME_EDITOR_VIEWPORT`; scroll-into-view via `[data-letbuyy-editor-section-id]` (lines 5–10, 43–89).
- `?editor=1` on normal store routes also enables editor frames (home page `page.tsx:59, 79`; composition engine wraps sections accordingly).
- Live consumer of this protocol today: the Flutter merchant app (builds the `/preview?...&editor=1&theme_preview_token=` URL — report 04 §2.5). The web merchant editor does not (report 04 §5 B-1); the would-be web consumer `CenterPanel.tsx` is unreferenced. **Re-verified second pass after the editor rewrite (commit b64971fa): the rewritten 2,244-line editor page still renders its own in-page mock (`PreviewCanvas`, page.tsx:1842–1906) and never calls `/api/themes/[themeId]/preview-session`; CenterPanel still has zero importers.**

---

## 9. Limitations / risks observed (factual; all re-verified second pass 2026-06-05)

1. **Compiled-in section vocabulary (JSON path) — STILL-OPEN (C-7)**: any section type outside §4.1 renders nothing (`renderRegisteredSection` returns null at :387/:390); marketplace JSON-contract themes can therefore only re-parameterize first-party components. Evidence: renderer-registry.tsx:385–393; static import block 1–29. Unchanged by the remediation window.
2. **Liquid plan suppresses section groups / Liquid lacks theme chrome and commerce objects — STILL-OPEN (C-9)**: header/footer groups are empty for Liquid themes (template-resolver.ts:202–205); the layout's group renderer then renders nothing for them — a Liquid theme without header/footer sections in its templates ships without chrome. The Liquid layout render hardwires `content_for_header: ''` and `content_for_footer: ''` (theme-renderer.ts:190–191 in the layout scope; :247–248 as engine globals), and `buildLiquidScope` (:332–362) exposes only `shop`, `request`, `settings`, `routes` (plus optional caller `liquidContext` passthrough) — no `product`, `collection(s)`, `cart`, or `customer` drops exist, so Liquid templates cannot iterate live commerce data server-side; commerce interactivity comes only from the four hydration islands. Unchanged by the remediation window.
3. **Duplicate store fetch + plan resolution per request**: layout and page each call StoreService and `resolveStorefrontTemplate` independently (layout.tsx:65–69, 105–109 vs page.tsx:38–67); deduplication relies on Next fetch caching of the underlying gateway calls, not on shared computation.
4. **`runtime-composition` projection adopted on the home route only**: `composeStorefrontRuntimeProjection` is used in `store/[subdomain]/page.tsx` (line 38) with `as never` casts (54–58); product/collection/content routes call services directly — the declared query-layer migration (`runtime.manifest.json:79`) is partial.
5. **Demo tenant bypass — STILL-OPEN (H-14)**: flagship demo never exercises gateway, release, or cache paths (store-service.ts:55–57, plus :73–75 preview, :92–94 any-status, :116–118 by-id) — regressions in the real pipeline are invisible on the demo. The same theme exists separately as a DB seed (`database/supabase/seeds/urban-kicks-theme.sql`) and as the Liquid fixture (`createUrbanKicksLiquidThemeBundleFixture`, theme-bundle.ts:1356) — three sources for one theme. Unchanged by the remediation window; the rewritten web editor additionally bakes urban-kicks defaults into every theme's edit session (`REQUIRED_URBAN_KICKS_SECTIONS`, report 04 §2.3).
6. **Hardcoded list caps**: products list `limit: 100` (product-service.ts:45, 62); no pagination on the storefront grid data fetch.
7. **Stale generated docs**: `AGENTS.md` (generated 2026-05-25, line 1) lists `/api/payments/*` routes that do not exist in `src/app/api` (second-pass directory enumeration again shows exactly 21 route files, none under payments) — it was not regenerated in the remediation window and cannot be trusted for route inventory.
8. **Search/header data**: layout fetches up to 100 products on every store render solely to power header search (layout.tsx:89–101), even for pages that don't show search results.
9. **Cart is client-local only — STILL-OPEN (C-10)** (localStorage `lb_cart`; cart-context.tsx:28/43 + liquid islands :5 share it) — no server cart table is read by the storefront; checkout submits the local cart to order APIs (checkout-client.tsx:375). `public.carts` (baseline :8633, RLS :24169/:24277/:26226) remains unwired: grep for `from('carts')` across `services/api-gateway/src` and `apps/storefront-runtime/src` returns zero matches. NEW second pass: the gateway storefront GraphQL endpoint now fails loud on cart selections — `CART_NOT_SUPPORTED`, "not supported until server-side cart persistence is enabled" (`services/api-gateway/src/graphql/storefront.ts:386–392`) — making the gap explicit rather than silent.
10. **`?editor=1` is unauthenticated**: editor frames (selection chrome) activate via query param on public routes (page.tsx:59); the frames expose no data beyond section ids/types, and draft content still requires a valid preview token, but the editor UI affordance itself is publicly toggleable.

---

## Evidence Index

- `apps/storefront-runtime/src/proxy.ts` (:5–9 matcher; :17–48 routing; :54–66 preview cookie)
- `apps/storefront-runtime/src/lib/theme-preview-server.ts` (:5–14) and `theme-preview-cookie.ts`
- `apps/storefront-runtime/src/lib/api/client.ts` (:13 default base; :22–29 read init; :60–88 fetch + session header :67–73; :90–116 HMAC internal)
- `apps/storefront-runtime/src/lib/store-service.ts` (:51 revalidate; :53–129 service; :55–57/:73–75/:92–94/:116–118 demo bypass; :164–183 block normalize; :185–288 app-block injection; :307–340 section normalize; :387–429 groups/templates; :440–458 worker fetches; :497–505 navigation; :514–548 status-only; :551–710 mapping; :556–564 release precedence; :582 localize; :604–655 editor-object format; :661–662 liquidBundle; :713–743 type map)
- `apps/storefront-runtime/src/lib/product-service.ts` (:24–83; :45/:62 limit 100)
- `apps/storefront-runtime/src/lib/theme-engine/types.ts` (:5–19 route types; :44–70 plan/props)
- `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` (:18–63 groups; :65–94 templates/legacy; :108–135 liquid resolve; :137–184 liquid coerce; :186–256 plan; :202–205 empty groups; :210–216/:238–244 cache tags)
- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` (:1–29 imports; :66–188 runtime schemas; :198–345 definitions; :347–356 maps; :358–372 manifest exports; :374–393 resolve/render)
- `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` (:12–61 list; :63–84 liquid html; :86–150 app-block html/map; :152–190 liquid plan; :192–224 engine; :226–251 group renderer)
- `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts` (:7–8 product sets; :32–44 binding detection; :46–84 batched plan)
- `apps/storefront-runtime/src/lib/theme-engine/product-route.ts` (:3–40) and `content-route.ts` (:4–17)
- `apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx` (:5–6 messages; :31–92)
- `apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx` (:5–8 keys/events; :35–69 cart ops; 369 lines total)
- `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` (:17; :20–31 fonts; :63–101; :104–119 settings; :124–205 css vars; :207–253 groups/providers)
- `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx` (:11; :27–82; :38–57 projection; :59 editor flag)
- `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/page.tsx` (:11; :43–49; :51–54 data map; :56–63 JSON-LD)
- `apps/storefront-runtime/src/app/store/[subdomain]/products/page.tsx` (:47–48), `shop/page.tsx` (:43–44), `[...path]/page.tsx` (:9, :41–66)
- `apps/storefront-runtime/src/components/content/content-resource-renderer.tsx` (:22–43)
- `apps/storefront-runtime/src/components/sections/app-block-slot.tsx` (:17–63 records/iframe/card)
- `apps/storefront-runtime/src/app/preview/page.tsx` (:18–19; :34–36 limits; :99–173 settings extraction; :198–258 css; :260–275 loaders; :299–386 page; :337–361 editorMode render)
- `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` (:5–10; :43–89)
- `apps/storefront-runtime/src/app/api/themes/route.ts` (:9–42) and `api/themes/install/route.ts` (:8–16 — HTTP 410)
- `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` (:7–15; 340 lines)
- `apps/storefront-runtime/next.config.ts` (:3–11 frame-ancestors; :17–48 images; :52–89 headers)
- `apps/storefront-runtime/runtime.manifest.json` (:9–13 classification/authority; :33–57 dependency rules; :58–63 Vercel; :74–81 execution authority; :79 query ownership)
- `apps/storefront-runtime/AGENTS.md` (:1 generated date; :45–51 nonexistent payment routes — contradicted by `src/app/api` enumeration: 21 route files, no payments dir)
- `packages/runtime-composition/storefront-query-layer/index.ts` (:8–39 contracts; :41–103 aggregation + cache policy :82–92)
- `packages/theme-engine/src/theme-renderer.ts` (:104–211 Liquid render; :230–251 engine opts; :390 app-block placeholder; :471–476 sanitize)
- `packages/theme-engine/src/theme-bundle.ts` (:30–51 islands; :101–109 forbidden fragments; :132–136/:488–499 @app blocks; :1356 urban-kicks fixture)
- `services/api-gateway/src/routes/storefront.ts` (second pass: 4,833 lines; import of extracted routes :33; pooled loaders :926/:941 (`is_current` :950); search_documents :885; `loadSiteByHandle` :1060; `loadCurrentThemeRelease` :1108; app blocks :1197/:1209–1220/legacy :1229+; `registerStorefrontInternalPaymentRoutes` call :1826–1829 followed by `GET /lookup` :1832; theme-preview :2057–2196; bootstrap :2199+ with cachedJson :2201)
- `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (NEW second pass, 233 lines; body types :21–55; deps contract :57–69; `isInternalRequest` :71–76 — dev bypass when no `INTERNAL_API_SECRET` and `ENVIRONMENT !== 'production'` :73; `registerStorefrontInternalPaymentRoutes` :106; payable :108–125; reference :128–150; confirm :153–181 incl. `emitStorefrontOrderPaidEvent` dep :173–178; failure :184–208; event :211–232)
- `tests/contracts/storefront-internal-payment-routes.test.ts` (NEW second pass, 31 lines; five endpoints :7–13; production env + no secret → asserts 403/FORBIDDEN :15–31; auth-gate-only characterization)
- `services/api-gateway/src/graphql/storefront.ts` (cart fail-loud `CART_NOT_SUPPORTED` :386–392; mutation reservation :382–384)
- `services/webhook-service/src/gateway-order-transitions.ts` (sole non-gateway/non-test consumer of `/internal/payments|/internal/orders` per repo-wide grep)
- `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` (:375 POST local cart to `/api/orders`)
- `database/supabase/migrations/000_baseline.sql` (`public.carts` :8633; RLS enable :24169; customer policy :24277; service policy :26226 — zero application code references)
- Counts measured second pass: storefront.ts 4,833 lines; internal-payment-routes.ts 233 lines; merchant editor page 2,244 lines (rewritten — see report 04); liquid-hydration-islands 369 lines and urban-kicks-demo 340 lines (unchanged).
- Negative findings (second pass): no commits in the remediation window under `apps/storefront-runtime/src`; `from('carts')` zero matches in gateway and storefront-runtime source; `src/app/api` enumeration = 21 route files, no payments directory.
