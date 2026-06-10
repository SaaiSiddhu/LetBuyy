# App ↔ Storefront Runtime Integration Audit (Phase 5)

Scope: Storefront Runtime, Theme Renderer, LiquidJS Engine, Theme Configurations, Store Data Layer. Evidence: `apps/storefront-runtime/*`, `packages/theme-engine/src/theme-renderer.ts`, `packages/runtime-composition`.

---

## 1. Request → Pixel Lifecycle (as built)

```
GET store.letbuyy.store/{subdomain}/{route}            Next.js RSC route (apps/storefront-runtime/src/app/store/[subdomain]/…)
 1. StoreService.getStoreBySubdomain(subdomain)         store-service.ts → worker API → StoreModel
      └─ templateConfig {themeId, releaseId, themeSettings, sections|templates, liquidBundle?, appBlocks?, releaseManifest}
 2. injectAppBlocksIntoSections(store)                  store-service.ts:220-288 (slot match / dynamic slot creation)
 3. buildSectionDataPlan(store, sections, route)        data-binding-engine.ts:46-84 (products only, sequential await)
 4. resolveStorefrontTemplate(store, route)             template-resolver.ts:186-256
      ├─ liquidBundle? → validate (LiquidThemePackageBundleSchema.safeParse :118) → engine='liquid'
      └─ else JSON-contract template + sectionGroups (header/footer) + ISR cache tags
 5a. LiquidRenderer.render()                            theme-renderer.ts:104-210
      createLiquidEngine (cache:false, strict, limits 300K/250/2M)
      per-section: renderLiquidSectionBlocks (app blocks via liquidAppBlocks map) → parseAndRender(section)
      layout parseAndRender → sanitizeRenderedHtml (:471-476)
 5b. composeStorefrontTheme() → RenderSectionList → renderer-registry (32 React sections)
 6. Output: <LiquidRenderedHtml dangerouslySetInnerHTML> + <LiquidHydrationIslands basePath storeId>
      islands: add-to-cart, cart-drawer, search, variant-picker (theme-bundle.ts:30-51)
```

## 2. How App Content Enters the Page Today
- **App widgets/blocks:** only via `AppBlockInstance` → slot sections (audit doc 04 §1). Inline = escaped static HTML `<article data-app-block-slot=…>`; iframe = sandboxed frame (composition-engine.tsx:95-149).
- **App embeds:** no mechanism. `content_for_header`/`content_for_footer` are engine globals (theme-renderer.ts:230-250) populated by the platform only — no app injection path, no script-tag registry.
- **App scripts:** impossible outside iframes; `sanitizeRenderedHtml` strips `<script>` and bundle validator forbids `<script` in sources. (Correct default; needs a controlled escape hatch = app embeds with CSP'd, platform-served assets.)
- **Storefront API calls from app frontends:** iframe content may call public `/v1/storefront` (REST+GraphQL); there is **no app proxy** (`/apps/{handle}/…` on the shop domain reverse-proxied to the app backend with signed params) — so app iframes face CORS/third-party-cookie constraints and cannot render shopper-personalized SSR fragments.

## 3. Request/Data/Extension Lifecycle Gaps

| Lifecycle | Current | Gap |
|---|---|---|
| Rendering | Per-request `new Liquid()` engine, `cache:false` | No compiled-template LRU keyed by `releaseId`; no precompile-on-publish; CDN/ISR tags exist but engine work repeats per request |
| Request | Subdomain → store fetch each request | Store/release snapshot cacheable by `current_theme_release_id`; demo-store shortcut `isUrbanKicksDemoSubdomain()` (store-service.ts:55-56) ships in prod path |
| Data | Sequential product fetch before render; sections hardcoded (`productGrid`, `featuredProducts`) | No parallelism; no app-declared data dependencies; no per-block fetch budget |
| Extension | Placements resolved from installation config at request time | No placement snapshot table; no version pin; no kill switch per extension (registry `revoked` status exists but storefront path doesn't consult registry status — verified: composition path reads instances only) |
| Caching | Cache tags built in template-resolver | No app-block-level cache policy (an iframe URL change should not bust whole page) |

## 4. Runtime Conflicts & Violations
1. **Sandbox conflict:** iframe `sandbox="allow-forms allow-popups allow-scripts allow-same-origin"` — same-origin + scripts lets framed code escape sandbox if served from platform origin. App frames must be cross-origin (apps CDN/app domain) or drop `allow-same-origin`.
2. **Ownership:** composition-engine (storefront) hand-rolls app iframe markup; per runtime-boundaries, an extension-host abstraction should own frame policy. `packages/extension-host` exists (328 LOC) but storefront-runtime does not import it.
3. **Engine duplication risk:** `packages/runtime-composition` + `execution-runtime.ts` (composition/hydration registries) overlap with renderer-registry responsibilities; one composition authority should exist.
4. **Silent coercion:** `asRecord()/stringArray()` helpers and `normalizeAppBlockInstance()` default-fill invalid data (app-engine ~:1520) — malformed placements render as empty blocks rather than surfacing errors to merchants.
5. **Misplaced API:** PayPal webhook under `apps/storefront-runtime/src/app/api/payments/paypal/webhook/route.ts` violates "gateway is sole Commerce API backend" (root AGENTS.md) — storefront runtime should own zero payment-provider callbacks.
6. **Observability:** 10+ storefront API route files contain `console.log` (incl. customer login/orders/checkout) — shopper PII risk in logs; no structured logger.

## 5. Missing Systems (Storefront-side) — required for Shopify parity
1. **App Embed injector:** platform-owned injection of registered app embeds into `content_for_header`/`content_for_footer` with per-embed on/off (merchant), CSP nonce, and async/defer asset loading.
2. **App asset pipeline:** R2-backed CDN bucket per app version (`letbuyy-media-*` buckets exist in `config/cloudflare/resource-names.json`); assets referenced by handle, loaded only when block present (Shopify behavior).
3. **App proxy:** gateway route `/proxy/apps/:handle/*` → signed forward (HMAC of shop+timestamp+path) to app origin; response cached per `Cache-Control`.
4. **Placement snapshot:** `app_block_placements` resolved at theme publish into the release manifest, so storefront render reads release-pinned placements (no per-request normalization of installation config).
5. **Extension kill switch honored at render:** registry status `revoked/disabled` must filter placements in template-resolver.
6. **Section data contracts for apps:** extension manifest declares `data: [{kind:'product'|'collection'|'cart', source:'context'|'setting'}]`; data-binding-engine fulfills alongside product fetches (parallelized).

## 6. Verdict
Storefront runtime is a competent dual-renderer host with real Liquid, sanitization, and island hydration — but apps reach shoppers only as escaped text or third-party iframes resolved at request time. Parity requires moving from request-time content injection to publish-time, version-pinned extension composition plus embed/asset/proxy subsystems (blueprints: docs 11, 12, 13).
