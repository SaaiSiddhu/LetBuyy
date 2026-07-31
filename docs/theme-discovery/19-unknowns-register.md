# Unknowns Register — Phase B

**Date:** 2026-06-18
**Status:** Risk and uncertainty map for the adaptive theme system. Read before writing any new code.
**Inputs:** Documents 10 through 18 of the theme-discovery series plus docs/theme-research README.

---

## Introduction

This document is not a TODO list. It is a risk and uncertainty map. Every unknown listed here is a gap in the knowledge base that, if left unresolved, will cause an incorrect architectural decision, a wasted sprint, a security incident, or a deployment failure during or after Phase B.

The document is structured in four priority tiers. Critical unknowns must be resolved before any significant code is written. High-priority unknowns should be resolved in the sprint that precedes building the feature they block. Medium-priority unknowns are important but do not block the first delivery. Low-priority unknowns are nice to know and can be deferred.

Each entry follows a consistent format: what is not known, why it matters, where the gap was found in the discovery work, and how it would be resolved.

---

## Critical Unknowns (must resolve before building)

---

**Unknown C-01**
**Unknown:** There is no preset activation code path anywhere in the system. The `settings_data.presets` field exists in `ThemeBundleSettingsDataSchema` but is populated with an empty object in `createUrbanKicksLiquidThemeBundleFixture()`. No gateway route, no `ThemeExecutionAdapter` method, no merchant-control-plane action reads from this field and writes its contents into `settings_data.current` plus the live `template_config` on `sites`.
**Category:** Technical
**Why It Matters:** The entire adaptive theme system depends on a merchant selecting a vertical at onboarding or from the editor and having their theme immediately reconfigured. Without an activation path, presets are data with no effect. All downstream work — vertical preset definitions, onboarding integration, AI store generation, MCP `apply_preset` tool — is blocked.
**Evidence of Gap:** Doc 11, Section 7, item 1: "No route in `services/api-gateway/src/routes/themes.ts` accepts a preset name and applies it." Doc 13, Section 6: "`grep -rn "preset" services/api-gateway/src/routes/themes.ts` returns zero results for a `/preset` route." Doc 15, Section 2: "`apply_preset` action in merchant-control-plane is noted as 'not yet' in doc 09."
**Resolution Path:** Design and implement a `POST /v1/themes/:slug/apply-preset` gateway endpoint. The implementation requires: (1) define the merged data model for what a preset contains (settings delta + template delta, per doc 11 Section 8 recommended model), (2) add the method to `ThemeExecutionAdapter`, (3) add the route, (4) wire it into the merchant-control-plane onboarding and editor. This is an engineering task that can begin once C-02 (preset data model) is resolved.
**Estimated Resolution Cost:** 3–5 days (endpoint + adapter method + merchant-control-plane wiring)

---

**Unknown C-02**
**Unknown:** The canonical JSON format for a preset document is not standardized in code. Doc 11 Section 8 proposes a structure (`id`, `name`, `settings_data`, `templates`, `metadata.requires_sections`) but this has not been validated as Zod schema, is not in `theme-bundle.ts`, and is not enforced anywhere. There is no `ThemePresetSchema` type.
**Category:** Architecture
**Why It Matters:** Before writing preset definitions for any vertical (grocery, electronics, fashion), the preset document schema must be agreed upon and machine-validated. If the schema is wrong or underspecified, every preset written before the schema is finalized will need to be rewritten.
**Evidence of Gap:** Doc 11, Section 8: proposed data model with explicit note "Key design decisions" but no corresponding Zod schema in any source file. Doc 11, Section 7, item 2: "`createUrbanKicksLiquidThemeBundleFixture()` does not populate [the presets field]."
**Resolution Path:** Write a `ThemePresetDocumentSchema` Zod schema in `packages/theme-engine/src/theme-bundle.ts` matching or improving the structure from doc 11 Section 8. Validate it against a grocery preset draft. Then write the activation algorithm against this schema. Schema design can be done in a half-day design session; implementation and validation takes 1–2 days.
**Estimated Resolution Cost:** 1–2 days

---

**Unknown C-03**
**Unknown:** The definitive "LetBuyy Core" theme handle/ID does not exist. Every store created via the web wizard receives `theme_id = 'modern'` (a hardcoded string, not a `themes` table UUID). `getDefaultStorefrontThemeTemplate()` in `theme-registry.ts` hardcodes `themeId: 'urban-kicks'`. `compilePortableToLiquidBundle()` calls `createUrbanKicksLiquidThemeBundleFixture()` as the base for ALL Liquid-compiled stores, meaning every Liquid store silently inherits Urban Kicks branding (the `- Urban Kicks` title suffix, `lb-theme--urban-kicks` body class, `storeName: 'Urban Kicks'` header/footer default).
**Category:** Architecture
**Why It Matters:** The core-to-preset architecture assumes a single canonical theme that all presets configure. Without a defined Core theme (slug, DB row, bundle fixture), preset activation has no well-typed target. Additionally, every store currently compiled to Liquid inherits Urban Kicks brand strings, which is incorrect for any non-Urban-Kicks merchant.
**Evidence of Gap:** Doc 10, Section 3: "Key coupling risk: `compilePortableToLiquidBundle()` uses `createUrbanKicksLiquidThemeBundleFixture()` as its base fixture for ALL stores compiled to Liquid." Doc 18, Section 4: "`theme_id = 'modern'` is hardcoded in `onboarding/page.tsx:296`." The string `'modern'` likely does not correspond to any row in the `themes` table.
**Resolution Path:** (1) Create `createLetbuyyCoreLiquidThemeBundleFixture()` in `theme-bundle.ts` with slug `'letbuyy-core'` per doc 10 Section 6 rename table. (2) Update `compilePortableToLiquidBundle()` to use the Core fixture. (3) Add or verify a `themes` table row with `slug = 'letbuyy-core'`. (4) Update `getDefaultStorefrontThemeTemplate()` to reference `'letbuyy-core'`. This is a contained refactor with no ARB approval required.
**Estimated Resolution Cost:** 2–3 days

---

**Unknown C-04**
**Unknown:** The exact code change required to enable Liquid rendering in the theme editor preview is partially specified but not fully validated. Doc 17 Section 4 identifies four concrete steps (vanilla JS bridge script, `data-section-id` attributes in Liquid templates, bridge script injection in `composition-engine.tsx`, and fixing a postMessage type-name inconsistency). Step 4 — the postMessage inconsistency — is specifically flagged as a latent bug: `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` but `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected`. It is not confirmed whether this inconsistency means section selection is currently broken even for React-rendered sections.
**Category:** Technical
**Why It Matters:** The theme editor preview is the primary merchant interaction surface for visual theme customization. If clicking a section in the preview does not select it in the sidebar, the editor's UX is broken and preset application becomes invisible to merchants who cannot see the result interactively.
**Evidence of Gap:** Doc 17, Section 4: "Key message naming inconsistency: `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected` (past tense) but `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION` (all caps, different name entirely)... The selection highlight in the preview frame never receives the editor's selection broadcast. Investigate before adding to any preset or AI feature."
**Resolution Path:** Reproduce the postMessage issue by opening the theme editor in dev and clicking a React-rendered section in the preview. If selection highlighting is currently broken, fix the inconsistency first (pick canonical names, update both files). Then implement the Liquid bridge (Steps 1–3 from doc 17 Section 4). Estimated: 1 day to diagnose + 3–4 days to implement the full bridge.
**Estimated Resolution Cost:** 4–5 days

