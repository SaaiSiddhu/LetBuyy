# LetBuyy Theme System — Architecture Research

> Deep research into the LetBuyy theme ecosystem: current state, Liquid coverage, migration opportunities, and target architecture.

---

## Document Index

| # | Document | Topic | Key Question Answered |
|---|----------|-------|----------------------|
| 01 | [Theme System Inventory](01-theme-system-inventory.md) | Full package/module map, dual engine architecture, bundle schemas, section registry, governance constants | What does the entire theme system look like and how is it wired together? |
| 02 | [Storefront Rendering Audit](02-storefront-rendering-audit.md) | Route-by-route rendering mode analysis across all 21 storefront routes | Which routes are Liquid-capable today and what is the exact decision flow per route? |
| 03 | [Liquid Coverage Report](03-liquid-coverage-report.md) | Template, section, and island coverage percentages for the Urban Kicks Liquid bundle | What percentage of the storefront can currently render in Liquid, and what are the precise gaps? |
| 04 | [Theme Editor Analysis](04-theme-editor-analysis.md) | WYSIWYG editor architecture, API routes, draft/publish/rollback lifecycle, preview integration | How does the theme editor work end-to-end, and can the preview become fully Liquid? |
| 05 | [Theme Marketplace Analysis](05-theme-marketplace-analysis.md) | Marketplace app deployment status, purchase/install/developer flows, data layer | Is the theme marketplace production-ready, and what would it take to unfreeze it? |
| 06 | [Liquid Engine Analysis](06-liquid-engine-analysis.md) | LiquidJS rendering pipeline, commerce drops, sanitization, hydration islands, error handling, test coverage | How does the Liquid engine work internally and what are its security and performance characteristics? |
| 07 | [React Elimination Study](07-react-storefront-elimination-study.md) | Route-by-route feasibility analysis for converting every storefront route from React to Liquid | Which routes can become Liquid, which ones cannot, and why is checkout the permanent exception? |
| 08 | [Adaptive Theme System](08-adaptive-theme-system.md) | Urban Kicks deep analysis, multi-vertical preset architecture, industry-specific section gaps | How should the theme system serve electronics, fashion, grocery, furniture, and jewelry merchants from one codebase? |
| 09 | [Target Architecture](09-target-theme-architecture.md) | Synthesis of all research into a phased migration plan (Phases B–D) with success metrics and risk register | What is the full roadmap from the current hybrid React/Liquid state to a Liquid-first default platform? |

---

## Executive Summary

### What We Found

LetBuyy's storefront renderer is in a mature canary state. The Liquid engine is not an experiment — it is a production-hardened implementation with a validated Zod schema, DOMPurify sanitization, LiquidJS configured with `outputEscape:'escape'` and prototype-pollution guards, and 13 test files covering layers L2 through L13. The Urban Kicks theme bundle covers 74% of all `StorefrontRouteType` values with 100% Liquid section coverage (every section in the bundle has inline Liquid source; none fall back to React). Nine hydration islands handle every interactive commerce pattern from add-to-cart to address CRUD. The infrastructure is sound.

The platform is governed by `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` and `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`, meaning Liquid is opt-in per store and the platform-wide default flip requires ARB approval. This is a deliberate governance boundary, not a technical limitation. Eighteen of 21 storefront routes are hybrid (Liquid + React fallback); only three routes are React-only, and only one of those — `/checkout` — must remain React permanently due to the Razorpay SDK imperative callback pattern, `useRef` idempotency keys, multi-step wizard state, and real-time browser-cart-dependent shipping rate fetching.

The gap between the current state and full Liquid coverage is smaller than it appears. The remaining 26% of route types without Liquid templates (`page`, `blog`, `article`, `password`, `not_found`) are all low-complexity content routes. Adding them requires 2–3 new section files and template entries in the Urban Kicks bundle — no new infrastructure, no gateway changes, no ARB approval. The research also identified three missing hydration islands (`lb-variant-selector`, `lb-newsletter-signup`, `lb-password-toggle`) and one incomplete island (`lb-cart` lacks CRUD mutation operations), all of which are bounded, well-scoped engineering tasks.

