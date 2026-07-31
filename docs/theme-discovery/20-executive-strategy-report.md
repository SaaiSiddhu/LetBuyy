# Executive Strategy Report — LetBuyy Theme Platform

_Generated: 2026-06-18. Synthesis of discovery documents 10–19 and the theme-research README._

---

## Executive Summary

LetBuyy's theme platform is built on a production-hardened Liquid engine with 74% storefront route coverage, 40 section types, 9 hydration islands, and a three-layer security pipeline — the foundation is sound and ahead of most comparable platforms at this stage. The critical gap is not the engine itself but the missing operational layer that connects the engine to merchant value: there is no preset activation path, no LetBuyy Core theme (every Liquid-compiled store currently inherits Urban Kicks branding), no industry/vertical capture in the onboarding flow, and no MCP authentication strategy despite 26 gateway APIs being immediately callable by an AI agent. The recommended path is a three-tier 90-day build sequence: first resolve the three foundation blockers (Core theme identity, preset schema + API, Liquid editor preview bridge), then ship the first three vertical presets and the 7-tool MCP server, and finally wire AI store generation into onboarding — delivering a fully AI-native commerce platform by Day 90 without touching the frozen theme marketplace or requiring ARB approval for any Phase B or Phase C item.

---

## What We Know Now (Facts, Not Opinions)

1. **The Liquid engine is production-hardened, not experimental.** Defense-in-depth security (Zod ingestion schema + LiquidJS `outputEscape:'escape'` + DOMPurify JSDOM with FORBID lists), 13 test files covering layers L2–L13, and 18 of 21 storefront routes already on the Liquid path. Evidence: `packages/theme-engine/src/theme-renderer.ts`, `theme-bundle.ts` test suite.

2. **Urban Kicks branding is embedded in every Liquid-compiled store.** `compilePortableToLiquidBundle()` calls `createUrbanKicksLiquidThemeBundleFixture()` as the base for ALL stores compiled to Liquid — the `- Urban Kicks` title suffix, `lb-theme--urban-kicks` body class, and `storeName: 'Urban Kicks'` header/footer defaults are injected into every merchant's storefront. This is the highest-priority correctness fix. Evidence: `portable-to-liquid.ts`, doc 10 Section 3 "Key coupling risk."

3. **Preset infrastructure exists at the schema layer but has no activation path anywhere in the system.** `ThemeBundleSettingsDataSchema` has a `presets` field; `Urban Kicks` does not populate it; there is no `POST /v1/themes/:slug/apply-preset` route, no `ThemeExecutionAdapter.applyPreset()` method, and no merchant-control-plane action that reads from `settings_data.presets`. Evidence: `themes.ts` (1,493 lines, zero `/preset` route matches), doc 11 Section 7.

4. **26 of 31 MCP tool candidates are backed by existing, callable gateway APIs today.** The missing 5 are: `apply_preset` (2–3 days once presets are defined), `update_section_settings` (partial — requires read-modify-write), `generate_navigation` (3–5 days), `GET /themes/store/:storeId/active` (1 day), and `generate_store_from_description` (3–4 weeks). Evidence: doc 15 readiness classification table.

5. **The theme editor has a confirmed latent postMessage bug.** `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` (all caps) but `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected` (past tense, different casing). These strings do not match. Section selection highlight in the preview may be broken for React-rendered sections as well as Liquid. Evidence: doc 17 Section 4 "Key message naming inconsistency."

6. **The web onboarding wizard hardcodes `theme_id = 'modern'` and collects no industry/vertical data.** The `Step4Schema` (industry, brand_tone, business_goal) exists in `packages/tenant-core` and is used by the mobile wizard but is never wired into the 3-step web wizard. Every web-created store receives an empty shell with `theme_id = 'modern'` (possibly a ghost DB reference). Evidence: `onboarding/page.tsx:296`, doc 18 Section 1 pain points.

7. **Full vertical presets for grocery, electronics, and fashion are achievable as pure JSON today using only existing section types.** A complete preset requires: `settings_data` color/font override + `templates` section order + per-section settings. No new Liquid source is needed for the first three verticals at the 80% level. The missing section types (`nutrition-table`, `product-specs`, `lookbook`) are Phase D extensions. Evidence: doc 11 Section 6 "Can Presets Be Pure JSON?" verdict table.

8. **The theme marketplace is code-complete but frozen by ARB.** `deploymentAuthority.platform = "frozen-not-deployed"`. The source is complete; 9 operational items (Vercel project, secrets, GSTIN, payout wiring) are all that stand between the code and production. No marketplace deployment is possible without ARB reopen. Evidence: `apps/theme-marketplace/runtime.manifest.json`, doc 16 Section 6.

9. **AI store generation for electronics and fashion is 75–70% feasible with current APIs.** `POST /v1/stores`, `PATCH /v1/stores/:id`, `POST /v1/themes/:slug/install`, `PUT /v1/themes/:slug/editor/draft`, `POST /v1/products/collections`, `PUT /v1/pages/navigation/:location`, `POST /v1/pages/policies`, `POST /shipping/zones` and `POST /shipping` all exist and are AI-callable. The primary gap is the `apply_preset` endpoint. Evidence: doc 13 Section 3 API table and feasibility scores.

10. **Dairy and restaurant verticals are fundamentally blocked by missing platform domains.** Dairy requires subscriptions (confirmed NOT IMPLEMENTED in LCIS v11 — no `/v1/subscriptions` route, no table). Restaurant requires menu modifiers and delivery slot ordering. These are not theme-engine gaps; they are new platform domains. Marketing these verticals without this disclosure creates merchant churn risk. Evidence: doc 13 dairy/restaurant gap analysis, LCIS v11 "NOT IMPLEMENTED."

11. **Font loading is completely absent.** `headingFontFamily` and `bodyFontFamily` accept font name strings but no `@font-face` or Google Fonts `<link>` is emitted. Every preset specifying a non-system font silently falls back to `system-ui`. Evidence: doc 10 Section 5 "Missing asset management," doc 11 Section 7 item 7.

