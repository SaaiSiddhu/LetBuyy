# Phase 12 — Shopify Compatibility Investigation

Investigation date: 2026-06-05 (second pass, post-remediation)

## Method

This report compares LetBuyy's current implemented state against the Shopify Online Store 2.0 platform model, subsystem by subsystem. Every claim about LetBuyy is grounded in repository evidence (file path, line where helpful) gathered by direct source reading and pattern search of `/Users/saai_sidd/Git/Letbuyy_Store` (excluding `node_modules`, `.git`, build/test artifacts). Shopify reference descriptions are concise platform-model summaries used only as the comparison baseline. Where a capability could not be located, the report states "not found in repository". This document records current state and gaps only — no solutions, designs, or roadmaps.

This is a **second-pass re-verification** after the post-audit remediation window (~68 commits, `63053d18..HEAD`, plus the immediately preceding remediation batch including `d7821ff6` template-scoped editor drafts which the first pass had not yet credited). Each subsystem was re-checked against current code; first-pass claims that no longer hold were corrected, and a score delta is recorded.

Primary evidence roots inspected: `packages/theme-engine`, `packages/app-engine`, `packages/extension-host`, `packages/billing-core`, `packages/event-core`, `packages/search-core`, `packages/auth-core`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/theme-marketplace`, `apps/app-marketplace`, `apps/developer-portal`, `apps/platform-operations-portal`, `services/api-gateway`, `services/webhook-service`, `database/supabase/migrations`.

---

## Changes since first pass

Commit window verified: `63053d18..HEAD` (68 commits; merges of `stream/letbuyy-remediation`, `stream/WS1-designsystem`, `stream/WS7-hardening`, `stream/WS9-settings`, `stream/WS5-operations`, `stream/WS10-devportal`), plus immediately-preceding remediation commits (`d7821ff6`, `3f3ef761` neighborhood) whose effects the first pass had not captured.

**Materially changed (affects scoring):**
- **Multi-template theme editing is now real.** Migration `database/supabase/migrations/087_theme_template_drafts.sql` adds `template_key` to `theme_editor_drafts` with a `(store_id, theme_id, template_key)` unique constraint; the editor has a topbar template switcher over six templates (`DEFAULT_TEMPLATE_OPTIONS`: index/product/collection/page/cart/blog — `editor/page.tsx:139-146`, switcher at `:1298-1310`); draft save/publish/discard are template-scoped end-to-end (BFF `editor/draft/route.ts:25,36,50`; gateway `themes.ts:361,400`; adapter `theme-execution.adapter.ts:1112-1208,1210-1234`; events `theme.draft.saved`/`theme.draft.discarded` emitted with template_key in the idempotency key, `theme-execution.adapter.ts:1169`). Test: `tests/theme-engine/theme-template-editor.test.mjs`. This invalidates the first-pass "single-template editing only" finding (§2).
- **App install/uninstall hardening (H9/M5).** `X-Idempotency-Key` dedupe with replay and fail-release semantics on install and uninstall (`app-store.ts:1978-2000,2197-2210`, release-on-failure `finally` block); webhook signing secrets are generated server-side, never accepted from the client body, returned show-once in the install response (`app-store.ts:327,1691,2061,2153-2154`; marketplace BFF deliberately strips them, `apps/app-marketplace/src/app/api/apps/[id]/install/route.ts:26`). Tests: `tests/federation/app-install-idempotency.test.mjs`, `app-install-store-ownership.test.mjs`.
- **Verified-install app reviews.** `POST /app-store/apps/:id/reviews` now returns 403 unless the caller has an *active* installation of the app ("no drive-by ratings") — `app-store.ts:820-834`. Test: `tests/federation/app-review-verified-install.test.mjs`.
- **Honest marketplace error states (H5/M2).** Both marketplaces replaced silent empty-catalog fallbacks with explicit retryable outage states (`apps/app-marketplace/src/components/MarketplaceUnavailable.tsx:5-9`; `apps/theme-marketplace/src/components/marketplace-unavailable.tsx:5-9`) wired into home/browse/category/collection/search pages; search page gained error+retry; structured loggers replaced console output. Test: `tests/federation/marketplace-service-error-handling.test.mjs`.
- **Theme event contracts registered honestly.** Event catalog grew 23 → 26 typed domain events: `theme.purchase.payment_order_created`, `theme.draft.saved`, `theme.draft.discarded` added with producer/consumer contracts (`packages/event-core/src/index.ts:74-102, 398-429`).
- **Developer portal WS10 scaffold.** `apps/developer-portal` expanded to 9 routable pages (`/`, `/docs`, `/api`, `/api-reference`, `/oauth`, `/sdk`, `/sdks`, `/webhooks`, `/dashboard`) backed by a ~2,150-line source-honest contract ledger (`src/lib/developer-surface.ts`) covering route groups, OAuth/token lifetimes, webhook topics/rules, scope matrices, payment safety, and app quality gates — but the dashboard is a static shell ("this D0 app has no authenticated API adapter yet", `developer-surface.ts:2033`) and SDK/CLI/OpenAPI/API-key/webhook-test tooling remain self-marked `[SKIP — NEEDS BACKEND/SDK]` (`developer-surface.ts:1978-2037,2126-2128`; `CODEX_WS10_LEDGER.md` D0/D2). Documentation depth improved; no new platform capability.
- **WS5 operations review queue.** `apps/platform-operations-portal/.../operations/page.tsx` now uses server-action decisions with automated-check summaries and extension-lifecycle review items (`:14-59`), an incremental review-tooling improvement.

**Architecture hardening (quality, not parity surface):**
- Storefront internal payment mutations split into `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (internal-secret-gated reference/confirm/failure/event routes, `:71-76`); webhook-service now routes payment/billing/event mutations through gateway internal APIs as single writer (`services/webhook-service/src/gateway-events.ts:19-50`, `gateway-order-transitions.ts`, `gateway-billing-transitions.ts`; tests under `services/webhook-service/test/`).
- WS9 unified settings hub (`apps/merchant-control-plane/src/components/settings/*`) with payload normalization; the new `settings/custom-data/page.tsx` is an explicit `BackendNeededPane` confirming "No `metafields`, `metaobjects`, or custom-data gateway route was found" (`:14-19`).
- WS1 design-system hardening (`packages/typescript/ui`), queue/cost/perf fixes — no parity impact.

**Verified still absent (F2/F3 not built; each re-checked against current code):**
- App embeds: `content_for_header`/`content_for_footer` still hardwired `''` (`theme-renderer.ts:190-191,247-248`); only `AdminAppEmbedSurface` exists (`shared-types/src/index.ts:1463`).
- Liquid commerce objects/filters: scope still only `shop/request/settings/routes/section/block` (`theme-renderer.ts:332-362`); `strictFilters: true` with no `registerFilter` anywhere in `packages/theme-engine`.
- Server-side cart: no `/cart` routes or cart tokens in `routes/storefront.ts`; storefront GraphQL now **fails loud** — `CART_NOT_SUPPORTED` "until server-side cart persistence is enabled" and all mutations rejected `GRAPHQL_MUTATION_NOT_READY` (`graphql/storefront.ts:382-392`) even though `graphql/schema.ts:816-829` declares aspirational Cart types/mutations.
- OAuth grant page + client authentication: `/oauth/token` validates code/client_id/redirect_uri but never a `client_secret` (no match in `app-store.ts`; self-documented at `developer-surface.ts:1283`); no hosted authorize page under `apps/` (developer-portal `/oauth` is docs only).
- App write API: bridge/fetch still rejects non-GET (`app-store.ts:278-281`).
- Compliance emitters: `customers/data_request`/`customers/redact`/`shop/redact` still have zero emit sites (contract strings + HMAC verification tests only; `CODEX_FOUNDATION_REMEDIATION_MISSION.md:145` item C‑4 lists emitters as still-to-do).
- CLI/SDK packages: no `@letbuyy/cli`/`create-letbuyy`/app-sdk in `pnpm-workspace.yaml:1-31`; self-declared SKIP (`developer-surface.ts:2014-2037`).
- Metafields/metaobjects, `enabled_on` enforcement, drag-drop, real-storefront editor preview, app-block editor UI, theme update distribution, multi-currency, faceted/predictive search, shipping/tax engines in checkout: all re-verified absent (evidence in subsystem sections below).

---

## 1. Theme Runtime (Liquid engine, JSON templates, sections everywhere, section groups, dynamic sources/metafields)

### (a) Shopify reference
Shopify OS 2.0 themes are Liquid-file packages (`layout/theme.liquid`, `sections/*.liquid` with `{% schema %}`, `templates/*.json`, `config/settings_schema.json`, `config/settings_data.json`, `locales/*.json`). JSON templates reference sections per route; sections are addable on every template ("sections everywhere"); header/footer live in section groups; section/block settings can bind to dynamic sources backed by metafields/metaobjects; Liquid exposes ~50 objects (`product`, `collection`, `cart`, `customer`, `shop`, `request`, `routes`, ...) and ~100 filters (`money`, `image_url`, `asset_url`, `t`, ...), plus `{% render %}`/snippets.

