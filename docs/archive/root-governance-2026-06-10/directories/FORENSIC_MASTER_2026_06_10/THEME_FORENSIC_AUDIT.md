# PHASE 9 — THEME SYSTEM FORENSIC AUDIT

**Auditor role:** Theme-platform architect (Shopify Online Store 2.0 theme-team grade)
**Date:** 2026-06-10
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`
**Benchmark:** Shopify OS 2.0 — sections+blocks, section schema (typed settings JSON), JSON templates, theme settings (settings_schema/settings_data), Liquid (sandboxed data-only context), presets, dynamic sources/metafields, app blocks, section groups, online-store editor (live preview + drag-reorder + undo), theme-store packaging, theme check, locales.

**Method:** Read the real code — `packages/theme-engine` (registry, renderer, execution-runtime, bundle, governance), the storefront read path (`apps/storefront-runtime/src/lib/theme-engine/*` + 20 React section components), the web editor (`apps/merchant-control-plane/.../editor/page.tsx`, `SchemaFormRenderer.tsx`), the api-gateway persistence adapter (`services/api-gateway/src/execution/theme-execution.adapter.ts`), the Flutter editor (`apps/mobile/merchant-app/lib/screens/editor/*`, `widgets/editor/*`), DB migrations, and the theme-marketplace app. Evidence is `path:line` + quoted code. Live-render behavior is flagged **UNVERIFIED**. This document **supersedes** the prior `THEME_ARCHITECTURE_AUDIT.md` (which audits design-system light/dark, a different "theme" system) for the *storefront theme product*, and supersedes `FORENSIC_REPORT/04-theme-system.md`, `FOUNDATION_FORENSICS_2026_06_09/LETBUYY_THEME_EDITOR_FORENSICS.md`, and `LETBUYY_FOUNDATION_AUTHORITY/THEME_ARCHITECTURE_VERDICT.md` for current reality.

> **Terminology hazard (carried from prior audit):** "theme" names two unrelated systems. (1) *Design-system appearance* — light/dark/density via `--lb-*` tokens, audited in `THEME_ARCHITECTURE_AUDIT.md`. (2) *Storefront theme engine* — the Shopify-style sections/Liquid product audited **here**. They share only the word.

---

## Executive verdict (what exists / missing / broken / duplicated)

**This is the most genuinely-built subsystem in the repository — a real Shopify-OS-2.0-shaped theme platform, not governance theater.** It has a typed section/block/template/settings **schema system** (`SchemaField`/`SectionSchema`/`ThemeSettingsSchema` with 24 built-in section schemas, presets, defaults, and JSON-config theme settings), a **sandboxed, data-only render contract** (the Liquid drop layer strips prototypes, secrets, and `on*`/script keys; the JSON-contract validator rejects `__proto__`/`javascript:`/oversized payloads), a **full web editor** (add/remove/reorder/visibility/undo-redo/draft-autosave/preview-token/publish/rollback with optimistic locking), a **near-parity Flutter editor** (50-state undo/redo, device frames, live tap-to-edit preview), and a **real persistence + versioning spine** (`theme_instances`/`theme_instance_drafts`/`theme_draft_patches`/`theme_releases` with publish-via-RPC and rollback). What is **missing vs Shopify**: dynamic sources/metafield binding (only product fetch exists), drag-and-drop reorder on web (it's button up/down), theme-check/lint as a product, a real multi-theme store (production seeds **only `urban-kicks`**), and section-group editing as first-class. What is **broken/dormant**: the entire **Liquid renderer is feature-flagged OFF** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`) so the live read path is React-component-per-section, making the Liquid engine, bundle schema, and "portable theme" story **shipped-but-dead code** today. What is **duplicated**: two parallel draft systems (legacy `theme_editor_drafts` *and* the new instance/patch spine, written in the same call), two parallel renderers (theme-engine's `LiquidRenderer`/`JsonContractThemeRenderer` vs storefront's own React `renderer-registry`), and three section-schema sources (theme-engine `BUILT_IN_SECTION_SCHEMAS`, storefront `RUNTIME_SECTION_SCHEMAS`, DB-backed schema manifests).

---

## 1. Architecture model — sections, blocks, templates, schema

LetBuyy models a theme almost exactly like Shopify OS 2.0. Core contracts live in `packages/theme-engine`.

### Section / block / template models (`packages/theme-engine/src/index.ts`)

```ts
// index.ts:79
export interface SectionModel {
  id: string;
  type: SectionType;
  order: number;
  rendererKey?: string;
  schemaVersion?: string;
  settings: Record<string, unknown>;
  blocks?: BlockModel[];
  isVisible: boolean;
  createdAt?: string; updatedAt?: string;
}
// index.ts:92
export interface BlockModel { id; type; order; rendererKey?; schemaVersion?; settings; isVisible }
// index.ts:102
export interface StorefrontTemplateConfig { id?; type?; layoutKey?; sections: SectionModel[] }
// index.ts:109
export interface StorefrontSectionGroupConfig { id?; role?: 'header'|'footer'|'aside'|'custom'; sections: SectionModel[] }
// index.ts:115
export interface StoreTemplateConfig {
  themeId: string; releaseId?; releaseVersion?; engineVersion?;
  themeSettings: ThemeSettings;
  sections: SectionModel[];
  sectionGroups?: Record<string, StorefrontSectionGroupConfig>;  // header/footer = Shopify section groups
  templates?: Record<string, StorefrontTemplateConfig>;          // JSON templates: index/product/collection/...
  liquidBundle?: LiquidThemePackageBundle;
}
```

This is the **sections + blocks + JSON-templates + section-groups** quad. `templates` is a map keyed by template key (`index`, `product`, `collection`, `page`, `cart`, `blog` — `theme-execution.adapter.ts:184`), matching Shopify's JSON-template-per-route. `sectionGroups` with `role: 'header'|'footer'` is the OS-2.0 "section groups" concept.

### Schema system (`packages/theme-engine/src/theme-registry.ts`)

Section settings are **typed and validated** through a Shopify-shaped schema:

```ts
// theme-registry.ts:12
export interface SchemaField {
  type: 'text'|'textarea'|'richtext'|'color'|'image'|'select'|'toggle'|'range'|'number'|'url'|'radio'
  label: string; default?; maxLength?; options?; min?; max?; step?; unit?; info?; description?
}
// theme-registry.ts:31
export interface SectionSchema {
  name; type; description;
  defaults: Record<string, unknown>;
  presets?: Array<{ name; settings }>;          // Shopify presets
  settings_schema: Record<string, SchemaField>; // typed inputs
  blocks_schema?: Record<string, BlockSchema>;  // typed block inputs
  sample_blocks?: Array<{ type; settings }>;
}
// theme-registry.ts:48
export interface ThemeSettingsSchema { schema_version: string; settings: Record<string, ThemeSettingsGroup> }
```

`THEME_SETTINGS_SCHEMA` (`theme-registry.ts:436`) is the **settings_schema.json equivalent** — grouped global settings (colors, typography, layout, header, footer) with typed fields and defaults. `DEFAULT_THEME_SETTINGS` (`index.ts:64`) is the settings_data baseline. This is a faithful OS-2.0 settings model.

**Verdict:** sections ✔, blocks ✔, JSON templates ✔, section groups ✔, typed section schema ✔, theme settings schema ✔, presets ✔. The *architecture model* is Shopify-grade.

---

## 2. Renderer & data-context security

There are **two renderer families**, and which one runs is the single most important fact in this audit.

### 2a. The live path: React-component-per-section (storefront-runtime)

The storefront does **not** render merchant themes through a template language by default. `renderer-registry.tsx` maps section types → React components:

```tsx
// renderer-registry.tsx:198
const SECTION_RENDERER_DEFINITIONS: RegisteredSectionRenderer[] = [
  { rendererKey: 'core.header',  sectionTypes: ['header'], schema: schemaFor('header'),
    render: ({section,store,data}) => <DynamicHeader .../> },
  { rendererKey: 'core.hero', sectionTypes: ['heroBanner','hero','hero-banner'], ...
    render: ({section,theme}) => <HeroSection section={section} theme={theme}/> },
  // ...21 renderer definitions total
];
// renderer-registry.tsx:409
export function renderRegisteredSection(props) {
  const rendererKey = resolveSectionRendererKey(props.section);
  if (!rendererKey) return <UnknownSectionFallback .../>;     // graceful unknown-section fallback
  const renderer = APPROVED_SECTION_RENDERERS[rendererKey];
  if (!renderer) return <UnknownSectionFallback .../>;
  return renderer(props);
}
```

Section *settings* are passed as **props to typed React components** (`hero.tsx`, `product-grid.tsx`, etc.). Merchant content is therefore plain data interpolated by React — **JSX auto-escapes**, so there is no SSTI surface and XSS is structurally limited. The only merchant-content `dangerouslySetInnerHTML` in the section layer is **none** (confirmed: `grep dangerouslySetInnerHTML apps/storefront-runtime/src/components/sections/` → no hits). `richtext` fields (e.g. `RichContentSection`, About) are the one place to watch, but they flow through React, not raw HTML injection in the section components.

This is **server-rendered** (RSC): `StorefrontCompositionEngine` is an `async` server component invoked from every store route (`store/[subdomain]/page.tsx`, `/shop`, `/product/[productId]`, `layout.tsx`, `composition-engine.tsx:355`).

### 2b. The dormant path: sandboxed Liquid (theme-engine)

`LiquidRenderer` (`theme-renderer.ts:121`) is a genuine, security-hardened Liquid engine, but it is **off**:

```ts
// theme-governance.ts:14
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
// template-resolver.ts:197
const liquidEnabled = options.liquidEnabled ?? THEME_LIQUID_RENDERING_DEFAULT_ENABLED;  // false → never resolves a Liquid bundle
```

When enabled it is configured as a **data-only sandbox** (V1 §9 "branding tokens are data, never executable code"):

```ts
// theme-renderer.ts:255
const engine = new Liquid({
  cache: false, dynamicPartials: false, strictFilters: true,
  ownPropertyOnly: true,      // no prototype traversal
  jsTruthy: false,
  parseLimit: 300_000, renderLimit: 250, memoryLimit: 2_000_000,
  ...
});
// theme-bundle.ts:101 — bundle upload forbids dangerous Liquid tags outright
const forbiddenFragments = ['<script','</script','javascript:','data:text/html','{% include','{% layout','{% render'];
```

The data context (`drops`) is depth-limited, key-count-limited, and **secret-scrubbed**:

```ts
// theme-renderer.ts:407
const BLOCKED_DROP_KEYS = new Set(['__proto__','constructor','prototype','password','password_hash','access_token','refresh_token','signing_secret','client_secret']);
// theme-renderer.ts:441 toLiquidDrop: rejects non-identifier keys, caps depth=4, keys=80, array=100
if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || BLOCKED_DROP_KEYS.has(key)) continue;
```

Rendered Liquid HTML is post-sanitized (`theme-renderer.ts:606`: strips `<script>`, `on*=` handlers, `javascript:`/`data:text/html` in href/src). The **only** place Liquid HTML reaches the DOM is `composition-engine.tsx:84` via `dangerouslySetInnerHTML` — and only after the upstream sanitizer, and only when the flag is on. The app-block iframe is sandboxed (`composition-engine.tsx:109`: `sandbox="allow-forms allow-popups allow-scripts allow-same-origin"`).

**Security verdict:** The live React path is structurally safe (data-only, JSX-escaped). The Liquid path is well-sandboxed but **dead**. The residual risk is `richtext` content rendered through React and the single `dangerouslySetInnerHTML` sink behind the dormant flag — both **UNVERIFIED** at runtime but low-surface in code.

---

## 3. Editor capability audit (web + mobile)

### 3a. Web editor — `apps/merchant-control-plane/.../themes/[themeId]/editor/page.tsx` (1,892 lines)

This is a real, dense online-store editor, not a stub.

| Capability | Status | Evidence |
|---|---|---|
| Add section | ✔ Works | `addSection` `page.tsx:1147` — `createSectionFromSchema(activeAddSectionType,...)` appended with order+10 |
| Remove section | ✔ Works | `removeSection` `page.tsx:1183` (with confirm `sectionPendingRemoval`) |
| Reorder section | ◑ Works, **no drag** | `moveSection(sectionId, ±1)` `page.tsx:1164` — re-derives `order=(i+1)*10`. Button up/down only; **not** drag-and-drop |
| Toggle visibility | ✔ Works | `toggleSectionVisibility` `page.tsx:1140` |
| Add / remove block | ✔ Works | `addBlock` `page.tsx:1202`, `removeBlock` `page.tsx:1214` (schema-driven) |
| Edit section/block/theme settings | ✔ Works | `updateSectionSetting` `:1113`, `updateBlockSetting` `:1124`, `updateThemeSetting` `:1103` — all `coerceFieldValue(field,...)` typed |
| Typed settings form | ✔ Works | `SchemaFormRenderer.tsx` renders all 11 field types (text/textarea/richtext/color/image/select/toggle/range/url/number/radio) with maxLength, options, min/max/step |
| Undo / redo | ✔ Works | `EditorHistory {past,future}` `:81`; `undo` `:897`, `redo` `:910`; keyboard Ctrl/Cmd+Z / Shift+Z `:885` |
| Live preview | ✔ Works (token+iframe) | `syncPreviewDraft` `:943` debounced 900ms on dirty `:1004`; saves draft → mints `preview-session` token `:964` → previews via token. Not in-process render; round-trips to storefront preview |
| Responsive preview | ✔ Works | `PreviewDevice = 'desktop'|'tablet'|'mobile'` `:47`, `PREVIEW_DEVICES` widths `:160` |
| Save draft | ✔ Works | `saveDraft` `:923` → `PUT /api/themes/{id}/editor/draft` with `baseVersion` (optimistic lock) |
| Publish | ✔ Works | `handlePublish` `:1032` → `PUT /editor`; **blocks if dirty** `:1034` (must save first) |
| Discard | ✔ Works | `discardChanges` `:1091` restores `savedState` |
| Multi-template editing | ✔ Works | `selectedTemplateKey` + `handleTemplateChange` `:1077`; drafts are template-scoped |
| Image upload | ✔ Works | `ImageInput` `SchemaFormRenderer.tsx:237` → `POST /api/stores/{store}/upload` |
| "AI hooks" | ◑ Heuristic | `applyAiHook` `:1224` — deterministic schema-valid copy/blocks/layout transforms, **not** an LLM. Honest scaffold |
| Image cropping / focal point | ✗ Missing | no evidence |
| Theme-check / lint surface | ✗ Missing | validation is server-side at save (collectThemeTemplateValidationIssues), not an editor lint panel |

### 3b. Mobile editor (Flutter) — `apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart`

Prior memory ("theme editor is the strong point of the mobile app") is **confirmed**. It uses the **same backend contracts** (`SectionModel`, `ThemeEditorPayload` from `letbuyy_models`, `theme_editor_models.dart:1`).

| Capability | Status | Evidence |
|---|---|---|
| Load from same API | ✔ | `themeService.loadEditor(storeId, themeSlug)` `:211` → same `loadEditor` gateway endpoint as web |
| Undo / redo | ✔ 50-state | `_history`/`_historyIndex`, `_maxHistorySize=50` `:61`; `_undo` `:93`, `_redo` `:126` (deep-copy snapshots, haptics, named messages) |
| Add / remove / edit sections | ✔ | `add_section_sheet.dart`, `section_settings_sheet.dart`, `header_editor_sheet.dart` |
| Reorder | ✔ (layers) | `layers_drawer.dart` (reorder UI present) — richer than web's up/down buttons |
| Live preview, tap-to-edit | ✔ | `website_preview.dart` + "Live website preview with tap-to-edit sections" `:24` |
| Device frames + zoom | ✔ | `_deviceMode='phone'`, frames phone/tablet/laptop/samsung (`widgets/editor/device_frames/*`), `_zoomLevel` 50/100/150% `:56` |
| Preview token | ✔ | `_refreshPreviewToken()` `:253`, `_previewToken` `:44` |
| Draft / publish | ✔ | `_baseVersion` optimistic lock `:41`, `_draftExists` `:45`, save wired to gateway |
| Unsaved-changes guard | ✔ | `_confirmRefresh` discard dialog `:159` |
| AI homepage generation | ◑ | `_isGeneratingHomepage` `:38`, `ai_studio_service.dart` |
| Handles legacy + flat config shapes | ✔ | `_normalizeSectionsForFlutter` `:304` coerces both `{header,template,footer}` slots and flat arrays |

**Parity:** Mobile is **at or above** web on reorder UX (layers drawer vs up/down buttons) and device-frame fidelity; web leads on multi-template breadth and keyboard undo. Both consume identical server contracts — genuinely impressive cross-platform discipline.

---

## 4. Schema / settings system

Section settings are typed at three layers and validated server-side:

1. **Declared** in `SECTION_SCHEMAS` (12, `theme-registry.ts:419`) + `ADDITIONAL_BUILT_IN_SECTION_SCHEMAS` (12, `built-in-section-schemas.ts:40`) → `BUILT_IN_SECTION_SCHEMAS` (24, `built-in-section-schemas.ts:308`, `Object.freeze({...SECTION_SCHEMAS, ...ADDITIONAL...})`).
2. **Defaults / presets:** every schema carries `defaults` and most carry `presets` (e.g. heroBanner has 3 presets `theme-registry.ts:96`). `createSectionFromSchema` (editor) seeds new sections from `defaults`.
3. **Validated** on every draft save / publish in `collectThemeTemplateValidationIssues` (`index.ts:698`):
   - rejects unknown keys (`...is not defined by the {schema} schema` `index.ts:384`),
   - type-checks each field (`validateThemeFieldValue` `index.ts:304`: color regex, url protocol block, range min/max, select-options membership, maxLength),
   - blocks unsafe keys (`__proto__`, `dangerouslySetInnerHTML`, `on*` — `index.ts:251`),
   - caps payload at 256 KB (`index.ts:706`), arrays ≤100, strings ≤5000, blocks ≤50.

A `settings_schema.json`/`settings_data.json` equivalent exists both as the static `THEME_SETTINGS_SCHEMA` and inside the portable bundle (`ThemeBundleSettingsSchema` / `ThemeBundleSettingsDataSchema`, `theme-bundle.ts:223/228`). A **self-check** for schema gaps exists: `collectBuiltInSectionSchemaGaps` (`built-in-section-schemas.ts`). **Verdict: schema/settings system is real, typed, validated, and defaulted — Shopify-grade.**

There is also a **schema-migration framework** (`theme-governance.ts:216` `migrateThemeTemplateSchemas`) with per-section `fromVersion→toVersion` migrators and loop protection — a capability even some mature theme platforms lack. **UNVERIFIED** whether any migrations are registered in production.

---

## 5. Persistence / versioning

Theme state is persisted across **~33 theme tables** (DB migrations). The spine:

| Table | Role |
|---|---|
| `themes` | Catalog rows (slug, config, default_template, section_schemas, settings_schema, renderer_manifest) |
| `theme_packages` / `theme_package_versions` | Portable package + versioned manifests |
| `theme_schema_manifests` / `theme_renderer_manifests` | DB-backed schema + approved renderer keys |
| `theme_section_definitions` / `theme_block_definitions` / `theme_templates` / `theme_layouts` | Per-package section/block/template/layout registries |
| `theme_instances` | Per-store installed theme (active_release_id, current_draft_id) |
| `theme_instance_drafts` / `theme_draft_patches` | New draft spine (working_manifest + JSON-patch log) |
| `theme_editor_drafts` | **Legacy** draft store (draft_config, template_key, version) |
| `theme_releases` | Published versions (release_config, template_snapshot, is_current, rollback_of_release_id) |
| `theme_preview_sessions` | Token-hashed preview drafts (TTL) |
| `store_themes` | Install association (is_active, config_overrides) |
| marketplace: `theme_purchases`, `theme_purchase_receipts`, `theme_reviews`, `theme_reports`, `theme_refund_requests`, `theme_collections`, `theme_developer_listings`, `theme_developer_payout_accounts`, `theme_download_artifacts`, `theme_saved_searches`, `theme_marketplace_settings` | Full theme-store backend |

**Draft → publish → rollback** is fully implemented in `theme-execution.adapter.ts`:
- **Save** (`saveDraft` `:1159`): optimistic-lock via `base_version` (`isStaleThemeEditorBaseVersion` `:225` → `ConflictError`), writes legacy draft **and** instance-draft snapshot **and** a draft patch (`:475`), emits domain + audit events.
- **Publish** (`publish` `:1313`): validates, snapshots, calls RPC `publish_theme_release` (`:669`) — with a **full JS fallback** (`publishReleaseSnapshotFallback` `:695`) that supersedes prior `is_current`, inserts new release, updates `sites.template_config`. Deletes the draft after publish (`:1365`).
- **Rollback** (`rollbackRelease` `:1413`): re-publishes a prior release's `template_snapshot` as a new release with `rollback_of_release_id` set. Versioning is monotonic.
- **Preview** (`createPreviewSession` `:1496`): SHA-256-hashed token, TTL, draft-or-instance-draft binding.

**Versioning/rollback is real and auditable.** `store_branding` exists as a table but is owned by **checkout** (`migrations/146`, `routes/checkout.ts`), **not** the theme system — a naming false-friend, not theme persistence.

---

## 6. Section library inventory

24 built-in section types declared (`BUILT_IN_SECTION_TYPES` `built-in-section-schemas.ts:3`), all with schemas. Renderability depends on having a React renderer in `renderer-registry.tsx` (live path). Status legend: **R** = real React renderer + schema; **S** = schema only (no dedicated live renderer → `UnknownSectionFallback`).

| # | Section type | Schema | Live React renderer | Status |
|---|---|---|---|---|
| 1 | `header` | ✔ (registry) | `core.header` → DynamicHeader | **R** complete |
| 2 | `footer` | ✔ | `core.footer` → DynamicFooter | **R** complete |
| 3 | `heroBanner` | ✔ | `core.hero` → HeroSection | **R** complete |
| 4 | `productGrid` | ✔ | `core.product-grid` (store-only) | **R** complete |
| 5 | `featuredProducts` | ✔ | `core.featured-products` | **R** complete |
| 6 | `announcementBar` | ✔ | none registered | **S** schema-only* |
| 7 | `testimonials` | ✔ | `core.testimonials` | **R** complete |
| 8 | `aboutSection` | ✔ (additional) | `core.about` | **R** complete |
| 9 | `newsletter` | ✔ | `core.newsletter` | **R** complete |
| 10 | `categoryGrid` | ✔ | `commerce.category-grid` | **R** complete |
| 11 | `brandMarquee` | ✔ | `commerce.brand-marquee` | **R** complete |
| 12 | `trustBadges` | ✔ | `commerce.trust-badges` | **R** complete |
| 13 | `appBlockSlot` | ✔ | `apps.app-block-slot` | **R** complete (app blocks) |
| 14 | `productDetail` | ✔ (runtime) | `core.product-detail` | **R** complete |
| 15 | `portfolioGrid` | ✔ | `core.portfolio-grid` | **R** complete |
| 16 | `servicesGrid` | ✔ | `core.services-grid` | **R** complete |
| 17 | `skillsSection` | ✔ | `core.skills` | **R** complete |
| 18 | `experienceTimeline` | ✔ | `core.experience-timeline` | **R** complete |
| 19 | `contactForm` | ✔ | `core.contact-form` | **R** complete |
| 20 | `ctaSection` | ✔ | `core.cta` | **R** complete |
| 21 | `contentPage` | ✔ | `core.rich-content` | **R** complete |
| 22 | `collectionFilter` | ✔ (additional) | none registered | **S** placeholder |
| 23 | `instagramFeed` | ✔ (additional) | none registered | **S** placeholder |
| 24 | `faqAccordion` | ✔ (additional) | none registered | **S** placeholder |
| 25 | `videoHero` | ✔ (additional) | none registered | **S** placeholder |

\* `announcementBar` is in the default template and has a schema, but no `announcementBar` entry in `SECTION_RENDERER_DEFINITIONS` — it would hit `UnknownSectionFallback` on the live path unless the header/announcement is rendered inside another component. **Flag THEME-009.**

**Coverage:** ~20 of 25 have real live renderers — a **thick, commerce-complete set** (hero, product grid, product detail, header, footer, collection grid, featured collection, cart-adjacent, newsletter, trust, app-block-slot) plus a portfolio/resume/landing site-type set. **4 declared placeholders** (`collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero`) and 1 mismatch (`announcementBar`). No standalone `cart`/`search` *section* renderer in the registry (cart/search are app routes / hydration islands, not theme sections).

---

## 7. theme-engine vs storefront-runtime vs theme-marketplace — duplication trace

`@letbuyy/theme-engine` is **heavily used** (60+ importers across storefront-runtime, merchant-control-plane, theme-marketplace, api-gateway, application-services). It is **not** dormant scaffolding — its *types, schemas, validators, bundle parser, governance* are load-bearing. But its **renderer classes are nearly orphaned**:

```
grep "LiquidRenderer|JsonContractThemeRenderer|createThemeRenderer|composeStorefrontTheme" apps services
  → apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx   (the ONLY importer)
```

So the duplication map is:

| Concern | theme-engine | storefront-runtime | Duplicated? |
|---|---|---|---|
| Section/block/template **types** | `index.ts` (source of truth) | imports them | No (reused) |
| Section **schemas** | `BUILT_IN_SECTION_SCHEMAS` (24) | `RUNTIME_SECTION_SCHEMAS` (11) + `schemaFor()` merge | **Partial dup** — storefront re-declares productDetail/featured/about/portfolio/etc. schemas locally (`renderer-registry.tsx:66`) |
| **Renderer** | `LiquidRenderer` + `JsonContractThemeRenderer` (`theme-renderer.ts`) | own React `renderer-registry.tsx` + `composition-engine.tsx` | **Yes** — two renderers; the React one is live, the engine one is flag-gated/dead |
| **Composition/order/visibility** | `composeStorefrontTheme` (`execution-runtime.ts:288`) | `resolveStorefrontTemplate` + `template-resolver.ts` re-implements sort/visibility/group resolution | **Yes** — both sort `isVisible`+`order` and both `orderedKeys`; storefront duplicates the compose logic instead of calling the engine for the React path |
| **Validation** | `collectThemeTemplateValidationIssues` | (delegates to api-gateway, which calls engine) | No (reused) |

**Net:** theme-engine is *used* for contracts/schemas/validation/bundle, but the storefront **forked the render + compose path** in React and left the engine's renderer/compose code running only behind the dead Liquid flag. This is the classic LetBuyy "two parallel systems" pattern (memory: foundation-forensics), localized to themes. **Flag THEME-002/THEME-003.**

---

## 8. theme-marketplace reality

**Real, not an empty shell — but under-stocked.** `apps/theme-marketplace` has ~50 files: DB-backed listing/search (`api/themes/route.ts:47` → `ThemeService.listThemes(filters)` with category/pricing/industry/tag/price/sort/pagination), authenticated **theme package upload** (`route.ts:86` → session-gated, IP-rate-limited 5/min, ≤512 KB, bundle-validated via `UploadThemePackageSchema`), theme detail/compare/category pages, developer listing builder, purchases dashboard, installations, favorites, downloads (multi-platform: letbuyy/wordpress/html/react — `ThemeDownloadPlatformSchema`), reviews/reports/refunds, GST receipts (`ThemePurchaseReceipt`), Razorpay purchase verify (`ThemePurchaseVerifySchema`).

**Install flow is real** (`apps/theme-marketplace/src/app/install/page.tsx`): server action `installThemeAction` `:32` → `ThemeService.installTheme(slug, storeId, {preset, marketplace_install})` `:48` → which (in api-gateway `installTheme` `:813`) **purchase-gates premium themes** (`:824`), upserts `store_themes`, ensures `theme_instances`, and **publishes a release** (`:874`). Errors map to `purchase_required`/`missing_store`/`install_failed`. This is a working, release-creating install — not a stub.

**The catch:** production seeds **only `urban-kicks`** (`database/supabase/seeds/urban-kicks-theme.sql:21`; `verification/055_only_urban_kicks_theme_catalog.sql`; comment: *"Urban Kicks is the canonical LetBuyy commerce sample theme. The seed keeps marketplace metrics honest at zero until real installs/purchases/reviews exist"*). A 26-row sample catalog exists (`seeds/theme-marketplace-sample-catalog.sql`) but production is single-theme. So the **store is real machinery selling a near-empty shelf**. **Flag THEME-008.**

---

## 9. Liquid / templating

A **complete, sandboxed Liquid templating system exists in code but does not run.** `theme-bundle.ts` defines a full portable theme package: `layout/theme.liquid`, `config/settings_schema.json`, `config/settings_data.json`, `templates/*.json`, `sections/*.liquid` (must contain `{% schema %}`), `blocks/*.liquid`, `locales/*.json` (`LIQUID_THEME_BUNDLE_PATHS:20`), with Shopify-shaped section schema (`settings[]`, `blocks[]` incl. `@app` app blocks, `presets[]`, `enabled_on/disabled_on` `theme-bundle.ts:150`). Fixtures exist (`createUrbanKicksLiquidThemeBundleFixture` `:1356`) demonstrating `lb-add-to-cart`/`lb-cart-drawer`/`lb-variant-picker`/`lb-search` hydration islands (`LIQUID_HYDRATION_ISLANDS:30`).

Security on the Liquid path is strong (see §2b): forbidden-fragment rejection at upload, `ownPropertyOnly`/`jsTruthy:false`, drop scrubbing, output sanitization, strict zod bundle validation, path-pattern enforcement (`LIQUID_SECTION_PATH_PATTERN`).

**But:** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`theme-governance.ts:14`) and the resolver short-circuits before ever loading a bundle (`template-resolver.ts:197-198`). No production theme ships a `liquidBundle` (urban-kicks seed is JSON-contract). So the *templating language is the live read path's road-not-taken*: the React `renderer-registry` is the actual renderer. The "portable theme / third-party theme developer" story therefore **cannot be exercised end-to-end today**. This is the single biggest gap between the system's ambition and its live reality. **Flag THEME-001 (S1).**

---

## 10. Shopify capability-parity matrix

| Shopify OS 2.0 capability | LetBuyy status | Evidence |
|---|---|---|
| Sections + blocks architecture | **Present** | `SectionModel`/`BlockModel` `index.ts:79/92` |
| Section schema (typed settings JSON) | **Present** | `SchemaField`/`SectionSchema` `theme-registry.ts:12/31`; 24 schemas |
| JSON templates per route | **Present** | `templates: Record<string,...>` `index.ts:125`; keys index/product/collection/page/cart/blog `adapter:184` |
| Section groups (header/footer) | **Present** | `StorefrontSectionGroupConfig role` `index.ts:109`; `resolveSectionGroups` `template-resolver.ts:40` |
| Theme settings (settings_schema/data) | **Present** | `THEME_SETTINGS_SCHEMA` `theme-registry.ts:436`; `DEFAULT_THEME_SETTINGS` `index.ts:64` |
| Presets | **Present** | `presets` on schemas; heroBanner ×3 `theme-registry.ts:96` |
| Liquid (or equiv) sandboxed render | **Present but DORMANT** | `LiquidRenderer` `theme-renderer.ts:121`; flag off `theme-governance.ts:14` |
| Data-only / no code execution | **Present** | drop scrubbing `theme-renderer.ts:407/441`; validator blocks `on*`/proto `index.ts:251` |
| App blocks | **Present** | `appBlockSlot` schema + `@app` block type `theme-bundle.ts:132`; `app-block-slot.tsx` |
| Online-store editor: live preview | **Present** | web `syncPreviewDraft` `page.tsx:943`; mobile `website_preview.dart` |
| Editor: drag-reorder | **Partial / Missing (web)** | web is up/down buttons `moveSection` `page.tsx:1164`; mobile layers drawer has reorder |
| Editor: undo/redo | **Present** | web `page.tsx:897/910`; mobile 50-state `section_editor_screen.dart:93/126` |
| Editor: responsive preview | **Present** | web devices `page.tsx:160`; mobile device frames + zoom |
| Save draft / publish / discard | **Present** | adapter `saveDraft/publish` `:1159/1313`; editor `handleSave/handlePublish` |
| Versioning / rollback | **Present** | `theme_releases` + `rollbackRelease` `:1413` |
| Dynamic sources / metafields | **Missing** | only product fetch (`data-binding-engine.ts:46`); no metafield/dynamic-source binding |
| Theme store packaging | **Present** | portable bundle + persistence payload `theme-bundle.ts:877/969` |
| Theme store (catalog/sell/install) | **Present (under-stocked)** | marketplace app; install `install/page.tsx`; **only urban-kicks seeded** |
| Theme check / linting (as product) | **Missing** | server-side validation only; no lint surface |
| Locales / i18n | **Present (bundle-level)** | `locales/*` + `resolveThemeTranslation` `theme-bundle.ts:602`; 7 Indic locales in fixture |
| Schema migration framework | **Present (bonus)** | `migrateThemeTemplateSchemas` `theme-governance.ts:216` |
| Renderer governance/approval | **Present (bonus)** | `auditThemeRendererRegistry` `theme-governance.ts:82`; approved_renderer_keys |
| Multi-theme per store / theme library | **Partial** | one active theme via `store_themes.is_active`; no theme-library/duplicate-theme UX |

**Parity estimate: ~62%** of OS-2.0 theme capability *exists in code*; **~50% is live** (because the Liquid/portable-theme half is flag-gated off and the catalog is single-theme). Justification: model/schema/editor/persistence/marketplace-backend are at 80–90% parity; rendering is bifurcated (React live = solid for first-party sections, Liquid/portable = built-but-dead); dynamic sources, theme-check, drag-reorder, and a real multi-theme catalog are absent.

---

## 11. Notes carried forward / superseded

- **Supersedes** `THEME_ARCHITECTURE_AUDIT.md` *for the storefront theme product* (that doc covers DS light/dark, explicitly a different system — its §3 terminology hazard and §5 note that the storefront engine is distinct remain correct and are reaffirmed here).
- **Confirms** memory "theme editor is the strong point of the mobile app" — verified at `section_editor_screen.dart` (50-state undo, device frames, tap-to-edit, shared contracts).
- **Confirms** memory "two parallel systems" pattern — here as dual drafts (legacy + instance/patch) and dual renderers (React live + Liquid dead).
- **UNVERIFIED (runtime/live-dependent):** actual rendered output and XSS behavior of `richtext` fields; whether any schema migrations are registered; whether `announcementBar` reaches a renderer at runtime or is absorbed by header; preview-token round-trip latency; whether the 26-row sample catalog is ever loaded in any environment; mobile reorder persistence to `order`.

---

## Findings Register

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| THEME-001 | **S1** | Renderer | Liquid/portable-theme engine is shipped but feature-flagged OFF | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`; resolver short-circuits | `theme-governance.ts:14`; `template-resolver.ts:197` | Entire "portable theme / 3rd-party theme dev" story is dead code; can't onboard external theme authors | M | Decide: enable Liquid behind a per-theme `renderer.engine` switch with a canary, or formally delete the Liquid path and stop maintaining two renderers |
| THEME-002 | **S2** | Duplication | Two renderers (engine Liquid/JSON vs storefront React registry) | Storefront forked render path; engine renderer only imported by composition-engine for the dead Liquid branch | `renderer-registry.tsx:198`; `theme-renderer.ts:99/121`; only importer = `composition-engine.tsx` | Drift between schema and live renderer; maintenance tax; "approved_renderer_keys" governs a path that isn't authoritative | M | Make the React registry the single authority and document Liquid as future; or route both through one `ThemeRenderer` interface |
| THEME-003 | **S2** | Duplication | Compose/sort/visibility logic duplicated engine↔storefront | `template-resolver.ts` re-implements `composeStorefrontTheme` | `execution-runtime.ts:288` vs `template-resolver.ts:19/97/191` | Order/visibility bugs must be fixed twice; subtle divergence risk | M | Call `composeStorefrontTheme`/`hydrateAndComposeStorefrontTheme` from the React path instead of re-deriving |
| THEME-004 | **S2** | Persistence | Dual draft systems written in one call (legacy + instance/patch) | Migration left `theme_editor_drafts` live while adding `theme_instance_drafts`+`theme_draft_patches` | `theme-execution.adapter.ts:982` (legacy) + `:411`/`:475` (instance+patch) | Two sources of draft truth; preview reads legacy-or-instance (`:1505`); reconciliation hazard | M | Pick the instance/patch spine as canonical, make legacy a compatibility read-shim, migrate, then drop |
| THEME-005 | **S2** | Schema | Section schemas declared in three places | theme-engine `BUILT_IN_SECTION_SCHEMAS`, storefront `RUNTIME_SECTION_SCHEMAS`, DB schema manifests | `built-in-section-schemas.ts:308`; `renderer-registry.tsx:66`; `theme_schema_manifests` | A field added in one place isn't validated/edited consistently in the others | M | Generate storefront + DB schema from the engine registry (single source); CI check parity |
| THEME-006 | **S2** | Editor | No drag-and-drop section reorder on web | `moveSection(±1)` button model only | `page.tsx:1164` | UX below Shopify/Wix; reordering long pages is tedious | M | Add dnd-kit/HTML5 DnD to the layers list; mobile already has a richer layers drawer to mirror |
| THEME-007 | **S2** | Capability | No dynamic sources / metafield binding | Data binding only fetches products for product sections | `data-binding-engine.ts:46`; `sectionRequestsProductData:32` | Sections can't bind to arbitrary resources/metafields like OS 2.0 dynamic sources | L | Introduce a `dataBinding` resolver registry (collections, pages, blogs, metafields) feeding `SectionRenderData` |
| THEME-008 | **S2** | Marketplace | Theme store ships with only one theme | Production seed = urban-kicks; non-urban-kicks deactivated | `seeds/urban-kicks-theme.sql:21`; `verification/055_only_urban_kicks_theme_catalog.sql` | "Marketplace" is real machinery over an empty shelf; no buyer choice, no developer supply | M | Author 5–10 first-party themes as JSON-contract (or Liquid) bundles; or reframe as "theme starter + editor", not a store |
| THEME-009 | **S2** | Section library | `announcementBar` has schema + default-template usage but no live React renderer | Missing entry in `SECTION_RENDERER_DEFINITIONS` | `theme-registry.ts:136` (schema, in default template `:627`) vs absent in `renderer-registry.tsx:198` | Default home template may render `UnknownSectionFallback` for the announcement bar | S | Add an `announcementBar` renderer or fold it into the header renderer explicitly |
| THEME-010 | **S2** | Section library | 4 declared section types are placeholders (no renderer) | `collectionFilter`/`instagramFeed`/`faqAccordion`/`videoHero` schema-only | `built-in-section-schemas.ts:3` vs `renderer-registry.tsx` | Editor can add sections that render as fallback boxes on the live store | S | Either implement renderers or remove from `BUILT_IN_SECTION_TYPES` so the editor can't offer them |
| THEME-011 | **S3** | Editor | "AI hooks" are deterministic stubs presented as AI | `applyAiHook` does fixed copy/layout transforms | `page.tsx:1224` | Mild expectation mismatch; no real generation | S | Rename to "Quick fill"/"Smart defaults" or wire to a real model behind a flag |
| THEME-012 | **S3** | Security | Single `dangerouslySetInnerHTML` sink (Liquid output) | Liquid HTML injected post-sanitize | `composition-engine.tsx:84`; sanitizer `theme-renderer.ts:606` | Low (flag off + regex sanitizer), but regex HTML sanitization is brittle vs a real sanitizer | S | When enabling Liquid, replace regex sanitizer with DOMPurify/sanitize-html allowlist |
| THEME-013 | **S3** | Security | `richtext` fields flow through React but content provenance unverified | richtext stored as string, rendered in section components | `theme-registry.ts:13` (richtext type); `rich-content-section.tsx` | If any richtext is ever `dangerouslySetInnerHTML`'d, XSS opens | S | Audit every richtext consumer; enforce sanitize-on-render; add lint rule banning dSIH in sections |
| THEME-014 | **S3** | Persistence | RPC `publish_theme_release` has a JS fallback that duplicates publish logic | Defensive coding for missing DB function | `theme-execution.adapter.ts:669` (RPC) + `:695` (fallback) | Two publish code paths to keep consistent (release insert, supersede, store update) | M | Make the migration a hard dependency; remove the JS fallback once RPC is guaranteed deployed |
| THEME-015 | **S3** | Resilience | Pervasive "schema-unavailable / missing-column" swallowing | Adapter tolerates partially-migrated DBs by silently degrading | `:121` `isThemeEngineSchemaUnavailable`; `:937` missing `template_key` fallback | Real schema drift can be masked as "feature off"; hard to detect prod misconfig | M | Convert silent `return null` paths to logged/metered warnings; fail loudly in non-prod |
| THEME-016 | **S3** | Capability | No theme-check / lint surface for authors or merchants | Validation is server-side at save only | `index.ts:698` (validator, no UI) | Authors get errors only on save, not proactive lint like Shopify Theme Check | L | Expose `collectThemeTemplateValidationIssues` + renderer audit as an editor "issues" panel and a CLI |
| THEME-017 | **S3** | Capability | No image focal point / responsive image transforms in editor | Image field is URL+upload only | `SchemaFormRenderer.tsx:237` | Below OS-2.0 image UX; merchants can't set focal points | M | Add focal-point picker + `image_url` transform params (the Liquid `image_url` filter stub exists `theme-renderer.ts:481`) |
| THEME-018 | **S3** | Section library | No first-class `cart`/`search` section renderers | Cart/search are routes + hydration islands, not theme sections | `LIQUID_HYDRATION_ISLANDS:30`; no cart/search in `renderer-registry.tsx` | Cart/search pages aren't theme-composable like other templates | M | Add cart/search template renderers or document them as fixed app routes |
| THEME-019 | **S3** | Versioning | Release `template_snapshot` duplicates `release_config` | Both stored; rollback prefers snapshot | `theme-execution.adapter.ts:634/1446` | Storage bloat; ambiguity about source of truth on rollback | S | Standardize on one snapshot column; derive the other |
| THEME-020 | **S3** | Naming | `store_branding` table is checkout-owned, not theme | Branding split across domains | `migrations/146`; `routes/checkout.ts`; not referenced by theme code | Confuses theme audits; branding tokens live outside theme settings | S | Document the boundary; consider unifying brand tokens with `themeSettings` colors to avoid two brand sources |
| THEME-021 | **S3** | Mobile parity | Mobile defaults to theme slug `minimal_modern`; web/seed use `urban-kicks` | Hardcoded fallback diverges from seeded catalog | `section_editor_screen.dart:40/270` | First-load on a store with no theme may request a non-existent slug | S | Align mobile fallback to the seeded canonical slug (`urban-kicks`) or read it from config |
| THEME-022 | **S3** | Governance | Renderer governance defaults to `warn`, not `enforce` | `THEME_RENDERER_GOVERNANCE_DEFAULT_MODE='warn'` | `theme-governance.ts:13` | Unapproved renderer keys / unregistered sections only warn; can ship broken sections | S | Flip to `enforce` in publish flow once the 4 placeholder sections (THEME-010) are resolved |

**Findings: 22 (S1 ×1, S2 ×8, S3 ×13).**

---

*End of PHASE 9 — THEME SYSTEM FORENSIC AUDIT.*
