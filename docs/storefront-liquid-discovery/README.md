# Storefront Liquid Discovery — Index

**Mission statement:** This document set is a DISCOVERY-ONLY body of work produced to prepare for a zero-regression React-to-Liquid migration on the LetBuyy storefront. No code was changed, no configuration was toggled, and no migration steps were executed. Every finding is a read-only observation from branch `stepup/main` as of 2026-07-03. The Architecture Review Board must approve any subsequent implementation work.

**Date produced:** 2026-07-03  
**Branch:** `stepup/main`  
**Status:** DISCOVERY COMPLETE — no implementation implied or prescribed

---

## Document Index

| # | Document | One-line abstract | Key risk level |
|---|----------|-------------------|----------------|
| 01 | [01_REPOSITORY_DISCOVERY.md](01_REPOSITORY_DISCOVERY.md) | Full inventory of every Liquid-relevant file across `packages/theme-engine` and `apps/storefront-runtime`, with line-count and role for each source file | MEDIUM |
| 02 | [02_LIQUID_PLATFORM_DISCOVERY.md](02_LIQUID_PLATFORM_DISCOVERY.md) | Deep inventory of the LiquidJS runtime (v10.27.0), sanitizer (DOMPurify v3.4.9), custom filters, drop security limits, and the `buildLiquidScope()` scope-assembly chain | HIGH |
| 03 | [03_STOREFRONT_DISCOVERY.md](03_STOREFRONT_DISCOVERY.md) | Authoritative reconciliation of the dual-engine storefront: React/JSON-contract default vs. Liquid canary path, ISR config, multi-tenant middleware, and the 17 `StorefrontRouteType` values | HIGH |
| 04 | [04_REACT_DEPENDENCY_MAP.md](04_REACT_DEPENDENCY_MAP.md) | Dependency map of all React components in the storefront rendering pipeline, identifying which have Liquid parity and which are React-only blockers for migration | HIGH |
| 05 | [05_THEME_EDITOR_DISCOVERY.md](05_THEME_EDITOR_DISCOVERY.md) | Theme Editor architecture audit: live/preview modes, postMessage protocol (confirmed mismatched event strings between CenterPanel and the preview frame), schema migration engine state | HIGH |
| 06 | [06_PRESET_LIBRARY_DISCOVERY.md](06_PRESET_LIBRARY_DISCOVERY.md) | Preset and Experience library: 10 named Experiences, `EXPERIENCE_REGISTRY`, `FALLBACK_EXPERIENCE_ID = 'summit'`, industry-experience map, font registry (4 fonts not wired), and the apply/overlay pipeline | MEDIUM |
| 07 | [07_RENDER_PIPELINE_DISCOVERY.md](07_RENDER_PIPELINE_DISCOVERY.md) | End-to-end rendering pipeline: template-resolver engine decision, composition-engine SSR path, 21 `SECTION_RENDERER_DEFINITIONS`, Liquid vs. React branch coverage table | HIGH |
| 08 | [08_DYNAMIC_SOURCE_DISCOVERY.md](08_DYNAMIC_SOURCE_DISCOVERY.md) | Dynamic source and data-binding audit: `data-binding-engine.ts` section data plans, Supabase data contracts, `StoreModel` hydration, and 23 renderer-key registrations | MEDIUM |
| 09 | [09_THEME_SCHEMA_DISCOVERY.md](09_THEME_SCHEMA_DISCOVERY.md) | Schema registry deep-dive: `SECTION_SCHEMAS` (12 base), `ADDITIONAL_BUILT_IN_SECTION_SCHEMAS` (13), `BUILT_IN_SECTION_TYPES` (25 total), Zod validation, and known schema divergences between Liquid and JSON-contract paths | HIGH |
| 10 | [10_ASSET_PIPELINE_DISCOVERY.md](10_ASSET_PIPELINE_DISCOVERY.md) | Asset pipeline and settings scope: `buildGoogleFontsHref()` implementation with no call site, `settings` Liquid object present-but-partial via `buildLiquidScope()`, and 5-group TypeScript schema vs. DB `appearance` group divergence | HIGH |
| 11 | [11_GAP_ANALYSIS.md](11_GAP_ANALYSIS.md) | Consolidated gap analysis across all 10 prior domains: 4 HIGH gaps, 5 MEDIUM gaps, 3 LOW gaps, covering font loading, `newsletter`/`newsletter-signup` type split, postMessage mismatch, zero concrete schema migrations, and `linklists` drop absence | CRITICAL |
| 12 | [12_MASTER_LIQUID_MIGRATION_PLAN.md](12_MASTER_LIQUID_MIGRATION_PLAN.md) | Master migration readiness plan (planning only): overall ~55% Liquid platform readiness, phased pre-conditions, risk register, and ARB go/no-go gate criteria | CRITICAL |

