# Phase O Plan — Complete Experience Design Engine

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** O — Preset & Experience Engine 2.0
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase O ships a document-level complete-experience-design system that operates on `ThemeDocument` V2 (from Phase N). It adds three new source files, two new test files, and three export lines to `index.ts`. All existing bundle-level apply functions remain untouched.

### Out of scope for Phase O

- `apply_preset` gateway route (deferred — Phase P drafts/publish scope).
- `theme_editor_drafts` DB table (Phase P).
- `collectionFilter` and `faqAccordion` section definition files in the bundle (those types produce `'incompatible'` diff entries; adding them is a future bundle expansion, not Phase O's responsibility).
- Block nested children (Phase T deferred).
- Per-section settings schema renderer (Phase U).
- Header/footer group composition (Phase T section groups).

---

## 2. Apply Mode API — `experience-apply.ts` (new)

### 2.1 Public Types

```typescript
type ExperienceApplyMode = 'STYLE_ONLY' | 'COMPLETE_DESIGN';

interface ExperienceApplyOptions {
  mode: ExperienceApplyMode;
  preserveContent?: boolean; // default true
}

interface ExperienceApplyResult {
  document: ThemeDocument;
  diff: ExperienceApplyDiff;
}
```

### 2.2 STYLE_ONLY Mode

Copies the document, deep-clones `config.settings_data.current`, merges the 10-key token overlay from `buildExperienceSettingsOverlay(experience)` into it. All `template[].sections` are unchanged. `diff.templates` is empty. `diff.settings` lists all changed token keys with `previousValue`/`newValue`/`classification='token'`. `diff.requiresDuplicateBeforeApply` is always `false` in `STYLE_ONLY`.

### 2.3 COMPLETE_DESIGN Mode

(a) Token update — same as STYLE_ONLY.

(b) HOME template (`key='index'`): rebuild `sections[]` from `EXPERIENCE_COMPOSITIONS[experienceId].index`. For each `SectionSpec` in the composition, resolve the camelCase type to the document's `section_definitions` using `resolveLiquidSectionType()`. Types found in `section_definitions` are added; types not found become `'incompatible'` diff entries and are not inserted.

(c) PRODUCT template (`key='product'`): same approach with `EXPERIENCE_COMPOSITIONS[experienceId].product`.

(d) COLLECTION template (`key='collection'`): same approach with `EXPERIENCE_COMPOSITIONS[experienceId].collection`.

(e) All other templates (`cart`, `search`, `customers/*`, `blog`, `article`, `page`, `404`, `password`, `policy`): NEVER touched.

(f) `section_definitions`, `block_definitions`, `layout`, `locales`, `renderer`: NEVER mutated (RISK-DUAL-N01 enforcement).

(g) `block.children`: NEVER set (Phase T deferred). All `SectionSpec` objects have no `blocks` field.

(h) Output validated with `parseThemeDocument()` before return — fail-closed.

### 2.4 Diff API

```typescript
interface SectionDiffEntry {
  sectionId: string;         // composition id (added/retained/reordered/incompatible) or old id (removed)
  type: string;              // kebab-case resolved type
  action: 'added' | 'removed' | 'reordered' | 'retained' | 'settings-updated' | 'incompatible';
  lostContent?: {            // for removed entries or retained/reordered with block loss
    settings?: Record<string, unknown>;
    blocks?: Array<{ id: string; type: string; settings: Record<string, unknown> }>;
  };
  newSettings?: Record<string, unknown>;  // for 'added'
  previousIndex?: number;                  // for 'reordered'
  incompatibleReason?: string;             // for 'incompatible'
}

interface SettingsDiffEntry {
  key: string;
  previousValue: unknown;
  newValue: unknown;
  classification: SettingClass; // 'token' | 'merchant-content' | 'generated-placeholder' | 'resource-binding' | 'app-owned'
}

interface ExperienceApplyDiff {
  experienceId: string;
  mode: ExperienceApplyMode;
  templates: Record<string, { sections: SectionDiffEntry[]; hasContentLoss: boolean; }>;
  settings: SettingsDiffEntry[];
  requiresDuplicateBeforeApply: boolean;
  summary: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsReordered: number;
    sectionsRetained: number;
    settingsChanged: number;
    contentAtRisk: number;
  };
}
```

`computeExperienceApplyDiff()` is pure and idempotent — never touches the input document. Use it as a PREVIEW before calling `applyExperienceToDocument`.

---

## 3. Content Preservation Model

### 3.1 Setting Classification (precedence order)

1. **TOKEN** — one of the 10 overlay keys. Always experience-owned. Replaced in both modes.
2. **RESOURCE-BINDING** — key matches `collectionHandle`, `productHandle`, `productId`, `collectionId`, `featured_collection`, `product_handle`, `collection_handle`, `linked_content`, or any key ending in `Handle`, `Id`, `_handle`, `_id`. Always preserved.
3. **GENERATED-PLACEHOLDER** — value is `''`, `null`, `undefined`, or equals the schema-declared default for that section type + key. Safe to replace.
4. **MERCHANT-CONTENT** — everything else. Preserved when `preserveContent: true`.
5. **APP-OWNED** — block whose type starts with `'@'` (LiquidAppBlock sentinel). Carried forward when the section accepts app blocks; otherwise not present (structural incompatibility, nothing to lose).

### 3.2 Content Migration (COMPLETE_DESIGN, preserveContent=true)

When a section type in the existing template matches a type in the new composition:

- Start with the composition's placeholder `settings`.
- For each setting in the old section classified as MERCHANT-CONTENT or RESOURCE-BINDING, overwrite the placeholder value with the preserved value.
- Carry forward ALL non-`@` blocks from the old section unconditionally (they are merchant content regardless of whether the block type is in `block_definitions`).
- Carry forward `@`-prefix blocks only if the section definition accepts app blocks (`sectionAcceptsAppBlocks` check).
- The new section uses the composition's stable id (not the old section id).

If the new composition has multiple sections of the same type (not permitted — compositions enforce unique types per template), the first match wins.

### 3.3 requiresDuplicateBeforeApply

Set to `true` whenever:
- Any section present in the existing template is absent from the new composition AND that section has at least one MERCHANT-CONTENT or RESOURCE-BINDING setting with non-empty/non-default value, OR
- Any section present in the existing template is absent from the new composition AND that section contains APP-OWNED blocks, OR
- Any retained/reordered section has non-`@` blocks that would be discarded (only when `preserveContent: false`).

This flag fires independent of `preserveContent`. The flag means "content would be permanently lost if the apply proceeds without duplicating first."

### 3.4 Preview / Undo / Reset / Duplicate

- **PREVIEW**: call `computeExperienceApplyDiff()` — no document mutation.
- **UNDO**: caller holds the original `ThemeDocument` before applying; reverting to it undoes the apply. The diff does not carry a snapshot — caller responsibility.
- **RESET**: call `toThemeDocumentV2(bundle)` on the canonical bundle then apply the experience — produces a fresh composition.
- **DUPLICATE-BEFORE-DESTRUCTIVE**: when `diff.requiresDuplicateBeforeApply` is `true`, the editor must offer to duplicate the theme before proceeding.

---

## 4. Section-Type-Map — `section-type-map.ts` (new)

Exports:

1. `BUILT_IN_TO_LIQUID_SECTION_TYPE` — canonical mapping from camelCase `BUILT_IN_SECTION_TYPES` to the Liquid kebab-case type string used in `ThemeDocument.section_definitions`. 25 entries covering all built-in types. Mapping derived from `THEME_LIQUID_PORTABLE_SECTION_PARITY` (20 parity entries) plus explicit entries for bundle-only types.

2. `resolveLiquidSectionType(camelType, sectionDefinitions)` — looks up the kebab equivalent and returns it if the kebab type is a key in `sectionDefinitions`; else `null`. Two-step check: (a) mapping exists, (b) kebab key is present in the document's section definitions at call time.

3. `collectSectionTypeMapIssues()` — integrity check that every `BUILT_IN_SECTION_TYPES` entry has a mapping. Called by the governance gate.

**Known null resolutions on the current Urban Kicks/LetBuyy Core bundle:**
- `faqAccordion` → `'faq-accordion'` → `null` (not in bundle)
- `collectionFilter` → `'collection-filter'` → `null` (not in bundle)
- `instagramFeed` → `'instagram-feed'` → `null` (not in bundle)
- `videoHero` → `'video-hero'` → `null` (not in bundle)

---

## 5. Compositions — `experience-compositions.ts` (new)

### 5.1 Interfaces

```typescript
interface SectionSpec {
  id: string;       // stable: '{experienceId}-{camelType}-{templateKey}'
  type: string;     // camelCase BUILT_IN_SECTION_TYPE
  settings: Record<string, unknown>; // static placeholder — no Date.now/Math.random
}

interface ExperienceComposition {
  index: SectionSpec[];
  product: SectionSpec[];
  collection: SectionSpec[];
}
```

### 5.2 Index (Home) Compositions

| Experience | Sections (index, camelCase order) | Count | Key structural differentiator |
|---|---|---|---|
| forge | announcementBar, heroBanner, categoryGrid, **trustBadges**, featuredProducts, productGrid, newsletter | 7 | trustBadges at position 3 (early trust before browse) |
| sense | announcementBar, heroBanner, categoryGrid, featuredProducts, **testimonials**, newsletter | 6 | No productGrid, no trustBadges; testimonials near end |
| aura | announcementBar, heroBanner, categoryGrid, featuredProducts, **trustBadges**, **testimonials**, newsletter | 7 | Both trustBadges and testimonials; trust mid, social proof at end |
| craft | announcementBar, heroBanner, categoryGrid, trustBadges, featuredProducts, **aboutSection**, testimonials, **faqAccordion**, newsletter | 9 | LARGEST (9 sections); aboutSection + faqAccordion (incompatible in current bundle) |
| refresh | announcementBar, heroBanner, **trustBadges**, categoryGrid, featuredProducts, productGrid, newsletter | 7 | UNIQUE: trustBadges at position 2, before categoryGrid |
| ride | announcementBar, heroBanner, categoryGrid, featuredProducts, productGrid, **trustBadges**, newsletter | 7 | trustBadges after productGrid (guarantee post-browse) |
| dawn | announcementBar, heroBanner, categoryGrid, featuredProducts, productGrid, **aboutSection**, newsletter | 7 | No trustBadges/testimonials; aboutSection as parting curation story |
| bloom | announcementBar, heroBanner, categoryGrid, featuredProducts, **trustBadges**, productGrid, newsletter | 7 | trustBadges between featuredProducts and productGrid (safety mid-browse) |
| nova | announcementBar, heroBanner, categoryGrid, featuredProducts, productGrid, **ctaSection**, newsletter | 7 | ctaSection (gradient brand CTA band) — distinct from summit |
| summit | announcementBar, heroBanner, categoryGrid, featuredProducts, productGrid, newsletter | 6 | Minimal baseline; no extras |

All 10 index fingerprints are structurally distinct (verified by test).

### 5.3 Product Compositions

| Experience | Sections (product) | Key intent |
|---|---|---|
| forge | productDetail, trustBadges | Spec verification at PDP |
| sense | productDetail, featuredProducts("Complete the look") | Editorial cross-sell |
| aura | productDetail, testimonials, trustBadges | Social proof then trust |
| craft | productDetail, aboutSection, faqAccordion | Maker story + delivery FAQ (faqAccordion incompatible in current bundle) |
| refresh | productDetail, trustBadges, featuredProducts | Freshness guarantee then related |
| ride | productDetail, featuredProducts("Complete your kit") | Gear cross-sell |
| dawn | productDetail, aboutSection, featuredProducts("You might also like") | Curation story |
| bloom | productDetail, trustBadges, featuredProducts("Pets also love") | Safety first |
| nova | productDetail, featuredProducts, ctaSection | Brand-forward upsell |
| summit | productDetail, featuredProducts("Related products") | Safe baseline |

### 5.4 Collection Compositions

All collection compositions include `collectionFilter`, which is incompatible in the current bundle (`collection-filter` absent from `section_definitions`). Incompatible specs produce advisory diff entries; remaining compatible sections apply normally.

| Experience | Sections (collection) | Key intent |
|---|---|---|
| forge | categoryGrid, collectionFilter†, productGrid | Filter-first with category context |
| sense | heroBanner, collectionFilter†, productGrid | Editorial banner + filter |
| aura | heroBanner, collectionFilter†, productGrid, newsletter | Editorial + capture |
| craft | heroBanner, collectionFilter†, productGrid, aboutSection | Craft story bottom |
| refresh | trustBadges, collectionFilter†, productGrid | Freshness first |
| ride | heroBanner, collectionFilter†, productGrid | Action shot |
| dawn | heroBanner, collectionFilter†, productGrid | Quiet browse |
| bloom | heroBanner, collectionFilter†, productGrid | Playful header |
| nova | heroBanner, collectionFilter†, productGrid, ctaSection | Brand upsell |
| summit | collectionFilter†, productGrid | Simplest baseline |

† `collectionFilter` will produce `'incompatible'` diff entries on all current bundle documents.

---

## 6. New Files

| File | Purpose |
|------|---------|
| `packages/theme-engine/src/experience-apply.ts` | Apply engine: types + `computeExperienceApplyDiff` + `applyExperienceToDocument` |
| `packages/theme-engine/src/experience-compositions.ts` | Per-experience per-template `SectionSpec` compositions |
| `packages/theme-engine/src/section-type-map.ts` | camelCase ↔ Liquid type resolution bridge |
| `packages/theme-engine/test/experience-apply.test.ts` | Apply engine tests |
| `packages/theme-engine/test/experience-compositions.test.ts` | Composition registry and distinctness tests |

Modified: `packages/theme-engine/src/index.ts` — 3 new `export *` lines (section-type-map, experience-compositions, experience-apply) added after the Phase N block.

Unchanged: `theme-presets.ts`, `theme-registry.ts` (FROZEN), `theme-document.ts`, `theme-bundle.ts`, `theme-governance.ts`, `industry-experience-map.ts`, `experience-fonts.ts`. Gateway `stores.ts` and editor `page.tsx` are UNCHANGED.

---

## 7. Design Invariants

| Invariant | Mechanism |
|---|---|
| RISK-DUAL-N01 (section_definitions never mutated) | Engine never writes to `section_definitions`/`block_definitions`/`layout`/`locales`/`renderer`; `parseThemeDocument()` on output would catch any violation |
| ART-17 (no new React sections) | Every section in the result must be a key in `section_definitions`; incompatible types are skipped |
| Determinism (same inputs → same output) | No `Date.now()`/`Math.random()`; JSON round-trip clone; composition ids are hardcoded stable strings |
| Fail-closed (invalid output rejected) | `parseThemeDocument()` called on result before return; incompatible sections skipped rather than inserted |
| No silent content loss | All content loss surfaces in `diff.lostContent`; `requiresDuplicateBeforeApply` fires independent of `preserveContent` |
| Block.children never set | `SectionSpec` has no `blocks` field; apply engine initialises `finalBlocks = []` and only adds blocks during content migration |
