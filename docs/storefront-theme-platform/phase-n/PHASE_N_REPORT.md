# Phase N Report — Canonical Theme Document V2

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase N ships the editor-facing Theme Document V2 schema, two lossless adapters, and a shape-detection migration layer. No gateway routes, DB migrations, or frozen apps are modified.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/theme-engine/src/theme-document.ts` | 647 | `ThemeDocumentSchema`, `parseThemeDocument`, `toThemeDocumentV2`, `fromThemeDocumentV2`, version constants, error classes, bounds |
| `packages/theme-engine/src/theme-document-migrations.ts` | 135 | `migrateToThemeDocumentV2` — shape-detection layer accepting SHAPE-1/2/3 |
| `packages/theme-engine/test/theme-document.test.ts` | 756 | 37 tests: version gate, pollution guards, depth/uniqueness, round-trip (4 directions), ordering, render parity, hardening |
| `packages/theme-engine/test/theme-document-migrations.test.ts` | 169 | 9 tests: SHAPE-1/2/3 migration, UNKNOWN error, meta-property validity |

### 1.2 Modified Files (Surgical)

| File | Change |
|------|--------|
| `packages/theme-engine/src/index.ts` | 2 lines added — `export * from './theme-document'` and `export * from './theme-document-migrations'` (after existing `settings-schema-canonical` export) |

### 1.3 What Was Not Touched

- `theme-bundle.ts` — unchanged; bundle schema is canonical, Phase N adds a VIEW layer only.
- `theme-registry.ts` — frozen per ART-17.
- `theme-governance.ts` — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` stays `false`.
- DOMPurify sanitizer — unchanged.
- Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) — unchanged.
- DB migrations — none added.
- Gateway routes — none added.
- Foreign WIP files — untouched.

---

## 2. Test Gate Result

| Stage | Tests passing | Suites | Typecheck |
|-------|--------------|--------|-----------|
| Pre-Phase-N baseline | 643 | 18 | Clean |
| Post-implementation | 686 | 20 | Clean |
| Post-hardening (final) | **689** | **20** | **Clean** |

Net new tests: **+46** (37 in `theme-document.test.ts` + 9 in `theme-document-migrations.test.ts`).

The test gate is `pnpm typecheck test --filter=@letbuyy/theme-engine`. Result: **PASS** at 689/689, 0 fail, deterministic across two forced runs.

---

## 3. No Dual-Truth Statement

Phase N does NOT create a second source of truth for the bundle.

`ThemeDocument` is a VIEW of `LiquidThemePackageBundle`, not a parallel canonical format:

1. `toThemeDocumentV2(bundle)` derives a `ThemeDocument` from a bundle. The bundle remains canonical.
2. `fromThemeDocumentV2(doc)` reconstructs a `LiquidThemePackageBundle` from a `ThemeDocument`. The output is validated by `parseLiquidThemePackageBundle` before return.
3. `section_definitions` and `block_definitions` in the `ThemeDocument` are the Liquid source files from the source bundle. They are marked READ-ONLY from the editor (convention enforced by Phase R-S, documented in PHASE_N_SECURITY_REVIEW.md §4).
4. The structural round-trip proofs (bundle→doc→bundle deepEqual for minimal, Urban Kicks, and LetBuyy Core fixtures; doc→bundle→doc deepEqual for minimal fixture) confirm losslessness in all directions. See PHASE_N_TEST_REPORT.md §3.

If Phase R-S were to violate the READ-ONLY convention and mutate `section_definitions` via editor state, `fromThemeDocumentV2` would produce a bundle whose section files no longer match the template section types, and `parseLiquidThemePackageBundle.superRefine` would reject it. This is the mechanical backstop. See RISK-DUAL-N01 in RISK_REGISTER.md.

---

## 4. Losslessness Proof Summary

All four round-trip directions pass as tests:

| Direction | Fixture | Assertion type | Test # |
|-----------|---------|---------------|--------|
| bundle→doc→bundle | Minimal | Structural deepEqual | 15 |
| bundle→doc→bundle | Urban Kicks | Structural deepEqual + render parity (index template) | 16 |
| bundle→doc→bundle | LetBuyy Core | Structural deepEqual + render parity (index template) | 17 |
| doc→bundle→doc | Minimal | Structural deepEqual | 18 |

Settings-data passthrough key preservation (HIGH finding): extra keys in `config.settings_data` beyond `current` and `presets` survive the full `bundle→doc→bundle` cycle without loss. Verified by test 35.