### (b) What LetBuyy has today
- **Dual renderer engine contract** — `json-contract` and `liquid` engines behind a common `ThemeRenderer` interface: `packages/theme-engine/src/theme-renderer.ts:26` (`ThemeRendererEngine`), `:82` (`JsonContractThemeRenderer`), `:104` (`LiquidRenderer`), `createThemeRenderer` factory.
- **A real Liquid engine** using `liquidjs` with sandbox limits (`cache:false, dynamicPartials:false, strictFilters:true, parseLimit:300_000, renderLimit:250, memoryLimit:2_000_000`): `theme-renderer.ts:230-251` (`createLiquidEngine`).
- **Shopify-shaped bundle layout**: `layout/theme.liquid`, `config/settings_schema.json`, `config/settings_data.json`, `templates/*.json`, `sections/*.liquid`, `blocks/*.liquid`, `locales/*.json` — `packages/theme-engine/src/theme-bundle.ts:8-28` (`THEME_BUNDLE_PATHS`, `LIQUID_THEME_BUNDLE_PATHS`).
- **`{% schema %}` enforcement in Liquid section files** with strict Zod schemas for section settings, inline blocks, `@app` blocks, presets, and `enabled_on`/`disabled_on` template lists (`theme-bundle.ts:125-163,171-197`).
- **JSON templates with section/block instances and ordering** validated cross-referentially (order ↔ section ids, block_order ↔ block ids): `theme-bundle.ts:233-276` (`ThemeBundleTemplateSchema`).
- **Section groups** at the contract level: `StorefrontSectionGroupConfig` with `role: 'header'|'footer'|'aside'|'custom'` — `packages/theme-engine/src/index.ts:106-110`; resolved at render time in `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:39-63` (`resolveSectionGroups`) and rendered via `StorefrontSectionGroupRenderer` (`composition-engine.tsx:226-251`).
- **Per-route template resolution** with route types `index|product|collection|page|policy|blog|article|cart|search|customer_account|customer_orders|customer_wishlist|password|not_found`: `apps/storefront-runtime/src/lib/theme-engine/types.ts:5-19`; template selection chain in `template-resolver.ts:186-256`.
- **Locale dictionaries with `t:` translation-key resolution** applied to template configs: `theme-bundle.ts:536-656` (`resolveThemeTranslation`, `localizeThemeTemplateConfig`); store locale flows from DB (`apps/storefront-runtime/src/lib/store-service.ts`).
- **Liquid render pipeline in storefront**: `composition-engine.tsx:152-203` (`renderLiquidPlan` at `:152`, gate `plan.rendererEngine !== 'liquid'` at `:161`, `createThemeRenderer('liquid')` at `:163`), injects app-block HTML, outputs sanitized HTML, with four client hydration islands (`add-to-cart`, `cart-drawer`, `search`, `variant-picker`) — `theme-bundle.ts:30-51` and `liquid-hydration-islands.tsx`.
- **Liquid scope objects** are limited to `shop`, `request`, `settings`, `routes` (hardcoded 3 routes: root/cart/search), `section`, `block`: `theme-renderer.ts:332-362` (`buildLiquidScope`) — **re-verified unchanged in second pass**.
- **First-party JSON-contract React section registry** (the default production path) with 18 registered renderer keys: `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:198-316`; 12 canonical section schemas in `packages/theme-engine/src/theme-registry.ts:419-432`.
- **Dynamic data binding** exists only for products: `data-binding-engine.ts:37-44` (`settings.dataBinding.resource === 'products'` hook only) — re-verified unchanged.

### (c) Missing capabilities (gaps)
- **Shopify-compatible Liquid object model**: no `product`, `collection`, `cart`, `customer`, `linklists`, `pages`, `blogs`, `all_products`, `paginate` objects in the Liquid scope — only `shop/request/settings/routes/section/block` (`theme-renderer.ts:332-362`). A Liquid theme still cannot query live catalog data. *(Re-verified 2026-06-05: unchanged.)*
- **Shopify Liquid filters**: no custom filters registered (`registerFilter` not found in `packages/theme-engine`); with `strictFilters: true` (`theme-renderer.ts:234`), Shopify filters such as `money`, `image_url`, `asset_url`, `t`, `default_pagination` would throw. *(Re-verified: unchanged.)*
- **`{% render %}` / snippets are explicitly forbidden**: `'{% include'`, `'{% layout'`, `'{% render'` remain banned fragments (`theme-bundle.ts:106-108`), so no snippet composition.
- **Theme JavaScript/assets**: `<script` remains a forbidden fragment in Liquid sources and rendered HTML strips scripts and `on*` handlers (`theme-renderer.ts` sanitizer); `assets/` files have a manifest slot but no asset upload/serving pipeline was found in repository.
- **Metafields/metaobjects**: not found in repository — re-verified repo-wide (`metafield|metaobject` matches zero files under `apps/`, `packages/`, `services/`, `database/`); the new merchant settings page `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:14-19` is an explicit `BackendNeededPane` self-documenting "No `metafields`, `metaobjects`, or custom-data gateway route was found in current services/packages."
- **Dynamic sources** in the Shopify sense (binding any setting to resource metafields): not found in repository; only the product-array binding noted above.
- **`enabled_on`/`disabled_on` enforcement**: fields parsed in bundle schemas (`theme-bundle.ts:157-162`) but no consumer in `apps/` or `services/` (re-verified: zero matches).
- **Liquid theme adoption**: the Liquid path is still exercised only by fixtures and tests (`createMinimalLiquidThemeBundleFixture`, `createUrbanKicksLiquidThemeBundleFixture` consumed by `tests/theme-engine/first-party-liquid-portability.test.mjs` and `tests/theme-engine/liquid-bundle-contract.test.mjs`). No seed or installed store sets `renderer_key`/engine to liquid (no `'liquid'` matches under `database/`); the default storefront path remains the React JSON-contract registry.
- **Layout `content_for_header`/`content_for_footer` remain hardwired to empty strings** (`theme-renderer.ts:190-191`, `:247-248`) — no injection surface (see §7). *(Re-verified: unchanged.)*
- **Pagination, `{% form %}`, `{% paginate %}`, search/predictive-search Liquid tags**: not found in repository.

### (d) Score: **4/10** *(first pass 4 → second pass 4, no change)* — The Liquid engine, bundle format, JSON templates, and section groups are intact, but every first-pass gap re-verified as still open: no commerce object model, no Shopify filters, no snippets/assets, no metafields (now self-documented as missing in the merchant UI), zero production Liquid adoption.

---

## 2. Theme Editor (drag-drop sections, live preview, settings_schema, presets, draft/publish)

### (a) Shopify reference
Shopify's theme editor renders the real storefront in an iframe, supports drag-and-drop reordering of sections and blocks, per-template editing (home, product, collection, ...), section presets in the add-section picker, `settings_schema`-driven setting panels, app block/app embed management, draft (unsaved changes) vs publish, and version history.