---

**Unknown C-05**
**Unknown:** How does an AI agent authenticate to make theme changes on behalf of a merchant? Two architectures are possible — (A) OAuth 2.0 Authorization Code Flow with PKCE using the existing ES256 merchant JWT system, or (B) a long-lived store-scoped API key that exchanges for a short-lived ES256 JWT per call. Neither is implemented. The `identity-platform` issues ES256 JWTs for the browser editor flow; it is not confirmed whether it can also issue tokens on behalf of a service/agent caller.
**Category:** Security
**Why It Matters:** Without an authentication strategy for AI agents, neither the MCP server nor the AI onboarding flow can make authenticated API calls to the gateway. The 26 "READY NOW" MCP tools identified in doc 15 are all blocked at the auth layer until this is resolved.
**Evidence of Gap:** Doc 15, Section 5: "Recommended approach: OAuth 2.0 Authorization Code Flow with PKCE... Requires no new auth infrastructure — the ES256 JWT system already exists. Alternative: API key minting... A simpler alternative is a dedicated `POST /v1/api-keys` gateway route... It does not exist yet in LetBuyy."
**Resolution Path:** This is a product + security decision, not a research task. The team must choose between OAuth PKCE (no new infrastructure, but requires browser-based consent flow) and API keys (new gateway route and key-management infrastructure, but simpler for programmatic use). Decision must be made before MCP development begins. Once decided, implementation is 3–5 days for API keys or 1–2 days for reusing the existing ES256 JWT issuance path.
**Estimated Resolution Cost:** 0.5 days to decide; 1–5 days to implement depending on choice

---

**Unknown C-06**
**Unknown:** Font loading is entirely absent from the theme engine. `headingFontFamily` and `bodyFontFamily` settings accept font names as raw strings, but the bundle's `layout/theme.liquid` does not emit any `<link rel="stylesheet">` or `@font-face` declarations. Any preset that specifies a non-system font (e.g., `"Playfair Display"` for fashion, `"Cormorant Garamond"` for jewelry, `"Merriweather"` for dairy) will silently fall back to `system-ui`. Merchants who apply a typography-forward preset will see no visual difference.
**Category:** Technical
**Why It Matters:** Typography is one of the primary visual differentiators between verticals. A jewelry preset with `"Cormorant Garamond"` looks completely different from an electronics preset with `"Inter"`. If font loading does not work, 40–50% of the visual differentiation value of presets is lost.
**Evidence of Gap:** Doc 10, Section 5: "No font loading mechanism exists in the current bundle. Fonts are specified as CSS font-family strings in `headingFontFamily` / `bodyFontFamily` settings, but no `@font-face` declarations or `<link rel='stylesheet'>` for Google Fonts are generated." Doc 11, Section 7, item 7: "font presets are aspirational but non-functional until a font-loading mechanism is added to the renderer."
**Resolution Path:** Add a `LIQUID_THEME_FONT_MAP` to `theme-renderer.ts` that maps known font names to Google Fonts `@import` URLs. Add a font-injection step in `buildLiquidThemeHeadAssets()` that emits a `<link rel="preconnect" href="https://fonts.googleapis.com">` and a corresponding `<link rel="stylesheet">` when the `headingFontFamily` or `bodyFontFamily` setting is a known non-system font. The `settings_schema` field type for font should become `select` (matching `THEME_SETTINGS_SCHEMA`) with a curated list of 8–10 web-safe Google Fonts. Estimated: 1–2 days.
**Estimated Resolution Cost:** 1–2 days

---

**Unknown C-07**
**Unknown:** Which specific sections are needed for each of the first three priority verticals (grocery, fashion, electronics) but do not currently exist in the bundle? A count exists in doc 11 (17 missing section types across 8 verticals) but the question for Phase B is which sections are needed for the MVP presets and whether they can be deferred to Phase D.
**Category:** Product
**Why It Matters:** The scope of Phase B depends on this answer. If grocery can achieve a functional preset from existing sections, Phase B can ship a grocery preset without any new section development. If not, the phase scope must include section authoring, which requires additional engineering time and ARB review of new Liquid source.
**Evidence of Gap:** Doc 11, Section 6: "Grocery — Yes, for category + grid + trust structure — `nutrition-table`, `bundle-deals` are missing." Doc 11, Section 5 per-vertical analysis provides section-level gap lists. The gap analysis shows that a partial preset (homepage visual identity + section order) is achievable for grocery without new sections; a complete preset (with nutrition tables) is not.
**Resolution Path:** For each of the three priority verticals, decide whether a "80% preset" (existing sections + color/font + section order) is acceptable for MVP, or whether the vertical requires new sections to be meaningful. This is a product decision requiring input from merchants or product owners. Resolution: 1 meeting, 1 decision document.
**Estimated Resolution Cost:** 0.5 days (decision meeting + doc)

---

