# Target Theme Architecture — LetBuyy Liquid-First Commerce Platform

**Date:** 2026-06-18
**Status:** Research synthesis — design document only, no code changes
**Sources:** Research phases 01–08, `packages/theme-engine/src/`, `apps/storefront-runtime/src/lib/theme-engine/`, `services/api-gateway/src/routes/themes.ts`

---

## Executive Overview

LetBuyy's storefront rendering is at an inflection point. The Liquid canary has proven itself structurally sound — a full `LiquidThemePackageBundle` is validated, Urban Kicks covers 74% of all route types with 100% Liquid section coverage, nine hydration islands handle every interactive commerce pattern, and the security model (DOMPurify + LiquidJS `outputEscape:'escape'` + Zod ingestion guards) is production-hardened. The question is no longer whether Liquid can work; the infrastructure proves it can. The question is how to make Liquid the default and React the deliberate exception.

The target architecture draws a clean line: the storefront serving customers is Liquid. The merchant editor, the checkout payment form (Razorpay SDK), and the COD order-creation wizard are React — permanently, by contract. This is not an arbitrary boundary; checkout cannot be Liquid because the Razorpay SDK requires an imperative JavaScript callback chain that has no Liquid equivalent, and idempotency keys must persist across re-renders via `useRef`. Every other storefront route is either already Liquid-capable or can reach full Liquid coverage with focused island and template work totaling roughly 4–5 engineering weeks of net effort.

The adaptive theme system gives the target architecture its long-run business value. A single core Liquid bundle (`Urban Kicks` or a successor) with a multi-layer preset model — base code → industry preset → merchant customization → per-customer segment override — lets LetBuyy serve electronics, fashion, grocery, furniture, jewelry, and dairy merchants from the same validated, secured codebase. The `settings_data.presets` contract already exists in the Zod schema; the missing pieces are the preset-application action in the merchant control plane and the industry-specific section schemas for the first three verticals (grocery, fashion, electronics). The theme marketplace remains frozen per ARB governance until a formal reopen decision is taken; the path to production-ready themes runs through the merchant control plane editor, not the marketplace, for the near-term phases.

The Central Intelligence System (LCIS) is both an observer and an enabler of this architecture. LCIS already maps every route → render plan → section → island dependency. As the platform moves toward Liquid-first defaults, LCIS can surface theme performance analytics, A/B experiment results, and per-merchant rendering telemetry through the existing `/api/telemetry` adapter without any theme-engine changes. The MCP integration point — AI-assisted section content generation and adaptive preset selection — is the natural Phase D surface once the core Liquid infrastructure is locked.

The governance gate is clear: `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` and `authority: 'ARB'`. No code change flips the platform-wide default to Liquid without ARB approval. Phases B and C advance the technical foundation — completing template coverage, building the remaining islands, validating render parity — so that when the ARB reviews the flip decision, the evidence package (render parity, SSTI/XSS gate, performance data) is complete and persuasive. Phase D, which includes the platform-wide flip and full adaptive theme system, is the ARB-gated milestone.

---

## Current State Summary

The following is a consolidated assessment from all eight research phases.

### Rendering Infrastructure

- **Dual engine:** `'json-contract'` (React, default, stable) and `'liquid'` (canary, opt-in per store). Governed by `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` in `packages/theme-engine/src/theme-governance.ts`.
- **Per-request activation:** A store activates Liquid by having `templateConfig.rendererEngine === 'liquid'` or `releaseManifest.renderer_engine === 'liquid'` set — populated by `buildReleaseArtifacts()` when a `liquidBundle` is present.
- **ARB gate:** `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`. No platform-wide flip without ARB approval.

### Coverage Numbers (as of Phase A completion)

| Axis | Current | Gap |
|------|---------|-----|
| Route types with Liquid template (Urban Kicks) | 14 of 17 non-layout route types (74%) | `page`, `blog`, `article`, `password`, `not_found` |
| Sections with Liquid source | ~35 / ~35 (100% of Liquid bundle sections) | 0 — all bundle sections have inline Liquid |
| Hydration islands implemented | 9 / 9 (100%) | 0 — all registered |
| Routes that are React-only (no Liquid path) | 3 (`/checkout`, `/checkout/success`, `/orders`) | `/checkout` must stay React permanently |
| Hybrid routes with Liquid + React fallback | 18 | All 18 could be Liquid-primary once canary flip lands |

### Theme Editing

- Full schema-driven WYSIWYG editor in merchant-control-plane; draft/publish/rollback lifecycle complete.
- Preview iframe uses the storefront-runtime `/preview` route; preview token is SHA-256 hashed, TTL 900s.
- Liquid preview is architecturally possible but `EditorPreviewSectionFrame` (section click-to-select) is not yet wired for the Liquid render path. A small client-side bridge script is the only missing piece.

### Theme Marketplace

- Fully implemented source code; frozen by ARB at `deploymentAuthority.platform = 'frozen-not-deployed'`.
- All purchase, install, review, developer listing, and rollback workflows are code-complete.
- Requires ARB reopen + 9 production readiness items (env config, catalog seeding, storage provider, developer listing promotion pipeline, Lighthouse measurement job) before live deployment.

### Adaptive Theme System

- `settings_data.presets` contract exists in `LiquidThemePackageBundleSchema`.
- `color_presets[]`, `industry[]`, and `theme_preset_id` fields exist in the marketplace `Theme` type.
- No preset-application action in the merchant control plane yet.
- No industry-specific section schemas implemented yet.
- Urban Kicks has 3 of 8 possible CSS token slots populated; 5 fall back to hardcoded values.

### Security and Governance

- 107-validator gate authoritative; heuristic findings are candidates only.
- DOMPurify + `outputEscape:'escape'` dual-layer sanitization.
- Liquid source schema forbids `<script`, `{% render %}`, `{% include %}`, `{% layout %}` at ingestion.
- ART-17 freezes new React-per-section on frozen surfaces; new sections must be Liquid.
- Money mutations must use `SECURITY DEFINER` RPCs; theme rendering never touches money tables.