### (b) What LetBuyy has today
- **Active editor page**: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — a full-screen editor with sections panel, settings panel, versions panel, device toggles desktop/tablet/mobile (`PREVIEW_DEVICES`, `:171-175`), undo/redo history (50-deep, `applyChange` `:804-814`, `canUndo/canRedo` `:764-765`), add-section flow (`createSectionFromSchema`, `:524-536`; inline picker `:1524-1529`), block add/remove with confirm dialogs (`:1440-1454`), section visibility toggles (`toggleSectionVisibility`, `:1109-1114`), and schema-driven settings forms via `SchemaFormRenderer`.
- **NEW — Multi-template editing** *(corrects first-pass finding)*: the editor carries `selectedTemplateKey` state (`:744`) with a topbar template switcher (`:1298-1310`) over `DEFAULT_TEMPLATE_OPTIONS` — Home, Product, Collection, Content page, Cart, Blog (`:139-146`); the template list is server-supplied (`templates: listThemeTemplateOptions(...)` from gateway `loadEditor`, `theme-execution.adapter.ts:1084`; surfaced through BFF `editor/route.ts:44`); switching is blocked while dirty ("Template drafts are saved separately…", `handleTemplateChange` `:1046-1058`); save/publish build a per-template config merged into the full templates map (`buildDraftConfig(..., templateKey)`, `:620-649`, used at `:967,1011`).
- **NEW — Template-scoped draft persistence**: `database/supabase/migrations/087_theme_template_drafts.sql` adds `template_key` (regex check, NOT NULL, default `'index'`, legacy backfill) and a `(store_id, theme_id, template_key)` unique constraint (`:17-29`); BFF routes accept `?template=` and body `templateKey` (`api/themes/[themeId]/editor/draft/route.ts:25,36,50,79`); gateway routes pass `template_key` (`services/api-gateway/src/routes/themes.ts:361,377,400,416`); adapter upserts on `store_id,theme_id,template_key` with missing-column fallback (`theme-execution.adapter.ts:990-1011`), draft load/delete are template-scoped (`:922-960,1210-1234`); schemas in `packages/theme-engine/src/index.ts:879-897`. Test: `tests/theme-engine/theme-template-editor.test.mjs`.
- **Draft → publish lifecycle**: draft save `POST /api/themes/[themeId]/editor/draft`; publish via `PUT /api/themes/[themeId]/editor`; gateway endpoints `PUT /:slug/editor/draft` (`themes.ts:381`), `DELETE /:slug/editor/draft` (`:395`), `POST /:slug/publish` (`:420`), `POST /:slug/preview-session` (`:436`), releases + rollback routes (`:44-47` auth mounts). Release records carry `release_version`, `is_current`, `rollback_of_release_id` (`packages/theme-engine/src/index.ts:130-144`). Draft saves emit `theme.draft.saved` domain + audit events with template_key (`theme-execution.adapter.ts:1163-1200`).
- **Optimistic concurrency**: `SaveThemeDraftSchema.base_version` conflict check ("Theme draft has changed in another session", `theme-execution.adapter.ts:1136-1138`).
- **Preview tokens / preview sessions**: `PreviewTokenSchema` (TTL 60–3600s); the storefront gateway preview route resolves `theme_preview_sessions` → `theme_instance_drafts`/`theme_editor_drafts` and serves draft configs (`services/api-gateway/src/routes/storefront.ts:2069-2161`); storefront accepts `theme_preview_token` per-subdomain cookie (`apps/storefront-runtime/src/proxy.ts`).
- **Storefront-side editor wiring exists**: `editorMode` section frames with `data-letbuyy-editor-section-id` (`editor-preview-section-frame.tsx`) and a postMessage bridge (`storefront-preview-bridge.tsx:5-90`).
- **Orphaned iframe-editor components** *(re-verified still dead code)*: `CenterPanel.tsx` (sandboxed storefront iframe + preview token + selection postMessage), `LeftSidebar.tsx`, `RightSidebar.tsx`, `EditorHeader.tsx`, `IconRail.tsx`, `SectionItem.tsx`, `AddSectionModal.tsx`, `ThemeSettingsPanel.tsx` all remain in `apps/merchant-control-plane/src/components/theme-editor/` and are **still not imported by any page** (grep matches only the component files themselves).
- **Flutter merchant app** retains a parallel section editor with native reordering (`apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart`).

### (c) Missing capabilities (gaps)
- **No drag-and-drop in the active web editor**: section reordering remains up/down buttons (`moveSection(sectionId, direction: -1 | 1)`, `page.tsx:1133`); no DnD library or `onDrag*`/`draggable`/`sortable` handlers in the editor page (re-verified).
- **No live storefront preview in the active editor**: the preview panel still renders the synthetic `PreviewCanvas` of schema-driven mock sections (`page.tsx:1400-1408`, component `:1842-1906` — local `RenderHeader/RenderSection/RenderFooter` React mocks driven by theme-setting CSS variables), not a storefront iframe. The full iframe path (CenterPanel + storefront-preview-bridge + preview-session draft serving at the gateway) is built but **still unwired**.
- **Section presets remain defined but not surfaced**: the add-section flow still uses `schema.defaults` (`createSectionFromSchema`, `:524-536`); the only `preset` references in the page are settings_data presets passthrough (`:636-638`).
- **No app block / app embed management in the editor**: re-verified — zero matches for `@app|app-block|appBlock|app_block` in `apps/merchant-control-plane/src`.
- **No section-group editing beyond fixed header/footer slots**: editor state still hardcodes `header|footer|template` (`EditorState`, `:69-76`); custom groups/aside roles are not editable.
- **No inspector-from-preview beyond click-select** (no inline text editing, no hover-add between sections).
- **No theme code editor** (edit Liquid/JSON files in admin): not found in repository.
- **No image picker/media library integration field type** beyond URL/image text fields (`FIELD_TYPES` `:177-189`; `image` is a string field).

### (d) Score: **6/10** *(first pass 5 → second pass 6, +1)* — Multi-template editing (six templates, template-scoped drafts with DB constraint, per-template save/publish/discard, conflict detection, draft events) closes the largest first-pass editor gap; preview is still a synthetic mock (iframe path remains dead code), and drag-drop, presets surfacing, and app-block/embed management are still absent.

---

## 3. Theme Marketplace (submission, review, licensing, updates)

### (a) Shopify reference
Shopify Theme Store: partners submit theme packages; Shopify runs automated + manual review; approved themes are listed with pricing; merchants buy a single-store license; theme vendors ship version updates which merchants can pull into their store while keeping customizations.

### (b) What LetBuyy has today
- **Marketplace storefront app** `apps/theme-marketplace` with browse (`src/app/themes/page.tsx`), detail (`src/app/themes/[slug]/page.tsx`), checkout (`src/app/checkout/page.tsx`), install (`src/app/install/page.tsx`), partner upload panel (`src/components/theme-upload-panel.tsx`), and dashboards for purchases/installations/downloads (`src/app/dashboard/*`).
- **NEW — Honest outage states**: browse/home surfaces now render an explicit retryable `MarketplaceUnavailable` error instead of a silent empty catalog (`src/components/marketplace-unavailable.tsx:5-9`, consumed by `app/page.tsx`, `app/themes/page.tsx`, `lib/theme-service.ts`); API base URL fails fast (M2); structured logger (`src/lib/logger.ts`).
- **Submission API**: `POST /v1/themes/packages/upload` validates portable JSON-contract or Liquid bundles (`UploadThemePackageSchema`) and persists `theme_packages`, `theme_package_versions`, `theme_schema_manifests`, `theme_renderer_manifests` (`services/api-gateway/src/execution/schema-registry-execution.adapter.ts:322-410`); supports `submission_mode: 'marketplace' | 'private_install'` (`services/api-gateway/src/routes/themes.ts:515` area).
- **Review pipeline**: marketplace submissions create `marketplace_review_records` rows with automated checks; operations decide via `GET /operations/marketplace-reviews` and `POST /operations/marketplace-reviews/:id/decision` (`services/api-gateway/src/routes/operations.ts:300,320`), mapping decisions to package/version statuses and emitting `theme.approved`/`theme.rejected` events. The WS5 human review UI now uses server-action decisions with automated-check summaries and extension-lifecycle items (`apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx:14-59,68-80`).
- **Licensing/purchase backend**: paid purchase via server-priced Razorpay order (`POST /:slug/purchase`, `themes.ts:606`) with already-purchased and free-theme short-circuits (`:633-674`), signature verification generating a `license_key` (`LB-THEME-...`, `themes.ts:829`), and `theme.purchase.payment_order_created` (`:758`) + `theme.purchase.completed` (`:847-848`) domain events — both now formally registered in the event catalog (`packages/event-core/src/index.ts:95-96,398-413`). License model (`license_type: 'single'|'multi'|'unlimited'`) in `packages/theme-engine/src/index.ts` (`ThemePurchase`).
- **Purchase gating at install** *(refines first-pass licensing claim)*: `installTheme` blocks premium installs without a completed `theme_purchases` row — "This premium theme must be purchased before installation" (`services/api-gateway/src/execution/theme-execution.adapter.ts:818-832`); the marketplace surfaces a `purchase_required` install error (`apps/theme-marketplace/src/components/theme-action-feedback.tsx:7-10`).
- **Catalog/install**: `GET /themes`, categories/industries/detail, `POST /:slug/install` (`themes.ts:589-602`), purchases/installations lists (`:286-310`). Theme reviews (ratings) modeled in `theme-engine/src/index.ts` (`ThemeReview`).
- **Versioning storage**: `theme_package_versions` upsert keyed by `(theme_package_id, version)` with `release_status` and `compatibility_range` (`schema-registry-execution.adapter.ts:353-374`).

