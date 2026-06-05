# Phase 4 — Theme System Investigation

Investigation date: 2026-06-05

## Method

Direct source inspection of `packages/theme-engine`, `apps/theme-marketplace`, `apps/merchant-control-plane` (editor routes/components), `services/api-gateway` (theme routes + execution adapters), `apps/storefront-runtime` (consumer side), `apps/mobile/merchant-app` (Flutter theme client), and `database/supabase/migrations/000_baseline.sql` (table definitions). Every claim cites a file path and, where useful, line numbers. Searches excluded `node_modules`, `.next`, `.turbo`, `dist`, `coverage`, `build`. The pre-existing FORENSIC_REPORT files and root `CODEX_*`/`LETBUYY_*` ledgers were treated as unverified claims; confirmations/contradictions of the prior 04/05 reports are listed in the "Prior-claim verification" section.

---

## 1. Architecture overview (verified)

LetBuyy's theme system is a Shopify-OS-2.0-style section/block model with **two renderer engines** declared in one shared package:

1. **JSON-contract engine** — themes are JSON configuration (`StoreTemplateConfig`: themeSettings + sections + sectionGroups + per-route `templates`); rendering of each section is performed by first-party React components compiled into `apps/storefront-runtime`.
2. **Liquid engine** — themes are portable bundles of `.liquid` layout/section/block sources validated by Zod schemas and rendered server-side with `liquidjs` (dependency declared at `packages/theme-engine/package.json:20` — `"liquidjs": "^10.27.0"`).

Both engines are defined in `packages/theme-engine/src/theme-renderer.ts`:
- `JsonContractThemeRenderer` (lines 82–102)
- `LiquidRenderer` (lines 104–211), built on `new Liquid({...})` at lines 230–251 with `dynamicPartials: false`, `strictFilters: true`, `renderLimit: 250`, `memoryLimit: 2_000_000`, plus output sanitization `sanitizeRenderedHtml` (lines 471–476: strips `<script>`, inline `on*=` handlers, `javascript:`/`data:text/html` href/src).

Theme data, drafts, releases, instances, purchases, and preview sessions are persisted as **JSONB rows in Supabase Postgres tables** — there is **no Supabase Storage / object-store usage for themes anywhere in TypeScript source** (a repo-wide grep for `storage.from(` over `**/*.{ts,tsx}` returned no matches). The only file-storage reference is the *schema-level* column `theme_assets.storage_provider DEFAULT 'r2'` (`database/supabase/migrations/000_baseline.sql:12445`) — and no application code reads or writes `theme_assets` at all (see §5).

---

## 2. Module / file map

### 2.1 `packages/theme-engine` (5 source files, 4,868 lines total — measured by `wc -l`)

| File | Lines | Contents |
|---|---|---|
| `src/index.ts` | 1,064 | Core contracts: `ThemeSettings` + `DEFAULT_THEME_SETTINGS` (61–74), `SectionModel`/`BlockModel` (76–97), `StoreTemplateConfig` incl. `liquidBundle`, `appBlocks`, `releaseManifest` (112–128), `ThemeRelease` (130–144), `ThemeEditorPayload` (146–175). Validation: unsafe-key blocking (`__proto__`, `dangerouslysetinnerhtml`, `on*` — 247–260), unsafe-URL blocking (262–270), field-type validation (300–359), section/block/template validation, `collectThemeTemplateValidationIssues` (694–731, with 256 KB serialized-size cap at line 702–707). Fallback resolution: `getThemeDefaultTemplate` (650), `resolveRenderableThemeTemplateConfig` (671). Zod API schemas: `InstallThemeSchema`, `SaveThemeDraftSchema` (clients enum `'admin-web' | 'flutter-builder' | 'api'`, line 890), `PublishThemeSchema`, `PreviewTokenSchema` (TTL 60–3600 s, default 900, line 900–903), `RollbackThemeReleaseSchema`, `ThemePurchaseOrderSchema` (currency enum `['INR']` only, line 912), `ThemePurchaseVerifySchema` (Razorpay fields, 916–920). Marketplace catalog types `Theme`, `ThemePurchase`, `ThemeInstallation`, `ThemeReview` (948–1028). |
| `src/theme-registry.ts` | 733 | Static `SECTION_SCHEMAS` for 12 section types: announcementBar, heroBanner, featuredProducts, productGrid, categoryGrid, brandMarquee, testimonials, trustBadges, newsletter, appBlockSlot, header, footer (419–432). `THEME_SETTINGS_SCHEMA` with groups colors/typography/layout/header/footer (436–489). `getSectionSchemas()`/`getThemeSettingsSchema()` static fallbacks (497–506; comment at 493–496: "runtime schema registry is database-backed; this static export is kept as the shared fallback contract"). `hasRenderableThemeTemplate` (540–568). `getDefaultStorefrontThemeTemplate` — the hardcoded default storefront template (themeId default `'urban-kicks'`, lines 574–733). |
| `src/theme-bundle.ts` | 2,100 | Portable bundle contracts for both engines. Schema versions: JSON contract `'2026-05-json-contract'` (line 3), Liquid `'2026-06-liquid-sections'` (line 5). Bundle path conventions (`layout/theme.liquid`, `config/settings_schema.json`, `sections/*.liquid`, `blocks/*.liquid`, `templates/*.json`, `locales/*.json` — lines 8–28). `LIQUID_HYDRATION_ISLANDS` (add-to-cart, cart-drawer, search, variant-picker custom elements — 30–51). `ThemeLiquidSourceSchema` (96–119) forbids `<script`, `javascript:`, `data:text/html`, `{% include %}`, `{% layout %}`, `{% render %}`; max 200,000 bytes per template (line 56). `ThemeLiquidSectionFileSchema` requires `{% schema %}…{% endschema %}` (185–197). `LiquidThemePackageBundleSchema` (429–502) with cross-ref validation (template→section files, blocks allowed per section, `@app` block support 488–499). `PortableThemePackageBundleSchema` union (504–507), `UploadThemePackageSchema` with `submission_mode: 'marketplace' | 'private_install'` (509–512). Locale resolution/translation (`t:` prefix, 536–656) incl. 7-locale fixture (en/hi/bn/mr/ta/te/kn — 1122–1158). Persistence payload builders `buildThemePackagePersistencePayload` (877) and `buildLiquidThemePackagePersistencePayload` (969) — these shape the rows for `theme_packages`/`theme_package_versions`/`theme_schema_manifests`/`theme_renderer_manifests`. Fixtures: `createMinimalThemeBundleFixture`, `createMinimalLiquidThemeBundleFixture`, `createUrbanKicksLiquidThemeBundleFixture` (1356+). |
| `src/theme-renderer.ts` | 485 | The two renderers + `createThemeRenderer(engine)` factory (216–218). Liquid render flow: resolve template key (253–259) → render blocks (271–330; app blocks resolved via `liquidAppBlocks` map or placeholder `<div data-letbuyy-app-block=…>` at 370–391) → render section sources with scope (`shop`, `request`, `settings`, `routes` — `buildLiquidScope` 332–362) → join into `content_for_layout` → render layout (185–194) → sanitize. `composeLiquidStorefrontTheme` (393–469) converts Liquid templates back into `SectionModel[]` with `rendererKey: liquid.section.<type>` for the composition manifest. |
| `src/execution-runtime.ts` | 486 | Runtime composition contracts: `ThemeEngineRenderContext`, `SectionRegistryRuntime`/`BlockRegistryRuntime` (+ in-memory impls 204–234), `hydrateSectionSchemas` (236–252), `composeStorefrontTheme` (288–301: visible-filter + order-sort), `injectRuntimeSections` (before/after/replace injection — 313–350), section/block lifecycle executors with `authority: 'theme-engine'` metadata (352–402), `hydrateAndComposeStorefrontTheme` (460–486). |