The theme editor shell is permanently React (it lives in merchant-control-plane, not storefront-runtime), but the editor preview iframe — which renders through the same storefront composition engine as a live storefront — is already Liquid-capable for route rendering. The missing piece is a small client-side bridge script that wires section click-to-select for Liquid-rendered sections. The token, draft config, and postMessage protocol are already correct; only the DOM event wiring is absent. The theme marketplace has fully implemented source code but is frozen by ARB at `deploymentAuthority.platform = 'frozen-not-deployed'`; it requires a formal ARB reopen trigger and nine production readiness items before it can be deployed.

The adaptive theme system research found that a single-core-theme + multiple-presets model is strongly indicated by the existing codebase. The `settings_data.presets` contract already exists in `LiquidThemePackageBundleSchema`, `color_presets[]` and `industry[]` fields already exist in the marketplace `Theme` type, and Urban Kicks already has the structural scaffolding. What is missing is the preset-application action in the merchant control plane and industry-specific section schemas for the first three verticals (grocery, fashion, electronics). The subscription-based dairy/fresh-produce vertical is blocked not by theme work but by the platform's subscriptions domain, which is confirmed NOT IMPLEMENTED in LCIS.

### Current State Scorecard

| Dimension | Current State | Target State | Gap |
|-----------|--------------|--------------|-----|
| Storefront Liquid template coverage | 74% (14 of 17 non-layout route types) | 100% (17 of 17) | `page`, `article`, `not_found` — 3 low-effort additions; `password` medium; `blog` high (backend needed) |
| Section Liquid coverage (Urban Kicks bundle) | 100% (~35 sections, all with inline Liquid source) | 100% | None — all bundle sections have inline Liquid |
| Hydration islands registered | 9 of 9 required today | 12 (add `lb-variant-selector`, `lb-newsletter-signup`, `lb-password-toggle`) | 3 new islands needed for Phase C |
| Checkout Liquid coverage | 0% — permanently React | 0% — permanently React | Not a gap; permanent architectural boundary |
| Theme editor preview Liquid | Routing works; section click-to-select not wired | Section selection working in Liquid mode | One bridge script + `data-section-id` in Liquid templates |
| Theme marketplace status | Frozen, not deployed | Deployed at `themes.letbuyy.com` | ARB reopen + 9 production readiness items |
| CSS token slots populated (Urban Kicks) | 3 of 8 | 8 of 8 | 5 missing: `secondaryColor`, `backgroundColor`, `textColor`, `borderColor`, and one more — additive, no risk |
| Adaptive themes / industry presets | None implemented | 5 verticals (grocery, fashion, electronics, furniture, jewelry) | Preset infrastructure in merchant control plane + ~13 new section schemas |
| Platform-wide Liquid default | `false` (React default) | `true` (ARB-approved flip) | All Phase B + C completion + ARB evidence package |

---

## Key Findings

### Confirmed Strengths

**The Liquid security model is defense-in-depth.** Three independent layers protect against SSTI and XSS: (1) Zod schema at bundle ingestion forbids `<script`, `{% render %}`, `{% include %}`, `{% layout %}`; (2) LiquidJS `outputEscape:'escape'` HTML-escapes all template output before DOMPurify sees it; (3) DOMPurify with JSDOM sanitizes the full rendered HTML with `FORBID_TAGS:['script','embed','object','base']` and `FORBID_ATTR:['style']`. Any one layer independently blocks the most common injection vectors.

**Money is never computed in the browser.** Cart totals in `lb-cart-drawer` and `lb-cart` come verbatim from the gateway cart response (`LiquidServerCart`) stored in `localStorage` under `lb_cart_server`. `renderLiquidCartTotals()` formats server values; it never derives a total from line items. This is consistent with the canonical ledger policy enforced by the `canonical-ledger-only-validator`.

**The island architecture is progressive enhancement.** Liquid HTML is meaningful static markup without JavaScript. The nine `lb-*` Web Components layer interactivity on top via `data-*` attributes carrying server-rendered values. The SSR/client split is clean: no hydration mismatch is possible because Liquid HTML is not React-generated markup.

**The portable-to-Liquid compiler (`portable-to-liquid.ts`) enables zero-migration installs.** A store already configured with a React JSON-contract theme can be compiled to a Liquid bundle at publish time via `compilePortableConfigForPublish()`. The L13 desync guard (`liquidBundlePublishWouldDesync()`) prevents accidental bundle stripping on subsequent publishes. Merchants do not need to manually author Liquid to get a Liquid theme.