---

## Target State Vision

### Storefront Runtime (Future)

The storefront-runtime serves customer-facing pages. In the target state, Liquid is the default for all content routes; React is a deliberate, documented exception limited to the payment flow.

**Default rendering becomes Liquid.** When `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` is approved by ARB, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` flips to `true`. Every store with a `liquidBundle` in its `template_config` (which is every store that has had a theme published post-Phase B) renders Liquid by default. Stores without a `liquidBundle` continue on React until they publish a theme update.

**Checkout and payment remain React permanently.** The `/checkout` route never calls `resolveStorefrontTemplate`. `CheckoutClient` is a React client component driven by:
- Razorpay SDK imperative callback (`new window.Razorpay(options).open()`)
- `useRef` idempotency key generation (`crypto.randomUUID()` persisted across re-renders)
- Multi-step wizard state (`useState` for Address → Payment transition)
- Real-time shipping rate fetch against browser cart total
- COD order creation with in-flow success screen

None of these patterns have a Liquid equivalent. This is the correct and permanent boundary.

**The React fallback path shrinks to:** checkout, checkout/success (redirect stub), the legacy `/orders` page, and the merchant admin UI.

**Architecture change from current to target:**

| Concern | Current | Target |
|---------|---------|--------|
| Storefront default engine | React (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) | Liquid (ARB flip required) |
| Stores without Liquid bundle | React | React (unchanged until they publish a Liquid theme) |
| Checkout | React (permanent) | React (permanent, explicit carve-out) |
| Cart page | Hybrid | Liquid + `lb-cart` island (full CRUD) |
| Product detail | Hybrid | Liquid + `lb-variant-selector` + `lb-add-to-cart` |
| Policy/blog/CMS pages | Hybrid | Liquid (`page` + `article` templates added to bundle) |
| Account pages | Hybrid (done for settings/wishlist/addresses/order) | Liquid (Phase A complete) |
| Search | Hybrid | Liquid (template exists in Urban Kicks bundle) |

### Theme Engine (Future)

**Enhanced `LiquidCommerceDrops`.** New drop types needed to support the full storefront:

| Drop | Purpose | Phase |
|------|---------|-------|
| `page.title`, `page.body_html`, `page.slug` | Generic CMS pages (`page` route type) | B |
| `article.title`, `article.content`, `article.author`, `article.published_at` | Blog posts (`article` route type) | B |
| `blog.articles[]` | Blog index listing | C |
| `search.query`, `search.results[]` | Search results (already partially in drops) | B |
| Customer segment tag injection via `liquidContext.settings` | Adaptive personalization | D |

**New section types needed** (across adaptive theme phases):

| Section | Vertical | Effort |
|---------|----------|--------|
| `page-content` | All (CMS pages) | Low — mirrors `policy-content` |
| `article-content` | All (blog) | Low |
| `not-found` | All | Low |
| `password-gate` | All | Medium (requires proxy middleware support) |
| `product-specs` | Electronics | Medium |
| `comparison-table` | Electronics | Medium |
| `lookbook` | Fashion | Medium |
| `size-guide` | Fashion | Low |
| `nutrition-table` | Grocery/Food | Low |
| `bundle-deals` | Grocery | Low |
| `product-freshness` | Grocery/Dairy | Low |
| `dimensions-panel` | Furniture | Low |
| `material-options` | Furniture | Low |
| `customization-panel` | Jewelry | Medium |
| `certification-block` | Jewelry | Low |

**New island types needed:**

| Island | Purpose | Phase |
|--------|---------|-------|
| `lb-variant-selector` | Product variant selection with reactive price/stock update | C |
| `lb-newsletter-signup` | Newsletter form POST with feedback | C |
| `lb-password-toggle` | Settings password show/hide toggle | C |
| `lb-delivery-estimate` | Pincode-based delivery ETA (Furniture/Grocery) | D |

**Snippet library.** The current Liquid engine forbids `{% render %}` and `{% include %}` to prevent SSTI. A future snippet library would work differently: snippets are compiled into section source at bundle-build time by the portable-to-liquid compiler (`portable-to-liquid.ts`), not at render time. This means reusable patterns (product card markup, price formatting, trust badge HTML) are inlined rather than `{% render %}`-included. The compiler already does this via `createLiquidParitySectionFiles()`; formalizing it as a named "snippet library" is a documentation and tooling concern, not a runtime change.

**CSS token map expansion.** Urban Kicks populates 3 of 8 token slots. The target state populates all 8:

| Token | Setting Key | Status |
|-------|-------------|--------|
| `--primary` | `primaryColor` | Done |
| `--secondary` | `secondaryColor` | Missing in Urban Kicks |
| `--accent` | `accentColor` | Done |
| `--surface` | `surfaceColor` | Done |
| `--background` | `backgroundColor` | Missing |
| `--foreground` | `textColor` | Missing |
| `--font-body` | `bodyFontFamily` | Done (typography group) |
| `--font-display` | `headingFontFamily` | Done (typography group) |

### Theme Marketplace (Future)

The marketplace is frozen by ARB decision (`deploymentAuthority.platform = 'frozen-not-deployed'`). No changes to its deployment status can be made without an ARB reopen trigger. The source code is complete; what is missing is operational readiness.

**What needs to change from the frozen state before go-live:**
1. ARB formal reopen decision — prerequisite for everything else.
2. Vercel deployment target provisioned with correct env vars: `LETBUYY_API_URL`, `INTERNAL_API_SECRET`, `LETBUYY_MERCHANT_SESSION_COOKIE`, `THEME_MARKETPLACE_GSTIN`, Razorpay live keys.
3. `themes` table seeded with at least the Urban Kicks entry (so the catalog page shows results).
4. R2/S3 storage provider wired to `theme_download_artifacts` for signed download URLs.
5. Developer listing → `themes` table promotion pipeline (moderation queue + approval action).
6. Lighthouse measurement job populating `performance_report` and `accessibility_report`.
7. Razorpay Route or UPI payout for developer revenue share (15%).
8. Live seller GSTIN in env (`THEME_MARKETPLACE_GSTIN`) for receipt generation.

**Theme distribution mechanism (current, works without marketplace).** The merchant-control-plane install flow (`POST /api/themes/install`) accepts either a `themeSlug` (from the catalog) or a raw `bundle` (JSON upload). For the near-term phases, merchants access themes through the merchant control plane editor, not the standalone marketplace app. The marketplace is additive, not gating.

**`ThemeLiquidBundleSchema` evolution.** The `LiquidThemePackageBundleSchema` schema version is `2026-06-liquid-sections`. Future versions will add:
- Industry preset definitions in `config.settings_data.presets` (keyed by `electronics`, `fashion`, `grocery`, `furniture`, `jewelry`)
- New section and block types for each vertical
- Expanded `config.settings_schema` field types: `font` (constrained select), `color-group` (named palette switch), `measurement-unit` (cm/in/mm select)
- Schema version will bump to `2026-xx-liquid-sections-v2` when any breaking change occurs; the adapter's `migrateThemeTemplateSchemas()` handles migration with up to 20 hops per section

**Versioning and update mechanism.** The current model is semantic version strings on `themes.version` with `version_installed` on `store_themes`. Update detection compares strings; rollback targets a specific `release_id`. No version constraint system exists (installs are not pinned to a SemVer range). This is acceptable for a single-first-party-theme environment; multi-developer marketplace would require constraint resolution.

### Theme Editor (Future)

**Editor shell remains React permanently.** The following components stay React by contract:
- `CenterPanel.tsx` — cross-origin `postMessage` iframe manager (merchant-control-plane, not storefront)
- `SchemaFormRenderer.tsx` — form widget library with `useState`, file upload, `@letbuyy/ui` components
- `ThemeEditorInner` — left sidebar (SectionTree, ThemeSettingsTree, VersionTree), PublishBar, undo/redo machine
- `EditorPreviewSectionFrame.tsx` — React path only; Liquid path uses a JS bridge

**Preview becomes fully Liquid.** The editor preview iframe already resolves the preview token server-side and passes draft config to the render plan; this works for both engines. The missing piece is the client-side editor bridge for Liquid-rendered sections:

1. A small `<script>` injected into the preview page when `editorMode=true` and `renderer_engine='liquid'`.
2. The script finds all `[data-section-id]` elements in the Liquid HTML.
3. It attaches click handlers posting `letbuyy:theme-editor:section-select` to `window.parent`.
4. It listens for `LETBUYY_THEME_EDITOR_SELECTION` from the editor and applies a highlight CSS class.
5. Each Liquid section template must emit a wrapping `<div data-section-id="{{ section.id }}" data-renderer-key="{{ section.renderer_key }}">`.

The `release_manifest.liquid_ready` flag (set by `buildReleaseArtifacts()` when `liquidBundle` is present) can gate automatic Liquid preview mode in the editor once the bridge is in place.

**Live editing workflow (target):**
1. Merchant opens editor → draft is loaded (or created from current release).
2. Preview session token is created (SHA-256 hash stored, raw token sent once).
3. Preview iframe loads `/preview?theme_preview_token=<token>&editor=1` — storefront-runtime resolves token to draft config, renders Liquid output.
4. Merchant clicks a section in the iframe → bridge script posts `section-select` → editor sidebar highlights and opens that section's schema form.
5. Merchant changes a setting → `applyChange()` updates `editorState` → 900ms debounce → `syncPreviewDraft()` → new preview session token → iframe remounts with updated draft.
6. Merchant publishes → `PUT /:slug/editor` → gateway validates, calls `publish_theme_release` RPC → `purgeThemeStorefrontCache()`.

**Schema-driven customization improvements.** Near-term additions to `SchemaFormRenderer`:
- `font` field type (constrained `<select>` with safe font names)
- `color-group` field type (named palette radio selector)
- `gallery` field type (array of image URLs via block pattern)
- Rollback button in `VersionTree` panel (API is complete; UI wiring missing)

### Adaptive Theme System (Future)

**Core engine + industry presets.** The single-core-theme + multiple-presets model is the right architecture:
- One `LiquidThemePackageBundle` (Urban Kicks or a named successor) contains all section types.
- `config.settings_data.presets` holds named preset configurations keyed by industry.
- Merchants select their industry during onboarding or from the editor's "Apply preset" action.
- The preset is copied into `settings_data.current` as the merchant's starting point.

**Preset inheritance model (four layers):**

```
Layer 1: Base theme code (sections, blocks, Liquid source files, section schemas)
            ↓ merged by
