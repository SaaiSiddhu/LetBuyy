# Phase O Report — Preset & Experience Engine 2.0

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase O ships the document-level complete-experience-design system. No gateway routes, DB migrations, frozen apps, or existing bundle-level apply functions are modified.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/theme-engine/src/section-type-map.ts` | 109 | camelCase BUILT_IN_SECTION_TYPES ↔ Liquid kebab-case bridge; 25 entries; `resolveLiquidSectionType()`; governance integrity check |
| `packages/theme-engine/src/experience-compositions.ts` | 373 | Per-experience per-template `SectionSpec` compositions; 10 entries × 3 templates each; `getExperienceComposition()` |
| `packages/theme-engine/src/experience-apply.ts` | 719 | Apply engine: `ExperienceApplyMode`, `SectionDiffEntry`, `ExperienceApplyDiff`, `computeExperienceApplyDiff`, `applyExperienceToDocument`; content classification engine; RISK-DUAL-N01 enforcement |
| `packages/theme-engine/test/experience-apply.test.ts` | 764 | 15 describe blocks; covers all apply modes, content preservation, block survival, safety flags, determinism, structural distinctness, RISK-DUAL-N01, ART-17 |
| `packages/theme-engine/test/experience-compositions.test.ts` | 329 | 6 describe blocks; registry coverage, per-template spec validity (6 assertions × 30 combinations), structural distinctness, experience-specific settings |

### 1.2 Modified Files (Surgical)

| File | Change |
|------|--------|
| `packages/theme-engine/src/index.ts` | 3 lines added — `export * from './section-type-map'`, `export * from './experience-compositions'`, `export * from './experience-apply'` — placed after the Phase N block |

### 1.3 What Was Not Touched

- `theme-presets.ts` — existing apply functions (`applyExperienceToSettingsData`, `applyExperienceToTemplateConfig`, `buildExperienceSettingsOverlay`) unchanged.
- `theme-registry.ts` — frozen (ART-17).
- `theme-governance.ts` — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` stays `false`.
- `theme-bundle.ts`, `theme-document.ts`, `theme-bundle-core.ts` — unchanged.
- DOMPurify sanitizer — unchanged.
- `services/api-gateway/src/routes/stores.ts` — the existing `applyExperienceToTemplateConfig` call path is untouched.
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — the editor's `applyExperience` callback is untouched.
- Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) — unchanged.
- DB migrations — none added.
- Gateway routes — none added.
- Foreign WIP files — untouched.

---

## 2. Test Gate Result

| Stage | Tests passing | Typecheck |
|-------|--------------|-----------|
| Phase N baseline (entering Phase O) | 689 | Clean |
| Phase O implementation (pre-hardening) | 1027 | Clean |
| Phase O hardening (final) | **1034** | **Clean** |

Command: `pnpm --filter @letbuyy/theme-engine typecheck test`

Net new tests: **+345**. 0 failures, deterministic.

---

## 3. Key Design Decisions

### 3.1 Two-Layer Parallel Architecture

Phase O's document-level apply is strictly additive and parallel to the existing bundle-level apply layer. There is no call from the document-level engine to the bundle-level functions except for `buildExperienceSettingsOverlay()` and `validateExperienceOverlay()` (reused as pure utilities). The two layers operate independently:

- Bundle level: `applyExperienceToSettingsData` / `applyExperienceToTemplateConfig` — store creation and editor draft paths.
- Document level: `applyExperienceToDocument` / `computeExperienceApplyDiff` — Phase O and later phases.

### 3.2 Fail-Closed Schema Gate

Every call to `applyExperienceToDocument` ends with `parseThemeDocument(cloned)` before returning. An incompatible section type (absent from `section_definitions`) causes `resolveLiquidSectionType()` to return `null`, and the apply engine skips the section rather than inserting it. If a bug in the engine produced an invalid document, the schema validation would throw rather than return a corrupt `ThemeDocument` to the caller.

### 3.3 Nova/Summit Structural Distinction

Pre-Phase O, nova and summit used the same `COMMERCE_BASE_SECTIONS` spread and were structurally identical at the bundle level. Phase O's `NOVA_COMPOSITIONS.index` adds `ctaSection` (with `settings: { style: 'gradient' }`) at position 5, giving nova a 7-section index vs summit's 6-section index. Verified by `cta-section` presence in the UK bundle's `section_definitions` and by explicit post-apply fingerprint tests.

### 3.4 faqAccordion / collectionFilter as Advisory Incompatibles

Craft's index includes `faqAccordion` and every experience's collection composition includes `collectionFilter`. Both types map to kebab strings (`faq-accordion`, `collection-filter`) in `BUILT_IN_TO_LIQUID_SECTION_TYPE`, but neither is present in the Urban Kicks / LetBuyy Core bundle's `section_definitions`. Rather than block the apply, the engine skips incompatible types and reports them as advisory `'incompatible'` entries in the diff. The remaining compatible sections are applied normally. Adding these section definitions to the bundle in a future phase will make the compositions fully compatible without any change to Phase O code.

---

## 4. Hardening Summary

Five findings from code review were resolved:

| Finding | Severity | Resolution |
|---|---|---|
| `requiresDuplicateBeforeApply` silent when `preserveContent: false` | HIGH-1 | Removed `if (preserveContent)` guard; flag fires whenever `hasMeaningfulLoss` is true |
| Non-`@` blocks silently dropped from retained sections | HIGH-2 | Apply engine now uses `b.type.startsWith('@')` directly; diff surfaces block loss in `lostContent.blocks` |
| `lostContent` JSDoc inaccurate (only described removed entries) | LOW | Updated to describe both removed and retained/reordered entry cases |
| FORGE_COMPOSITIONS comment wrong (trustBadges placement) | LOW | Corrected to describe actual position 3 (after categoryGrid) |
| `requiresDuplicateBeforeApply` JSDoc omitted `preserveContent` precondition | LOW | Updated to document flag fires independent of `preserveContent` |

7 new tests added during hardening; 2 existing tests updated to cover both product and collection templates in custom fixtures.

---

## 5. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| Bundle schema (`LiquidThemePackageBundleSchema`) unchanged | MAINTAINED |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps unchanged | MAINTAINED |
| No new DB migrations | MAINTAINED |
| No new gateway routes | MAINTAINED |
| Foreign WIP files undisturbed | MAINTAINED |
| `validate-governance.mjs` EXIT=1 pre-existing failure | UNCHANGED (pre-existing foreign drift, not introduced by Phase O) |
| RISK-DUAL-N01 (section_definitions READ-ONLY) | MAINTAINED + verified by test |
| Block.children never set | MAINTAINED — SectionSpec has no blocks field |

---

## 6. Rollback

Rollback = revert the Phase O commit:

```bash
git revert <phase-o-commit-sha>
```

Phase O adds three new source files, two new test files, and three export lines to `index.ts`. No existing files were structurally modified except `index.ts` (three additive export lines). A revert removes all five new files and the three export lines. The bundle schema, renderer, registry, existing apply functions, and all other existing theme-engine modules are unaffected.

No DB migrations were added; no DB rollback required.

No gateway routes were added; no gateway rollback required.

---

## 7. Risks Registered

Two new risks are added to RISK_REGISTER.md:

- **RISK-O01** (LOW): Nova/Summit distinctness collapses if `cta-section` is removed from the Urban Kicks / LetBuyy Core bundle. Currently `cta-section` is generated by `createLiquidParitySectionFiles()` as part of the parity set. If that file were removed or its type renamed, Nova's `ctaSection` spec would produce `'incompatible'` diff entries and the post-apply fingerprints of Nova and Summit would be identical. Target: any phase modifying the Liquid parity section set.

- **RISK-O02** (LOW): `collectionFilter` and `faqAccordion` are permanently `'incompatible'` on current bundle documents until corresponding `collection-filter.liquid` and `faq-accordion.liquid` section definition files are added to the Urban Kicks / LetBuyy Core bundle. This is a bundle expansion task, not a Phase O bug. The advisory diff entries ensure callers are informed. Target: future bundle expansion phase (beyond AE scope unless marketplace requires these types).

---

## 8. Phase Completion Checklist

- [x] `section-type-map.ts`: 25 camelCase→kebab mappings, `resolveLiquidSectionType()`, `collectSectionTypeMapIssues()`
- [x] `experience-compositions.ts`: 10 experiences × 3 templates; structurally distinct index compositions; no blocks field; stable ids; static settings
- [x] `experience-apply.ts`: `ExperienceApplyMode`, classification engine, `computeExperienceApplyDiff` (pure), `applyExperienceToDocument` (fail-closed), RISK-DUAL-N01 enforced
- [x] `index.ts` exports updated (3 lines, surgical)
- [x] Final gate: 1034/1034, 0 fail, typecheck clean
- [x] All 10 experiences produce structurally distinct index templates post-apply (fingerprint test)
- [x] Nova and Summit structurally distinct (explicit test)
- [x] Non-`@` blocks preserved in retained sections when `preserveContent: true` (HIGH-2 fix)
- [x] Block loss reported in diff and `requiresDuplicate` raised when `preserveContent: false` (HIGH-2 fix)
- [x] `requiresDuplicateBeforeApply` fires independent of `preserveContent` (HIGH-1 fix)
- [x] All 3 LOW findings resolved (JSDoc + comment corrections)
- [x] Resource-binding settings always preserved
- [x] Determinism verified (10 × COMPLETE_DESIGN + STYLE_ONLY byte-equal on identical inputs)
- [x] Input document never mutated (apply + diff)
- [x] RISK-DUAL-N01 verified by test (section_definitions unchanged)
- [x] ART-17 verified by test (all result sections in section_definitions)
- [x] RISK_REGISTER.md updated with 2 new entries (RISK-O01, RISK-O02)
- [x] PROGRAM_STATE.md updated: Phase O COMPLETE, next = P

---

## 9. Next Phase

**Phase P — Drafts, Revisions, Publish, and Rollback**

Phase P builds on the ThemeDocument V2 foundation (Phase N) and the complete-experience-design system (Phase O) to implement the full draft lifecycle:

- `theme_editor_drafts` table (or equivalent persistence layer) for storing `ThemeDocument` V2 drafts.
- `apply_preset` gateway route (CL-19: absent) — the apply function is now available as `applyExperienceToDocument`.
- Draft vs published version management, revision history, and rollback.
- Phase P must maintain the `fromThemeDocumentV2` round-trip invariant on every draft save.
- Gate: `pnpm typecheck test --filter=@letbuyy/theme-engine`, baseline **1034**.
