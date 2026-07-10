# Phase N Plan — Canonical Theme Document V2: Design, Adapters, Gate, Migration

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date:** 2026-07-10
**Branch:** `stepup/main`
**ADR reference:** ADR-M-002 (ACCEPTED, reversible) — extend bundle with a versioned document view; V1→V2 migration for real current shapes; fail-closed unknown versions. ADR-M-003 (PROPOSED) — Phase N adopts the compatibility layer; AA finalizes source-of-truth.

---

## 1. Design Principles

All of these are enforced in code, not just documentation:

1. **ONE source of truth.** `LiquidThemePackageBundle` is canonical. `ThemeDocument` is a view. Neither replaces the other.
2. **LOSSLESS adapters.** `bundle→doc→bundle` and `doc→bundle→doc` are identity (verified by structural deepEqual round-trip tests including Urban Kicks and LetBuyy Core).
3. **FAIL-CLOSED version gate.** Unknown or future `document_version` throws `UnsupportedThemeDocumentVersionError`, not a silent parse error. Even if the schema defaults a missing version to the current one, an explicit unknown version is rejected after the parse step.
4. **PROTOTYPE-POLLUTION safe.** Pre-parse raw input scan (`assertNoBlockedKeysInRaw`) catches `__proto__`/`constructor`/`prototype` before Zod processes the input. Post-parse `superRefine` uses `Object.getOwnPropertyNames` for belt-and-suspenders coverage on the parsed output.
5. **BOUNDED.** Depth, node count, and field sizes are hard-capped with named constants.
6. **DETERMINISTIC.** Templates are sorted alphabetically by key in `toThemeDocumentV2`, ensuring that `doc→bundle→doc` round-trips produce identical JSON regardless of JS object insertion order.

---

## 2. New Files

### 2.1 `packages/theme-engine/src/theme-document.ts` (647 lines, new)

#### Constants

```typescript
export const THEME_DOCUMENT_VERSION = '2026-07-document-v1';
export const KNOWN_THEME_DOCUMENT_VERSIONS: readonly string[] = Object.freeze([THEME_DOCUMENT_VERSION]);
const BLOCKED_DOCUMENT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_BLOCK_NESTING_DEPTH = 3;
const MAX_BLOCK_COUNT_PER_LEVEL = 100;
const MAX_SECTIONS_PER_TEMPLATE = 200;
const MAX_TEMPLATES_PER_DOCUMENT = 100;
```

#### Error Classes

```typescript
export class UnsupportedThemeDocumentVersionError extends Error {
  readonly documentVersion: string;
  readonly known: readonly string[];
}

export class UnsupportedThemeDocumentFeatureError extends Error {
  readonly feature: string;
}
```

`UnsupportedThemeDocumentFeatureError` is thrown by `fromThemeDocumentV2` when `block.children` is non-empty (modelled in Phase N, bundle serialisation deferred to Phase T). This converts a silent data-loss into a fail-closed error.

#### ID Schema

```typescript
const ThemeDocumentIdSchema = z.string().min(1).max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine(id => !BLOCKED_DOCUMENT_KEYS.has(id), 'id is a blocked prototype-pollution key');
```

#### Recursive Block Schema

```typescript
export interface ThemeDocumentBlock {
  id: string; type: string; settings: Record<string, ThemeBundleJson>;
  disabled: boolean; children: ThemeDocumentBlock[];
}
// Explicit ZodType<ThemeDocumentBlock> annotation required to break the recursive type cycle.
export const ThemeDocumentBlockSchema: z.ZodType<ThemeDocumentBlock> = z.lazy(() =>
  z.object({ id: ThemeDocumentIdSchema, type, settings, disabled, children: z.array(ThemeDocumentBlockSchema).max(100).default([]) }).strict()
);
```

Depth is enforced in `ThemeDocumentSectionSchema.superRefine` (not inside the block schema itself, to avoid lazy-within-lazy recursion issues).

#### Section Schema

`ThemeDocumentSectionSchema` — `superRefine` enforces:
1. Block nesting depth ≤ `MAX_BLOCK_NESTING_DEPTH` (3).
2. Block id uniqueness within the section (all nesting levels, via recursive collector).
3. Prototype-pollution check on settings keys using `Object.getOwnPropertyNames`.

#### Template Schema

```typescript
export const ThemeDocumentTemplateSchema = z.object({
  key: z.string().min(1).max(120),
  name: z.string().max(120).optional(),
  layout: z.string().max(120).optional(),
  sections: z.array(ThemeDocumentSectionSchema).max(200).default([]),
}).strict();
```

#### Settings Data Schema