Layer 2: Industry preset (settings_data.presets['electronics'])
            ↓ overridden by
Layer 3: Merchant customization (settings_data.current — stored in DB)
            ↓ optionally overridden at request time by
Layer 4: Customer segment injection (liquidContext.settings — runtime middleware, Phase D)
```

Layers 1–2 are bundle-time. Layer 3 is stored in `theme_editor_drafts` / `theme_releases`. Layer 4 is request-time via `buildLiquidCommerceContext` injecting a segment-keyed settings override before the render call.

**Merchant customization layer.** This is fully implemented today: `settings_data.current` is the merchant's active value set, stored in the release config and loaded at render time by `buildLiquidScope`. The editor writes to this via the draft/publish pipeline.

**AI-assisted personalization (Phase D).** The hook already exists: `buildLiquidScope` merges `input.liquidContext?.settings` on top of `bundle.config.settings_data.current`. A request middleware layer can inject customer-segment-specific token overrides (different color palette for returning buyers, different hero copy for first-visit users) without any renderer changes. The segment keying lives in `settings_data.presets['segment:returning-buyer']` using the existing `.passthrough()` on `ThemeBundleSettingsDataSchema`.

### LCIS Integration

The LCIS intelligence layer can inform theme decisions without any theme-engine changes:

- **Theme performance analytics:** Every Liquid render emits a `lb:canary:render` structured event with `{ engine, subdomain, template, route_type, latency_ms, editor_mode }`. The LCIS telemetry adapter (`/api/telemetry`) maps this emission point to the Analytics Engine receiver. Latency per template, render failures by route type, and Liquid-vs-React split ratios are available once the adapter is wired.
- **A/B testing support:** The `liquidContext.settings` injection point in `buildLiquidCommerceContext` supports A/B variants. LCIS can track experiment assignment via customer segment metadata. No renderer change needed; the split is controlled by the middleware that populates `liquidContext`.
- **Theme blast radius.** Before any change to `LiquidCommerceDrops` or section schemas, `pnpm graph:intel blast "LiquidCommerceDrops"` gives the full impact surface. The current blast radius hotspots for the theme system are: `buildLiquidCommerceContext` (called by every Liquid render), `LiquidHydrationIslands` (mounted on every Liquid page), `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` (security boundary).
- **Per-domain theme health.** `/api/live-health?domain=storefront` surfaces Liquid render status once a live telemetry adapter is connected.

### MCP Integration Opportunities

- **Theme section content generation.** An AI agent with access to a merchant's product catalog drop (`shop`, `product`, `collection`) can generate section content (hero heading, announcement bar text, featured product selection) and POST it as a draft via `PUT /:slug/editor/draft`. The `SchemaFormRenderer` schema provides the exact field structure needed for the generation prompt.
- **Product catalog → section auto-population.** On first theme install, the `installTheme()` adapter already calls `publishReleaseSnapshot()`. An AI post-install hook could call `saveDraft()` with auto-generated section content derived from the merchant's existing products and store name, giving them a personalized starting point instead of the generic Urban Kicks defaults.
- **Adaptive preset selection.** During merchant onboarding, an AI agent can ask 3–5 questions about the store type and product category, then select the matching industry preset and apply it via the "apply preset" action in the merchant control plane. This is a Phase D integration once the preset activation logic is in place.
- **Section content refresh.** Merchants can invoke an AI command from the editor sidebar to regenerate copy for a selected section using live product data. This requires an editor sidebar addition (a "Generate" button in the `PropertyPanel`) that calls a new `POST /api/themes/:slug/ai-generate-section` gateway route (to be built in Phase D).

---

## Architecture Diagrams

### Current Architecture

```
[Customer Request]
        |
        v
