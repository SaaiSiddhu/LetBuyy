# Storefront Liquid Discovery — Evidence Report

**Document class:** Audit Trail / Evidence Ledger  
**Date:** 2026-07-04  
**Branch:** stepup/main  
**Auditor role:** Certification Author (subagent)  
**Companion documents:**  
- `ARCHITECTURE_CERTIFICATION.md` — primary certification verdict  
- `RISK_CLOSURE_REPORT.md` — per-risk closure status  
**Discovery corpus:** `docs/storefront-liquid-discovery/01_REPOSITORY_DISCOVERY.md` through `12_MASTER_LIQUID_MIGRATION_PLAN.md`

---

## 1. Scope and Methodology

This ledger records the complete evidence basis for every verdict issued during the Phase B certification pass of the Storefront Liquid Discovery. It covers:

- 56 registered items (R-*, OQ-*, UC-* series) from the discovery register
- All runtime execution attempts and their outcomes
- All documentation corrections applied to the 12 discovery documents and 1 source file

**Methodology.** Each item was verified by:

1. Reading the primary evidence path(s) cited in the discovery document using the Read tool
2. Cross-checking against adjacent files (gateway routes, migration SQL, test files, node_modules LiquidJS source) as warranted
3. Forming a verdict: CONFIRMED / PARTIAL / REFUTED / UNVERIFIABLE
4. Where the discovery document contained inaccurate or incomplete information, corrections were applied in-place before this ledger was written

**Verdicts defined:**

| Verdict | Meaning |
|---|---|
| CONFIRMED | The claimed fact or risk is accurate as stated |
| PARTIAL | The core observation is real but the framing, scope, or severity is inaccurate in a material way |
| REFUTED | The primary claim is factually incorrect based on source evidence |
| UNVERIFIABLE | Cannot be confirmed or refuted from static repository analysis alone; live DB or runtime data required |

**Runtime execution.** All four Phase B runtime commands (`pnpm --filter @letbuyy/theme-engine test`, `pnpm --filter @letbuyy/theme-engine typecheck`, `pnpm --filter @letbuyy/storefront-runtime test`, `node scripts/validate-governance.mjs`) were BLOCKED by a safety classifier that was temporarily unavailable for pnpm and node-script invocations. No fabricated pass/fail verdicts are asserted. Static evidence is recorded in full.

---

## 2. Register Count

| Series | Count | Notes |
|---|---|---|
| R- (Risk) | 15 | R-01 through R-15 |
| OQ- (Open Question) | 21 | OQ-01 through OQ-21 |
| UC- (Uncovered / Unverified Claim) | 20 | UC-01 through UC-20 |
| **Total** | **56** | Matches `registerCount` in certification input |

---

## 3. Evidence Ledger — Full Item Table

The table below records every registered item. Columns:

- **ID** — register identifier
- **Verdict** — CONFIRMED / PARTIAL / REFUTED / UNVERIFIABLE
- **Primary Evidence Path(s)** — exact `path:line` references
- **Runtime Checked** — whether a live process was executed to verify
- **Verifier Notes** — material nuances, corrections applied, or scope qualifications

---

### 3.1 Risk Register (R-series)

| ID | Verdict | Primary Evidence Paths | Runtime Checked | Verifier Notes |
|---|---|---|---|---|
| **R-01** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:436-437` (`cache:false`); `theme-renderer.ts:447-451` (MapFS in-memory source); `node_modules/.pnpm/liquidjs@10.27.0/.../liquid.node.js:1794-1797` (MapFS confirmation); `theme-renderer.ts:365` (fresh engine per call); `theme-renderer.ts:299` (parseAndRender per section) | No | `cache:false` is structural. The `templates` option provides an in-memory MapFS (no disk I/O) but LiquidJS still re-parses each source string on every `parseAndRender()` with `cache:false`. No cross-request engine reuse. With up to 23 sections per pageview, this is a real CPU cost. Claim is accurate in all particulars. |
| **R-02** | CONFIRMED | `theme-renderer.ts:271-331` (no try/catch in `renderLiquidTemplateSections`); `theme-renderer.ts:383` (no try/catch in `LiquidRenderer.render`); `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:432-433` (no try/catch in caller); `composition-engine.tsx:482` (no try/catch in `StorefrontCompositionEngine`); `packages/theme-engine/test/` (no error-path test for malformed Liquid source) | No | A throw from `engine.parseAndRender()` propagates unhandled through the full chain into the Next.js Server Component. The discovery docs describe a "fallback to React or UnknownSectionFallback" — this fallback does not exist in code. The actual failure mode is a hard 500 or error boundary. The claim correctly identifies the absence of error handling; the described fallback is aspirational. |
| **R-03** | CONFIRMED | `apps/storefront-runtime/src/proxy.ts:106` (`cache:'no-store'`); `proxy.ts:98-120` (no in-memory/KV/edge cache in `resolveAccess`); `services/api-gateway/src/routes/internal-store-access.ts:30-62` (no Cache-Control response header); `proxy.ts:244-249` (`NextResponse.next()` on 'unavailable' status) | No | Every storefront request triggers an uncached gateway fetch to `/v1/internal/store-access/resolve`. One material nuance: when the gateway is down, the proxy degrades to `NextResponse.next()` rather than returning a 500 — store access enforcement is bypassed rather than hard-failing. SPOF characterisation is correct for access-control integrity. |
| **R-04** | PARTIAL | `packages/theme-engine/src/theme-registry.ts:283-285` (React type: 'newsletter'); `packages/theme-engine/src/theme-bundle.ts:1178-1179` (Liquid type: 'newsletter-signup'); `packages/theme-engine/src/theme-governance.ts:35` (parity entry maps both); `packages/theme-engine/src/portable-to-liquid.ts:46` (`PORTABLE_TO_LIQUID_TYPE_OVERRIDES`: newsletter→newsletter-signup); `portable-to-liquid.ts:62-68` (`resolveLiquidSectionType` applies override first); `database/supabase/migrations/171_liquid_bundle_persistence.sql` and `172_liquid_bundle_refresh.sql` (persisted bundles use newsletter-signup) | No | The naming mismatch is real. However the stated failure scenario — "silent lookup miss at render time" — does not occur for bundles compiled via `compilePortableToLiquidBundle` because the override in `portable-to-liquid.ts:46` maps the type at compile time. Both shipped migrations store the section as `newsletter-signup`. The risk exists only for Liquid bundles written to the DB bypassing the compiler (e.g. a manual patch). Doc corrections applied: R-04 reclassified from HIGH to MEDIUM in doc 01; mitigation note added to docs 11 and 12. |
| **R-05** | CONFIRMED | `packages/theme-engine/src/theme-bundle.ts:1013-1017` (Liquid hero-banner settings: eyebrow, heading, subheading, ctaText, ctaLink — no overlay/height/textAlign/image); `theme-bundle.ts:1019-1026` (body omits overlay/height/textAlign/image); `packages/theme-engine/src/theme-registry.ts:86-110` (React heroBanner schema has image, overlay, height, textAlign); `packages/theme-engine/src/theme-governance.ts:33` (parity entry confirms mapping) | No | All four missing fields confirmed. Additional finding not in the claim: Liquid hero-banner has an extra `eyebrow` field (type:text, default:'New season essentials') absent from React heroBanner schema. Doc correction applied to doc 10 (T-6). |
| **R-06** | CONFIRMED | `apps/storefront-runtime/src/lib/store-service.ts:3` (imports only `createUrbanKicksLiquidThemeBundleFixture`, not the Core fixture); `store-service.ts:671-673` (fallback calls Urban Kicks fixture on parse failure); `packages/theme-engine/src/theme-bundle-core.ts:66-82` (`createLetbuyyCoreLiquidThemeBundleFixture` exists and is valid); `packages/theme-engine/src/index.ts:22` (Core fixture exported); `packages/theme-engine/src/theme-bundle.ts:1849,1867,1937,1969` (Urban Kicks fixture emits Urban Kicks branding) | No | Every Liquid store that fails bundle schema validation inherits Urban Kicks branding. Fix is a one-line import swap and one-line call change. |
| **R-07** | REFUTED | `services/api-gateway/src/routes/storefront/customer-registration.ts:33` (POST `/customer/register` exists, fully implemented with rate-limit, Turnstile, bcrypt, HS256); `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts:14,696` (route registered); `services/api-gateway/src/routes/storefront/public-routes.ts:11,1216` (engagement routes wired); `services/api-gateway/src/routes/storefront.ts:20,1296` (storefront router mounted at `api.route('/storefront', storefrontRouter)`); git commit a391c1f4 (LB-12 closed) | No | The endpoint was implemented and wired in commit a391c1f4. The discovery docs were written before that commit. Stale BLOCKED annotation in `packages/theme-engine/test/liquid-l9-auth.test.ts:2-3` should be cleaned up. Doc corrections applied to docs 11 and 12 marking R-07 as CLOSED and LB-12 as CLOSED. |
| **R-08** | CONFIRMED | `apps/storefront-runtime/src/lib/store-service.ts:60-64` (navigation fetched in parallel); `store-service.ts:721` (navigation assigned to StoreModel); `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:339-397` (buildLiquidCommerceContext return: shop, product, collection, collections, cart, customer, order — no navigation); `packages/theme-engine/src/theme-renderer.ts:552-591` (buildLiquidScope: no navigation or linklists); `theme-renderer.ts:41-52` (LiquidCommerceDrops interface: no navigation field) | No | StoreModel.navigation is a populated StoreNavigation object (fetched at store-service.ts:60-64) but the entire key is absent from both `buildLiquidCommerceContext()` and `buildLiquidScope()`. `{{ shop.navigation }}` renders as empty string (strictVariables:false). Doc correction applied to doc 11 (§6.1 linklists row). |
| **R-09** | CONFIRMED | `packages/theme-engine/src/experience-fonts.ts:57-64` (`buildGoogleFontsHref` defined); `experience-fonts.ts:67-69` (`buildExperienceFontLinkHref` defined); `apps/storefront-runtime/src/` (grep for both functions returns no results); `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:21-32` (FONT_MAP missing Cormorant Garamond, Libre Baskerville, Source Sans Pro, Lato); `packages/theme-engine/src/theme-presets.ts:224-225,246-247,312-313` (Aura, Craft, Dawn use missing fonts); `experience-fonts.ts:31-37` (EXPERIENCE_FONT_REGISTRY has all four); `layout.tsx:121-122` (Inter fallback when family not in FONT_MAP) | No | Both font-loading functions are dead code in the storefront (exported but never imported or called). The FONT_MAP fallback silently uses Inter for any missing heading font. Comments in theme-presets.ts:238,216 confirm the team is aware. |
| **R-10** | REFUTED | `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx:50` (sends `LETBUYY_THEME_EDITOR_SELECTION`); `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx:5` (LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION'); `storefront-preview-bridge.tsx:6` (SELECTED_MESSAGE = 'letbuyy:theme-editor:section-selected'); `storefront-preview-bridge.tsx:70` (handles LEGACY_SELECTION_MESSAGE); `storefront-preview-bridge.tsx:44` (re-dispatches SELECTED_MESSAGE same-origin); `apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx:42-44` (listens for SELECTED_MESSAGE); `apps/storefront-runtime/src/app/preview/page.tsx:390` (StorefrontPreviewBridge mounted) | No | StorefrontPreviewBridge (added in commit 76d3bee3, 2026-06-04) bridges the key mismatch at runtime. The three discovery docs (05, 11, 12) predate or missed this component. Section-selection highlighting works end-to-end. C-04 CLOSED. Doc corrections applied to docs 05, 11, and 12. |
| **R-11** | CONFIRMED | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:380-396` (buildLiquidCommerceContext return: no 'search' key); `packages/theme-engine/src/theme-renderer.ts:50` (LiquidCommerceDrops: `search?: unknown`); `theme-renderer.ts:604-631` (buildLiquidCommerceDrops: `search: toLiquidDrop(context?.search) || null` always null); `theme-renderer.ts:587` (buildLiquidScope: propagates null) | No | The search drop is always null. The interface stub exists but no code path ever populates it. `{{ search.results }}` renders as empty string. |
| **R-12** | CONFIRMED | `find` across full repo excluding node_modules and .next — returns 0 `.liquid` files; `packages/theme-engine/src/theme-bundle.ts:794-1194` (`createLiquidParitySectionFiles()` returns 23 section entries, all as TypeScript string literal arrays); `theme-bundle.ts:767-793` (source assembled from string array joined with newlines); `theme-bundle.ts:2826-2840` (Urban Kicks standalone fixture also uses inline source strings) | No | Zero `.liquid` files exist in the repository. The count of 23 sections in the claim is accurate. Theme Check and Liquid linters cannot operate on these templates without first extracting them from the TypeScript build artifact. |
| **R-13** | CONFIRMED | `apps/storefront-runtime/src/lib/customer-service.ts:252-255` (`getStoreCustomers` returns `{ customers: [], total: 0 }` unconditionally); `apps/storefront-runtime/src/lib/product-service.ts:85-88` (`getProductsBySellerId` returns `[]`); repo-wide grep for both function names outside definition files returns zero callers | No | Both stubs confirmed. No caller currently invokes either, so present blast radius is zero active features. Stubs remain a latent defect if callers are added. Doc correction applied to doc 08 adding the zero-caller qualification. |
| **R-14** | REFUTED | `apps/storefront-runtime/src/proxy.ts:67-74` (internalHeaders returns null when secret absent); `proxy.ts:79-84` (backendConfig returns null when internalHeaders null); `proxy.ts:98-100` (resolveAccess returns { status:'unavailable' } immediately — NO network fetch); `proxy.ts:244-249` (NextResponse.next() on 'unavailable') | No | When the secret is absent, NO gateway request is made at all. The claim that "all internal gateway requests then proceed without the secret" is factually wrong. The actual risk is different and arguably more severe: all store access enforcement (password, offline, preview-only) is silently bypassed. Doc correction applied to doc 04 (line 298). |
| **R-15** | CONFIRMED | `packages/theme-engine/src/theme-governance.ts:162-181` (11-entry `candidates` array, any truthy value triggers Liquid); `theme-governance.ts:125-142` (`readBooleanDecision` recurses into object-typed candidates checking nested keys 'enabled', 'liquid_enabled', etc., broadening the surface); `theme-governance.ts:16-21` (THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION declares ARB authority but is NEVER checked in resolveThemeLiquidRenderingEnabled); `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:235-245` (no ARB gate before resolveThemeLiquidRenderingEnabled); `packages/theme-engine/test/theme-engine.test.ts:211-216` (confirms liquidRenderingCanary:true alone flips to Liquid) | No | 11 literal canary paths confirmed in the candidates array; zero ARB enforcement in code. `readBooleanDecision` also recurses into object-typed candidates checking nested keys — the trigger surface is broader than 11. Doc correction applied to doc 08 (accidental canary activation section). |

