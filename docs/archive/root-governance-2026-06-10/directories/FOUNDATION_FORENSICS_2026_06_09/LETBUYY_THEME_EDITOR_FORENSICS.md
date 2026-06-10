# LETBUYY THEME EDITOR FORENSICS
**Audit Date:** 2026-06-09
**Auditor:** Theme Architecture Architect (READ-ONLY forensic pass)
**Scope:** packages/theme-engine, apps/theme-marketplace, apps/storefront-runtime, services/api-gateway/src/routes/themes.ts + execution adapters, packages/app-engine, packages/extension-host

---

## EXECUTIVE SUMMARY

The LetBuyy theme editor is a **genuine, architecturally serious section/block system** that closely mirrors Shopify Online Store 2.0 conceptually and, in several key dimensions, operationally. It has a typed section/block schema registry, a portable JSON-contract bundle format with a Liquid engine path, a draft→publish→release pipeline with versioned immutable snapshots, an app-block extension surface, and caching infrastructure. This is far above the "hardcoded React templates with a few props" baseline.

However, several critical gaps prevent it from reaching Shopify OS2.0 parity:

1. **The registry is a closed static map** — 12 built-in sections enumerated in `theme-registry.ts`; third-party theme sections load only through the portable bundle upload pathway, which lands the schemas in a DB table (`theme_schema_manifests`) that the storefront renderer never consults at render time. The storefront reads `store.templateConfig` (a JSON blob on the `sites` row) and resolves sections by type string — it does not call back to the schema registry at request time.
2. **Two parallel schema representations coexist**: the `theme-registry.ts` static record (used by the editor panel and validation) and `theme-schema_manifests` DB table (used when a portable bundle is uploaded). The storefront renderer is unaware of either at render time — it uses the `rendererKey` string embedded in each section's `SectionModel` to dispatch rendering, but no runtime "does this renderer key resolve to a real React component?" check is enforced.
3. **App-block injection into the storefront is schema-ready but execution-stub**: the `appBlockSlot` section type is registered, the `app-engine`'s `theme.app_block` surface with `liquid_app_block` renderer exists, and `extension-host` surfaces `storefront.home.after-hero` targets are registered. But no code path exists in the storefront-runtime that fetches enabled `theme.app_block` extensions at render time and injects them. The slot is a template-only placeholder.
4. **Per-request DB reads with no visible in-request caching**: the storefront page (`page.tsx`) calls `composeStorefrontRuntimeProjection` which calls `loadStore` (DB read) and `loadTemplate` (reads `templateConfig` from the returned store row). `revalidate = 60` provides Next.js ISR caching at 60 seconds. There is no explicit in-memory or KV-layer cache per-subdomain within the request.

**Score: 62/100**

---

## ARCHITECTURE DIAGRAM — THEME PIPELINE (EDITOR → STORAGE → RENDERER)