**Unknown C-08**
**Unknown:** Does `theme_id = 'modern'` in `sites` correspond to an actual row in the `themes` table, or is it a legacy string alias handled as a special case in the storefront runtime? If it is not a valid `themes.slug`, then the 22 existing stores (or however many exist) are using a theme reference that may not be queryable from the marketplace catalog, may not have a valid `theme_releases` row, and may not support the Liquid engine path.
**Category:** Technical
**Why It Matters:** The store generation journey (doc 18) depends on being able to assign a theme from the `themes` table at onboarding. If `'modern'` is a ghost reference, every store created today lacks a valid theme installation, and the `GET /v1/themes/:slug/editor` call for these stores may fail or return a degraded state.
**Evidence of Gap:** Doc 18, Section 4: "The string `'modern'` is stored directly in `sites.theme_id`. It is not a UUID from the `themes` table... Whether `'modern'` is a valid `themes.id` or simply a slug fallback is not determinable from these source files alone."
**Resolution Path:** Run `SELECT slug, is_active FROM themes WHERE slug = 'modern'` against the production DB (or a dev DB). If no row exists, determine how the storefront runtime resolves `theme_id = 'modern'` — likely a hardcoded fallback in the composition engine. Document the actual behavior and decide whether to (a) seed a `themes` row with `slug = 'modern'`, (b) migrate all `theme_id = 'modern'` rows to `'letbuyy-core'` once the Core bundle exists, or (c) keep the special-case handling. Resolution: a single DB query + 1 engineering decision.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown C-09**
**Unknown:** The `COD (Cash on Delivery) enabled` write path is uncertain. The `stores.ts` PATCH route (`PATCH /v1/stores/:id`) has an `allowed` array of fields that can be updated. `cod_enabled` is returned by `GET /stores/:id/payment-config` but whether it is included in the PATCH `allowed` list is not confirmed — doc 13 explicitly marks it as "UNCERTAIN."
**Category:** Technical
**Why It Matters:** For dairy, grocery, and restaurant verticals in India, COD is the default and most common payment method. An AI store generation flow that cannot enable COD automatically cannot produce a launch-ready store for these verticals. If the PATCH path is broken, AI-generated stores will have COD silently disabled.
**Evidence of Gap:** Doc 13, Section 8: "`cod_enabled` is read via the payment-config endpoint but the write path through `UpdateStoreSchema` is unclear — `cod_enabled` is not in the `allowed` array in `PATCH /stores/:id` (line 701–709)."
**Resolution Path:** Read `stores.ts` lines 700–710 directly (the `UpdateStoreSchema` allowed array). If `cod_enabled` is absent, determine whether it must be added to the allowed list or routed through the `POST /stores/:id/payment-config` endpoint. One reading session to confirm the field; 2–4 hours to add if missing.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown C-10**
**Unknown:** What is the ARB's exact gate criteria for approving the marketplace reactivation (`deploymentAuthority.platform = "frozen-not-deployed"` → deployed)? Doc 16 lists nine operational items as prerequisites but does not identify which of those nine are ARB approval gates vs operational readiness gates that can be satisfied without ARB sign-off.
**Category:** Business
**Why It Matters:** The marketplace freeze affects two Phase B decisions: (1) whether extension themes (new section packs for verticals) can be published, and (2) whether a preset marketplace can launch. If the ARB gate requires evidence that cannot be gathered until after Phase D, the marketplace reactivation path affects timeline planning for the hybrid marketplace model.
**Evidence of Gap:** Doc 16, Section 6: "Submit ARB reopen request with deployment scope... the frozen marketplace state, the following ordered steps apply." The ARB criteria are inferred from CLAUDE.md governance rules but no specific ARB decision document listing the criteria for marketplace reopen is referenced.
**Resolution Path:** Review the ARB mandate in `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` to identify whether theme marketplace deployment requires a specific ARB trigger, and what evidence must be presented. Confirm with the project's ARB owner. This is a governance research task, not an engineering task.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown C-11**
**Unknown:** The `blog` route type has no backend API for blog posts. The `storefront_pages` table and `pages.ts` gateway route handle CMS pages and policies, but there is no `GET /v1/blog` endpoint that returns blog posts as a paginated collection for a given store. This blocks the `blog` template type from being implementable.
**Category:** Technical
**Why It Matters:** `blog` is one of five remaining route types without a Liquid template in Urban Kicks. It is listed as "high (backend needed)" difficulty in the README scorecard. Without a blog API, the `blog-index` section and `article-content` section cannot receive live data, making the route render as a static stub at best.
**Evidence of Gap:** README scorecard: "`blog` high (backend needed)." Doc 10, Section 5: "`blog-post-list` — blog index page (not implemented at platform level; `blog` route has no template and no backend drop)."
**Resolution Path:** Determine whether the platform has a `blog_posts` table or equivalent in the DB (`pnpm graph:intel table blog_posts` or equivalent LCIS query). If a table exists without a gateway route, adding `GET /v1/blog?store_id=` is ~1 day of work. If no table exists, this is a new domain (table + migration + route + drop definition) — more like 1–2 weeks. The LCIS query is the fastest resolution.
**Estimated Resolution Cost:** 0.5 days to research; 1 day–2 weeks to implement depending on DB state

---

**Unknown C-12**
**Unknown:** Can sections be conditionally shown or hidden based on runtime conditions (device viewport, customer segment, route type)? The current schema has only `disabled: boolean` on section instances — a static on/off flag. There is no `visibility_rules` field and no conditional rendering logic in the composition engine.
**Category:** Architecture
**Why It Matters:** Adaptive themes require showing different sections to different customers (a "new customer" hero vs a "returning customer" loyalty prompt), on different devices (a mobile-specific navigation vs desktop mega-menu), or on different route contexts. Without conditional visibility, "adaptive" themes are only adaptive at preset-apply time, not at render time.
**Evidence of Gap:** Doc 12, Section 7.2: "What is missing: A `visibility_rules` field on the section instance schema... CSS/JS toggle at runtime based on viewport breakpoint (client-side) or route type (SSR-side)." Also: the `disabled: boolean` flag is the only existing mechanism.
**Resolution Path:** This is an architectural decision that must be made before building the conditional visibility feature. The key question is whether conditions are evaluated server-side (in `buildSectionDataPlan`) or client-side (CSS/JS). A hybrid approach (route-type conditions server-side, device conditions client-side) is suggested by doc 12 but requires schema extension, composition engine changes, and client-side CSS. Decision: 0.5 days. Implementation: 3–5 days.
**Estimated Resolution Cost:** 0.5 days to decide; 3–5 days to implement

---

**Unknown C-13**
**Unknown:** Can one store have multiple themes installed simultaneously, and how does theme activation work without a full re-install? The `store_themes` table stores per-(store, theme_id) install state, and `POST /themes/:slug/install` is idempotent but runs full schema validation + new `publish_theme_release` + cache purge every time. There is no lightweight `POST /themes/:slug/activate` endpoint for switching between already-installed themes.
**Category:** Technical
**Why It Matters:** The MCP `activate_theme` tool and the merchant-facing "switch to a different theme" UX depend on being able to switch themes without running the full install pipeline every time. If the only path is re-install, theme switching is expensive and creates unnecessary release records.
**Evidence of Gap:** Doc 14, Section 2, Group D missing operations: "`POST /themes/:slug/activate` — lightweight activation of an already-installed theme... For an agent that needs to switch between two already-installed themes quickly, this is disproportionately expensive." Doc 15, Group C (UI-only): "Change the active storefront theme without install — the install endpoint deactivates all others and sets `is_active`; no lightweight 'activate existing installation' endpoint."
**Resolution Path:** Confirm from the `store_themes` and `theme_instances` table schemas whether `is_active = true` is the only mechanism for designating the active theme, and whether setting it directly (without the full install pipeline) would leave the system in a consistent state. If yes, a thin `POST /themes/:slug/activate` route that updates `store_themes.is_active` and `sites.theme_id` without calling `publish_theme_release` may be safe for already-installed themes. Estimated: 1 day to design + 1 day to implement.
**Estimated Resolution Cost:** 2 days

---

**Unknown C-14**
**Unknown:** What model, what prompt format, and what safety measures apply to AI content generation for theme sections (hero copy, product descriptions, policy text)? The gateway has `POST /v1/ai/generate` and `POST /v1/ai/homepage` routes, but the model used is environment-variable-driven (`AI_PROVIDER`), the prompt format is not documented in the discovery work, and the output structure for `generate_homepage_layout` targets JSON-contract sections (not Liquid bundle sections).
**Category:** Technical
**Why It Matters:** If AI-generated content targets the JSON-contract section format and the target theme is Liquid, the generated layout will not be compatible without a translation layer. Additionally, unreviewed AI-generated policy text (privacy policy, returns policy) may not meet Indian regulatory requirements (Consumer Protection Act 2019, IT Act 2000). Safety review of AI outputs is absent.
**Evidence of Gap:** Doc 15, Section 3: "`generate_homepage_layout` — `POST /v1/ai/homepage` — output targets JSON-contract sections, not Liquid bundle sections." Doc 15, Section 7: "End-to-end store generation from description — MISSING." No safety review of AI-generated content appears in any discovery document.
**Resolution Path:** (1) Read `services/api-gateway/src/routes/ai.ts` to understand the current prompt structure and model configuration for `generate_homepage_layout`. (2) Determine whether the output schema can be mapped to Liquid bundle template format or requires a new generation route. (3) Engage legal/compliance to review whether AI-generated policy templates require human review before display. Resolution: 1–2 days of engineering research + legal consultation.
**Estimated Resolution Cost:** 2–3 days (engineering + legal consultation)