### (c) Missing capabilities (gaps)
- **NEW FINDING — The marketplace checkout UI never calls the purchase API.** The checkout page's "Pay" control is a plain `<Link href="/checkout/success?theme=...">` that fires an informational toast and navigates to the success page (`apps/theme-marketplace/src/app/checkout/page.tsx:206-217`); no call to `POST /:slug/purchase`, no Razorpay/Stripe SDK invocation, and the collected email/name/coupon/payment-method state is discarded. The real purchase/verify backend (`themes.ts:606,829`) is reachable only via the API client (`ThemeService.getUserPurchases`, `theme-service.ts:108`), not from this checkout flow. The displayed "Stripe" option has no backing theme-purchase provider (gateway purchase is Razorpay-only).
- **No theme-update distribution to installed stores**: re-verified — no `update_available`/`version_installed`/`theme.update` matches in `services/api-gateway/src`; `ThemeInstallation.version_installed` remains type-only.
- **No license-key/license-type enforcement**: a completed-purchase row is checked at install (above), but the generated `license_key` is never validated and `license_type` (`single|multi|unlimited`) never constrains per-store installation counts (only generation site at `themes.ts:829`).
- **No partner theme dashboard API**: still self-documented as missing — "a partner-owned theme dashboard endpoint distinct from marketplace operations is not present" (`apps/developer-portal/src/lib/reference.ts`, status "Partial").
- **No demo-store preview provisioning** for marketplace themes (preview URLs remain static fields on `Theme`).
- **No multi-currency pricing** — purchase order currency remains locked to INR (`z.enum(['INR'])`, `packages/theme-engine/src/index.ts:915`).
- **Manual review tooling depth**: WS5 surfaces automated-check counts and lifecycle items, but there is still no reviewer checklist execution against rendered themes, screenshot diffing, or accessibility/perf gating.

### (d) Score: **6/10** *(first pass 6 → second pass 6, no change)* — Submission → automated checks → human review (now with server-action tooling) → server-priced purchase with events → purchase-gated install all run, and outage honesty improved; but the merchant-facing checkout UI is non-functional theater (Pay = navigation link), and update distribution, license enforcement, and partner analytics remain absent.

---

## 4. App Marketplace (listing, review, install, OAuth grant screen, billing on install)

### (a) Shopify reference
Shopify App Store: public listings with categories/reviews; partner submission + Shopify review; merchant install flow showing an OAuth grant screen listing requested scopes; managed app billing (recurring/usage charges) with merchant approval at install/upgrade; uninstall lifecycle with webhooks.

### (b) What LetBuyy has today
- **Marketplace app** `apps/app-marketplace` with categories, app detail, search API, and a consent/install panel rendering requested scopes as permission labels before install (`src/components/AppInstallConsentPanel.tsx`, `formatScopeLabel`; install POST at `:81-85`).
- **NEW — Honest catalog/search error states (H5)**: explicit retryable `MarketplaceUnavailable` outage component replacing silent empty catalogs (`src/components/MarketplaceUnavailable.tsx:5-9`, wired into home/categories/collections/search pages); search page error+retry; fail-fast on missing API base URL (M2); structured logger. Test: `tests/federation/marketplace-service-error-handling.test.mjs`.
- **Gateway listing/review APIs**: `GET /app-store/categories`, `GET /app-store/apps`, `GET /app-store/apps/:id`, `GET|POST /app-store/apps/:id/reviews` (`services/api-gateway/src/routes/app-store.ts:775,798`).
- **NEW — Verified-install reviews**: review submission now requires an *active* installation, optionally store-scoped, returning 403 otherwise (`app-store.ts:820-834`). Test: `tests/federation/app-review-verified-install.test.mjs`.
- **Install / uninstall lifecycle**: `POST /app-store/apps/:id/install` (`app-store.ts:1953`) and `DELETE /app-store/apps/:id/install` (`:2173`) with scope validation against the app's `api_scopes` (`normalizeAppInstallScopes`, `packages/app-engine/src/index.ts:1326-1342`).
- **NEW — Install/uninstall idempotency (H9)**: `X-Idempotency-Key` claims with replay of stored responses and release-on-failure so failed installs are immediately retryable (`app-store.ts:1978-2000` install begin/replay, completion + `finally` fail-release; `:2197-2210` uninstall). Tests: `tests/federation/app-install-idempotency.test.mjs`, `app-install-store-ownership.test.mjs` (server-side store_id derivation + ownership).
- **NEW — Server-generated show-once webhook signing secrets (M5)**: signing secrets are `crypto.randomUUID()` server-side, never accepted from the client body (`app-store.ts:327,1691,2061`), returned once in the install response (`signing_secret`, `:2153-2154`); the marketplace BFF explicitly does not forward client-supplied secrets (`apps/app-marketplace/src/app/api/apps/[id]/install/route.ts:26`) and forwards Idempotency-Key headers (`:18,27,43,45`).
- **OAuth authorization-code flow**: `POST /apps/:id/oauth/authorize` (store ownership + scopes + registered redirect URI checks; short-lived codes — `app-store.ts:1602-1603`), `POST /oauth/token` (code → scoped JWT app access token, validating code/client_id/redirect_uri — `:1787-1810`), `POST /oauth/token-exchange` (embedded session → installation-scoped token — `:1875-1876`); redirect-URI allowlisting and HTTPS enforcement in app-engine (`normalizeAppOAuthRedirectUri`).
- **App billing**: `POST /installations/:id/charges` creates recurring/usage charges with idempotency keys, 80/20 revenue share, 18% partner GST, India payout rails, and a merchant `approval_url`; `POST /charges/:id/approve` activates (`app-store.ts` charge block; primitives in `packages/billing-core/src/index.ts:69-98`, INR-locked at `:13,86`; `DEFAULT_APP_REVENUE_SHARE_BPS = 8000`). Charge events `app.charge.created`/`app.charge.activated` in `packages/event-core/src/index.ts:89-90`.
- **Mandatory compliance webhook topics** auto-attached to app webhook plans: `customers/data_request`, `customers/redact`, `shop/redact` (`packages/app-engine/src/index.ts:150-156`).
- **Marketplace review records** shared with themes; partner submissions at `POST /app-store/developers/apps`.
- **Merchant-side app management**: installed apps settings (WS9-normalized `AppsSettingsClient.tsx` + `AppsSettingsContent.tsx` with uninstall confirmation, hardened scope rendering and launch links).
- **Partner dashboard aggregate**: `GET /app-store/partners/dashboard` (developer profile, apps, review records, billing charges, payout ledger — `app-store.ts:2444-2445`), gated by `requireRoleCategory('partner')`.

### (c) Missing capabilities (gaps)
- **OAuth grant screen is still not the install path used by the marketplace UI**: `AppInstallConsentPanel` posts directly to `/api/apps/:id/install` (`AppInstallConsentPanel.tsx:81-85`) rather than driving the `/oauth/authorize` redirect flow; no hosted grant-screen page exists under `apps/` (the developer-portal `/oauth` page is documentation — `apps/developer-portal/src/app/oauth/page.tsx`). *(Re-verified: unchanged.)*
- **No OAuth client authentication**: `/oauth/token` never validates a `client_secret` (zero matches in `app-store.ts`); self-documented — "the token response interface has no refresh_token or public credential rotation contract" (`developer-surface.ts:1283`).
- **Billing is still not wired into install**: `POST /apps/:id/install` contains no charge creation; charges remain a separate post-install API. No "approve subscription to finish installing" flow found in repository.
- **No app listing-quality review depth** (screenshots requirements, demo screencast, security questionnaire) beyond the recorded automated checks and the Built-for-LetBuyy quality-gate evidence fields documented in `developer-surface.ts` (gate behavior: non-draft submissions with failed evidence are rejected naming failed check keys, `:326`).
- **No app version/release channel model**: no version rows analogous to `theme_package_versions` for `marketplace_apps`; manifest carries `app.version` but no per-version review/rollout.
- **No usage-based billing metering pipeline** (partner usage-records ingestion endpoint): only the merchant-pre-approved usage charge shape exists (`billing-core/src/index.ts:39-45`).
- **No app refunds/credits/proration model**: not found in repository.

### (d) Score: **7/10** *(first pass 6 → second pass 7, +1)* — The existing listing/consent/OAuth/billing/partner-dashboard surface gained meaningful production integrity: idempotent install/uninstall with failure release, server-side show-once webhook secrets, verified-install reviews, server-derived store ownership, and honest outage states (all test-locked); the structural gaps — unhosted grant page, no client_secret, billing decoupled from install, no app versioning/metering — remain.

---

## 5. App Extensions framework (extension targets, app blocks, app embeds, theme app extensions, admin UI extensions, function/checkout extensions)

### (a) Shopify reference
Shopify ships typed extension surfaces: theme app extensions (app blocks + app embeds packaged with the app), checkout UI extensions with fixed extension targets, admin UI extensions (blocks/actions), Shopify Functions (deterministic WASM for discounts/shipping/payment/validation), POS/customer-account extensions, all declared in app TOML config and reviewed.

### (b) What LetBuyy has today
*(Re-verified 2026-06-05: surfaces, targets, hooks, and runtime wiring unchanged since first pass.)*
- **Versioned app manifest** `2026-06-05.ws13` declaring scopes, extensions, and functions: `packages/app-engine/src/index.ts:190-287` (`LetbuyyAppManifestSchema`); normalization with legacy aliases; example manifest with all three surfaces + a WASM function.
- **Three extension surfaces**: `admin.ui`, `checkout.ui`, `theme.app_block` (`LETBUYY_APP_MANIFEST_EXTENSION_SURFACES`, `:192-196`) with fixed target sets:
  - admin: `admin.dashboard.widget`, `admin.settings.page`, `admin.product.action`, `admin.order.action` (`:198-203`);
  - checkout: five `checkout.*.render-after` targets;
  - theme: `storefront.home.after-hero`, `storefront.product.after-form`, `storefront.collection.after-grid`, `storefront.footer.before` (`:213-218`).
