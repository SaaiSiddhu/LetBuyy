// ============================================================================
// Phase N — Theme Document V2
// ----------------------------------------------------------------------------
// The editor-facing, ID-stable, versioned representation of a Liquid theme.
// ThemeDocument is the EDITING surface; LiquidThemePackageBundle stays the
// RENDERED + PERSISTED artifact. These two views are losslessly interchangeable
// via toThemeDocumentV2 / fromThemeDocumentV2 adapters defined here.
//
// Design rules (non-negotiable):
//   - ONE source of truth: bundle is canonical; doc is a view.
//   - LOSSLESS adapters: bundle→doc→bundle and doc→bundle→doc are identity.
//   - FAIL-CLOSED version gate: unknown document_version throws.
//   - PROTOTYPE-POLLUTION safe: id and settings key validation.
//   - BOUNDED: depth, node count, field sizes all hard-capped.
//   - DETERMINISTIC: template array sorted by key for stable serialization.
// ============================================================================

import { z } from 'zod';
import {
  ThemeBundleJsonSchema,
  ThemeBundlePackageMetadataSchema,
  ThemeLiquidLayoutFileSchema,
  ThemeBundleSettingsSchema,
  ThemeLiquidSectionFileSchema,
  ThemeLiquidBlockFileSchema,
  ThemeBundleLocaleSchema,
  ThemeLiquidRendererManifestSchema,
  parseLiquidThemePackageBundle,
  isLiquidAppBlockType,
  type LiquidThemePackageBundle,
  type ThemeBundleJson,
} from './theme-bundle';

// ──────────────────────────────────────────────────────────────────────────────
// VERSION CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

export const THEME_DOCUMENT_VERSION = '2026-07-document-v1';

export const KNOWN_THEME_DOCUMENT_VERSIONS: readonly string[] = Object.freeze([
  THEME_DOCUMENT_VERSION,
]);

// ──────────────────────────────────────────────────────────────────────────────
// BOUNDS (mirrors BLOCKED_DROP_KEYS / MAX_LIQUID_DROP_DEPTH discipline from theme-renderer.ts)
// ──────────────────────────────────────────────────────────────────────────────

/** Keys that must never appear as section/block ids or settings keys. */
const BLOCKED_DOCUMENT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Maximum block nesting depth: level-1 blocks, level-2 children, level-3 grandchildren. */
export const MAX_BLOCK_NESTING_DEPTH = 3;

/** Maximum number of blocks per nesting level (children array). */
const MAX_BLOCK_COUNT_PER_LEVEL = 100;

/** Maximum number of sections per template. */
const MAX_SECTIONS_PER_TEMPLATE = 200;

/** Maximum number of templates per document. */
const MAX_TEMPLATES_PER_DOCUMENT = 100;

// ──────────────────────────────────────────────────────────────────────────────
// ERROR CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class UnsupportedThemeDocumentVersionError extends Error {
  readonly documentVersion: string;
  readonly known: readonly string[];

  constructor(v: string) {
    super(
      `Unsupported Theme Document version '${v}'. `
      + `Known: ${KNOWN_THEME_DOCUMENT_VERSIONS.join(', ')}. Fail-closed.`,
    );
    this.name = 'UnsupportedThemeDocumentVersionError';
    this.documentVersion = v;
    this.known = KNOWN_THEME_DOCUMENT_VERSIONS;
  }
}

/**
 * Thrown when fromThemeDocumentV2 encounters a document feature that is modelled in
 * Phase N but whose bundle-serialisation is deferred to a later phase (e.g. block.children
 * in Phase T).  Converting these docs is explicitly unsupported until that phase ships;
 * the error is fail-closed rather than silently dropping data.
 */
export class UnsupportedThemeDocumentFeatureError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`Unsupported ThemeDocument feature: ${feature}`);
    this.name = 'UnsupportedThemeDocumentFeatureError';
    this.feature = feature;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// VERSION GATE
// ──────────────────────────────────────────────────────────────────────────────