```
EDITOR (apps/merchant-control-plane or Flutter mobile)
  │
  │  GET /themes/:slug/editor?store_id=...
  │     ThemeExecutionAdapter.loadEditor()
  │     → reads sites.template_config   (current live template)
  │     → reads theme_editor_drafts     (per-template-key draft)
  │     → reads theme_schema_manifests  (section + block schemas for panel)
  │     → returns ThemeEditorPayload { template_config, schemas, draft, release }
  │
  ├── Editor panel renders section list from template_config.sections[]
  │   Schema for each section served from schemas.sections[type]
  │   (source: theme_schema_manifests if bundle-uploaded, else static SECTION_SCHEMAS)
  │
  │  PUT /themes/:slug/editor/draft
  │     → validateTemplateConfig() against schema registry
  │     → upsert theme_editor_drafts (store_id, theme_id, template_key, draft_config, version++)
  │     → also writes theme_instance_drafts (working_manifest) + theme_draft_patches
  │
  │  POST /themes/:slug/preview-session
  │     → creates theme_preview_sessions row with signed token (HMAC hash stored, raw token returned)
  │     → storefront reads preview draft via token
  │
  │  POST /themes/:slug/publish
  │     → reads draft from theme_editor_drafts
  │     → validates config against schema registry
  │     → calls publish_theme_release DB RPC (atomic)
  │       → creates theme_releases row (release_config snapshot, is_current=true)
  │       → updates sites.template_config = release_config
  │       → updates sites.current_theme_release_id
  │     → marks draft as 'published' in theme_instance_drafts
  │     → bumps storefront cache version (KV) + purges cache keys
  │
STORAGE (Supabase)
  ├── sites.template_config          JSON blob — live published config
  ├── theme_editor_drafts            per (store_id, theme_id, template_key) draft
  ├── theme_instance_drafts          newer per-instance draft with patch log
  ├── theme_draft_patches            append-only patch log per draft (op=replace, seq++)
  ├── theme_releases                 immutable release rows (release_config snapshot, is_current)
  ├── theme_preview_sessions         signed preview tokens (ttl_seconds, token_hash)
  ├── theme_packages                 portable bundle package registry
  ├── theme_package_versions         versioned bundles (release_status: draft/published/deprecated)
  ├── theme_schema_manifests         section_schemas, block_schemas, settings_schema per version
  └── theme_renderer_manifests       approved_renderer_keys, asset_manifest per version

RENDERER (apps/storefront-runtime — Next.js ISR)
  │
  │  GET /store/:subdomain  (page.tsx, revalidate=60)
  │     composeStorefrontRuntimeProjection()
  │       loadStore()  → StoreService.getStoreBySubdomain() → DB read (sites row)
  │       loadTemplate() → store.templateConfig  (already in sites row, no extra DB call)
  │
  │  resolveStorefrontTemplate(store, route)
  │     → checks for liquidBundle in templateConfig.releaseManifest
  │       YES → LiquidThemePackageBundleSchema.parse() → coerceLiquidTemplate()
  │             → sections from bundle.templates[templateKey].sections (ordered by block_order)
  │             → rendererKey = `liquid.section.${type}`
  │       NO  → reads store.templateConfig.templates[templateKey] (portable JSON-contract)
  │             OR falls back to store.templateConfig.sections[] (legacy flat list)
  │             → rendererKey = whatever was embedded in the SectionModel
  │
  │  buildSectionDataPlan()
  │     → for sections with type in {productGrid, featuredProducts}: fetches products from API
  │
  │  <StorefrontCompositionEngine> renders sections by dispatching on rendererKey string
```

---

## SECTION/BLOCK MODEL — DETAILED FINDINGS

### The Static Registry (packages/theme-engine/src/theme-registry.ts)

**File:** `packages/theme-engine/src/theme-registry.ts`
**Lines 419-432:** `SECTION_SCHEMAS: Record<string, SectionSchema>` — a closed static export containing exactly **12 named sections**: `announcementBar, heroBanner, featuredProducts, productGrid, categoryGrid, brandMarquee, testimonials, trustBadges, newsletter, appBlockSlot, header, footer`.

Each section carries:
- `type` (string key, matches registry key)
- `description`
- `defaults: Record<string, unknown>`
- `presets: Array<{ name, settings }>`
- `settings_schema: Record<string, SchemaField>` — drives the editor settings panel
- `blocks_schema?: Record<string, BlockSchema>` — optional per-section block types

**SchemaField** (lines 12-24) supports 11 field types: `text | textarea | richtext | color | image | select | toggle | range | number | url | radio`. This is a genuine schema, not ad hoc.

**Built-in section types** are also enumerated in `src/index.ts` lines 17-41 as `BuiltInSectionType`:

```
'header' | 'announcementBar' | 'heroBanner' | 'productGrid' | 'footer' |
'featuredProducts' | 'testimonials' | 'aboutSection' | 'collectionFilter' |
'newsletter' | 'contentPage' | 'instagramFeed' | 'faqAccordion' | 'videoHero' |
'trustBadges' | 'appBlockSlot' | 'categoryGrid' | 'brandMarquee' |
'portfolioGrid' | 'servicesGrid' | 'skillsSection' | 'experienceTimeline' |
'contactForm' | 'ctaSection'
```

**Gap:** 12 sections are registered in `SECTION_SCHEMAS` but 24 types are declared in `BuiltInSectionType`. 12 types have no schema (e.g., `aboutSection, collectionFilter, instagramFeed, faqAccordion, videoHero, contentPage, portfolioGrid, servicesGrid, skillsSection, experienceTimeline, contactForm, ctaSection`). These types can appear in a template config and pass type-check but would fail `validateThemeSection` validation (`"type is not registered for this theme"`).

### The Template JSON Shape