- **Extension host package** with sandbox policies: `packages/extension-host/src/index.ts` — admin targets, iframe sandbox/allow constants, checkout targets, registration normalization with HTTPS-only source URLs, bridge-context builders.
- **Renderers**: `iframe`, `web_component`, `liquid_app_block` (`AppManifestExtensionRendererSchema`, `:231`).
- **Functions (WASM)**: deterministic-only manifests with HTTPS module URL, SHA-256 digest, 1–5ms timeout, 64–1024KB memory; typed I/O contracts with operations `apply_discount_code`, `select_shipping_method`, `allow_payment_methods`, `validation_error`; hooks `cart.discount.calculate`, `checkout.shipping.rate`, `checkout.payment.customize`, `checkout.validation.run` (`LETBUYY_APP_FUNCTION_HOOKS`, `:220-225`). The execution runtime compiles/verifies/caches WASM with timeouts (`services/api-gateway/src/extensions/app-functions-runtime.ts`) and is invoked during storefront order creation behind `FEATURE_EXTENSIONS` (`services/api-gateway/src/routes/storefront.ts:2287`).
- **Per-store extension/function registry with lifecycle**: registry rows with `status: enabled|disabled|revoked`; lifecycle routes for installation extensions/functions and `GET /v1/storefront/:subdomain/checkout/extensions` (`storefront.ts:2021-2022`); observability signals and a published review checklist (`createAppExtensionReviewChecklist`); WS5 operations now surfaces extension-lifecycle review items in the review queue (`operations/page.tsx:47-59`).
- **Checkout extension host in the storefront**: sandboxed iframes per target with postMessage context + resize protocol (`CheckoutExtensionHost.tsx`), used in checkout-client.
- **Admin UI extension host**: `EmbeddedAppBridgeClient.tsx` renders enabled admin extensions in policy-sandboxed iframes with App Bridge context.
- **Feature gating**: `FEATURE_EXTENSIONS` gate on extension routes (`services/api-gateway/src/index.ts:107,432`).

### (c) Missing capabilities (gaps)
- **App embeds surface does not exist** (see §7) — `theme.app_block` remains the only theme surface; no body/head injection extension type. *(Re-verified.)*
- **Theme app extensions are still not packaged Liquid shipped by the app**: `theme.app_block` with renderer `liquid_app_block` accepts a `source.entrypoint` Liquid path, but no pipeline stores/compiles/renders that file — storefront app-block HTML is synthesized from the fixed inline/iframe content schema (`AppBlockInstanceSchema`; `renderLiquidAppBlockHtml` in `composition-engine.tsx:95-122`). Apps cannot ship arbitrary block markup.
- **No POS, customer-account, flow/automation, or marketing-activity extension surfaces**: not found in repository.
- **Function hooks remain limited to 4 checkout/cart hooks** (`:220-225`); no order-routing, fulfillment, cart-transform, or delivery-customization hooks.
- **Discount function output is still a coupon-code selection, not computed discounts** (`apply_discount_code` only sets an existing coupon).
- **Admin extension targets are page/widget-level only** (4 targets); no block-level extension points inside product/order detail forms.
- **No extension dev-preview/hot-reload tooling**: not found in repository (consistent with no CLI, §8).

### (d) Score: **6/10** *(first pass 6 → second pass 6, no change)* — The typed, lifecycle-managed, sandboxed extension framework with the deterministic-WASM checkout function runtime is unchanged; review-queue visibility of lifecycle evidence improved marginally, but no new surfaces, hooks, or app-shipped Liquid landed.

---

## 6. App Blocks in themes (schema, render surface in sections)

### (a) Shopify reference
App blocks: apps ship blocks (Liquid + schema) that merchants add inside any OS 2.0 section that accepts `@app` blocks, configured/reordered in the theme editor like native blocks, rendered inline by the theme.

### (b) What LetBuyy has today
*(Re-verified 2026-06-05: contract and render path unchanged.)*
- **`@app` block type in the Liquid bundle contract**: `ThemeLiquidAppBlockSchema` (`packages/theme-engine/src/theme-bundle.ts:132-136`); `isLiquidAppBlockType` matches `@app` and `app:` prefixes; bundle validation enforces "app_blocks_require_section_app_block_support"; JSON-contract sections expose `accepts_app_blocks`.
- **Editor-schema synthesis for app blocks**: `@app` block schema with `extension_handle` + `slot` fields auto-added to runtime block schemas (`buildLiquidRuntimeBlockSchemas`).
- **Liquid render path**: app blocks inside Liquid sections resolve configured HTML by `sectionId.blockId | blockId | type | extension_handle | slot` keys, else a placeholder div (`theme-renderer.ts:286-294` block loop with `isAppBlock: true`, `resolveLiquidAppBlockHtml`); sanitized before output.
- **JSON-contract render surface**: dedicated `appBlockSlot` section type with `app-block` block schema (slot, render_mode inline|iframe, iframe_url, cta fields) — `packages/theme-engine/src/theme-registry.ts:302-353`; rendered by `apps/storefront-runtime/src/components/sections/app-block-slot.tsx`.
- **Runtime injection from installations**: store payloads carry `app_blocks`; `injectAppBlocksIntoSections` maps installed `theme.app_block` registry rows into matching `appBlockSlot` sections by slot (`store-service.ts:185-247`); validated by `AppBlockInstanceSchema`.
- **Liquid app-block HTML synthesis** with iframe sandbox option for `render_mode: 'iframe'` (`composition-engine.tsx:95-122`).

### (c) Missing capabilities (gaps)
- **Merchants still cannot add/configure app blocks in the theme editor**: re-verified — zero app-block references in `apps/merchant-control-plane/src` (grep `@app|app-block|appBlock|app_block` → no matches), including the rebuilt multi-template editor. App blocks appear only via runtime injection into pre-placed `appBlockSlot` sections or pre-authored `@app` entries inside theme bundle templates.
- **Only sections of type `appBlockSlot` (JSON-contract) or sections declaring `@app` (Liquid) accept app blocks** — no "any section accepts @app by default" behavior; in the first-party schema registry only `appBlockSlot` carries an app block schema.
- **App block content remains a fixed card schema** (title/heading/body/cta or iframe) rather than app-provided markup/settings schema; app-defined block settings panels for merchants: not found in repository.
- **4 theme slots only**; product/collection targets are declared in the manifest but no first-party section schema exposes `storefront.product.after-form` or `storefront.collection.after-grid` slots in `theme-registry.ts`.

### (d) Score: **4/10** *(first pass 4 → second pass 4, no change)* — The contract and runtime injection are unchanged and live; the editor rebuild did not add any app-block placement/configuration surface, and apps still cannot ship their own block markup or settings.

---

## 7. App Embeds (body/head injection with toggle in editor)

### (a) Shopify reference
App embeds: invisible/floating app components injected into the theme `<head>` or before `</body>` (via theme app extensions), toggled on/off per theme in the theme editor's "App embeds" panel, no theme code edits required.

### (b) What LetBuyy has today
- **Not found in repository.** *(Re-verified 2026-06-05.)* Searches for `app_embed`/`appEmbed`/`app embed` across `apps/`, `packages/`, `services/` match only the **admin** embedded-app surface (`AdminAppEmbedSurfaceSchema`, `packages/shared-types/src/index.ts:1463-1475`; `normalizeAppAdminEmbedSurface`, `packages/app-engine/src/index.ts:1251`; `EmbeddedAppBridgeClient.tsx`) — an admin-dashboard iframe, not a storefront injection — plus audit/mission documents.
- The Liquid layout's injection points remain inert: `content_for_header` and `content_for_footer` are globally set to empty strings in the engine (`packages/theme-engine/src/theme-renderer.ts:247-248`) and rendered with empty values (`:190-191`). `<script>` tags remain forbidden in theme sources and stripped from rendered HTML.
- No editor toggle exists (zero app-embed references in `apps/merchant-control-plane/src`, including the rebuilt editor).

### (c) Missing capabilities (gaps)
- App-embed extension surface (manifest type, registry rows, render targets): not found in repository.
- Head/body injection pipeline (populating `content_for_header`/`content_for_footer`, or a Next.js layout injection equivalent): not found in repository.
- Editor on/off toggle per embed: not found in repository.
- Sanctioned script-loading path for apps on the storefront (script tags API or pixel manager): not found in repository.

### (d) Score: **0/10** *(first pass 0 → second pass 0, no change)* — The capability still does not exist; injection points remain hardwired empty and scripts structurally blocked.

---

## 8. Developer Platform (CLI, app scaffold, partner dashboard, API versioning, webhooks registry, scopes model, app bridge)