[proxy.ts middleware]  ←  host routing, preview token cookie, password gate, 301 redirects
        |
        v
[storefront-runtime Next.js page]
        |
        v
[resolveStorefrontTemplate()]
        |
        +--- liquidEnabled? ──YES──→ [resolveLiquidBundle(store)]
        |                                    |
        |                          liquidBundle found?
        |                                    |
        |                          YES → return StorefrontRenderPlan {
        |                                   rendererEngine: 'liquid',
        |                                   liquidBundle,
        |                                   liquidTemplateKey
        |                                }
        |
        +--- NO / no bundle ──→ return StorefrontRenderPlan {
                                   rendererEngine: undefined (= React),
                                   template.sections
                                }

[StorefrontCompositionEngine]
        |
        v
[renderLiquidPlan()]  ←── plan.rendererEngine === 'liquid' && liquidBundle present
        |
        YES path:
        |
        +── getStorefrontCustomerDrop()   [server-only, HS256]
        +── getCustomerOrderDetailDrop()  [customer_order routes]
        +── ProductService.getProductsByIds()  [customer_wishlist]
        +── createThemeRenderer('liquid')
        +── buildLiquidCommerceContext()
        |       ↓
        |   LiquidCommerceDrops { shop, request, settings, product,
        |                         collection, collections, cart, customer, search, order }
        |
        +── LiquidRenderer.render(input)
                |
                +── parseLiquidThemePackageBundle()  [Zod re-validate]
                +── buildLiquidThemeHeadAssets()     [:root tokens + base CSS]
                +── createLiquidEngine()             [LiquidJS + custom filters]
                +── renderLiquidTemplateSections()   [sequential section loop]
                |       |
                |       +── stripLiquidSchemaBlocks()
                |       +── engine.parseAndRender()
                |       +── sanitizeRenderedHtml()   [DOMPurify fragment]
                |
                +── renderLiquidPlan: header chrome
                +── renderLiquidPlan: footer chrome
                +── engine.parseAndRender(layout/theme.liquid)
                +── sanitizeRenderedHtml(layoutHtml, { wholeDocument: true })
                |
                v
           LiquidRenderedTheme { header, contentForLayout, footer }
                |
                v
        <LiquidRenderedHtml dangerouslySetInnerHTML={header+contentForLayout+footer} />
        <LiquidHydrationIslands />   ← useEffect registers lb-* custom elements

        NO path:
        |
        v
[RenderSectionList]
        |
        v
[renderRegisteredSection()] → dispatches to React section renderer by renderer_key
        |
        v
[React HTML output]
```

### Target Architecture

```
[Customer Request]
        |
        v
[proxy.ts middleware]  ←  host routing, preview token, password gate, 301 redirects
                          (unchanged from current)
        |
        v
[storefront-runtime Next.js page]
        |
        v
[resolveStorefrontTemplate()]
        |
        +--- Is this the checkout route? ──YES──→ [CheckoutClient React component]
        |    (permanent React carve-out)               (Razorpay SDK + COD flow)
        |
        +--- Default: Liquid engine ───────────→ [resolveLiquidBundle(store)]
        |    (THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true, ARB-approved)
        |                    |
        |                    +── liquidBundle found?
        |                        YES → StorefrontRenderPlan { rendererEngine: 'liquid', ... }
        |                        NO  → StorefrontRenderPlan { rendererEngine: 'json-contract' }
        |                              (React fallback for stores not yet on Liquid)

