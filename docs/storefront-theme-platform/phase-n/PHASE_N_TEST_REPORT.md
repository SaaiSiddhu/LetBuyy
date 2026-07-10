# Phase N Test Report — Theme Document V2: Test Inventory, Round-Trip Proof, Render-Parity Proof

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date:** 2026-07-10
**Branch:** `stepup/main`
**Gate command:** `pnpm typecheck test --filter=@letbuyy/theme-engine`

---

## 1. Test Count Summary

| Milestone | Tests passing | Suites | Delta |
|-----------|--------------|--------|-------|
| Phase N baseline (entering) | **643** | 18 | — |
| Phase N implementation | **686** | 20 | +43 |
| Phase N hardening | **689** | 20 | +3 |
| **Phase N final** | **689** | **20** | **+46 total** |

**Net new tests: +46** across 2 new test files (37 in `theme-document.test.ts` + 9 in `theme-document-migrations.test.ts`).

Typecheck: clean at both implementation and hardening stages.

---

## 2. Test Files

### 2.1 `packages/theme-engine/test/theme-document.test.ts` (756 lines, 37 tests)

#### Constants

| # | Test name |
|---|-----------|
| 1 | `theme-document: THEME_DOCUMENT_VERSION has the expected string value` |
| 2 | `theme-document: KNOWN_THEME_DOCUMENT_VERSIONS contains THEME_DOCUMENT_VERSION and is frozen` |

**Assertions:** `THEME_DOCUMENT_VERSION === '2026-07-document-v1'`; `Object.isFrozen(KNOWN_THEME_DOCUMENT_VERSIONS)`.

#### Version Gate

| # | Test name |
|---|-----------|
| 3 | `theme-document: parseThemeDocument with missing document_version defaults and passes (known)` |
| 4 | `theme-document: parseThemeDocument rejects an explicit unknown document_version (fail-closed)` |
| 5 | `theme-document: UnsupportedThemeDocumentVersionError has name, documentVersion, known` |
| 22 | `theme-document: unknown FUTURE document version is rejected fail-closed` |

Test 3 verifies that a missing `document_version` triggers the Zod schema default (`'2026-07-document-v1'`), which IS known, so the doc is accepted. Test 4 verifies that an explicit `'9999-future-v99'` throws `UnsupportedThemeDocumentVersionError`. Test 22 adds a second fail-closed test with a different future version string for redundancy.

#### Prototype-Pollution Guards

| # | Test name |
|---|-----------|
| 6 | `theme-document: parseThemeDocument rejects __proto__ as a section id` |
| 7 | `theme-document: parseThemeDocument rejects constructor as a block id` |
| 25 | `theme-document: prototype-pollution (__proto__) section id is rejected` |
| 26 | `theme-document: prototype-pollution (constructor) block id is rejected` |
| 27 | `theme-document: prototype-pollution (prototype) block id is rejected` |
| 37 | `theme-document: JSON.parse-sourced __proto__ settings key is caught by the prototype-pollution guard` |

Tests 6/7 and 25/26/27 exercise the `ThemeDocumentIdSchema.refine` path (Layer 2). Test 37 (hardening, LOW finding) exercises the `assertNoBlockedKeysInRaw` pre-parse scan (Layer 1) by constructing `JSON.parse('{"__proto__": {"injected": true}}')` as a settings object and verifying rejection.

#### Depth + Uniqueness Guards

| # | Test name |
|---|-----------|
| 8 | `theme-document: parseThemeDocument rejects block nesting depth > MAX_BLOCK_NESTING_DEPTH` |
| 9 | `theme-document: parseThemeDocument accepts block nesting depth exactly at MAX` |
| 10 | `theme-document: parseThemeDocument rejects duplicate section ids in same template` |
| 11 | `theme-document: parseThemeDocument rejects duplicate template keys` |
| 23 | `theme-document: excess block nesting depth is rejected` |
| 24 | `theme-document: duplicate section id is rejected` |