```typescript
export const ThemeDocumentSettingsDataSchema = z.object({
  current: ThemeDocumentSettingsSchema,
  presets: z.record(z.string().min(1).max(120), ThemeDocumentSettingsSchema).default({}),
}).passthrough();  // .passthrough() mirrors ThemeBundleSettingsDataSchema to preserve extra keys
```

`.passthrough()` (not `.strict()`) is critical: `ThemeBundleSettingsDataSchema` uses `.passthrough()` so bundles may carry extra keys beyond `current` and `presets`. Using `.strict()` here would silently discard them in the round-trip.

#### Document Schema

```typescript
export const ThemeDocumentSchema = z.object({
  document_version: z.string().min(1).max(40).default(THEME_DOCUMENT_VERSION),
  bundle_schema_version: z.string().min(1).max(40),
  package: ThemeBundlePackageMetadataSchema.extend({ compatibility_range: ... }),
  layout: z.object({ theme: ThemeLiquidLayoutFileSchema }).strict(),
  config: z.object({ settings_schema: ThemeBundleSettingsSchema, settings_data: ThemeDocumentSettingsDataSchema }),
  section_definitions: z.record(..., ThemeLiquidSectionFileSchema).default({}),
  block_definitions: z.record(..., ThemeLiquidBlockFileSchema).default({}),
  locales: z.record(z.string(), ThemeBundleLocaleSchema).default({}),
  renderer: ThemeLiquidRendererManifestSchema,
  templates: z.array(ThemeDocumentTemplateSchema).max(100).default([]),
}).strict().superRefine(...)
```

`superRefine` on the document enforces:
1. No duplicate template keys.
2. No duplicate section IDs within each template.
3. Section types resolve to `section_definitions`.
4. Block types are allowed by the section (inline, reusable, or `@app`).

#### Pre-Parse Pollution Guard

`assertNoBlockedKeysInRaw(input, depth = 0)` walks the raw input recursively (depth-bounded at 128) before Zod processes it. This catches `JSON.parse('{"__proto__":...}')` inputs where `__proto__` is still an own-enumerable property on the raw object, which Zod's `z.record()` would otherwise convert into a prototype setter call (invisible to post-parse checks).

#### `parseThemeDocument(input: unknown): ThemeDocument`

1. Calls `assertNoBlockedKeysInRaw(input)`.
2. Calls `ThemeDocumentSchema.parse(input)`.
3. Rejects any `document_version` not in `KNOWN_THEME_DOCUMENT_VERSIONS` — even if the schema defaulted a missing version to the current known value, an explicit unknown version throws.

#### Adapter: `toThemeDocumentV2(bundle)`

1. Re-validates source bundle via `parseLiquidThemePackageBundle` (enforces G4 version gate).
2. Converts `templates` Record to alphabetically-sorted array (determinism guarantee for `doc→bundle→doc`).
3. For each template: maps `order[]` first (ordered section IDs), then appends any sections not in `order[]` (lossless).
4. For each section: maps `block_order[]` first, then appends extra blocks (lossless).
5. Destructures `settings_data` as `{ current, presets, ...extra }` and spreads `extra` into the doc (passthrough key preservation).
6. Returns `parseThemeDocument(raw)` — fail-closed.

#### Adapter: `fromThemeDocumentV2(doc)`

1. Re-validates source doc via `parseThemeDocument(doc)`.
2. Fail-closed guard: throws `UnsupportedThemeDocumentFeatureError` if any `block.children.length > 0`.
3. Rebuilds `templates` Record from ordered array (array index → `order[]` / `block_order[]`).
4. Spreads full `settings_data` (including passthrough keys) back into bundle.
5. Returns `parseLiquidThemePackageBundle(raw)` — fail-closed.

---

### 2.2 `packages/theme-engine/src/theme-document-migrations.ts` (135 lines, new)

`migrateToThemeDocumentV2(raw: unknown): ThemeDocument`

Shape detection, ordered most-specific first:

| Shape | Discriminator | Action |
|-------|--------------|--------|
| SHAPE-1 | `typeof r.document_version === 'string' && Array.isArray(r.templates)` | Already a ThemeDocument → `parseThemeDocument(raw)` |
| SHAPE-2 | `typeof r.schema_version === 'string' && r.renderer?.engine === 'liquid'` | LiquidThemePackageBundle → `toThemeDocumentV2(parseLiquidThemePackageBundle(raw))` |
| SHAPE-3 | `typeof r.templates === 'object' && !Array.isArray(r.templates) && r.config?.settings_schema !== undefined` | Editor draftConfig → reconstruct bundle-compatible object, then `toThemeDocumentV2(parseLiquidThemePackageBundle(bundleLike))` |
| UNKNOWN | None match | `throw new Error('Cannot migrate unknown shape...')` (NOT `UnsupportedThemeDocumentVersionError`) |