Package exports (`packages/theme-engine/package.json:8–13`): `.`, `./theme-bundle`, `./theme-renderer`, `./theme-registry`. Consumers (grep of `@letbuyy/theme-engine` in package.json files): `apps/storefront-runtime`, `apps/theme-marketplace`, `apps/merchant-control-plane`, `services/api-gateway`, `packages/application-services`, `packages/runtime-composition`, `packages/typescript/api-types`, `packages/tenant-core`.

### 2.2 `services/api-gateway` (Cloudflare Worker, Hono) — write-side authority

- Router mounted at `api.route('/themes', themesRouter)` (`services/api-gateway/src/index.ts:383`).
- `src/routes/themes.ts` — 18 endpoints (grep of `^router.(get|post|put|delete)`):
  - Public/optional-auth: `GET /` (catalog, line 137), `GET /categories` (243), `GET /industries` (262), `GET /:slug` (560), `GET /:slug/schema` (348).
  - Auth-required (middleware lines 40–52): `GET /:slug/editor` (356), `PUT /:slug/editor/draft` (380), `DELETE /:slug/editor/draft` (394), `POST /:slug/publish` (418, then `purgeThemeStorefrontCache` at 429), `POST /:slug/preview-session` (434), `GET /:slug/releases` (448), `POST /:slug/releases/:releaseId/rollback` (472), `POST /packages/upload` (489), `POST /:slug/install` (588), `POST /:slug/purchase` (604, Razorpay order via `createRazorpayOrder` import line 36), `POST /:slug/purchase/verify` (783), `GET /purchases/list` (287), `GET /installations/list` (310).
- `src/execution/theme-execution.adapter.ts` (1,300+ lines) — owns the install/draft/publish/rollback/preview-session workflows (detail in §4).
- `src/execution/schema-registry-execution.adapter.ts` (649 lines) — DB-backed schema registry: `resolveThemeRuntime` (436–485) reads `theme_schema_manifests` + `theme_renderer_manifests` keyed by latest published `theme_package_versions`; falls back to `legacyRuntime` (111–142) which reads `themes.section_schemas/settings_schema/...` and ultimately the static `getSectionSchemas()` from `@letbuyy/api-types`. `uploadThemePackageBundle` (245–434) persists a bundle into `themes` (legacy catalog upsert, 264–313) + `theme_packages` + `theme_package_versions` + manifests; marketplace submissions are forced to `draft` status pending review (`reviewRequired = options.publicationMode !== 'private_install'`, lines 256–261). `ensureThemePackageRuntime` (487–611) backfills package rows for legacy themes on demand.
- `src/routes/operations.ts` — marketplace review queue: `GET /operations/marketplace-reviews` (300), `POST /operations/marketplace-reviews/:id/decision` (320); `publishThemeReviewDecision` (183–243) flips `theme_packages.status`, latest `theme_package_versions.release_status`, and `themes.is_active = (decision === 'approved')` (228–237), then emits `theme.approved`/`theme.rejected` domain events (282–297).
- `src/routes/storefront.ts` — read-side: published store payload + current release (`GET /storefront/:subdomain`, 2197+), draft preview payload (`GET /storefront/:subdomain/theme-preview?token=`, 2052–2194), release loader `loadCurrentThemeRelease` (979–1009; pooled-SQL fast path at 815–832: `where is_current = true and release_status = 'published' order by release_version desc limit 1`).