### (a) Shopify reference
Shopify CLI (`shopify app/theme dev|deploy`, scaffolding templates), Partner Dashboard (apps, themes, API keys, earnings, analytics), date-versioned Admin/Storefront APIs with deprecation windows, a large webhook topic registry (~200 topics) with HMAC verification and retries, a granular access-scope catalog, and App Bridge (embedded session tokens, UI actions).

### (b) What LetBuyy has today
- **NEW — Expanded developer portal (WS10)** `apps/developer-portal`: nine routable pages (`/`, `/docs`, `/api`, `/api-reference`, `/oauth`, `/sdk`, `/sdks`, `/webhooks`, `/dashboard` plus error/loading/not-found shells) backed by two source-honest ledgers — the original `src/lib/reference.ts` and a new ~2,150-line `src/lib/developer-surface.ts` documenting gateway route groups, schema facades, response contracts, payment safety, app quality-gate evidence rules, webhook topics/delivery rules, OAuth scope and token-lifecycle matrices, and bridge fetch limits, each entry citing its backend source file. The `/dashboard` route is an explicitly **static** shell whose live tiles map to existing partner routes while credentials/webhook-test/SDK tiles remain `[SKIP — NEEDS BACKEND/SDK]` (`developer-surface.ts:2014-2037`; `CODEX_WS10_LEDGER.md` D0/D2 — "this D0 app has no authenticated API adapter yet"). Documentation depth materially improved; platform capability did not.
- **API versioning**: date-based header/query versioning with two supported versions `2026-01-01` and `2026-06-01` (`services/api-gateway/src/middleware/apiVersion.ts:4-5`), error envelopes, `Vary` headers — unchanged.
- **GraphQL endpoints** for storefront and admin (`/v1/storefront/graphql`, `/v1/admin/graphql` + aliases) gated by `FEATURE_GRAPHQL` (`services/api-gateway/src/index.ts:448-474`), still implemented as a REST shim that regex-parses fields/arguments (`graphql/storefront.ts:90-97` — `\bfieldName\b` regex, string-argument extraction) and delegates to REST with query-cost limiting; a full SDL exists (`graphql/schema.ts`, including Cart types and `cartCreate/cartLinesAdd/...` mutations at `:1825-1829`) but the executor **fails loud** on unsupported shapes: all mutations rejected `GRAPHQL_MUTATION_NOT_READY` and cart reads rejected `CART_NOT_SUPPORTED` (`graphql/storefront.ts:382-392`) — honest-failure improvement over silent partiality, not new capability.
- **Query-cost rate limiting** with `X-RateLimit-*` headers (`middleware/rateLimit.ts`) — unchanged.
- **Outbound app webhooks**: HMAC `v1=<hex>` signatures over `timestamp.rawBody`, `X-LetBuyy-Hmac-SHA256` + companion headers, HTTPS-only targets (`services/webhook-service/src/app-lifecycle-dispatch.ts:3,57`); the webhook-service was refactored to route all order/billing/event mutations through gateway internal APIs as single writer (`gateway-events.ts:19-50`, `gateway-order-transitions.ts`, `gateway-billing-transitions.ts` — reliability hardening).
- **Domain event catalog**: now **26** typed events with producer/consumer contracts (`DOMAIN_EVENT_TYPES`, `packages/event-core/src/index.ts:74-102`; +`theme.purchase.payment_order_created`, `theme.draft.saved`, `theme.draft.discarded` vs first pass's 23).
- **Scopes model**: app-level `api_scopes` with requested-scope validation at authorize/install; JWT app tokens carry normalized scopes with `insufficient_scope` rejection (`packages/auth-core/src/index.ts`); bridge path→scope mapping for `products|orders|customers|themes|storefront` — unchanged; now also documented in a scope matrix (`developer-surface.ts:1424-1431`).
- **App Bridge**: embedded session issuance, server-mediated `POST /bridge/fetch` (GET-only, path-allowlisted, store-scoped, scope-checked — `app-store.ts:1244-1245`, method gate `:278-281`), client host with capabilities `api.fetch|toast|resize|navigation.redirect` — unchanged.
- **Partner dashboard backend**: `GET /app-store/partners/dashboard` (developer profile, apps, review records, billing charges, payout ledger — `app-store.ts:2444-2445`); collaborator codes; developer registration/apps — unchanged.
- **TypeScript SDK**: internal `LetbuyyApiClient` (`packages/typescript/api-client/src/index.ts`) covering themes/app-store/storefront surfaces, extended with template-scoped editor methods (`themes.editor/saveDraft/deleteDraft` with `template_key` query support).

### (c) Missing capabilities (gaps)
- **No CLI or scaffolding**: re-verified — no `@letbuyy/cli`/`create-letbuyy` workspace package (`pnpm-workspace.yaml:1-31`); self-declared SKIP twice over ("no CLI generator or packager is present", `developer-surface.ts:1990,2021`; `reference.ts`).
- **No partner API key management**: re-confirmed — "No public credential rotation or API key console exists in this branch" (`developer-surface.ts:2002,2126-2128`).
- **No partner earnings/analytics endpoints** beyond the dashboard aggregate: itemized earnings, payout exports, API-call analytics, install funnels — not present (`reference.ts`, dashboard tiles map only to existing routes).
- **GraphQL is still a regex REST shim, not a spec executor**: no schema introspection, fragments, aliases, or nested selection resolution (`graphql/storefront.ts:90-97`); the checked-in SDL (`graphql/schema.ts`) is a contract document, with cart/mutation portions explicitly unbacked.
- **Webhook topic breadth**: 26 domain events vs Shopify's ~200 topics; still no per-topic subscription API for app developers, no public test sender ("no public developer test-delivery endpoint or UI exists", `developer-surface.ts:1996,2029`).
- **Bridge writes**: `bridge/fetch` still rejects non-GET (`app-store.ts:281`); "Write-capable bridge calls remain [SKIP — NEEDS BACKEND/SDK]" (`developer-surface.ts:1916`).
- **No OAuth refresh tokens / client_secret / credential rotation** (`developer-surface.ts:1283`; §4).
- **No API deprecation/sunset tooling** beyond the two-version allowlist; **no generated OpenAPI document** ("no generated OpenAPI document is checked in for this branch", `developer-surface.ts:1978,2025`).
- **No app dev-store/test-store provisioning** for partners: not found in repository.

### (d) Score: **5/10** *(first pass 5 → second pass 5, no change)* — Versioned APIs, signed webhooks, scoped OAuth/JWT, app bridge, internal SDK, partner dashboard, and a substantially deeper honest docs portal exist; but every hard capability gap re-verified open — no CLI/scaffold, no API keys/credential rotation, no partner analytics, GraphQL still a regex shim (now failing loud), 26 webhook topics, GET-only bridge.

---

## 9. Storefront Runtime (storefront API, cart, checkout handoff, customer accounts, search/filtering, internationalization, CDN/edge)

### (a) Shopify reference
Storefront GraphQL API (products, collections, server-side cart objects with cart tokens, customer accounts), checkout (Shopify-hosted checkout handoff with Shopify Payments + wallets, discount/shipping/tax engines), customer accounts (classic + new passwordless), storefront search/predictive search with faceted filtering, Markets-grade i18n (multi-language URLs, multi-currency presentment), and a global CDN with section rendering API.

### (b) What LetBuyy has today
- **Extensive public storefront REST API** under `/v1/storefront`: store lookup/directory/payload, products list/by-ids/detail, categories/navigation/pages/policies/blog/contact, coupon validation, order creation (`router.post('/:subdomain/orders')`, `services/api-gateway/src/routes/storefront.ts:2247`), provider payment ops for Razorpay/Stripe/PayPal/Cashfree, checkout extensions (`:2021-2022`), theme preview-session draft serving (`:2069-2161`).
- **NEW — Internal payment mutation isolation**: payment reference/confirm/failure/event mutations extracted into internal-secret-gated routes (`services/api-gateway/src/routes/storefront/internal-payment-routes.ts:21-76`), consumed by the webhook-service as single writer (`services/webhook-service/src/gateway-order-transitions.ts`) — checkout payment plumbing reliability, not new merchant-facing capability. Contract test: `tests/contracts/storefront-internal-payment-routes.test.ts`.
- **Storefront GraphQL endpoint** (REST-shim, §8) at `/v1/storefront/graphql`, now failing loud on cart/mutations (`graphql/storefront.ts:382-392`).
- **Cart**: still client-side only — localStorage `lb_cart` in both the React cart context (`apps/storefront-runtime/src/context/cart-context.tsx:28,43`) and the Liquid hydration island (`liquid-hydration-islands.tsx:5`) with custom events.
- **Checkout**: native single-page checkout on the storefront domain (`checkout-client.tsx`) supporting `online (Razorpay) | stripe | paypal | cod`; app function evaluation runs server-side during order creation behind `FEATURE_EXTENSIONS` (`storefront.ts:2287`); checkout UI extensions render per target (§5). Payment provider inbound webhooks with signature verification + idempotent event store in `services/webhook-service`.
- **Customer accounts**: per-store email+password auth, order-credential login, tokenized password reset, profiles, addresses CRUD, wishlist + sync, order history, activity events — customer routes gated by `requireCustomerSession` + CSRF middleware (`storefront.ts:105-117`); session middleware `middleware/customer-session.ts`; Turnstile bot protection; customer abuse-path throttling (`d1446dc1` auth hardening batch).
- **Search**: Postgres FTS over a `search_documents` projection (`textSearch('search_vector', term, { config: 'simple', type: 'websearch' })`, `storefront.ts:891`) with ILIKE fallback; projection reads now default **on** (`STOREFRONT_SEARCH_PROJECTION` defaults to enabled unless 'off', `storefront.ts:701-702`); `packages/search-core` provider abstraction lists postgres/typesense/meilisearch/algolia — only postgres implemented; trigram indexes (`database/supabase/migrations/084_trigram_search_indexes.sql`).
- **Internationalization**: per-store locale (default `en-IN`) localizes theme strings via `t:` keys; theme fixtures ship 7 Indic locales; currency remains INR-centric (`z.literal('INR')` in `event-core/src/index.ts:71,206` and `shared-types/src/index.ts:1586,1645,1685`; app charges and theme purchases INR-locked).
- **CDN/edge**: API gateway is a Cloudflare Worker (Hono) with an edge cache layer — Cache API + KV versioning, TTL/SWR, `Cache-Tag` headers, `X-Storefront-Cache` HIT/MISS/BYPASS (`lib/storefront-cache.ts`); public storefront reads cached (`f8c1cd75`); Next.js storefront ISR + render-plan cache tags; subdomain + custom-host routing via proxy; storefront reads routed through Hyperdrive (`b7978d81`).
- **SEO**: metadata builder (`apps/storefront-runtime/src/lib/seo.ts`), product `seo_title/seo_description` columns.

### (c) Missing capabilities (gaps)
- **No server-side cart object/API**: re-verified — no `/cart` routes or `cart_token` in `routes/storefront.ts` (zero matches); the GraphQL SDL declares `Cart`/`cartCreate`/`cartLinesAdd` (`graphql/schema.ts:816-829,1825-1829`) but the executor rejects them with `CART_NOT_SUPPORTED` / `GRAPHQL_MUTATION_NOT_READY` (`graphql/storefront.ts:382-392`) — the contract now exists on paper with an honest failure, but carts still cannot be shared across devices, recovered, or mutated by apps/functions before checkout.
- **No checkout handoff/hosted checkout**: checkout remains a theme-coupled client page; no hosted checkout service, no wallets (Apple/Google Pay), no accelerated checkout: not found in repository.
- **No shipping-rate or tax engines at checkout**: re-verified — zero `shipping_rate|calculateShipping|tax_amount|calculateTax` matches in `routes/storefront.ts`; shipping remains a binary `standard|express` enum in function contracts; admin `shipping-tax` routes exist but are not invoked in the storefront order flow.
- **Faceted storefront filtering**: public product query still supports only `limit/page/ids/category/search/paginated` (`PublicProductQueryOptions`, `storefront.ts:643-650`); no price-range/vendor/tag/option facets, no sort parameter, no predictive-search endpoint: not found in repository.
- **Multi-currency / multi-language URLs / market-based pricing**: not found in repository (INR literals above; no locale-prefixed routing in `apps/storefront-runtime/src/app`).
- **New-customer-accounts (passwordless OTP/magic-link) for shoppers**: storefront login remains password-based; merchant auth has OTP but shopper accounts do not: not found in repository for storefront customers.
- **Section Rendering API** (fetch a single rendered section over HTTP): not found in repository.
- **Gift cards at storefront checkout**: function input carries `gift_card_code` but no storefront gift-card redemption endpoint found in `storefront.ts`.
- **B2B, subscriptions/selling plans, local pickup/delivery, multi-location storefront inventory display**: not found in repository (inventory locations exist admin-side only; `088_inventory_available_batch.sql` is an availability-batch perf migration, not storefront multi-location display).

### (d) Score: **5/10** *(first pass 5 → second pass 5, no change)* — The broad storefront API, native multi-provider checkout with function/extension hooks, customer accounts, FTS, and edge caching gained reliability (internal payment routes, single-writer webhooks, caching/Hyperdrive, abuse throttling) and the cart gap is now honestly fail-loud; but no server cart, shipping/tax engines, facets/predictive search, or multi-currency/market i18n was built.

---

## Scoring Matrix

| # | Subsystem | First pass | Second pass | Δ | One-line justification |
|---|-----------|:---:|:---:|:---:|---|
| 1 | Theme Runtime | 4 | **4** | 0 | Liquid engine/bundles/JSON templates/section groups intact; commerce Liquid objects, filters, snippets, assets, and metafields all re-verified absent (metafields now self-documented as missing in merchant settings); zero production Liquid adoption. |
| 2 | Theme Editor | 5 | **6** | +1 | Multi-template editing landed end-to-end (six templates, migration 087 template-scoped drafts, per-template save/publish/discard, conflict check, draft events); preview is still a synthetic mock, no drag-drop/presets/app-block UI, iframe path still dead code. |
| 3 | Theme Marketplace | 6 | **6** | 0 | Pipeline (submission → review → server-priced purchase → purchase-gated install) plus honest outage states and registered purchase events; offset by the new finding that the checkout UI's Pay button is a navigation link that never calls the purchase API; updates/license-type enforcement/partner analytics still absent. |
| 4 | App Marketplace | 6 | **7** | +1 | Test-locked production integrity added: idempotent install/uninstall with failure release, server-side show-once webhook secrets, verified-install reviews, server-derived store ownership, honest error states; grant page, client_secret, install-time billing, and app versioning still missing. |
| 5 | App Extensions framework | 6 | **6** | 0 | Surfaces (3), theme targets (4), function hooks (4), WASM runtime, and sandboxed hosts unchanged; review-queue lifecycle visibility improved marginally; no app embeds, app-shipped Liquid, or new hooks. |
| 6 | App Blocks in themes | 4 | **4** | 0 | `@app` contract + slot injection + sanitized render still live; the rebuilt editor added zero app-block placement/configuration; apps still cannot ship custom markup/settings. |
| 7 | App Embeds | 0 | **0** | 0 | Still not found in repository — `content_for_header/footer` hardwired empty, scripts structurally blocked, no manifest surface, no toggle. |
| 8 | Developer Platform | 5 | **5** | 0 | WS10 deepened honest documentation (9 pages, 2,150-line contract ledger, static dashboard) and events grew 23→26; but CLI, API keys, partner analytics, real GraphQL execution, refresh tokens, and bridge writes all re-verified absent — the score's blockers are unmoved. |
| 9 | Storefront Runtime | 5 | **5** | 0 | Reliability hardening (internal payment routes, single-writer webhooks, caching, throttling) and fail-loud GraphQL cart; no server cart, shipping/tax engines, facets, predictive search, or multi-currency was built. |

**Overall parity score: 43/90 ≈ 4.8/10** *(first pass 41/90 ≈ 4.6/10; +2 points)*. The remediation window spent its effort exactly where the first pass scored the platform's strengths — contracts, persistence, integrity, and honesty (idempotency, secrets, verified reviews, template drafts, fail-loud errors, single-writer events, source-honest docs). The merchant- and developer-facing experience layers that drove the low first-pass scores — app embeds, app-block authoring, real editor preview, Liquid commerce objects, CLI, server cart, market i18n — received no build-out and remain the dominant parity gaps.

---

## Top 10 gaps (second-pass status)

| # | Gap | Severity | Status | Evidence |
|---|-----|:---:|:---:|---|
| 1 | App embeds surface (head/body injection + editor toggle) does not exist | **Critical** | STILL-OPEN | `theme-renderer.ts:190-191,247-248` (empty injection points); zero storefront `app_embed` implementation (only `AdminAppEmbedSurface`, `shared-types:1463`) |
| 2 | No server-side cart object/API (cross-device, recovery, app/function mutation pre-checkout) | **Critical** | STILL-OPEN (now fail-loud) | zero `/cart|cart_token` in `routes/storefront.ts`; `graphql/storefront.ts:386-392` `CART_NOT_SUPPORTED`; `lb_cart` localStorage (`cart-context.tsx:28,43`) |
| 3 | Liquid runtime has no commerce object model or Shopify filters (Liquid themes cannot render catalog data) | **Critical** | STILL-OPEN | `theme-renderer.ts:332-362` scope = shop/request/settings/routes/section/block; `strictFilters:true` `:234`; no `registerFilter` |
| 4 | Theme editor previews synthetic mocks instead of the real storefront (iframe path dead code) | **High** | STILL-OPEN | `editor/page.tsx:1400-1408,1842-1906` (`PreviewCanvas` mocks); `CenterPanel.tsx` + 8 siblings unimported; gateway draft-serving preview exists unused (`storefront.ts:2069-2161`) |
| 5 | Merchants cannot place/configure app blocks in the editor; apps cannot ship block markup/settings | **High** | STILL-OPEN | zero `@app|app-block` matches in `apps/merchant-control-plane/src`; fixed `AppBlockContentSchema` card (`app-engine:57-74`) |
| 6 | Theme-marketplace checkout UI never calls the purchase API (Pay = `<Link>` to success page) | **High** | STILL-OPEN (newly documented) | `apps/theme-marketplace/src/app/checkout/page.tsx:206-217`; real backend at `themes.ts:606,829` unreached from this UI |
| 7 | No CLI/scaffolding, partner API keys, OpenAPI, or partner analytics for developers | **High** | STILL-OPEN | `pnpm-workspace.yaml:1-31`; self-declared `[SKIP — NEEDS BACKEND/SDK]` (`developer-surface.ts:1978-2037,2126-2128`) |
| 8 | Mandatory compliance webhooks (`customers/data_request|redact`, `shop/redact`) have zero emit sites | **High** | STILL-OPEN | topics defined `app-engine:150-156`; no producer repo-wide; `CODEX_FOUNDATION_REMEDIATION_MISSION.md:145` (C-4) lists emitters as outstanding |
| 9 | Single-template editing in the theme editor | **High (was)** | RESOLVED | migration `087_theme_template_drafts.sql`; switcher `editor/page.tsx:1298-1310`; template-scoped save/publish/discard end-to-end (`theme-execution.adapter.ts:1112-1234`); test `tests/theme-engine/theme-template-editor.test.mjs` |
| 10 | App install/uninstall double-submit + client-supplied webhook secrets + drive-by reviews + fake-empty catalogs | **Medium (was)** | RESOLVED | H9 idempotency (`app-store.ts:1978-2000,2197-2210`), M5 server secrets show-once (`:327,2061,2153-2154`), verified-install reviews (`:820-834`), `MarketplaceUnavailable` error states; federation tests locked |

Other notable still-open items below the top 10: OAuth grant page + client_secret authentication (High; `app-store.ts:1787-1810`, no `client_secret` match), billing decoupled from install (Medium), theme update distribution + license-type enforcement (Medium; purchase-row gate exists, `theme-execution.adapter.ts:818-832`, but `license_key`/`license_type` unused), faceted/predictive search (Medium; `storefront.ts:643-650`), multi-currency/market i18n (Medium; INR literals), `enabled_on` enforcement (Low), metafields/dynamic sources (High for theme parity; now an explicit `BackendNeededPane` at `settings/custom-data/page.tsx:14-19`), bridge write paths (Medium; GET-only at `app-store.ts:281`).

---

## Evidence Index

| Area | Key files |
|---|---|
| Theme engine contracts | `packages/theme-engine/src/index.ts` (incl. `template_key` schemas `:879-897`); `packages/theme-engine/src/theme-registry.ts`; `packages/theme-engine/src/theme-bundle.ts`; `packages/theme-engine/src/theme-renderer.ts` (Liquid scope `:332-362`, empty injection `:190-191,247-248`); `packages/theme-engine/src/execution-runtime.ts`; `packages/theme-engine/AGENTS.md` |
| Storefront theme runtime | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`; `.../composition-engine.tsx`; `.../renderer-registry.tsx`; `.../data-binding-engine.ts`; `.../types.ts`; `.../liquid-hydration-islands.tsx`; `.../editor-preview-section-frame.tsx`; `apps/storefront-runtime/src/lib/store-service.ts`; `apps/storefront-runtime/src/proxy.ts`; `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`; `apps/storefront-runtime/src/app/store/[subdomain]/shop/page.tsx` |
| Theme editor (multi-template) | `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (template options `:139-146`, switcher `:1298-1310`, template-scoped fetches `:846,968,1012`, PreviewCanvas `:1842`); `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts` + `draft/route.ts` (template_key handling); `database/supabase/migrations/087_theme_template_drafts.sql`; `services/api-gateway/src/execution/theme-execution.adapter.ts` (`:922-1011` draft IO, `:1026-1110` loadEditor, `:1112-1234` save/delete); `services/api-gateway/src/routes/themes.ts:361-416`; `tests/theme-engine/theme-template-editor.test.mjs`; orphaned `apps/merchant-control-plane/src/components/theme-editor/{CenterPanel,LeftSidebar,RightSidebar,EditorHeader,IconRail,SectionItem,AddSectionModal,ThemeSettingsPanel,SchemaFormRenderer}.tsx`; `apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart` |
| Theme marketplace & review | `services/api-gateway/src/routes/themes.ts` (purchase `:606-848`, install `:589-602`, license_key `:829`); `services/api-gateway/src/execution/theme-execution.adapter.ts:809-832` (purchase gate at install); `services/api-gateway/src/execution/schema-registry-execution.adapter.ts`; `services/api-gateway/src/lib/marketplace-review-records.ts`; `services/api-gateway/src/routes/operations.ts`; `apps/theme-marketplace/src/**` (fake checkout `app/checkout/page.tsx:206-217`; outage state `components/marketplace-unavailable.tsx`); `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` |
| App marketplace, OAuth, billing | `services/api-gateway/src/routes/app-store.ts` (reviews gate `:820-834`, bridge `:278-281,1244`, oauth `:1602-1810,1875`, install/uninstall + idempotency + secrets `:1953-2210`, partner dashboard `:2444`); `packages/app-engine/src/index.ts`; `packages/billing-core/src/index.ts`; `packages/auth-core/src/index.ts`; `apps/app-marketplace/src/components/{AppInstallConsentPanel,MarketplaceUnavailable}.tsx`; `apps/app-marketplace/src/app/api/apps/[id]/install/route.ts`; `apps/merchant-control-plane/src/app/[store]/settings/apps/{AppsSettingsClient,AppsSettingsContent}.tsx`; `tests/federation/{app-install-idempotency,app-install-store-ownership,app-review-verified-install,marketplace-service-error-handling}.test.mjs` |
| Extensions & functions | `packages/extension-host/src/index.ts`; `packages/app-engine/src/index.ts` (surfaces/targets/hooks `:192-225`); `services/api-gateway/src/extensions/app-functions-runtime.ts`; `services/api-gateway/src/routes/storefront.ts:2021,2287`; `apps/storefront-runtime/src/components/checkout-extensions/CheckoutExtensionHost.tsx`; `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` |
| Developer platform | `apps/developer-portal/src/lib/{reference,developer-surface}.ts`; `apps/developer-portal/src/app/{api-reference,oauth,sdks,webhooks,dashboard}/page.tsx`; `apps/developer-portal/CODEX_WS10_LEDGER.md`; `services/api-gateway/src/middleware/apiVersion.ts:4-5`; `services/api-gateway/src/middleware/rateLimit.ts`; `services/api-gateway/src/graphql/{schema,storefront,admin,cost,rest-shim,bulk}.ts` (fail-loud `storefront.ts:382-392`); `services/webhook-service/src/{index,app-lifecycle-dispatch,gateway-events,gateway-order-transitions,gateway-billing-transitions}.ts`; `packages/event-core/src/index.ts:74-102` (26 events); `packages/typescript/api-client/src/index.ts`; `pnpm-workspace.yaml` |
| Storefront runtime APIs | `services/api-gateway/src/routes/storefront.ts` (customer middleware `:105-117`, search `:701-702,891`, preview drafts `:2069-2161`, orders `:2247`, products query `:643-650`); `services/api-gateway/src/routes/storefront/internal-payment-routes.ts`; `services/api-gateway/src/lib/storefront-cache.ts`; `services/api-gateway/src/index.ts:427-474` (feature gates); `packages/search-core/src/index.ts`; `apps/storefront-runtime/src/context/{cart-context,customer-auth-context}.tsx`; `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`; `database/supabase/migrations/{084_trigram_search_indexes,087_theme_template_drafts,088_inventory_available_batch}.sql`; `tests/contracts/storefront-internal-payment-routes.test.ts` |
| Liquid adoption evidence | `tests/theme-engine/first-party-liquid-portability.test.mjs`, `tests/theme-engine/liquid-bundle-contract.test.mjs` (only consumers of Liquid fixtures); no `'liquid'` renderer references under `database/` |
| Compliance emitter absence | `packages/app-engine/src/index.ts:150-156` (topic definitions); `tests/app-platform/lifecycle.test.mjs:304-357` (HMAC verification only); `CODEX_FOUNDATION_REMEDIATION_MISSION.md:145` (C-4 outstanding) |
| Custom-data/metafields absence | `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:14-19` (explicit BackendNeededPane); zero `metafield|metaobject` matches in `apps/`, `packages/`, `services/`, `database/` |
