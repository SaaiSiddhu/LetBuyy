# Phase 12 — Shopify Compatibility Investigation

Investigation date: 2026-06-05

## Method

This report compares LetBuyy's current implemented state against the Shopify Online Store 2.0 platform model, subsystem by subsystem. Every claim about LetBuyy is grounded in repository evidence (file path, line where helpful) gathered by direct source reading and pattern search of `/Users/saai_sidd/Git/Letbuyy_Store` (excluding `node_modules`, `.git`, build/test artifacts). Shopify reference descriptions are concise platform-model summaries used only as the comparison baseline. Where a capability could not be located, the report states "not found in repository". This document records current state and gaps only — no solutions, designs, or roadmaps.

Primary evidence roots inspected: `packages/theme-engine`, `packages/app-engine`, `packages/extension-host`, `packages/billing-core`, `packages/event-core`, `packages/search-core`, `packages/auth-core`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/theme-marketplace`, `apps/app-marketplace`, `apps/developer-portal`, `apps/platform-operations-portal`, `services/api-gateway`, `services/webhook-service`.

---

## 1. Theme Runtime (Liquid engine, JSON templates, sections everywhere, section groups, dynamic sources/metafields)

### (a) Shopify reference
Shopify OS 2.0 themes are Liquid-file packages (`layout/theme.liquid`, `sections/*.liquid` with `{% schema %}`, `templates/*.json`, `config/settings_schema.json`, `config/settings_data.json`, `locales/*.json`). JSON templates reference sections per route; sections are addable on every template ("sections everywhere"); header/footer live in section groups; section/block settings can bind to dynamic sources backed by metafields/metaobjects; Liquid exposes ~50 objects (`product`, `collection`, `cart`, `customer`, `shop`, `request`, `routes`, ...) and ~100 filters (`money`, `image_url`, `asset_url`, `t`, ...), plus `{% render %}`/snippets.

### (b) What LetBuyy has today
- **Dual renderer engine contract** — `json-contract` and `liquid` engines behind a common `ThemeRenderer` interface: `packages/theme-engine/src/theme-renderer.ts:26` (`ThemeRendererEngine`), `:82` (`JsonContractThemeRenderer`), `:104` (`LiquidRenderer`), `:216` (`createThemeRenderer`).
- **A real Liquid engine** using `liquidjs` with sandbox limits (`cache:false, dynamicPartials:false, strictFilters:true, parseLimit, renderLimit:250, memoryLimit:2_000_000`): `packages/theme-engine/src/theme-renderer.ts:1` (import) and `:230-251` (`createLiquidEngine`).
- **Shopify-shaped bundle layout**: `layout/theme.liquid`, `config/settings_schema.json`, `config/settings_data.json`, `templates/*.json`, `sections/*.liquid`, `blocks/*.liquid`, `locales/*.json` — `packages/theme-engine/src/theme-bundle.ts:8-28` (`THEME_BUNDLE_PATHS`, `LIQUID_THEME_BUNDLE_PATHS`).
- **`{% schema %}` enforcement in Liquid section files**: sections must contain `{% schema %}...{% endschema %}` blocks (`theme-bundle.ts:171-173`, `:185-197`), with strict Zod schemas for section settings, inline blocks, `@app` blocks, presets, and `enabled_on`/`disabled_on` template lists (`theme-bundle.ts:125-163`).
- **JSON templates with section/block instances and ordering** validated cross-referentially (order ↔ section ids, block_order ↔ block ids): `theme-bundle.ts:233-276` (`ThemeBundleTemplateSchema`).
- **Section groups** at the contract level: `StorefrontSectionGroupConfig` with `role: 'header'|'footer'|'aside'|'custom'` — `packages/theme-engine/src/index.ts:106-110`; resolved at render time in `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:39-63` (`resolveSectionGroups`) and rendered via `StorefrontSectionGroupRenderer` (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:226-251`).
- **Per-route template resolution** with route types `index|product|collection|page|policy|blog|article|cart|search|customer_account|customer_orders|customer_wishlist|password|not_found`: `apps/storefront-runtime/src/lib/theme-engine/types.ts:5-19`; template selection (assigned template → keyed template → index → fallback sections → legacy flat sections) in `template-resolver.ts:186-256`. Collection/product/shop routes render through the section composition engine with fallback sections (e.g. `apps/storefront-runtime/src/app/store/[subdomain]/shop/page.tsx:43-49`).
- **Locale dictionaries with `t:` translation-key resolution** applied to template configs: `theme-bundle.ts:536-656` (`resolveThemeTranslation`, `localizeThemeTemplateConfig`); store locale flows from DB (`apps/storefront-runtime/src/lib/store-service.ts:566,582`).
- **Liquid render pipeline in storefront**: `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:152-190` (`renderLiquidPlan`) calls `createThemeRenderer('liquid')`, injects app-block HTML, and outputs sanitized HTML via `dangerouslySetInnerHTML` (`:74-84`), with four client hydration islands (`add-to-cart`, `cart-drawer`, `search`, `variant-picker`) — `packages/theme-engine/src/theme-bundle.ts:30-51` and `apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx`.
- **Liquid scope objects** are limited to `shop`, `request`, `settings`, `routes` (hardcoded 3 routes: root/cart/search), `section`, `block`: `theme-renderer.ts:332-362` (`buildLiquidScope`).
- **First-party JSON-contract React section registry** (the default production path) with 18 registered renderer keys (`core.header`, `core.footer`, `core.hero`, `core.product-grid`, `core.product-detail`, `core.featured-products`, ...): `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:198-316`; 12 canonical section schemas in `packages/theme-engine/src/theme-registry.ts:419-432` (`SECTION_SCHEMAS`).
- **Dynamic data binding** exists only for products: `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:7-8` (only `productGrid`/`featuredProducts` types and a `settings.dataBinding.resource === 'products'` hook, `:37-44`).

### (c) Missing capabilities (gaps)
- **Shopify-compatible Liquid object model**: no `product`, `collection`, `cart`, `customer`, `linklists`, `pages`, `blogs`, `all_products`, `paginate` objects in the Liquid scope — only `shop/request/settings/routes/section/block` (`theme-renderer.ts:332-362`). A Liquid theme cannot query live catalog data.
- **Shopify Liquid filters**: no custom filters registered (`registerFilter` not found in `packages/theme-engine`); with `strictFilters: true` (`theme-renderer.ts:234`), Shopify filters such as `money`, `image_url`, `asset_url`, `t`, `default_pagination` would throw. Only liquidjs built-ins are available.
- **`{% render %}` / snippets are explicitly forbidden**: `'{% include'`, `'{% layout'`, `'{% render'` are banned fragments (`theme-bundle.ts:100-109`), so no snippet composition.
- **Theme JavaScript/assets**: `<script` is a forbidden fragment in Liquid sources (`theme-bundle.ts:101-103`) and rendered HTML strips scripts and `on*` handlers (`theme-renderer.ts:471-476`); `assets/` files have a manifest slot (`ThemeLiquidRendererManifestSchema.assets`, `theme-bundle.ts:205-215`) but no asset upload/serving pipeline was found in repository.
- **Metafields/metaobjects**: not found in repository (no `metafield`/`metaobject` matches in `apps/`, `packages/`, `services/`, or SQL under `database/`/`supabase/`).
- **Dynamic sources** in the Shopify sense (binding any setting to resource metafields): not found in repository; only the product-array binding noted above.
- **`enabled_on`/`disabled_on` enforcement**: the fields are parsed in bundle schemas (`theme-bundle.ts:157-162`) but no consumer enforces them in editor or runtime (no matches for `enabled_on` in `apps/` or `services/`).
- **Liquid theme adoption**: the Liquid path is exercised only by fixtures and unit tests (`createMinimalLiquidThemeBundleFixture`, `createUrbanKicksLiquidThemeBundleFixture` in `theme-bundle.ts:1162,1356`; consumed only by `tests/theme-engine/first-party-liquid-portability.test.mjs`). No production seed or installed store uses the Liquid renderer; default storefront path is the React JSON-contract registry.
- **Layout `content_for_header`/`content_for_footer` are hardwired to empty strings** (`theme-renderer.ts:187-193`, `:246-249`) — no injection surface (see §7).
- **Pagination, `{% form %}`, `{% paginate %}`, search/predictive-search Liquid tags**: not found in repository.

### (d) Score: **4/10** — A genuine Liquid engine, Shopify-shaped bundle format, JSON templates, and section groups exist, but the Liquid runtime has no commerce object model, no Shopify filters, no snippets/assets, no metafields, and is not used by any live store.

---

## 2. Theme Editor (drag-drop sections, live preview, settings_schema, presets, draft/publish)

### (a) Shopify reference
Shopify's theme editor renders the real storefront in an iframe, supports drag-and-drop reordering of sections and blocks, per-template editing (home, product, collection, ...), section presets in the add-section picker, `settings_schema`-driven setting panels, app block/app embed management, draft (unsaved changes) vs publish, and version history.

### (b) What LetBuyy has today
- **Active editor page**: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — a full-screen editor with sections panel, settings panel, versions panel (`PanelMode = 'sections'|'settings'|'versions'`, `:50`), device toggles desktop/tablet/mobile (`:600,1204-1220`), undo/redo history (`EditorHistory`, `:83-86`), add-section modal (`createSectionFromSchema`, `:411`), block add/remove (`:1005-1006`), section visibility toggles, and schema-driven settings forms via `SchemaFormRenderer` (`apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`).
- **Draft → publish lifecycle**: draft save `PUT /api/themes/[themeId]/editor/draft` (`apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts`); publish via gateway (`page.tsx:864-884`, toast "Theme published"); gateway endpoints `PUT /:slug/editor/draft`, `DELETE /:slug/editor/draft`, `POST /:slug/publish`, `POST /:slug/preview-session`, `GET /:slug/releases`, `POST /:slug/releases/:releaseId/rollback` — `services/api-gateway/src/routes/themes.ts:380,394,418,434,448,472`. Release records carry `release_version`, `is_current`, `rollback_of_release_id` (`packages/theme-engine/src/index.ts:130-144`).
- **Optimistic concurrency**: `SaveThemeDraftSchema.base_version` and `PublishThemeSchema.base_version` (`packages/theme-engine/src/index.ts:886-898`).
- **Preview tokens**: `PreviewTokenSchema` (TTL 60–3600s, `index.ts:900-903`); storefront accepts `theme_preview_token` and sets a per-subdomain preview cookie (`apps/storefront-runtime/src/proxy.ts:15,54-66`); preview store resolution in route pages (`apps/storefront-runtime/src/app/store/[subdomain]/shop/page.tsx:35-39`).
- **Storefront-side editor wiring exists**: `editorMode` section frames with `data-letbuyy-editor-section-id` (`apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx`) and a postMessage bridge handling selection/scroll/viewport messages plus a ready handshake (`apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx:5-90`).
- **Orphaned iframe-editor components**: a second-generation editor shell (`CenterPanel.tsx` with sandboxed storefront iframe + `theme_preview_token` + `LETBUYY_THEME_EDITOR_SELECTION` postMessage, `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx:30-90`; plus `LeftSidebar.tsx`, `RightSidebar.tsx`, `EditorHeader.tsx`, `IconRail.tsx`, `SectionItem.tsx`, `AddSectionModal.tsx`, `ThemeSettingsPanel.tsx`) exists but is **not imported by any page** (grep for `CenterPanel|LeftSidebar|RightSidebar|EditorHeader` matches only the component files themselves).
- **Flutter merchant app** has a parallel section editor with native reordering (`onReorder` at `apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart:888`) and theme editor models (`packages/dart/models/lib/src/merchant_app/theme_editor_models.dart`).

### (c) Missing capabilities (gaps)
- **No drag-and-drop in the active web editor**: section reordering is up/down buttons only (`moveSection(sectionId, direction: -1 | 1)`, `page.tsx:964-981`); no DnD library or `onDrag*` handlers found in the editor page.
- **No live storefront preview in the active editor**: the "Live preview" panel renders a synthetic `PreviewCanvas` of schema-driven mock sections (`page.tsx:1198-1232`; preview body text "Schema-driven section preview." at `:2014`), not the real storefront iframe. The iframe preview path (CenterPanel + storefront-preview-bridge + preview tokens) is built but unwired.
- **Single-template editing only**: the editor reads only `templates.home || templates.index || first` (`page.tsx:336`) and flattens to `header/footer/template` slots (`EditorState`, `:69-76`). No template switcher; product/collection/page templates are not editable.
- **Section presets are defined but not surfaced**: presets exist on schemas (`theme-registry.ts:96-100` etc.) and in Liquid bundle schema (`theme-bundle.ts:143-148`), but the only `preset` references in the editor page are settings_data presets passthrough (`page.tsx:494-496`); the add-section flow uses `schema.defaults`, not preset variants.
- **No app block / app embed management in the editor**: no matches for `@app`, `app-block`, `appBlock`, or `app_block` anywhere in `apps/merchant-control-plane/src`.
- **No section-group editing beyond fixed header/footer slots**: editor state hardcodes `header|footer|template` (`page.tsx:69-76`); custom groups/aside roles (supported by the runtime contract) are not editable.
- **No inspector-from-preview interactions** (click section in preview canvas selects, `:1747-1755`, but no inline text editing, no hover-add between sections).
- **No theme code editor** (edit Liquid/JSON files in admin): not found in repository.
- **No image picker/media library integration field type** beyond URL/image text fields (`SchemaField` types, `theme-registry.ts:12-24` — `image` is a string field; no asset browser found in editor).

### (d) Score: **5/10** — Solid draft/publish/version/rollback spine and schema-driven settings, but the shipped editor previews mock sections instead of the real storefront, edits only the home template, and lacks drag-drop, presets surfacing, and app block/embed management (the iframe-preview generation exists as dead code).

---

## 3. Theme Marketplace (submission, review, licensing, updates)

### (a) Shopify reference
Shopify Theme Store: partners submit theme packages; Shopify runs automated + manual review; approved themes are listed with pricing; merchants buy a single-store license; theme vendors ship version updates which merchants can pull into their store while keeping customizations.

### (b) What LetBuyy has today
- **Marketplace storefront app** `apps/theme-marketplace` with browse (`src/app/themes/page.tsx`), detail (`src/app/themes/[slug]/page.tsx`), checkout (`src/app/checkout/page.tsx`), install (`src/app/install/page.tsx`), partner upload panel (`src/components/theme-upload-panel.tsx`), and dashboards for purchases/installations/downloads (`src/app/dashboard/*`).
- **Submission API**: `POST /v1/themes/packages/upload` validates portable JSON-contract or Liquid bundles (`UploadThemePackageSchema`, `packages/theme-engine/src/theme-bundle.ts:509-514`) and persists `theme_packages`, `theme_package_versions`, `theme_schema_manifests`, `theme_renderer_manifests` (`services/api-gateway/src/execution/schema-registry-execution.adapter.ts:322-410`); supports `submission_mode: 'marketplace' | 'private_install'` (`services/api-gateway/src/routes/themes.ts:489-557`).
- **Review pipeline**: each marketplace submission creates a `marketplace_review_records` row with automated checks (`createMarketplaceReviewRecord`, `themes.ts:517-547`; record model with statuses `pending|in_review|approved|rejected|changes_requested` in `services/api-gateway/src/lib/marketplace-review-records.ts:4-5`). Operations decide via `GET /operations/marketplace-reviews` and `POST /operations/marketplace-reviews/:id/decision` (`services/api-gateway/src/routes/operations.ts:300,320`), which map decisions to package/version statuses (`operations.ts:141-152`: approved→active/published, rejected→disabled/revoked) and emit `theme.approved`/`theme.rejected` events (`operations.ts:155-160`). A human review UI exists in `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx:9-181`.
- **Licensing**: paid purchase via Razorpay order (`POST /:slug/purchase`, `themes.ts:604`) and signature verification (`POST /:slug/purchase/verify`, `themes.ts:783-833`), generating a `license_key` (`LB-THEME-...`, `themes.ts:827`) and emitting `theme.purchase.completed` domain + audit events (`themes.ts:840-870`). License model (`license_type: 'single'|'multi'|'unlimited'`) is in `packages/theme-engine/src/index.ts:988-1001` (`ThemePurchase`).
- **Catalog/install**: `GET /themes`, `/themes/categories`, `/themes/industries`, `/themes/:slug`, `POST /themes/:slug/install`, purchases/installations lists (`themes.ts:137,243,262,287,310,560,588`). Theme reviews (ratings) modeled in `index.ts:1016-1028` (`ThemeReview`).
- **Versioning storage**: `theme_package_versions` upsert keyed by `(theme_package_id, version)` with `release_status` and `compatibility_range` (`schema-registry-execution.adapter.ts:353-374`; `ThemeBundlePackageMetadataSchema.compatibility_range`, `theme-bundle.ts:319`).

### (c) Missing capabilities (gaps)
- **No theme-update distribution to installed stores**: no `update_available` / theme-version upgrade endpoint, no notification to merchants on new version publish, no per-store "update theme" flow (grep for `theme.update|update_available|new_version|version_installed` in `services/api-gateway/src` returns nothing). `ThemeInstallation.version_installed` exists only as a type (`packages/theme-engine/src/index.ts:1003-1014`).
- **No license enforcement at install/runtime**: license keys are generated but no code validates `license_key`/`license_type` during install or render (only generation site at `themes.ts:827`).
- **No partner theme dashboard API**: self-documented as missing — "a partner-owned theme dashboard endpoint distinct from marketplace operations is not present" (`apps/developer-portal/src/lib/reference.ts:301-309`, status "Partial").
- **No demo-store preview provisioning** for marketplace themes (preview URLs are static fields on `Theme`, `index.ts:966-969`; no "try theme on a demo store" flow found).
- **No multi-currency pricing** — purchase order currency is locked to INR (`ThemePurchaseOrderSchema: z.enum(['INR'])`, `index.ts:911-914`).
- **Manual review tooling depth**: review decisions exist, but no reviewer checklist execution against rendered themes, screenshots diffing, or accessibility/perf gating beyond the two automated checks recorded at submission (`themes.ts:524-537`).

### (d) Score: **6/10** — Submission, automated+manual review, purchase with license keys, install, and version storage all exist end-to-end; missing are update distribution to installed stores, license enforcement, and partner-facing theme analytics.

---

## 4. App Marketplace (listing, review, install, OAuth grant screen, billing on install)

### (a) Shopify reference
Shopify App Store: public listings with categories/reviews; partner submission + Shopify review; merchant install flow showing an OAuth grant screen listing requested scopes; managed app billing (recurring/usage charges) with merchant approval at install/upgrade; uninstall lifecycle with webhooks.

### (b) What LetBuyy has today
- **Marketplace app** `apps/app-marketplace` with categories (`src/app/(store)/categories/page.tsx`), app detail (`src/app/(store)/apps/[slug]/page.tsx`), search API (`src/app/api/apps/search/route.ts`), and a consent/install panel rendering requested scopes as permission labels before install (`src/components/AppInstallConsentPanel.tsx:14-101`, `formatScopeLabel` mapping).
- **Gateway listing/review APIs**: `GET /app-store/categories`, `GET /app-store/apps`, `GET /app-store/apps/:id`, `GET|POST /app-store/apps/:id/reviews` — `services/api-gateway/src/routes/app-store.ts:689,704,753,774,797`.
- **Install / uninstall lifecycle**: `POST /app-store/apps/:id/install` and `DELETE /app-store/apps/:id/install` (`app-store.ts:1943,2129`) with scope validation against the app's `api_scopes` (`normalizeAppInstallScopes`, `packages/app-engine/src/index.ts:1326-1342`; used at `app-store.ts:1980`).
- **OAuth authorization-code flow**: `POST /apps/:id/oauth/authorize` (store ownership + scopes + registered redirect URI checks; 15-minute codes), `POST /oauth/token` (code → scoped JWT app access token), `POST /oauth/token-exchange` (embedded session → installation-scoped token) — `app-store.ts:1593,1778,1866`; redirect-URI allowlisting and HTTPS enforcement in `app-engine` (`normalizeAppOAuthRedirectUri`, `index.ts:1348-1374`); contract documented in `apps/developer-portal/src/lib/reference.ts:156-187`.
- **App billing**: `POST /installations/:id/charges` creates recurring/usage charges with idempotency keys, 80/20 revenue share, 18% partner GST, India payout rails, and a merchant `approval_url`; `POST /charges/:id/approve` activates — `app-store.ts:1334-1503`; billing primitives in `packages/billing-core/src/index.ts:69-98` (`AppChargeBillingModeSchema`, `CreateAppBillingChargeSchema`, `IndiaPayoutRailSchema`) and `:267-268` (`DEFAULT_APP_REVENUE_SHARE_BPS = 8000`, `DEFAULT_PARTNER_GST_BPS = 1800`). Charge events `app.charge.created`/`app.charge.activated` are catalogued in `packages/event-core/src/index.ts:89-90`.
- **Mandatory compliance webhook topics** auto-attached to app webhook plans: `customers/data_request`, `customers/redact`, `shop/redact` (`packages/app-engine/src/index.ts:150-156`; documented at `developer-portal/src/lib/reference.ts:211-219`).
- **Marketplace review records** shared with themes (`marketplace_review_records`, decision routes in `operations.ts:300-320`; partner submissions at `POST /app-store/developers/apps`, `app-store.ts:2576`).
- **Merchant-side app management**: installed apps page with uninstall confirmation in `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsContent.tsx:25-119`.
- **Partner dashboard aggregate**: `GET /app-store/partners/dashboard` returns developer profile, apps, review records, billing charges, and payout ledger entries (`app-store.ts:2369-2457`), gated by `requireRoleCategory('partner')`.

### (c) Missing capabilities (gaps)
- **OAuth grant screen is not the install path used by the marketplace UI**: `AppInstallConsentPanel` posts directly to `/api/apps/:id/install` (`AppInstallConsentPanel.tsx:81-85`) rather than driving the `/oauth/authorize` redirect flow; the authorization-code endpoint is a JSON API (`app-store.ts:1593`) with no hosted grant-screen page rendering app icon/scopes/redirect (no `oauth/authorize` page found under `apps/`).
- **Billing is not wired into install**: `POST /apps/:id/install` contains no charge creation (read of `app-store.ts:1943-2129` shows scope/webhook handling only); charges are a separate post-install API. No "approve subscription to finish installing" flow found in repository.
- **No app listing-quality review depth** (screenshots requirements, demo screencast, security questionnaire): submission inserts a `marketplace_apps` row + review record; no automated security/scope-least-privilege checks beyond bundle metadata found.
- **No app version/release channel model**: `marketplace_apps` has no version rows analogous to `theme_package_versions` in the gateway code read; manifest carries `app.version` (`app-engine/src/index.ts:270-276`) but no per-version review/rollout found.
- **No usage-based billing metering pipeline** (usage records ingestion endpoint for partners): only merchant-pre-approved usage charge shape exists (`billing-core/src/index.ts:39-45`, `MerchantApprovedUsageChargeSchema`).
- **No app refunds/credits/proration model**: not found in repository.

### (d) Score: **6/10** — Listing, reviews, consent screen with scopes, OAuth code+token exchange, uninstall, partner dashboard, and an unusually complete India-localized app billing/payout model exist; gaps are the unhosted OAuth grant page, billing decoupled from install, and absent app versioning/usage metering.

---

## 5. App Extensions framework (extension targets, app blocks, app embeds, theme app extensions, admin UI extensions, function/checkout extensions)

### (a) Shopify reference
Shopify ships typed extension surfaces: theme app extensions (app blocks + app embeds packaged with the app), checkout UI extensions with fixed extension targets, admin UI extensions (blocks/actions), Shopify Functions (deterministic WASM for discounts/shipping/payment/validation), POS/customer-account extensions, all declared in app TOML config and reviewed.

### (b) What LetBuyy has today
- **Versioned app manifest** `2026-06-05.ws13` declaring scopes, extensions, and functions: `packages/app-engine/src/index.ts:190-287` (`LetbuyyAppManifestSchema`); normalization with legacy aliases (`normalizeLetbuyyAppManifest`, `:795-857`); example manifest with all three surfaces + a WASM function (`createExampleLetbuyyAppManifest`, `:1148-1214`).
- **Three extension surfaces**: `admin.ui`, `checkout.ui`, `theme.app_block` (`LETBUYY_APP_MANIFEST_EXTENSION_SURFACES`, `:192-196`) with fixed target sets:
  - admin: `admin.dashboard.widget`, `admin.settings.page`, `admin.product.action`, `admin.order.action` (`:198-203`);
  - checkout: `checkout.contact.render-after`, `checkout.shipping-options.render-after`, `checkout.payment-options.render-after`, `checkout.order-summary.render-after`, `checkout.thank-you.render-after` (`:205-211`);
  - theme: `storefront.home.after-hero`, `storefront.product.after-form`, `storefront.collection.after-grid`, `storefront.footer.before` (`:213-218`).
- **Extension host package** with sandbox policies: `packages/extension-host/src/index.ts` — admin targets (`:9-14`), iframe sandbox/allow constants (`:17-18`, `:26-27`), checkout targets (`:19-24`), registration normalization with HTTPS-only source URLs (`:188-265`), and bridge-context builders (`:283-328`).
- **Renderers**: `iframe`, `web_component`, `liquid_app_block` (`AppManifestExtensionRendererSchema`, `app-engine/src/index.ts:231`).
- **Functions (WASM)**: deterministic-only manifests with HTTPS module URL, SHA-256 digest, 1–5ms timeout, 64–1024KB memory (`AppManifestFunctionSchema`, `:253-268`); typed I/O contracts (`AppFunctionRuntimeInputSchema`/`OutputSchema`, `:292-339`) with operations `apply_discount_code`, `select_shipping_method`, `allow_payment_methods`, `validation_error` (`:316-334`); hooks `cart.discount.calculate`, `checkout.shipping.rate`, `checkout.payment.customize`, `checkout.validation.run` (`:220-225`). A real execution runtime compiles/verifies/caches WASM with timeouts (`services/api-gateway/src/extensions/app-functions-runtime.ts:21-130`, hook order at `:22-27`) and is invoked during storefront order creation behind `FEATURE_EXTENSIONS` (`services/api-gateway/src/routes/storefront.ts:2285-2294`).
- **Per-store extension/function registry with lifecycle**: install plan rows with `status: enabled|disabled|revoked`, timestamps, manifest/app versions (`AppExtensionRegistryRecord`/`AppFunctionRegistryRecord`, `app-engine/src/index.ts:446-501`); lifecycle routes `GET /v1/app-store/installations/:id/extensions`, `PATCH .../extensions/:registrationId`, `PATCH .../functions/:registrationId`, `GET /v1/storefront/:subdomain/checkout/extensions` (`:513-519`; implemented at `services/api-gateway/src/routes/app-store.ts:911,987,1061` and `routes/storefront.ts:2020`); observability signals and a published review checklist (`:505-511`, `createAppExtensionReviewChecklist`, `:1070-1103`).
- **Checkout extension host in the storefront**: sandboxed iframes per target with postMessage context + resize protocol (`apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx:55-100`), used in `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`.
- **Admin UI extension host**: `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx:72-110` renders enabled admin extensions in policy-sandboxed iframes with App Bridge context.
- **Feature gating**: `FEATURE_EXTENSIONS` gate on extension routes (`services/api-gateway/src/index.ts:358-379`).

### (c) Missing capabilities (gaps)
- **App embeds surface does not exist** (see §7) — `theme.app_block` is the only theme surface; no body/head injection extension type.
- **Theme app extensions are not packaged Liquid shipped by the app**: `theme.app_block` with renderer `liquid_app_block` accepts a `source.entrypoint` such as `blocks/loyalty-rewards-card.liquid` (`app-engine/src/index.ts:1186`), but no pipeline stores/compiles/renders that Liquid file — storefront app-block HTML is synthesized from a fixed inline/iframe content schema (`AppBlockInstanceSchema` heading/body/cta, `app-engine/src/index.ts:57-74`; rendered by `renderLiquidAppBlockHtml` in `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:95-122`). Apps cannot ship arbitrary block markup.
- **No POS, customer-account, flow/automation, or marketing-activity extension surfaces**: not found in repository.
- **Function hooks limited to 4 checkout/cart hooks**; no order-routing, fulfillment, cart-transform, validation outside checkout, or delivery-customization hooks (`LETBUYY_APP_FUNCTION_HOOKS`, `:220-225`).
- **Discount function output is a coupon-code selection, not computed discounts**: `apply_discount_code` only sets an existing coupon (`:316-320`, applied at `:386-389`) — functions cannot synthesize line-level discounts.
- **Admin extension targets are page/widget-level only** (4 targets); no block-level extension points inside product/order detail forms.
- **No extension dev-preview/hot-reload tooling**: not found in repository (consistent with no CLI, §8).

### (d) Score: **6/10** — A typed, lifecycle-managed, observable extension framework with sandboxed admin/checkout iframes and a real deterministic-WASM function runtime wired into checkout; missing app embeds, true app-shipped theme Liquid, broader hook coverage, and non-checkout surfaces.

---

## 6. App Blocks in themes (schema, render surface in sections)

### (a) Shopify reference
App blocks: apps ship blocks (Liquid + schema) that merchants add inside any OS 2.0 section that accepts `@app` blocks, configured/reordered in the theme editor like native blocks, rendered inline by the theme.

### (b) What LetBuyy has today
- **`@app` block type in the Liquid bundle contract**: `ThemeLiquidAppBlockSchema` (`packages/theme-engine/src/theme-bundle.ts:132-136`); `isLiquidAppBlockType` matches `@app` and `app:` prefixes (`:425-427`); bundle validation enforces "app_blocks_require_section_app_block_support" (`:486-499`, rule named at `:1037`); JSON-contract sections expose `accepts_app_blocks` (`:294`).
- **Editor-schema synthesis for app blocks**: `@app` block schema with `extension_handle` + `slot` fields auto-added to runtime block schemas (`buildLiquidRuntimeBlockSchemas`, `theme-bundle.ts:795-822`).
- **Liquid render path**: app blocks inside Liquid sections resolve configured HTML by `sectionId.blockId | blockId | type | extension_handle | slot` keys, else a placeholder `<div data-letbuyy-app-block=...>` (`packages/theme-engine/src/theme-renderer.ts:271-330` block loop, `:370-391` `resolveLiquidAppBlockHtml`); sanitized before output (`:471-476`).
- **JSON-contract render surface**: a dedicated `appBlockSlot` section type with `app-block` block schema (slot, render_mode inline|iframe, iframe_url, cta fields) — `packages/theme-engine/src/theme-registry.ts:302-353`; rendered by `apps/storefront-runtime/src/components/sections/app-block-slot.tsx` (registered renderer in `renderer-registry.tsx`).
- **Runtime injection from installations**: store payloads carry `app_blocks` (`apps/storefront-runtime/src/lib/store-service.ts:33`); `injectAppBlocksIntoSections` maps installed `theme.app_block` registry rows into matching `appBlockSlot` sections by slot (`store-service.ts:185-247`); validated by `AppBlockInstanceSchema` (`packages/app-engine/src/index.ts:64-74`).
- **Liquid app-block HTML synthesis** with iframe sandbox option for `render_mode: 'iframe'` (`composition-engine.tsx:95-122`), keyed four ways into the renderer (`buildLiquidAppBlocks`, `:124-150`).

### (c) Missing capabilities (gaps)
- **Merchants cannot add/configure app blocks in the theme editor**: zero app-block references in `apps/merchant-control-plane/src` (grep `@app|app-block|appBlock|app_block` → no matches). App blocks appear only via runtime injection into pre-placed `appBlockSlot` sections or pre-authored `@app` entries inside theme bundle templates.
- **Only sections of type `appBlockSlot` (JSON-contract) or sections declaring `@app` (Liquid) accept app blocks** — there is no "any section accepts @app by default" behavior; in the first-party schema registry only `appBlockSlot` carries an app block schema (`theme-registry.ts:419-432` shows no other section with app blocks).
- **App block content is a fixed card schema** (title/heading/body/cta or iframe) rather than app-provided markup/settings schema (`AppBlockContentSchema`, `app-engine/src/index.ts:57-62`); app-defined block settings panels for merchants: not found in repository.
- **4 theme slots only** (`LETBUYY_APP_MANIFEST_THEME_TARGETS`, `app-engine/src/index.ts:213-218`); product/collection slots are declared as targets but no first-party section schema exposes `storefront.product.after-form` or `storefront.collection.after-grid` slots in `theme-registry.ts` (only the two home presets at `:311-314`).

### (d) Score: **4/10** — The contract (`@app`, accepts_app_blocks, slot injection, sanitized render) is real and runs in the storefront, but merchants have no editor surface to place/configure app blocks and apps cannot ship their own block markup or settings.

---

## 7. App Embeds (body/head injection with toggle in editor)

### (a) Shopify reference
App embeds: invisible/floating app components injected into the theme `<head>` or before `</body>` (via theme app extensions), toggled on/off per theme in the theme editor's "App embeds" panel, no theme code edits required.

### (b) What LetBuyy has today
- **Not found in repository.** Exhaustive searches for `app_embed`, `appEmbed`, `app embeds`, `script_tag`, `scriptTag`, head/body injection across `apps/`, `packages/`, `services/` return no app-embed implementation.
- The only "embed" concept is **embedded admin apps** (`AdminAppEmbedSurface` / `normalizeAppAdminEmbedSurface`, `packages/app-engine/src/index.ts:1249-1295`; `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx`) — an admin-dashboard iframe, not a storefront injection.
- The Liquid layout's injection points are inert: `content_for_header` and `content_for_footer` are globally set to empty strings in the engine (`packages/theme-engine/src/theme-renderer.ts:246-249`) and rendered with empty values (`:187-193`). `<script>` tags are forbidden in theme sources (`theme-bundle.ts:101-103`) and stripped from rendered HTML (`theme-renderer.ts:471-476`).
- No editor toggle exists (no app-embed references in `apps/merchant-control-plane/src`, §6 evidence).

### (c) Missing capabilities (gaps)
- App-embed extension surface (manifest type, registry rows, render targets): not found in repository.
- Head/body injection pipeline (populating `content_for_header`/`content_for_footer`, or a Next.js layout injection equivalent in `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx`): not found in repository.
- Editor on/off toggle per embed: not found in repository.
- Sanctioned script-loading path for apps on the storefront (script tags API or pixel manager): not found in repository.

### (d) Score: **0/10** — The capability does not exist; the engine's injection points are hardwired empty and scripts are structurally blocked.

---

## 8. Developer Platform (CLI, app scaffold, partner dashboard, API versioning, webhooks registry, scopes model, app bridge)

### (a) Shopify reference
Shopify CLI (`shopify app/theme dev|deploy`, scaffolding templates), Partner Dashboard (apps, themes, API keys, earnings, analytics), date-versioned Admin/Storefront APIs with deprecation windows, a large webhook topic registry (~200 topics) with HMAC verification and retries, a granular access-scope catalog, and App Bridge (embedded session tokens, UI actions).

### (b) What LetBuyy has today
- **Developer portal app** `apps/developer-portal` (docs/api/sdk/dashboard pages) whose reference data is an honest live/missing ledger: `src/lib/reference.ts` — gateway route groups (`:29-145`), rate-limit policy facts (`:147-154`), OAuth guide (`:156-187`), webhook guide (`:189-230`), SDK guides (`:232-287`), dashboard shell (`:289-330`).
- **API versioning**: date-based header/query versioning with two supported versions `2026-01-01` and `2026-06-01`, error envelopes for invalid/unsupported versions, `Vary` headers — `services/api-gateway/src/middleware/apiVersion.ts:4-76`.
- **GraphQL endpoints** for storefront and admin (`/v1/storefront/graphql`, `/v1/admin/graphql` + aliases) gated by `FEATURE_GRAPHQL` (`services/api-gateway/src/index.ts:350-399`), implemented as a REST-shim that regex-parses fields/arguments and delegates to REST handlers with query-cost limiting (`services/api-gateway/src/graphql/storefront.ts:90-120` field/arg regex readers; `graphql/cost.ts`, `graphql/rest-shim.ts`, `graphql/bulk.ts`).
- **Query-cost rate limiting** with `X-RateLimit-*` headers (`services/api-gateway/src/middleware/rateLimit.ts`, facts at `reference.ts:147-154`).
- **Outbound app webhooks**: HMAC `v1=<hex>` signatures over `timestamp.rawBody`, headers `X-LetBuyy-Event-ID/Event-Type/Request-ID/Trace-ID/Timestamp/Hmac-SHA256` + legacy signature header, HTTPS-only targets, response previews recorded — `services/webhook-service/src/app-lifecycle-dispatch.ts:3-120`; verification helper exported (`verifyLetBuyyWebhookHmac`, `:57-64`).
- **Domain event catalog**: 23 typed events with producer/consumer contracts (`DOMAIN_EVENT_TYPES`, `packages/event-core/src/index.ts:74-127`); operations endpoints for webhook deliveries/subscriptions/outbox dispatch (`reference.ts:131-144`; `services/api-gateway/src/routes/operations.ts`).
- **Scopes model**: app-level `api_scopes` with requested-scope validation at authorize/install (`app-store.ts:1619-1628`, `1971-1980`; `normalizeAppInstallScopes`, `app-engine/src/index.ts:1326-1342`); JWT app tokens carry normalized scopes with `insufficient_scope` rejection (`packages/auth-core/src/index.ts:937-947`, `1043-1045`); bridge path→scope mapping for `products|orders|customers|themes|storefront` (`app-store.ts:290-306`).
- **App Bridge**: embedded session issuance (`POST /installations/:id/embed-session`, `app-store.ts:1135`), server-mediated `POST /bridge/fetch` (GET-only, path-allowlisted, store-scoped, scope-checked — `app-store.ts:1235`, normalization at `:276-314`), client host with capabilities `api.fetch|toast|resize|navigation.redirect` (`EmbeddedAppBridgeClient.tsx:41-110`; capability constants in `app-engine/src/index.ts:575,1230-1236`).
- **Partner dashboard backend**: `GET /app-store/partners/dashboard` (developer profile, apps, review records, billing charges, payout ledger — `app-store.ts:2369-2457`); collaborator codes (`POST /partners/collaborator-code`, `:2544`); developer registration/apps (`:2249-2304,2576`).
- **TypeScript SDK**: `LetbuyyApiClient` (`packages/typescript/api-client/src/index.ts:842`, factory `:1503`) covering themes/app-store/storefront surfaces (consumed by merchant BFF routes, e.g. `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts:29`).

### (c) Missing capabilities (gaps)
- **No CLI or scaffolding**: self-declared — "No tracked `@letbuyy/cli`, theme CLI, app CLI, or `create-letbuyy` package exists in the active workspace" (`developer-portal/src/lib/reference.ts:268-276`, status "SKIP - NEEDS SDK/CLI"); confirmed by absence in `pnpm-workspace.yaml:1-31` and `scripts/`.
- **No partner API key management**: "No partner API key inventory, create, revoke, or rotate endpoint is present in the gateway" (`reference.ts:310-318`, "SKIP - NEEDS BACKEND").
- **No partner earnings/analytics endpoints**: itemized earnings, payout exports, API-call analytics, install funnels — "not yet separate developer endpoints" (`reference.ts:319-329`).
- **GraphQL is a regex REST shim, not a spec executor**: field detection via `\bfieldName\b` regex and string-argument extraction (`graphql/storefront.ts:90-97`) — no schema introspection, fragments, aliases, or nested selection resolution; admin GraphQL same pattern (`graphql/admin.ts`).
- **Webhook topic breadth**: 23 domain events (`event-core/src/index.ts:74-98`) vs Shopify's ~200 topics; no per-topic subscription API for app developers (operations-only subscription management; "Developer self-serve retry APIs are not exposed yet", `reference.ts:223-229`).
- **Bridge writes**: `bridge/fetch` rejects non-GET (`app-store.ts:280`) — apps cannot mutate store data through the bridge; only OAuth-token REST access (and there is no scoped write enforcement map documented beyond the 5 read scopes at `:290-306`).
- **No API deprecation/sunset tooling** beyond the two-version allowlist (`apiVersion.ts:5`): no deprecation headers/changelog automation found.
- **No app dev-store/test-store provisioning** for partners: not found in repository.

### (d) Score: **5/10** — Versioned APIs, signed webhooks, scoped OAuth/JWT, app bridge, SDK, docs portal, and a partner dashboard exist; the platform lacks a CLI/scaffold, API keys, partner analytics, real GraphQL, broad webhook topics, and bridge write paths.

---

## 9. Storefront Runtime (storefront API, cart, checkout handoff, customer accounts, search/filtering, internationalization, CDN/edge)

### (a) Shopify reference
Storefront GraphQL API (products, collections, server-side cart objects with cart tokens, customer accounts), checkout (Shopify-hosted checkout handoff with Shopify Payments + wallets, discount/shipping/tax engines), customer accounts (classic + new passwordless), storefront search/predictive search with faceted filtering, Markets-grade i18n (multi-language URLs, multi-currency presentment), and a global CDN with section rendering API.

### (b) What LetBuyy has today
- **Extensive public storefront REST API** under `/v1/storefront`: store lookup/directory (`storefront.ts:1830,1891`), store payload (`:2197`), products list/by-ids/detail (`:3226,3254,3284`), categories/navigation/pages/policies/blog/contact (`:3380-3536,4732-4814`), coupon validation (`:3324`), order creation (`:2245`), provider payment ops for Razorpay/Stripe/PayPal/Cashfree (POST blocks `:2416-3105`), checkout extensions (`:2020`), theme preview (`:2055`).
- **Storefront GraphQL endpoint** (REST-shim, §8) at `/v1/storefront/graphql` (`services/api-gateway/src/index.ts:380-381`).
- **Cart**: client-side only — localStorage `lb_cart` in both the React cart context (`apps/storefront-runtime/src/context/cart-context.tsx:28,43`) and the Liquid hydration island (`liquid-hydration-islands.tsx:5,35-48`) with custom events (`letbuyy:cart:*`).
- **Checkout**: native single-page checkout on the storefront domain (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`) supporting `online (Razorpay) | stripe | paypal | cod` (`:102-103`), order POST → provider order → verification; app function evaluation runs server-side during order creation (`storefront.ts:2285-2294`); checkout UI extensions render per target (§5). Payment provider inbound webhooks with signature verification + idempotent event store in `services/webhook-service/src/index.ts:25-108`.
- **Customer accounts**: per-store email+password auth (`customer-auth-context.tsx:28-29,108-118`), plus order-credential login, password reset request/confirm, profiles, addresses CRUD, wishlist + sync, order history, activity events — `storefront.ts:3577-4703` (e.g. `customer/login :3925`, `customer/addresses :4576-4703`, `customer/wishlist :4218-4377`); session middleware `services/api-gateway/src/middleware/customer-session.ts`; Turnstile bot protection (`apps/storefront-runtime/src/components/security/turnstile-widget.tsx`, gateway `middleware/security.ts`).
- **Search**: Postgres FTS over a `search_documents` projection (`textSearch('search_vector', term, { type: 'websearch' })`, `storefront.ts:748-765`) with ILIKE fallback (`:851-852,1217`) behind `STOREFRONT_SEARCH_PROJECTION` flag (`:692-694`); search contract package supports provider abstraction (`packages/search-core/src/index.ts:4` lists postgres/typesense/meilisearch/algolia) — only postgres is implemented; trigram indexes exist (`database/supabase/migrations/084_trigram_search_indexes.sql`).
- **Internationalization**: per-store locale (default `en-IN`) localizes theme strings via `t:` keys (`store-service.ts:516,582`; `theme-bundle.ts:602-656`); theme fixtures ship 7 Indic locales (`theme-bundle.ts:1122-1158`); currency is INR-centric (`event-core` `InrMinorUnitsSchema` `currency: z.literal('INR')`, `index.ts:69-72`; app charges forced INR `app-store.ts:1376`; theme purchases INR-only `theme-engine/src/index.ts:912`).
- **CDN/edge**: API gateway is a Cloudflare Worker (Hono) with an edge cache layer — Cache API + KV versioning, 60s TTL/300s SWR, `Cache-Tag` headers, `X-Storefront-Cache` HIT/MISS/BYPASS (`services/api-gateway/src/lib/storefront-cache.ts:12-80`); Next.js storefront uses ISR (`revalidate = 60`, `shop/page.tsx:11`) and render-plan cache tags (`template-resolver.ts:210-216,238-244`); subdomain + custom-host routing via proxy with `x-store-subdomain` header support (`apps/storefront-runtime/src/proxy.ts:11-52`); custom-domain lookup in `storefront.ts` (`GET /lookup` resolves custom_domain — `:1830`, references across `storefront.ts` and `store-service.ts`).
- **SEO**: metadata builder (`apps/storefront-runtime/src/lib/seo.ts`), product `seo_title/seo_description` columns in the public select (`storefront.ts:660`).

### (c) Missing capabilities (gaps)
- **No server-side cart object/API**: no `/cart` routes, no cart tokens, no server-validated line pricing pre-order (grep `/cart|cart_token` in `routes/storefront.ts` → no matches); carts cannot be shared across devices, recovered (abandoned-cart), or mutated by apps/functions before checkout.
- **No checkout handoff/hosted checkout**: checkout is a theme-coupled client page; no one-page hosted checkout service, no wallets (Apple/Google Pay), no Shop-Pay-style accelerated checkout: not found in repository.
- **No shipping-rate or tax engines at checkout**: shipping is a binary `standard|express` enum in function contracts (`app-engine/src/index.ts:290`) and `shipping-tax` admin routes exist (`services/api-gateway/src/routes/shipping-tax.ts`) but no rate calculation invoked in the storefront order flow read (`storefront.ts:2245-2300` area handles items/customer/coupon/functions only).
- **Faceted storefront filtering**: public product query supports only `category` + `search` + pagination (`PublicProductQueryOptions`, `storefront.ts:668-675`); no price-range/vendor/tag/option facets, no sort parameter, no predictive search endpoint: not found in repository.
- **Multi-currency / multi-language URLs / market-based pricing**: not found in repository (INR literals above; no locale-prefixed routing in `apps/storefront-runtime/src/app`).
- **New-customer-accounts (passwordless OTP/magic-link) for shoppers**: storefront login is password-based (`customer-auth-context.tsx:28`); merchant auth has OTP (`/v1/auth/signin/otp`, `reference.ts:56-58`) but shopper accounts do not: not found in repository for storefront customers.
- **Section Rendering API** (fetch a single rendered section over HTTP for dynamic updates): not found in repository.
- **Gift cards at storefront checkout**: admin gift-card routes exist (`reference.ts:72`) and function input carries `gift_card_code` (`app-engine/src/index.ts:302`), but no storefront gift-card redemption endpoint was found in `storefront.ts` route list.
- **B2B, subscriptions/selling plans, local pickup/delivery, multi-location storefront inventory display**: not found in repository (inventory locations exist admin-side only, `reference.ts:77`).

### (d) Score: **5/10** — A broad storefront API, native multi-provider checkout with extension/function hooks, full customer-account CRUD, FTS search, edge caching, and theme i18n exist; but there is no server cart, no shipping/tax engines, no facets/predictive search, and the platform is single-currency/single-locale-market by construction.

---

## Scoring Matrix

| # | Subsystem | Score (0–10) | One-line justification |
|---|-----------|:---:|---|
| 1 | Theme Runtime | **4** | Real Liquid engine + Shopify-shaped bundles/JSON templates/section groups, but no commerce Liquid objects/filters, no metafields, no snippets/assets, zero production Liquid adoption. |
| 2 | Theme Editor | **5** | Draft/publish/rollback + schema settings work; preview is synthetic mock (iframe path is dead code), home-template-only, no drag-drop/presets/app-block UI. |
| 3 | Theme Marketplace | **6** | Submission → automated checks → human review decisions → purchase with license keys → install all run; no update distribution, license enforcement, or partner analytics. |
| 4 | App Marketplace | **6** | Listings, reviews, consent screen, OAuth code/token, uninstall, partner dashboard, full India app-billing/payout model; billing decoupled from install, no hosted grant page, no app versioning. |
| 5 | App Extensions framework | **6** | Typed manifest, lifecycle registry, sandboxed admin/checkout iframes, deterministic WASM functions executing in checkout; no app embeds, app-shipped theme Liquid, or non-checkout hooks. |
| 6 | App Blocks in themes | **4** | `@app` contract + slot injection + sanitized render are live; merchants have no editor surface and apps cannot ship custom block markup/settings. |
| 7 | App Embeds | **0** | Not found in repository — injection points hardwired empty, scripts structurally blocked, no toggle. |
| 8 | Developer Platform | **5** | Versioned API, signed webhooks, scopes/JWT, app bridge, SDK, docs portal, partner dashboard; no CLI/scaffold/API keys/analytics, GraphQL is a regex shim, 23 webhook topics. |
| 9 | Storefront Runtime | **5** | Broad storefront API, native multi-provider checkout with function/extension hooks, customer accounts, FTS, edge cache; no server cart, shipping/tax engines, facets, or multi-currency/market i18n. |

**Overall parity score: 41/90 ≈ 4.6/10.** LetBuyy has built the contracts and persistence spine of an OS 2.0-class platform (bundles, templates, releases, extension registry, OAuth, billing, review pipelines) but the merchant- and developer-facing experience layers (editor fidelity, app embeds, app-block authoring, CLI, server cart, market i18n) are absent or unwired.

---

## Evidence Index

| Area | Key files |
|---|---|
| Theme engine contracts | `packages/theme-engine/src/index.ts`; `packages/theme-engine/src/theme-registry.ts`; `packages/theme-engine/src/theme-bundle.ts`; `packages/theme-engine/src/theme-renderer.ts`; `packages/theme-engine/src/execution-runtime.ts`; `packages/theme-engine/AGENTS.md` |
| Storefront theme runtime | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`; `.../composition-engine.tsx`; `.../renderer-registry.tsx`; `.../data-binding-engine.ts`; `.../types.ts`; `.../liquid-hydration-islands.tsx`; `.../editor-preview-section-frame.tsx`; `apps/storefront-runtime/src/lib/store-service.ts`; `apps/storefront-runtime/src/proxy.ts`; `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`; `apps/storefront-runtime/src/app/store/[subdomain]/shop/page.tsx` |
| Theme editor | `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`; `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts` (+ `draft/route.ts`); `apps/merchant-control-plane/src/components/theme-editor/{CenterPanel,LeftSidebar,RightSidebar,EditorHeader,IconRail,SectionItem,AddSectionModal,ThemeSettingsPanel,SchemaFormRenderer}.tsx`; `apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart` |
| Theme marketplace & review | `services/api-gateway/src/routes/themes.ts`; `services/api-gateway/src/execution/schema-registry-execution.adapter.ts`; `services/api-gateway/src/lib/marketplace-review-records.ts`; `services/api-gateway/src/routes/operations.ts`; `apps/theme-marketplace/src/**`; `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` |
| App marketplace, OAuth, billing | `services/api-gateway/src/routes/app-store.ts`; `packages/app-engine/src/index.ts`; `packages/billing-core/src/index.ts`; `packages/auth-core/src/index.ts`; `apps/app-marketplace/src/components/AppInstallConsentPanel.tsx`; `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsContent.tsx` |
| Extensions & functions | `packages/extension-host/src/index.ts`; `packages/app-engine/src/index.ts` (manifest/registry/lifecycle); `services/api-gateway/src/extensions/app-functions-runtime.ts`; `apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx`; `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` |
| Developer platform | `apps/developer-portal/src/lib/reference.ts`; `services/api-gateway/src/middleware/apiVersion.ts`; `services/api-gateway/src/middleware/rateLimit.ts`; `services/api-gateway/src/graphql/{storefront,admin,cost,rest-shim,bulk}.ts`; `services/webhook-service/src/{index,app-lifecycle-dispatch}.ts`; `packages/event-core/src/index.ts`; `packages/typescript/api-client/src/index.ts`; `pnpm-workspace.yaml` |
| Storefront runtime APIs | `services/api-gateway/src/routes/storefront.ts`; `services/api-gateway/src/lib/storefront-cache.ts`; `services/api-gateway/src/index.ts`; `packages/search-core/src/index.ts`; `apps/storefront-runtime/src/context/{cart-context,customer-auth-context}.tsx`; `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`; `database/supabase/migrations/084_trigram_search_indexes.sql` |
| Liquid adoption evidence | `tests/theme-engine/first-party-liquid-portability.test.mjs` (only consumer of Liquid fixtures) |