export function isKnownThemeDocumentVersion(v: string): boolean {
  return KNOWN_THEME_DOCUMENT_VERSIONS.includes(v);
}

// ──────────────────────────────────────────────────────────────────────────────
// PRIMITIVE SCHEMAS
// ──────────────────────────────────────────────────────────────────────────────

/** Stable opaque id — alphanumeric + hyphen + underscore, max 64 chars, never a blocked key. */
const ThemeDocumentIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, { message: 'id must be alphanumeric with hyphens/underscores only' })
  .refine((id) => !BLOCKED_DOCUMENT_KEYS.has(id), { message: 'id is a blocked prototype-pollution key' });

/** Reuse the lazy-recursive JSON value type from theme-bundle to avoid a second definition. */
const ThemeDocumentSettingValueSchema = ThemeBundleJsonSchema;

/**
 * A settings map keyed by setting id. Key refinement (min(1)/max(120)) is enforced both
 * at the Zod schema level (Zod v4 validates record keys) and redundantly in superRefine for
 * prototype-pollution keys that pass the string check.
 */
const ThemeDocumentSettingsSchema = z
  .record(z.string().min(1).max(120), ThemeDocumentSettingValueSchema)
  .default({});

// ──────────────────────────────────────────────────────────────────────────────
// RECURSIVE BLOCK SCHEMA
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Interface required for TypeScript to resolve the recursive reference without hitting
 * "Type instantiation is excessively deep" on z.lazy(). The explicit annotation
 *   const ThemeDocumentBlockSchema: z.ZodType<ThemeDocumentBlock>
 * breaks the cycle at the type level.
 */
export interface ThemeDocumentBlock {
  id: string;
  type: string;
  settings: Record<string, ThemeBundleJson>;
  disabled: boolean;
  /** Nested child blocks (Phase T will implement the operations; Phase N models the structure). */
  children: ThemeDocumentBlock[];
}

// eslint-disable-next-line prefer-const
export const ThemeDocumentBlockSchema: z.ZodType<ThemeDocumentBlock> = z.lazy(() =>
  z
    .object({
      id: ThemeDocumentIdSchema,
      type: z.string().min(1).max(120),
      settings: ThemeDocumentSettingsSchema,
      disabled: z.boolean().default(false),
      children: z.array(ThemeDocumentBlockSchema).max(MAX_BLOCK_COUNT_PER_LEVEL).default([]),
    })
    .strict(),
);

// ──────────────────────────────────────────────────────────────────────────────
// DEPTH + UNIQUENESS HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/** Returns the maximum nesting depth of the block tree. Flat = 1, one level of children = 2, etc. */
function maxBlockDepth(blocks: ThemeDocumentBlock[]): number {
  if (blocks.length === 0) return 0;
  return 1 + Math.max(...blocks.map((b) => maxBlockDepth(b.children)));
}

/** Collects every block id reachable from this block tree, tracking occurrence counts. */
function collectBlockIds(blocks: ThemeDocumentBlock[], seen: Map<string, number>): void {
  for (const block of blocks) {
    seen.set(block.id, (seen.get(block.id) ?? 0) + 1);
    collectBlockIds(block.children, seen);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION SCHEMA
// ──────────────────────────────────────────────────────────────────────────────

export const ThemeDocumentSectionSchema = z
  .object({
    id: ThemeDocumentIdSchema,
    type: z.string().min(1).max(120),
    settings: ThemeDocumentSettingsSchema,
    disabled: z.boolean().default(false),
    blocks: z.array(ThemeDocumentBlockSchema).max(MAX_BLOCK_COUNT_PER_LEVEL).default([]),
  })
  .strict()
  .superRefine((section, ctx) => {
    // 1. Block nesting depth check
    const depth = maxBlockDepth(section.blocks);
    if (depth > MAX_BLOCK_NESTING_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Block nesting depth ${depth} exceeds maximum ${MAX_BLOCK_NESTING_DEPTH}`,
      });
    }

    // 2. Block id uniqueness within this section (all levels)
    const blockIdCounts = new Map<string, number>();
    collectBlockIds(section.blocks, blockIdCounts);
    for (const [id, count] of blockIdCounts) {
      if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate block id "${id}" within section "${section.id}"`,
        });
      }
    }

    // 3. Prototype-pollution check on settings keys (belt + suspenders over Zod record key validation).
    //    Use Object.getOwnPropertyNames rather than Object.keys so that non-enumerable own
    //    properties — which some engines write when a key like '__proto__' triggers a setter
    //    during record construction — are also covered.
    for (const key of Object.getOwnPropertyNames(section.settings)) {
      if (BLOCKED_DOCUMENT_KEYS.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settings', key],
          message: `Settings key "${key}" is a blocked prototype-pollution key`,
        });
      }
    }
  });