SHAPE-3 rules:
- Uses `r.templates` (bundle-compatible Record form) as authoritative.
- Ignores `r.themeSettings` (editor-internal flat map) and `r.sections` when it is the editor-internal `{ header, footer, template[] }` array form.
- Uses `r.sections` when it looks like a Liquid file dictionary (values have `path` + `source` fields).
- Falls back to minimal defaults for missing required bundle fields (`layout`, `renderer`, `package`).

---

### 2.3 `packages/theme-engine/src/index.ts` (2 lines added, surgical)

After existing `export * from './settings-schema-canonical'`:
```typescript
// Phase N — Theme Document V2 (editor-facing stable-id view; lossless adapters)
export * from './theme-document';
export * from './theme-document-migrations';
```

No other files were modified.

---

## 3. Version Gate Design

Pattern mirrors `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` + `UnsupportedLiquidBundleSchemaVersionError` exactly:

```typescript
export const KNOWN_THEME_DOCUMENT_VERSIONS = Object.freeze([THEME_DOCUMENT_VERSION]);
export class UnsupportedThemeDocumentVersionError extends Error { ... }
export function isKnownThemeDocumentVersion(v: string): boolean { ... }
export function parseThemeDocument(input: unknown): ThemeDocument {
  assertNoBlockedKeysInRaw(input);
  const doc = ThemeDocumentSchema.parse(input);
  if (!isKnownThemeDocumentVersion(doc.document_version)) {
    throw new UnsupportedThemeDocumentVersionError(doc.document_version);
  }
  return doc;
}
```

When a future phase adds fields to `ThemeDocumentSchema`, it MUST:
1. Bump `THEME_DOCUMENT_VERSION` to a new string (e.g. `'2026-09-document-v2'`).
2. Add the new version to `KNOWN_THEME_DOCUMENT_VERSIONS`.
3. Write a migration in `theme-document-migrations.ts` that upgrades SHAPE-1 docs from the old version.

Failure to bump the version causes `.strict()` to silently drop the new fields when reading old-version docs from DB — the `.strict()` + version gate pattern is the only protection against silent forward-compat corruption.

---

## 4. Block Children — Modelled, Not Yet Serialised

`ThemeDocumentBlock.children: ThemeDocumentBlock[]` is modelled in Phase N:
- `parseThemeDocument` accepts and validates docs with non-empty `children`.
- Depth enforcement (≤ 3) and uniqueness enforcement (all recursive levels) are active.
- `fromThemeDocumentV2` throws `UnsupportedThemeDocumentFeatureError` for any doc where any block has non-empty `children`.

This makes Phase N a clean foundation for Phase T (Section Groups + Nested Blocks) without any silent data loss:
- Phase T implements bundle serialisation for `children`.
- Until then, the error is explicit and informative.

---

## 5. Determinism Guarantee

`toThemeDocumentV2` sorts templates alphabetically by key:
```typescript
Object.entries(parsed.templates)
  .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  .map(...)
```

This is required because `JSON.parse` → `Object.entries` insertion order is not guaranteed to be stable across serialisation cycles. The alphabetical sort makes `doc→bundle→doc` deterministic regardless of JS engine map insertion order.

Sections within templates follow `order[]` (bundle's declared ordering), not key-insertion order. Blocks follow `block_order[]`. Any section or block IDs present in the Record but absent from the corresponding order array are appended last (lossless recovery of ordering anomalies).

---

## 6. Self-Contained Design

`ThemeDocumentSchema` embeds the full bundle anatomy:
- `section_definitions` = the bundle's `sections` (Liquid source files, keyed by type).
- `block_definitions` = the bundle's `blocks` (Liquid source files, keyed by type).

This makes `fromThemeDocumentV2` independent: it can reconstruct a full, valid bundle without a second DB lookup. The Phase R-S editor MUST treat `section_definitions` and `block_definitions` as READ-ONLY fields: they are loaded from the original bundle on open and never mutated from editor state (see `PHASE_N_SECURITY_REVIEW.md` §4 for the dual-truth risk).

---

## 7. What Phase N Does Not Change

| Component | Status |
|-----------|--------|
| `theme-registry.ts` | Untouched (FROZEN per ART-17) |
| `theme-bundle.ts` | Untouched (schema_version unchanged, no new Zod schemas added) |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | Stays `false` |
| DOMPurify sanitizer | Untouched |
| Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) | Untouched |
| Foreign WIP files | Untouched |
| DB migrations | None added |
| Gateway routes | None added |