`StorefrontThemeTemplateConfig` (theme-registry.ts lines 70-78) and `StoreTemplateConfig` (index.ts lines 112-128):

```
{
  themeId: string,
  themeSettings: ThemeSettings,       // global color/font/layout tokens
  sections: SectionModel[],           // legacy flat array (header, footer, template sections mixed)
  sectionGroups?: {                   // newer: header/footer isolation
    header: StorefrontSectionGroupConfig,
    footer: StorefrontSectionGroupConfig,
    ...
  },
  templates?: {                       // portable JSON-contract per-page templates
    index: { sections: { [id]: { type, settings, blocks, block_order } }, order: [] },
    product: { ... },
    ...
  },
  liquidBundle?: LiquidThemePackageBundle  // full portable Liquid bundle (embedded at release time)
}
```

Three coexisting config shapes (legacy flat, portable JSON-contract, Liquid bundle) create drift risk. The `resolveStorefrontTemplate` function in the storefront-runtime handles all three fallback paths.

### The Portable Bundle Format (packages/theme-engine/src/theme-bundle.ts)

This is the most mature piece of the architecture. Two engines:

**JSON-contract engine (`ThemePackageBundleSchema` lines 335-419):** Sections defined as `ThemeBundleSectionDefinitionSchema` (has `renderer_key`, `settings_schema`, `block_types`, `accepts_app_blocks`, `presets`, `enabled_on`). Templates as `ThemeBundleTemplateSchema` (sections map + block_order array). Cross-references validated by Zod superRefine at parse time (missing section definition → error; block type not in allowed list → error).

**Liquid engine (`LiquidThemePackageBundleSchema` lines 429-502):** Full Shopify-style Liquid rendering. Sections are `.liquid` files with embedded `{% schema %} ... {% endschema %}` blocks. Schema validated on parse. Template section references validated against actual `.liquid` files. `@app` block type supported. The `LiquidRenderer` (theme-renderer.ts) actually evaluates Liquid source using `liquidjs` with sandboxed scope (blocked keys, depth limit, memory limit).

**Bundle version string:** `THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract'`, `THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections'` — real versioning exists at the bundle level.

---

## STATE STORAGE — DRAFT/PUBLISH/RELEASE MODEL

Evidence from `theme-execution.adapter.ts`:

| Layer | Table | Shape | Purpose |
|---|---|---|---|
| Draft | `theme_editor_drafts` | `{ store_id, theme_id, template_key, draft_config jsonb, version int }` | Per-(store, theme, template_key) editable draft |
| Instance Draft | `theme_instance_drafts` | `{ theme_instance_id, store_id, working_manifest jsonb, draft_version int, draft_status }` | Newer draft layer with patch log |
| Patch Log | `theme_draft_patches` | `{ draft_id, patch_sequence, patch_type, operation jsonb, value jsonb }` | Append-only JSON-patch log |
| Release | `theme_releases` | `{ store_id, theme_id, release_version, release_config jsonb, template_snapshot jsonb, is_current bool }` | Immutable release rows |
| Live Config | `sites.template_config` | `jsonb blob` | Live published config read by storefront |

**Editing flow is transactional draft→preview→publish** (not direct-mutate):
1. Editor saves draft → `theme_editor_drafts` upserted with `version++`
2. Preview session created → signed token stored (HMAC hash), token valid for configurable TTL (default 900s)
3. Publish → calls `publish_theme_release` DB RPC → creates new `theme_releases` row → updates `sites.template_config` atomically → marks old releases `is_current=false` → evicts storefront cache

**Rollback is supported** (lines 1413-1493 of `theme-execution.adapter.ts`): `POST /themes/:slug/releases/:releaseId/rollback` restores any prior release by re-publishing it as a new release with `rollback_of_release_id` set.

**Conflict detection:** `isStaleThemeEditorBaseVersion` checks `base_version` against current draft version and throws `ConflictError` if stale (multi-session safety, line 225-227).

**Gap:** The `theme_editor_drafts` and `theme_instance_drafts` are two parallel draft representations for the same store config. The instance draft is written after the legacy draft in `saveDraft()` (lines 1207-1215). There is no merge/deduplicate pass. If `theme_instance_drafts` tables are unavailable (detected by `isThemeEngineSchemaUnavailable()`), the code silently falls back — meaning the instance draft table is not reliably populated. This dual-draft system adds complexity without clear benefit.

---

