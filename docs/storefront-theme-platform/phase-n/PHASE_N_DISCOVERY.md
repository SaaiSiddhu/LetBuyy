# Phase N Discovery — Theme Document V2: Current Reality, ID Model, Draft Shape

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date:** 2026-07-10
**Branch:** `stepup/main`
**Baseline HEAD entering Phase N:** `8c1ac94b` (Phase L)
**Theme-engine baseline:** 643/643 tests passing (20 suites including 18 pre-existing)

---

## 1. The Problem Phase N Solves

The `LiquidThemePackageBundle` schema in `packages/theme-engine/src/theme-bundle.ts` is the canonical **rendered + persisted** artifact. It uses keyed Records for templates, sections, and blocks:

```
bundle.templates[templateKey].sections       // Record<sectionId, section>
bundle.templates[templateKey].order          // string[] — ordering signal
bundle.templates[templateKey].sections[id].blocks    // Record<blockId, block>
bundle.templates[templateKey].sections[id].block_order  // string[] — ordering signal
```

This shape is correct for the bundle (it is how Liquid themes ship), but it is hostile to an editor:
- Ordering is a side-channel (parallel `order[]` + `block_order[]` arrays separate from the data Record).
- No stable-position semantics for React array rendering (array → keyed map → array conversion is lossy on identity).
- The DB draft tables store an editor-internal `draft_config` shape that partially overlaps the bundle but is not identical to it.
- No versioned document format: a future schema change has no migration path.

Phase N introduces `ThemeDocument` — the editor-facing, ID-stable, versioned, ordered-array view of a theme — and the two lossless adapters that bridge it to `LiquidThemePackageBundle`.

---

## 2. Bundle Shape (Verified Against `theme-bundle.ts`)

Source: `packages/theme-engine/src/theme-bundle.ts:482` (`LiquidThemePackageBundleSchema.strict().superRefine`).

### 2.1 Top-Level Fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | `string` | Default `'2026-06-liquid-sections'`. Version gate via `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`. |
| `package` | `ThemeBundlePackageMetadataSchema` | Includes `compatibility_range ≥ 2026-06-liquid-sections`. |
| `layout.theme` | `ThemeLiquidLayoutFileSchema` | `{ path: 'layout/theme.liquid', source: string }` |
| `config.settings_schema` | `ThemeBundleSettingsSchema` | Group-keyed `Record<groupKey, {label, description, fields}>` |
| `config.settings_data` | `ThemeBundleSettingsDataSchema` | `{ current: JsonObject, presets: Record }` — uses `.passthrough()` (may carry extra keys) |
| `templates` | `Record<templateKey, ThemeBundleTemplateSchema>` | Keyed map; ordering via `order[]` |
| `sections` | `Record<sectionType, ThemeLiquidSectionFileSchema>` | Liquid source files keyed by type |
| `blocks` | `Record<blockType, ThemeLiquidBlockFileSchema>` | Reusable block Liquid files |
| `locales` | `Record<locale, ThemeBundleLocaleSchema>` | Recursive JSON translation strings |
| `renderer` | `ThemeLiquidRendererManifestSchema` | `engine: 'liquid'`, `liquid_ready: true` |

### 2.2 Template Shape

`ThemeBundleTemplateSchema` (line ~300):
```
{
  name?: string
  layout?: string
  sections: Record<sectionId, ThemeBundleTemplateSectionSchema>
  order: string[]   // canonical section ordering; must match section Record keys
}
```

`ThemeBundleTemplateSectionSchema` (line ~292):
```
{
  type: string
  settings: JsonObject
  blocks: Record<blockId, ThemeBundleTemplateBlockSchema>
  block_order: string[]
  disabled: boolean
}
```

### 2.3 Bundle `superRefine` Constraints (line 504-554)

1. `sections[type]` key must match `path` filename.
2. `blocks[type]` key must match `path` filename.
3. `templates[key].sections[id].type` must resolve to `bundle.sections`.
4. Template block types must be allowed (inline-block, reusable block, or `@app`) by the section's accepted block types.
5. `order[]` references must exist as section keys.
6. `block_order[]` references must exist as block keys.

---

## 3. ID Model (Verified Against Source and Fixtures)

### 3.1 Current State (Bundle)

Section and block IDs in the bundle today are the **string keys** of the Record maps, not array-index values:

- `templates[templateKey].sections` is `Record<sectionId, ...>` — the `sectionId` (e.g. `'header-default'`, `'hero-default'`, `'category-sneakers'`) is a human-readable kebab-case string set by the fixture author (`theme-bundle.ts` lines ~1976–2342).
- `templates[key].sections[sectionId].blocks` is `Record<blockId, ...>` — the `blockId` is similar (e.g. `'header-products'`, `'first_badge'`, `'spotlight-badge'`).
- The `order[]` and `block_order[]` arrays reference these same string keys as the canonical ordering signal.

**IDs are NOT array-index-derived.** Fixture IDs are human-readable.

**Editor-generated IDs** (from `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`, line ~504) follow the pattern `${type}-${Date.now().toString(36)}` — timestamp-suffixed.

**Uniqueness scope:** IDs are unique only within their containing template (sections) or within the containing section (blocks). No cross-template uniqueness enforcement exists today.

### 3.2 V2 ID Model (ThemeDocument)

Phase N does not change the string key format. The `ThemeDocumentIdSchema` accepts:
```
/^[a-zA-Z0-9_-]+$/  max 64 chars  min 1 char
```

This accepts all existing fixture IDs (kebab-case + underscore) and all timestamp-suffix editor IDs.