---

**Unknown C-15**
**Unknown:** The merchant onboarding flow in `apps/identity-platform/src/app/onboarding/page.tsx` does not collect the merchant's industry or vertical. The `Step4Schema` in `packages/tenant-core/src/index.ts` has `industry`, `target_audience`, `business_goal`, and `brand_tone` fields, but these are only used in the mobile 6-step wizard path and are never passed to the web `POST /stores` handler. Even if an AI store generation endpoint is built, there is no input source for the vertical data.
**Category:** Product
**Why It Matters:** Vertical-specific preset application, AI theme selection, and AI content generation all depend on knowing the merchant's vertical at onboarding time. Without this data, AI generation defaults to generic content and the wrong preset. All AI store generation work is blocked until the vertical capture step exists in the web wizard.
**Evidence of Gap:** Doc 18, Section 1 pain point 1: "No industry/niche collection. `page.tsx` has zero fields for `business_type`, `industry`, `category`, or `store_type`." Doc 18, Section 5 gap: "Industry/vertical capture (missing in web wizard)" labeled "NOT PRESENT."
**Resolution Path:** Add a vertical/industry selection step to the web onboarding wizard. This is a product design + engineering task. Options: (a) a new Step 1.5 with a vertical picker UI (6–8 tiles for common Indian verticals), or (b) a free-text "describe your store" prompt with AI extraction. Resolution involves a product design decision, UI implementation in `onboarding/page.tsx`, and wiring to `Step4Schema`. Estimated: 2–4 days once the product design is decided.
**Estimated Resolution Cost:** 0.5 days to decide design; 2–4 days to implement

---

## High-Priority Unknowns (should resolve in next sprint)

---

**Unknown H-01**
**Unknown:** Asset storage for theme images is undefined. The `bundle.renderer.assets` map is always `{}` in Urban Kicks (doc 10, Section 1). The `asset_url` Liquid filter prefixes relative paths with `/assets/` but there is no CDN, Supabase Storage bucket, or file-serving route defined for theme assets. When merchants upload images via the `ImageInput` field in the editor (`/api/stores/:store/upload`), where do these files go and for how long?
**Category:** Technical
**Why It Matters:** Section images (hero images, category grid images, product card fallback images) are core to the visual differentiation that presets provide. If image upload destinations are undefined or ephemeral, merchant-uploaded images may disappear, causing broken storefronts after preset application.
**Evidence of Gap:** Doc 10, Section 1 asset paragraph: "asset hosting is outside the theme engine scope." Doc 17, Section 2: "`ImageInput` accepts URL text or file upload to `/api/stores/<store>/upload`" but no verification of where files are stored or retention policy.
**Resolution Path:** Read `apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts` to determine the current upload destination (Supabase Storage, R2, S3, or a temporary local path). Confirm the retention policy. Estimated: 1 hour to read the file.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown H-02**
**Unknown:** Does the `ensureThemeInstance` side-effect in `GET /themes/:slug/editor?store_id=` create a `theme_instances` row if one does not exist? If yes, the LCIS read-only intelligence call (`read_editor_state`) mutates the DB on every call, which is inappropriate for a monitoring/observability tool.
**Category:** Technical
**Why It Matters:** LCIS tools are expected to be safe for autonomous read-only queries. If `GET /themes/:slug/editor` writes to `theme_instances` as a side effect, LCIS cannot safely call it as part of an automated health check or incident investigation — it would create spurious DB records.
**Evidence of Gap:** Doc 14, Section 3, `read_live_editor_state`: "Status: Ready. Note: side-effect: `ensureThemeInstance` may mutate `theme_instances` on first call."
**Resolution Path:** Read the `loadEditor` implementation in `ThemeExecutionAdapter` to confirm whether `ensureThemeInstance` is called unconditionally, and whether the `theme_instances` upsert is idempotent (i.e., safe to call N times). If idempotent, the risk is low. If not, consider adding a `?read_only=true` flag. Estimated: 1 hour.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown H-03**
**Unknown:** The theme versioning model does not include semantic versioning (major.minor.patch). `theme_releases` uses an integer `release_version` that increments per store. The `themes` table has a `version` column but its format and how it relates to `theme_releases` is not documented. The question of whether Phase B changes to Urban Kicks (adding presets, genericizing to LetBuyy Core) require a major version bump that would break existing stores is unanswered.
**Category:** Architecture
**Why It Matters:** If existing stores have a `current_theme_release_id` pointing to a release that was built against `schema_version = '2026-06-liquid-sections'` and the Phase B Core bundle changes the schema, those stores may fail to render or fail to load the editor until their releases are migrated. This is a compatibility risk.
**Evidence of Gap:** Doc 12 documents `release_version` as a monotonic integer per store, `engine_version = 'theme-engine-v1'` in manifests, and `schema_manifest_version` in releases, but does not resolve whether `schema_version` changes require a migration. Doc 10 renames 13 fields in `createUrbanKicksLiquidThemeBundleFixture()` — a schema change at the bundle level.
**Resolution Path:** Determine whether changing `package.slug` from `'urban-kicks-liquid'` to `'letbuyy-core'` in the fixture requires a DB migration to update existing `sites.theme_id` values, and whether existing `theme_releases.release_config` blobs referencing `urban-kicks-liquid` will still render correctly after the rename. Estimated: 1–2 hours of source analysis.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown H-04**
**Unknown:** The `search` drop is defined in `LiquidCommerceDrops` as an interface field but is not populated in the current composition engine. The search template and all its sections exist in Urban Kicks, and the search page file is noted as missing only a `page.tsx` file — but whether the `search` drop will be populated correctly when that page file is added is unconfirmed.
**Category:** Technical
**Why It Matters:** If the `search` drop is not populated when the search route renders, all product grid sections that depend on it will render empty or throw, and the search experience will be broken despite the template existing.
**Evidence of Gap:** Doc 12, Section 5: "`search` — Not yet populated server-side — Defined in `LiquidCommerceDrops` interface but not populated in current engine."
**Resolution Path:** Read `buildSectionDataPlan` in `data-binding-engine.ts` and `buildLiquidCommerceContext` in `composition-engine.tsx` to verify whether a `search` query result from `GET /v1/storefront/:subdomain/products/search` is called and wired when `route.type === 'search'`. If absent, add the data-binding call before adding the page file. Estimated: 2–4 hours.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown H-05**
**Unknown:** The `lb-cart` island's CRUD mutation operations (`removeFromCart`, `updateQuantity`, `clearCart`) are not implemented. The cart `total` and `item_count` render correctly from `LiquidServerCart`, but the cart page cannot be used to modify the cart. This means the React `CartPageClient` fallback cannot be retired for any store.
**Category:** Technical
**Why It Matters:** The cart page is one of the highest-traffic storefront pages. If it requires the React fallback due to missing mutation operations in the `lb-cart` island, stores cannot be fully Liquid-rendered even after Phase B template completion. This affects any preset that configures cart behavior.
**Evidence of Gap:** README scorecard: "`lb-cart` lacks CRUD mutation operations." Doc 10 confirms: "mutation operations — `removeFromCart`, `updateQuantity`, `clearCart` — are not yet implemented."
**Resolution Path:** Engineering task: implement the three mutation operations in the `lb-cart` custom element by calling the gateway cart API (`DELETE /v1/storefront/:subdomain/cart/items/:itemId`, `PATCH /v1/storefront/:subdomain/cart/items/:itemId`, `DELETE /v1/storefront/:subdomain/cart`). Verify these gateway routes exist before implementing. Estimated: 2–3 days once routes are confirmed.
**Estimated Resolution Cost:** 0.5 days to verify routes; 2–3 days to implement