**18 of 21 storefront routes already have a Liquid path.** The composition engine's dual-path architecture — `renderLiquidPlan()` returning `null` causes an automatic React fallback — means every hybrid route is already Liquid-capable for stores with a Liquid bundle. The canary infrastructure is additive, not a rewrite.

**The Urban Kicks account pages are genuinely better in Liquid than in React.** The `WishlistPageClient` React component acknowledges "Product detail hydration needs backend support" and works only from product IDs. The Liquid wishlist page receives fully enriched product drops via `ProductService.getProductsByIds()` server-side. The Liquid path is more complete.

### Confirmed Gaps

**5 route types have no Liquid template in Urban Kicks.** `page` (generic CMS), `article` (blog post), `not_found` (404), `password` (store gate), and `blog` (blog index) have no bundle entries. `page` and `article` are low-effort additions (mirrors of the existing `policy-content` section). `not_found` requires a new Next.js `not-found.tsx` server component. `password` requires proxy middleware. `blog` requires a backend blog index API that does not yet exist.

**3 hydration islands are missing for full Phase C coverage.** `lb-variant-selector` (needed for reactive variant price/stock updates without page reload), `lb-newsletter-signup` (needed for home page newsletter form with inline feedback), and `lb-password-toggle` (needed for the account settings password show/hide).

**`lb-cart` island is incomplete.** Server-authoritative totals already work. The mutation operations — `removeFromCart`, `updateQuantity`, `clearCart` — are not yet implemented, meaning the React `CartPageClient` fallback cannot be retired until these are added.

**Editor preview section click-to-select is not wired for Liquid.** `EditorPreviewSectionFrame` is React-only. The Liquid render path does not wrap sections in the frame, so clicking a section in a Liquid preview does not select it in the editor sidebar. A small vanilla JS bridge script is the entire solution; the postMessage protocol and preview token infrastructure are already correct.

**5 CSS token slots fall back to hardcoded values in Urban Kicks.** Only `primaryColor`, `accentColor`, `surfaceColor`, `headingFontFamily`, and `bodyFontFamily` are populated. `secondaryColor`, `backgroundColor`, `textColor`, and `borderColor` use hardcoded fallbacks defined in `buildLiquidRootTokenBlock`. Merchants cannot customize these via the editor until they are added to the settings schema.

**Sections render sequentially, not in parallel.** The `renderLiquidTemplateSections` loop uses sequential `await` for each section. For pages with 7+ sections (the Urban Kicks home page has 7), this adds latency proportional to the section count. A `Promise.all` refactor is safe because `cache:false` means each section gets a fresh LiquidJS evaluation context.

**LiquidJS render errors have no explicit catch.** If a section's `engine.parseAndRender()` call exceeds `renderLimit:250` or `memoryLimit:2_000_000`, LiquidJS throws. This exception propagates uncaught out of `renderLiquidTemplateSections`. The composition engine does not have a try/catch around the renderer call; it would surface as an unhandled Next.js render error rather than a graceful React fallback.

**`newsletter-signup` vs `newsletter` type alias mismatch.** The React registry maps `core.newsletter` to section type `'newsletter'`, but Urban Kicks uses type `'newsletter-signup'`. This has no impact on Liquid mode (the Liquid engine bypasses the React registry entirely), but a hypothetical JSON-contract Urban Kicks variant would silently miss the newsletter renderer.

### Surprises

**Two hybrid routes have no React implementation — only a redirect.** `/account` (dashboard) and `/account/orders/[id]` (order detail) have no React page component; their React fallback is a server-side `redirect()`. These routes are effectively Liquid-only for actual rendering. The React fallback is a degradation path, not an alternative experience.

**The `?engine=liquid` dev override is only wired to the home page.** `resolveDevEngineOverride()` is called only in `app/store/[subdomain]/page.tsx`. Other hybrid routes do not receive the `searchParams` for the override. Local testing of Liquid on product, collection, or account pages requires adding the override to each route file or per-store `templateConfig` changes in the database.

**The theme marketplace has fully working source code but is invisible to production.** It is not listed in any Vercel project, has no deployment secrets, and its manifest explicitly states `"platform": "frozen-not-deployed"`. The code is complete enough that 9 specific operational items (not code changes) are what separate it from production readiness.

**The Liquid wishlist page enriches product data that the React page does not.** The discovery that the Liquid path is more complete than its React equivalent (enriched product drops vs stub product IDs) implies that the Liquid migration is not merely parity work — for some routes it is an improvement.

