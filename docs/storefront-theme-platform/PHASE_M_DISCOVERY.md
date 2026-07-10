# Phase M Discovery — Theme + Editor + Persistence + Storefront + Security

**Date:** 2026-07-10
**Branch:** stepup/main
**Phases covered:** A–L shipped. This document inventories the state of every
sub-domain as M begins, and maps the specific gaps M→AE must close.

All paths are repo-relative. Status values: `COMPLETE` | `PARTIAL` | `MISSING` |
`FROZEN` | `NOT_CONNECTED` | `STUB`.

---

## 1. Domain: theme-engine (`packages/theme-engine/src/`)

### 1.1 Component Inventory

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| ThemeBundle schema model (JSON-contract + Liquid bundles) | `theme-bundle.ts` | COMPLETE | Full Zod schemas for both bundle variants; `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS = ['2026-06-liquid-sections']`; **23** Liquid section files via `createLiquidParitySectionFiles()` (lines 822–1232; 23 `createLiquidSectionFile` entries including `header`, `footer`, `testimonials`, `marquee` — verified by grep, not 22 as earlier docs stated); `UnsupportedLiquidBundleSchemaVersionError` fail-closed |
| LetBuyy Core alias layer (urban-kicks → letbuyy-core) | `theme-bundle-core.ts` | PARTIAL | `resolveCanonicalThemeSlug` and `createLetbuyyCoreLiquidThemeBundleFixture()` exist; DB migration 188 committed (40741cb8); create-store path still assigns `slug='urban-kicks'` (file:20-22 deferred comment) |
| Theme section/settings registry | `theme-registry.ts` | FROZEN | 12 named `SectionSchema` objects + `THEME_SETTINGS_SCHEMA` (5 groups); `getSectionSchemas()` / `getThemeSettingsSchema()` static pass-throughs; **FROZEN per ART-17** — new sections go to `built-in-section-schemas.ts` |
| 25-type built-in section catalog | `built-in-section-schemas.ts` | COMPLETE | `BUILT_IN_SECTION_TYPES` const tuple of 25 types; `BUILT_IN_SECTION_SCHEMAS` merges 12 frozen + 13 new; `collectBuiltInSectionSchemaGaps()` validates coverage; 4 types lack Liquid section files (see gaps) |
| Section schema migration engine + registry | `section-schema-migrations.ts` | PARTIAL | `REGISTERED_SECTION_SCHEMA_MIGRATIONS = Object.freeze([])` (line 33) intentionally empty; `CURRENT_SECTION_SCHEMA_VERSION = '2026-07-sections-v1'`; engine fully wired; every stored section is `'unversioned'` |
| 10 Experience definitions + preset engine | `theme-presets.ts` | COMPLETE | `EXPERIENCE_REGISTRY`: forge/sense/aura/craft/refresh/ride/dawn/bloom/nova/summit; `buildExperienceSettingsOverlay()`, `applyExperienceToSettingsData()` (G6 validate); `ExperienceSettingsOverlaySchema.parse()` validates overlay; non-system fonts render system fallbacks until font injection is wired |
| Industry → Experience mapping | `industry-experience-map.ts` | COMPLETE | `INDUSTRY_EXPERIENCE_MAP` (9 keys); `INDUSTRY_ALIASES` (~20 synonyms); `resolveExperienceForIndustry()` with `source` annotation; `FALLBACK_EXPERIENCE_ID = 'summit'` |
| Experience font system | `experience-fonts.ts` | PARTIAL | `EXPERIENCE_FONT_REGISTRY` (6 families), `buildGoogleFontsHref()`; `<link rel=stylesheet>` injection into Liquid head and React `layout.tsx` **NOT IMPLEMENTED**; Playfair Display/Cormorant Garamond/Libre Baskerville render system-ui fallback |
| LiquidRenderer + JsonContractRenderer + DOMPurify sanitizer | `theme-renderer.ts` | COMPLETE | Full pipeline: bundle parse + G4 gate, parallel section rendering (F2), per-section try-catch (C1), layout chrome, whole-document sanitization; `LIQUID_THEME_BASE_CSS` (20 selectors); `LIQUID_THEME_TOKEN_MAP` (8 CSS vars); 5 custom Liquid filters; `toLiquidDrop` depth=4/keys=80/array=100; `BLOCKED_DROP_KEYS` (line 883) |
| Theme governance (canary flag, parity, audit, migration engine) | `theme-governance.ts` | COMPLETE | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (line 14); flip authority = ARB (line 20); `THEME_LIQUID_PORTABLE_SECTION_PARITY` (20 React↔Liquid pairs); `auditThemeRendererRegistry()`; `migrateThemeTemplateSchemas()` (loop-detection, max 20 steps, never throws) |
| Storefront composition runtime + types | `execution-runtime.ts` | COMPLETE | `ThemeEngineRenderContext`, `SectionModel`, `BlockModel`, `StoreTemplateConfig`, `StorefrontTemplateConfig`, `ThemeHydrationManifest`; `composeStorefrontTheme()`; shared contract between theme-engine and storefront-runtime |
| Portable JSON→Liquid compiler | `portable-to-liquid.ts` | COMPLETE | `compilePortableToLiquidBundle()` with type overrides; output re-validated; merchant settings escaped at output by `outputEscape:'escape'`; unresolvable types produce warning and are skipped |
| Settings schema canonicalization | `settings-schema-canonical.ts` | COMPLETE | `flattenSettingsData()` / `groupSettingsFields()` lossless round-trip; `CANONICAL_FIELD_GROUP_INDEX` derived from frozen `THEME_SETTINGS_SCHEMA`; `CANONICAL_UNMAPPED_GROUP = 'appearance'` (matches migrations 180-181) |
| Editor ↔ preview postMessage protocol constants | `editor-bridge-protocol.ts` | COMPLETE | 7 exported const strings: `EDITOR_LEGACY_SELECTION_MESSAGE`, `EDITOR_SELECTION_MESSAGE`, `EDITOR_SECTION_SELECT_MESSAGE`, `EDITOR_READY_MESSAGE`, `EDITOR_SCROLL_MESSAGE`, `EDITOR_VIEWPORT_MESSAGE`, `EDITOR_LEGACY_VIEWPORT_MESSAGE` |
| Theme SDK public facade | `theme-sdk.ts` | COMPLETE | `validateTheme`, `compileTheme`, `lintTheme`, `renderPreview`, `listSectionTypes`, `getSectionSchema`; all delegate to real internals; zero stub logic |
| Theme linter (5 rules) | `theme-linter.ts` | COMPLETE | `unknown-section-type`, `forbidden-tag`, `forbidden-attr`, `missing-schema-block`, `setting-referenced-not-in-schema`; deny lists from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` (single source of truth) |
| Theme artifact exporter | `theme-artifact-exporter.ts` | COMPLETE | `exportThemeBundleToFiles()` deterministic sorted file list mirroring Liquid theme directory; `UnsafeThemeArtifactPathError` for `..` traversal |
| SHA-256 package manifest builder | `theme-packager.ts` | COMPLETE | Per-file SHA-256 + `contentHash` over sorted checksums; deterministic; used by `buildThemePublishManifest()` |
| Theme CLI | `theme-cli.ts` | COMPLETE | `COMMANDS`: validate/lint/compile/export; stdin or file arg; JSON output; callable via `npx tsx` |
| Schema version comparator + compatibility gate | `theme-version.ts` | COMPLETE | `>=` and `^` operators; `satisfiesSchemaRange()` fail-closed; `isThemeBundleSchemaCompatible()` gates on schema_version AND compatibility_range; one epoch currently |
| Pure theme upgrade planner | `theme-upgrade.ts` | COMPLETE | `planThemeUpgrade()`: schema migrations, settings carryover (5-grouped), section adds/removes, compatible, warnings; never throws |
| 5-stage install validation pipeline | `theme-install.ts` | COMPLETE | `validateThemeInstall()`: Zod → lint → compatibility range → parity gaps → slug coherence; errors-first sort |
| Deterministic publish manifest builder | `theme-publish.ts` | COMPLETE | `buildThemePublishManifest()` → `ThemePublishManifest` with `contentHash`, `provenance`, `lint_issue_count`, `section_count`; pure construction, gateway persists to `theme_package_versions.release_manifest` |
| Theme analytics event types | `theme-analytics.ts` | NOT_CONNECTED | `ThemeInstalledEvent` / `ThemeUpdatedEvent` / `ThemePublishedEvent` / `ThemeRenderEvent` schemas; emission-point doc-comments; `theme-execution.adapter.ts` emits nothing; live metrics unresolvable without telemetry wiring |
| WCAG 2.1 contrast math + palette generator | `ai-color-system.ts` | COMPLETE | `relativeLuminance()` (IEC 61966-2-1), `contrastRatio()`, `meetsWcagAA()`, `meetsWcagAAA()`; `generateColorSystem(seedHex)` 6-color AA-guaranteed palette; NL-seed path requires `THEME_AI_PROVIDER_API_KEY` |
| Deterministic typography pairing selector | `ai-typography.ts` | COMPLETE | 5 `TypographyPairing` entries; `generateTypographyPairing(intent|industry|tone)`; all font families from `EXPERIENCE_FONT_REGISTRY` |
| Deterministic section layout generator | `ai-layout.ts` | COMPLETE | `generateSectionLayout({pageType, industry})`; base sequences for home/product/collection/page; industry overlays; all emitted types in `KNOWN_SECTION_TYPE_SET` |
| Deterministic ThemeBrief→LiquidBundle generator | `ai-theme-generator.ts` | PARTIAL | `generateThemeFromBrief()` pipeline complete and validated; `AiGeneratorThemeBrief` is structured typed input; NL text → `ThemeBrief` seam requires `THEME_AI_PROVIDER_API_KEY` + gateway route (line 13-16: explicitly NOT-CONNECTED) |
| WCAG a11y audit + fix suggestions | `ai-accessibility.ts` | COMPLETE | `analyzeAccessibility()`: contrast-AA, img-alt, form-label, forbidden-attr; `suggestAccessibilityFixes()`: darkenToContrast; all deterministic |
| Bundle analysis + optimizer | `ai-optimizer.ts` | COMPLETE | `analyzeThemeOptimizations()`: lint errors/warnings, unused sections, duplicate types, large Liquid source, empty locale keys, oversized settings; `optimizeThemeBundle()` safe removals |
| Experience selection + segment personalization | `ai-personalization.ts` | PARTIAL | `selectExperienceForMerchant()` priority chain; `applyPersonalizationOverlayToBundle()` with G6 validation; segment decision from live audience data NOT CONNECTED (gateway endpoint does not exist) |
| Merchant AI SDK facade | `theme-ai-sdk.ts` | NOT_CONNECTED | `MODEL_BOUNDARY` constant documents NL→`ThemeBrief` seam; all deterministic primitives re-exported; `THEME_AI_PROVIDER_API_KEY` + gateway route absent; primary value proposition (NL input) unusable |
| Core type definitions barrel | `index.ts` | COMPLETE | `BuiltInSectionType` (25-entry union), `SectionModel`, `BlockModel`, `StoreTemplateConfig`, `ThemeEditorPayload`, `ThemeRelease`, `DEFAULT_THEME_SETTINGS`; 30+ module re-exports |

### 1.2 Gaps M→AE Must Close

1. **4 Liquid section files absent** — `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` are in `BUILT_IN_SECTION_TYPES` and `BUILT_IN_SECTION_SCHEMAS` but absent from `createLiquidParitySectionFiles()` (theme-bundle.ts:822). Liquid-mode renders silently skip these section types. Add Liquid templates or formally mark them React-only.

2. **Font loading integration not connected** — `buildGoogleFontsHref()` exists in `experience-fonts.ts` but no runtime injects the `<link rel=stylesheet>` into the Liquid layout head or React `layout.tsx`. Experiences using non-system fonts (Sense → Playfair Display; Aura → Cormorant Garamond; Craft/Dawn → Libre Baskerville) silently degrade to system-ui. Documented as deferred in `theme-presets.ts:18-21`.

3. **NL→ThemeBrief model boundary** — `generateThemeFromBrief()` and the merchant AI SDK accept only structured `AiGeneratorThemeBrief`. The free-text path requires `THEME_AI_PROVIDER_API_KEY` + a gateway route (`services/api-gateway`) that does not exist. Formally documented at `ai-theme-generator.ts:13-16`.

4. **Section schema migration registry is empty** — `REGISTERED_SECTION_SCHEMA_MIGRATIONS = Object.freeze([])` (section-schema-migrations.ts:33). Engine is wired and correct. If M→AE adds new section settings fields, add backward-compat entries to the registry; all stored sections are currently `'unversioned'`.

5. **letbuyy-core create-store path** — Code alias (migration 188, 40741cb8) is committed, but the create-store execution path still assigns `slug='urban-kicks'`. New stores do not receive the canonical `'letbuyy-core'` slug until that path is updated (theme-bundle-core.ts:20-22).

6. **Theme analytics zero emission** — `ThemeAnalyticsEvent` types defined; `theme-execution.adapter.ts` emits nothing. Active stores using Liquid, render-engine distribution, and GMV attribution are unresolvable without wiring emission calls.

7. **Segment/audience signal for personalization** — `applyPersonalizationOverlay()` accepts a pre-resolved `SegmentTokens`; mechanism to derive the segment from live merchant/visitor data does not exist (ai-personalization.ts:14-18).

8. **banner-carousel / marquee have Liquid files but no JSON-contract schemas** — Both carry `'frozen.*'` renderer keys in `THEME_LIQUID_PORTABLE_SECTION_PARITY` and have Liquid section files, but neither is in `BUILT_IN_SECTION_TYPES` nor has a `SectionSchema`. They are Liquid-only with no editor settings surface.

9. **A/B testing contract missing** — Phase K referenced a K5 A/B testing contract; no `ai-ab-test.ts` or `theme-ab-testing.ts` exists in `packages/theme-engine/src/`.

---

## 2. Domain: merchant-editor (`apps/merchant-control-plane/src/`)

### 2.1 Component Inventory

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| Editor shell (3-panel layout + topbar) | `app/[store]/online-store/themes/[themeId]/editor/page.tsx` | COMPLETE | Left sidebar, center preview, right property panel; topbar with template dropdown, undo/redo, save, publish; Cmd+S / Cmd+Z / Cmd+Shift+Z shortcuts |
| CenterPanel (iframe preview + postMessage bridge) | `components/theme-editor/CenterPanel.tsx` | COMPLETE | 134-line component; iframe at `/preview?subdomain=&editor=1&viewport=&theme_preview_token=`; sends `EDITOR_SELECTION_MESSAGE` to iframe; listens for `EDITOR_SECTION_SELECT_MESSAGE` from storefront; preview-status overlay |
| Preview device viewport switching | `editor/page.tsx:163` | COMPLETE | 3 presets (desktop 1440 / tablet 820 / mobile 390px); `te-preview-frame--{viewport}` CSS class on iframe |
| Section tree (header / template / footer groups) | `editor/page.tsx:1532` | COMPLETE | 3 `TreeGroup` regions; schema name, visibility eye, move-up/down chevrons, remove with `ConfirmDialog`; blocks rendered as children; `EditorSelection` tracks active item |
| Section reorder (up/down arrows) | `editor/page.tsx:1186` | PARTIAL | `moveSection()` array splice by direction; up/down buttons per section; **no drag-and-drop**; one step at a time |
| Section add | `editor/page.tsx:1169` | PARTIAL | `addSection()` appends at end of template array from schema defaults; dropdown + Add button; **no insert-at-position** |
| Section visibility toggle | `editor/page.tsx:1162` | COMPLETE | `toggleSectionVisibility()` flips `section.visible`; eye icon; `te-tree-section--hidden` CSS class; serialized into portable record on draft save |
| Block add (append-only) | `editor/page.tsx:1224` | PARTIAL | "Add [BlockType]" buttons in `PropertyPanel`; `addBlock()` appends to section's blocks array; **no insert-at-position, no block reorder** |
| Block reorder within section | `editor/page.tsx` | MISSING | No `moveBlock()` function. No UI affordance. Blocks frozen in insertion order after creation. |
| Block selection and editing | `editor/page.tsx:1693` | COMPLETE | Click block row → `{kind:'block', sectionId, blockId}` selection; `SchemaFormRenderer` for `blocks_schema.[blockType].fields`; back button; remove with `ConfirmDialog` |
| SchemaFormRenderer (schema-driven field widgets) | `components/theme-editor/SchemaFormRenderer.tsx` | PARTIAL | 454-line component; 11 field types: text, textarea, richtext (→ plain textarea), color, image, select, toggle, range, url, number, radio; **missing: font picker, product/collection/blog picker, video, link/page picker** |
| Image upload in schema form | `components/theme-editor/SchemaFormRenderer.tsx:237` | PARTIAL | `ImageInput`: file upload to `/api/stores/[store]/upload` + URL input; thumbnail + remove; `useToast` feedback; **no media library browser** |
| Theme settings panel | `editor/page.tsx:1710` | COMPLETE | `ThemeSettingsTree` renders one button per group from `settingsSchema.settings`; PropertyPanel renders `SchemaFormRenderer` for group's fields; `updateThemeSetting()` coerces by field type |
| ExperiencePicker | `components/theme-editor/ExperiencePicker.tsx` | COMPLETE | 92 lines; lists all experiences from `listExperiences()`; color swatches, heading font, description; Apply calls `buildExperienceSettingsOverlay()` merged into themeSettings; triggers 900ms debounce |
| Template picker (dropdown in topbar) | `editor/page.tsx:140` | PARTIAL | 6 hardcoded `DEFAULT_TEMPLATE_OPTIONS` (index/product/collection/page/cart/blog) merged with API templates; `<select>` dropdown; `isDirty` guard; **no custom template creation, no duplicate** |
| Draft auto-save with debounce | `editor/page.tsx:940` | COMPLETE | `saveDraft()` POSTs `buildDraftConfig` to `/api/themes/[themeId]/editor/draft`; 900ms debounce via `useEffect`; `baseVersion` optimistic-lock; `savedAt` shown in sidebar |
| Publish to live | `editor/page.tsx:1049` | COMPLETE | `handlePublish()` PUTs to `/api/themes/[themeId]/editor` with `make_store_live:true`; `isDirty` guard + warning toast; updates `currentReleaseVersion`; calls `loadReleases()` |
| Undo / redo history | `editor/page.tsx:914` | COMPLETE | **49-step** past/future `EditorHistory` stack (`applyChange` uses `slice(-49)` at line 768, so past[] holds ≤49 states = 49 undos); `applyChange()` always pushes; Cmd+Z / Cmd+Shift+Z / Cmd+Y; cleared on draft save |
| Version history panel (read-only) | `editor/page.tsx:1738` | PARTIAL | `VersionTree` renders draft version info + release list with `published_at` and current badge; **no rollback button** despite API route existing |
| Theme library page | `app/[store]/online-store/themes/page.tsx` | COMPLETE | Hero card with device mockup; install by slug; JSON import via file picker; toggle published/draft; Duplicate button permanently disabled (line 433) |
| Section schema API route | `app/api/themes/[themeId]/sections/route.ts` | COMPLETE | `GET` proxies to `merchantApiClient.themes.schema(themeId)`; returns sections array + full schemas object |
| Section reorder API route | `app/api/themes/[themeId]/sections/reorder/route.ts` | PARTIAL | `PUT` accepts `sectionOrder` array, re-fetches editor state, rebuilds sections, saves draft; covers section-level only; **not called by editor UI** (editor performs reorder in client state) |
| Release rollback API route | `app/api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` | NOT_CONNECTED | `POST` calls `merchantApiClient.themes.rollbackRelease` with `make_store_live:true`; `VersionTree` in editor shows no rollback button — route is unreachable from merchant UI |
| Preview session API route | `app/api/themes/[themeId]/preview-session/route.ts` | COMPLETE | `POST` creates token-gated preview session (TTL 900s); called by `syncPreviewDraft` after every draft save; token appended to iframe src |
| AI hooks in editor | `editor/page.tsx:1246` | STUB | `applyAiHook(mode)` for `'copy'`, `'layout'`, `'blocks'`; copy sets hardcoded strings; layout sets hardcoded column/height values; no fetch to any AI service; Phase L AI packages not imported in editor page |
| WYSIWYG rich text editor | `components/theme-editor/SchemaFormRenderer.tsx:60` | MISSING | `'richtext'` case returns `TextareaInput` (`<textarea rows=3>`); no Tiptap/ProseMirror/Quill; no inline formatting controls |
| Media library / asset picker | `components/theme-editor/SchemaFormRenderer.tsx` | MISSING | No browseable library; each image field independent upload-or-URL; no video/PDF; no Supabase Storage browser |
| Drag-and-drop reorder | `editor/page.tsx` | MISSING | `GripVertical` icon is decorative only (line 1668); no `dnd-kit` or `react-beautiful-dnd` in `package.json`; both section and block reorder by DnD are absent |
| Code editor | `editor/page.tsx` | MISSING | No Monaco/CodeMirror; no surface for editing raw Liquid or JSON schema in the merchant UI |
| Markets / multi-locale switching | `editor/page.tsx` | MISSING | No locale selector, no per-market content variation, no translation workflow; editor operates on single global template config |
| Preview inspector overlay | `components/theme-editor/CenterPanel.tsx:81` | PARTIAL | `EDITOR_SECTION_SELECT_MESSAGE` listener wired; **no bounding box drawn on iframe, no section label tooltip**; cross-origin preview URLs may block postMessage |
| Global sections as first-class concept | `editor/page.tsx:1557` | PARTIAL | Header/footer in separate pinned `TreeGroup` regions; no explicit global section per Shopify convention; `theme_layouts.section_group_keys` DDL exists but not surfaced in editor |
| Theme duplication | `app/[store]/online-store/themes/page.tsx:433` | MISSING | Duplicate button unconditionally `disabled`; no API route for theme cloning |
| Font picker field type | `editor/page.tsx:253` | MISSING | `'font'` normalizes to `'select'` (line 255); no font preview; `EXPERIENCE_FONT_REGISTRY` not connected to editor |
| Template create / duplicate / delete | `editor/page.tsx` | MISSING | Only 6 built-in template types; no custom template key creation; no template-level duplication or deletion |
| Nested block groups | `editor/page.tsx` | MISSING | Blocks are flat children of a section; no block-within-block nesting |

### 2.2 Gaps M→AE Must Close

1. **Drag-and-drop section reorder** — `GripVertical` is decorative. Need `dnd-kit` (or equivalent) and `moveSection` wired to drag events. Up/down arrows remain as keyboard fallback.

2. **Block reorder within section** — No `moveBlock()` function exists. Full implementation: UI affordance (drag handle or up/down) + `moveBlock()` + delta applied via `applyChange()`.

3. **WYSIWYG rich text editor** — `'richtext'` → `TextareaInput` is a gap for every section/block using rich text content fields (hero body, about content, CTA description). Replace with Tiptap or ProseMirror integration.

4. **Media library / asset picker** — No reuse of uploaded assets across fields. Requires a modal browsing uploaded assets per store (Supabase Storage or gateway-served CDN). `ImageInput` per-field upload is correct but must co-exist with the library picker.

5. **Rollback UI** — `POST /api/themes/[themeId]/releases/[releaseId]/rollback` is implemented. Add a rollback button to `VersionTree` (editor/page.tsx:1738) with a confirm dialog. The API route requires `make_store_live:true` to be explicit.

6. **Connect Phase L AI primitives to editor** — `applyAiHook()` is a stub. Wire `ai-color-system` (palette from merchant brand color), `ai-typography` (pairing selector), `ai-layout` (page-type layout suggestion), `ai-accessibility` (contrast alerts) into the editor UI. Do NOT call the NL model boundary from the editor until `THEME_AI_PROVIDER_API_KEY` + gateway route exist.

7. **Insert section at position** — `addSection()` appends. Most common merchant pattern is to insert a new section between two existing ones. Requires positional insert + a "+" affordance between section rows in `SectionTree`.

8. **Font picker field type** — `'font'` currently degrades to `'select'`. Wire `EXPERIENCE_FONT_REGISTRY` into a font picker widget (font name + live CSS preview using `fontFamilyWithFallback()`).

9. **Template create / duplicate** — The `template_key` column and CHECK constraint exist in `theme_editor_drafts` (migration 087). Surface a "New template" flow in the template picker dropdown.

10. **Preview inspector overlay** — Add a transparent hit-test overlay on the iframe that maps click coordinates to section IDs (requires storefront cooperation via `EDITOR_SECTION_SELECT_MESSAGE`), then draws a bounding box or highlight ring on the selected section.

---

## 3. Domain: persistence-gateway

### 3.1 DB Table Inventory

| Table | Status | Tenant Key | Notes |
|-------|--------|-----------|-------|
| `themes` | COMPLETE | None (global catalog) | 40+ columns incl. `default_template`, `section_schemas`, `block_schemas`, `settings_schema`, `renderer_manifest`, `schema_version`, `renderer_version`; RLS ENABLED; service_role writes only; `renderer_key` column absent from DDL (adapter falls back to `theme.slug` at line 315) |
| `theme_packages` | COMPLETE | None (platform-level) | `slug` (unique), `name`, `status` CHECK `(draft|active|disabled|archived)`, `pricing_type` CHECK `(free|paid|subscription)`; `letbuyy-core` row committed in migration 188 |
| `theme_package_versions` | COMPLETE | None | `version`, `version_number`, `release_status` CHECK `(draft|published|deprecated|revoked)`, `renderer_version`, `schema_version`, `compatibility_range`, `package_manifest`, `checksum`, `published_at` |
| `theme_releases` | COMPLETE | `store_id` → `sites` | `release_version`, `release_status` CHECK `(published|superseded|rolled_back)`, `is_current`, `release_config`, `template_snapshot`, `settings_snapshot`, `asset_manifest`, `release_manifest`, `rollback_of_release_id`; unique `(store_id, release_version)`; partial unique index one-current per store; 3 RLS policies (owner_read / public_current_read / service_all) |
| `theme_editor_drafts` | PARTIAL | `store_id` → `sites` | Baseline lacks `template_key` — added by migration 087 (`ADD COLUMN template_key text NOT NULL DEFAULT 'index'`, unique `(store_id, theme_id, template_key)`); **RLS GAP**: all 4 owner policies join `sites.user_id = auth.uid()` only, missing `custom_user_id` path (not exploitable — gateway is service_role); hard DELETE (no `deleted_at` soft delete) |
| `theme_instance_drafts` | COMPLETE | `store_id` → `sites` | `draft_status` CHECK `(active|archived|published|discarded)`; `locked_by` + `locked_at` columns declared but **never written by any adapter code** (pessimistic locking structurally declared, not implemented); RLS covers both `user_id` + `custom_user_id` |
| `theme_draft_patches` | COMPLETE | `store_id` → `sites` | Append-only patch log; `patch_type` CHECK `(set|unset|insert|move|duplicate|delete|visibility|schema_migration)`; `client_revision` + `server_revision` for OT convergence |
| `theme_instances` | COMPLETE | `store_id` → `sites` | `instance_status` CHECK `(installed|active|inactive|upgrading|archived)`; `active_release_id`, `current_draft_id` FKs; `settings`, `installed_config` JSONB |
| `theme_layouts` | COMPLETE | None (theme-package-level) | `layout_key`, `name`, `layout_schema`, `section_group_keys text[]`; linked to `theme_package_version_id`; not surfaced in editor UI |
| `theme_migrations` | COMPLETE | None (theme-package-level) | `from_theme_package_version_id`, `to_theme_package_version_id`, `migration_manifest`, `rollback_manifest`, `is_reversible`; no adapter writes to this table yet |
| `theme_packages` (presets) → `theme_presets` | COMPLETE | None | `preset_key`, `name`, `preset_config`, `preview_media`, `sort_order`; linked to `theme_package_version_id` |
| `theme_preview_sessions` | COMPLETE | `store_id` → `sites` | `token_hash`, `expires_at`, `revoked_at`, `deleted_at`; three indexes: `idx_theme_preview_sessions_token_active` (token + expiry), `idx_theme_preview_sessions_store`, `idx_theme_preview_sessions_instance_draft`; owner_manage RLS policy; triggered `update_updated_at` |

### 3.2 Gateway Adapter Inventory

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| Theme execution adapter | `services/api-gateway/src/execution/theme-execution.adapter.ts` | COMPLETE | `ThemeExecutionAdapter` class (line 232); `renderer_key` fallback: `theme.renderer_key \|\| theme.slug` (line 315); `renderer_manifest`, `approved_renderer_keys`, `renderer_version` resolved |
| Theme analytics emission | `services/api-gateway/src/execution/theme-execution.adapter.ts` | NOT_CONNECTED | Adapter does not call any `ThemeAnalyticsEvent` emission points defined in `theme-analytics.ts` |
| Rollback route | `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` | NOT_CONNECTED | Route implemented; calls `merchantApiClient.themes.rollbackRelease`; no UI surface to trigger it |

### 3.3 Gaps M→AE Must Close

1. **RLS drift on `theme_editor_drafts`** — Owner policies check `sites.user_id = auth.uid()` only; `custom_user_id` path missing (all other per-tenant theme tables cover both). Not exploitable today (gateway is service_role), but is drift from platform standard. Align with `theme_instance_drafts` pattern.

2. **Pessimistic draft locking not implemented** — `locked_by` + `locked_at` declared on `theme_instance_drafts` but never written. Concurrent editor sessions can overwrite each other silently. Implement lock-acquire / heartbeat / lock-release in the adapter before multi-user editing is advertised.

3. **`renderer_key` column absent from `themes` DDL** — Adapter reads `theme.renderer_key || theme.slug` (line 315). The `renderer_key` column does not exist in the baseline DDL. Currently falls back correctly to slug. Add the column if a multi-renderer rollout requires explicit keying distinct from slug.

4. **Theme analytics not wired** — `theme-execution.adapter.ts` must emit `ThemeInstalledEvent`, `ThemeUpdatedEvent`, `ThemePublishedEvent`, `ThemeRenderEvent` (with `renderer_engine` field) at the documented emission points in `theme-analytics.ts`.

5. **`theme_migrations` table has no adapter** — Table exists for recording schema migration runs between package versions. No adapter code writes to it. If M→AE ships the first section schema migration, this table should record it.

---

## 4. Domain: storefront-runtime (`apps/storefront-runtime/src/`)

### 4.1 Component Inventory

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| Composition engine (React-default + Liquid canary) | `lib/theme-engine/composition-engine.tsx` | COMPLETE | 773-line engine; D1-B Shopify-convention linklists; React default path; Liquid canary path with `lb:canary:render` / `lb:canary:render:fallback` events; falls back to React on Liquid failure (OOM, JSDOM init) |
| Template resolver (Liquid flag resolution) | `lib/theme-engine/template-resolver.ts` | COMPLETE | Calls `resolveThemeLiquidRenderingEnabled()` (line 242); reads `renderer_engine='liquid'` from release manifest, theme settings, then falls through to default-off |
| Section renderer registry (React) | `lib/theme-engine/renderer-registry.tsx` | COMPLETE | `renderRegisteredSection()`; 20 React section components |
| Liquid hydration islands | `lib/theme-engine/liquid-hydration-islands.tsx` | COMPLETE | Islands for interactive React components within Liquid-rendered pages |
| Data binding engine | `lib/theme-engine/data-binding-engine.ts` | COMPLETE | Binds store data (products, collections, navigation) into theme render context |
| Content route | `lib/theme-engine/content-route.ts` | COMPLETE | Page-type routing for content pages |
| Product route | `lib/theme-engine/product-route.ts` | COMPLETE | Product page data loading and section context |
| Editor preview section frame | `lib/theme-engine/editor-preview-section-frame.tsx` | COMPLETE | Wraps sections in preview mode; sends `EDITOR_SECTION_SELECT_MESSAGE` on click; receives `EDITOR_SELECTION_MESSAGE` from editor to drive highlight |
| Storefront preview bridge | `app/preview/storefront-preview-bridge.tsx` | COMPLETE | Listens for `EDITOR_SELECTION_MESSAGE` and `EDITOR_READY_MESSAGE`; sends `EDITOR_READY_MESSAGE` on mount |
| React section components (20) | `components/sections/` | COMPLETE | about-section, app-block-slot, banner-carousel, brand-marquee, category-grid, contact-form, cta-section, experience-timeline, featured-products, hero, marquee, newsletter, portfolio-grid, product-detail-section, product-grid, rich-content-section, services-grid, skills-section, testimonials, trust-badges |

### 4.2 Gaps M→AE Must Close

1. **Font injection not connected** — Composition engine and `layout.tsx` do not inject the `<link rel=stylesheet>` from `buildGoogleFontsHref()`. Experiences using non-system fonts degrade silently. Inject before `</head>` on Liquid-rendered pages and in the React layout head.

2. **Liquid canary is off for all stores** — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (ARB authority). M→AE work must stage canary enablement carefully: (a) validate the 4 missing Liquid section files are added first; (b) add the font injection; (c) propose ARB flip only after those gaps are closed. No production store currently uses Liquid.

3. **collectionFilter / instagramFeed / faqAccordion / videoHero React parity** — These 4 types have JSON-contract schemas but no Liquid section files. If M→AE enables the Liquid canary, pages using these section types will fall back to React islands or render blank. Either add Liquid templates or explicitly route them to React-island rendering within the Liquid pipeline.

4. **Preview inspector bounding box** — `editor-preview-section-frame.tsx` sends `EDITOR_SECTION_SELECT_MESSAGE` on section click but the editor draws no visual highlight. Add CSS class toggling or an overlay paint step in the frame wrapper that responds to `EDITOR_SELECTION_MESSAGE` with a highlight ring.

---

## 5. Domain: security (cross-cutting)

### 5.1 Component Inventory

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| DOMPurify sanitizer config | `packages/theme-engine/src/theme-renderer.ts:143` | COMPLETE | `FORBID_TAGS=['base','embed','object','script']`; `FORBID_ATTR=['style']`; 10 `lb-*` custom element allowances; 30+ `ADD_ATTR` whitelist; `javascript:` / `data:text/html` URL blocking via `uponSanitizeAttribute` hook; `data-*` attribute injection guard |
| Liquid output escaping | `packages/theme-engine/src/theme-renderer.ts:664` | COMPLETE | `outputEscape: 'escape'` — all Liquid variable output is HTML-entity-escaped by default |
| Credential-adjacent key blocklist | `packages/theme-engine/src/theme-renderer.ts:883` | COMPLETE | `BLOCKED_DROP_KEYS`: `__proto__`, `constructor`, `prototype`, `password`, `password_hash`, `access_token`, `refresh_token`, `signing_secret`, `client_secret`, `api_key`, `secret_key`, `private_key`, `webhook_secret` — never exposed to Liquid drop scope |
| `toLiquidDrop` depth / key / array limits | `packages/theme-engine/src/theme-renderer.ts` | COMPLETE | depth=4, keys=80, array=100; prevents store object traversal attacks |
| Path-traversal guard on artifact export | `packages/theme-engine/src/theme-artifact-exporter.ts` | COMPLETE | `UnsafeThemeArtifactPathError` rejects absolute paths and `..` segments |
| Section/block try-catch isolation (C1) | `packages/theme-engine/src/theme-renderer.ts` | COMPLETE | Per-section and per-block try-catch; one failing section does not crash the page |
| G4 canary gate (Liquid rendering gated) | `packages/theme-engine/src/theme-governance.ts` | COMPLETE | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`; flip requires ARB authority |
| RLS on `theme_releases` | `database/supabase/migrations/000_baseline.sql:12849` | COMPLETE | 3 policies: owner_read (`user_id`), `public_current_read` (`is_current=true` + published site), service_all |
| RLS on `theme_editor_drafts` | `database/supabase/migrations/000_baseline.sql:12618` | PARTIAL | 4 owner policies; **missing `custom_user_id` path** — drift from platform standard; not exploitable (gateway is service_role) |
| RLS on `theme_instance_drafts` | `database/supabase/migrations/000_baseline.sql:12637` | COMPLETE | Single `owner_manage` policy covering both `user_id` and `custom_user_id` with `deleted_at IS NULL` guard |
| Preview session token security | `database/supabase/migrations/000_baseline.sql:12791` | COMPLETE | `token_hash` indexed (not token plaintext); `expires_at`; `revoked_at`; `idx_theme_preview_sessions_token_active` partial index |
| Merchant-authored settings isolation | `packages/theme-engine/src/portable-to-liquid.ts` | COMPLETE | Merchant settings values passed as Liquid scope values (escaped at output by `outputEscape:'escape'`); never raw-injected into Liquid source |