Block children fail-closed (MEDIUM finding): docs with `block.children.length > 0` are accepted by `parseThemeDocument` but rejected by `fromThemeDocumentV2` with `UnsupportedThemeDocumentFeatureError`. Verified by test 36.

---

## 5. Code Review Findings — All Resolved

Six findings were identified and resolved during Phase N hardening (no open findings remain):

| ID | Severity | Status |
|----|----------|--------|
| N-F1 (settings_data passthrough lossiness) | HIGH | FIXED |
| N-F2 (silent block.children drop) | MEDIUM | FIXED |
| N-F3 (round-trip structural proof gap) | MEDIUM | FIXED |
| N-F4 (Object.keys vs getOwnPropertyNames + z.record bypass) | LOW | FIXED |
| N-F5 (double import in migrations.ts) | LOW | FIXED |
| N-F6 (redundant compatibility_range field) | LOW | FIXED |

Full dispositions: PHASE_N_TEST_REPORT.md §4.

---

## 6. Rollback

Rollback = revert the Phase N commit:

```bash
git revert <phase-n-commit-sha>
```

Phase N is a pure ADDITION to `packages/theme-engine/src/index.ts` (2 export lines) and three new source files + two new test files. No existing files were modified except `index.ts`. A revert removes all five new files and the two export lines. The bundle schema, renderer, registry, and all other existing theme-engine modules are unaffected.

No DB migrations were added, so no DB rollback is required.

No gateway routes were added, so no gateway rollback is required.

---

## 7. Risks Registered

Two new risks were added to RISK_REGISTER.md during Phase N:

- **RISK-DUAL-N01** (MEDIUM): `section_definitions` / `block_definitions` dual-truth risk — Phase R-S editor must treat these as READ-ONLY.
- **RISK-ARCH-N01** (LOW): Forward-compat gap — future phases that add fields to `ThemeDocumentSchema.strict()` MUST bump `THEME_DOCUMENT_VERSION` or old-version docs in DB will have new fields silently dropped.
- **RISK-PERF-N01** (LOW): Large document size — Urban Kicks with ~40+ section files may produce a ThemeDocument exceeding 8MB; Phase R-S editor must bound total source bytes.

---

## 8. Constraints Maintained

| Constraint | Status |
|------------|--------|
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| Bundle schema (`LiquidThemePackageBundleSchema`) unchanged | MAINTAINED |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps unchanged | MAINTAINED |
| No new DB migrations | MAINTAINED |
| No new gateway routes | MAINTAINED |
| Foreign WIP files undisturbed | MAINTAINED |
| `validate-governance.mjs` EXIT=1 pre-existing failure | UNCHANGED (pre-existing foreign drift, not introduced by Phase N) |

---

## 9. Phase Completion Checklist

- [x] `theme-document.ts` ships: schema, version gate, error classes, bounds, pollution guards, adapters
- [x] `theme-document-migrations.ts` ships: SHAPE-1/2/3 detection + migration
- [x] `index.ts` exports updated (2 lines, surgical)
- [x] 37 tests in `theme-document.test.ts` — all pass
- [x] 9 tests in `theme-document-migrations.test.ts` — all pass
- [x] Final gate: 689/689, 0 fail, typecheck clean
- [x] Round-trip proven in 4 directions (structural deepEqual)
- [x] Render parity proven for Urban Kicks and LetBuyy Core (both directions structural + index template HTML)
- [x] Settings-data passthrough keys proven lossless
- [x] Block.children fail-closed (not silently dropped)
- [x] Prototype-pollution defended at 3 layers (pre-parse scan + ID refine + post-parse getOwnPropertyNames)
- [x] All 6 code review findings resolved
- [x] No dual-truth: section_definitions READ-ONLY documented, mechanical backstop via parseLiquidThemePackageBundle
- [x] RISK_REGISTER.md updated with 3 new entries
- [x] PROGRAM_STATE.md updated: Phase N COMPLETE, next = O

---

## 10. Next Phase

**Phase O — Preset & Experience Engine 2.0**

Phase O builds on the ThemeDocument foundation:
- The `apply_preset` gateway route (CL-19: absent) must be designed with ThemeDocument V2 as the input/output shape.
- Preset application merges into `config.settings_data.current` and optionally remaps template section settings.
- Phase O must maintain the round-trip invariant: applying a preset to a ThemeDocument must produce a valid bundle via `fromThemeDocumentV2`.
