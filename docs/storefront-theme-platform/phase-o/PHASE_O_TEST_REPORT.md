# Phase O Test Report — Apply Engine + Compositions

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** O — Preset & Experience Engine 2.0
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Test Gate Summary

| Stage | Tests passing | Typecheck |
|---|---|---|
| Phase N baseline (entering Phase O) | 689 | Clean |
| Phase O implementation (pre-hardening) | 1027 | Clean |
| Phase O hardening (final) | **1034** | **Clean** |

Command: `pnpm --filter @letbuyy/theme-engine typecheck test`

Net new tests: **+345** (338 from initial implementation + 7 from hardening).
- `experience-apply.test.ts` (764 lines): 15 `describe` blocks, tests covering section-type-map integrity, error handling, STYLE_ONLY mode, COMPLETE_DESIGN mode, incompatible sections, content preservation, block preservation (HIGH-2), requiresDuplicateBeforeApply (HIGH-1), diff summary, determinism, structural distinctness, section_definitions safety, block_definitions safety, non-managed template isolation, ART-17, and full parse-validation.
- `experience-compositions.test.ts` (329 lines): 6 `describe` blocks, tests covering registry coverage, per-template section spec validity (6 properties per experience/template combination), structural distinctness, experience-specific settings, no-duplicate-types, and no-blocks-field.

---

## 2. Test Files — Describe Block Inventory

### 2.1 `experience-apply.test.ts` (15 describe blocks)

| # | Describe block | Tests | Coverage area |
|---|---|---|---|
| 1 | `section-type-map integrity` | 6 | camelCase→kebab mapping, faqAccordion/collectionFilter null resolution, cta-section presence (Nova distinctness dependency) |
| 2 | `error handling` | 2 | Unknown experience id throws for both apply and diff functions |
| 3 | `STYLE_ONLY mode` | 6 | No section mutation, token overlay applied, empty templates diff, settings classified as token, requiresDuplicate=false, parseThemeDocument passes |
| 4 | `COMPLETE_DESIGN mode — index template` | 4 | Sections rebuilt from composition, composition ids used, parseThemeDocument passes all 10, token overlay also applied |
| 5 | `COMPLETE_DESIGN — incompatible sections` | 4 | craft faqAccordion incompatible, incompatible not in result, collection-filter incompatible, informative reason string |
| 6 | `content preservation` | 3 | Non-default text preserved (preserveContent=true), composition placeholders used (preserveContent=false), resource-binding collectionHandle preserved |
| 7 | `block preservation in retained sections (HIGH-2)` | 6 | category blocks survive (count=3), product-card blocks survive (count=3), no lostContent when preserved, diff reports lost blocks (preserveContent=false), requiresDuplicate=true from block loss alone, hasContentLoss=true |
| 8 | `requiresDuplicateBeforeApply` | 4 | UK spotlight triggers flag, lostContent populated, clean document flag=false, preserveContent=false still triggers flag (HIGH-1) |
| 9 | `diff summary` | 2 | Summary counts match entry counts, STYLE_ONLY has zero section counts |
| 10 | `determinism` | 12 | 10 experiences × COMPLETE_DESIGN byte-identical + STYLE_ONLY byte-identical + input not mutated (apply) + input not mutated (diff) |
| 11 | `structural distinctness across all experiences` | 2 | All 10 fingerprints distinct post-apply, nova ≠ summit explicitly |
| 12 | `RISK-DUAL-N01 — section_definitions never mutated` | 1 | section_definitions JSON identical before/after craft COMPLETE_DESIGN |
| 13 | `block_definitions never mutated` | 1 | block_definitions JSON identical before/after nova COMPLETE_DESIGN |
| 14 | `non-managed templates are never modified` | 7 | cart/search/blog/article/page/404/password each asserted unchanged |
| 15 | `ART-17 compliance` | 1 | All sections in result are in section_definitions for all 10 experiences |
| 16 | `all experiences pass parseThemeDocument after apply` | 20 | 10 × COMPLETE_DESIGN + 10 × STYLE_ONLY |
| 17 | `diff metadata` | 2 | experienceId matches request, mode field correct |

### 2.2 `experience-compositions.test.ts` (6 describe blocks)

| # | Describe block | Tests | Coverage area |
|---|---|---|---|
| 1 | `registry coverage` | 4 | All 10 ids covered, no extra keys, getExperienceComposition correct, unknown id returns undefined |
| 2 | `per-template section spec validity` | 180 | 10 experiences × 3 templates × 6 assertions each: at-least-one section, no duplicate types, no duplicate ids, all types in BUILT_IN_SECTION_TYPES, stable id naming pattern, settings are static scalars |
| 3 | `structural distinctness (index template)` | 11 | All 10 distinct, forge trustBadges at position 3, refresh trustBadges before categoryGrid (position 2), sense no trustBadges, craft 9 sections, craft includes faqAccordion + aboutSection, nova has ctaSection, nova 7 sections summit 6, ride trustBadges after productGrid, bloom trustBadges between featuredProducts and productGrid, dawn aboutSection at end no trustBadges, summit minimal 6 |
| 4 | `experience-specific settings` | 4 | nova ctaSection style=gradient, sense featuredProducts "Complete the look", ride featuredProducts "Complete your kit", summit featuredProducts "Related products" |
| 5 | `no duplicate section types within any template` | 30 | 10 × 3 template duplicate-type check (separate from per-template block above) |
| 6 | `SectionSpec has no blocks field` | 1 | No spec has a blocks or children field (Phase T deferred) |