**Urban Kicks has 35 distinct section types, but 18 of them have no React fallback.** Commerce-specific sections (`cart-summary`, `search-box`, `collection-banner`, `collection-product-list`) and all `customer-*` sections were designed Liquid-first. If a JSON-contract theme attempted to use these section types, they would render as `UnknownSectionFallback`. This is a design signal: the Liquid engine is the intended first-class runtime, not a progressive enhancement.

**Dairy/fresh-produce vertical is not blocked by theme work.** It is blocked by the platform's subscriptions domain, which is confirmed NOT IMPLEMENTED in LCIS v11. A `subscription-panel` section schema can be stubbed with `disabled_on:['*']` now, but no merchant can use it until the subscriptions domain is built.

---

## Risk Register

### Critical Risks

**LiquidJS render error propagates uncaught (HIGH impact, MEDIUM probability).** If `engine.parseAndRender()` throws (exceeds `renderLimit:250` or `memoryLimit:2,000,000`), there is no try/catch in `renderLiquidTemplateSections`. The Next.js render crashes rather than falling back to React. Mitigation: wrap the renderer call in a try/catch that returns `null` (triggering the React fallback path that already exists in `renderLiquidPlan`).

**DOMPurify JSDOM singleton fails to load (HIGH impact, LOW probability).** If the lazy `import('dompurify')` + `new JSDOM('')` singleton rejects, all subsequent `sanitizeRenderedHtml()` calls throw. No circuit-breaker exists. Mitigation: explicit rejection handler on the singleton promise; fall back to React path on load failure.

**Wrong price displayed via `lb-variant-selector` (HIGH impact, MEDIUM probability).** If the variant island derives or formats prices in browser JavaScript rather than using the `money` Liquid filter (which correctly handles INR minor-unit integers), incorrect prices can be shown to customers. Mitigation: all price display in the variant island must read from `data-product-price` (server-rendered minor-unit integer) and format via a shared `formatInrCurrency` utility that matches the Liquid `money` filter output.

### Architectural Risks

**ART-17 freeze scope creep.** ART-17 forbids new React-per-section on frozen surfaces. If engineers add React renderers to `renderer-registry.tsx` instead of adding Liquid sections to the bundle, the freeze is violated. The validator gate (`auditThemeRendererRegistry()` with `enforce` mode) will catch it, but only after the fact. The Liquid section authoring path should be made easier than the React path to reduce the temptation.

**Island custom elements + future CSP.** All nine `lb-*` custom elements are registered via `window.customElements.define()` inside a React `useEffect`. If a Content Security Policy is added to the storefront runtime, inline scripts evaluated in `useEffect` must be covered by a nonce or hash. This is not a current risk but is an architectural debt item for when CSP hardening is added.

**`getSupabaseAdmin` blast radius.** This function is called by 115 files (the highest LCIS blast-radius hotspot). Any theme-related DB query change that passes through `getSupabaseAdmin` requires a `pnpm graph:intel blast "getSupabaseAdmin"` check before merge. Theme queries via `ThemeExecutionAdapter` all use the Supabase admin client.

**Two-lane merge rule applies to cross-app theme changes.** Theme engine changes that touch both `storefront-runtime` and `merchant-control-plane` (e.g., the editor bridge script) must be sequenced per the one-lane-at-a-time rule, not parallel-merged.

**Section rendering is sequential, creating a performance cliff.** Pages with many sections (Urban Kicks home: 7 sections) render each section sequentially with `await`. At scale with P99 render time budget constraints, this will require a `Promise.all` refactor. The refactor is safe (`cache:false` ensures no shared state between section renders) but is not yet done.

---

## Migration Opportunities

### Quick Wins (Phase B — next 2–4 weeks)

1. **`page-content` section + `'page'` template** — generic CMS pages (`/[...path]`). The section is a direct mirror of `policy-content` (same `{{ page.title }}` + `{{ page.body_html }}` pattern). One section file, one template entry. Estimated 2–3 hours.

2. **`article-content` section + `'article'` template + article drop** — blog posts (`/blog/[slug]`). Adds `article.title`, `article.content`, `article.author`, `article.published_at` to `LiquidCommerceDrops`. One section file, one template entry, one drop field. Estimated 4–6 hours.