// ──────────────────────────────────────────────────────────────────────────────
// TEMPLATE SCHEMA
// ──────────────────────────────────────────────────────────────────────────────

export const ThemeDocumentTemplateSchema = z
  .object({
    key: z.string().min(1).max(120),
    name: z.string().max(120).optional(),
    layout: z.string().max(120).optional(),
    sections: z.array(ThemeDocumentSectionSchema).max(MAX_SECTIONS_PER_TEMPLATE).default([]),
  })
  .strict();

// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS DATA SCHEMA (V2 variant uses ThemeDocumentSettingsSchema for values)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Settings-data schema for the document view.
 *
 * Uses `.passthrough()` (not `.strict()`) to mirror `ThemeBundleSettingsDataSchema` —
 * the bundle carries extra keys beyond 'current' and 'presets' via its own `.passthrough()`
 * and those must flow through the doc adapter without loss.  The adapters preserve unknown
 * keys in both directions so that bundle→doc→bundle is structurally identical.
 */
export const ThemeDocumentSettingsDataSchema = z
  .object({
    current: ThemeDocumentSettingsSchema,
    presets: z.record(z.string().min(1).max(120), ThemeDocumentSettingsSchema).default({}),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────────────────
// DOCUMENT SCHEMA
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ThemeDocumentSchema — the canonical editor-facing view of a theme.
 *
 * SELF-CONTAINED: embeds all bundle anatomy (section files, block files,
 * layout, renderer) so both adapters (toThemeDocumentV2 / fromThemeDocumentV2)
 * can operate without a second lookup.
 *
 * LOSSLESS: every field present in LiquidThemePackageBundle is present here.
 */
export const ThemeDocumentSchema = z
  .object({
    /** Schema version of THIS document format — NOT the bundle schema_version. */
    document_version: z.string().min(1).max(40).default(THEME_DOCUMENT_VERSION),
    /** The bundle schema_version this document was derived from. Retained for the fail-closed bundle parse. */
    bundle_schema_version: z.string().min(1).max(40),
    /** Full package metadata from the source bundle. */
    package: ThemeBundlePackageMetadataSchema.extend({
      compatibility_range: z.string().min(1).max(120),
    }).strict(),
    /** Layout file — READ-ONLY from editor; never mutated when saving a draft. */
    layout: z.object({ theme: ThemeLiquidLayoutFileSchema }).strict(),
    /** Theme-wide settings schema + current/preset values. */
    config: z
      .object({
        settings_schema: ThemeBundleSettingsSchema,
        settings_data: ThemeDocumentSettingsDataSchema.default({ current: {}, presets: {} }),
      })
      .strict(),
    /** Section Liquid files keyed by section type — READ-ONLY from editor. */
    section_definitions: z.record(z.string().min(1).max(120), ThemeLiquidSectionFileSchema).default({}),
    /** Reusable block Liquid files keyed by block type — READ-ONLY from editor. */
    block_definitions: z.record(z.string().min(1).max(120), ThemeLiquidBlockFileSchema).default({}),
    /** Translation strings by locale. */
    locales: z.record(z.string(), ThemeBundleLocaleSchema).default({}),
    /** Renderer manifest. */
    renderer: ThemeLiquidRendererManifestSchema,
    /**
     * Templates as a STABLE-ORDERED array. The array order is canonical (alphabetical by key)
     * for deterministic serialization. Each section within a template carries its ordering
     * position in its array index (no separate order[] field needed at the doc level).
     */
    templates: z.array(ThemeDocumentTemplateSchema).max(MAX_TEMPLATES_PER_DOCUMENT).default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    // ── 1. Duplicate template keys ──────────────────────────────────────────
    const templateKeySeen = new Set<string>();
    for (let ti = 0; ti < doc.templates.length; ti++) {
      const t = doc.templates[ti];
      if (templateKeySeen.has(t.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['templates', ti, 'key'],
          message: `Duplicate template key "${t.key}"`,
        });
      }
      templateKeySeen.add(t.key);
    }

    // ── 2. Duplicate section ids within each template ───────────────────────
    for (let ti = 0; ti < doc.templates.length; ti++) {
      const t = doc.templates[ti];
      const sectionIdSeen = new Set<string>();
      for (let si = 0; si < t.sections.length; si++) {
        const s = t.sections[si];
        if (sectionIdSeen.has(s.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['templates', ti, 'sections', si, 'id'],
            message: `Duplicate section id "${s.id}" in template "${t.key}"`,
          });
        }
        sectionIdSeen.add(s.id);
      }
    }

    // ── 3. Section type must resolve to section_definitions ─────────────────
    for (let ti = 0; ti < doc.templates.length; ti++) {
      const t = doc.templates[ti];
      for (let si = 0; si < t.sections.length; si++) {
        const s = t.sections[si];
        if (!(s.type in doc.section_definitions)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['templates', ti, 'sections', si, 'type'],
            message: `Section type "${s.type}" is not defined in section_definitions`,
          });
          continue;
        }

        // ── 4. Block type must be allowed by this section ──────────────────
        const sectionDef = doc.section_definitions[s.type];
        const acceptedInlineTypes = new Set<string>();
        let acceptsAppBlocks = false;

        for (const blockDef of sectionDef.schema.blocks) {
          if (blockDef.type === '@app') {
            acceptsAppBlocks = true;
          } else {
            acceptedInlineTypes.add(blockDef.type);
          }
        }

        for (let bi = 0; bi < s.blocks.length; bi++) {
          const b = s.blocks[bi];
          const isReusable = b.type in doc.block_definitions;
          const isInline = acceptedInlineTypes.has(b.type);
          const isApp = isLiquidAppBlockType(b.type) && acceptsAppBlocks;

          if (!isReusable && !isInline && !isApp) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['templates', ti, 'sections', si, 'blocks', bi, 'type'],
              message: `Block type "${b.type}" is not allowed in section "${s.type}"`,
            });
          }
        }
      }
    }
  });