[StorefrontCompositionEngine]
        |
        v
[renderLiquidPlan()]  ←── rendererEngine === 'liquid'
        |
        +── Drops assembly (same as current, plus new Page/Article drops in Phase B)
        +── LiquidRenderer.render()
        |       |
        |       +── Section pipeline (unchanged from current)
        |       +── DOMPurify sanitization (unchanged)
        |       +── CSS token injection (8 tokens, all populated in Phase B)
        |
        +── If editorMode=true → inject editor bridge script
        |       (finds [data-section-id], attaches click handlers, listens for parent postMessage)
        |
        v
   <LiquidRenderedHtml + LiquidHydrationIslands />
   (9 existing islands + lb-variant-selector + lb-newsletter-signup + lb-password-toggle in Phase C)

[React Fallback Path — rare, documented exceptions only]
        |
        +── /checkout → CheckoutClient (Razorpay SDK, permanent)
        +── /checkout/success → server redirect to /account/orders (trivial stub)
        +── /orders → legacy OrdersClient (parallel to /account/orders, Liquid-capable)
        +── Stores without liquidBundle → React section list (transitional)
```

### Theme Distribution Architecture

```
[Theme Author / LetBuyy]
        |
        +── Urban Kicks Liquid bundle (first-party, hardcoded in theme-bundle.ts)
        +── POST /v1/themes/packages/upload (Zod-validated bundle, 512 KB limit)
        +── Developer console listing → theme_developer_listings → manual review → themes table
        |
        v
[API Gateway — /v1/themes catalog]
        |
        +── GET /v1/themes  → theme catalog (themes table, is_active=true)
        +── POST /v1/themes/:slug/install → store_themes upsert + publish_theme_release RPC
        +── POST /v1/themes/:slug/purchase → Razorpay order (paid themes)
        +── POST /v1/themes/:slug/purchase/verify → HMAC verify, status=completed
        |
        v
[Merchant Control Plane — /api/themes proxies]
        |
        +── GET /api/themes → catalog + current theme for store
        +── POST /api/themes/install → install by slug or upload bundle
        |
        v
[sites.template_config + sites.theme_id updated]
        |
        v
[purgeThemeStorefrontCache() → Cloudflare KV version bump + cache purge]
        |
        v
[Next storefront request loads new liquidBundle from template_config]
        |
        v
[LiquidRenderer renders new theme]
```

### Adaptive Theme Architecture

```
[Theme Code (Urban Kicks Liquid Bundle)]
        ↓ base sections, block types, Liquid source
[Industry Preset Layer (settings_data.presets)]
        presets['electronics'] = { primaryColor: '#1e40af', ... section arrangement }
        presets['fashion']     = { primaryColor: '#7c3aed', ... section arrangement }
        presets['grocery']     = { primaryColor: '#15803d', ... section arrangement }
        ↓ merged at preset-apply time → writes to settings_data.current
[Merchant Customization Layer (settings_data.current)]
        Stored in theme_releases.release_config / theme_editor_drafts.draft_config
        Merchant can override any preset value via the editor
        ↓ loaded at render time by buildLiquidScope()
[Customer Segment Override Layer (liquidContext.settings injection)]  ← Phase D
        Request middleware injects segment-specific token overrides before render
        e.g., returning-buyer gets warmer accent color, first-visit gets hero CTA copy variant
        ↓
[LiquidRenderer.render() — final scope: base + preset + merchant + segment]
        ↓