## CENTRALIZED VS FRAGMENTED STATE

### Schema Registry

| Location | What it defines | Consumers |
|---|---|---|
| `packages/theme-engine/src/theme-registry.ts` SECTION_SCHEMAS | 12 built-in section schemas (static, in-package) | ThemeExecutionAdapter validation, editor `schemas.sections`, `getThemeDefaultTemplate()` |
| `theme_schema_manifests` DB table | Uploaded portable bundle section schemas | ThemeExecutionAdapter via `SchemaRegistryExecutionAdapter.resolveThemeRuntime()` |
| `storefront-runtime` renderer | Dispatches on `rendererKey` string | Section React components (the registry lives in the React component map, never imported from theme-engine) |

**Verdict: FRAGMENTED.** The schema that drives the editor panel (served from `theme-engine` package or `theme_schema_manifests` DB) and the renderer that consumes sections (storefront-runtime React component registry) are **completely decoupled**. There is no shared import of `SECTION_SCHEMAS` into the storefront renderer. The renderer only sees `section.type` and `section.rendererKey` strings — there is no runtime enforcement that the renderer key maps to a real component. A valid schema for a new section type can be registered and saved to a store template, and the storefront will silently fail to render it if no matching component exists.

### Editor ↔ Storefront Contract

The shared contract is the `SectionModel` / `StoreTemplateConfig` types from `@letbuyy/theme-engine`. Both the editor API (`loadEditor` → returns `template_config` as `StorefrontThemeTemplateConfig`) and the storefront renderer (`resolveStorefrontTemplate`) consume the same type. This is a genuine cross-surface contract.

However, **section schema field types** (what settings are valid for a given section type) are known only to the API/validation layer. The storefront renderer is agnostic to schemas — it passes `section.settings` as props to the React component, with no runtime schema validation at render time.

---

## MARKETPLACE: THIRD-PARTY THEME INSTALL/VERSION

**Evidence: `schema-registry-execution.adapter.ts` lines 245-434**

A `POST /themes/packages/upload` endpoint receives a `PortableThemePackageBundle`, validates it through `parsePortableThemePackageBundle()` (full Zod validation), and upserts to:
- `themes` table (legacy catalog entry)
- `theme_packages` (canonical package registry)
- `theme_package_versions` (versioned releases with `release_status`)
- `theme_schema_manifests` (section schemas + settings schema per version)
- `theme_renderer_manifests` (renderer keys + asset manifest per version)

**Versioning:** `theme_package_versions` has `version` (semver string) and `version_number` (integer). Multiple versions per package are supported. `release_status: 'draft' | 'published' | 'deprecated' | 'revoked'` is enforced. `compatibility_range` field (`>=2026-05-json-contract`) exists in `ThemeBundlePackageMetadataSchema` (theme-bundle.ts line 319).

**Review workflow:** Upload sets `release_status = 'draft'` if `review_required=true` (marketplace mode). Private installs skip review (`submission_mode: 'private_install'`).

**Schema evolution:** When a theme section schema changes (new version uploaded), old stores that have template configs using prior section settings will **not** be migrated. `resolveRenderableThemeTemplateConfig()` resolves a store's template against the current theme, but does no field-level migration. `collectThemeTemplateValidationIssues()` will catch unknown settings keys (`"${key} is not defined by the ${schema.type} schema"`) at next publish/validate cycle, but existing published stores are not re-validated.

**Gap: No schema migration.** There is no migration runner for `sites.template_config` blobs when a theme's section schema changes. Old stores using deprecated fields silently carry stale config.

---

## EXTENSIBILITY: APP BLOCKS / THEME APP EXTENSIONS

**Evidence:**

1. `packages/app-engine/src/index.ts` lines 276-302 defines:
   - `LETBUYY_APP_MANIFEST_EXTENSION_SURFACES` includes `'theme.app_block'`
   - `LETBUYY_APP_MANIFEST_THEME_TARGETS`: `storefront.home.after-hero | storefront.product.after-form | storefront.collection.after-grid | storefront.footer.before`
   - Renderer: `'liquid_app_block'`

2. `packages/theme-engine/src/theme-registry.ts` lines 302-353: `appBlockSlot` section schema — a first-class section type that exposes a `slot` field and an `app-block` block type with `app_id`, `extension_id`, `render_mode` (inline/iframe), `iframe_url` fields. The sample block is `letbuyy-loyalty / loyalty-rewards-card`.