export type ThemeDocument = z.infer<typeof ThemeDocumentSchema>;
export type ThemeDocumentTemplate = z.infer<typeof ThemeDocumentTemplateSchema>;
export type ThemeDocumentSection = z.infer<typeof ThemeDocumentSectionSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// PRE-PARSE PROTOTYPE-POLLUTION GUARD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Recursively walks the RAW (pre-Zod) input and throws if any object key is in
 * BLOCKED_DOCUMENT_KEYS.
 *
 * WHY PRE-PARSE: `JSON.parse('{"__proto__": {"x":1}}')` creates an object where
 * `__proto__` IS an own enumerable property — so `Object.keys()` finds it here.
 * But when Zod processes that object with `z.record()`, it assigns
 * `output['__proto__'] = value` using bracket notation, which invokes the
 * prototype setter and changes the output object's prototype rather than writing
 * an own property.  After Zod, neither `Object.keys` nor
 * `Object.getOwnPropertyNames` returns `__proto__` in the output — the superRefine
 * guard is bypassed.  Scanning the raw input avoids this entirely.
 *
 * Depth is bounded at 128 — well above the maximum document depth
 * (templates × sections × blocks × children ≈ 15 levels).
 */
function assertNoBlockedKeysInRaw(input: unknown, depth = 0): void {
  if (depth > 128 || input === null || typeof input !== 'object') return;
  if (Array.isArray(input)) {
    for (const item of input) assertNoBlockedKeysInRaw(item, depth + 1);
    return;
  }
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (BLOCKED_DOCUMENT_KEYS.has(key)) {
      throw new Error(
        `Prototype-pollution key "${key}" detected in raw document input. `
        + `blocked keys: ${[...BLOCKED_DOCUMENT_KEYS].join(', ')}.`,
      );
    }
    assertNoBlockedKeysInRaw((input as Record<string, unknown>)[key], depth + 1);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSE (fail-closed version gate)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses and validates a ThemeDocument, then rejects any unknown/future
 * document_version — even if the schema defaulted a missing version to the current one.
 *
 * Also runs a pre-parse key scan to catch prototype-pollution keys that Zod's
 * `z.record()` would otherwise convert into prototype mutations (invisible to
 * post-parse Object.keys / Object.getOwnPropertyNames checks).
 */
export function parseThemeDocument(input: unknown): ThemeDocument {
  assertNoBlockedKeysInRaw(input);
  const doc = ThemeDocumentSchema.parse(input);
  if (!isKnownThemeDocumentVersion(doc.document_version)) {
    throw new UnsupportedThemeDocumentVersionError(doc.document_version);
  }
  return doc;
}

// ──────────────────────────────────────────────────────────────────────────────
// ADAPTER: bundle → ThemeDocument
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a LiquidThemePackageBundle to a ThemeDocument.
 *
 * Determinism guarantee: templates are sorted alphabetically by key so that
 * doc→bundle→doc round-trips produce identical output regardless of the
 * original bundle's JS object insertion order.
 */
export function toThemeDocumentV2(bundle: LiquidThemePackageBundle): ThemeDocument {
  // 1. Re-validate the source bundle (enforces G4 version gate).
  const parsed = parseLiquidThemePackageBundle(bundle);

  // 2. Convert templates: keyed record → alphabetically-sorted array.
  //    Each section in the template follows template.order[] for position.
  //    Sections not referenced by order[] are appended (in record key order).
  const templatesArray: Array<z.input<typeof ThemeDocumentTemplateSchema>> = Object.entries(parsed.templates)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, template]) => {
      // Sections present in order[] come first, in declared order.
      const orderedSectionIds = template.order.filter((id) => id in template.sections);
      // Any section ids in the Record but NOT in order[] come after (lossless).
      const unorderedIds = Object.keys(template.sections).filter(
        (id) => !template.order.includes(id),
      );
      const allSectionIds = [...orderedSectionIds, ...unorderedIds];

      const sections = allSectionIds.map((sectionId) => {
        const s = template.sections[sectionId];
        // Blocks: follow block_order[]; blocks not in block_order come after (lossless).
        const orderedBlockIds = s.block_order.filter((id) => id in s.blocks);
        const unorderedBlockIds = Object.keys(s.blocks).filter(
          (id) => !s.block_order.includes(id),
        );
        const allBlockIds = [...orderedBlockIds, ...unorderedBlockIds];

        return {
          id: sectionId,
          type: s.type,
          settings: s.settings,
          disabled: s.disabled,
          blocks: allBlockIds.map((blockId) => {
            const b = s.blocks[blockId];
            return {
              id: blockId,
              type: b.type,
              settings: b.settings,
              disabled: b.disabled,
              children: [] as ThemeDocumentBlock[],
            };
          }),
        };
      });

      return {
        key,
        name: template.name,
        layout: template.layout,
        sections,
      };
    });

  // 3. Build settings_data for the doc.  The bundle's ThemeBundleSettingsDataSchema uses
  //    .passthrough() so it can carry extra keys beyond 'current' and 'presets'.
  //    We destructure the known keys and spread the rest into the doc so that the round-trip
  //    bundle→doc→bundle is structurally identical even when extra keys are present.
  const bundleSettingsData = parsed.config.settings_data;
  const { current: bundleCurrent, presets: bundlePresets, ...bundleSettingsDataExtra } = bundleSettingsData;

  const raw: z.input<typeof ThemeDocumentSchema> = {
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: parsed.schema_version,
    // compatibility_range is already part of parsed.package; the spread carries it — no
    // need for a redundant explicit field.
    package: { ...parsed.package },
    layout: parsed.layout,
    config: {
      settings_schema: parsed.config.settings_schema,
      settings_data: {
        current: bundleCurrent as Record<string, ThemeBundleJson>,
        presets: bundlePresets as Record<string, Record<string, ThemeBundleJson>>,
        ...bundleSettingsDataExtra,
      },
    },
    section_definitions: parsed.sections,
    block_definitions: parsed.blocks,
    locales: parsed.locales,
    renderer: parsed.renderer,
    templates: templatesArray,
  };

  // 4. Parse + validate the constructed document (also runs fail-closed version gate).
  return parseThemeDocument(raw);
}