12. **The rollback button in the theme editor VersionTree is not wired.** The `POST /themes/:slug/releases/:releaseId/rollback` API is complete and tested; the UI renders the release history but has no rollback button calling the API. A one-day UI task completes a fully functional rollback workflow. Evidence: doc 17 Section 2 gap table, doc 14 Section 1 row 12.

---

## Current State Scorecard

| Dimension | Current State | Evidence |
|---|---|---|
| Liquid Coverage | 74% of `StorefrontRouteType` values (14 of 17 non-layout types); 100% section coverage within Urban Kicks bundle; `page`, `article`, `not_found`, `password`, `blog` templates missing | README scorecard; `theme-bundle.ts` template map |
| Preset System | Schema container exists (`settings_data.presets`); zero preset definitions written; zero activation code anywhere in the system | `createUrbanKicksLiquidThemeBundleFixture()` — `presets: {}` default; `themes.ts` — no `/preset` route |
| AI Store Generation | 26 of 31 required MCP tools backed by existing APIs; `apply_preset` and `generate_store_from_description` missing; onboarding wizard collects no vertical data | Doc 13 feasibility table; doc 15 readiness classification |
| MCP Readiness | No MCP server exists; `@modelcontextprotocol/sdk` absent from all `package.json`; `graphify-mcp` is the only registered MCP (code-graph only, not LetBuyy API); 26 tools callable today with zero new backend work if auth is resolved | Doc 15 Section 2 evidence summary |
| Theme Editor Liquid Preview | Routing works; section click-to-select NOT wired for Liquid sections; confirmed postMessage type-name bug (may affect React sections too); rollback button not wired | Doc 17 Section 4; doc 17 Section 2 gap table |
| Marketplace Status | Frozen: `deploymentAuthority.platform = "frozen-not-deployed"`; code is complete; 9 operational items block launch; ARB reopen required | `runtime.manifest.json`; doc 16 Section 1 |
| Core Theme Generalization | Urban Kicks branding embedded in every Liquid-compiled store via `compilePortableToLiquidBundle()`; `getDefaultStorefrontThemeTemplate()` hardcodes `themeId: 'urban-kicks'`; web onboarding sends `theme_id: 'modern'` (possibly ghost reference) | `portable-to-liquid.ts`; `theme-registry.ts`; `onboarding/page.tsx:296` |

---

## What Should Be Built Next

### Tier 1: Build Now (Days 1–30)

---

**Initiative:** LetBuyy Core theme fixture + bundle generalization

**What It Does:** Renames `createUrbanKicksLiquidThemeBundleFixture()` to `createLetbuyyCoreLiquidThemeBundleFixture()`, removes Urban Kicks branding from `compilePortableToLiquidBundle()`, and updates `getDefaultStorefrontThemeTemplate()` to reference `'letbuyy-core'`.

**Why Now:** Every Liquid-compiled store currently inherits `- Urban Kicks` in the browser tab title, `lb-theme--urban-kicks` on the body element, and `storeName: 'Urban Kicks'` in header/footer defaults. This is a correctness defect affecting every merchant on the Liquid path today. It blocks all subsequent preset work because preset activation has no well-typed target until a Core bundle exists.

**Required Work:**
- `packages/theme-engine/src/theme-bundle.ts` — rename function, update `package.slug` to `'letbuyy-core'`, fix layout `<title>` and `<body class>`, change header/footer `storeName` defaults to `'{{ shop.name }}'`, neutralize hero/newsletter copy, remove fashion-specific category blocks
- `packages/theme-engine/src/portable-to-liquid.ts` — update `compilePortableToLiquidBundle()` to call the Core fixture
- `packages/theme-engine/src/theme-registry.ts` — update `getDefaultStorefrontThemeTemplate()` to `themeId: 'letbuyy-core'`
- Verify or seed `themes` table row with `slug = 'letbuyy-core'` (resolves Unknown C-08)

**Unblocked By:** No ARB approval required. No new routes. Pure rename + default change inside one package.

**Expected Outcome:** All newly compiled Liquid stores display the merchant's own store name. `compilePortableToLiquidBundle()` produces a neutral base. Preset activation has a valid target bundle.

**Risk:** LOW — contained refactor in `packages/theme-engine`. The only downstream dependency is tests referencing `'urban-kicks-liquid'`; these must be updated to use `'letbuyy-core'`.

---

**Initiative:** `ThemePresetDocumentSchema` Zod type + three industry preset definitions

**What It Does:** Defines the canonical JSON schema for a preset document (id, name, settings_data delta, templates map, metadata.requires_sections) and writes grocery, electronics, and fashion presets as the first three concrete instances.

**Why Now:** This is the data that the activation API (next initiative) will consume. Writing schemas and data before the API ensures the API is designed to fit the real data shape. All subsequent vertical work, MCP tooling, and AI generation assumes these presets exist. Resolves Unknown C-02 and Unknown C-07.

**Required Work:**
- `packages/theme-engine/src/theme-bundle.ts` — add `ThemePresetDocumentSchema` Zod export
- Grocery preset: green palette, FSSAI trust badges, same-day delivery hero, 7-section homepage (already fully specified in doc 11 Section 8)
- Electronics preset: navy/blue palette, tech product grid, warranty trust badges, 7-section homepage (doc 11 Section 5)
- Fashion preset: dark/red palette, banner carousel, lookbook-style category grid, 7-section homepage (doc 11 Section 5)
- Populate `settings_data.presets` in `createLetbuyyCoreLiquidThemeBundleFixture()` with these three preset objects

**Unblocked By:** Requires Core theme fixture (previous initiative). Schema design: half-day. Writing three presets: 1–2 days.

**Expected Outcome:** Three validated, Zod-typed preset objects in the Core bundle. A `ThemePresetDocumentSchema` that all future preset authors target.