Tests 8/23 build a block tree at depth `MAX_BLOCK_NESTING_DEPTH + 1` (4) and verify rejection. Test 9 builds a tree at exactly `MAX_BLOCK_NESTING_DEPTH` (3) and verifies acceptance. Tests 10/24 and 11 verify `superRefine` duplicate checks.

#### Schema Binding Guards

| # | Test name |
|---|-----------|
| 28 | `theme-document: invalid parent-child relation is rejected (block type not allowed by section)` |
| 29 | `theme-document: malformed binding (section type not in section_definitions) is rejected` |

Test 28 uses `type: 'not-a-valid-block-type-xyz'` in a `spotlight` section that only accepts `badge` and `@app` blocks. Test 29 uses `type: 'non-existent-section-type'` not present in `section_definitions`.

#### `toThemeDocumentV2` Basic

| # | Test name |
|---|-----------|
| 12 | `theme-document: toThemeDocumentV2(minimal) produces a valid doc with THEME_DOCUMENT_VERSION` |
| 13 | `theme-document: toThemeDocumentV2(urbanKicks) produces doc with correct template count` |
| 14 | `theme-document: toThemeDocumentV2(letbuyyCoreBundle) does not throw` |

Test 13 verifies `doc.templates.length === Object.keys(bundle.templates).length` for the Urban Kicks fixture.

#### Round-Trip Proofs

| # | Test name | Kind |
|---|-----------|------|
| 15 | `theme-document: ROUND-TRIP bundle→doc→bundle for minimal fixture (deep-equal after re-parse)` | Structural deepEqual |
| 16 | `theme-document: ROUND-TRIP bundle→doc→bundle for Urban Kicks (structural + render-parity proof A)` | Structural deepEqual + render |
| 17 | `theme-document: ROUND-TRIP bundle→doc→bundle for LetBuyy Core fixture (structural + render-parity proof B)` | Structural deepEqual + render |
| 18 | `theme-document: ROUND-TRIP doc→bundle→doc produces equal doc for minimal fixture` | Structural deepEqual |

See §3 for the full proof specification.

#### Ordering Preservation

| # | Test name |
|---|-----------|
| 19 | `theme-document: section order is preserved through toThemeDocumentV2 (matches bundle order[])` |
| 20 | `theme-document: block order is preserved through toThemeDocumentV2 (matches bundle block_order[])` |

Test 19 iterates every template in the Urban Kicks doc and verifies `template.sections.map(s => s.id).slice(0, bundleOrderedIds.length)` matches `bundleTemplate.order.filter(id => id in bundleTemplate.sections)`.

Test 20 finds the `category-grid-default` section in the Urban Kicks `index` template and asserts `section.blocks.map(b => b.id)` deepEquals `bundle.templates.index.sections['category-grid-default'].block_order`.

#### `fromThemeDocumentV2` Validity

| # | Test name |
|---|-----------|
| 21 | `theme-document: fromThemeDocumentV2 output passes parseLiquidThemePackageBundle without throwing` |

#### Additional Gates (Mandatory from Phase N spec)

| # | Test name |
|---|-----------|
| 30 | `theme-document: deterministic hash stable across serializations` |
| 31 | `theme-document: Urban Kicks render parity via LiquidRenderer after doc round-trip` |
| 32 | `theme-document: LetBuyy Core render parity via LiquidRenderer after doc round-trip` |
| 33 | `theme-document: React fallback path is untouched (LiquidRenderer returns unsupported when no bundle)` |
| 34 | `theme-document: ThemeDocumentSchema.parse → re-serialize → re-parse produces equal document` |

Test 30 verifies `JSON.stringify(toThemeDocumentV2(bundle)) === JSON.stringify(toThemeDocumentV2(bundle))` for two independent calls. Test 33 verifies that `LiquidRenderer.render(...)` with no `liquidBundle` returns `status: 'unsupported'`, confirming the React fallback path is unaffected.

#### Hardening Tests (Added After Code Review Findings)