---

**Unknown H-06**
**Unknown:** The section reorder endpoint in the merchant-control-plane BFF (`PUT /api/themes/[themeId]/sections/reorder`) is a read-modify-write against `saveDraft` with no atomic gateway equivalent. The BFF reads the current draft, reorders the `sections.template` array in memory, and re-saves. This creates a race condition if the editor is open in a second browser tab or if an MCP agent is also writing the draft simultaneously.
**Category:** Technical
**Why It Matters:** Section reorder is a core interaction in the theme editor. If a merchant reorders sections while an AI agent is concurrently applying a preset, one write will silently win and the other's changes will be lost. This is a correctness issue for any concurrent editing scenario.
**Evidence of Gap:** Doc 14, Section 1, row 23: "Reorder sections — PUT `/api/themes/[themeId]/sections/reorder` (BFF only) — No atomic gateway endpoint; BFF performs a read-modify-write against `saveDraft`; caller must supply correct `store_name` from merchant session; race condition possible."
**Resolution Path:** This requires an architectural decision: (a) add a dedicated atomic `PUT /v1/themes/:slug/editor/sections-order` gateway endpoint that accepts `{ template_key, order: string[] }` and performs the reorder against the current draft version with conflict detection, or (b) document the race condition as a known limitation and accept it for Phase B. The `base_version` conflict detection in `saveDraft` mitigates this somewhat (one writer will get a 409) but does not prevent the race from occurring.
**Estimated Resolution Cost:** 1 day to decide + implement a gateway endpoint if chosen

---

## Medium-Priority Unknowns (important but not immediately blocking)

---

**Unknown M-01**
**Unknown:** The `newsletter-signup` section type alias mismatch: the React registry maps `core.newsletter` to section type `'newsletter'`, but Urban Kicks uses type `'newsletter-signup'`. While this has no impact on Liquid mode, if a JSON-contract theme or a future Core theme uses `'newsletter'` as the section type, the React fallback will use `UnknownSectionFallback` instead of the real newsletter component.
**Category:** Technical
**Why It Matters:** This is a latent correctness bug. It does not affect Liquid-rendered stores today but will affect any store using the JSON-contract engine that adds a newsletter section.
**Evidence of Gap:** README: "`newsletter-signup` vs `newsletter` type alias mismatch... This has no impact on Liquid mode (the Liquid engine bypasses the React registry entirely), but a hypothetical JSON-contract Urban Kicks variant would silently miss the newsletter renderer."
**Resolution Path:** Audit `renderer-registry.tsx` for the `core.newsletter` renderer key mapping and determine whether it should be updated to match the `'newsletter-signup'` type or the section should be renamed. Estimated: 2 hours.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown M-02**
**Unknown:** A/B testing variant configuration for themes does not exist at any layer. `theme_instance_drafts` is linear (one active draft). There is no `theme_ab_experiments` table, no variant assignment at the edge, and no metric collection hookup. This is noted in doc 12 Section 7.4 as a greenfield capability.
**Category:** Architecture
**Why It Matters:** A/B testing is a Phase D capability but understanding whether it requires ARB approval (it touches the `publish_theme_release` RPC which is canonical ledger-adjacent) determines whether it can be planned within Phase D or requires a separate gate.
**Evidence of Gap:** Doc 12, Section 7.4 and doc 17, Section 5: "No infrastructure exists for storing two simultaneous theme configs... This is greenfield work... requires ARB approval before implementation (it touches the canonical `publish_theme_release` RPC)."
**Resolution Path:** Confirm with the ARB whether a `theme_release_variants` table with `allocation_percent` and `config_snapshot` constitutes a "money mutation" requiring step-up approval, or whether it is a presentational change that can go through standard review. Estimated: 1 meeting.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown M-03**
**Unknown:** The `password` route type (storefront password gate for `sites.status = 'draft'` stores) requires storefront proxy middleware to intercept requests and serve a password gate page. The discovery work notes this is a medium-effort addition. It is not confirmed whether the `storefront-runtime/src/proxy.ts` middleware already has any logic for checking `sites.status` before routing requests.
**Category:** Technical
**Why It Matters:** A `draft` status store should not be publicly accessible without a password gate. If the proxy does not implement this check, draft stores are publicly visible. This is a security and merchant-experience concern.
**Evidence of Gap:** README Phase D entry: "Password gate route — storefront proxy middleware serving the store password gate for `sites.status = 'draft'` stores." No mention of existing password gate logic in the proxy.
**Resolution Path:** Read `apps/storefront-runtime/src/proxy.ts` (already confirmed as Next.js middleware, not dead code, per memory). Check whether any `status === 'draft'` check exists. If absent and if this is a Phase B scope item, add the status check before routing. Estimated: 1–2 days.
**Estimated Resolution Cost:** 0.5 days to verify; 1–2 days to implement

---

**Unknown M-04**
**Unknown:** Per-page template overrides (e.g., `/pages/about` using a different template from `/pages/faq`) do not exist. The `page` route type maps all generic CMS pages to a single `'page'` template. There is no `page_template_overrides: Record<slug, templateKey>` on `sites.template_config`.
**Category:** Architecture
**Why It Matters:** Merchants with a `page` template want different layouts for their About Us page vs their FAQ page vs their Contact page. Without per-slug template overrides, all CMS pages share one template, limiting merchant customization.
**Evidence of Gap:** Doc 12, Section 7.1: "Template selection is entirely route-type-based... There is no mechanism to assign a different template to a specific page slug." Lists four specific missing pieces including a `pages` table column and editor UI.
**Resolution Path:** This is a Phase C+ feature, not Phase B. Document it as a known limitation of the `'page'` template. Resolution path if needed: add `template_key text` to the `pages` table, update the route handler to check this field, add editor UI. Estimated: 3–5 days.
**Estimated Resolution Cost:** 3–5 days when scoped

---