V2 guarantees uniqueness **within scope** via `superRefine`:
- Section IDs unique within each template.
- Block IDs unique within each section (all nesting levels).

No cross-template uniqueness enforcement is added (matching the current bundle contract).

The ordered-array representation (`templates: ThemeDocumentTemplate[]`, `sections: ThemeDocumentSection[]`, `blocks: ThemeDocumentBlock[]`) makes ordering explicit in array position, eliminating the separate `order[]` / `block_order[]` fields in the doc view while fully reconstructing them in `fromThemeDocumentV2`.

---

## 4. Draft Shape (DB Tables — Verified Against Adapters)

### 4.1 `theme_editor_drafts`

Columns confirmed in `theme-execution.adapter.ts:61` and `public-routes.ts:138`:
```
id, store_id, theme_id, template_key, draft_config: JSONB, version: int,
auto_saved_at, updated_at
```

**`draft_config` shape** (from `buildDraftConfig`, `editor/page.tsx:584–621`):
```
{
  // Editor-internal (IGNORED by V2 migration):
  themeSettings: Record  // flat key→value editor runtime state
  sections: { header: SectionEntry|null, footer: SectionEntry|null, template: SectionEntry[] }

  // Bundle-compatible (AUTHORITATIVE for V2 migration):
  templates: {
    [templateKey]: {
      name, layout?,
      sections: Record<sectionId, { type, visible, settings, blocks: Record<blockId, ...>, block_order: string[] }>,
      order: string[]
    }
  }
  settings_data: { current: Record, presets: Record }
  config: { settings_schema: {...}, settings_data: { current, presets } }

  // Bundle anatomy fields (may be present or absent depending on editor save path):
  layout, sections (Liquid files), blocks, locales, renderer, package
}
```

**Key ambiguity:** `draft_config` carries BOTH the editor-internal `sections` (array form) AND the bundle-compatible `templates` (keyed-map form). V2 migration (`migrateToThemeDocumentV2` SHAPE-3) uses `templates` as authoritative and ignores the editor-internal `sections` root.

### 4.2 `theme_instance_drafts`

Columns confirmed in `theme-execution.adapter.ts:446–462`:
```
id, theme_instance_id, store_id, base_release_id, draft_status, draft_version,
working_manifest: JSONB, schema_manifest_version, auto_saved_at, updated_by,
created_by, created_at, deleted_at
```

**`working_manifest`** is the full `templateConfig` (bundle-compatible shape, minus editor-internal fields).

### 4.3 No DB-Level Schema Enforcement

Both draft tables store `draft_config` / `working_manifest` as opaque JSONB with no DB-level schema constraint. V2 must validate its own shape on read. This is enforced by `parseThemeDocument(raw)` at the start of `fromThemeDocumentV2`.

---

## 5. Gaps That Drive Phase N

| Gap | Evidence |
|-----|---------|
| No versioned editor-facing document format | Bundle has `schema_version` gate; the editor-written `draft_config` has no version field; future schema additions have no migration path |
| Ordering as side-channel | `order[]` + `block_order[]` are separate from the data; React array rendering requires a stable-position array, not a keyed map |
| No stable-id block children model | The bundle supports only `blocks: Record` (flat); no nesting; Phase T needs the schema groundwork from Phase N |
| Three incompatible shapes in production | `LiquidThemePackageBundle` (bundle schema), editor `draft_config` (SHAPE-3), and V2 `ThemeDocument` — the migration layer must accept all three |
| settings_data passthrough keys not propagated | `ThemeBundleSettingsDataSchema.passthrough()` allows extra keys; a strict adapter loses them silently |

---

## 6. Reuse Inventory (What Phase N Imports From the Existing Bundle)

| Symbol | Source | Purpose |
|--------|--------|---------|
| `ThemeBundleJsonSchema` | `theme-bundle.ts` | Recursive JSON value type for settings values |
| `ThemeBundlePackageMetadataSchema` | `theme-bundle.ts` | Package metadata in ThemeDocumentSchema |
| `ThemeLiquidLayoutFileSchema` | `theme-bundle.ts` | Layout file in ThemeDocumentSchema |
| `ThemeBundleSettingsSchema` | `theme-bundle.ts` | Settings schema group in ThemeDocumentSchema.config |
| `ThemeLiquidSectionFileSchema` | `theme-bundle.ts` | Section Liquid files in `section_definitions` |
| `ThemeLiquidBlockFileSchema` | `theme-bundle.ts` | Block Liquid files in `block_definitions` |
| `ThemeBundleLocaleSchema` | `theme-bundle.ts` | Translation strings in ThemeDocumentSchema |
| `ThemeLiquidRendererManifestSchema` | `theme-bundle.ts` | Renderer manifest in ThemeDocumentSchema |
| `parseLiquidThemePackageBundle` | `theme-bundle.ts` | Fail-closed validation in adapters |
| `isLiquidAppBlockType` | `theme-bundle.ts` | Block type resolution in superRefine |
| `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` | `theme-bundle.ts` | Pattern replicated for `KNOWN_THEME_DOCUMENT_VERSIONS` |
| `UnsupportedLiquidBundleSchemaVersionError` | `theme-bundle.ts` | Pattern replicated for `UnsupportedThemeDocumentVersionError` |
| `isLiquidAppBlockType` | `theme-bundle.ts` | `@app` block acceptance in superRefine |

**Not imported / not changed:** `theme-registry.ts` (FROZEN per ART-17), sanitizer, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (stays `false`).