---

### 3.2 Open Questions Register (OQ-series)

| ID | Verdict | Primary Evidence Paths | Runtime Checked | Verifier Notes |
|---|---|---|---|---|
| **OQ-01** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:477` (stripLiquidSchemaBlocks regex: `/{%\s*schema\s*%}[\s\S]*?{%\s*endschema\s*%}/gi` — non-greedy, requires both delimiters) | No | A missing `{% endschema %}` causes the regex to find no match, returning source unchanged. The raw `{% schema %}` block reaches the Liquid engine, which throws an unknown-tag parse error (LiquidJS strict-tags mode). Because R-02 has no try/catch around `parseAndRender()`, this crashes the Next.js server component. Doc corrections applied to docs 11 and 12. |
| **OQ-02** | REFUTED | `apps/storefront-runtime/src/app/globals.css:25` (`--font-playfair: var(--font-letbuyy-display), Georgia, "Times New Roman", serif`); `apps/storefront-runtime/src/app/layout.tsx:14-18` (localFont loads geist-sans-latin-ext.woff2 as `--font-letbuyy-display`); `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:21-32` (FONT_MAP: `'Playfair Display': 'var(--font-playfair)'`); `packages/theme-engine/src/theme-presets.ts:203` (Sense: `headingFontFamily:'Playfair Display'`) | No | `--font-playfair` IS defined. The Sense heading font does not use a bare system font — it chains to `--font-letbuyy-display` (Geist Sans Latin Ext) → Georgia → Times New Roman → serif. The gap is a missing Playfair Display font loader (the CSS variable resolves to a sans-serif geometric), not an undefined variable. Doc corrections applied to docs 05, 11, and 12. |
| **OQ-03** | PARTIAL | `database/supabase/migrations/171_liquid_bundle_persistence.sql:13-17` (UPDATE targets default_template only); `migrations/172_liquid_bundle_refresh.sql:14` (UPDATE targets default_template only); `migrations/180_urban_kicks_liquid_theme.sql:15-52` (UPDATE targets settings_schema and default_template; section_schemas not touched); `database/supabase/seeds/urban-kicks-theme.sql:159,220-226` (seed INSERT sets section_schemas to non-empty JSONB with 6 lightweight stubs); `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:111-117` (legacyRuntime fallback chain) | No | The claim that "section_schemas remains {}" is wrong for seed-applied databases. The urban-kicks-theme.sql seed sets 6 lightweight stubs (header, heroBanner, categoryGrid, productGrid, trustBadges, footer — type+name only, no settings_schema/blocks_schema/defaults). The TypeScript static `SECTION_SCHEMAS` fallback is triggered only on pure migration-only databases. Doc corrections applied to docs 09, 11, and 12. |
| **OQ-04** | CONFIRMED | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:228-233` (first line of `resolveDevEngineOverride`: `if (process.env.NODE_ENV === 'production' \|\| !engine) return {}`); `template-resolver.ts:228` (JSDoc: "Ignored in production") | No | Standard `process.env.NODE_ENV === 'production'` guard. When `NODE_ENV=production`, the function returns `{}` immediately before reading the engine parameter. `?engine=liquid` and `?engine=react` are completely inert in production regardless of value. Doc corrections applied to docs 02, 11, and 12. |
| **OQ-05** | CONFIRMED | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:119` (`const liquidPage = renderPlan.rendererEngine === 'liquid'`); `layout.tsx:218` (liquidPage branch renders only `{children}`); `layout.tsx:245` (identical gate in non-store-site branch); `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:254` (rendererEngine:'liquid' set by resolveStorefrontTemplate); `composition-engine.tsx:460-465` (comment documents this contract explicitly) | No | The gate is structurally correct. Both the store-site branch (line 218) and the non-store-site branch (line 245) apply the `liquidPage` guard identically. Chrome double-render defect is closed. Doc corrections applied to docs 11 and 12. |
| **OQ-06** | PARTIAL | `packages/theme-engine/src/theme-renderer.ts:119-177` (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG definition); `theme-renderer.ts:126-128` (ADD_ATTR explicitly lists aria-live and aria-pressed); `theme-renderer.ts:170-174` (CUSTOM_ELEMENT_HANDLING.attributeNameCheck regex: `/^(?:aria-[a-z0-9-]+\|data-[a-z0-9-]+\|...)/i` covers all aria-* on lb-* elements); `theme-renderer.ts:120` (USE_PROFILES:{html:true} covers aria-* on standard HTML elements) | No | `ALLOW_ARIA_ATTR` is not set, but aria-* is protected by two layers: (a) `USE_PROFILES:{html:true}` for standard HTML; (b) `CUSTOM_ELEMENT_HANDLING.attributeNameCheck` regex for lb-* custom elements. The unprotected gap is aria-* on hypothetical custom elements whose tag name does not match the tagNameCheck regex — which does not occur in current templates. Risk is narrow, not broad. `ALLOW_ARIA_ATTR:true` would eliminate the edge case. Doc corrections applied to docs 03, 11, and 12. |
| **OQ-07** | PARTIAL | `database/supabase/migrations/180_urban_kicks_liquid_theme.sql:36-52` (UPDATE sets themes.default_template.rendererEngine='liquid' for 'urban-kicks'); `services/api-gateway/src/routes/storefront/public-routes.ts:23-30` (STOREFRONT_SITE_SELECT does NOT join themes table); `apps/storefront-runtime/src/lib/store-service.ts:548-556` (rawTemplateConfig built from release.template_snapshot, release_manifest.templateConfig, or data.template_config — no themes.default_template); `services/api-gateway/src/execution/theme-execution.adapter.ts:603-626` (rendererEngine goes into release_manifest.renderer_engine at publish); `packages/theme-engine/src/theme-governance.ts:154-160` (resolveThemeLiquidRenderingEnabled checks templateConfig.rendererEngine AND releaseManifest.renderer_engine) | No | The gateway storefront query never joins the themes table — `themes.default_template` is never fetched into the store payload. `rendererEngine` reaches a store only via `release_manifest.renderer_engine` (published release) or `templateConfig.rendererEngine` (template_snapshot). Stores with a per-store `template_config` and no published release do not automatically inherit the migration 180 change. Doc correction applied to doc 11 (Q8). |
| **OQ-08** | CONFIRMED | `apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx:355-358` (lb-cart-drawer data-lb-cart-remove filter); `liquid-hydration-islands.tsx:973-991` (lb-cart data-lb-cart-remove filter + stepQuantity ±1 delta); `liquid-hydration-islands.tsx:987-991` (quantity ≤ 0 removes item — updateQuantity equivalent); `liquid-hydration-islands.tsx:136-139` (writeCart persists to localStorage and syncs to server); grep confirms no function named removeFromCart, updateQuantity, or clearCart | No | Remove and updateQuantity are implemented via event delegation on data attributes (not named class methods, explaining why the audit did not confirm them). clearCart has no named implementation or UI surface — `writeCart([])` is the only internal path. Doc corrections applied to docs 02 and 11. |
| **OQ-09** | CONFIRMED | `apps/identity-platform/src/app/api/auth/create-store/route.ts:90` (`theme_id: templateId \|\| 'modern'`); `services/api-gateway/src/routes/stores.ts:687` (theme_id stored verbatim); `database/supabase/migrations/000_baseline.sql:11978` (sites table: `theme_id text DEFAULT 'modern'`); `000_baseline.sql:7738` (store_preview trigger: COALESCE(NEW.theme_id, 'modern')); `database/supabase/seeds/urban-kicks-theme.sql` (only slug 'urban-kicks' inserted; no 'modern' row); `migrations/180_urban_kicks_liquid_theme.sql` (updates WHERE slug='urban-kicks'; no 'modern' row created) | No | Fully confirmed. `route.ts:90` writes `theme_id='modern'` for standard web onboarding with no template selection. No migration or seed inserts a themes catalog row with `slug='modern'`. Theme-editor queries filtering by theme_slug will return 404. |
| **OQ-10** | REFUTED | `node_modules/.pnpm/liquidjs@10.27.0/.../liquid.node.mjs:4929-4931` (`_render()` creates `new Context(scope, ...)` per call); `liquid.node.mjs:3097-3114` (Context constructor creates `new Limiter(...)` per call from numeric options); `liquid.node.mjs:1280-1295` (Renderer class has no instance-level mutable state); `packages/theme-engine/src/theme-renderer.ts:423-427` (liquidRenderOptions are plain numbers, not shared Limiter objects); `theme-renderer.ts:271-331` (current loop is sequential for...of, not Promise.all) | No | Each `parseAndRender()` call creates an independent Context including independent Limiter instances. Renderer class has no shared mutable state. `Promise.all()` over section rendering is safe. Phase 3 P3-2 can safely switch to parallel execution. Doc correction applied to doc 12 (Q10). |
| **OQ-11** | PARTIAL | `services/api-gateway/src/routes/storefront/public-routes.ts:1226` (GET /:subdomain/blog — blog list route implemented); `public-routes.ts:1249` (GET /:subdomain/blog/:slug — blog detail route implemented); `apps/storefront-runtime/src/lib/content-service.ts:110-126` (ContentService.listBlogPosts and getBlogPostBySlug implemented); `apps/storefront-runtime/src/app/store/[subdomain]/blog/[slug]/page.tsx:34-52` (renders via ContentResourceRenderer with routeType='article'); `packages/theme-engine/src/theme-bundle.ts` (no 'blog' or 'article' Liquid template sections found in Urban Kicks fixture); `apps/storefront-runtime/src/app/store/[subdomain]/blog/` (no blog index page.tsx) | No | The claim that "no /storefront/{sub}/blog gateway routes were confirmed" is REFUTED — both routes exist with real DB queries. What genuinely is missing: (1) Liquid template keys for blog/article in the Urban Kicks bundle; (2) a blog-index Next.js page (only [slug] exists); (3) blog/article React integration is ContentResourceRenderer only. Doc corrections applied to docs 11 and 12. |
| **OQ-12** | PARTIAL | `packages/theme-engine/src/theme-governance.ts:325-368` (migrateThemeTemplateSchemas fully implemented); `packages/theme-engine/test/theme-engine.test.ts:9,158` (function imported and called in tests); `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` (grep returns no results for migrateThemeTemplateSchemas); `scripts/validators/theme-governance-validator.mjs:76-78,102-104` (governance validator checks the function is exported AND the test exercises it) | No | The claim "no call site was found in any test" is wrong. The function IS called at test.ts:158 and the governance validator enforces this. Accurate statement: tested in isolation, not wired into the gateway publish/draft/install path. Doc corrections applied to docs 09 and 12. |
| **OQ-13** | UNVERIFIABLE | `packages/theme-engine/src/theme-governance.ts:162-174` (11 canary-key candidates); `theme-governance.ts:154-160` (explicit rendererEngine='liquid' check precedes canary checks); `database/supabase/migrations/180_urban_kicks_liquid_theme.sql:37` (sets default_template.rendererEngine='liquid' for 'urban-kicks'); `packages/theme-engine/src/theme-governance.ts:14` (THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false); no migration sets liquidRenderingCanary=true in sites.template_config | No | Repository confirms the 11 canary aliases plus the explicit engine path. Whether any production store row's `sites.template_config` JSONB currently carries one of those keys is a live-database question requiring a Supabase query against the production sites table. Only stores explicitly assigned theme_id='urban-kicks' inherit rendererEngine='liquid' from migration 180 (via published releases). Exact count of such stores is unverifiable from the repo. |
| **OQ-14** | PARTIAL | `database/supabase/seeds/urban-kicks-theme.sql` (no legacy_theme_id column reference); `database/supabase/seeds/generated/urban-kicks-liquid-attach.sql` (no legacy_theme_id reference); `database/supabase/migrations/000_baseline.sql` (legacy_theme_id on theme_packages as nullable FK to themes(id)); no migration sets legacy_theme_id; `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:508` (ensureThemePackageRuntime upserts legacy_theme_id = theme.id at first gateway call); `schema-registry-execution.adapter.ts:617` (findPackageRuntime queries by OR(slug, legacy_theme_id)) | No | No seed or migration populates legacy_theme_id. The value is set lazily at runtime by `ensureThemePackageRuntime()`. However, `findPackageRuntime()` queries by `OR(slug, legacy_theme_id)`, so the slug match succeeds independently — the practical cross-reference risk is narrow, limited to marketplace-review flows run before any gateway theme resolution on a fresh DB. Doc correction applied to doc 09. |
| **OQ-15** | CONFIRMED | `packages/theme-engine/src/theme-bundle.ts:1054-1083` (current createLiquidParitySectionFiles product-detail: settings showGallery, showDescription, showReviews; body includes lb-variant-picker, lb-wishlist-toggle, rating display, review block loop, lb-review-form); `database/supabase/migrations/171_liquid_bundle_persistence.sql` (stored product-detail: settings showGallery+showDescription only; no lb-wishlist-toggle, no showReviews, no review blocks); `migrations/172_liquid_bundle_refresh.sql` (grep: lb-wishlist-toggle 0 matches; showReviews 0 matches; lb-variant-picker 1 match but in collection-product-list, NOT product-detail); `theme-bundle.ts:2473` (Urban Kicks standalone fixture calls createLiquidParitySectionFiles, so in-code fixture IS current) | No | Gap confirmed at the migration level. Migrations 171 and 172 have stale product-detail bundles missing 5 capabilities: showReviews setting, lb-variant-picker in product-detail, lb-wishlist-toggle, review loop, lb-review-form. A new bundle-refresh migration is required for stores seeded from migration 171 or 172. Doc corrections applied to docs 07 and 09. |
| **OQ-16** | CONFIRMED | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:10` (export const revalidate = 60); `apps/storefront-runtime/src/lib/store-service.ts:51` (STOREFRONT_REVALIDATE_SECONDS = 60); `store-service.ts:430-433` (cache tags: storefront:${subdomain} and storefront:${subdomain}:published); `store-service.ts:110` (getStoreById uses storefront:store:${storeId} tag); `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:290-296` (React-path cacheTags include store:${store.id}); `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts:126` (publish: no revalidateTag/revalidatePath call); `apps/merchant-control-plane/src/app/api/themes/publish/route.ts` (no cache invalidation) | No | Two distinct cache-tag namespaces confirmed. No on-demand cache invalidation triggered on theme publish in either merchant-control-plane or api-gateway. Post-publish staleness window: up to 60 seconds. |
| **OQ-17** | CONFIRMED | `packages/theme-engine/src/theme-bundle-core.ts:66-82` (createLetbuyyCoreLiquidThemeBundleFixture: JSON string-replace of 'urban-kicks'→'letbuyy-core' branding); `packages/theme-engine/src/theme-bundle.ts:1864` (base title: '{{ shop.name }} - Urban Kicks' → '{{ shop.name }} - LetBuyy Core'); `theme-bundle.ts:1867` (base body class → 'lb-theme lb-theme--letbuyy-core'); `theme-bundle.ts:1931` (header storeName default: 'Urban Kicks' → 'LetBuyy Core'); `theme-bundle.ts:1963` (footer storeName default: 'Urban Kicks' → 'LetBuyy Core'); `theme-bundle.ts:1994-2188` (section set: home, product, collection, search, cart pages); `theme-bundle-core.ts:79,81` (name override and Zod re-validation) | No | Fixture content fully reviewed. The fixture is a branding-only JSON transform of Urban Kicks. The `<title>` uses Liquid `{{ shop.name }}` (merchant-specific at render time). Body class is `lb-theme--letbuyy-core`. The storeName field defaults in header/footer are the literal string 'LetBuyy Core' — merchants will see this until they customize it in the editor. Section set is commerce-appropriate. Doc correction applied to doc 05. |
| **OQ-18** | CONFIRMED | `apps/storefront-runtime/src/lib/store-service.ts:592-605` (themeSettings construction: spreads DEFAULT_THEME_SETTINGS then themeSettingsRecord then explicit overrides for primaryColor, secondaryColor, accentColor, fontFamily, borderRadius — but NO explicit override for surfaceColor); `packages/theme-engine/src/index.ts:67` (ThemeSettings.surfaceColor: optional string); `index.ts:82` (DEFAULT_THEME_SETTINGS.surfaceColor = '#F9FAFB'); `packages/theme-engine/src/theme-presets.ts:42` (ExperienceTokensSchema: surfaceColor is Zod-required) | No | The spread order guarantees the default when surfaceColor is absent from themeSettingsRecord. The gap: no explicit `|| DEFAULT` fallback guard for surfaceColor (unlike primaryColor at line 600). A stored falsy surfaceColor (empty string, null coerced to string) would override the default without correction. Additionally, appearanceOverrides (lines 581-591) never maps any appearance-page color to surfaceColor. Doc correction applied to doc 11. |
| **OQ-19** | CONFIRMED | `packages/auth-core/src/customer-session.ts:61-103` (verifyCustomerSession: single secret string, no multi-key iteration); `packages/auth-core/src/index.ts:772-822` (verifyCustomerSessionToken: single secret, returns {accepted:false, status:'invalid_signature'} on HMAC fail); `index.ts:841-862` (createHostOnlyShopperIdentityProvider: single secret); `apps/storefront-runtime/src/lib/session.ts:33-43` (getSecret reads single CUSTOMER_SESSION_SECRET); `session.ts:74-86` (getSession catches and returns null on failure); `apps/storefront-runtime/src/lib/customer-drop.ts:92-93` (getStorefrontCustomerDrop returns null when session null); no multi-key / previous-secret array in packages/auth-core/src/ | No | Single secret only confirmed. On rotation, all existing HS256 session cookies become invalid. Graceful degradation: `getSession()` returns null → customer treated as anonymous. No automatic re-auth flow. Customer must re-authenticate manually. |
| **OQ-20** | REFUTED | `apps/storefront-runtime/src/lib/product-service.ts` (zero occurrences of PRODUCT_VARIANTS_RELATIONAL_READS); `services/api-gateway/src/routes/storefront.ts:429-430` (`productVariantRelationalReadsEnabled`: defaults to 'on'); `services/api-gateway/src/routes/storefront/public-routes.ts:834,845,981` (flag applied in product detail and collection product paths); `services/api-gateway/src/routes/products.ts:153-154` (same flag in merchant routes); `config/env/templates/worker.env.example:58` (PRODUCT_VARIANTS_RELATIONAL_READS=on) | No | Flag exists and is actively used in the api-gateway with a default of 'on'. Not present in storefront-runtime because the storefront calls the gateway via API client — the flag is applied server-side. No mismatch risk. Doc correction applied to doc 03. |
| **OQ-21** | PARTIAL | `apps/storefront-runtime/src/app/store/[subdomain]/collections/[slug]/page.tsx:102-108` (collection route populates sectionData with real collection metadata); `composition-engine.tsx:309-316` (collectLiquidCollectionMeta scans sectionData for .collection); `composition-engine.tsx:366-378` (buildLiquidCommerceContext: collection built when route.type==='collection' OR products.length>0); `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:66-106` (buildSectionDataPlan: no collection metadata fetch for non-collection routes); `types.ts:83` (SectionRenderData.collection optional {id, title, description?}) | No | The /collections/[slug] route IS fully implemented. However, collection metadata binding is absent for non-collection routes (home/shop/index) in `data-binding-engine.ts`. On those route types, the collection drop is null UNLESS products are present, in which case a synthetic {id:'all-products'} collection is produced. Doc correction applied to doc 03. |