### 5.2 Gaps M→AE Must Close

1. **`theme_editor_drafts` RLS `custom_user_id` gap** — Owner policies join `sites.user_id = auth.uid()` only. Platform standard (see `theme_instance_drafts`) checks both `user_id` AND `custom_user_id`. Not exploitable today but must be fixed before any non-service-role path writes to this table.

2. **Pessimistic locking unimplemented** — `locked_by` / `locked_at` declared on `theme_instance_drafts` but never written. If M→AE introduces collaborative or async editing, concurrent overwrites are silent. Implement lock semantics in the gateway adapter before advertising multi-editor support.

3. **WYSIWYG output needs DOMPurify at save** — If M→AE adds a WYSIWYG field (Tiptap / ProseMirror), the HTML value written into `draft_config` must be sanitized server-side at the gateway save path (not only at Liquid render time). Merchant-authored HTML stored in settings values bypasses `LiquidRenderer.sanitizeRenderedHtml()` in the JSON-contract render path.

---

## Phase M→AE: Gap Summary

| Domain | Critical (blocks Liquid canary or security) | High (significant merchant UX gap) | Medium (parity / completeness) |
|--------|---------------------------------------------|-------------------------------------|-------------------------------|
| theme-engine | Font injection not connected; 4 Liquid section files absent; letbuyy-core create-store path | NL model boundary (AI SDK); section schema migrations empty | Theme analytics not wired; banner-carousel/marquee JSON schemas; A/B testing absent; segment personalization unconnected |
| merchant-editor | Rollback UI disconnected; editor AI hooks are stubs | WYSIWYG richtext; media library; DnD section/block reorder; insert section at position | Font picker; template create/duplicate; code editor; markets/locales; preview inspector overlay; theme duplication |
| persistence-gateway | `theme_editor_drafts` RLS custom_user_id gap; pessimistic locking unimplemented | Theme analytics not emitted; `renderer_key` column absent from `themes` DDL | `theme_migrations` adapter not written |
| storefront-runtime | Liquid canary off (intentional governance); 4 section type gaps if canary is enabled | Font injection; preview inspector bounding box | Liquid-canary ramp plan needs all gaps closed first |
| security | WYSIWYG output needs server-side sanitization at save; `theme_editor_drafts` RLS gap | — | `toLiquidDrop` limits sufficient for current depth |

**Phase M scope definition:** close the Critical and High gaps above. Medium gaps are candidates for phases N–AE unless explicitly scoped in.
