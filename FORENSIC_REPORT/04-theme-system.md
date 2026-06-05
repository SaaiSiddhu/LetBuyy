# Theme System Investigation Report

## Architecture overview

LetBuyy implements a section/block theme model conceptually parallel to Shopify Online Store 2.0, with two render paths: a JSON-contract path (sections rendered by first-party React components) and a Liquid path (portable theme bundles rendered via liquidjs). Storage, drafts, releases and rollback are real and database-backed.

## Components & ownership

| Concern | Location | Reality |
|---------|----------|---------|
| Contracts & validation | `packages/theme-engine/src/index.ts` (531 lines): `SectionModel` (id/type/order/rendererKey/settings/blocks/isVisible), `BlockModel`, `ThemeSettings`, `StoreTemplateConfig` (themeId, releaseId, themeSettings, sections, sectionGroups, `templates: Record<string,…>` per-page, liquidBundle, appBlocks); validators `validateSafeThemeJson`, `validateThemeSectionSettings`, `collectThemeTemplateValidationIssues` (694–731) | Real |
| Renderers | `theme-renderer.ts`: `JsonContractThemeRenderer` (82–102), `LiquidRenderer` (104–211, liquidjs 10.27.0), `createThemeRenderer('liquid')` | Real |
| Schema registry | `theme-registry.ts` (`SECTION_SCHEMAS`, settings groups) | Real |
| Portable bundles | `theme-bundle.ts` (96–250): `ThemeLiquidSourceSchema`, section/block schemas, bundle validation | Real |
| Editor APIs | `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor{,/draft}/route.ts`; releases + `releases/[releaseId]/rollback`; preview-session; sections reorder | Real |
| Preview | `apps/storefront-runtime/src/app/preview/page.tsx` + `storefront-preview-bridge.tsx` postMessage protocol (`letbuyy:theme-editor:section-selected`, `…:section-scroll`, `…:viewport`, `…:ready` + legacy `LETBUYY_THEME_EDITOR_SELECTION`); `editor-preview-section-frame.tsx` wraps sections with `data-letbuyy-editor-section-*` | Real |
| Storage | Supabase: catalog `themes`, `store_themes` (FK `sites(id)`, `config_overrides` JSONB); advanced set: `theme_packages`, `theme_package_versions`, `theme_renderer_manifests`, `theme_schema_manifests`, `theme_instances`, `theme_releases`, `theme_drafts`/`theme_editor_drafts`/`theme_instance_drafts`/`theme_draft_patches`, `theme_presets`, `theme_preview_sessions`, `theme_purchases`, `theme_reviews`, `theme_assets`, `theme_layouts`, `theme_templates`, `theme_template_assignments`, `theme_section_definitions`, `theme_block_definitions`, `theme_migrations` (~50 tables) | Real |
| Marketplace | `apps/theme-marketplace` + merchant `/api/themes/install` (supports `uploadPackage({bundle, submission_mode:'private_install'})`) | Real |
| Seed/demo | `database/supabase/seeds/urban-kicks-theme.sql` (renderer manifest mapping `header→core.header`, `heroBanner→core.hero`, …, performance_budget) **and** hardcoded `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` | Dual — violation below |

## Editor → preview → publish flow (traced)

1. GET editor payload: store, theme, templateConfig, draftConfig, release, sectionSchemas, themeSettingsSchema, version (`editor/route.ts:31-41`).
2. Autosave POST draft → `saveDraft()` → DB (`draft/route.ts:40`); DELETE discards. No conflict/merge logic for concurrent editors.
3. Preview: storefront `/preview` extracts draft settings from query, `applyDraftThemeSettings()` merges into store model, renders via `StorefrontCompositionEngine` with `editorMode` → sections wrapped in selection frames, postMessage bridge to editor.
4. Publish PUT: `saveDraft` then `api.themes.publish(themeId,{store_id, make_store_live:true})` → returns release (`editor/route.ts:83-92`). **Draft → live in one step**; no preview-publish stage, no approval gate.

## Violations (theme-specific)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| T-1 | **Critical** | Section component registry hardcoded in storefront app — all renderable section types are static imports (`HeroSection`, `ProductGrid`, `TestimonialsSection`, `AboutSection`, `NewsletterSection`, `FeaturedProducts`, `PortfolioGrid`, …10+); `RUNTIME_SECTION_SCHEMAS` re-declared in app code. Themes/apps cannot introduce section types without a storefront deploy. | `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:1-100` |
| T-2 | High | Demo theme bypasses the pipeline: `getStoreBySubdomain` returns `getUrbanKicksDemoStore()` fixture before any DB/theme lookup; demo content updates require code release; the same theme also exists as a DB seed → two divergent sources. | `store-service.ts:54-57`; `demo/urban-kicks-demo.ts` |
| T-3 | High | One-step publish to live (`make_store_live:true`). | `editor/route.ts:83-92` |
| T-4 | Medium | Preview render path ≠ production path: preview always uses the React JSON-contract path with editor frames; Liquid-bundle themes render via `createThemeRenderer('liquid')` in production (`composition-engine.tsx:163`) — editor fidelity gap for Liquid themes. | `preview/page.tsx:347-352`; `composition-engine.tsx` |
| T-5 | Medium | Schema triplication: theme-engine `SECTION_SCHEMAS` vs storefront `RUNTIME_SECTION_SCHEMAS` vs merchant `theme-schemas.ts` (the latter re-exports, the storefront copy does not — drift risk lives there). | paths above |
| T-6 | Low | `PortfolioGrid` ships as a storefront section type — legacy product leaking into the theme vocabulary. | `renderer-registry.tsx` import list |
| T-7 | Low | Theme purchase coupled to Razorpay assumptions (INR-only platform billing). | `tenant-core` rzp regex; `app_billing_charges.currency` INR |

## Shopify OS 2.0 feature presence (evidence-based)

| Capability | LetBuyy | Evidence |
|------------|---------|----------|
| JSON templates per page | YES | `StoreTemplateConfig.templates` record |
| Section groups (header/footer) | YES | `sectionGroups` + `template-resolver.ts:39-62` fallback by type |
| Blocks within sections | YES | `BlockModel`, nested `section.blocks` |
| App blocks in themes | PARTIAL | `appBlocks` field + `app-block-slot.tsx`, but no registry auto-surfacing (see Apps report H-2) |
| settings_schema equivalent | YES | `ThemeSettingsSchema`/`SchemaField` (JSON, not `{% schema %}`) |
| Versioned releases + rollback | YES | `theme_releases`, rollback route |
| Drafts | YES | `theme_drafts` + autosave |
| Liquid rendering | YES | liquidjs `LiquidRenderer` |
| Theme CLI (`theme dev/push/pull`) | **NO** | no bin/CLI package anywhere |
| Theme-check linting | **NO** | runtime validators only |
| Preset switching UI | NO | presets in schema, no merchant UI |
| Locale-aware templates | NO | no `templates/[locale]` support found |
| Theme asset CDN versioning | NO | `asset_manifest` field exists, no versioning logic found |