**Risk:** LOW — pure data authoring plus one new Zod type. Zero production code changes.

---

**Initiative:** `POST /v1/themes/:slug/apply-preset` gateway endpoint

**What It Does:** Accepts `{ store_id, preset_key, merge_mode: 'replace' | 'merge' }`, loads the preset from `bundle.config.settings_data.presets[preset_key]`, validates required sections are present, merges the preset's settings_data into `settings_data.current` and templates into the live template map, and calls `saveDraft()`. Does NOT auto-publish.

**Why Now:** This is the single highest-leverage API gap. Without it, AI store generation requires constructing the entire `settings_data.current` payload manually (fragile and error-prone), MCP `apply_preset` cannot exist, and onboarding AI cannot apply a vertical configuration in one call. All three downstream initiatives depend on it.

**Required Work:**
- `services/api-gateway/src/execution/theme-execution.adapter.ts` — add `applyPreset(storeId, presetKey, mergeMode)` method
- `services/api-gateway/src/routes/themes.ts` — add `POST /:slug/apply-preset` route with `verifySiteOwnership` guard
- Pre-flight check: verify all `preset.metadata.requires_sections` exist in the store's active bundle before applying
- Activation writes to draft only (merchant reviews before publishing — aligns with the "preset activation: draft-only" architectural decision)

**Unblocked By:** Requires `ThemePresetDocumentSchema` and the three preset definitions. 2–3 hours implementation once the schema is defined.

**Expected Outcome:** `POST /v1/themes/letbuyy-core/apply-preset { store_id, preset_key: 'grocery-india-v1' }` writes a complete vertical configuration to the store's draft. Merchant can preview and publish.

**Risk:** LOW — follows the existing `saveDraft()` pattern; no money mutation; fully reversible via draft discard or rollback.

---

**Initiative:** Fix postMessage type-name inconsistency + wire rollback button in editor

**What It Does:** Resolves the mismatched postMessage event names between `CenterPanel` and `EditorPreviewSectionFrame` so section selection highlighting works. Wires the rollback button in `VersionTree` to call the existing `POST /themes/:slug/releases/:releaseId/rollback` API.

**Why Now:** The postMessage bug means preset application is invisible to merchants who cannot click sections in the preview to select them in the sidebar (Unknown C-04). The rollback button absence means merchants who apply a preset and dislike the result have no visible recovery path in the UI. Both are 1-day fixes. Both significantly increase merchant trust in the preset system.

**Required Work:**
- `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` — standardize postMessage type name for editor → preview direction
- `apps/merchant-control-plane/src/components/theme-editor/editor-preview-section-frame.tsx` — match listener to same canonical name
- `apps/merchant-control-plane/src/components/theme-editor/VersionTree.tsx` — add rollback `<Button>` calling the existing API client method
- Verify the fix end-to-end in dev before proceeding to Liquid bridge work

**Unblocked By:** No external dependencies. These are self-contained UI changes.

**Expected Outcome:** Clicking a section in the editor preview selects it in the sidebar (both React and future Liquid). Merchants can roll back to any previous release with one click.

**Risk:** LOW — no API changes; no DB changes; two files changed.

---

**Initiative:** Google Fonts loading mechanism in the theme renderer

**What It Does:** Adds a `LIQUID_THEME_FONT_MAP` to `theme-renderer.ts` mapping known web font names to Google Fonts `@import` URLs, and injects a `<link rel="preconnect">` + `<link rel="stylesheet">` in `buildLiquidThemeHeadAssets()` when `headingFontFamily` or `bodyFontFamily` is a known non-system font. Changes `headingFontFamily`/`bodyFontFamily` schema field type to `select` with 8–10 curated options.

**Why Now:** Typography is the primary visual differentiator between verticals. A jewelry preset with `"Cormorant Garamond"` must look different from an electronics preset with `"Inter"`. Without font loading, 40–50% of the visual differentiation value of presets is lost. This is a 1–2 day fix. Resolves Unknown C-06.

**Required Work:**
- `packages/theme-engine/src/theme-renderer.ts` — add `LIQUID_THEME_FONT_MAP`, update `buildLiquidThemeHeadAssets()` to emit font `<link>` tags
- `packages/theme-engine/src/theme-bundle.ts` — change `headingFontFamily`/`bodyFontFamily` from `text` to `select` in the settings schema with curated Google Fonts options
- Privacy review flag: document that Google Fonts requests involve an external DNS lookup; evaluate sub-resource integrity and whether this meets DPDP Act 2023 requirements for production

**Unblocked By:** No prerequisites. Additive change to the renderer.

**Expected Outcome:** Applying the jewelry preset renders `Cormorant Garamond`; the grocery preset renders `Inter`; the fashion preset renders `Playfair Display`. Visual differentiation between presets is immediately visible.

**Risk:** LOW for implementation. MEDIUM for privacy: Google Fonts requests carry the visitor's IP to Google. Flag for privacy review before production deploy.

---

**Initiative:** Vanilla JS Liquid editor bridge script

**What It Does:** Creates `apps/storefront-runtime/src/lib/theme-engine/liquid-editor-bridge.ts` — a plain JS module injected into the preview iframe when `editorMode=true && liquid_ready=true`. Wires `[data-section-id]` elements in Liquid-rendered HTML to the same `postMessage` protocol used by `EditorPreviewSectionFrame` in React mode. Also adds `data-section-id` wrapper elements to Urban Kicks Liquid section templates.

**Why Now:** Without this bridge, clicking a Liquid-rendered section in the editor preview does nothing. Merchants applying Liquid presets cannot select sections to edit their settings. The postMessage protocol and preview token infrastructure are already correct; only the DOM event wiring is absent.