[Liquid HTML output with per-store CSS custom properties]
```

---

## Migration Phases

### Phase 0 (Complete — Foundation)

Built the core infrastructure that all subsequent phases rely on.

- `packages/theme-engine` package: `LiquidThemePackageBundleSchema`, `LiquidRenderer`, `ThemeRendererEngine` union, `ThemeGovernance` constants, `BuiltInSectionType` (25 types), `SECTION_SCHEMAS` registry (11 schemas).
- Urban Kicks Liquid bundle fixture (`createUrbanKicksLiquidThemeBundleFixture()`): 15 templates, ~35 section types with inline Liquid source.
- DOMPurify + JSDOM sanitization pipeline with `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`.
- `LIQUID_THEME_TOKEN_MAP` and CSS custom property injection via `buildLiquidThemeHeadAssets()`.
- Core islands: `lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker`, `lb-review-form`, `lb-wishlist-toggle`, `lb-cart`.
- LiquidJS engine configuration: `outputEscape:'escape'`, `strictFilters:true`, `ownPropertyOnly:true`, `parseLimit:300_000`, `renderLimit:250`, `memoryLimit:2_000_000`.
- Portable-to-Liquid compiler (`compilePortableToLiquidBundle()`) with `PORTABLE_TO_LIQUID_TYPE_OVERRIDES`.
- 13 test files covering L2 through L13 (assets, compiler, chrome, product, collection, search, cart, auth, account, orders, tracking, authoring/desync).
- `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` governance constant.

### Phase A (Complete — Customer Account)

Extended Urban Kicks Liquid bundle to cover all authenticated customer account pages.

- Settings page (`customers/settings`) + `lb-customer-settings` island (profile PATCH + password POST).
- Wishlist page (`customers/wishlist`) + server-side product enrichment via `ProductService.getProductsByIds`.
- Addresses page (`customers/addresses`) + `lb-address-manager` island (full CRUD against `/api/customer/addresses`).
- Order detail page (`customers/order`) + `getCustomerOrderDetailDrop()` server-side data binding.
- Policy pages (`policy`) + `policy-content` section (renders `page.title` + `page.body_html`).
- `resolveAccountLiquid()` helper used by all 6 account routes.
- Template coverage increased: 9 → 14 route types (47% → 74%).
- New islands: 2 (`lb-customer-settings`, `lb-address-manager`); total: 9.

### Phase B (Next — Recommended)

Completes the remaining template gaps and makes the Liquid bundle fully production-ready for all content routes.

**What to tackle:**

1. **`page` route** — generic CMS pages (`/[...path]`). Add `page-content` section to Urban Kicks bundle (mirrors `policy-content`, renders `{{ page.title }}` + `{{ page.body_html }}`). Add `'page'` template key to bundle. Estimated 2–3 hours.

2. **`article` route** — blog posts (`/blog/[slug]`). Add `article-content` section (renders `{{ article.title }}`, `{{ article.content }}`, `{{ article.author }}`, `{{ article.published_at }}`). Add `'article'` template key. Add `article` drop to `LiquidCommerceDrops` interface and `buildLiquidCommerceContext`. Estimated 4–6 hours.

3. **`not_found` route** — 404 page. Add `not-found` section (generic "Page not found" with a back-to-home link). Add `'not_found'` template key. Route through `StorefrontCompositionEngine` via a dedicated Next.js `not-found.tsx` server component. Estimated 3–4 hours.

4. **CSS token map — close 5-token gap.** Populate `secondaryColor`, `backgroundColor`, `textColor`, `borderColor` in Urban Kicks `config.settings_schema.colors`. Update `LIQUID_THEME_TOKEN_MAP` entry for `--border-color`. All existing sections use `var(--*)` so this is additive. Estimated 1–2 hours.

5. **Search page canary wiring** — the `search` template exists in Urban Kicks but the `/search` route type has no Next.js page file. Add `apps/storefront-runtime/src/app/store/[subdomain]/search/page.tsx` wired to `resolveStorefrontTemplate` with `route.type = 'search'`. Estimated 2–3 hours.

6. **Editor bridge script for Liquid preview.** Small `<script>` injected in `/preview` when `editorMode=true && renderer_engine==='liquid'`. Finds `[data-section-id]` elements, posts `letbuyy:theme-editor:section-select` on click, listens for `LETBUYY_THEME_EDITOR_SELECTION` to apply highlight CSS. Each Urban Kicks section template must emit wrapping `<div data-section-id="{{ section.id }}">`. Estimated 1–2 days.

**Dependencies:** Phase B has no blocking dependencies on other work. It is purely additive to the existing Urban Kicks bundle and does not require ARB approval (it does not change the default render engine; it only completes template coverage for stores already opted into Liquid).

**Risk level:** LOW — all Phase B items are template additions or small JS snippets; none touch the payment flow, RLS, or money RPCs.

**Estimated total effort:** 3–5 days.

### Phase C (Medium Term)

Builds the remaining hydration islands and completes the Liquid coverage for all interactive storefront routes except checkout.

**What to tackle:**

1. **`lb-variant-selector` island** — Product variant selection with reactive price/stock display update. On variant option click, calls `/api/storefront/{subdomain}/products/{id}/variant?options=...`, updates `data-product-price`, `data-lb-variant-selected` attributes on the add-to-cart island. Required for retiring `ProductDetailsClient` React fallback. Estimated 3–4 days.

2. **`lb-newsletter-signup` island** — Newsletter form POST to `/api/newsletter/subscribe` with Turnstile verification and inline success/error feedback. Required for retiring the inline form fallback on the home page. Estimated 1–2 days.

3. **`lb-password-toggle` island** — Trivial (< 20 lines): swaps `input[type=password]` to `input[type=text]` and updates an icon label. Required for full settings page parity. Estimated 2–4 hours.

4. **`lb-cart` island — full CRUD.** Extend the existing `lb-cart` island to handle: `removeFromCart`, `updateQuantity`, `clearCart` via gateway cart API. Server-authoritative totals already work; only the mutation operations are missing. Estimated 2–3 days.

5. **`article` page + blog index** — Blog index page (`/blog`) needs a `blog` route type and a `blog-index` section. Requires a `getBlogList` gateway API and a `blog` drop (`blog.articles[]`). Estimated 3–5 days (includes backend work for blog index API).

6. **Adaptive preset infrastructure (Phase 2 of 08):**
   - "Apply preset" action in merchant control plane: copies `settings_data.presets['vertical']` into `settings_data.current`, saves as draft.
   - Onboarding step: "What type of store?" → preset auto-apply.
   - Industry preset definitions for 3 verticals (grocery, fashion, electronics) in Urban Kicks `settings_data.presets`.
   - Estimated 1 week.

7. **DOMPurify allowlist additions for Phase C islands** — `lb-variant-selector` needs `data-variant-selected`, `data-variant-options` attributes added to `ADD_ATTR`. No new custom elements needed (island registers under existing names). Estimated 1 hour.

**Dependencies:** Phase C depends on Phase B completing the editor bridge (so new sections can be edited in the preview). Phase C also depends on the gateway blog index API for the blog index section.

**Risk level:** MEDIUM — variant selection island touches the product purchase flow; requires careful testing of price display accuracy. No money mutations involved (cart sync already server-authoritative).

**Estimated total effort:** 3–4 engineering weeks.

### Phase D (Long Term)

ARB-gated milestone. Requires formal approval before any Phase D work begins.

**What to tackle:**

1. **ARB review and platform-wide Liquid flip.** Present evidence package: render parity across all 18 hybrid routes, SSTI/XSS gate green (zero DOMPurify violations in staging), performance data (Liquid render latency vs React SSR baseline), error rate data from `lb:canary:render` events. On ARB approval: flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`.

2. **Full adaptive theme system — Phase 4 of 08:** Segment-keyed settings injection via `liquidContext.settings`. A/B variant routing in the storefront proxy. Analytics hookup via LCIS telemetry adapter.

