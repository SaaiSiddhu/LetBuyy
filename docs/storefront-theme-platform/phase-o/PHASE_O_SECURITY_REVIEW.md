# Phase O Security Review — Content Preservation, Determinism, ART-17

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** O — Preset & Experience Engine 2.0
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Scope

Phase O adds a document-level experience apply engine operating exclusively within `packages/theme-engine`. It does not touch any gateway routes, DB migrations, authentication paths, payment code, or RLS policies. The security surface is confined to:

- Content preservation correctness (no silent merchant data loss).
- Determinism and input immutability (no side-channel state leakage).
- ART-17 compliance (no React-only sections inserted into ThemeDocument managed by the Liquid renderer).
- RISK-DUAL-N01 (section_definitions never mutated — preserving the Liquid source as the single source of truth).

---

## 2. Content Preservation — No Silent Loss

### 2.1 Classification Precedence

Every setting key+value pair in an existing section is classified before any decision is made about it:

1. TOKEN — the 10 overlay keys; always experience-owned.
2. RESOURCE-BINDING — keys bound to DB entities (collection/product handles, IDs). Identified by explicit set membership and key-name suffix patterns. Always preserved.
3. GENERATED-PLACEHOLDER — empty values or values equal to the schema-declared default. Safe to replace.
4. MERCHANT-CONTENT — everything else. Preserved when `preserveContent: true`.
5. APP-OWNED — block whose type starts with `'@'` (sentinel for LiquidAppBlock). Preserved only in sections that declare `@app` block acceptance.

### 2.2 Non-`@` Block Preservation (HIGH-2 Hardening)

Prior to hardening, the apply engine incorrectly routed reusable block types (e.g. `category`, `product-card`) through the `isAppOwnedBlock` gate. These types ARE registered in `block_definitions` (they are reusable across sections), but `sectionAcceptsAppBlocks` returns `false` for most section definitions because those definitions do not declare `@app` as an accepted block type. This caused silent drops of all non-`@` blocks from retained sections — Sneakers/Apparel/Accessories category blocks and Velocity Runner/Everyday Hoodie/Street Cap product-card blocks in the Urban Kicks fixture were silently discarded without any diff entry.

**Fix applied:** The apply engine now uses `b.type.startsWith('@')` directly as the gating condition for the app-block compatibility check. All non-`@` blocks (both inline-only block types and reusable block types in `block_definitions`) are unconditionally preserved in retained sections when `preserveContent: true`. This is correct: non-`@` blocks are always merchant content.

When `preserveContent: false`, non-`@` blocks in retained sections are NOT carried forward, and the diff surfaces each lost block in `lostContent.blocks`, sets `hasContentLoss: true`, and raises `requiresDuplicateBeforeApply: true`.

### 2.3 requiresDuplicateBeforeApply — Decoupled from preserveContent (HIGH-1 Hardening)

Prior to hardening, `requiresDuplicateBeforeApply` was gated on `if (preserveContent) { requiresDuplicate = true; }` in `computeTemplateDiff`. A caller who called `computeExperienceApplyDiff(doc, id, { mode: 'COMPLETE_DESIGN', preserveContent: false })` as a preview check would receive `requiresDuplicateBeforeApply: false` even when sections with merchant content or `@app` blocks would be removed.

**Fix applied:** The `if (preserveContent)` guard was removed. `requiresDuplicate` is now set to `true` whenever `hasMeaningfulLoss` is true — independent of `preserveContent`. The flag means "content would be permanently lost if this apply proceeds without a duplicate first," which is true regardless of whether the caller intends to attempt content migration on other sections.

Verified by the new test `'preserveContent=false: requiresDuplicateBeforeApply=true when removed section has merchant content'` (HIGH-1 coverage).

### 2.4 lostContent Population for Removed Sections

For every section that is removed (present in the old template but absent from the new composition):
- MERCHANT-CONTENT and RESOURCE-BINDING settings with non-empty/non-default values are collected into `lostContent.settings`.
- APP-OWNED blocks are collected into `lostContent.blocks`.
- `lostContent` is set regardless of `preserveContent`.

This means a caller who intends `preserveContent: false` (full replace) still receives a complete accounting of what would be permanently lost.

### 2.5 Same-Type Section Matching Limit

Content migration matches old sections to new composition positions by section type. When a template has two sections of the same type (compositions disallow this — enforced by test), only the first match's content is migrated. The compositions test enforces `findDuplicateTypes` returns empty for every experience/template pair, making this a non-issue in practice. The limit is documented rather than silently applied.

---

## 3. Determinism and Input Immutability

### 3.1 No Random or Time-Dependent Values