3. **CSS token gap closure** — add `secondaryColor`, `backgroundColor`, `textColor`, `borderColor` to Urban Kicks settings schema and `LIQUID_THEME_TOKEN_MAP`. All existing sections already use `var(--*)` so this is purely additive. Estimated 1–2 hours.

4. **Search route page file** — the `search` template and all its sections already exist in Urban Kicks. Only the Next.js page file is missing: `apps/storefront-runtime/src/app/store/[subdomain]/search/page.tsx`. Estimated 2–3 hours.

5. **Editor Liquid preview bridge script** — small `<script>` injected into `/preview` when `editorMode=true && renderer_engine==='liquid'`. Finds `[data-section-id]` elements, posts `letbuyy:theme-editor:section-select` on click, listens for highlight signal from editor. Urban Kicks section templates also need wrapping `<div data-section-id="{{ section.id }}">` elements. Estimated 1–2 days.

6. **`not_found` section + template** — generic 404 page. One section, one template, one new `not-found.tsx` server component. Estimated 3–4 hours.

7. **Rollback UI wiring in VersionTree** — the `POST /api/themes/:slug/releases/:id/rollback` API is complete. The VersionTree panel renders release history but has no rollback button wired. One-day UI task.

### Medium Term (Phase C — 1–3 months)

1. **`lb-variant-selector` island** — reactive variant selection with price/stock update without page reload. Calls `/api/storefront/{subdomain}/products/{id}/variant?options=...`, updates DOM `data-*` attributes on the add-to-cart island. Required to retire `ProductDetailsClient`. Estimated 3–4 days.

2. **`lb-newsletter-signup` island** — newsletter POST with Turnstile verification and inline success/error feedback. Estimated 1–2 days.

3. **`lb-password-toggle` island** — trivial; swaps `input[type=password]` to `type="text"`. Under 20 lines. Estimated 2–4 hours.

4. **`lb-cart` CRUD mutations** — extend the existing `lb-cart` island to support `removeFromCart`, `updateQuantity`, `clearCart` against the gateway cart API. Server-authoritative totals already work; only the mutation path is missing. Estimated 2–3 days.

5. **Adaptive preset infrastructure** — "Apply preset" action in merchant control plane, industry preset definitions in Urban Kicks `settings_data.presets` for grocery, fashion, and electronics, onboarding vertical selector. Estimated 1 week.

6. **Blog index API + `blog-index` section** — requires a gateway `GET /v1/blog` endpoint and a `blog.articles[]` drop. Parallel backend + frontend tracks. Estimated 3–5 days total.

7. **Section parallel rendering refactor** — change `renderLiquidTemplateSections` loop from sequential `await` to `Promise.all` for the section render calls. Safe with `cache:false`. Estimated 1–2 hours.

8. **Uncaught render error mitigation** — add try/catch around `renderer.render()` in `renderLiquidPlan`; return `null` on LiquidJS exception to trigger the existing React fallback. Estimated 1–2 hours.

### Long Term (Phase D — 3–6 months, ARB-gated)

1. **ARB evidence package + platform-wide Liquid flip** — compile render parity matrix, SSTI/XSS gate results, P50/P95 latency data, zero DOMPurify violations report. On ARB approval, flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`.

2. **Full adaptive theme system** — customer segment override injection via `liquidContext.settings`, A/B variant routing in storefront proxy, LCIS telemetry adapter hookup.

3. **Vertical section schemas** — `product-specs`, `comparison-table` (Electronics), `lookbook`, `size-guide` (Fashion), `nutrition-table`, `bundle-deals`, `product-freshness` (Grocery), `dimensions-panel`, `material-options` (Furniture), `customization-panel`, `certification-block` (Jewelry). Approximately 13 new section types total.

4. **Theme marketplace production deployment** — requires ARB reopen trigger plus env configuration, catalog seeding, R2/S3 for download artifacts, developer listing promotion pipeline, Lighthouse measurement job, Razorpay Route payout, and live seller GSTIN.

5. **Password gate route** — storefront proxy middleware serving the store password gate for `sites.status = 'draft'` stores. Requires a new `store-password.liquid` section and `'password'` template.

6. **AI-assisted section content generation** — new `POST /api/themes/:slug/ai-generate-section` gateway route and editor sidebar "Generate" button in `PropertyPanel`. MCP integration for external AI tooling.

---

## Recommended Roadmap

```
Phase 0 ✅ Foundation
  - LiquidThemePackageBundleSchema, LiquidRenderer, DOMPurify pipeline
  - Urban Kicks bundle: 15 templates, ~35 sections, 9 hydration islands
  - LiquidJS configuration, portable-to-Liquid compiler
  - THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION governance constant
  - 13 test files (L2–L13)