// ──────────────────────────────────────────────────────────────────────────────
// ADAPTER: ThemeDocument → bundle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a ThemeDocument back to a LiquidThemePackageBundle.
 *
 * The output is validated via parseLiquidThemePackageBundle so any round-trip
 * violation surfaces as a hard error rather than a silent schema drift.
 */
export function fromThemeDocumentV2(doc: ThemeDocument): LiquidThemePackageBundle {
  // 1. Validate the source document first.
  const validDoc = parseThemeDocument(doc);

  // 1a. Fail-closed: block.children are MODELLED in Phase N but bundle serialisation
  //     is deferred to Phase T.  Silently discarding children would make the round-trip
  //     claim false for docs that actually contain them.  Throw now so the caller knows.
  for (const t of validDoc.templates) {
    for (const s of t.sections) {
      for (const b of s.blocks) {
        if (b.children.length > 0) {
          throw new UnsupportedThemeDocumentFeatureError(
            'block.children are not yet supported in fromThemeDocumentV2 — deferred to Phase T',
          );
        }
      }
    }
  }

  // 2. Rebuild templates as a keyed Record (array → map, preserving section array order).
  const templates: Record<
    string,
    {
      name?: string;
      layout?: string;
      sections: Record<string, {
        type: string;
        settings: Record<string, ThemeBundleJson>;
        blocks: Record<string, { type: string; settings: Record<string, ThemeBundleJson>; disabled: boolean }>;
        block_order: string[];
        disabled: boolean;
      }>;
      order: string[];
    }
  > = {};

  for (const t of validDoc.templates) {
    const sections: typeof templates[string]['sections'] = {};
    const order: string[] = [];

    for (const s of t.sections) {
      const blocks: typeof sections[string]['blocks'] = {};
      const block_order: string[] = [];

      for (const b of s.blocks) {
        blocks[b.id] = {
          type: b.type,
          settings: b.settings,
          disabled: b.disabled,
        };
        block_order.push(b.id);
      }

      sections[s.id] = {
        type: s.type,
        settings: s.settings,
        blocks,
        block_order,
        disabled: s.disabled,
      };
      order.push(s.id);
    }

    templates[t.key] = {
      name: t.name,
      layout: t.layout,
      sections,
      order,
    };
  }

  // 3. Assemble the raw bundle object and validate via parseLiquidThemePackageBundle.
  //    Spread the full settings_data so that passthrough keys present in the doc
  //    (captured from the original bundle) flow back into the bundle losslessly.
  const raw = {
    schema_version: validDoc.bundle_schema_version,
    package: validDoc.package,
    layout: validDoc.layout,
    config: {
      settings_schema: validDoc.config.settings_schema,
      settings_data: { ...validDoc.config.settings_data },
    },
    templates,
    sections: validDoc.section_definitions,
    blocks: validDoc.block_definitions,
    locales: validDoc.locales,
    renderer: validDoc.renderer,
  };

  // 4. Validate output — fail-closed: any schema drift is a hard error.
  return parseLiquidThemePackageBundle(raw);
}
