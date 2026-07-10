# Phase O Discovery — Experience Shapes and Apply Functions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** O — Preset & Experience Engine 2.0
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Discovery Purpose

Phase O began with a ground-truth audit of the ten registered experiences and the three existing apply functions that Phase O extends. All claims below are verified against source; line references are file-relative positions in `packages/theme-engine/src/theme-presets.ts` at the Phase O commit.

---

## 2. The Ten Experience Shapes

Each experience is defined by `defineExperience()` in `theme-presets.ts`. The `defaultSections` array encodes home-page section ordering only. No experience today defines multi-template compositions, per-section default settings, block configurations, or header/footer group composition. The primary differentiation prior to Phase O is entirely token-driven.

### 2.1 forge (electronics, grounding = research) — line 166

Tokens: `{ primaryColor: '#1E3A5F', secondaryColor: '#1E40AF', accentColor: '#00B4D8', backgroundColor: '#FFFFFF', textColor: '#1A1A2E', surfaceColor: '#F0F4F8', fontFamily: 'Inter', headingFontFamily: 'Inter', borderRadius: 8 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'trustBadges', 'featuredProducts', 'productGrid', 'newsletter']`

Trust badge immediately after hero, before category browse. Research-grounded "verify before you buy" signal.

### 2.2 sense (fashion, grounding = research) — line 187

Tokens: `{ primaryColor: '#1A1A2E', accentColor: '#E63946', headingFontFamily: 'Playfair Display', borderRadius: 4 }`

`defaultSections` (6 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'testimonials', 'newsletter']`

Most editorially oriented of the 10. No productGrid, no trustBadges. Testimonials before newsletter — social proof as parting impression.

### 2.3 aura (beauty, grounding = designed) — line 209

Tokens: `{ primaryColor: '#C2798B', accentColor: '#D4AF7A', headingFontFamily: 'Cormorant Garamond', borderRadius: 16 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'trustBadges', 'testimonials', 'newsletter']`

Derived from jewelry research palette. Trust after featured browsing; testimonials before newsletter. Softened aesthetic implies safety confidence mid-funnel.

### 2.4 craft (furniture, grounding = research) — line 231

Tokens: `{ primaryColor: '#3E2723', headingFontFamily: 'Libre Baskerville', borderRadius: 6 }`

`defaultSections` (9 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'trustBadges', 'featuredProducts', 'aboutSection', 'testimonials', 'faqAccordion', 'newsletter']`

Largest composition of the 10. The only experience with both `aboutSection` and `faqAccordion`. Most structurally distinct experience in the baseline registry.

### 2.5 refresh (food, grounding = research) — line 253

Tokens: `{ primaryColor: '#2D6A4F', accentColor: '#F4A261', borderRadius: 10 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'trustBadges', 'categoryGrid', 'featuredProducts', 'productGrid', 'newsletter']`

Unique: `trustBadges` immediately after `heroBanner` and before `categoryGrid`. No other experience in the 10 places trust this early. Freshness guarantee leads the browse journey. Resolves the brief's 'Food→Harvest' naming error — this experience is `refresh`, not `harvest`.

### 2.6 ride (sports, grounding = designed) — line 275

Tokens: `{ primaryColor: '#FF4D00', accentColor: '#FFD100', borderRadius: 6 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'trustBadges', 'newsletter']`

`trustBadges` after `productGrid` — performance guarantee after browsing, before checkout. Unique end-of-browse placement.

### 2.7 dawn (books, grounding = designed) — line 297

Tokens: `{ primaryColor: '#3B4F6B', headingFontFamily: 'Libre Baskerville', surfaceColor: '#FDF6EC', borderRadius: 4 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'aboutSection', 'newsletter']`

Quiet editorial tone. `aboutSection` at end, no trustBadges, no testimonials. Curation story as parting impression.

### 2.8 bloom (pet, grounding = designed) — line 319

Tokens: `{ primaryColor: '#E07B39', accentColor: '#4CAF73', borderRadius: 14 }`

`defaultSections` (7 items): `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'trustBadges', 'productGrid', 'newsletter']`

Safety trust between `featuredProducts` and `productGrid` — mid-browse placement signals care for pet health before committing to browse.

### 2.9 nova (D2C, industry = null, grounding = designed) — line 341

Tokens: `{ primaryColor: '#8B5CF6', accentColor: '#F59E0B', borderRadius: 10 }`

`defaultSections` (6 items): `[...COMMERCE_BASE_SECTIONS]` = `['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'newsletter']`

Pre-Phase O: structurally IDENTICAL to Summit — both used the same `COMMERCE_BASE_SECTIONS` spread. Token-only differentiation. Phase O corrects this by adding `ctaSection` to Nova's index composition.