Phase A ✅ Customer Account (complete)
  - customers/settings, customers/wishlist, customers/addresses, customers/order, policy
  - lb-customer-settings, lb-address-manager islands
  - resolveAccountLiquid() helper for all 6 account routes
  - Template coverage: 47% → 74% (9 → 14 of 17 non-layout route types)

Phase B 🟡 Template Completion (recommended next, 3–5 days total)
  - page-content section + 'page' template (generic CMS pages)
  - article-content section + 'article' template + article drop
  - not_found section + template + not-found.tsx server component
  - Search route page file (template already exists in bundle)
  - CSS token map: close 5-token gap (secondaryColor, backgroundColor, textColor, borderColor)
  - Editor Liquid preview bridge script (section click-to-select in Liquid mode)
  - Rollback UI button in VersionTree
  - Target: 100% StorefrontRouteType Liquid template coverage (except blog index)
  - No ARB approval required

Phase C 🔲 Island Completion + Adaptive Foundation (3–4 engineering weeks)
  - lb-variant-selector island (product detail reactive variant selection)
  - lb-newsletter-signup island (newsletter form with Turnstile)
  - lb-password-toggle island (account settings form)
  - lb-cart CRUD mutations (removeFromCart, updateQuantity, clearCart)
  - Blog index API + blog-index section (parallel backend + frontend)
  - Adaptive preset infrastructure: apply-preset action, grocery/fashion/electronics presets
  - Section parallel rendering refactor (Promise.all)
  - Uncaught render error mitigation (try/catch → React fallback)
  - Target: 18 of 18 hybrid routes fully Liquid-capable; 12 islands registered; 3 industry presets

Phase D 🔲 Platform Default + Scale (3–6 months, ARB-gated)
  - ARB evidence package: render parity, SSTI/XSS gate, P95 latency ≤ 200ms
  - ARB approval → THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true
  - Vertical section schemas (13 new sections across 5 verticals)
  - Customer segment override layer (AI-driven personalization)
  - Theme marketplace production deployment (requires ARB reopen)
  - Password gate route type
  - AI-assisted section content generation (MCP integration)
  - Target: Liquid is the storefront default; React is a documented exception (checkout only)