**Unknown M-05**
**Unknown:** Customer segment override injection (showing different section settings based on customer tags, purchase history, or cohort) is mentioned in the target architecture docs as a Phase D feature but the mechanism is unspecified. There is no `customer_segments` table, no `personalization_variants` field on section instances, and no segment resolution step in the composition engine.
**Category:** Architecture
**Why It Matters:** Personalization is a key value proposition of "adaptive" themes (as opposed to merely "themed" ones). Without a segment definition and resolution mechanism, "adaptive" themes are presets applied at onboarding time, not truly adaptive at runtime.
**Evidence of Gap:** Doc 12, Section 7.3: "What is missing: A `personalization_variants` field on section instances, a segment-resolution step in `buildSectionDataPlan`..." README Phase D: "Customer segment override layer (AI-driven personalization)."
**Resolution Path:** Phase D design work. Requires: data model for segments, API for segment rule definition, composition engine changes, and an LLM integration for segment assignment. Not a Phase B concern unless the adaptive theme system MVP requires it.
**Estimated Resolution Cost:** 2–4 weeks when scoped

---

**Unknown M-06**
**Unknown:** The `subscription-panel` section type is needed for the dairy/fresh-produce vertical but is blocked not by theme work but by the platform's subscriptions domain, which is confirmed NOT IMPLEMENTED. A `subscription-panel` section schema can be stubbed with `disabled_on: ['*']`, but when can it be re-enabled?
**Category:** Business
**Why It Matters:** Dairy as a vertical is lower priority precisely because of this dependency. Understanding the subscriptions domain roadmap determines whether dairy should be included in Phase B preset work or explicitly deferred to a future phase.
**Evidence of Gap:** README surprises: "Dairy/fresh-produce vertical is not blocked by theme work. It is blocked by the platform's subscriptions domain, which is confirmed NOT IMPLEMENTED in LCIS v11."
**Resolution Path:** Query LCIS for the subscriptions domain roadmap status (`/api/domain?key=subscriptions`). If subscriptions is not on the 6-month roadmap, explicitly defer the dairy preset to Phase E. Estimated: 0.5 hours LCIS query.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown M-07**
**Unknown:** The image library for previously uploaded assets is absent from the editor. `ImageInput` in `SchemaFormRenderer` accepts URL text or file upload to `/api/stores/<store>/upload`, but there is no "Choose from library" panel that lets merchants reuse previously uploaded images. This means every image field must be filled by re-uploading or manually entering a URL.
**Category:** Technical
**Why It Matters:** Preset application often requires setting image URLs for hero banners, category grid images, and about-section images. If there is no image library, AI-generated presets cannot reference real merchant images, and placeholder image URLs in presets will display generic content after preset application.
**Evidence of Gap:** Doc 17, Section 2: "No image asset library — `ImageInput` accepts URL text or file upload; no browsing of previously uploaded assets." Doc 17, Section 3 (Phase 2 editor work): "Image asset library sidebar — requires a new `GET /api/stores/[store]/assets` route listing previously uploaded URLs."
**Resolution Path:** Phase B: accept the limitation (presets use Unsplash placeholder URLs or blank image fields). Phase C: implement the asset library. Estimated for Phase C: 2–3 days (new route + sidebar component).
**Estimated Resolution Cost:** 2–3 days when scoped for Phase C

---

## Low-Priority Unknowns (nice to know, not blocking Phase B)

---

**Unknown L-01**
**Unknown:** The `sections render sequentially, not in parallel` performance issue (sequential `await` in `renderLiquidTemplateSections` rather than `Promise.all`) is noted as a safe fix that has not been made. The Urban Kicks home page renders 7 sections sequentially.
**Category:** Technical
**Why It Matters:** Not blocking Phase B but is a performance debt item that will matter under production load.
**Evidence of Gap:** README: "Sections render sequentially, not in parallel... For pages with 7+ sections, this adds latency proportional to the section count. A `Promise.all` refactor is safe because `cache:false` means each section gets a fresh LiquidJS evaluation context."
**Resolution Path:** 1–2 hours of engineering work in `renderLiquidTemplateSections`. Safe to do any time.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown L-02**
**Unknown:** The `not_found` (404) route requires a new `not-found.tsx` Next.js server component to handle 404 responses at the app level. The section and template can be added to the bundle, but the Next.js file convention for 404 pages in the App Router is `not-found.tsx` at the route segment level.
**Category:** Technical
**Why It Matters:** Minor scoping issue. The 404 template is listed as a Phase B quick win but requires a specific Next.js file-naming convention that may not be obvious to the engineer implementing it.
**Evidence of Gap:** README: "`not_found` section + template + not-found.tsx server component. Estimated 3–4 hours."
**Resolution Path:** Add `apps/storefront-runtime/src/app/store/[subdomain]/not-found.tsx` following the Next.js 13+ App Router convention for not-found pages. The file calls the composition engine with `route.type = 'not_found'`.
**Estimated Resolution Cost:** 0.5 days

---

**Unknown L-03**
**Unknown:** The `i18n` (internationalization) gap in Urban Kicks Liquid: all non-English locales (`hi`, `bn`, `mr`, `ta`, `te`, `kn`) were dropped from the bundle even though they exist in the minimal JSON-contract fixture. Section-level error strings (`'No orders yet.'`, `'Your cart is empty.'`, etc.) are hardcoded English strings and cannot be translated without changing Liquid source.
**Category:** Technical
**Why It Matters:** India-first platform — Hindi and regional language support is an eventual requirement but not a Phase B blocker.
**Evidence of Gap:** Doc 10, Section 5: "Urban Kicks Liquid dropped all non-English locales." Doc 10 recommendations: "Add `hi`, `bn`, `mr`, `ta`, `te`, `kn` back to the Core bundle."
**Resolution Path:** Phase C or D: restore locale entries, add section-level translation keys using the `| t` Liquid filter for hardcoded strings. Estimated: 1–2 days for locales; 2–3 days for section-level translation.
**Estimated Resolution Cost:** 3–5 days when scoped

---

**Unknown L-04**
**Unknown:** Change attribution (human vs AI edit) in theme releases and draft patches is absent. The `theme_draft_patches` table has no `source` field distinguishing a merchant keystroke from an AI-suggested change. The `theme_releases` table does not distinguish human-published from AI-published releases.
**Category:** Operational
**Why It Matters:** When AI starts editing themes, distinguishing AI changes from merchant changes in the version history becomes important for debugging and for building merchant trust. Not blocking Phase B.
**Evidence of Gap:** Doc 17, Section 5: "No change attribution (human vs AI)... Adding `source: 'merchant' | 'ai' | 'preset' | 'import'` to the patch record and to `theme_releases.publish_source` would give the VersionTree full attribution." The `client` field in draft saves is the existing hook.
**Resolution Path:** Pass `source: 'ai'` in the `client` body field of draft saves made by AI agents; pass `source: 'preset'` for preset applications. No DB migration required since `client` already accepts an arbitrary string. Full attribution (indexed field + VersionTree display) is a Phase C item.
**Estimated Resolution Cost:** 0.5 days for source field; 1–2 days for VersionTree display

---