---

### 3.3 Uncovered Claim Register (UC-series)

| ID | Verdict | Primary Evidence Paths | Runtime Checked | Verifier Notes |
|---|---|---|---|---|
| **UC-01** | PARTIAL | `packages/theme-engine/test/` (16 test files found); static `^test\b` count: theme-engine.test.ts=9, theme-bundle-core.test.ts=6, liquid-l2 through l13 series + experience-fonts.test.ts + theme-presets.test.ts — total 82 top-level test() calls; `packages/theme-engine/package.json:17` (test runner: `tsx --test test/*.test.ts`) | No | The '56/56 green' figure is stale. Static analysis yields 82 top-level test() calls across 16 test files. The increase is attributable to Phase 2 additions (liquid-l9 through l13 + experience-fonts + theme-presets.test.ts with 14 tests). Whether all 82 pass cannot be confirmed — runtime execution was blocked. Doc correction applied to doc 11. |
| **UC-02** | CONFIRMED | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:119` (liquidPage gate); `layout.tsx:218` (store-site branch: liquidPage→{children} only); `layout.tsx:244-265` (non-store-site branch: identical pattern) | No | Double-render fix confirmed in both branches. When `liquidPage` is true, the layout renders only `{children}`. The `StorefrontSectionGroupRenderer` calls for header and footer are inside the `!liquidPage` else branch only. Comment at line 117-119 explicitly documents this. |
| **UC-03** | REFUTED | `scripts/validators/no-new-react-sections-validator.mjs:9-40` (enumerates exactly 20 frozen React section paths; fails if any unlisted .tsx file appears); `scripts/validate-governance.mjs:113` (validator is in the main gate); `scripts/validators/theme-governance-validator.mjs:98-100` (checks validator enumerates exactly 20 frozen sections); `theme-governance-validator.mjs:69-71` (checks THEME_LIQUID_PORTABLE_SECTION_PARITY has exactly 20 entries) | No | ART-17 IS mechanically enforced via two complementary validators. The enforcement is allowlist-based (frozen 20-section set), not a SECTION_RENDERER_DEFINITIONS comparison, but it is a hard build gate. The claim "no build-time check was confirmed" is incorrect. Doc corrections applied to docs 11 and 06. |
| **UC-04** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:107-117` (LIQUID_HYDRATION_CUSTOM_ELEMENTS: 9 lb-* elements); `theme-renderer.ts:119-126` (ADD_TAGS: spread of all 9 lb-* elements plus 'iframe' and 'meta') | No | ADD_TAGS list is exactly as claimed. Doc correction applied to doc 07 (line citation `:119-134` → `:119-126`). |
| **UC-05** | CONFIRMED | `packages/theme-engine/src/portable-to-liquid.ts:43-53` (PORTABLE_TO_LIQUID_TYPE_OVERRIDES: no 'contentPage' entry; has 'richContent':'rich-content'); `portable-to-liquid.ts:62-69` (resolveLiquidSectionType: no override match → toKebabCase('contentPage')='content-page' → available.has('content-page')=false → available.has('contentPage')=false → returns null); `database/supabase/migrations/171_liquid_bundle_persistence.sql` (Urban Kicks bundle: 'rich-content' present, 'content-page' absent); `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:185-188` (React renderer maps contentPage/content-page/richContent/rich-content all to core.rich-content — no equivalent in portable-to-liquid.ts); `portable-to-liquid.ts:109-111` (null type → section skipped with warning) | No | Fully confirmed. A section with type 'contentPage' in a portable template is silently dropped when compiled to Liquid. Fix: add `contentPage:'rich-content'` to PORTABLE_TO_LIQUID_TYPE_OVERRIDES. |
| **UC-06** | CONFIRMED | `packages/theme-engine/src/theme-registry.ts:419-432` (SECTION_SCHEMAS declared as plain `export const`, no Object.freeze()); `packages/theme-engine/src/built-in-section-schemas.ts:328-330` (BUILT_IN_SECTION_SCHEMAS explicitly `Object.freeze()`d) | No | Confirmed exactly. SECTION_SCHEMAS is technically mutable; BUILT_IN_SECTION_SCHEMAS is genuinely immutable. A convention gap, not a currently exploited bug. |
| **UC-07** | PARTIAL | `packages/theme-engine/src/theme-registry.ts:242-243` (testimonials: `sample_blocks: [{ type:'testimonialCard', ... }]` — NO `blocks_schema` key); `packages/theme-engine/src/theme-bundle.ts:1152` (Liquid testimonials: block type 'testimonial' via liquidInlineBlock); `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:1875` ('Add block' UI hidden when `blocks_schema` absent — testimonials has none); `editor/page.tsx:483-486` (normalizeBlock uses `schema?.blocks_schema` for field defaults); `docs/storefront-liquid-discovery/09_THEME_SCHEMA_DISCOVERY.md:289` (doc incorrectly says "blocks_schema uses block type testimonialCard" — it is sample_blocks) | No | The block-type key divergence is real. However, the claim and doc 09 misidentify the schema location as `blocks_schema` when it is `sample_blocks`. No `blocks_schema` exists for testimonials at all, so the React editor hides the Add Block UI for this section entirely. The mismatch is between `sample_blocks` type (testimonialCard) and Liquid inline block type (testimonial), not between two `blocks_schema` implementations. Doc corrections applied to docs 07 and 12. |
| **UC-08** | CONFIRMED | `packages/theme-engine/src/theme-presets.ts:341-361` (NOVA: `industry: null`); `packages/theme-engine/src/industry-experience-map.ts:23-33` (INDUSTRY_EXPERIENCE_MAP: 9 entries, no 'nova'); `industry-experience-map.ts:36-60` (INDUSTRY_ALIASES: no d2c/versatile/nova synonym); `industry-experience-map.ts:110-124` (resolveExperienceForIndustry: no path reaches 'nova' unless passed as explicit override); `industry-experience-map.ts:143-148` (collectIndustryMapIssues excludes nova because industry:null); `apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx:53` (nova in picker list — reachable by manual selection only) | No | Fully confirmed. Nova is only reachable via manual selection in the ExperiencePicker or an explicit experienceId override. Cannot be auto-assigned at store creation. |
| **UC-09** | CONFIRMED | `packages/theme-engine/src/theme-presets.ts:431-444` (buildExperienceSettingsOverlay returns 10 design-token keys only — no section/layout keys); `theme-presets.ts:466-487` (applyExperienceToTemplateConfig merges token overlay only; spreads templateConfig preserving existing sections; never reads experience.defaultSections or layout.sectionOrder); `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:780-788` (client applyExperience: tokens only, no API call); `services/api-gateway/src/routes/stores.ts:673` (gateway calls applyExperienceToTemplateConfig at creation: token-only); `theme-presets.ts:103,143` (defaultSections defined but no exported function consumes it for restructuring) | No | Fully confirmed. `defaultSections` is stored in `layout.sectionOrder` but is never consumed by any apply path. Applying an experience changes only design tokens, not section layout. |
| **UC-10** | CONFIRMED | `apps/identity-platform/src/app/onboarding/page.tsx:1-11` (imports: no @letbuyy/theme-engine or industry-experience-map); `onboarding/page.tsx:201-215` (ONBOARDING_INDUSTRIES is a hardcoded `as const` array with 9 entries; comment at 201-203 acknowledges it is a client UI list only); `packages/theme-engine/src/industry-experience-map.ts:69-81` (INDUSTRY_OPTIONS: 9 entries, matching ids and labels); `onboarding/page.tsx:205-215` (ids and labels match INDUSTRY_OPTIONS currently — no import binding enforcing this) | No | Fully confirmed. ONBOARDING_INDUSTRIES is a standalone hardcoded array with no import from @letbuyy/theme-engine. The two arrays are in sync today but can diverge independently. No compile-time guarantee. |
| **UC-11** | PARTIAL | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:367-378` (`const collection = plan.route.type === 'collection' \|\| products.length > 0 ? {...} : null`); `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:7-21` (PRODUCT_SECTION_TYPES includes productGrid, featuredProducts, etc.); `data-binding-engine.ts:81-103` (buildSectionDataPlan populates SectionRenderData.products for matching sections); `composition-engine.tsx:309-315` (collectLiquidCollectionMeta returns null only if no section has .collection); `apps/storefront-runtime/src/lib/theme-engine/types.ts:5-22` (StorefrontRouteType: home=>'index') | No | The claim overstates the nil case. A synthetic collection (id='all-products', title='All Products') is emitted whenever products.length > 0 in sectionData on any route type. Collection-aware sections on the home page receive a synthetic all-products collection, not nil. The real gap is that collection metadata is not fetched for home/shop routes — `data-binding-engine.ts` has no code path for this. Doc corrections applied to docs 08, 11, and 12. |
| **UC-12** | CONFIRMED | `services/api-gateway/src/routes/themes.ts:316-1493` (full route listing — no apply-preset, applyExperience, or similar route); `services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts:176-617` (auxiliary routes — no apply-preset route); `packages/theme-engine/src/theme-presets.ts:453-487` (applyExperienceToSettingsData and applyExperienceToTemplateConfig exist as pure functions); `services/api-gateway/src/routes/stores.ts:7,658-673` (inline auto-apply at store creation only); `services/api-gateway/src/execution/theme-execution.adapter.ts:1035-1230` (saveDraft: no apply call); `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:776-788` (applyExperience: pure client-side, comment: "No page refresh, no new API"); grep across all services/**/*.ts: zero occurrences of 'apply-preset', 'applyPreset', or 'apply_preset' in route or adapter code | No | Fully confirmed. No standalone POST /v1/themes/:slug/apply-preset route exists. The editor applies experience purely client-side before the debounced draft PUT fires. |
| **UC-13** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:348` (parseLiquidThemePackageBundle called unconditionally in LiquidRenderer.render()); `packages/theme-engine/src/theme-bundle.ts:1321-1323` (parseLiquidThemePackageBundle calls LiquidThemePackageBundleSchema.parse — full Zod traversal, no memoization); `theme-renderer.ts:333-410` (LiquidRenderer.render: no memoization, WeakMap cache, or result store) | No | Core performance claim is accurate: full Zod parse on every render, no caching. The defect location cited in doc 08 (`template-resolver.ts:119-121`) is wrong — the actual call is `theme-renderer.ts:348`. Additional compound: `cache:false` means LiquidJS also re-parses every template string fresh per request. Doc corrections applied to docs 08 and 12. |
| **UC-14** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:599` (MAX_LIQUID_DROP_DEPTH = 4); `theme-renderer.ts:600` (MAX_LIQUID_DROP_KEYS = 80); `theme-renderer.ts:601` (MAX_LIQUID_DROP_ARRAY_ITEMS = 100); `theme-renderer.ts:644` (depth >= MAX return undefined — no warning); `theme-renderer.ts:648` (.slice(0, MAX_LIQUID_DROP_ARRAY_ITEMS) — silent); `theme-renderer.ts:656` (Object.entries(...).slice(0, MAX_LIQUID_DROP_KEYS) — silent); `theme-renderer.ts:640-663` (no console.warn, log call, or warnings.push in toLiquidDrop) | No | All three limits confirmed. Every truncation is silent (no log, no warning array entry). Combined with strictVariables:false (undefined renders as empty string), template authors cannot distinguish a legitimately absent field from a silently truncated one. |
| **UC-15** | CONFIRMED | `packages/theme-engine/src/theme-renderer.ts:602` (BLOCKED_DROP_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'password', 'password_hash', 'access_token', 'refresh_token', 'signing_secret', 'client_secret']) — 9 keys only; api_key, secret_key, private_key, webhook_secret absent); `theme-renderer.ts:657` (key filter regex `^[a-zA-Z][a-zA-Z0-9_]*$` — all four missing keys pass); grep confirms BLOCKED_DROP_KEYS defined exactly once, never augmented | No | Four keys confirmed absent from BLOCKED_DROP_KEYS. The regex guard does not block them. Doc correction applied to doc 01 (new LOW-risk row added). |
| **UC-16** | PARTIAL | `apps/storefront-runtime/src/lib/customer-drop.ts:107-124` (getCustomerOrderDetailDrop: fetches all orders, finds by orderId in memory); `customer-drop.ts:108-110` (JSDoc acknowledges "no direct order-by-id gateway endpoint"); `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts:1029-1035` (GET /customer/orders: `.limit(50)` hard-cap); `apps/storefront-runtime/src/lib/customer-service.ts:230-238` (getCustomerOrders calls api-client with no pagination params) | No | Pattern confirmed (list all, filter in memory). O(n) framing is misleading — gateway caps at 50 rows. The significant correctness risk (not in source docs) is that customers with >50 orders may have target order silently return null if it is older than the 50-row window. Doc corrections applied to docs 08, 11, and 12. |
| **UC-17** | CONFIRMED | `apps/storefront-runtime/src/proxy.ts:175` (`X-Lb-Render-Engine` set from THEME_LIQUID_RENDERING_DEFAULT_ENABLED env var); `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:241-245` (actual per-store decision via resolveThemeLiquidRenderingEnabled using templateConfig.rendererEngine); `packages/theme-engine/src/theme-governance.ts:154-160` (resolveThemeLiquidRenderingEnabled checks explicit rendererEngine='liquid' before canary checks); `database/supabase/migrations/180_urban_kicks_liquid_theme.sql:1-50` (sets rendererEngine='liquid' for Urban Kicks via themes table); `apps/storefront-runtime/src/lib/store-service.ts:684-686` (rendererEngine value never reaches proxy.ts) | No | The claim is exactly right. `proxy.ts` sets the header from the env var (THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false → value 'react'). A store on Urban Kicks renders Liquid but the header reports 'react'. The proxy header is a canary approximation only. Doc correction applied to doc 11 (R-22 severity: LOW → MEDIUM). |
| **UC-18** | PARTIAL | `database/supabase/migrations/000_baseline.sql:12618-12630` (theme_editor_drafts table exists); `000_baseline.sql:12637-12655` (theme_instance_drafts table exists); `000_baseline.sql:12805` (theme_preview_sessions.theme_instance_draft_id column exists); `000_baseline.sql:12813` (column comment: "Optional pointer to theme_instance_drafts ... Legacy draft_id remains during migration"); `services/api-gateway/src/execution/theme-execution.adapter.ts:927-1026` (editor-save path writes to theme_editor_drafts); `theme-execution.adapter.ts:427-529` (release-engine path writes to theme_instance_drafts); `theme-execution.adapter.ts:482` (compat bridge: writes patch to theme_draft_patches when saving theme_instance_drafts); `services/api-gateway/src/routes/storefront/public-routes.ts:475-522` (preview resolution: tries theme_instance_draft_id first, falls back to draft_id); `services/api-gateway/src/tenant/tenant-tables.registry.ts:2774,2786` (both tables active); `database/supabase/migrations/087_theme_template_drafts.sql:1-36` (expands theme_editor_drafts, not deprecating it) | No | Both tables exist as stated. The "no documented deprecation path" claim was accurate when discovery docs were written. However, the claim overstates ambiguity — the two tables serve distinct complementary flows and are bridged by a compat operation. The baseline column comment (line 12813) indicates direction but no deprecation migration has been authored. Doc corrections applied to docs 09, 10, and 11. |
| **UC-19** | PARTIAL | `services/api-gateway/wrangler.toml:248` (FEATURE_LIQUID="false" in [env.production.vars]); `wrangler.toml:41` (FEATURE_LIQUID="true" in default [vars]); `services/api-gateway/src/middleware/featureFlags.ts:4` ('FEATURE_LIQUID' is a member of GatewayFeatureFlag type); `services/api-gateway/src/index.ts:658-663` (only graphQLFeatureGate and extensionsFeatureGate instantiated; no liquidFeatureGate); `index.ts:227` (FEATURE_LIQUID?: string in Env type declaration only — no runtime consumption) | No | The claim is mostly correct. FEATURE_LIQUID IS declared infrastructure (type member + Env type). The flag is NOT wired to any `featureGate()` call — confirmed: only GRAPHQL and EXTENSIONS have featureGate instances. Any value for this flag is irrelevant today. The real Liquid canary is governed by `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` and per-store `rendererEngine`. Doc correction applied to doc 03 (scope of 'dormant' qualified to gateway layer). |
| **UC-20** | PARTIAL | `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:448-451` (resolveThemeRuntime reads theme_renderer_manifests); `schema-registry-execution.adapter.ts:391-398,584-598` (table also upserted during uploadThemePackageVersion and ensureThemePackageRuntime); `services/api-gateway/src/execution/theme-execution.adapter.ts:247,305,1100` (resolveThemeRuntime called during theme install/editor schema load/publish); `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:45-49` (render path calls resolveStorefrontTemplate — pure function, no DB query for theme_renderer_manifests); `apps/storefront-runtime/src/lib/store-service.ts:670-680` (liquidBundle at render time from templateConfig, not theme_renderer_manifests); `packages/theme-engine/src/theme-governance.ts:191-249` (auditThemeRendererRegistry pure in-memory — never queries DB); grep `apps/storefront-runtime/src/` for auditThemeRendererRegistry — returns nothing | No | The claim is true for the storefront render pipeline. It is incomplete by omitting that the api-gateway reads `theme_renderer_manifests` at publish/install time (adapter.ts:448) and bakes the resulting `approvedRendererKeys` into `theme_releases.release_manifest`. The table is not consulted per-render, but it is not "disconnected from the pipeline" in the full sense. Doc corrections applied to docs 10 and 11. |

---

## 4. Verdict Summary

| Verdict | Count | IDs |
|---|---|---|
| CONFIRMED | 34 | R-01, R-02, R-03, R-05, R-06, R-08, R-09, R-11, R-12, R-13, R-15, OQ-01, OQ-04, OQ-05, OQ-08, OQ-09, OQ-15, OQ-16, OQ-17, OQ-18, OQ-19, OQ-21 (partial, core confirmed), UC-02, UC-04, UC-05, UC-06, UC-08, UC-09, UC-10, UC-12, UC-13, UC-14, UC-15, UC-17 |
| PARTIAL | 14 | R-04, OQ-03, OQ-06, OQ-07, OQ-11, OQ-12, OQ-14, OQ-21, UC-01, UC-07, UC-11, UC-16, UC-18, UC-19, UC-20 |
| REFUTED | 7 | R-07, R-10, R-14, OQ-02, OQ-10, OQ-20, UC-03 |
| UNVERIFIABLE | 1 | OQ-13 |
| **Total** | **56** | |

> Note: OQ-21 is counted in both CONFIRMED and PARTIAL because the /collections/[slug] path is fully confirmed while the non-collection binding gap is partial. OQ-15 and UC-17 were inadvertently omitted from the prior CONFIRMED list (both have CONFIRMED verdict in section 3.2 and 3.3); the count is corrected from 32 to 34 (raw) and from 31 to 33 (effective after netting OQ-21 double-count). The effective distribution is 33 CONFIRMED, 14 PARTIAL, 7 REFUTED, 1 UNVERIFIABLE. (The ARCHITECTURE_CERTIFICATION sign-off block will be updated to match.)

---

## 5. Runtime Evidence

### 5.1 Commands Attempted

All four Phase B certification commands were BLOCKED for the verification subagents. The safety classifier that governs subprocess invocations was temporarily unavailable during this session, consistently rejecting `pnpm` and `node <script>` invocations while allowing read-only operations (ls, grep, Read tool, Bash with find/echo).

Each blocked command was attempted twice before being declared BLOCKED (per Phase B hard rule: no more than two attempts before recording an honest result).

### 5.1a Runtime Evidence Addendum (orchestrator, post-review, 2026-07-04)

After the subagent pass, the orchestrator successfully executed three of the four targets via the allowlisted `pnpm typecheck test --filter=<pkg>` turbo form. These results SUPERSEDE the BLOCKED verdicts in §5.2–§5.4 below (which are retained for audit honesty):

| Command (allowlisted form) | Result | Detail |
|---|---|---|
| `pnpm typecheck test --filter=@letbuyy/theme-engine` | **PASS** | 82/82 tests pass, 0 fail; typecheck task green (4/4 turbo tasks successful) |
| `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | **FAIL (1 pre-existing)** | 17/18 tests pass. Failing: test 16 "storefront resolver and composition engine render full Liquid documents with Liquid chrome" (`tests/theme-engine/storefront-liquid-runtime.test.mjs:36`) — a static source-contract regex expects `result.liquid.layoutHtml`, but `composition-engine.tsx` returns `{header, contentForLayout, footer}` since the render-result refactor. Verified pre-existing at committed HEAD (`git show HEAD:…composition-engine.tsx` also lacks `layoutHtml`; test last updated in a8a1bff0, source refactored by 742192cf lineage). Classification: STALE TEST EXPECTATION, not a product regression. Fix assigned to Phase C test gate. |
| `node scripts/validate-governance.mjs` (and `pnpm validate:governance`) | **STILL BLOCKED** | Classifier remained unavailable for non-allowlisted invocations at addendum time. To be re-attempted at each subsequent phase gate. |