```

---

## What Should NEVER Become Liquid

**`/checkout` (permanent React, by payment contract)**
The Razorpay SDK requires an imperative `new window.Razorpay(options).open()` call with an async payment callback. `useRef` idempotency keys (`crypto.randomUUID()` persisted across re-renders) prevent duplicate orders. The multi-step Address → Payment wizard uses `useState` transitions. COD order creation and inline success rendering require React state. Real-time shipping rates are fetched against the browser-owned cart total. All six of these patterns are fundamentally incompatible with server-side Liquid rendering. Attempting to Liquid-ify checkout would break payments.

**Editor shell (permanent React, lives in merchant-control-plane)**
`CenterPanel.tsx`, `SchemaFormRenderer.tsx`, `ThemeEditorInner` (section tree, settings panel, undo/redo machine, publish bar) — these are admin SPA components, not storefront content. They use cross-origin `postMessage` to the preview iframe, `useState`/`useEffect`/`useRef` for draft state, `@letbuyy/ui` design-system components, file upload handling, and controlled form inputs. None of these are renderable in Liquid. They live in a different app (`merchant-control-plane`), a different origin, and a different deployment.

**`EditorPreviewSectionFrame` (React path only; JS bridge replaces it for Liquid)**
For React-rendered sections, this component stays React. For Liquid-rendered sections, a vanilla JS bridge script (injected only in `editorMode=true`) replaces its functionality. Attempting to hydrate a React component inside Liquid-rendered HTML would break the DOMPurify-sanitized static output.

**All merchant-control-plane pages (products, orders, customers, billing, settings)**
These are React SPAs, not content pages. They require complex form state, optimistic UI, data tables with sorting/pagination, modal dialogs, toast notifications, and `@letbuyy/ui` design system components. Liquid is a content rendering system, not an admin UI framework.

---

## Architecture Decision Log

| Decision | Rationale | Evidence |
|----------|-----------|---------|
| Checkout remains React permanently | Razorpay SDK requires imperative `new window.Razorpay().open()` callback; idempotency keys require `useRef` persistence across re-renders; COD in-flow success screen requires `useState`; real-time shipping rates require browser cart access at SSR time | `checkout-client.tsx` lines 156–601; doc 07 "Checkout Special Analysis" |
| Theme editor shell remains React permanently | Admin SPA in a different app/origin/deployment; uses `postMessage`, controlled forms, file upload, `@letbuyy/ui` design system; has no storefront rendering context | `CenterPanel.tsx`, `SchemaFormRenderer.tsx`, `ThemeEditorInner`; doc 04 "What Should Remain React Permanently" |
| Platform-wide Liquid flip is ARB-gated | Irreversible default change; requires render parity evidence, SSTI/XSS gate, and performance data before risk is acceptable | `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status: 'deferred', authority: 'ARB' }` in `theme-governance.ts` |
| Single core theme + multiple presets (not separate vertical themes) | `settings_data.presets` contract already exists; theme-marketplace is frozen (ART-17 blocks new packages); Urban Kicks builder functions are additive; avoids duplicating security-critical sections across N bundles | `ThemeBundleSettingsDataSchema` shape; doc 08 "Recommended Approach"; ART-17 freeze |
| `{% render %}` and `{% include %}` forbidden in Liquid source | Prevent server-side template injection (SSTI); arbitrary file inclusion via sub-render could bypass the Zod ingestion guard | `ThemeLiquidSourceSchema` `forbiddenFragments` list; blocks are rendered by TypeScript layer instead |
| Money totals never computed in browser | Prevents client-side price manipulation; consistent with canonical ledger policy | `renderLiquidCartTotals()` reads only from `LiquidServerCart`; `lb_cart_server` in localStorage holds gateway response verbatim; doc 01 invariant 6 |
| `EditorPreviewSectionFrame` replaced by JS bridge for Liquid | React component cannot be mounted inside DOMPurify-sanitized Liquid HTML without breaking the static output; a vanilla JS script achieves the same postMessage protocol without React | doc 04 "What Would Need to Change"; doc 07 "Editor Preview React (partial target)" |
| Theme marketplace frozen by ARB | ART-17 + explicit `runtime.manifest.json` governance decision; reopen requires ARB approval | `apps/theme-marketplace/runtime.manifest.json` `deploymentAuthority.platform = "frozen-not-deployed"` |
| Sections with no React fallback are Liquid-first by design | 18 of ~35 Urban Kicks sections (`cart-summary`, `search-box`, `collection-*`, all `customer-*`) have no matching React `renderer_key` — they were authored as Liquid-first sections, not migrated React sections | doc 03 section coverage table; `renderer-registry.tsx` `SECTION_RENDERER_DEFINITIONS` |
| Dairy/fresh-produce vertical deferred | Platform subscriptions domain is NOT IMPLEMENTED; theme sections alone cannot deliver subscription ordering | LCIS v11 honest "NOT IMPLEMENTED" for subscriptions domain; doc 08 "Dairy/Fresh Produce" gap analysis |

---

## Research Methodology

This research series was conducted on 2026-06-18 as a read-only audit of the LetBuyy codebase. No code was modified during the research.

Each document was produced by direct source reading of the relevant packages and apps:
- `packages/theme-engine/src/` — the shared theme contract, renderer, governance constants
- `apps/storefront-runtime/src/lib/theme-engine/` — the per-request render pipeline
- `apps/storefront-runtime/src/app/store/[subdomain]/` — every customer-facing route file
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/` — the WYSIWYG editor
- `apps/merchant-control-plane/src/components/theme-editor/` — CenterPanel, SchemaFormRenderer
- `apps/theme-marketplace/src/` — the frozen marketplace app
- `services/api-gateway/src/routes/themes.ts` — the Hono REST API surface
- `services/api-gateway/src/execution/theme-execution.adapter.ts` — the DB adapter

Coverage percentages were derived from first-principles counting against the `StorefrontRouteType` union in `types.ts` (17 non-layout values) and the `LiquidThemePackageBundle` fixture in `theme-bundle.ts`. No estimates were used; all counts reflect actual code.

The LCIS OMEGA-FIRST protocol was respected: LCIS queries (`/api/blast`, `/api/domain`, `/api/search-v2`) were the first resort for architectural questions; direct source reading was the validation step, not the discovery step.