**Unknown L-05**
**Unknown:** The `svr / icon system` for trust badges is absent. The `trust-badges` section has an icon `type: 'select'` with options like `'truck'`, `'shield-check'` but the Liquid source just renders the option value as text. No SVG sprite or icon font is loaded.
**Category:** Technical
**Why It Matters:** Trust badges without icons are significantly less visually effective. This matters for vertical presets where trust signals (FSSAI, BIS, COD, warranty) are a key differentiator. Phase B can ship trust badge presets with text-only labels, but the visual experience is degraded.
**Evidence of Gap:** Doc 10, Section 5: "No SVG sprite / icon system. Trust badges have icon `type: 'select'` with options like `'truck'`, `'shield-check'` but the Liquid source just renders text — no actual SVG icons."
**Resolution Path:** Phase C: add an SVG icon system. Options: (a) inline SVG in the Liquid source via a `case` statement on `section.settings.icon`, or (b) load a lightweight icon font (Feather, Heroicons) via `<link rel="stylesheet">` in the layout. The sanitizer FORBID list must be checked for SVG tag support before option (a).
**Estimated Resolution Cost:** 1–2 days when scoped

---

## Unknowns Summary Table

| ID | Unknown | Category | Priority | Blocks | Resolution Path |
|----|---------|----------|----------|--------|-----------------|
| C-01 | Preset activation API does not exist | Technical | Critical | All preset work, MCP apply_preset, AI onboarding | Design + implement POST /themes/:slug/apply-preset |
| C-02 | Preset JSON schema not standardized in code | Architecture | Critical | Preset definitions, C-01 implementation | Write ThemePresetDocumentSchema Zod type |
| C-03 | No definitive LetBuyy Core theme handle | Architecture | Critical | compilePortableToLiquidBundle, all stores compiled to Liquid | Create createLetbuyyCoreLiquidThemeBundleFixture() |
| C-04 | Liquid editor preview bridge not implemented + postMessage bug | Technical | Critical | Editor UX for Liquid themes, preset visual feedback | Fix postMessage names; implement vanilla JS bridge |
| C-05 | AI agent authentication strategy undefined | Security | Critical | All MCP tools, all AI onboarding automation | Decide OAuth PKCE vs API keys; implement chosen path |
| C-06 | Font loading absent from theme engine | Technical | Critical | Typography-forward presets (fashion, jewelry, dairy) | Add font loading to buildLiquidThemeHeadAssets() |
| C-07 | MVP vertical section scope not decided | Product | Critical | Phase B planning and timebox | Product decision: 80% preset acceptable or full sections required |
| C-08 | theme_id = 'modern' may not be a valid themes row | Technical | Critical | Store generation, theme activation, editor load | DB query: SELECT slug FROM themes WHERE slug = 'modern' |
| C-09 | COD enabled write path is uncertain | Technical | Critical | AI store generation for grocery/dairy/restaurant | Read stores.ts UpdateStoreSchema allowed array |
| C-10 | ARB marketplace reactivation criteria not defined | Business | Critical | Marketplace deployment, extension theme publishing | Review LETBUYY_CONSTITUTION.md ARB trigger criteria |
| C-11 | Blog API does not exist | Technical | Critical | blog route type, blog-index section | LCIS: graph:intel table blog_posts; then assess effort |
| C-12 | Section conditional visibility mechanism undefined | Architecture | Critical | Runtime-adaptive themes, segment-based personalization | Decide server-side vs client-side conditions; extend schema |
| C-13 | Multi-theme activation is heavyweight only | Technical | Critical | MCP activate_theme, fast theme switching | Verify store_themes schema; add lightweight activate route |
| C-14 | AI content generation model/format/safety undefined | Technical | Critical | AI store generation, policy page generation | Read ai.ts; confirm schema; legal review of AI policy templates |
| C-15 | Vertical capture missing from web onboarding | Product | Critical | AI theme selection, preset auto-apply at onboarding | Add Step 1.5 vertical picker to onboarding/page.tsx |
| H-01 | Asset storage for theme images undefined | Technical | High | Merchant-uploaded images in presets | Read upload/route.ts to confirm storage destination |
| H-02 | ensureThemeInstance side-effect on read operations | Technical | High | LCIS safe read-only calls | Read loadEditor implementation for idempotency |
| H-03 | Theme versioning model and compatibility undefined | Architecture | High | Phase B bundle rename safety | Analyze schema_version and release_config compatibility |
| H-04 | Search drop not populated in composition engine | Technical | High | Search route template completion | Read buildLiquidCommerceContext for search case |
| H-05 | lb-cart CRUD mutations not implemented | Technical | High | Full Liquid cart page, CartPageClient retirement | Verify gateway cart mutation routes; implement island mutations |
| H-06 | Section reorder is not atomic at gateway level | Technical | High | Concurrent AI + merchant editing | Add atomic PUT /themes/:slug/editor/sections-order |
| M-01 | newsletter type alias mismatch | Technical | Medium | JSON-contract newsletter sections | Audit renderer-registry.tsx |
| M-02 | A/B testing requires ARB approval confirmation | Architecture | Medium | Phase D planning | Confirm with ARB whether release variants touch money RPC |
| M-03 | Password gate not in storefront proxy | Technical | Medium | Draft store protection | Read proxy.ts for status check |
| M-04 | Per-page template overrides do not exist | Architecture | Medium | Merchant page customization | Phase C+ design task |
| M-05 | Customer segment personalization mechanism | Architecture | Medium | Runtime-adaptive themes | Phase D design task |
| M-06 | Subscriptions domain roadmap unknown | Business | Medium | Dairy preset scope decision | LCIS query: /api/domain?key=subscriptions |
| M-07 | Image asset library absent from editor | Technical | Medium | Preset image fields | Phase C implementation: GET /api/stores/[store]/assets |
| L-01 | Sequential section rendering (performance) | Technical | Low | Production P95 latency | Promise.all refactor in renderLiquidTemplateSections |
| L-02 | not-found.tsx Next.js convention | Technical | Low | 404 template completion | Add not-found.tsx file |
| L-03 | i18n locale gap (non-English dropped) | Technical | Low | India regional language support | Phase C/D: restore locale entries |
| L-04 | Change attribution (human vs AI) absent | Operational | Low | Audit trail for AI edits | Pass source field in draft saves |
| L-05 | Icon system absent from trust badges | Technical | Low | Visual trust badge quality | Phase C: SVG inline or icon font |

---

## Architectural Decisions Required

The following decisions cannot be resolved by research alone. They require humans to choose between options with real tradeoffs. Each decision gates specific unknowns.