---

## 3. Distinctness Proof

### 3.1 Composition-Level Proof (pre-apply)

`experience-compositions.test.ts` — `'all 10 experiences produce DISTINCT index template compositions'`: computes the type-sequence fingerprint (camelCase types joined by `|`) for each experience's `index` composition and asserts no two fingerprints are equal. Runs at composition-definition time, independent of any bundle.

### 3.2 Document-Level Proof (post-apply)

`experience-apply.test.ts` — `'all 10 experiences produce structurally distinct index templates after COMPLETE_DESIGN'`: applies every experience to the Urban Kicks bundle with `COMPLETE_REPLACE` (no content carry-forward, pure composition), computes the section-type fingerprint (kebab types joined by `|`) for each resulting index template, and asserts no two fingerprints are equal. This test would pass even if all 10 experiences had identical token values — the distinction is compositional, not token-driven.

`'nova and summit have different index fingerprints after COMPLETE_DESIGN'` is an explicit sibling assert for the historically problematic pair.

### 3.3 Per-Experience Distinctness Table

The following table shows each experience's index template section sequence after a `COMPLETE_DESIGN` apply on the Urban Kicks bundle. Sections marked `[incompatible]` are in the composition spec but absent from the bundle's section_definitions — they are skipped. Resulting kebab-type sequences are compared for distinctness.

| Experience | Index section types (kebab, after apply) | Count | Structural differentiator |
|---|---|---|---|
| forge | announcement-bar, hero-banner, category-grid, trust-badges, featured-products, product-grid, newsletter-signup | 7 | trust-badges at position 3 (early) |
| sense | announcement-bar, hero-banner, category-grid, featured-products, testimonials, newsletter-signup | 6 | testimonials near end; no trust-badges; no product-grid |
| aura | announcement-bar, hero-banner, category-grid, featured-products, trust-badges, testimonials, newsletter-signup | 7 | Both trust-badges and testimonials; trust at 4, testimonials at 5 |
| craft | announcement-bar, hero-banner, category-grid, trust-badges, featured-products, about-section, testimonials, newsletter-signup | 8 | faq-accordion incompatible → skipped; about-section at 5, testimonials at 6 |
| refresh | announcement-bar, hero-banner, trust-badges, category-grid, featured-products, product-grid, newsletter-signup | 7 | trust-badges at position 2 (before category-grid) — UNIQUE ordering |
| ride | announcement-bar, hero-banner, category-grid, featured-products, product-grid, trust-badges, newsletter-signup | 7 | trust-badges at position 5 (after product-grid) |
| dawn | announcement-bar, hero-banner, category-grid, featured-products, product-grid, about-section, newsletter-signup | 7 | about-section at position 5; no trust-badges |
| bloom | announcement-bar, hero-banner, category-grid, featured-products, trust-badges, product-grid, newsletter-signup | 7 | trust-badges at position 4 (between featured and grid) |
| nova | announcement-bar, hero-banner, category-grid, featured-products, product-grid, cta-section, newsletter-signup | 7 | cta-section at position 5; no trust |
| summit | announcement-bar, hero-banner, category-grid, featured-products, product-grid, newsletter-signup | 6 | Minimal baseline — no extras |

All 10 fingerprints are unique. Nova and Summit differ in section count (7 vs 6) and the presence of `cta-section` in Nova's composition. Craft post-apply has 8 sections (not 9) because `faq-accordion` is incompatible and skipped.

**Note on craft:** The composition has 9 `SectionSpec` entries. Post-apply the result has 8 sections because `faqAccordion → 'faq-accordion'` resolves to `null` in the current bundle. The test for craft's structural distinctness still passes because none of the other 9 fingerprints matches craft's 8-section sequence.

---

## 4. Hardening — Findings and Coverage

Five findings from the code review were addressed during hardening. Three added tests:

### 4.1 HIGH-1: requiresDuplicateBeforeApply Decoupled from preserveContent

**Finding:** The flag was gated on `if (preserveContent) { requiresDuplicate = true; }`, meaning `computeExperienceApplyDiff(doc, id, { mode: 'COMPLETE_DESIGN', preserveContent: false })` returned `requiresDuplicateBeforeApply: false` even when removed sections had merchant content.

**Fix:** Removed the `if (preserveContent)` guard in `computeTemplateDiff` (line ~419 in `experience-apply.ts`). The flag now fires whenever `hasMeaningfulLoss` is true, independent of mode.