3. **New island: `lb-delivery-estimate`.** Pincode-based delivery ETA for Furniture/Grocery merchants. Requires a new `lb-delivery-estimate` custom element added to the DOMPurify `ADD_TAGS` allowlist and the hydration island registry. Backend requires a delivery slot or lead-time API.

4. **Vertical section schemas — Phases 3 and 4 of 08:** Add `product-specs`, `comparison-table` (Electronics), `lookbook`, `size-guide` (Fashion), `nutrition-table`, `bundle-deals`, `product-freshness` (Grocery), `dimensions-panel`, `material-options` (Furniture), `customization-panel`, `certification-block` (Jewelry).

5. **AI-assisted section content generation.** New `POST /api/themes/:slug/ai-generate-section` gateway route. Editor sidebar "Generate" button in `PropertyPanel`. AI agent reads product catalog drops and generates section copy. MCP integration for external AI tooling.

6. **Theme marketplace production deployment.** Requires ARB reopen trigger plus all 9 production readiness items from the gap analysis (doc 05): env config, catalog seeding, storage provider, developer listing promotion pipeline, Lighthouse job, Razorpay payout, GSTIN, email notifications, route ownership lockstep.

7. **Password gate (`password` route type).** Storefront proxy middleware that serves the password gate page for stores in `draft` status. Add `store-password.liquid` section + `'password'` template to Urban Kicks.

**Dependencies:** Phase D is entirely dependent on Phase B and C completion (render parity evidence requires all routes to have Liquid templates and islands). ARB approval is a hard gate.