**Required Work:**
- `apps/storefront-runtime/src/lib/theme-engine/liquid-editor-bridge.ts` — implement `initLiquidEditorBridge()` (querySelectorAll `[data-section-id]`, attach click handlers, listen for selection highlight signal)
- `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` — inject bridge script when `editorMode=true`
- Urban Kicks section templates — wrap each section in `<div data-section-id="{{ section.id }}" data-letbuyy-editor-section-type="{{ section.type }}">...</div>`
- `liquid_ready` flag gates bridge activation (already set in `buildReleaseArtifacts()`)

**Unblocked By:** Requires the postMessage fix (previous initiative) to be completed first so canonical message names are established.

**Expected Outcome:** Clicking a Liquid-rendered section in the editor preview selects it in the sidebar. The full WYSIWYG editing flow works for Liquid themes.

**Risk:** LOW — the bridge script runs only in `editorMode=true` (preview URLs only, never on live storefronts). DOMPurify does not sanitize editor-injected scripts; the `<script>` tag is injected by `composition-engine.tsx` server-side, not from Liquid source.

---

### Tier 2: Build Soon (Days 31–60)

---

**Initiative:** 7-tool MCP server (Theme Configuration Agent)

**What It Does:** A Cloudflare Worker or Node.js process using `@modelcontextprotocol/sdk` exposing 7 tools: `get_store_config`, `get_theme_schema`, `get_editor_state`, `save_draft`, `apply_preset`, `create_preview_session`, `publish_theme`. Accepts ES256 merchant JWT as `Authorization: Bearer` header.

**Why Now:** 26 gateway APIs are callable today. Adding `@modelcontextprotocol/sdk` and writing 7 thin wrapper functions is 2–3 days. The `apply_preset` tool unblocks the AI onboarding flow. MCP authentication must be decided first (Unknown C-05): recommend store-scoped API key minting (`POST /v1/api-keys`) for programmatic agents.

**Required Work:**
- New package `services/mcp-server` (Cloudflare Worker or Node.js)
- `@modelcontextprotocol/sdk` dependency
- 7 tool implementations wrapping existing gateway calls
- `POST /v1/api-keys` gateway route for store-scoped API key minting (if chosen over OAuth PKCE)
- Resolve Unknown C-05 (auth strategy decision) before implementation begins

**Unblocked By:** Requires `apply_preset` endpoint (Tier 1). Requires auth strategy decision.

**Expected Outcome:** Claude or any MCP-capable AI model can read a merchant's store state, apply a vertical preset, generate a preview URL, and publish the theme in a single conversation — without the merchant opening the merchant-control-plane.

**Risk:** MEDIUM — new service deployment; auth token handling must be implemented correctly; 409 conflict responses from concurrent editor sessions must be handled gracefully.

---

**Initiative:** Template coverage completion (Days 31–45)

**What It Does:** Adds the five missing Liquid templates: `page`, `article`, `not_found` (low effort), `search` (page.tsx only needed), and `password` (storefront proxy middleware). Also adds the missing 4 CSS token slots (`secondaryColor`, `backgroundColor`, `textColor`, `borderColor`) to the Core bundle.

**Why Now:** These are Phase B quick wins from the research README. `page` and `not_found` are 2–4 hour tasks each. `search` requires only a `page.tsx` file (the template already exists in Urban Kicks). `article` requires a new `article` drop field but the backend exists. `password` requires proxy middleware.

**Required Work:**
- `packages/theme-engine/src/theme-bundle.ts` — add `page-content`, `article-content`, `not-found` Liquid section files and templates; add 4 missing CSS token slots
- `apps/storefront-runtime/src/app/store/[subdomain]/search/page.tsx` — create missing page file (template exists)
- `apps/storefront-runtime/src/app/store/[subdomain]/not-found.tsx` — Next.js App Router convention
- `apps/storefront-runtime/src/proxy.ts` — add password gate middleware for `sites.status = 'draft'`
- Resolve Unknown H-04 (verify `search` drop is populated before adding page.tsx)

**Unblocked By:** Requires Core bundle (Tier 1). Template additions are independent.

**Expected Outcome:** 100% `StorefrontRouteType` Liquid template coverage (except `blog` — requires backend). Core CSS token system fully populated.

**Risk:** LOW — additive template additions. `password` middleware carries MEDIUM risk (proxy.ts is live middleware; must not break existing routes).

---

**Initiative:** `lb-cart` CRUD mutations + `lb-variant-selector` island

**What It Does:** Implements `removeFromCart`, `updateQuantity`, `clearCart` mutations in the `lb-cart` custom element (enabling full cart page Liquid coverage), and creates the new `lb-variant-selector` island for reactive variant selection on product detail pages.

**Why Now:** The cart page is the highest-traffic commerce page. The React `CartPageClient` fallback cannot be retired until mutations exist. The `lb-variant-selector` is needed to retire `ProductDetailsClient`. Together these complete the Phase C island work, enabling full Liquid coverage of all commerce flows.

**Required Work:**
- `lb-cart` island — add `DELETE /v1/storefront/:subdomain/cart/items/:itemId`, `PATCH /v1/storefront/:subdomain/cart/items/:itemId`, `DELETE /v1/storefront/:subdomain/cart` calls; verify these gateway routes exist (Unknown H-05)
- `lb-variant-selector` — new custom element; calls `/api/storefront/{subdomain}/products/{id}/variant?options=...`; reads price from `data-product-price` (server-rendered minor-unit integer); formats via `formatInrCurrency` (never derives price in browser)

**Unblocked By:** Requires verification that gateway cart mutation routes exist. No ARB approval needed.

**Expected Outcome:** Full cart interaction (add, remove, update quantity, clear) works in Liquid mode. Variant selection updates price/stock display without page reload. React fallback components for cart and product detail can be retired.

**Risk:** MEDIUM — cart mutations touch order-adjacent flows. Price display in `lb-variant-selector` must never derive totals in the browser (canonical-ledger-only validator requirement). All prices must come from server-rendered `data-*` attributes.

---

**Initiative:** Vertical industry capture in web onboarding + AI intent endpoint