### 2.3 `apps/merchant-control-plane` — web theme editor

- Editor page (active): `src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (client component, ~2,000 lines). Loads `/api/themes/[themeId]/editor` + `/api/themes/[themeId]/sections` (695–698), merges API schemas over the static fallback `getSectionSchemas(themeId)` (694, 708–712). Save: `POST /api/themes/[themeId]/editor/draft` (813–817). Publish: `PUT /api/themes/[themeId]/editor` (857–861). Undo/redo history, Cmd+S/Z/Y bindings (762–809). **Preview is an in-editor mock** — `PreviewCanvas` (1665+) renders hand-written placeholder markup with hardcoded `PREVIEW_PRODUCTS` (line 174) and `getPreviewText()` helpers (576–580); it does NOT iframe the storefront and does NOT call the preview-session API.
- Themes list page: `src/app/[store]/online-store/themes/page.tsx` — list via `GET /api/themes?store_name=` (142), install via `POST /api/themes/install` (170, 223), publish/unpublish store via `POST /api/themes/publish` (272).
- BFF proxy routes (all delegate to `createMerchantApiClient().themes.*` → gateway):
  - `src/app/api/themes/route.ts`, `install/route.ts` (supports `bundle` upload with `submission_mode: 'private_install'` then install — lines 26–44), `publish/route.ts`, `[themeId]/editor/route.ts` (GET loads editor; PUT = saveDraft **then immediately publish with `make_store_live: true`**, lines 83–92), `[themeId]/editor/draft/route.ts` (POST/DELETE), `[themeId]/sections/route.ts` (schema catalog via `themes.schema`), `[themeId]/sections/reorder/route.ts`, `[themeId]/releases/route.ts`, `[themeId]/releases/[releaseId]/rollback/route.ts`, `[themeId]/preview-session/route.ts`.
- Orphaned editor v2 components: `src/components/theme-editor/CenterPanel.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx`, `EditorHeader.tsx`, `IconRail.tsx`, `SectionItem.tsx`, `AddSectionModal.tsx`, `ThemeSettingsPanel.tsx` — a repo-wide grep shows the only `@/components/theme-editor` import in any page is `SchemaFormRenderer` (`editor/page.tsx:45`); `CenterPanel` has zero external references. CenterPanel is the component that would iframe the live storefront (`/store/{name}?editor=1&theme_preview_token=…`, lines 32–40) and drive the postMessage selection protocol (`LETBUYY_THEME_EDITOR_SELECTION`, lines 44–51). It is dead code today.
- Appearance page `src/app/[store]/appearance/page.tsx`: brand-token editor with a static sample preview only (grep showed `RadiusPreview`/`ColorPreviewButton`; line 421: "Custom CSS is stored but not executed in this preview"); no storefront iframe.

### 2.4 `apps/theme-marketplace` — buyer/partner-facing catalog

- `src/lib/theme-service.ts`: pure API-client wrapper — `listThemes` → `api.themes.listCatalog` (42), `getThemeBySlug` (59), `uploadThemePackage` → `api.themes.uploadPackage({bundle})` (68), `installTheme` → `api.themes.install(slug, {store_id, config_overrides:{}})` (112–122), purchases/installations/stores lists.
- Pages: `/themes`, `/themes/[slug]`, `/install` (server action `installThemeAction` → `ThemeService.installTheme`, `src/app/install/page.tsx:31–51`; redirects to `/dashboard/installations?installed=` on success, errors `purchase_required`/`install_failed`), `/checkout` + `/checkout/success` (purchase), `/pricing`, dashboard (downloads/installations/purchases/settings).
- Theme upload: `src/components/theme-upload-panel.tsx` — accepts a single JSON file, parses, `POST /api/themes` with `{bundle}` (41–45). Its own API proxy `src/app/api/themes/route.ts` and `src/app/api/themes/[slug]/route.ts` forward to the gateway.

### 2.5 `apps/mobile/merchant-app` (Flutter) — the only client that wires the full preview chain

`lib/services/theme_service.dart`: catalog (27–41), `installTheme` (43–53), `loadEditor` (55–72), `saveDraft` with `client: 'flutter-builder'` (74–90), `discardDraft` (109–114), `fetchReleases` (116–121), `createPreviewSession` (123–132), `rollbackRelease` (134–147), `publish` (149–161), and `buildStorefrontPreviewUrl` which constructs `<storefront>/preview?subdomain=…&viewport=…&editor=1&theme_preview_token=…&settings_data_b64=…` (163–188).

### 2.6 `apps/storefront-runtime` — read-side consumer (full detail in report 05)

Theme-relevant files: `src/lib/store-service.ts` (release→StoreModel mapping), `src/lib/theme-engine/{template-resolver,composition-engine,renderer-registry,data-binding-engine,types,product-route,content-route,editor-preview-section-frame,liquid-hydration-islands}.{ts,tsx}`, `src/app/preview/page.tsx` + `storefront-preview-bridge.tsx`, `src/lib/theme-preview-{cookie,server}.ts`, and two read-only theme API proxies (`src/app/api/themes/route.ts` — catalog proxy; `src/app/api/themes/install/route.ts` — hard-blocked, returns HTTP 410 with "Theme installation must be performed from the authenticated admin API", lines 8–16).

---

## 3. Runtime ownership

| Concern | Owner | Evidence |
|---|---|---|
| Theme contracts, validation, Liquid renderer | `packages/theme-engine` | files in §2.1 |
| Theme mutations (install, draft, publish, rollback, preview-session, purchase, package upload) | `services/api-gateway` (Hono Worker) via `ThemeExecutionAdapter` + `SchemaRegistryExecutionAdapter`; adapters self-declare `runtimeBridge.workflowAuthority: 'theme-application'` (`theme-execution.adapter.ts:186–192`) | §2.2 |
| Section/block React implementations (JSON-contract engine) | `apps/storefront-runtime` (`renderer-registry.tsx` static imports — see report 05 §4) | report 05 |
| Theme review/approval | gateway `routes/operations.ts` (operations actor) | §2.2 |
| Editor UI | `apps/merchant-control-plane` (web) and `apps/mobile/merchant-app` (Flutter) | §2.3, §2.5 |
| Marketplace catalog UI + purchase + upload | `apps/theme-marketplace` | §2.4 |
| Theme presentation runtime governance | declared in `apps/storefront-runtime/runtime.manifest.json` (`businessAuthority: "…theme presentation runtime"`, line 13; governance doc list includes `docs/governance/theme-runtime-governance.md`, line 16) | file |

---

## 4. Data ownership (tables / buckets)

All tables below are defined in `database/supabase/migrations/000_baseline.sql` (line numbers shown). **No storage buckets are used by theme code** (see §1).

### 4.1 Tables actively read/written by code

| Table | Defined at | Written by | Read by |
|---|---|---|---|
| `themes` (catalog: slug, config JSONB with colors/fonts, `default_template`, `section_schemas`, `block_schemas`, `settings_schema`, `renderer_manifest`, `schema_version`, `renderer_version`, pricing columns; `letbuyy_pricing_type` check `free/one_time/subscription`) | 12895–12943 | `SchemaRegistryExecutionAdapter.uploadThemePackageBundle` upsert (adapter 264–313); review decision flips `is_active` (operations.ts 228–237) | gateway `GET /themes`, `getTheme()` (adapter 242–255) |
| `store_themes` (store_id, theme_id uuid, is_active, config_overrides) | 12121–12129 | `installTheme` deactivate-then-upsert (adapter 792–811) | gateway `GET /themes` (installed flags), `installations/list` |
| `theme_packages` / `theme_package_versions` (package_manifest JSONB holds the whole bundle incl. `liquidBundle`) | 12635 / 12611 | upload (registry adapter 322–377) + legacy backfill `ensureThemePackageRuntime` (487–611); review decision updates status (operations.ts 189–225) | `findPackageRuntime` (613–647), `resolveThemeRuntime` |
| `theme_schema_manifests` / `theme_renderer_manifests` | 12809 / 12773 | upload + backfill upserts (registry adapter 379–410, 557–603); also seeded by `database/supabase/seeds/urban-kicks-theme.sql` (INSERT at line 15, renderer key map e.g. `'header','core.header'` at line 30) | `resolveThemeRuntime` (441–452) |
| `theme_instances` (per-store install: instance_status installed/active/inactive/upgrading/archived, installed_config, current_draft_id, active_release_id) | 12550–12568 | `ensureThemeInstance` (adapter 284–363), `finalizeInstanceRelease` (507–547) | editor load, preview |
| `theme_editor_drafts` (legacy single-draft per store+theme, draft_config JSONB, version) | 12506–12518 | `saveDraft` upsert onConflict `store_id,theme_id` (adapter 1002–1018), `deleteDraft` (1089–1093) | `loadEditor` (884–889), `publish` (1126–1131), preview route (storefront.ts 2125–2150) |
| `theme_instance_drafts` (working_manifest JSONB, draft_status active/archived/published/discarded) | 12525–12543 | `saveInstanceDraftSnapshot` (365–458) | `loadActiveInstanceDraft` (460–505), preview route (storefront.ts 2103–2123) |
| `theme_draft_patches` (append-only ops; patch_type set/unset/insert/move/duplicate/delete/visibility/schema_migration) | 12482–12498 | one compat snapshot patch per save (`operation: {op:'replace', path:'/', source:'theme_editor_drafts.compat'}`, adapter 429–444) | not read anywhere (write-only audit trail) |
| `theme_releases` (immutable releases: release_config, release_manifest, template_snapshot, settings_snapshot, asset_manifest, cache_manifest, data_binding_manifest, engine_version default `theme-engine-v1`) | 12737–12766 | RPC `publish_theme_release` (function at baseline 4531–4660: supersedes current, inserts new, returns release_id/version/published_at) + manifest enrichment (adapter 598–618) + insert fallback when RPC missing (649–765) | storefront read (`loadCurrentThemeRelease`), `listReleases`, rollback source |
| `theme_preview_sessions` (token_hash sha-256, expires_at, draft_id, theme_instance_draft_id) | 12679 | `createPreviewSession` (adapter 1305–1380) | `GET /storefront/:subdomain/theme-preview` (storefront.ts 2055–2194) |
| `theme_purchases` | 12708 | purchase + verify routes (themes.ts 604–) | premium-install gate (adapter 779–790), purchases list |
| `theme_reviews` (ratings 1–5) | 12789–12802 | not found in repository (no insert path located in app/gateway code) | theme detail aggregates |
| `sites` (`theme_id text DEFAULT 'modern'`, `template_config jsonb`, `theme_settings jsonb`, legacy `sections jsonb`, `current_theme_release_id uuid`, `storefront_release_version int`) | 11950–12009 | publish RPC + fallback (adapter 717–754) | every storefront read; editor fallback config |
| `marketplace_review_records` | (table referenced by `lib/marketplace-review-records.ts`) | created on marketplace upload (themes.ts imports `createMarketplaceReviewRecord`, lines 10–13) | operations review queue |
| `storefront_cache_tags` | 12136 | release cache tags | cache purge |

### 4.2 Tables defined in DB but with ZERO application-code references (orphaned)

Grep for each name across all `**/*.{ts,tsx}` returned no matches: `theme_assets` (baseline 12440), `theme_layouts` (12575), `theme_templates` (12876), `theme_section_definitions` (12829), `theme_block_definitions` (12462), `theme_template_assignments` (12852), `theme_migrations` (12593). `theme_presets` (12661) likewise has no code reference beyond the migration history.

### 4.3 Dual-key identity note

`themes.id` is a uuid and `store_themes.theme_id` is uuid (FK to `themes.id`), but `sites.theme_id`, `theme_releases.theme_id`, `theme_editor_drafts.theme_id`, and the editor/publish APIs all key on the **theme slug** (text). `publishReleaseSnapshot` passes `themeId: theme.slug` (`theme-execution.adapter.ts:830, 1155`); `theme_releases.theme_id` is `text NOT NULL` (baseline 12740). The two identity spaces coexist; mapping is via `themes.slug` lookup and `theme_packages.legacy_theme_id`.

---

## 5. End-to-end chain: marketplace → install → render (with evidence at each hop)

1. **Author/upload.** Partner uploads a JSON bundle file in `apps/theme-marketplace/src/components/theme-upload-panel.tsx:41–45` → marketplace BFF → gateway `POST /themes/packages/upload` (themes.ts:489) → Zod validation `UploadThemePackageSchema` (theme-bundle.ts:509) → `SchemaRegistryExecutionAdapter.uploadThemePackageBundle` writes `themes` + `theme_packages` (status `draft`) + `theme_package_versions` (release_status `draft`) + both manifests; `installable = (status==='active' && release_status==='published')` is false for marketplace submissions (adapter 256–261); a `marketplace_review_records` row + `theme.submitted` domain event are created (themes.ts:103–134). The merchant private path (`apps/merchant-control-plane/src/app/api/themes/install/route.ts:26–31`) uses `submission_mode: 'private_install'`, which skips review and publishes immediately.
2. **Review/approve.** Operations actor decides via gateway `POST /operations/marketplace-reviews/:id/decision`; `publishThemeReviewDecision` sets `theme_packages.status='active'`, latest version `release_status='published'`, and `themes.is_active=true` (operations.ts:183–237); emits `theme.approved` (282–297). Only then does the catalog list it (`getTheme` filters `is_active=true`, adapter:247).
3. **Browse/purchase.** `apps/theme-marketplace` lists via `GET /themes`; paid themes go through `POST /themes/:slug/purchase` (Razorpay order) + `/purchase/verify`; install of premium themes is gated on a completed `theme_purchases` row (adapter:778–790).
4. **Install.** Marketplace `/install` server action OR merchant themes page → gateway `POST /themes/:slug/install` → `ThemeExecutionAdapter.installTheme` (767–878): upserts `store_themes` (deactivating others), resolves a renderable `template_config` (existing store config or the theme's `default_template`/`getDefaultStorefrontThemeTemplate` fallback via `resolveRenderableThemeTemplateConfig`, index.ts:671–692), validates it against the DB schema registry, ensures a `theme_instances` row, then **publishes release #N** via `publish_theme_release` RPC (supersede current → insert `theme_releases` row → update `sites.theme_id/template_config/current_theme_release_id/storefront_release_version`), enriches the release with `release_manifest` (incl. `liquidBundle` copy when present — `buildReleaseArtifacts`, adapter 549–596, lines 583–586), finalizes the instance, and emits `theme.installed`.
5. **Edit.** Web editor (merchant-control-plane) or Flutter builder loads `GET /themes/:slug/editor?store_id=` → `loadEditor` returns store + theme + `template_config` (draft if renderable, else live config; adapter 908–911) + DB-resolved `schemas` (`resolveThemeRuntime`) + draft/release metadata. Autosave `PUT /themes/:slug/editor/draft` → validation → `theme_editor_drafts` upsert with optimistic-version conflict check (`ConflictError` if `existingVersion > base_version`, adapter 995–997) + dual-write into `theme_instance_drafts` + one `theme_draft_patches` snapshot row + `theme.draft.saved` domain event + audit event.
6. **Preview.** `POST /themes/:slug/preview-session` requires an existing draft (adapter 1328–1330), creates a hashed token row in `theme_preview_sessions` (15-min default TTL). Storefront then serves `GET /storefront/:subdomain/theme-preview?token=` which swaps the live release for a synthetic release built from the draft manifest (storefront.ts 2156–2179) — the storefront-runtime `/preview` page and `/store/[subdomain]?theme_preview_token=` both consume this (report 05 §6). **Caller today: only the Flutter merchant app** (`theme_service.dart:123–132, 163–188`). The web editor never calls preview-session; its preview is the static in-page mock (§2.3).
7. **Publish.** `POST /themes/:slug/publish` → `publish` (adapter 1117–1193): take draft config (or current store config), validate, ensure instance, `publish_theme_release` RPC (new immutable release, `sites` updated, optional `status='published'` when `make_store_live`), finalize instance (mark instance draft `published`), delete legacy draft, then gateway purges storefront cache (`purgeThemeStorefrontCache` → `bumpStorefrontCacheVersion` + `purgeStorefrontCache`, themes.ts:76–91, 429).
8. **Render.** Storefront-runtime requests `GET /storefront/:subdomain` → store row + `loadCurrentThemeRelease` → payload includes `current_theme_release` (release_config/template_snapshot/release_manifest…) + `app_blocks` → `StoreService.mapSupabaseToStore` (storefront-runtime `store-service.ts:551–710`) prefers `template_snapshot` → `release_manifest.templateConfig` → legacy `sites.template_config` (556–564), localizes, normalizes sections/templates/sectionGroups, injects app blocks into `appBlockSlot` sections, parses `liquidBundle` if present (661–662) → render plan → React sections or Liquid HTML (full pipeline in report 05).
9. **Rollback.** `POST /themes/:slug/releases/:releaseId/rollback` republished the old snapshot as a NEW release with `rollback_of_release_id` set (adapter 1222–1303) — releases are immutable and history is preserved.

### Where the chain is broken / degraded (factual)

- **B-1 (broken): web editor live preview.** The complete preview infrastructure exists on both ends — gateway preview-session + theme-preview route; storefront `/preview` page + `StorefrontPreviewBridge` postMessage protocol + per-section `EditorPreviewSectionFrame`; merchant `CenterPanel` iframe component — but the active web editor page never mounts `CenterPanel` and never calls `/api/themes/[themeId]/preview-session` (grep: zero callers in merchant-control-plane UI; only the route file itself references it). The web merchant edits against a hardcoded mock (`PREVIEW_PRODUCTS`, `editor/page.tsx:174, 1665+`). Only the Flutter app exercises the real chain.
- **B-2 (one-step publish):** The web editor's "publish" path (`[themeId]/editor/route.ts:83–92`) is saveDraft immediately followed by `publish({make_store_live:true})` — there is no staged review/approval between draft and live for the merchant's own store (rollback exists as the recovery mechanism).
- **B-3 (mock-vs-schema drift surface):** the editor mock preview renders only the section types it has hand-written renderers for (announcement/header/hero/category/featured/grid/newsletter etc. in `editor/page.tsx:1792–1948`); DB-registered Liquid sections (e.g. `liquid.section.spotlight`) have no mock renderer, so a Liquid theme's editor preview cannot reflect those sections (the schemas still load and settings still save).
- **B-4 (orphaned normalized layer):** the seven normalized theme tables in §4.2 (layouts/templates/section-definitions/block-definitions/assignments/assets/migrations) have no readers or writers; all template/section data actually lives inside JSONB manifests (`package_manifest`, `release_config`, `template_snapshot`, `working_manifest`, `draft_config`).
- **B-5 (theme_reviews write path):** the `theme_reviews` table and `ThemeReview` type exist (index.ts:1016–1028), but no API route in the gateway or any app writes reviews — not found in repository.

---

## 6. Theme configuration: settings schemas & presets (factual inventory)

- **Settings schema shape**: groups of typed fields (`SchemaField` types: text, textarea, richtext, color, image, select, toggle, range, number, url, radio — theme-registry.ts:12–24; identical enum in bundle contract theme-bundle.ts:82). Global settings groups in the static registry: colors (5 color fields), typography (2 font selects with fixed option lists), layout (borderRadius 0–24 step 2, enableAnimations, enableShadows), header, footer (theme-registry.ts:436–489).
- **Section schemas**: 12 static types (§2.1) + 10 runtime-only schemas declared inside the storefront app (`RUNTIME_SECTION_SCHEMAS` in `renderer-registry.tsx:66–188`: productDetail, featuredProducts, aboutSection, portfolioGrid, skillsSection, experienceTimeline, contactForm, ctaSection, servicesGrid, contentPage). DB-backed schemas from `theme_schema_manifests` override/extend these at editor time (gateway `resolveThemeRuntime`); the storefront render path consults only its compiled-in registry plus generic fallbacks (`schemaFor`, renderer-registry.tsx:190–196).
- **Presets**: per-section `presets` arrays exist in static schemas (e.g. heroBanner 3 presets, theme-registry.ts:96–100; productGrid 3; announcementBar 2; footer 2) and in the Liquid bundle contract (`ThemeLiquidPresetSchema`, theme-bundle.ts:143–148; first preset's settings become section defaults — 778). **No merchant-facing preset-picker UI was found** in merchant-control-plane (grep for preset usage in editor page shows schemas carry presets but the editor renders settings forms only via `SchemaFormRenderer`). Theme-level `color_presets`/`font_pairings` columns exist on `themes` (baseline 12923–12924) and in the `Theme` type (index.ts:971–972); no UI consuming them was found.
- **Validation enforcement points**: every draft save and publish runs `collectThemeTemplateValidationIssues` server-side (adapter `validateTemplateConfig`, 200–216) — unknown section types are rejected (`…is not registered for this theme`, index.ts:478, 513), unknown setting keys rejected (380), unsafe keys/URLs rejected, 256 KB cap, ≤50 sections per legacy template / ≤80 per portable template, ≤50 blocks per section, ≤100-item arrays, ≤5,000-char strings (272–298, 401, 609, 629). Liquid sources additionally capped at 200 KB and tag-restricted (theme-bundle.ts:56, 96–119). So the claim "no section schema validation" would be false; validation exists and is database-schema-driven with static fallback.
- **Localization**: bundle `locales` map with `t:` translation prefix; storefront applies `localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale)` at read time (store-service.ts:582).

---

## 7. Prior-claim verification (FORENSIC_REPORT/04 & 05 previous versions, root ledgers)

| Prior claim | Verdict | Evidence |
|---|---|---|
| Two render paths (JSON-contract + Liquid), DB-backed drafts/releases/rollback | **Confirmed** | §1, §4, §5 |
| "T-1: section registry hardcoded in storefront app" | **Confirmed** | `renderer-registry.tsx:1–29` static imports; report 05 §4 |
| "T-2: urban-kicks demo bypasses pipeline" | **Confirmed** | `store-service.ts:55–57, 73–75, 92–94, 116–118`; fixture `lib/demo/urban-kicks-demo.ts:7–15`; DB seed also exists (`database/supabase/seeds/urban-kicks-theme.sql:15`) |
| "T-3: one-step publish to live" | **Confirmed** | `[themeId]/editor/route.ts:83–92` |
| "T-4: preview always uses the React JSON-contract path; Liquid themes preview ≠ production" | **Contradicted as stated.** The storefront `/preview` page renders through the same `StorefrontCompositionEngine`, which attempts the Liquid path first (`composition-engine.tsx:203–213`) even in `editorMode`; Liquid output is identical to production (only wrapped with `data-editor-mode`). The real fidelity gap is the **web editor's in-page mock preview** (§5 B-1/B-3), not the storefront preview route. |
| "drafts land in `theme_drafts`" | **Contradicted** — no `theme_drafts` table exists; tables are `theme_editor_drafts` (baseline 12506) and `theme_instance_drafts` (12525). |
| "no query of app_extension_registrations in storefront source" | **Partially contradicted** — true for storefront-runtime source, but the gateway storefront route loads them (`loadRegisteredThemeAppBlocks`, storefront.ts:1080–1098, surface `theme.app_block`) and ships them as `app_blocks` on every store payload, which `store-service.ts` injects into sections (220–288). |
| `apps/storefront-runtime/AGENTS.md` lists `/api/payments/*` routes (lines 45–51, 101–107) | **Contradicted** — directory enumeration of `src/app/api` shows no `payments` directory; the generated AGENTS.md (dated 2026-05-25, line 1) is stale. |
| "~50 tables" theme storage | **Overcount** — 19 theme-prefixed tables + `themes` + `store_themes` + `sites` columns (this report §4); 7–8 of those are orphaned. |

---

## 8. Limitations (factual, evidence-cited)

1. New JSON-contract section types require a storefront-runtime deploy; the render registry is compiled-in (`renderer-registry.tsx:198–345`). Liquid bundles avoid this (sections ship as data) but only for stores whose release carries a `liquidBundle`.
2. Web editor has no live storefront preview wiring (§5 B-1); preview-session machinery is Flutter-only in practice.
3. Theme assets have a schema (`theme_assets`, R2 provider column) but no upload, serve, or CDN code path — Liquid bundle `renderer.assets` manifests default to `{}` and nothing materializes them (theme-bundle.ts:209–215; no `theme_assets` code references).
4. Liquid bundles travel inside JSONB (`package_manifest.liquidBundle`, `release_manifest.liquidBundle`, `sites.template_config.liquidBundle`) — every storefront bootstrap response carries the full theme source; there is no separate compiled-template store or per-section cache (LiquidRenderer constructs `new Liquid({cache:false,…})` per render — theme-renderer.ts:230–232).
5. `SaveThemeDraftSchema` enforces optimistic concurrency only when the client sends `base_version` (optional — index.ts:889; adapter 995–997); the active web editor save path does not send it (`draft/route.ts:40–44` builds the body without base_version), so last-write-wins between concurrent web sessions.
6. `theme_draft_patches` receives only whole-document snapshot patches (`compatibility_snapshot: true`, adapter 436–443); the granular patch_type vocabulary (insert/move/duplicate/…) defined in the table check (baseline 12498) is unused.
7. Theme purchase currency is INR-only at the contract level (`ThemePurchaseOrderSchema currency: z.enum(['INR'])`, index.ts:911–914) and provider is Razorpay-only on the gateway purchase path (themes.ts:36, 604+); `ThemePurchase.payment_provider` type also names `'stripe'` (index.ts:992) but no Stripe theme-purchase route exists — not found in repository.
8. Schema authority is split three ways: gateway DB registry (authoritative for editor), `packages/theme-engine` static registry (fallback + validation), and storefront `RUNTIME_SECTION_SCHEMAS` (render-side only). The storefront copy is not fed by the DB registry at render time.
9. `themes.theme_id` slug-vs-uuid duality (§4.3) means joins between `store_themes` (uuid) and `theme_releases`/`sites` (slug) require a `themes` lookup; no FK exists from `theme_releases.theme_id` to `themes`.
10. No theme CLI / dev-server / theme-check tooling exists in the repo (grep for theme-related `bin` entries found none) — confirms prior report's "NO" rows.

---

## Evidence Index

- `packages/theme-engine/package.json` (liquidjs dep :20; exports :8–13)
- `packages/theme-engine/src/index.ts` (:17–44 section types; :61–74 defaults; :112–128 StoreTemplateConfig; :146–175 editor payload; :247–298 unsafe-key/JSON validation; :650–692 fallback resolution; :694–731 validation entry; :873–943 API schemas; :911–920 INR/Razorpay purchase schemas; :948–1028 marketplace types)
- `packages/theme-engine/src/theme-registry.ts` (:419–432 SECTION_SCHEMAS; :436–489 settings schema; :493–506 fallback comment; :540–568 renderable check; :574–733 default template)
- `packages/theme-engine/src/theme-bundle.ts` (:3–28 versions/paths; :30–51 hydration islands; :56–58 liquid caps; :96–119 forbidden fragments; :185–197 schema-tag requirement; :429–507 liquid bundle schema/union; :509–514 upload schema; :536–656 locales; :877–1059 persistence payloads; :1162+ fixtures)
- `packages/theme-engine/src/theme-renderer.ts` (:82–102 JSON renderer; :104–211 Liquid renderer; :224–251 engine opts; :267–269 schema strip; :332–362 scope; :370–391 app-block html; :471–485 sanitize/escape)
- `packages/theme-engine/src/execution-runtime.ts` (:204–301; :313–350 injection; :460–486 hydrate+compose)
- `services/api-gateway/src/index.ts` (:28, :383 mount)
- `services/api-gateway/src/routes/themes.ts` (:38–52 auth middleware; :76–91 cache purge; :103–134 submitted event; route handlers :137–847)
- `services/api-gateway/src/execution/theme-execution.adapter.ts` (:183–198 bridge; :200–216 validate; :242–255 getTheme; :284–363 instance; :365–458 instance draft + patch; :507–547 finalize; :549–596 artifacts incl. liquidBundle :583–586; :620–647 RPC publish; :649–765 fallback publish + sites update :717–754; :767–878 install; :880–965 loadEditor; :967–1076 saveDraft; :1117–1193 publish; :1222–1303 rollback; :1305–1380 preview session)
- `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` (:87–142 legacy runtime; :164–224 bundle→config; :245–434 upload incl. review gating :256–261, legacy catalog upsert :264–313; :436–485 resolveThemeRuntime; :487–611 backfill; :613–647 find)
- `services/api-gateway/src/routes/operations.ts` (:153–243 decisions incl. themes.is_active :228–237; :245–298 events; :300–359 review queue)
- `services/api-gateway/src/routes/storefront.ts` (:647–660 selects; :815–832 pooled release SQL; :979–1009 release loader; :1068–1098 app blocks registry; :1100–1160 legacy app blocks; :2052–2194 theme-preview; :2196–2211 bootstrap)
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (:45 sole theme-editor import; :174 mock products; :694–756 load; :811–829 save; :852–875 publish; :1665+ PreviewCanvas; :1792–1948 mock section renderers)
- `apps/merchant-control-plane/src/app/api/themes/...` (editor route :29–41 GET, :83–92 PUT publish; draft route :40–44 POST, :80 DELETE; install route :26–44 bundle+install; sections route :15–27)
- `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` (:15–19 storefront URL; :32–40 preview URL with editor=1+token; :44–51 postMessage; orphaned — grep showed no importers)
- `apps/merchant-control-plane/src/app/[store]/appearance/page.tsx` (:391–421 static preview; :421 custom CSS note)
- `apps/theme-marketplace/src/lib/theme-service.ts` (:42, :59, :62–69, :112–122)
- `apps/theme-marketplace/src/app/install/page.tsx` (:31–51 server action)
- `apps/theme-marketplace/src/components/theme-upload-panel.tsx` (:36–49)
- `apps/mobile/merchant-app/lib/services/theme_service.dart` (:27–161 full flow; :123–132 preview session; :163–188 preview URL)
- `apps/storefront-runtime/src/lib/store-service.ts` (:13–29 release row; :53–129 service; :185–288 app-block injection; :440–457 worker fetches; :551–710 mapping incl. release precedence :556–564, localize :582, liquidBundle :661–662; :712–743 type normalization map)
- `apps/storefront-runtime/src/app/api/themes/install/route.ts` (:8–16 HTTP 410 block)
- `apps/storefront-runtime/runtime.manifest.json` (:13 business authority; :16 theme governance doc)
- `apps/storefront-runtime/AGENTS.md` (:1 generation date; :45–51 stale payment routes)
- `packages/typescript/api-client/src/index.ts` (:1267–1282 themes client methods)
- `packages/runtime-composition/storefront-query-layer/index.ts` (:41–103 projection)
- `database/supabase/migrations/000_baseline.sql` (sites :11950–12009; store_themes :12121; theme_assets :12440; theme_block_definitions :12462; theme_draft_patches :12482; theme_editor_drafts :12506; theme_instance_drafts :12525; theme_instances :12550; theme_layouts :12575; theme_migrations :12593; theme_package_versions :12611; theme_packages :12635; theme_presets :12661; theme_preview_sessions :12679; theme_purchases :12708; theme_releases :12737; theme_renderer_manifests :12773; theme_reviews :12789; theme_schema_manifests :12809; theme_section_definitions :12829; theme_template_assignments :12852; theme_templates :12876; themes :12895–12943; publish_theme_release fn :4531–4660)
- `database/supabase/seeds/urban-kicks-theme.sql` (:15 manifest insert; :30 renderer key map)
- Negative findings (greps with zero matches, scope `**/*.{ts,tsx}`): `storage.from(`; `theme_assets|theme_layouts|theme_templates|theme_section_definitions|theme_block_definitions|theme_template_assignments|theme_migrations`; `CenterPanel` importers; merchant UI callers of `preview-session`.