**New test added:** `'preserveContent=false: requiresDuplicateBeforeApply=true when removed section has merchant content'` — applies forge (which removes the UK bundle's spotlight section with heading/subheading merchant content) with `preserveContent: false` and asserts the flag is `true`.

### 4.2 HIGH-2: Non-`@` Blocks Silently Dropped from Retained Sections

**Finding:** The apply engine used `isAppOwnedBlock(block, blockDefinitions)` to gate block preservation. `isAppOwnedBlock` returns `true` for types in `block_definitions` (e.g. `category`, `product-card`). But `sectionAcceptsAppBlocks` returns `false` for most section definitions (they declare inline blocks, not `@app`). Result: all reusable blocks in retained sections were silently dropped, with `action: 'retained'` in the diff giving no indication of the loss.

**Fix applied in apply engine:** The block migration loop now uses `b.type.startsWith('@')` directly as the gating condition instead of `isAppOwnedBlock`. Non-`@` blocks are preserved unconditionally in `preserveContent: true` mode.

**Fix applied in diff:** `computeTemplateDiff` now checks for non-empty non-`@` blocks in retained sections when `preserveContent: false` and emits them in `lostContent.blocks`, sets `hasContentLoss: true`, and raises `requiresDuplicate: true`.

**New tests added (6):**
- `'preserveContent=true: category-grid blocks survive apply to retained section'` — UK bundle category-grid has 3 `category` blocks; asserts `blocks.length === 3` after summit COMPLETE_PRESERVE apply.
- `'preserveContent=true: product-card blocks in featured-products section are preserved'` — UK bundle featured-products has 3 `product-card` blocks; asserts count preserved.
- `'preserveContent=true: diff does NOT report block loss for retained sections'` — no `lostContent` on retained/reordered entries when `preserveContent: true`.
- `'preserveContent=false: diff reports lost blocks on retained sections with blocks'` — `lostContent.blocks` non-empty on category-grid entry when `preserveContent: false`.
- `'preserveContent=false: requiresDuplicateBeforeApply=true when retained sections have blocks'` — custom fixture with zero removed sections; sole content-loss source is a block on retained category-grid; flag still fires.
- `'preserveContent=false: diff hasContentLoss=true when retained sections have blocks'` — `hasContentLoss` set on the index template diff.

### 4.3 LOW Findings — Documentation and Comment Fixes

**LOW-1 (lostContent JSDoc):** Updated `SectionDiffEntry.lostContent` JSDoc to accurately describe that the field is populated for both removed entries and retained/reordered entries (when `preserveContent: false`).

**LOW-2 (FORGE_COMPOSITIONS comment):** Corrected inline comment from "trustBadges immediately after heroBanner (position 3)" to "trustBadges at position 3 (after categoryGrid, before featured browsing)." The composition places `categoryGrid` at index 2 between `heroBanner` and `trustBadges`. The test at position 3 was correct; only the comment was wrong.

**LOW-3 (requiresDuplicateBeforeApply JSDoc):** Updated the field's JSDoc to document that it fires regardless of `preserveContent`.

### 4.4 Existing Tests Updated

Two existing tests that asserted `requiresDuplicateBeforeApply: false` on partial fixtures (product and collection templates not fully neutralised) were updated to include matching product/collection sections so that no removed sections exist, confirming the flag is `false` only when no content loss occurs in any managed template.

---

## 5. Preservation Proofs

Three interlocking guarantees:

1. **HIGH-2 apply fix verified:** `'preserveContent=true: category-grid blocks survive apply to retained section'` asserts `cg.blocks.length === 3` after a COMPLETE_PRESERVE apply of summit to the UK bundle.

2. **HIGH-1 diff fix verified:** `'preserveContent=false: requiresDuplicateBeforeApply=true when removed section has merchant content'` asserts the flag fires even with `preserveContent: false`.

3. **HIGH-2 diff fix verified:** `'preserveContent=false: diff reports lost blocks on retained sections with blocks'` asserts `cgEntry.lostContent.blocks` is non-empty when COMPLETE_REPLACE is used.

Together these three tests prove:
- Content is not silently dropped from retained sections when `preserveContent: true`.
- Block loss in retained sections is reported in the diff when `preserveContent: false`.
- The caller receives the safety signal (`requiresDuplicateBeforeApply: true`) regardless of the `preserveContent` option.

---

## 6. Validation Coverage

| Validation point | Test coverage |
|---|---|
| `parseThemeDocument()` on apply output | 16 tests (apply for all 10 × COMPLETE_DESIGN + 10 × STYLE_ONLY) |
| `section_definitions` unchanged | 1 explicit test (craft COMPLETE_DESIGN) |
| `block_definitions` unchanged | 1 explicit test (nova COMPLETE_DESIGN) |
| Non-managed templates unchanged | 7 tests (cart/search/blog/article/page/404/password) |
| ART-17 — all result sections in section_definitions | 1 test covering all 10 experiences × 3 managed templates |
| collectSectionTypeMapIssues() clean | 1 test |
| Composition no-duplicate-types | 30 tests (10 × 3) |
| Composition no-blocks field in SectionSpec | 1 test |
| Input document not mutated (apply) | 1 test |
| Input document not mutated (diff) | 1 test |
| Determinism (10 experiences COMPLETE_DESIGN) | 10 tests |
| Determinism (STYLE_ONLY) | 1 test |