**What It Does:** Adds a Step 1.5 to the 3-step web onboarding wizard (vertical picker: 6–8 tiles for Indian commerce verticals). After vertical selection, calls `POST /onboarding/ai-intent` to get AI-suggested theme, tagline, SEO text, and brand color. Passes enriched payload to `POST /stores` at creation time.

**Why Now:** Without vertical capture, AI store generation has no input. The `Step4Schema` already has the right fields in `packages/tenant-core`. This is the onboarding hook that makes presets useful at merchant acquisition time. Resolves Unknown C-15 and unblocks the AI store generation flow.

**Required Work:**
- `apps/identity-platform/src/app/onboarding/page.tsx` — add Step 1.5 vertical picker UI between existing steps
- `services/api-gateway/src/routes/onboarding.ts` — add `POST /onboarding/ai-intent` endpoint (calls AI inference, returns `{ suggested_theme_id, tagline, seo_title, seo_description, brand_color, starter_collections[] }`)
- Wire `Step4Schema.industry`, `brand_tone` fields into the `POST /stores` create payload
- Replace hardcoded `templateId: 'modern'` with AI-selected theme UUID from `/onboarding/templates`
- Fallback: if AI intent call fails, default to current behavior (zero regression)

**Unblocked By:** Requires `apply_preset` endpoint (Tier 1) to be callable post-creation. Requires the three industry preset definitions.

**Expected Outcome:** A merchant selecting "Grocery" at onboarding gets a store created with the grocery preset applied as a draft, correct starter collections, and AI-generated tagline/SEO — all within 5 minutes of registration.

**Risk:** MEDIUM — onboarding is a critical acquisition flow; any regression in the current 3-step wizard path would harm conversion. Fallback to current behavior is hardened. Vertical picker is additive (new step, not replacement).

---

### Tier 3: Build Later (Days 61–90)

---

**Initiative:** Queue-worker store scaffold (async post-creation)

**What It Does:** A new `store.created` domain event handler in `services/queue-workers` that fires after store creation and creates: 2–3 starter collections appropriate to the detected vertical, a main navigation menu linking to those collections, and About/Contact placeholder CMS pages.

**Why Now (Day 61+):** Depends on vertical capture (Tier 2) and collection/navigation APIs being confirmed callable. The async pattern (fire-and-forget after `store.created`) means zero regression risk to the synchronous creation path.

**Required Work:**
- `services/queue-workers` — add `store.created` handler with `industry` from `store_ai_generation_intents` table
- New table `store_ai_generation_intents` (doc 18 Section 7 data model)
- Call `POST /v1/products/collections` (3 collections), `PUT /v1/pages/navigation/main`, `POST /v1/pages` (About, Contact) with AI-generated content
- Extend `CreateStoreSchema` to accept `tagline`, `seo_title`, `seo_description` at creation time

**Unblocked By:** Requires AI intent endpoint (Tier 2) to provide vertical context. Requires vertical-appropriate collection names per vertical.

**Expected Outcome:** A newly created grocery store has "Vegetables", "Fruits", "Dairy" collections and a populated main navigation within 30 seconds of registration.

**Risk:** LOW — async fire-and-forget; failure does not affect store creation; merchant sees an empty store (current behavior) on failure.

---

**Initiative:** ARB evidence package for platform-wide Liquid default flip

**What It Does:** Compiles the render parity matrix, SSTI/XSS gate results, P50/P95 latency benchmarks for pages with 5–7 sections, and DOMPurify violation reports. Packages these as an ARB submission to flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`.

**Why Now (Day 61+):** All Phase B and Phase C work generates the evidence needed. The parallel section rendering refactor (`Promise.all` — a 1–2 hour fix) and uncaught render error mitigation (try/catch around `engine.parseAndRender()`) should be implemented before the evidence package is assembled, as both are required for production confidence.

**Required Work:**
- Implement `Promise.all` section rendering in `renderLiquidTemplateSections` (1–2 hours)
- Add try/catch around `engine.parseAndRender()` returning `null` to trigger React fallback (1–2 hours)
- Run performance benchmarks comparing React and Liquid render paths under load
- Compile SSTI/XSS gate pass record from existing 13 test files
- Submit ARB package with `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` status proposal

**Unblocked By:** Phase B and Phase C template + island completion. ARB requires evidence of production parity, not just code completeness.

**Expected Outcome:** ARB approval of `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`. Liquid becomes the default renderer for all new and existing stores. React is a documented exception (checkout only).

**Risk:** HIGH — this is an irreversible platform-wide default change. The governance constant `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` exists precisely to enforce that this decision is made with full evidence. Do not flip without the evidence package.

---

**Initiative:** Theme marketplace ARB reopen submission

**What It Does:** Prepares and submits the ARB reopen request for `apps/theme-marketplace`, resolving Unknown C-10. Does not implement any new marketplace code — the existing code is complete. The work is governance, operational wiring (Vercel project, secrets, GSTIN), and catalog seeding.

**Why Now (Day 61+):** Marketplace unfreeze enables Model B (preset marketplace) which in turn enables third-party preset authors and vertical extension themes. This is the revenue diversification path. ARB research (Unknown C-10) must be completed first.

**Required Work:**
- Review `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` for ARB marketplace trigger criteria
- Provision Vercel project for `apps/theme-marketplace`
- Wire `THEME_MARKETPLACE_GSTIN`, Razorpay key, `LETBUYY_API_URL`, `INTERNAL_API_SECRET`
- Seed `themes` table with 5–10 LetBuyy-authored presets for Phase 1 (Model B: preset marketplace)
- Confirm the install flow's `preset` parameter flows correctly to `sites.template_config.themeSettings`

**Unblocked By:** ARB reopen decision (Unknown C-10). All operational items are non-code changes except catalog seeding.

**Expected Outcome:** Theme marketplace deployed to `themes.letbuyy.com`. Merchants can browse and apply preset configurations. First-party presets available at launch.

**Risk:** HIGH — frozen deployment authority requires ARB approval. Timeline is ARB-gated and external to engineering.

---

## What Should NOT Be Built Next

| Initiative | Why Not | What Must Happen First |
|---|---|---|
| Dairy/fresh-produce vertical preset | Platform subscriptions domain is NOT IMPLEMENTED (LCIS v11 confirms no `/v1/subscriptions`, no subscription tables). A dairy preset sets expectations the platform cannot meet, causing merchant churn. | Subscriptions domain must be designed, built, and launched first. This is a new platform domain — weeks to months of work. |
| Restaurant/food service vertical | No menu modifier model, no delivery zone pincode configuration write API, no delivery slot ordering. The `option1/2/option3` variant model cannot represent add-ons and spice levels. | New domain work: modifier groups, pincode serviceability write API, delivery slot system. |
| Theme marketplace reactivation (code work) | Marketplace is frozen by ARB (`deploymentAuthority.platform = "frozen-not-deployed"`). Code changes to the marketplace before ARB approval violate governance. | ARB reopen decision. Governance research must be completed to determine the exact approval criteria (Unknown C-10). |
| A/B test variant management | Requires ARB approval (touches `publish_theme_release` RPC which is canonical ledger-adjacent). No `theme_release_variants` table, no variant-aware preview token resolution, no allocation control UI. | ARB approval confirmation that this does not constitute a "money mutation." Confirmed by Unknown M-02. |
| Platform-wide Liquid default flip (before evidence) | Irreversible platform-wide change. `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` is a governance constraint, not a technical limitation. Flipping without the ARB evidence package violates the governance model. | Complete Phase B + Phase C template and island work; compile render parity matrix, latency benchmarks, and SSTI/XSS gate results; submit ARB evidence package. |
| `blog` route Liquid template | The `blog` route type has no backend blog index API (`GET /v1/blog`). Whether a `blog_posts` table exists is unconfirmed (Unknown C-11). Adding the Liquid template without the data binding would produce an empty page. | Confirm `blog_posts` table existence via LCIS or DB query. If no table exists, new domain work is required (table + migration + gateway route + drop). |
| Third-party developer extension themes | Requires unfreezing the marketplace (ARB), defining a versioned section contract API, and implementing the developer listing → themes promotion pipeline (moderation queue in `platform-console`, Lighthouse measurement job, Razorpay Route payout). All three are blocked. | Marketplace unfreeze + section contract API design + promotion pipeline build. Model C extension layer is Phase 2 of the marketplace strategy. |

---

## Critical Path

```
[Resolve C-08: verify theme_id='modern' is a valid themes row]
  |
  v