**Risk level:** HIGH for the platform-wide flip (reverting requires updating every store's `template_config` or toggling the flag back); MEDIUM for other Phase D items.

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LiquidJS render error propagates uncaught | Medium | HIGH — unhandled rejection crashes the Next.js render | Add try/catch in `renderLiquidTemplateSections`; fall back to React on LiquidJS exception |
| DOMPurify JSDOM singleton fails to load | Low | HIGH — all Liquid renders fail | Lazy load with explicit rejection handler; circuit-breaker to React fallback |
| Liquid section emits `<script>` via encoding bypass | Low | CRITICAL | `outputEscape:'escape'` + DOMPurify `FORBID_TAGS:['script']` + Zod source schema guard = three independent layers |
| `lb-variant-selector` displays wrong price (currency minor-unit error) | Medium | HIGH — incorrect price shown to customers | All price display via `money` Liquid filter (formats minor-unit integers); never derive price in browser JS |
| CSS token injection allows `<` or `>` in a color value | Low | Medium — visual glitch or XSS attempt | `sanitizeCssTokenValue()` strips `<>{};@()` and truncates to 120 chars |
| Section sequential rendering creates high latency | Medium | Medium — P99 render time exceeds CDN timeout | Parallelize section rendering via `Promise.all` (safe since LiquidJS `cache:false` uses fresh instance per call) |
| `liquidBundlePublishWouldDesync()` guard bypassed via rollback | Low | Medium — Liquid store loses bundle on rollback | Guard is also checked in `rollbackRelease`; release snapshot preserves `liquidBundle` |

### Architectural Risks

- **ART-17 freeze scope creep.** ART-17 freezes new React-per-section. If team members add React renderers to `renderer-registry.tsx` rather than adding Liquid sections to the bundle, the freeze is violated and the validator gate will catch it. Mitigation: make the Liquid section authoring path (adding a `createLiquidSectionFile()` call to `theme-bundle.ts`) easier than adding a React renderer.
- **Two-lane merge rule.** Per `AGENTS.md` and project memory, the one-lane-at-a-time merge rule applies to lane-a/lane-b worktrees. Theme engine changes that touch both the storefront runtime and the merchant control plane must be sequenced, not parallel-merged.
- **`getSupabaseAdmin` blast radius.** This function is called by 115 files (LCIS critical hotspot). Any change to theme-related DB queries that touches `getSupabaseAdmin` must have a blast radius check via `pnpm graph:intel blast "getSupabaseAdmin"` before merge.
- **Island custom elements + CSP.** If a Content Security Policy is added to the storefront in the future, all `lb-*` custom elements registered via `window.customElements.define()` must be in the allowed script hash or nonce list. The islands are currently inline JS evaluated in a `useEffect`; a future CSP must account for this.

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ARB rejects the platform-wide Liquid flip | Medium | Medium — phases A–C complete but default stays React | Phases A–C deliver value independently; stores can opt in per-theme |
| Marketplace unfreezing blocked by ARB indefinitely | Low | Medium — third-party themes cannot be published | Near-term theme distribution via merchant control plane upload path (no marketplace required) |
| Subscription dairy/fresh-produce vertical blocked | High — subscriptions NOT IMPLEMENTED | Low — single vertical affected | Stub `subscription-panel` section with `disabled_on:['*']` until platform subscriptions domain exists |
| Theme developer revenue share has no disbursement mechanism | High | Low — no live developer themes yet | Manual payout acceptable for zero developers; automate when marketplace unfreezes |

---

## Dependency Graph

### What Phase B depends on

- Phase A complete (all account templates and islands done) — YES, done.
- `packages/theme-engine` and `apps/storefront-runtime` build passing — must run `pnpm --filter @letbuyy/theme-engine build` and `pnpm --filter storefront-runtime build` after bundle changes.
- No ARB approval required (Phase B does not change the default render engine).
- No new gateway API routes (Phase B is storefront-runtime + theme-engine only, except for the `/search` page which needs the existing search gateway route).

### What Phase C depends on

- Phase B complete (all template gaps closed, editor bridge script in place).
- Gateway blog index API (for blog section) — may be a parallel track.
- `lb-variant-selector` island requires a `/api/storefront/{subdomain}/products/{id}/variant` gateway endpoint (either new or via existing product API with variant filtering).
- Preset infrastructure in merchant control plane requires changes to the `[store]/online-store/themes/` editor page (new "Apply preset" action).

### What blocks Phase D

- Phase B and C completion (render parity evidence required for ARB review).
- ARB formal review session with evidence package: render parity report, SSTI/XSS gate results, performance data.
- ARB approval of `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` status change from `'deferred'`.
- For marketplace production deployment: ARB reopen trigger for `apps/theme-marketplace`, plus all 9 production readiness items.

---

## Recommended Execution Order

1. **Run `node scripts/validate-governance.mjs`** before starting any theme work to confirm the 107-validator gate is green.

2. **Phase B — `page-content` section** (2–3 hours). Add `page-content.liquid` to `createLiquidParitySectionFiles()`. Add `'page'` template to Urban Kicks bundle. Verify via `?engine=liquid` on a CMS page route.

3. **Phase B — `article-content` section + article drop** (4–6 hours). Add `article` to `LiquidCommerceDrops` interface, populate in `buildLiquidCommerceContext` for `article` route type. Add `article-content.liquid` section and `'article'` template to bundle. Run `liquid-l14-article.test.ts` (new test file).

4. **Phase B — CSS token map — close 5-token gap** (1–2 hours). Add `secondaryColor`, `backgroundColor`, `textColor`, `borderColor` to Urban Kicks settings schema and `LIQUID_THEME_TOKEN_MAP`. Verify existing sections pick up the new tokens correctly.

5. **Phase B — Search page route file** (2–3 hours). Add `apps/storefront-runtime/src/app/store/[subdomain]/search/page.tsx`. Wire `route.type = 'search'` and `route.resourceSlug = query`. The `search` template and sections already exist in Urban Kicks.

6. **Phase B — Editor bridge script for Liquid preview** (1–2 days). Add `data-section-id="{{ section.id }}"` wrapping divs to all Urban Kicks section Liquid source. Add bridge `<script>` injection in the `/preview` route when `editorMode=true && renderer_engine==='liquid'`. Wire rollback button in `VersionTree` (API already complete).

7. **Phase B — `not_found` template** (3–4 hours). Add `not-found.liquid` section. Add `'not_found'` template. Create `apps/storefront-runtime/src/app/store/[subdomain]/not-found.tsx` server component.

8. **Phase C — `lb-newsletter-signup` island** (1–2 days). Turnstile-gated POST to `/api/newsletter/subscribe`. Required before the newsletter section can be considered fully interactive.

9. **Phase C — `lb-password-toggle` island** (2–4 hours). Trivial toggle. Completes settings page parity.

10. **Phase C — `lb-cart` CRUD island** (2–3 days). Add `removeFromCart`, `updateQuantity`, `clearCart` operations to `LbCartElement`. Server-authoritative totals already implemented; extend the mutation path.

11. **Phase C — `lb-variant-selector` island** (3–4 days). New island: on variant option click, fetch updated variant data (price, stock, images) from gateway, update DOM via `data-*` attribute replacement. This unblocks retiring `ProductDetailsClient`.

12. **Phase C — Adaptive preset infrastructure** (1 week). Add preset definitions to Urban Kicks bundle for grocery, fashion, electronics. Build "Apply preset" action in merchant control plane editor. Wire onboarding step.

13. **Phase C — Blog index API + `blog-index` section** (3–5 days, parallel backend + frontend). Requires coordination with gateway team for the blog list endpoint.

14. **Phase D gate — Evidence package preparation.** Compile render parity matrix (all 18 hybrid routes confirmed Liquid in staging), SSTI/XSS test results, P50/P95 Liquid render latency vs React baseline, zero DOMPurify violations report.

15. **Phase D — ARB review session.** Present evidence package. Request `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` status change.

16. **Phase D — Platform-wide Liquid flip.** On ARB approval: change `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` in `theme-governance.ts`. Run full validator gate and build. Deploy to staging; validate all routes. Deploy to production.

---

## Success Metrics

| Milestone | Metric | Target |
|-----------|--------|--------|
| Phase B complete | `StorefrontRouteType` values with Liquid template | 17 of 17 (100%) — `page`, `article`, `not_found`, `password`, `search` added |
| Phase B complete | CSS token slots populated in Urban Kicks | 8 of 8 (100%) |
| Phase B complete | Editor Liquid preview section click-to-select working | Yes — bridge script injected, sections clickable in `editorMode=true` |
| Phase C complete | Hydration islands registered | 12 of 12 (9 existing + `lb-variant-selector`, `lb-newsletter-signup`, `lb-password-toggle`) |
| Phase C complete | Routes with no React section fallback needed | 18 of 18 hybrid routes (checkout stays React) |
| Phase C complete | Industry presets available | 3 (grocery, fashion, electronics) |
| Phase C complete | Adaptive preset application working | Merchant can select vertical during onboarding and see preset applied |
| Phase D gate | Render parity evidence | All 18 hybrid routes Liquid-rendered in staging with zero visual regressions |
| Phase D gate | SSTI/XSS gate | Zero DOMPurify violations in 10,000 render samples |
| Phase D gate | Liquid render P95 latency | ≤ 200ms (vs React SSR baseline) |
| Phase D complete | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | `true` (ARB-approved) |
| Phase D complete | Marketplace production deployment | Live at `themes.letbuyy.com` (ARB reopen required) |
| Phase D complete | Industry verticals with active presets | 5 (grocery, fashion, electronics, furniture, jewelry); dairy deferred pending subscriptions domain |
| Ongoing | 107-validator gate | Green on every merge |
| Ongoing | `pnpm --filter storefront-runtime build` | Green on every merge after theme-engine changes |

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-research/09-target-theme-architecture.md`*
*Sources: docs/theme-research/01–08, packages/theme-engine/src/theme-renderer.ts (lines 1–100), apps/storefront-runtime/src/lib/theme-engine/types.ts, services/api-gateway/src/routes/themes.ts (lines 1–80)*