| Decision | Options | Tradeoffs | Recommendation | Who Decides |
|----------|---------|-----------|----------------|-------------|
| Single core theme vs multiple base themes | (A) One `letbuyy-core` theme, all verticals via presets. (B) Separate base bundles per vertical cluster (fashion, grocery, electronics). | Option A: low maintenance, AI-native, content persistent. Option B: richer visual differentiation per vertical, higher maintenance cost, ART-17 re-approval required for new bundles. | Option A, strongly. The codebase already scaffolds toward this. Extension themes (Model C) are the right long-term path for truly new sections, but base bundle proliferation is not. | Engineering lead + ARB |
| Preset format: pure JSON settings-only vs full template override | (A) `settings_data.current` delta only (colors, fonts, toggles). (B) Full template override (section order + settings + blocks + settings delta). | Option A: simpler to implement, faster to apply, no section-order change. Option B: complete vertical differentiation (different homepage structure per vertical). | Option B (full template override) per doc 11 Section 4 analysis. Settings-only presets produce a recognizably generic storefront. | Engineering lead |
| Marketplace model: traditional bundle vs preset vs hybrid | (A) Traditional bundle marketplace (Shopify-style). (B) Preset marketplace (JSON configs only). (C) Hybrid (core + extensions + presets). | Option A: high maintenance, no AI-native workflow, dev ecosystem cold-start. Option B: AI-native, low maintenance, limited vertical differentiation. Option C: balanced, correct long-term, requires extension contract versioning. | Phase 1 = Model B (preset marketplace). Long-term = Model C. Model A has structural blockers. | Product lead + ARB |
| AI store generation: synchronous vs async (queue-based) | (A) Synchronous: all generation happens in the `POST /onboarding/ai-intent` call before the review step (< 3 seconds). (B) Async: store is created immediately; scaffold jobs (collections, nav, pages) run via queue worker after creation. | Option A: simpler UX, merchant sees everything before clicking Create. Too slow for complex verticals. Option B: faster perceived onboarding, merchants may see an empty store briefly before scaffold completes. | Hybrid: AI intent generation is synchronous (< 3 seconds); scaffold jobs (collections, nav, pages) are async via queue worker after `store.created` event per doc 18 Section 3 Hook C. | Engineering lead |
| MCP authentication: OAuth per-merchant vs service-level API key | (A) OAuth 2.0 Authorization Code Flow with PKCE using existing ES256 JWT. (B) Long-lived store-scoped API key exchanged for short-lived ES256 JWT per call. | Option A: no new infrastructure, requires browser consent flow, suitable for user-facing agents. Option B: new gateway route needed, simpler for programmatic/server-to-server agents, longer-lived credential risk. | Option B (API key) for server-to-server MCP calls; Option A for browser-embedded AI agents. The distinction matters for the first MCP server implementation. | Security lead + Engineering lead |
| Font loading strategy | (A) Google Fonts via `<link rel="stylesheet">` in layout template. (B) Curated WOFF2 files hosted in Supabase Storage or R2. (C) System font stack only (no external fonts). | Option A: easy implementation, external dependency, privacy concern (GDPR/data residency for Indian merchants). Option B: full control, no external calls, requires storage infrastructure. Option C: zero implementation cost, poor visual differentiation for premium verticals. | Option A for Phase B/C (move to Option B if privacy/data-residency requirements surface). | Engineering lead + Privacy review |
| Preset activation: merchant-review-before-publish vs auto-publish | (A) Preset application writes to draft; merchant manually publishes. (B) Preset application publishes automatically. | Option A: safe (rollback available before publish), slower time-to-value. Option B: fast, but applies immediately to live storefront including section text changes that may be wrong. | Option A (draft-only). The publish action should always be an explicit merchant decision. | Product lead |

---

## Risk Register

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| R-01: `compilePortableToLiquidBundle()` continues using Urban Kicks fixture as base for ALL Liquid stores, polluting all merchant storefronts with Urban Kicks branding | HIGH (already happening) | HIGH (all Liquid-enabled stores have wrong title suffix, body class, storeName defaults) | Resolve C-03 as the first code change in Phase B. |
| R-02: Preset activation endpoint is built without a standardized schema, requiring rewrite of all preset definitions | MEDIUM (if C-02 is not resolved first) | HIGH (all 8 vertical preset definitions must be rewritten) | Resolve C-02 before writing any preset JSON. Treat ThemePresetDocumentSchema as the first engineering deliverable of Phase B. |
| R-03: postMessage type-name inconsistency in the editor means section selection highlight is broken in React mode, not just Liquid mode | MEDIUM (unconfirmed) | HIGH (editor UX is broken if true; preset application is invisible to merchants) | Test immediately in dev environment. If confirmed broken, fix before any other editor work. |
| R-04: AI-generated policy pages contain legally incorrect text for Indian commerce regulations | MEDIUM (AI outputs are generic) | HIGH (merchant compliance risk; Consumer Protection Act, IT Act, FSSAI) | Add a legal disclaimer to all AI-generated policy text ("Review this with a legal professional before publishing"). Do not auto-publish AI-generated policies. |
| R-05: Font loading via Google Fonts creates a data residency issue for merchants with Indian data-residency requirements | LOW (current: no font loading at all) | MEDIUM (DPDP Act 2023 compliance risk if Google Fonts requests include merchant/customer identifiers) | Use sub-resource integrity, avoid sending user-identifying data to Google Fonts, or host fonts locally. Flag for privacy review before implementing font loading. |
| R-06: Missing `lb-cart` CRUD mutations mean the React `CartPageClient` fallback cannot be retired, blocking full Liquid coverage | HIGH (confirmed missing) | MEDIUM (cart is a core commerce page; React fallback works but is a parallel code path to maintain) | Scope `lb-cart` mutation implementation into Phase C. Accept React fallback for Phase B. |
| R-07: Dairy/restaurant verticals attract merchants who cannot launch due to missing subscriptions / menu modifier domains | HIGH (subscriptions domain NOT IMPLEMENTED) | HIGH (merchant churn if vertical preset sets expectations that the platform cannot meet) | Do not include dairy or restaurant in Phase B preset launches. If these verticals appear in marketing materials, add clear "coming soon" gating. |
| R-08: MCP server writing theme drafts concurrently with an open browser editor session causes silent data loss (second writer's changes are lost) | MEDIUM (any concurrent editing scenario) | MEDIUM (merchant loses their editor changes without warning) | The `base_version` conflict detection returns 409 for stale writes — ensure MCP tools handle 409 by re-reading state and merging, not by retrying the stale write. Document this in the MCP server implementation guide. |
| R-09: LiquidJS render errors propagate uncaught and crash the Next.js render rather than falling back to React | MEDIUM (any section with render limit exceedance) | HIGH (storefront goes down for a store instead of gracefully falling back) | Add try/catch around `engine.parseAndRender()` in `renderLiquidTemplateSections` returning `null` on error to trigger the existing React fallback path. This is a Phase B quick-win already identified in the README. |
| R-10: DOMPurify JSDOM singleton failure creates a cascading storefront outage | LOW (rare) | HIGH (all Liquid-rendered storefronts fail if the singleton rejects) | Add an explicit rejection handler on the singleton promise that falls back to the React render path. Phase B quick-win. |
| R-11: `theme_id = 'modern'` is a ghost reference (no matching themes row), causing editor load failures for all web-created stores | MEDIUM (likely) | HIGH (merchant editors broken for all stores with theme_id = 'modern') | Resolve C-08 immediately. If the reference is ghost, either seed the row or migrate all stores before Phase B editor work. |
| R-12: 26 MCP tools are "READY NOW" but cannot be tested without resolved AI agent authentication (C-05) | HIGH (auth strategy unresolved) | MEDIUM (Phase B MCP deliverables slip) | Decide C-05 in sprint 1. If OAuth PKCE, use the existing identity-platform flow immediately. If API keys, add the route early in Phase B. |

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-discovery/19-unknowns-register.md`*
*Generated: 2026-06-18 from synthesis of docs/theme-discovery/10 through 18 and docs/theme-research/README.md*