`applyExperienceToDocument` contains no `Date.now()`, `Math.random()`, `crypto.randomUUID()`, or any other non-deterministic operation. All composition section ids are hardcoded strings following the pattern `'{experienceId}-{camelType}-{templateKey}'`. All composition settings are static scalar literals.

`computeExperienceApplyDiff` is likewise entirely deterministic.

Verified by tests: for every experience id, two identical calls to `applyExperienceToDocument` with the same `(document, experienceId, options)` produce byte-identical JSON output.

### 3.2 Input Document Never Mutated

`applyExperienceToDocument` opens with `deepCloneDocument(document)` (JSON round-trip). All mutations target the clone. The original `document` parameter is never written to.

`computeExperienceApplyDiff` is pure — it reads `document.templates`, `document.section_definitions`, `document.block_definitions`, and `document.config.settings_data.current` but never writes any of these.

Verified by two tests:
- `'applyExperienceToDocument does NOT mutate the input document'` — JSON-stringifies the input before and after apply; asserts equality.
- `'computeExperienceApplyDiff does NOT mutate the input document'` — same pattern.

---

## 4. ART-17 Compliance — No React-Only Sections

ART-17 forbids adding new React section implementations after the freeze. Phase O's compositions consist exclusively of camelCase entries from `BUILT_IN_SECTION_TYPES`. The apply engine resolves each to a Liquid kebab type via `resolveLiquidSectionType()`, which returns `null` if the kebab type is absent from the document's `section_definitions`. Incompatible types are skipped — they are never inserted into the template.

The verification test `'no new React section types introduced in any composition'` applies all 10 experiences to the Urban Kicks bundle with `COMPLETE_REPLACE` and asserts that every section type in every managed template is a key in `doc.section_definitions`. This test would fail if any React-only type (absent from the Liquid section_definitions) were added to the compositions.

---

## 5. RISK-DUAL-N01 — section_definitions Never Mutated

Phase N registered RISK-DUAL-N01: mutating `section_definitions` in editor state would cause `fromThemeDocumentV2` to produce a bundle with divergent Liquid source.

Phase O's apply engine never writes to `section_definitions`, `block_definitions`, `layout`, `locales`, or `renderer`. The only touch targets are:
- `config.settings_data.current` (token overlay, both modes).
- `templates[key].sections` (section rebuild, COMPLETE_DESIGN managed templates only).

Mechanical backstop: `parseThemeDocument()` is called on the output before return. If the apply engine erroneously produced a section whose type is absent from `section_definitions`, the schema's `superRefine` would reject the document before it is returned.

Verified by test `'section_definitions is identical before and after COMPLETE_DESIGN apply'`.

---

## 6. Content Loss — Risk Assessment

| Content class | STYLE_ONLY loss | COMPLETE_DESIGN preserveContent=true | COMPLETE_DESIGN preserveContent=false |
|---|---|---|---|
| Token settings | Replaced | Replaced | Replaced |
| Merchant-content settings | None | Preserved (same-type migration) | Replaced (surfaced in diff) |
| Resource-binding settings | None | Preserved | Preserved (resource-binding always preserved) |
| Non-`@` blocks (retained section) | None | Preserved (unconditional) | Dropped (surfaced in diff; requiresDuplicate=true) |
| `@`-blocks (section accepts app) | None | Preserved | Dropped (surfaced in diff; requiresDuplicate=true) |
| Sections not in composition (removed) | N/A | Dropped (lostContent populated; requiresDuplicate if content present) | Dropped (same) |
| Incompatible section types (missing from bundle) | N/A | Not inserted (advisory diff entry) | Not inserted (advisory diff entry) |

Resource-binding settings are always preserved regardless of `preserveContent` because they bind to live DB entities (collections, products) and losing them silently would break merchant store functionality.

---

## 7. Summary of Security Properties

| Property | Status | Evidence |
|---|---|---|
| No silent merchant data loss | ACHIEVED | HIGH-2 block fix; `lostContent` populated for all removed entries; `requiresDuplicateBeforeApply` decoupled from `preserveContent` |
| Determinism | ACHIEVED | No Date.now/Math.random; JSON clone; composition ids hardcoded |
| Input immutability | ACHIEVED | deepCloneDocument opens every apply; diff is pure |
| ART-17 compliance | ACHIEVED | Incompatible-skip path; ART-17 test verifies all result sections are in section_definitions |
| RISK-DUAL-N01 | MAINTAINED | Engine only touches templates[] and settings_data.current; parseThemeDocument backstop |
| Resource-binding preservation | ACHIEVED | Always preserved regardless of mode or preserveContent |
| Block.children never set | ACHIEVED | SectionSpec has no blocks field; all blocks initialised as [] |