[Create createLetbuyyCoreLiquidThemeBundleFixture()]
  |
  +--> [Update compilePortableToLiquidBundle() to use Core]
  +--> [Update getDefaultStorefrontThemeTemplate() to 'letbuyy-core']
  |
  v
[Write ThemePresetDocumentSchema Zod type]
  |
  v
[Write grocery / electronics / fashion preset definitions]
  |
  v
[Implement POST /v1/themes/:slug/apply-preset]
  |
  +--> [MCP apply_preset tool becomes available]
  +--> [AI onboarding can apply preset at store creation]
  |
  v
[Resolve C-05: decide MCP auth strategy (OAuth PKCE vs API keys)]
  |
  v
[Build 7-tool MCP server]
  |
  v
[Fix postMessage type-name bug in CenterPanel + EditorPreviewSectionFrame]
  |
  v
[Implement Liquid editor bridge script]
  |
  v
[Add font loading to buildLiquidThemeHeadAssets()]
  |
  v
[Add vertical capture step to web onboarding + POST /onboarding/ai-intent]
  |
  v
[Implement queue-worker store scaffold (collections, nav, pages)]
  |
  v
[Template completion: page, article, not_found, search, password]
  |
  v
[lb-cart CRUD mutations + lb-variant-selector island]
  |
  v
[Promise.all section rendering + try/catch render error mitigation]
  |
  v
[ARB evidence package: parity matrix + latency + SSTI gate]
  |
  v
[ARB approval -> THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true]

Parallel track (not on critical path but high value):
[Resolve C-10: ARB marketplace criteria]
  |
  v
[Provision Vercel project + wire secrets]
  |
  v
[Seed themes table with 5-10 LetBuyy presets]
  |
  v