| # | Test name | Finding resolved |
|---|-----------|-----------------|
| 35 | `theme-document: settings_data passthrough keys survive bundle→doc→bundle round-trip` | HIGH: passthrough lossiness |
| 36 | `theme-document: fromThemeDocumentV2 throws UnsupportedThemeDocumentFeatureError for doc with non-empty block children` | MEDIUM: silent children drop |
| 37 | `theme-document: JSON.parse-sourced __proto__ settings key is caught by the prototype-pollution guard` | LOW: z.record() bypass |

---

### 2.2 `packages/theme-engine/test/theme-document-migrations.test.ts` (169 lines, 9 tests)

| # | Test name | Shape |
|---|-----------|-------|
| 1 | `theme-document-migrations: SHAPE-2 Urban Kicks bundle → returns valid ThemeDocument` | SHAPE-2 |
| 2 | `theme-document-migrations: SHAPE-1 already-valid ThemeDocument passes through unchanged` | SHAPE-1 |
| 3 | `theme-document-migrations: SHAPE-3 minimal editor draftConfig → produces valid ThemeDocument with correct sections` | SHAPE-3 |
| 4 | `theme-document-migrations: UNKNOWN shape throws Error (not UnsupportedThemeDocumentVersionError)` | UNKNOWN |
| 5 | `theme-document-migrations: migrateToThemeDocumentV2 on null input throws Error` | UNKNOWN (null) |
| 6 | `theme-document-migrations: migrateToThemeDocumentV2 on array input throws Error` | UNKNOWN (array) |
| 7 | `theme-document-migrations: result of migrateToThemeDocumentV2 is always parseThemeDocument-valid (Urban Kicks)` | Meta-property |
| 8 | `theme-document-migrations: result of migrateToThemeDocumentV2 is always parseThemeDocument-valid (minimal bundle)` | Meta-property |
| 9 | `theme-document-migrations: migrated document re-serializes and re-parses to equal value` | Serialization |

Test 4 verifies that the thrown error for an unknown shape is `instanceof Error` but NOT `instanceof UnsupportedThemeDocumentVersionError` — these are intentionally different error types for different failure modes.

Test 3 (SHAPE-3) constructs a minimal `draftConfig` with:
- `templates` as a Record (bundle-compatible form, no `document_version`, no `schema_version`).
- `config.settings_schema` present.
- `sections` as Liquid section files (so `section_definitions` populates correctly and `superRefine` can validate section types).

It then verifies: `doc.templates.length === 1`, `templates[0].key === 'index'`, `templates[0].sections[0].id === 'spotlight-draft'`, `templates[0].sections[0].type === 'spotlight'`, and the doc re-parses via `parseThemeDocument` without throwing.

---

## 3. Round-Trip Proof Specification

### 3.1 Four Directions

All four directions are proven by passing tests:

**Direction 1: bundle→doc→bundle (minimal — structural deepEqual)**

```typescript
const original = parseLiquidThemePackageBundle(createMinimalLiquidThemeBundleFixture());
const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)));
assert.deepEqual(JSON.parse(JSON.stringify(roundTripped)), JSON.parse(JSON.stringify(original)));
```

**Direction 2: bundle→doc→bundle (Urban Kicks — structural deepEqual + render parity proof A)**

```typescript
const originalParsed = parseLiquidThemePackageBundle(createUrbanKicksLiquidThemeBundleFixture());
const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)));
assert.deepEqual(JSON.parse(JSON.stringify(roundTripped)), JSON.parse(JSON.stringify(originalParsed)));
// Plus: renderer.render(roundTripped, 'index').contentForLayout === renderer.render(original, 'index').contentForLayout
```

**Direction 3: bundle→doc→bundle (LetBuyy Core — structural deepEqual + render parity proof B)**

Same pattern as Direction 2, using `createLetbuyyCoreLiquidThemeBundleFixture()`.

**Direction 4: doc→bundle→doc (minimal — structural deepEqual)**