---

## Executive Summary (15 lines)

1. The LetBuyy storefront is a dual-engine hybrid: React/JSON-contract is the production default; LiquidJS is a canary gated behind `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` in `packages/theme-engine/src/theme-governance.ts:14`.
2. Urban Kicks (DB slug `urban-kicks`, TypeScript alias `letbuyy-core`) is the only first-party Liquid theme and the sole tenant with the Liquid engine active, enabled by migration 180.
3. The LiquidJS engine (v10.27.0) is structurally sound: `outputEscape:'escape'`, `strictFilters:true`, DOMPurify v3.4.9 server-side sanitizer, drop depth/key limits, and 6 custom commerce filters are all in place.
4. The schema registry has 12 base section schemas (`SECTION_SCHEMAS` in `theme-registry.ts`), 13 additional schemas (`ADDITIONAL_BUILT_IN_SECTION_SCHEMAS` in `built-in-section-schemas.ts`), and 25 declared `BUILT_IN_SECTION_TYPES` in total.
5. The Liquid bundle (`createLiquidParitySectionFiles()`) generates 23 sections; the React renderer registry (`SECTION_RENDERER_DEFINITIONS`) has 21 entries; ART-17 parity (`THEME_LIQUID_PORTABLE_SECTION_PARITY`) covers 20 sections — these three counts measure different things and are not interchangeable.
6. The `settings` Liquid object is PRESENT but PARTIAL: `buildLiquidScope()` passes `bundle.config.settings_data.current` correctly, but the TypeScript 5-group schema structure diverges from the DB flat `appearance` group introduced by migrations 180–181, meaning merchant-configured values may not resolve under expected key paths.
7. The Theme Editor postMessage protocol is broken: `CenterPanel` emits `LETBUYY_THEME_EDITOR_SELECTION` but the preview frame listens for `letbuyy:theme-editor:section-selected`; live editor section selection does not work end-to-end.
8. The schema migration engine (`ThemeSectionSchemaMigration` interface + `migrateThemeTemplateSchemas()`) is implemented but has zero concrete migrations registered; any field rename in a section schema will silently break stored merchant configurations.
9. Font loading is half-wired: `buildGoogleFontsHref()` is implemented in `experience-fonts.ts` but has no call site in the storefront `<head>`, so 4 of 10 Experiences (Aura, Craft, Dawn, Sense) render with system-font fallbacks.
10. The `newsletter`/`newsletter-signup` type split is a HIGH-risk production bug: the JSON-contract path registers sections as `newsletter`; the Liquid bundle uses `newsletter-signup`; stores with Liquid active will silently fail to render newsletter sections.
11. Navigation data (`linklists`) is absent from `buildLiquidScope()`: `StoreModel.navigation` is never passed to the Liquid scope, so any Liquid template referencing `linklists` will produce empty output.
12. 5 section types (`collectionFilter`, `contentPage`, `videoHero`, `faqAccordion`, `instagramFeed`) have no Liquid parity entry in `THEME_LIQUID_PORTABLE_SECTION_PARITY`; stores using these sections will produce no output under the Liquid engine.
13. The `letbuyy-core` DB row is missing: `theme-bundle-core.ts` redirects slugs in TypeScript, but any DB query for `theme_id = 'letbuyy-core'` returns 0 rows, causing silent failures for code using `LETBUYY_CORE_THEME_SLUG` as a DB key.
14. Overall Liquid platform readiness is approximately 55%; the platform foundation (security model, drop system, Zod schemas, ISR) is solid, but merchant-facing completeness (fonts, navigation, newsletter, editor live-selection, schema migrations) requires dedicated remediation work before a platform-wide canary flip.
15. An ARB gate (`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`) guards the global `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` flip; the 7 identified gaps (postMessage mismatch, newsletter type split, font injection, linklists drop, schema migration engine, `letbuyy-core` DB row, key-path divergence in `settings`) must be resolved and certified before that gate is removed.