[Theme marketplace deployed (Model B: preset marketplace)]
```

---

## Decision Points

These decisions MUST be made by humans before proceeding:

| Decision | Deadline | Who Decides | Context |
|---|---|---|---|
| MCP authentication strategy: OAuth PKCE vs store-scoped API key minting | Before Day 31 (before MCP server build starts) | Security lead + Engineering lead | OAuth PKCE reuses existing ES256 JWT infrastructure, requires browser consent flow. API key minting requires new `POST /v1/api-keys` gateway route, simpler for programmatic agents. Doc 15 Section 5 and Unknown C-05 provide full analysis. |
| Preset activation: draft-only vs auto-publish | Before Day 10 (before apply-preset endpoint is built) | Product lead | Draft-only (merchant reviews before publish) is safer but slower. Auto-publish is faster but immediately changes live storefront. Recommendation from doc 19: draft-only. Decision locks the API contract. |
| 80% preset (existing sections) vs full preset (requires new section authoring) for the first three verticals | Before Day 10 (before preset definitions are written) | Product lead | Grocery can achieve 80% preset with existing sections (viable for launch). Full grocery preset needs `nutrition-table` (new Liquid source). Decision determines Phase B scope. Unknown C-07. |
| Font loading strategy: Google Fonts vs self-hosted WOFF2 vs system-only | Before Day 15 (before font loading is implemented) | Engineering lead + Privacy review | Google Fonts is fast to implement but involves external DNS requests (DPDP Act 2023 data residency concern for Indian merchants). Self-hosted is privacy-safe but needs storage infrastructure. Unknown C-06 analysis. |
| ARB marketplace reactivation criteria | Before Day 61 (before marketplace infrastructure work begins) | ARB owner | Unknown C-10: the exact criteria in `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` must be identified. Is it evidence-based (nine operational items) or timeline-based? This gates all marketplace investment in Tier 3. |
| Single Core theme vs per-vertical base themes | Immediately (before any bundle work) | Engineering lead + ARB | Option A (one `letbuyy-core`, all verticals via presets) is strongly recommended by doc 19 architectural decisions. Option B (separate vertical base bundles) requires ART-17 re-approval for each new bundle. This decision is irreversible in the short term. |

---

## 30-60-90 Day Roadmap

### Day 1–30: Foundation

| Week | Initiative | Deliverable | Success Metric |
|---|---|---|---|
| Week 1 | Resolve C-08 (verify `theme_id='modern'`); create Core bundle fixture | `createLetbuyyCoreLiquidThemeBundleFixture()` in `theme-bundle.ts`; all Liquid-compiled stores display merchant store name (not "Urban Kicks") | Zero occurrences of "Urban Kicks" in page title or body class for non-Urban-Kicks test stores |
| Week 1 | Write `ThemePresetDocumentSchema` Zod type | New Zod export in `theme-bundle.ts`; validated against a test preset | TypeScript compile passes; Zod `.parse()` succeeds on the grocery preset draft |
| Week 2 | Write grocery, electronics, fashion preset definitions; populate Core bundle `settings_data.presets` | Three validated preset objects in the Core bundle; grocery preset is the reference implementation | All three presets pass `ThemePresetDocumentSchema.parse()`; requires_sections check passes against the Core bundle |
| Week 2 | Implement `POST /v1/themes/:slug/apply-preset` | New gateway route + adapter method; writes preset to draft (not live) | `POST /apply-preset { preset_key: 'grocery-india-v1' }` returns 200; store draft has grocery colors, section order, copy |
| Week 3 | Fix postMessage type-name bug; wire rollback button | `CenterPanel.tsx` and `EditorPreviewSectionFrame.tsx` use canonical names; `VersionTree.tsx` has rollback button | Clicking a React section in the preview selects it in sidebar; rollback button appears in VersionTree and executes rollback |
| Week 3 | Implement Google Fonts loading in renderer | Font `<link>` tags emitted for non-system fonts; `headingFontFamily`/`bodyFontFamily` become `select` fields | Grocery preset shows Inter (unchanged); jewelry preset shows Cormorant Garamond in browser |
| Week 4 | Decide MCP auth strategy (C-05); implement chosen path | API key route live (`POST /v1/api-keys`) OR OAuth PKCE confirmed using existing ES256 flow | An AI agent can obtain a valid Bearer token and call `GET /v1/themes/letbuyy-core/schema` successfully |
| Week 4 | Implement Liquid editor bridge script | `liquid-editor-bridge.ts`; `data-section-id` wrappers in Urban Kicks sections; bridge injected in `editorMode=true` | Clicking a Liquid-rendered section in editor preview selects it in the sidebar |

### Day 31–60: Presets and Generation

| Week | Initiative | Deliverable | Success Metric |
|---|---|---|---|
| Week 5 | Build 7-tool MCP server (Theme Configuration Agent) | New `services/mcp-server` package; 7 MCP tools deployed as Cloudflare Worker | Claude Code (or any MCP-capable model) can apply the grocery preset to a test store via `apply_preset` tool and receive a preview URL |
| Week 5–6 | Template coverage: `page`, `article`, `not_found`, `search`, `password` | Five new templates + section files in Core bundle; `not-found.tsx`; search `page.tsx`; proxy middleware for password gate | 100% `StorefrontRouteType` Liquid coverage (excluding `blog`); `storefront_pages` with `page_type='page'` renders in Liquid |
| Week 6 | Add vertical industry capture to web onboarding | New Step 1.5 in `onboarding/page.tsx`; 6–8 vertical tiles; `POST /onboarding/ai-intent` endpoint | A new registration with "Grocery" selected produces a store with `theme_id='letbuyy-core'` and grocery preset applied to draft |
| Week 7 | `lb-cart` CRUD mutations | `lb-cart` custom element handles remove/update/clear against gateway cart API | Cart page functional in Liquid mode: items can be removed and quantities updated without page reload |
| Week 7 | `lb-variant-selector` island | New `lb-variant-selector` custom element; price updates from `data-product-price` server attribute | Selecting a variant on the product detail page updates the displayed price and stock status without page reload; price never derived in browser JS |
| Week 8 | `lb-newsletter-signup` + `lb-password-toggle` islands | Two new custom elements; newsletter POST with Turnstile; password show/hide toggle | Newsletter form submits and shows inline success/error; password field toggles visibility |

### Day 61–90: AI-Native Commerce

| Week | Initiative | Deliverable | Success Metric |
|---|---|---|---|
| Week 9 | Queue-worker store scaffold | New `store.created` handler in `queue-workers`; `store_ai_generation_intents` table; 3 collections + nav + About/Contact pages created async | Within 30 seconds of a "Grocery" store creation, the store has Vegetables/Fruits/Dairy collections and a populated main navigation |
| Week 9 | Promise.all section rendering + try/catch render error mitigation | `renderLiquidTemplateSections` uses `Promise.all`; `engine.parseAndRender()` wrapped in try/catch returning `null` | P95 render latency for a 7-section home page reduced; LiquidJS render errors produce React fallback (not 500 error) |
| Week 10 | ARB evidence package assembly | Render parity matrix (14 routes: React vs Liquid output comparison); SSTI/XSS gate: all 13 test files pass; P50/P95 latency benchmarks | ARB evidence package submitted; document shows zero DOMPurify violations, P95 < 200ms for Liquid path |
| Week 10–11 | Marketplace ARB reopen submission (if C-10 resolved) | ARB reopen request submitted; Vercel project provisioned; secrets wired; 5–10 LetBuyy presets seeded in `themes` table | Marketplace accessible at `themes.letbuyy.com`; first-party presets browsable and installable |
| Week 12 | Final integration + end-to-end AI store generation test | Full journey: register → select Grocery → AI intent → store created with preset + collections + nav → preview URL → publish | A new merchant can go from registration to a preview-ready Grocery store with populated sections in under 5 minutes, using only the web wizard (no manual merchant-control-plane configuration) |

---

## Expected Outcomes

**At Day 30:** Urban Kicks branding fully removed from all Liquid-compiled stores. Three industry presets (grocery, electronics, fashion) defined and activatable via `POST /v1/themes/letbuyy-core/apply-preset`. Preset application writes to draft; merchant can preview and publish. Editor section click-to-select works for both React and Liquid sections. Font loading works for non-system preset fonts.

**At Day 60:** A 7-tool MCP server enables AI agents to configure any merchant's storefront programmatically. 100% storefront route type coverage in Liquid (minus blog). The web onboarding wizard collects merchant vertical and applies the matching preset automatically at store creation. `lb-cart` mutations and `lb-variant-selector` complete the interactive commerce islands, making full Liquid coverage of all commerce flows achievable.

**At Day 90:** A new merchant selecting "Grocery" at registration gets a complete, preview-ready store — with green palette, FSSAI trust badges, categorized collections, populated navigation, and AI-generated policy pages — within 5 minutes of signup, without opening the merchant-control-plane. The ARB evidence package is ready for submission. If the marketplace ARB reopen was approved, preset configurations are publicly browsable and installable from `themes.letbuyy.com`. The platform is architecturally ready for the `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` flip pending ARB approval.

---

## Top 5 Risks

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| R-01: `compilePortableToLiquidBundle()` continues polluting all merchant storefronts with Urban Kicks branding while Tier 1 work is delayed | HIGH (already happening) | HIGH — every Liquid-enabled merchant store has wrong title suffix, body class, storeName | Make Core bundle fixture the absolute first code change in Phase B. Block all other work until this is done. | Engineering lead |
| R-02: postMessage type-name bug in the editor is confirmed broken for React sections as well as Liquid | MEDIUM (unconfirmed) | HIGH — preset application would be invisible to merchants (cannot see what they are editing) | Test in dev environment on Day 1 as a diagnostic step before any editor work. If confirmed broken, treat as Day 1 emergency fix, not a Week 3 item. | Engineering lead |
| R-03: Dairy and restaurant vertical presets are shipped without subscriptions/modifier infrastructure, creating merchant expectations the platform cannot meet | HIGH (if these verticals are marketed) | HIGH — merchant churn; support cost; platform reputation damage | Do not include dairy or restaurant in any Phase B or Phase C marketing. Add "coming soon" gating on these verticals in the onboarding vertical picker. | Product lead |
| R-04: AI-generated policy pages (privacy policy, returns policy, terms of service) contain legally incorrect text under Indian Commerce regulations (Consumer Protection Act 2019, IT Act 2000, DPDP Act 2023) | MEDIUM (AI outputs are generic English) | HIGH — merchant regulatory exposure; LetBuyy legal exposure | All AI-generated policy pages must display: "This is a template generated by AI. Review with a qualified legal professional before publishing." Do not auto-publish AI-generated policies. | Legal + Product lead |
| R-05: LiquidJS render errors propagate uncaught and crash the Next.js storefront (500 error) rather than falling back to React | MEDIUM (any section exceeding `renderLimit:250` or `memoryLimit:2_000_000`) | HIGH — storefront outage for affected stores; no graceful degradation | Add try/catch around `engine.parseAndRender()` in `renderLiquidTemplateSections` returning `null` on exception. This triggers the existing React fallback path. Schedule this for the Day 61–90 phase at the latest; it should be done in Week 9. | Engineering lead |

---

## Dependencies and Blockers

| Initiative | Depends On | External Dependency | Internal Blocker |
|---|---|---|---|
| LetBuyy Core bundle fixture | Resolving Unknown C-08 (is `theme_id='modern'` a valid DB row?) | None | Must complete before all other theme work |
| Preset JSON definitions | Core bundle fixture; `ThemePresetDocumentSchema` Zod type | None | Product decision on 80% vs full presets (Unknown C-07) |
| `POST /v1/themes/:slug/apply-preset` | Preset JSON definitions | None | None once preset schema is defined |
| 7-tool MCP server | `apply_preset` endpoint; auth strategy decision (C-05) | `@modelcontextprotocol/sdk` npm package | Auth strategy decision must be made first |
| Liquid editor bridge | postMessage bug fix; `data-section-id` in section templates | None | postMessage fix must ship before bridge to use canonical names |
| Font loading | None | Google Fonts (external CDN) or self-hosted storage | Privacy review required before production deploy |
| Vertical onboarding + AI intent | `apply_preset` endpoint; vertical preset definitions | Anthropic API key (`AI_PROVIDER` env var) | `AI_PROVIDER` must be set in identity-platform deploy env |
| Queue-worker store scaffold | AI intent endpoint (provides vertical data); `store_ai_generation_intents` table migration | None | New table migration required |
| `lb-cart` mutations | Gateway cart mutation routes confirmed (`DELETE /cart/items/:id`, `PATCH /cart/items/:id`) | None | Unknown H-05: routes must be verified before implementation |
| ARB Liquid flip | Phase B + C completion; performance benchmarks; SSTI/XSS gate results | ARB review committee | No flip before evidence package is complete |
| Theme marketplace launch | ARB reopen approval; Vercel project; GSTIN; Razorpay Route payout | ARB approval (external governance gate) | Unknown C-10: ARB criteria must be researched first |
| Dairy/restaurant vertical | Subscriptions domain (NOT IMPLEMENTED); menu modifier model | None (internal platform work) | New platform domain build required — estimated 8–16 weeks |

---

_File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-discovery/20-executive-strategy-report.md`_
_Sources: All documents in `docs/theme-discovery/10` through `19` and `docs/theme-research/README.md`_