```typescript
const doc = toThemeDocumentV2(createMinimalLiquidThemeBundleFixture());
const docAfterRoundTrip = toThemeDocumentV2(fromThemeDocumentV2(doc));
assert.deepEqual(JSON.parse(JSON.stringify(docAfterRoundTrip)), JSON.parse(JSON.stringify(doc)));
```

### 3.2 Structural vs Render Parity

| Proof type | What it catches |
|------------|----------------|
| Structural deepEqual (all directions) | Ordering changes, metadata field loss, settings_data passthrough key loss, template count changes, block metadata loss |
| Render parity (Urban Kicks + LetBuyy Core) | Rendering-equivalent content for the `index` template, confirming the Liquid engine produces identical output from both the original and reconstructed bundle |

The structural deepEqual proofs (implemented during hardening, resolving the MEDIUM finding) are the primary losslessness guarantee. Render parity is an independent second check confirming no rendering-visible regression.

### 3.3 Fixture Independence

Each round-trip test calls the fixture factory function independently. `createLetbuyyCoreLiquidThemeBundleFixture` internally calls `createUrbanKicksLiquidThemeBundleFixture` and JSON.parse/JSON.stringify + `LiquidThemePackageBundleSchema.parse` (`theme-bundle-core.ts:72–81`). Tests compare `JSON.parse(JSON.stringify(result))` to avoid object-identity false positives from shared references.

### 3.4 Settings-Data Passthrough Key Proof (Hardening — HIGH finding)

```typescript
const withExtra = {
  ...createMinimalLiquidThemeBundleFixture(),
  config: { ...base.config, settings_data: { ...base.config.settings_data, release_hint: 2, _meta: { source: 'test' } } },
};
const originalParsed = parseLiquidThemePackageBundle(withExtra);
const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(withExtra)));
assert.deepEqual(JSON.parse(JSON.stringify(roundTripped)), JSON.parse(JSON.stringify(originalParsed)));
```

This verifies that `release_hint: 2` and `_meta: { source: 'test' }` survive the full `bundle→doc→bundle` cycle, proving that `ThemeDocumentSettingsDataSchema.passthrough()` correctly flows extra keys through both adapters.

---

## 4. Code Review Findings Disposition

All six findings from the code review are resolved. No open findings remain.

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| N-F1 | HIGH | `settings_data.passthrough()` keys silently dropped in round-trip; structural Urban Kicks/Core tests used render-parity only | Changed `ThemeDocumentSettingsDataSchema` from `.strict()` to `.passthrough()`; destructure `{ current, presets, ...extra }` in `toThemeDocumentV2` and spread `extra`; spread full `settings_data` in `fromThemeDocumentV2`; added structural deepEqual assertions to Urban Kicks and LetBuyy Core tests. |
| N-F2 | MEDIUM | `fromThemeDocumentV2` silently dropped `block.children` without error | Added `UnsupportedThemeDocumentFeatureError` class; throw in `fromThemeDocumentV2` when any `block.children.length > 0`; added test asserting the throw with `Phase T` in message. |
| N-F3 | MEDIUM | Urban Kicks + LetBuyy Core round-trip tests asserted render parity only, not structural equality | Added `assert.deepEqual(JSON.parse(JSON.stringify(roundTripped)), JSON.parse(JSON.stringify(originalParsed)))` to both fixture tests. Both pass. |
| N-F4 | LOW | `Object.keys()` in `superRefine` could miss non-enumerable `__proto__` after Zod z.record() processing | Changed to `Object.getOwnPropertyNames` in `superRefine`; added `assertNoBlockedKeysInRaw` pre-parse scan as primary defence; added test for `JSON.parse`-sourced `__proto__` settings key. |
| N-F5 | LOW | Double import from `'./theme-bundle'` in `theme-document-migrations.ts` | Merged into single import statement. |
| N-F6 | LOW | Redundant `compatibility_range` explicit field in `toThemeDocumentV2` (already in spread) | Removed redundant line; spread `...parsed.package` carries `compatibility_range` alone. |