3. `packages/theme-engine/src/theme-bundle.ts` lines 132-136: `ThemeLiquidAppBlockSchema` with `type: '@app'` — Liquid bundle supports `@app` block type. The `LiquidRenderer` (theme-renderer.ts lines 312-326) handles `@app` blocks by calling `resolveLiquidAppBlockHtml()` which looks up pre-rendered HTML from `liquidAppBlocks` input map.

4. `packages/extension-host/src/index.ts` lines 15-38: `ADMIN_UI_EXTENSION_TARGETS` and `CHECKOUT_UI_EXTENSION_TARGETS` are fully implemented with iframe/web_component normalization. But the extension-host has **no `theme.app_block` surface implementation** — the extension-host only handles `admin.ui` and `checkout.ui` surfaces.

**Verdict: Schema is real; runtime injection is stub.** The data model (manifests, registry records, `appBlockSlot` section, `@app` Liquid block) all exist. But there is no code in `storefront-runtime` that:
- Queries enabled `theme.app_block` extensions for a store at render time
- Pre-renders their content
- Injects it into the `liquidAppBlocks` map before `LiquidRenderer.render()` is called

The `resolveLiquidAppBlockHtml()` function (theme-renderer.ts lines 505-526) returns a `<div data-letbuyy-app-block="...">` placeholder when no pre-rendered HTML is supplied. This is a deferred client-side hydration fallback, not a real server-render.

---

## RENDERING PIPELINE: STOREFRONT-RUNTIME

**File:** `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx`

- **SSR/ISR:** Next.js Server Component with `export const revalidate = 60` — ISR with 60-second stale window. Not pure SSR (each request) nor pure static.
- **DB reads per request:** `StoreService.getStoreBySubdomain(subdomain)` — one DB read. The `templateConfig` is embedded in the `sites` row (JSONB column) so no extra theme config DB read is needed. For preview mode, `StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)` reads the `theme_editor_drafts` (or `theme_instance_drafts`) row.
- **Section data fetching:** `buildSectionDataPlan()` makes API calls for product data for sections with types in `{productGrid, featuredProducts}`. All product-bearing sections on a page share one product fetch (deduplicated by ID).
- **Liquid rendering:** `resolveStorefrontTemplate` detects `liquidBundle` in `store.templateConfig.releaseManifest` — if present, the Liquid path is taken. The `LiquidRenderer` evaluates all section `.liquid` sources server-side.
- **Caching:** `bumpStorefrontCacheVersion()` and `purgeStorefrontCache()` are called on publish (themes.ts lines 542-544). These operate on CF KV keys (`storefront-rest:bootstrap:...`). The storefront-runtime itself uses ISR (Next.js cache).
- **No schema registry lookup at render time** — the renderer only reads `section.type` and `section.rendererKey` from the stored config.

---

## SHOPIFY PARITY TABLE

