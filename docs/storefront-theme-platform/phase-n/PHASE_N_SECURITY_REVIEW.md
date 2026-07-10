# Phase N Security Review — Prototype-Pollution, Bounds, Fail-Closed, No Dual Truth

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date:** 2026-07-10
**Branch:** `stepup/main`
**Scope:** `packages/theme-engine/src/theme-document.ts` + `theme-document-migrations.ts`

This review covers the four security dimensions required for all theme-engine modules that process merchant-controlled input: prototype-pollution defence, resource-bounding, fail-closed behaviour, and dual-truth prevention.

---

## 1. Prototype-Pollution Defence

### 1.1 Threat Model

A merchant or attacker who can write to a theme's settings, section IDs, or block IDs can attempt prototype pollution:
- `JSON.parse('{"__proto__":{"x":1}}')` produces an object where `__proto__` is an own enumerable property on the raw JS object.
- When Zod's `z.record()` processes this, it executes `output['__proto__'] = value` via bracket notation, which invokes the `Object.prototype` setter and changes the prototype of the output object rather than writing an own property. After this assignment, neither `Object.keys` nor `Object.getOwnPropertyNames` returns `__proto__` in the output.
- A post-parse check on the parsed output therefore cannot catch this case.

### 1.2 Defence in Depth (Three Layers)

**Layer 1 — Pre-parse raw scan** (`assertNoBlockedKeysInRaw`, lines 411–426 of `theme-document.ts`):

```typescript
function assertNoBlockedKeysInRaw(input: unknown, depth = 0): void {
  if (depth > 128 || input === null || typeof input !== 'object') return;
  if (Array.isArray(input)) { for (const item of input) assertNoBlockedKeysInRaw(item, depth + 1); return; }
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (BLOCKED_DOCUMENT_KEYS.has(key)) throw new Error(`Prototype-pollution key "${key}" detected...`);
    assertNoBlockedKeysInRaw((input as Record<string, unknown>)[key], depth + 1);
  }
}
```

This runs on the RAW input before `ThemeDocumentSchema.parse()` is called. At this point `__proto__` is still an own enumerable key on the raw object, so `Object.keys` returns it. The depth limit (128) bounds recursion well above the maximum document depth (~15 levels).

**Layer 2 — ID schema refine** (`ThemeDocumentIdSchema`, line 111):

```typescript
const ThemeDocumentIdSchema = z.string().min(1).max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine(id => !BLOCKED_DOCUMENT_KEYS.has(id), 'id is a blocked prototype-pollution key');
```

This catches `__proto__`, `constructor`, `prototype` as ID values at the Zod schema level, before `superRefine` runs.

**Layer 3 — Post-parse settings key check** (`ThemeDocumentSectionSchema.superRefine`, lines 219–227):

```typescript
for (const key of Object.getOwnPropertyNames(section.settings)) {
  if (BLOCKED_DOCUMENT_KEYS.has(key)) { ctx.addIssue(...); }
}
```

`Object.getOwnPropertyNames` (not `Object.keys`) is used here to catch both enumerable and non-enumerable own properties. This provides belt-and-suspenders coverage for the post-parse path, even though Layer 1 is the primary defence for the Zod z.record() bypass case.

### 1.3 Blocked Keys

```typescript
const BLOCKED_DOCUMENT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
```

This is a subset of `BLOCKED_DROP_KEYS` from `theme-renderer.ts:883`. The sets are intentionally separate to avoid a cross-module dependency that would couple the document schema to the renderer.

### 1.4 Test Coverage

- Test: `parseThemeDocument rejects __proto__ as a section id` — exercises Layer 2.
- Test: `parseThemeDocument rejects constructor as a block id` — exercises Layer 2.
- Test: `parseThemeDocument rejects prototype as a block id` — exercises Layer 2.
- Test: `JSON.parse-sourced __proto__ settings key is caught by the prototype-pollution guard` — exercises Layer 1 (the only test that targets the z.record() bypass path).

---

## 2. Resource Bounding

All bounds are named constants exported from `theme-document.ts`:

| Constant | Value | Enforced By |
|----------|-------|-------------|
| `MAX_BLOCK_NESTING_DEPTH` | 3 | `ThemeDocumentSectionSchema.superRefine` (recursive depth count) |
| `MAX_BLOCK_COUNT_PER_LEVEL` | 100 | `z.array(...).max(100)` on `block.children` and `section.blocks` |
| `MAX_SECTIONS_PER_TEMPLATE` | 200 | `z.array(...).max(200)` on `template.sections` |
| `MAX_TEMPLATES_PER_DOCUMENT` | 100 | `z.array(...).max(100)` on `document.templates` |
| ID length | max 64 | `ThemeDocumentIdSchema.max(64)` |
| Settings key length | max 120 | `z.string().min(1).max(120)` in record key schema |
| JSON field lengths | max 120 | All `type`, `key`, `name`, `layout` fields |
| `assertNoBlockedKeysInRaw` recursion depth | 128 | Explicit depth parameter in the guard function |

`MAX_BLOCK_NESTING_DEPTH = 3` mirrors `MAX_LIQUID_DROP_DEPTH = 4` from `theme-renderer.ts:879`. The block depth is set one level lower because the renderer's drop depth already includes the section context level.

The `settings_data.current` and `settings_data.presets` values use `ThemeDocumentSettingsSchema = z.record(z.string().min(1).max(120), ThemeBundleJsonSchema)`. `ThemeBundleJsonSchema` is lazy-recursive; its depth is not independently bounded here (mirroring the bundle schema). The outer document bounds (section count, template count) provide structural limits on the total settings volume.

**Total node count bound** (not yet implemented): Urban Kicks has ~40+ section definition files whose source can be up to 200kB each. A full `ThemeDocument` can approach 8MB. Phase R-S editor load is a performance concern (see RISK-PERF-N01 in `RISK_REGISTER.md`). A document-level `superRefine` bounding total source bytes is deferred to Phase R-S.

---

## 3. Fail-Closed Behaviour

### 3.1 Version Gate

`parseThemeDocument` rejects any `document_version` not in `KNOWN_THEME_DOCUMENT_VERSIONS`:

```typescript
export function parseThemeDocument(input: unknown): ThemeDocument {
  assertNoBlockedKeysInRaw(input);
  const doc = ThemeDocumentSchema.parse(input);  // Zod parse (schema.default kicks in for missing version)
  if (!isKnownThemeDocumentVersion(doc.document_version)) {
    throw new UnsupportedThemeDocumentVersionError(doc.document_version);
  }
  return doc;
}
```

The version gate runs AFTER the schema parse so that the version field is normalised (defaulted from schema if missing). This means:
- Missing `document_version` → schema default `'2026-07-document-v1'` → version IS known → passes.
- Explicit `'9999-future-v99'` → version NOT known → throws `UnsupportedThemeDocumentVersionError`.

This matches the bundle's `UnsupportedLiquidBundleSchemaVersionError` pattern exactly.

### 3.2 Adapter Fail-Closed Chains

`toThemeDocumentV2`:
1. `parseLiquidThemePackageBundle(bundle)` — rejects malformed bundle input.
2. `parseThemeDocument(raw)` — rejects malformed constructed document.

`fromThemeDocumentV2`:
1. `parseThemeDocument(doc)` — rejects malformed document input.
2. Explicit guard: throws `UnsupportedThemeDocumentFeatureError` if `block.children.length > 0`.
3. `parseLiquidThemePackageBundle(raw)` — rejects malformed reconstructed bundle.

Both adapters are fail-closed: an invalid input or invalid output is a hard error, not a silent degradation.

### 3.3 Migration Fail-Closed

`migrateToThemeDocumentV2`:
- UNKNOWN shape → `throw new Error(...)` (not `UnsupportedThemeDocumentVersionError`, which is reserved for known-format version mismatches).
- SHAPE-2 → `parseLiquidThemePackageBundle` rejects invalid bundle input before conversion.
- SHAPE-3 → bundle reconstruction passes through `parseLiquidThemePackageBundle`; missing liquid files produce an empty `section_definitions`, which causes template `superRefine` to reject any sections whose types are not empty. Callers with draftConfigs that lack liquid file anatomy will need to provide the source bundle as a fallback input (documented deferred concern for Phase P/R).

### 3.4 Block Children Fail-Closed

`fromThemeDocumentV2` throws rather than silently discarding `block.children`:

```typescript
if (b.children.length > 0) {
  throw new UnsupportedThemeDocumentFeatureError(
    'block.children are not yet supported in fromThemeDocumentV2 — deferred to Phase T'
  );
}
```

This converts what would be a silent data-loss (dropping the nested blocks without warning) into an explicit, actionable error that names the resolution phase.

---

## 4. Dual-Truth Prevention

### 4.1 The Risk

`ThemeDocumentSchema` embeds `section_definitions` (the bundle's Liquid section source files) and `block_definitions` (the bundle's Liquid block source files). These are the SAME objects as `bundle.sections` and `bundle.blocks`.

If the Phase R-S editor were to allow mutations to `section_definitions` or `block_definitions` when saving a draft, the document's embedded Liquid source would diverge from the canonical theme package version in the database, creating a silent second source of truth.

### 4.2 Enforced Convention (Phase N)

The `ThemeDocumentSchema` field comments in `theme-document.ts` mark these fields as READ-ONLY from the editor:

```typescript
/** Section Liquid files keyed by section type — READ-ONLY from editor; never mutated when saving a draft. */
section_definitions: z.record(..., ThemeLiquidSectionFileSchema).default({}),
/** Reusable block Liquid files keyed by block type — READ-ONLY from editor. */
block_definitions: z.record(..., ThemeLiquidBlockFileSchema).default({}),
```

The `layout` field carries the same comment:
```typescript
/** Layout file — READ-ONLY from editor; never mutated when saving a draft. */
layout: z.object({ theme: ThemeLiquidLayoutFileSchema }).strict(),
```

### 4.3 Mechanical Enforcement Required (Phase R-S)

Phase N establishes the convention; Phase R-S editor must enforce it mechanically:

1. When the editor opens a theme, it loads the `ThemeDocument` and uses `section_definitions`, `block_definitions`, and `layout` to populate the editing surface.
2. When the editor saves a draft, it must reconstruct the `ThemeDocument` by **copying** these READ-ONLY fields from the original load-time document, not from the editor's mutable state.
3. The save adapter must call `fromThemeDocumentV2(doc)` to validate that the reconstructed bundle is structurally sound before persisting.

This convention is tracked as RISK-DUAL-N01 in `RISK_REGISTER.md`.

### 4.4 `fromThemeDocumentV2` as a Validation Checkpoint

`fromThemeDocumentV2` calls `parseLiquidThemePackageBundle(raw)` as its final step. This means any draft document written by the editor must pass the full bundle schema validation before it can be saved. This provides a mechanical check against corruption even if the editor accidentally mutates `section_definitions` — the bundle validation will reject a document whose section files no longer match the template section types.

---

## 5. Summary of Security Properties

| Property | Status | Mechanism |
|----------|--------|-----------|
| `__proto__` pollution (raw input) | BLOCKED | `assertNoBlockedKeysInRaw` pre-parse scan |
| `constructor`/`prototype` as IDs | BLOCKED | `ThemeDocumentIdSchema.refine` |
| Blocked keys in settings | BLOCKED | `ThemeDocumentSectionSchema.superRefine` via `Object.getOwnPropertyNames` |
| Unknown document version | BLOCKED | `parseThemeDocument` version gate |
| Unknown bundle version | BLOCKED | `parseLiquidThemePackageBundle` inside adapters |
| Malformed doc input to `fromThemeDocumentV2` | BLOCKED | `parseThemeDocument(doc)` at entry |
| Malformed bundle output from `fromThemeDocumentV2` | BLOCKED | `parseLiquidThemePackageBundle(raw)` at exit |
| Silent block.children drop | BLOCKED | `UnsupportedThemeDocumentFeatureError` guard |
| Infinite recursion (block schema) | BLOCKED | `MAX_BLOCK_NESTING_DEPTH = 3` + `MAX_BLOCK_COUNT_PER_LEVEL = 100` |
| Infinite recursion (raw scan) | BLOCKED | Depth limit 128 in `assertNoBlockedKeysInRaw` |
| Dual-truth (section_definitions mutation) | CONVENTION (Phase R-S must enforce mechanically) | READ-ONLY comments + `fromThemeDocumentV2` validation checkpoint |
| theme-registry.ts ART-17 mutation | BLOCKED | File untouched by Phase N |
| Liquid canary flag change | BLOCKED | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` untouched |