### 2.10 summit (general, grounding = research) — line 363

Tokens: `{ primaryColor: '#00B3B3', accentColor: '#A4E500', borderRadius: 12 }` — intentionally matches `DEFAULT_THEME_SETTINGS` for zero visual regression on unassigned stores.

`defaultSections` (6 items): `[...COMMERCE_BASE_SECTIONS]` — structurally identical to Nova pre-Phase O. `FALLBACK_EXPERIENCE_ID = 'summit'`.

### 2.11 Honest Structural Summary (pre-Phase O)

- No experience defines multi-template compositions (product/collection/cart/search templates).
- No experience defines per-section default settings, block configurations, or header/footer group composition.
- `defaultSections` encodes HOME page section ordering only.
- Nova and Summit were structurally identical (same section list, same count, different tokens only).
- Craft was the only experience with >7 sections or `faqAccordion`.
- Most experiences differed only in where `trustBadges` sits relative to `categoryGrid`/`featuredProducts`.

---

## 3. Existing Apply Functions (Bundle Level — UNCHANGED by Phase O)

Phase O adds a new document-level apply layer. The three bundle-level functions below are untouched.

### 3.1 `buildExperienceSettingsOverlay(experience)` — line 431

Pure function. Emits exactly 10 keys: `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `textColor`, `surfaceColor`, `fontFamily`, `bodyFontFamily` (same value as `fontFamily`, for Liquid path), `headingFontFamily`, `borderRadius`. No side effects. Used by all three apply paths.

### 3.2 `applyExperienceToSettingsData(current, experience, mode)` — line 483

Builds the 10-key token overlay via `buildExperienceSettingsOverlay()`, G6-validates it via `validateExperienceOverlay()`, then merges it into the input `current` object. Returns a new plain `Record` — does NOT mutate input. Does NOT touch `templates[]`, `section_definitions`, `block_definitions`, `layout`, `locales`, `renderer`, or any structural `ThemeDocument` field. Used by the bundle/config path at store creation and the editor draft path.

### 3.3 `applyExperienceToTemplateConfig(templateConfig, experience)` — line 503

(1) Writes 10 token overlay keys into `templateConfig.themeSettings`. (2) Writes the same 10 keys into `templateConfig.config.settings_data.current`. (3) Sets `templateConfig.experienceId = experience.id`. G6-validates the overlay before writing. Returns new object. Does NOT touch template section structure, section ordering, or block configuration. This is the gateway store-creation path: `services/api-gateway/src/routes/stores.ts:672-673` calls `resolveExperienceForIndustry()` then `applyExperienceToTemplateConfig()`.

### 3.4 Editor `applyExperience(experienceId)` — editor `page.tsx` line 780

A React `useCallback` that calls `buildExperienceSettingsOverlay(experience)` and dispatches `applyChange()` to merge the 10-key overlay into `editorState.themeSettings`. This is a React editor-state operation, NOT a `ThemeDocument` operation. Overlay propagates to both React and Liquid paths via the editor's `buildDraftConfig()`. Does NOT touch any template structure.

### 3.5 Preservation Mandate

Both existing bundle-level apply functions (`applyExperienceToSettingsData`, `applyExperienceToTemplateConfig`) stay UNCHANGED. The editor's `applyExperience` callback stays UNCHANGED. Phase O adds a NEW document-level apply function (`applyExperienceToDocument`) that operates on `ThemeDocument` V2 only. The two layers are parallel and independent.

---

## 4. Key Discovery Findings

1. **Nova/Summit identity gap**: Prior to Phase O, nova and summit were structurally identical at the bundle level. Phase O adds `ctaSection` to Nova's index composition to establish real compositional distinction.

2. **faqAccordion / collectionFilter bundle gap**: These types are in `BUILT_IN_SECTION_TYPES` and mapped in `BUILT_IN_TO_LIQUID_SECTION_TYPE`, but the `faq-accordion` and `collection-filter` section definition files are absent from the Urban Kicks / LetBuyy Core bundle's `section_definitions`. Compositions that include them produce `'incompatible'` diff entries — the apply engine skips those sections rather than inserting invalid types.

3. **cta-section IS present**: `cta-section` is in the Urban Kicks bundle (via `createLiquidParitySectionFiles()`), which is what enables Nova's structural distinction from Summit.

4. **Section definitions are READ-ONLY**: RISK-DUAL-N01 from Phase N remains. The apply engine never touches `section_definitions`, `block_definitions`, `layout`, `locales`, or `renderer` — only `templates[]` and `config.settings_data.current`.

5. **Block content classification gap**: Prior to hardening, the apply engine incorrectly gated reusable block types (`category`, `product-card`) on `sectionAcceptsAppBlocks`, which caused silent block drops for retained sections. Hardening corrects this.