| Capability | LetBuyy State | Shopify OS2.0 | Gap |
|---|---|---|---|
| Section/Block schema model | Full typed schema (SchemaField, SectionSchema, BlockSchema) | JSON schema in `.liquid` files | Comparable for JSON-contract; Liquid engine adds Shopify-style inline schema |
| Template JSON shape | `StoreTemplateConfig` (sections[], templates{}, sectionGroups{}) | `templates/*.json` with sections map + order array | Comparable; LetBuyy adds sectionGroups and liquidBundle embedding |
| Settings schema | `ThemeSettingsSchema` with groups + fields | `config/settings_schema.json` | Comparable |
| Settings data | `config.settings_data.current` in bundle | `config/settings_data.json` | Comparable |
| Draft/Preview/Publish | Full pipeline: `theme_editor_drafts` → `theme_preview_sessions` (signed) → `theme_releases` (immutable snapshots) | Theme editor draft → preview → publish | Comparable; LetBuyy adds versioned releases + rollback |
| Rollback | `POST /releases/:id/rollback` → new release from snapshot | Theme version history + rollback | Comparable |
| Multi-page templates | `templates.index / product / collection / page / cart / blog` | `templates/*.json` per page type | Comparable |
| Section registry | Static map of 12 sections; 12 more type names exist without schemas | All sections as `.liquid` files, unlimited | Gap: 12 types have no schema; static registry doesn't auto-scale |
| Third-party themes | Portable bundle upload (`theme_packages` + versions + manifests) with versioning + review workflow | Shopify Theme Store, Partner API | Comparable infra; review UX not verified |
| Liquid sections | Full `LiquidRenderer` using `liquidjs` with sandboxed scope + security filters | Shopify Liquid (proprietary engine) | Near-parity on structure; Shopify Liquid engine far richer in filters/objects |
| App blocks | Schema defined (`appBlockSlot`, `@app` block type, `theme.app_block` surface) | Theme App Extensions, `@app` blocks injected into sections | Schema ready; runtime injection NOT implemented |
| Schema migration | None — stale keys trigger validation warnings on next publish | No formal migration (same gap as Shopify) | Both lack migrations; LetBuyy enforces stricter unknown-key errors |
| Lazy-loading / registry scaling | Static in-package map; DB-backed for uploaded bundles | On-disk `.liquid` files | Gap: can't add sections at runtime without code deploy or bundle upload |
| Section/block count limits | 50 sections per template, 50 blocks per section (validation), max serialized 256KB | Shopify: 25 sections/page, 50 blocks/section | Comparable; LetBuyy limits are higher (80 sections for portable) |
| i18n / locales | `ThemeBundleLocaleMap`, `t:` prefix translation resolution, multi-language candidates | `locales/*.json`, `t:` prefix | Comparable |
| Performance budget | `performance_budget` field in renderer manifest (empty in current bundles) | Lighthouse CI gate | Gap: field exists but not enforced |

---

## SCALABILITY VERDICT

**Can it scale to marketplace with thousands of sections?**

**Partially, for uploaded bundles; not at all for built-in sections.**

- Uploaded portable bundles store section schemas in `theme_schema_manifests` and are read per-editor-load, not per-render. This scales.
- Built-in sections are a static TS object imported at startup. Adding a new built-in section requires a code deploy to all services that import `@letbuyy/theme-engine`. This does not scale.
- The storefront renderer dispatches on `rendererKey` strings with no dynamic registry — adding new section renderer components requires a storefront-runtime deploy.
- The `InMemorySectionRegistryRuntime` (execution-runtime.ts lines 204-234) is a Map-backed registry that supports `registerSection()` / `getSection()` — this is a proper registry pattern. But no code in the deployed call path populates this registry from the DB; it is only used in the execution context when an orchestrator is passed to `hydrateAndComposeStorefrontTheme`.

---

## TOP 6 FINDINGS

### F1 — REGISTRY-RENDERER DECOUPLING (HIGH)
**Claim:** The section schema registry (editor panel) and the storefront React renderer are entirely decoupled — a section type can have a valid schema and be saved to a store config, yet render nothing if no matching React component exists.
**Evidence:** `packages/theme-engine/src/theme-registry.ts:419-432` (registry) never imported in storefront-runtime. `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:1-256` — resolver passes `section.rendererKey` string through with no validation against any registry. `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:63-81` — `StorefrontCompositionEngine` receives `plan` with no schema enforcement.
**Severity:** HIGH — invisible rendering failures possible for new section types; no observable error surface.

### F2 — APP-BLOCK INJECTION NOT IMPLEMENTED (HIGH)
**Claim:** The `theme.app_block` surface, `appBlockSlot` section type, and `@app` Liquid block type are schema-registered and manifest-defined, but no storefront-runtime code path fetches enabled app-block extensions and injects them at render time.
**Evidence:** `packages/app-engine/src/index.ts:276-302` (surface/target constants). `packages/theme-engine/src/theme-registry.ts:302-353` (appBlockSlot schema). `packages/theme-engine/src/theme-renderer.ts:505-526` `resolveLiquidAppBlockHtml()` returns placeholder `<div data-letbuyy-app-block>` when `liquidAppBlocks` map is empty. `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx` — no extension lookup call.
**Severity:** HIGH — app-block monetization and ISV integration is non-functional.

### F3 — DUAL DRAFT SYSTEM / SHADOW TABLE RISK (MEDIUM)
**Claim:** Two parallel draft storage systems coexist — `theme_editor_drafts` (legacy) and `theme_instance_drafts` + `theme_draft_patches` (newer). The newer system is silently skipped when its tables are unavailable. Both may diverge if only one write succeeds.
**Evidence:** `services/api-gateway/src/execution/theme-execution.adapter.ts:1190-1215` — `saveEditorDraftRecord()` (legacy) then `saveInstanceDraftSnapshot()` (newer), with separate error paths. Lines 433-436, 468: `if (isThemeEngineSchemaUnavailable(error)) return null` — silent no-op.
**Severity:** MEDIUM — data integrity risk in multi-table write; silent failure obscures which draft is authoritative.