---

### 5.2 Command Detail — pnpm --filter @letbuyy/theme-engine test

**Result:** BLOCKED

**Attempts:** 2  
**Reason:** Safety classifier rejected the `pnpm` executable in the subprocess environment.

**Static evidence gathered (in lieu of runtime):**

| Item | Value |
|---|---|
| Test files found | 16 (packages/theme-engine/test/*.test.ts) |
| Top-level test() calls (static grep `^test\b`) | 82 |
| Test runner (package.json:17) | `tsx --test test/*.test.ts` |
| Pre-built declaration files in dist/src/ | 13 modules (all source modules have corresponding .d.ts) — confirms tsc -b previously succeeded |
| Import-syntax errors in reviewed test files | None identified during file reads |

**Test file breakdown:**

| File | test() Count |
|---|---|
| theme-engine.test.ts | 9 |
| theme-bundle-core.test.ts | 6 |
| liquid-l2-assets.test.ts | 3 |
| liquid-l3-compiler.test.ts | 5 |
| liquid-l4-chrome.test.ts | 4 |
| liquid-l5-product.test.ts | 4 |
| liquid-l6-collection.test.ts | 4 |
| liquid-l7-search.test.ts | 4 |
| liquid-l8-cart.test.ts | 4 |
| liquid-l9-auth.test.ts | 4 |
| liquid-l10-account.test.ts | 4 |
| liquid-l11-orders.test.ts | 4 |
| liquid-l12-tracking.test.ts | 4 |
| liquid-l13-authoring.test.ts | 3 |
| experience-fonts.test.ts | 6 |
| theme-presets.test.ts | 14 |
| **Total** | **82** |

The count discrepancy from the registered "56/56" figure (UC-01) is explained by Phase 2 additions: liquid-l9 through l13 (5 new files × 3-4 tests each = 17 tests) and theme-presets.test.ts (14 tests) and experience-fonts.test.ts (6 tests), added after the 56-count was recorded.

**Certification assertion:** CANNOT CERTIFY pass/fail. Static evidence is consistent with a passing test suite (pre-built declarations, no syntax errors, prior tsc success) but this is not equivalent to a runtime confirmation.

---

### 5.3 Command Detail — pnpm --filter @letbuyy/theme-engine typecheck

**Result:** BLOCKED

**Attempts:** 2  
**Reason:** Safety classifier rejected the `pnpm` executable.

**Static evidence gathered:**

| Item | Value |
|---|---|
| tsconfig.json location | packages/theme-engine/tsconfig.json |
| Compiler flags | strict:true, composite:true, emitDeclarationOnly:true |
| typecheck script | `tsc --noEmit` (package.json:17) |
| Declaration files in dist/src/ | Confirmed for all 13 source modules: built-in-section-schemas, execution-runtime, experience-fonts, index, industry-experience-map, portable-to-liquid, theme-bundle-core, theme-bundle, theme-governance, theme-presets, theme-registry, theme-renderer |

The presence of .d.ts files in dist/src/ for all modules confirms that `tsc -b` completed successfully at some prior point. The `--noEmit` typecheck would re-run type checking without writing artifacts; its result cannot be inferred from static evidence alone.

**Certification assertion:** CANNOT CERTIFY pass/fail. Prior build artifacts are consistent with a clean typecheck but this is not a runtime confirmation.

---

### 5.4 Command Detail — pnpm --filter @letbuyy/storefront-runtime test

**Result:** BLOCKED

**Attempts:** 2  
**Reason:** Safety classifier rejected the `pnpm` executable.

**Static evidence gathered:**

The test script (apps/storefront-runtime/package.json:10) invokes:
```
cd ../.. && node --test tests/federation/web-app-contract-boundary.test.mjs tests/theme-engine/storefront-liquid-runtime.test.mjs tests/theme-engine/liquid-hydration-islands.test.mjs tests/localization/theme-localization.test.mjs
```

| File | test() Count | Nature |
|---|---|---|
| tests/federation/web-app-contract-boundary.test.mjs | 5 | Static analysis (readFileSync + assert.match) against source paths |
| tests/theme-engine/storefront-liquid-runtime.test.mjs | 5 | Static analysis of render pipeline source paths |
| tests/theme-engine/liquid-hydration-islands.test.mjs | 4 | Static analysis of hydration island source |
| tests/localization/theme-localization.test.mjs | 4 | Static analysis of localization source |
| **Total** | **18** | |

All 4 referenced test files verified to exist. All are static-analysis style tests that read source files with `readFileSync` and assert structural properties — they do not require a running server.

**Certification assertion:** CANNOT CERTIFY pass/fail. All source paths referenced by the tests have been verified to exist; the static-analysis nature of the tests reduces (but does not eliminate) the chance of runtime failure.

---

### 5.5 Command Detail — node scripts/validate-governance.mjs

**Result:** BLOCKED

**Attempts:** 2  
**Reason:** Safety classifier rejected `node <script>` invocations with the governance script.

**Static evidence gathered:**

| Item | Value |
|---|---|
| Script location | scripts/validate-governance.mjs |
| Gate array entry count | 109 validators (lines 16-123) |
| demotedValidators | Empty array (line 138) — no validators demoted |
| criticalGateValidators | 5 entries, all confirmed in main gate array |
| validators directory file count | 113 .mjs files in scripts/validators/ |
| All 109 gate validators present on disk | Confirmed by cross-referencing gate array against directory listing |
| Success output | "Governance gate lane passed (109 validators)." (exit 0) |
| Failure behavior | Exits non-zero immediately on first validator failure |

Relevant validators confirmed present and correct (read during evidence gathering):
- `no-new-react-sections-validator.mjs` — 20-section frozen allowlist (UC-03 evidence)
- `theme-governance-validator.mjs` — verifies parity count = 20 and migrateThemeTemplateSchemas is tested (OQ-12 evidence)
- `canonical-ledger-only-validator.mjs` — referenced in CLAUDE.md as the money-mutation guard
- `no-deprecated-runtime-validator.mjs` — enforces deprecated runtime policy from CLAUDE.md

**Certification assertion:** CANNOT CERTIFY the gate is currently green. Static inspection confirms all 109 validator scripts are present and the gate structure is intact. Whether any validator currently fails against the working tree (branch stepup/main with modified files per git status) cannot be determined without runtime execution.

---

## 6. Documentation Corrections Applied

The following corrections were applied to discovery documents during the Phase B audit pass. Each correction entry records: the document path, what was corrected, and which verdict finding drove the correction.

### 6.1 Correction Summary by Document

| Document | Items Applied | Items Skipped | Driving Verdicts |
|---|---|---|---|
| `01_REPOSITORY_DISCOVERY.md` | 2 | 0 | R-04 (PARTIAL), UC-15 (CONFIRMED) |
| `02_LIQUID_PLATFORM_DISCOVERY.md` | 2 | 0 | OQ-04 (CONFIRMED), OQ-08 (CONFIRMED) |
| `03_STOREFRONT_DISCOVERY.md` | 4 | 0 | OQ-06 (PARTIAL), UC-19 (PARTIAL), OQ-21 (PARTIAL), OQ-20 (REFUTED) |
| `04_REACT_DEPENDENCY_MAP.md` | 1 | 0 | R-14 (REFUTED) |
| `05_THEME_EDITOR_DISCOVERY.md` | 3 | 0 | OQ-02 (REFUTED), OQ-17 (CONFIRMED), R-10 (REFUTED) |
| `06_PRESET_LIBRARY_DISCOVERY.md` | 1 | 0 | UC-03 (REFUTED) |
| `07_RENDER_PIPELINE_DISCOVERY.md` | 2 | 0 | UC-04 (CONFIRMED), OQ-15 (CONFIRMED) |
| `08_DYNAMIC_SOURCE_DISCOVERY.md` | 5 | 0 | UC-13 (CONFIRMED), R-13 (CONFIRMED), UC-11 (PARTIAL), UC-16 (PARTIAL), R-15 (CONFIRMED) |
| `09_THEME_SCHEMA_DISCOVERY.md` | 5 | 1 | OQ-15 (CONFIRMED), OQ-03 (PARTIAL), OQ-12 (PARTIAL), OQ-14 (PARTIAL), UC-07 (PARTIAL), UC-18 (PARTIAL) |
| `10_ASSET_PIPELINE_DISCOVERY.md` | 3 | 0 | R-05 (CONFIRMED), UC-20 (PARTIAL), UC-18 (PARTIAL) |
| `11_GAP_ANALYSIS.md` | 22 | 0 | R-04, OQ-02, OQ-05, OQ-06, UC-01, R-07, OQ-07, OQ-08, UC-17, UC-20, R-08, OQ-11, OQ-18, R-10, UC-11, UC-16, OQ-01, OQ-04, OQ-03, UC-03, UC-18 |
| `12_MASTER_LIQUID_MIGRATION_PLAN.md` | 20 | 0 | R-03/R-04, OQ-02, OQ-05, OQ-06, OQ-10, UC-13, R-07, OQ-01, OQ-04, OQ-11, R-09/R-10, UC-11, UC-16, OQ-03, OQ-12, UC-07, multiple items |

**Total corrections applied: 70 across 12 documents**  
**Total items skipped: 1** (doc 09, UC-18 partial inaccuracy in instruction — the instruction described the wrong column; applied with the factually correct column reference instead)

### 6.2 Material Corrections by Severity

**REFUTED claims corrected (highest priority):**

| Document | Claim Corrected | Verdict |
|---|---|---|
| 05, 11, 12 | R-10: postMessage section-selection highlighting broken (C-04 OPEN) | REFUTED — StorefrontPreviewBridge bridges the key mismatch at runtime; C-04 CLOSED |
| 11, 12 | R-07: POST /storefront/customer/register does not exist (LB-12 open) | REFUTED — endpoint implemented in commit a391c1f4; LB-12 CLOSED |
| 04 | R-14: missing INTERNAL_API_SECRET causes unauthorized gateway requests | REFUTED — no gateway request is made when secret absent; store access enforcement bypassed instead |
| 05, 11, 12 | OQ-02: --font-playfair may be undefined | REFUTED — variable IS defined in globals.css:25 |
| 12 | OQ-10: Promise.all parallelism needs re-entrancy verification | REFUTED — LiquidJS v10.27.0 is re-entrant per-call; safe to parallelize |
| 03 | OQ-20: PRODUCT_VARIANTS_RELATIONAL_READS not found in storefront | REFUTED — flag is in gateway (default 'on'); storefront calls gateway via API client |
| 11, 06 | UC-03: ART-17 not mechanically enforced | REFUTED — no-new-react-sections-validator.mjs is a hard gate in validate-governance.mjs |

**PARTIAL claims corrected (risk scope adjusted):**

| Document | Claim Corrected | Key Adjustment |
|---|---|---|
| 01, 11, 12 | R-04: newsletter/newsletter-signup silent failure | Mitigated by PORTABLE_TO_LIQUID_TYPE_OVERRIDES; reclassified HIGH→MEDIUM |
| 09, 11, 12 | OQ-03: section_schemas remains {} | Wrong on seed-applied DBs; seed inserts 6 lightweight stubs |
| 03, 11, 12 | OQ-06: ALLOW_ARIA_ATTR gap is broad | Narrow: only hypothetical custom elements outside the tagNameCheck regex |
| 09, 12 | OQ-12: migrateThemeTemplateSchemas has no call site | It IS called in theme-engine.test.ts; gap is gateway publish path only |
| 08, 11, 12 | UC-11: collection drop is null on home pages | Synthetic all-products collection emitted when products.length>0 |
| 08, 11, 12 | UC-16: O(n) over full order history | Gateway caps at 50 rows; real risk is orders older than position 50 |
| 09, 10, 11 | UC-18: two draft tables — no documented deprecation path | Tables serve distinct flows; role split now documented; compat bridge confirmed |

---

## 7. Key Audit Findings Not Previously Documented

The following findings emerged during verification but were not present in any of the 12 discovery documents. They are recorded here as net-new audit output.

### 7.1 Liquid hero-banner has an extra 'eyebrow' field absent from React schema

- **Evidence:** `packages/theme-engine/src/theme-bundle.ts:1013-1017` — Liquid hero-banner settings include `eyebrow: {type:'text', default:'New season essentials'}` with no corresponding React heroBanner schema entry
- **Risk:** A forward-compatibility gap if React section is later updated to match; also means the Liquid hero-banner has a field that cannot be set from the existing React editor UI
- **Severity:** LOW
- **Correction applied:** Doc 10 (T-6) updated to record the extra field

### 7.2 Gateway hard-caps customer order history at 50 rows

- **Evidence:** `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts:1035` — `.limit(50)` on the customer orders query
- **Risk:** Customers with more than 50 orders will silently get a null result from `getCustomerOrderDetailDrop()` for orders older than the 50-row window. The discovery docs described the risk as "O(n) over full order history" which is misleading; the real risk is data completeness for prolific customers
- **Severity:** MEDIUM
- **Correction applied:** Docs 08, 11, and 12 updated

### 7.3 BLOCKED_DROP_KEYS missing four common secret key patterns

- **Evidence:** `packages/theme-engine/src/theme-renderer.ts:602` — BLOCKED_DROP_KEYS has 9 entries; api_key, secret_key, private_key, and webhook_secret are absent
- **Risk:** Objects containing these keys passed to the Liquid scope via toLiquidDrop() would not be filtered
- **Severity:** LOW (no current code path passes such objects; risk is latent)
- **Correction applied:** Doc 01 (new LOW-risk row added in §10 risk table)

### 7.4 readBooleanDecision recurses into object-typed candidates

- **Evidence:** `packages/theme-engine/src/theme-governance.ts:125-142` — checks nested keys 'enabled', 'liquid_enabled', 'liquidEnabled', 'canary', 'value' within object-typed candidates, broadening the R-15 accidental canary activation surface beyond the 11 literal candidates array entries
- **Risk:** Any object in templateConfig or releaseManifest with a nested 'canary', 'enabled', or 'value' key set to a truthy value could trigger Liquid rendering
- **Severity:** HIGH (same risk class as R-15)
- **Correction applied:** Doc 08 (accidental canary activation section) updated

### 7.5 Stale BLOCKED comment in liquid-l9-auth.test.ts

- **Evidence:** `packages/theme-engine/test/liquid-l9-auth.test.ts:2-3` — comment reads "BLOCKED on LB-12 (POST /storefront/customer/register does not yet exist)" — this was stale as of commit a391c1f4
- **Risk:** Misleads developers about the current state of LB-12
- **Severity:** LOW (informational)
- **Correction note:** Recorded in the R-07 REFUTED evidence; not a source-code correction (comment cleanup only, outside the scope of this certification author's file writes)

### 7.6 Synthetic 'all-products' collection on home pages is a backward-compatibility surface

- **Evidence:** `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:367` — the synthetic collection (id='all-products', handle='all-products') is emitted when products.length>0, regardless of route type
- **Risk:** Liquid templates that check `{{ collection.id }}` or `{{ collection.handle }}` on the home page will receive 'all-products' — a synthetic value, not a real DB-backed collection. Any template logic branching on `collection.id == 'all-products'` can distinguish, but templates that use `collection.handle` without this guard may render unexpected output
- **Severity:** LOW-MEDIUM
- **Correction applied:** Docs 08, 11, and 12 updated to clarify the synthetic fallback

---

## 8. Items That Remain UNVERIFIABLE

### OQ-13 — How many production stores currently render Liquid

**Why unverifiable:** Requires a live Supabase query against the production `sites` table to count rows where `template_config` contains `rendererEngine='liquid'` or any of the 11 canary key aliases.

**What the repo can confirm:**
- The 11 canary paths in `resolveThemeLiquidRenderingEnabled` (theme-governance.ts:163-173) are structural facts
- THEME_LIQUID_RENDERING_DEFAULT_ENABLED is false (theme-governance.ts:14)
- Migration 180 sets `rendererEngine='liquid'` in themes.default_template for 'urban-kicks', but this value reaches stores only via published releases (not via the themes table join, which is absent from the gateway storefront query)
- No migration hard-sets `liquidRenderingCanary=true` in `sites.template_config`

**Recommended query** (requires Supabase service-role access):
```sql
SELECT count(*) 
FROM sites 
WHERE 
  template_config->>'rendererEngine' = 'liquid'
  OR template_config->'liquidRenderingCanary' IS NOT NULL;
```

---

## 9. Certification Confidence Assessment

| Dimension | Assessment | Basis |
|---|---|---|
| Evidence completeness | HIGH | All 56 registered items were investigated with Read tool; cross-references verified against adjacent files, migrations, tests, and LiquidJS source |
| Documentation accuracy (post-correction) | HIGH | 70 corrections applied; 7 REFUTED claims corrected; 14 PARTIAL claims scoped accurately |
| Runtime verification | NOT PERFORMED | All 4 runtime commands blocked; static evidence gathered as substitute; honestly reported as BLOCKED |
| Net-new findings coverage | HIGH | 6 previously undocumented findings recorded (§7) |
| Unverifiable items | MINIMAL | 1 item (OQ-13) genuinely requires live DB access; all other open questions answered from static analysis |
| Discovery document accuracy (pre-correction) | MODERATE | 7 outright REFUTED claims existed; 14 PARTIAL claims with material scope errors — this is normal for a fast-moving codebase audited incrementally over multiple phases |

---

## 10. Attestation

This evidence report was produced by automated static analysis using the Read tool against the repository at branch `stepup/main` as of 2026-07-04. No fabricated evidence, assumed values, or extrapolated results are present. All verdicts are grounded in exact file path and line-number citations. Where evidence was insufficient for a verdict (OQ-13), the item is marked UNVERIFIABLE with an explicit explanation of what additional data would be required.

All 70 documentation corrections described in §6 were applied to the discovery documents in this session prior to writing this report. The corrections do not alter any deterministic validator outcome; they correct human-authored narrative in the discovery corpus to align with the code as it exists at the time of this audit.

---

*End of Evidence Report*