### F4 — 12 BUILT-IN TYPES WITHOUT SCHEMAS (MEDIUM)
**Claim:** 24 `BuiltInSectionType` values are declared but only 12 have entries in `SECTION_SCHEMAS`. Sections like `aboutSection`, `instagramFeed`, `faqAccordion`, `videoHero`, `portfolioGrid`, `servicesGrid`, `skillsSection`, `experienceTimeline`, `contactForm`, `ctaSection`, `collectionFilter`, `contentPage` pass TypeScript type checks but fail schema validation in `validateThemeSection()`.
**Evidence:** `packages/theme-engine/src/index.ts:17-41` (24 types declared). `packages/theme-engine/src/theme-registry.ts:419-432` (12 registered). `packages/theme-engine/src/index.ts:479-480`: `if (!schema) { issues.push(\`type "${type}" is not registered\`) }`.
**Severity:** MEDIUM — merchant templates using these section types cannot be published without validation errors; silently broken storefront sections if bypass.

### F5 — NO SCHEMA MIGRATION FOR TEMPLATE CONFIGS (MEDIUM)
**Claim:** When a theme's section schema changes (new version uploaded), existing published stores continue serving `sites.template_config` blobs using old field names/values. There is no migration pass, no schema version watermark per-section in the stored config, and no alerting.
**Evidence:** `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:436-485` `resolveThemeRuntime()` reads the newest published version's schema manifest — it does not trigger any migration of existing store configs. `packages/theme-engine/src/index.ts:695-732` `collectThemeTemplateValidationIssues()` catches `"${key} is not defined"` errors but these only surface at next save/publish attempt.
**Severity:** MEDIUM — schema-breaking changes silently corrupt existing store templates at publish time.

### F6 — STATIC REGISTRY CANNOT SCALE WITHOUT DEPLOY (LOW-MEDIUM)
**Claim:** Adding new built-in sections requires modifying `theme-registry.ts` (a TypeScript source file) and deploying all services that import `@letbuyy/theme-engine`. The `InMemorySectionRegistryRuntime` pattern exists but is not populated from the DB at request time.
**Evidence:** `packages/theme-engine/src/execution-runtime.ts:204-234` — `InMemorySectionRegistryRuntime` is a Map with `registerSection()`, but nothing populates it at storefront request time. `packages/theme-engine/src/theme-registry.ts:497-499`: `getSectionSchemas(_themeId)` ignores `themeId` and returns the static constant: `return SECTION_SCHEMAS`.
**Severity:** LOW-MEDIUM — architectural ceiling, not an immediate production bug; uploaded bundles use DB-backed schemas and are not affected.

---

## THEME EDITOR SCORE: 62/100

| Dimension | Score | Justification |
|---|---|---|
| Section/Block Model | 16/20 | Real typed schema, real block model, presets, 11 field types — but 12 of 24 built-in types lack schemas |
| State Storage & Transaction | 17/20 | Full draft→preview→publish→rollback with immutable releases, conflict detection, signed preview tokens — penalized for dual-draft system |
| Schema Centralization | 10/20 | Editor and renderer share the `SectionModel` type contract, but schema registry and renderer component registry are completely decoupled; fragmentation is structural |
| Marketplace / Versioning | 12/15 | Portable bundle upload with versioning, review workflow, pricing, rollback, schema manifests — review UX and schema migration absent |
| App Extension System | 4/15 | Full schema+manifest design for `theme.app_block` surface; runtime injection is a stub returning placeholder HTML |
| Rendering / Performance | 3/10 | ISR at 60s, KV cache invalidation on publish, single DB read per render — but no schema validation at render time, no in-process caching, Liquid runtime is un-benchmarked |

**Final: 62/100**

The architecture is genuinely well-conceived and substantially built — it surpasses what most early-stage commerce SaaS platforms ship. The score is held down by the schema-renderer decoupling (structural, high effort to fix), the app-block injection stub (medium effort), and the dual-draft system complexity. The portable Liquid bundle engine is a standout feature that approaches Shopify's extensibility model.
