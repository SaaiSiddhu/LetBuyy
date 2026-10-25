import { z } from 'zod';
import { EDITOR_FIELD_TYPES, ThemeFieldOptionSchema } from './schema-field-extensions';
// S4 — the 10 Experiences, portable. theme-presets.ts imports nothing from this file (verified),
// so importing it here carries no circular-import risk.
import { listExperiences, buildExperienceSettingsOverlay } from './theme-presets';

export const THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract';
export const THEME_BUNDLE_RENDERER_VERSION = '1.0.0';
export const THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections';
export const THEME_LIQUID_RENDERER_VERSION = '0.1.0';

// Phase AB — second known version for safe-update (forward-migration) support.
// When a merchant theme on V1 is updated to V2, compareSchemaVersions(V2, V1) = 1 and the
// safe-update merge engine runs. V2 bundles remain fully backward-compatible with V1 rendering.
export const THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2 = '2026-07-liquid-sections-v2';

// Phase G / G4 — Liquid bundle schema_version compatibility window.
// The Zod schema already stamps a MISSING schema_version to the current version via `.default(...)`.
// This set is the explicit allowlist of versions the current renderer understands. A bundle carrying an
// UNKNOWN (e.g. future) schema_version must be rejected LOUDLY at parse time rather than silently
// misrendered against a shape the engine does not understand. When a new bundle format ships, add its
// version string here alongside the migration/compat that makes older bundles renderable.
export const KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS: readonly string[] = Object.freeze([
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,       // index 0 — all existing stores and tests
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,    // index 1 — Phase AB forward-update target
]);

export class UnsupportedLiquidBundleSchemaVersionError extends Error {
  readonly schemaVersion: string;
  readonly known: readonly string[];
  constructor(schemaVersion: string) {
    super(
      `Unsupported Liquid bundle schema_version "${schemaVersion}". Known versions: ${KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS.join(', ')}. `
      + 'Refusing to render an unrecognized bundle format (fail-closed).',
    );
    this.name = 'UnsupportedLiquidBundleSchemaVersionError';
    this.schemaVersion = schemaVersion;
    this.known = KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS;
  }
}

// S4/W2 — the 10 Experiences as real theme-level presets. Generated from EXPERIENCE_REGISTRY
// (theme-presets.ts) via the same buildExperienceSettingsOverlay() the editor's applyExperience()
// already uses, so a preset's values can never drift from what "Apply <Experience>" actually
// writes. Keyed by the Experience's merchant-facing `name` (e.g. "Forge"), matching Shopify preset
// naming. PRESENTATIONAL ONLY: buildExperienceSettingsOverlay returns exactly the 10 token keys
// (primaryColor…borderRadius) — it has no metaDescription/socialImageUrl/faviconUrl to leak, by
// construction, not by a filter added here.
interface LiquidSettingsSchemaKeySource {
  settings: Record<string, { fields: Record<string, unknown> }>;
}

function collectDeclaredSettingKeys(settingsSchema: LiquidSettingsSchemaKeySource): Set<string> {
  const keys = new Set<string>();
  for (const group of Object.values(settingsSchema.settings)) {
    for (const key of Object.keys(group.fields)) keys.add(key);
  }
  return keys;
}

// S4-FIX/Defect 1 — buildExperienceSettingsOverlay() deliberately emits `fontFamily` alongside
// `bodyFontFamily` as a React-only alias (see its own doc comment: fontFamily is the "React
// JSON-contract path", bodyFontFamily the "Liquid token map"). The Liquid bundle's settings_schema
// never declares `fontFamily` for exactly that reason. Filtering HERE, against the bundle's OWN
// declared schema rather than a hardcoded denylist, means a future overlay key added to
// buildExperienceSettingsOverlay without a matching schema field is dropped rather than written
// into the bundle undeclared — the failure class recorded in migration 193's header
// ("themeSettings.primaryColor is not defined by the theme settings schema"). This function never
// mutates buildExperienceSettingsOverlay's own output; it only filters what gets copied from it.
function buildLiquidThemeExperiencePresets(
  settingsSchema: LiquidSettingsSchemaKeySource,
): Record<string, Record<string, unknown>> {
  const declaredKeys = collectDeclaredSettingKeys(settingsSchema);
  const presets: Record<string, Record<string, unknown>> = {};
  for (const experience of listExperiences()) {
    const overlay = buildExperienceSettingsOverlay(experience);
    const declaredOnly: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(overlay)) {
      if (declaredKeys.has(key)) declaredOnly[key] = value;
    }
    presets[experience.name] = declaredOnly;
  }
  return presets;
}

export function isKnownLiquidBundleSchemaVersion(version: string): boolean {
  return KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS.includes(version);
}

export const THEME_BUNDLE_PATHS = {
  layout: 'layout/theme.liquid',
  settingsSchema: 'config/settings_schema.json',
  settingsData: 'config/settings_data.json',
  templates: 'templates/*.json',
  sections: 'sections/manifest.json',
  liquidSections: 'sections/*.liquid',
  blocks: 'blocks/definitions.json',
  liquidBlocks: 'blocks/*.liquid',
  locales: 'locales/*.json',
} as const;

export const LIQUID_THEME_BUNDLE_PATHS = {
  layout: 'layout/theme.liquid',
  settingsSchema: 'config/settings_schema.json',
  settingsData: 'config/settings_data.json',
  templates: 'templates/*.json',
  sections: 'sections/*.liquid',
  blocks: 'blocks/*.liquid',
  locales: 'locales/*.json',
} as const;

export const LIQUID_HYDRATION_ISLANDS = {
  addToCart: {
    tag: 'lb-add-to-cart',
    kind: 'add-to-cart',
    selector: 'lb-add-to-cart,[data-lb-island="add-to-cart"]',
  },
  cartDrawer: {
    tag: 'lb-cart-drawer',
    kind: 'cart-drawer',
    selector: 'lb-cart-drawer,[data-lb-island="cart-drawer"]',
  },
  search: {
    tag: 'lb-search',
    kind: 'search',
    selector: 'lb-search,[data-lb-island="search"]',
  },
  variantPicker: {
    tag: 'lb-variant-picker',
    kind: 'variant-picker',
    selector: 'lb-variant-picker,[data-lb-island="variant-picker"]',
  },
  reviewForm: {
    tag: 'lb-review-form',
    kind: 'review-form',
    selector: 'lb-review-form,[data-lb-island="review-form"]',
  },
  wishlistToggle: {
    tag: 'lb-wishlist-toggle',
    kind: 'wishlist-toggle',
    selector: 'lb-wishlist-toggle,[data-lb-island="wishlist-toggle"]',
  },
  cart: {
    tag: 'lb-cart',
    kind: 'cart',
    selector: 'lb-cart,[data-lb-island="cart"]',
  },
  customerSettings: {
    tag: 'lb-customer-settings',
    kind: 'customer-settings',
    selector: 'lb-customer-settings,[data-lb-island="customer-settings"]',
  },
  addressManager: {
    tag: 'lb-address-manager',
    kind: 'address-manager',
    selector: 'lb-address-manager,[data-lb-island="address-manager"]',
  },
} as const;

export type LiquidHydrationIslandKey = keyof typeof LIQUID_HYDRATION_ISLANDS;
export type LiquidHydrationIslandKind = typeof LIQUID_HYDRATION_ISLANDS[LiquidHydrationIslandKey]['kind'];

const MAX_LIQUID_TEMPLATE_BYTES = 200_000;
const LIQUID_SECTION_PATH_PATTERN = /^sections\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.liquid$/;
const LIQUID_BLOCK_PATH_PATTERN = /^blocks\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.liquid$/;

export type ThemeBundleJson =
  | string
  | number
  | boolean
  | null
  | ThemeBundleJson[]
  | { [key: string]: ThemeBundleJson };

export const ThemeBundleJsonSchema: z.ZodType<ThemeBundleJson> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(ThemeBundleJsonSchema),
    z.record(z.string(), ThemeBundleJsonSchema),
  ]),
);

export const ThemeBundleJsonObjectSchema = z.record(z.string(), ThemeBundleJsonSchema);

export const ThemeBundleSettingFieldSchema = z.object({
  type: z.enum(EDITOR_FIELD_TYPES),
  label: z.string().min(1).max(120),
  default: ThemeBundleJsonSchema.optional(),
  description: z.string().max(500).optional(),
  info: z.string().max(500).optional(),
  placeholder: z.string().max(160).optional(),
  options: z.array(ThemeFieldOptionSchema).max(100).optional(),
  required: z.boolean().optional(),
  visible_if: z.object({ field: z.string().min(1).max(120), value: ThemeBundleJsonSchema }).strict().optional(),
  resource_type: z.string().min(1).max(120).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  unit: z.string().max(24).optional(),
  maxLength: z.number().int().positive().optional(),
}).strict();

export const ThemeLiquidSourceSchema = z.string()
  .min(1)
  .max(MAX_LIQUID_TEMPLATE_BYTES)
  .superRefine((source, ctx) => {
    const normalized = source.toLowerCase();
    const forbiddenFragments = [
      '<script',
      '</script',
      'javascript:',
      'data:text/html',
      '{% include',
      '{% layout',
      '{% render',
    ];

    for (const fragment of forbiddenFragments) {
      if (normalized.includes(fragment)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Liquid source contains forbidden fragment "${fragment}"`,
        });
      }
    }
  });

export const ThemeLiquidSchemaSettingFieldSchema = ThemeBundleSettingFieldSchema.extend({
  id: z.string().min(1).max(120).regex(/^[a-zA-Z][a-zA-Z0-9_:-]*$/),
}).strict();

export const ThemeLiquidSectionInlineBlockSchema = z.object({
  type: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  limit: z.number().int().positive().optional(),
  settings: z.array(ThemeLiquidSchemaSettingFieldSchema).max(100).default([]),
}).strict();

export const ThemeLiquidAppBlockSchema = z.object({
  type: z.literal('@app'),
  name: z.string().min(1).max(120).default('App block'),
  limit: z.number().int().positive().optional(),
}).strict();

export const ThemeLiquidPresetBlockSchema = z.object({
  type: z.string().min(1).max(120),
  settings: ThemeBundleJsonObjectSchema.default({}),
}).strict();

export const ThemeLiquidPresetSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(120).optional(),
  settings: ThemeBundleJsonObjectSchema.default({}),
  blocks: z.array(ThemeLiquidPresetBlockSchema).max(100).default([]),
}).strict();

export const ThemeLiquidSectionSchema = z.object({
  name: z.string().min(1).max(120),
  tag: z.string().min(1).max(40).default('section'),
  class: z.string().max(200).optional(),
  settings: z.array(ThemeLiquidSchemaSettingFieldSchema).max(100).default([]),
  blocks: z.array(z.union([ThemeLiquidSectionInlineBlockSchema, ThemeLiquidAppBlockSchema])).max(100).default([]),
  presets: z.array(ThemeLiquidPresetSchema).max(50).default([]),
  enabled_on: z.object({
    templates: z.array(z.string().min(1).max(120)).max(100).default(['*']),
  }).default({ templates: ['*'] }),
  disabled_on: z.object({
    templates: z.array(z.string().min(1).max(120)).max(100).default([]),
  }).default({ templates: [] }),
}).strict();

export const ThemeLiquidReusableBlockSchema = z.object({
  name: z.string().min(1).max(120),
  settings: z.array(ThemeLiquidSchemaSettingFieldSchema).max(100).default([]),
  presets: z.array(ThemeLiquidPresetSchema).max(50).default([]),
  /**
   * Phase T — allowed child types: when defined, only blocks whose type appears in this array
   * may be added as children of this block type. Undefined = unrestricted (backward-compatible).
   * Lives on the block DEFINITION (the type catalog), never on block instances.
   */
  allowed_child_types: z.array(z.string().min(1).max(120)).max(50).optional(),
}).strict();

function containsLiquidSchemaBlock(source: string): boolean {
  return /\{%\s*schema\s*%\}/i.test(source) && /\{%\s*endschema\s*%\}/i.test(source);
}

function liquidFileTypeFromPath(path: string): string {
  const fileName = path.split('/').pop() || '';
  return fileName.replace(/\.liquid$/i, '');
}

export const ThemeLiquidLayoutFileSchema = z.object({
  path: z.literal(LIQUID_THEME_BUNDLE_PATHS.layout).default(LIQUID_THEME_BUNDLE_PATHS.layout),
  source: ThemeLiquidSourceSchema,
}).strict();

export const ThemeLiquidSectionFileSchema = z.object({
  path: z.string().regex(LIQUID_SECTION_PATH_PATTERN),
  source: ThemeLiquidSourceSchema,
  schema: ThemeLiquidSectionSchema,
}).strict().superRefine((section, ctx) => {
  if (!containsLiquidSchemaBlock(section.source)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source'],
      message: 'Liquid section files must include {% schema %} and {% endschema %} blocks',
    });
  }
});

export const ThemeLiquidBlockFileSchema = z.object({
  path: z.string().regex(LIQUID_BLOCK_PATH_PATTERN),
  source: ThemeLiquidSourceSchema,
  schema: ThemeLiquidReusableBlockSchema,
}).strict();

export const ThemeLiquidRendererManifestSchema = z.object({
  engine: z.literal('liquid').default('liquid'),
  renderer_version: z.string().min(1).max(40).default(THEME_LIQUID_RENDERER_VERSION),
  liquid_ready: z.literal(true).default(true),
  assets: z.record(z.string(), z.object({
    type: z.enum(['stylesheet', 'script', 'font', 'image', 'media', 'json', 'other']),
    path: z.string().min(1).max(500),
    content_type: z.string().max(120).optional(),
    checksum: z.string().max(160).optional(),
  }).strict()).default({}),
}).strict();

export const ThemeBundleSettingsGroupSchema = z.object({
  label: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  fields: z.record(z.string(), ThemeBundleSettingFieldSchema).default({}),
}).strict();

export const ThemeBundleSettingsSchema = z.object({
  schema_version: z.string().min(1).max(40).default(THEME_BUNDLE_SCHEMA_VERSION),
  settings: z.record(z.string(), ThemeBundleSettingsGroupSchema).default({}),
}).strict();

export const ThemeBundleSettingsDataSchema = z.object({
  current: ThemeBundleJsonObjectSchema.default({}),
  presets: z.record(z.string(), ThemeBundleJsonObjectSchema).default({}),
}).passthrough();

/**
 * Phase T — max nesting depth for bundle template blocks (must stay in sync with
 * MAX_BLOCK_NESTING_DEPTH in theme-document.ts and RENDERER_MAX_BLOCK_DEPTH in theme-renderer.ts).
 */
export const MAX_BUNDLE_BLOCK_NESTING_DEPTH = 3;

/**
 * Explicit TypeScript interface for the self-recursive bundle template block.
 * Using an interface (not z.infer<...>) breaks the circular type reference that
 * would cause "Type instantiation is excessively deep" with z.lazy().
 *
 * RISK-DUAL-N01: this is an INSTANCE shape (carries per-block state: settings, children).
 * block_definitions / ThemeLiquidReusableBlockSchema carries the TYPE catalog (allowed_child_types etc.).
 */
export interface ThemeBundleTemplateBlock {
  type: string;
  settings: Record<string, ThemeBundleJson>;
  disabled: boolean;
  /** Nested child blocks — keyed Record mirroring the section-level blocks shape. */
  blocks: Record<string, ThemeBundleTemplateBlock>;
  /** Ordered ids of child blocks (same semantics as section-level block_order). */
  block_order: string[];
}

/** Compute the maximum nesting depth of a bundle block tree (flat → 1; one child level → 2; …). */
function maxBundleBlockDepth(blocks: Record<string, ThemeBundleTemplateBlock>): number {
  const values = Object.values(blocks);
  if (values.length === 0) return 0;
  return 1 + Math.max(...values.map((b) => maxBundleBlockDepth(b.blocks)));
}

/**
 * Self-recursive bundle template block schema.
 *
 * z.lazy() + explicit z.ZodType<ThemeBundleTemplateBlock> annotation breaks the TS circular
 * type inference cycle.  .strict() is applied on the inner object so unknown keys in serialised
 * bundles are rejected at parse time (prevents schema drift silently passing validation).
 */
export const ThemeBundleTemplateBlockSchema: z.ZodType<ThemeBundleTemplateBlock> = z.lazy(() =>
  z.object({
    type: z.string().min(1).max(120),
    settings: ThemeBundleJsonObjectSchema.default({}),
    disabled: z.boolean().default(false),
    blocks: z.record(z.string(), ThemeBundleTemplateBlockSchema).default({}),
    block_order: z.array(z.string()).default([]),
  }).strict(),
);

export const ThemeBundleTemplateSectionSchema = z
  .object({
    type: z.string().min(1).max(120),
    settings: ThemeBundleJsonObjectSchema.default({}),
    blocks: z.record(z.string(), ThemeBundleTemplateBlockSchema).default({}),
    block_order: z.array(z.string().min(1).max(120)).default([]),
    disabled: z.boolean().default(false),
  })
  .strict()
  .superRefine((section, ctx) => {
    // Depth-bound enforcement (Phase T): reject block trees that exceed the maximum nesting depth.
    // This mirrors MAX_BLOCK_NESTING_DEPTH in theme-document.ts and RENDERER_MAX_BLOCK_DEPTH in
    // theme-renderer.ts — all three constants must stay in sync at value 3.
    const depth = maxBundleBlockDepth(section.blocks);
    if (depth > MAX_BUNDLE_BLOCK_NESTING_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Block nesting depth ${depth} exceeds maximum ${MAX_BUNDLE_BLOCK_NESTING_DEPTH}`,
      });
    }
  });

export const ThemeBundleTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  layout: z.string().min(1).max(120).optional(),
  sections: z.record(z.string(), ThemeBundleTemplateSectionSchema).default({}),
  order: z.array(z.string().min(1).max(120)).default([]),
}).strict().superRefine((template, ctx) => {
  const sectionIds = new Set(Object.keys(template.sections));
  for (const sectionId of template.order) {
    if (!sectionIds.has(sectionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['order'],
        message: `Template order references missing section "${sectionId}"`,
      });
    }
  }

  for (const [sectionId, section] of Object.entries(template.sections)) {
    const blockIds = new Set(Object.keys(section.blocks));
    for (const blockId of section.block_order) {
      if (!blockIds.has(blockId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections', sectionId, 'block_order'],
          message: `Block order references missing block "${blockId}"`,
        });
      }
    }
  }
});

export const ThemeBundleBlockDefinitionSchema = z.object({
  type: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  settings_schema: z.record(z.string(), ThemeBundleSettingFieldSchema).default({}),
  defaults: ThemeBundleJsonObjectSchema.default({}),
}).strict();

export const ThemeBundleSectionDefinitionSchema = z.object({
  type: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  renderer_key: z.string().min(1).max(120),
  settings_schema: z.record(z.string(), ThemeBundleSettingFieldSchema).default({}),
  defaults: ThemeBundleJsonObjectSchema.default({}),
  block_types: z.array(z.string().min(1).max(120)).max(100).default([]),
  accepts_app_blocks: z.boolean().default(false),
  presets: z.array(z.object({
    name: z.string().min(1).max(120),
    settings: ThemeBundleJsonObjectSchema.default({}),
  }).strict()).max(50).default([]),
  enabled_on: z.object({
    templates: z.array(z.string().min(1).max(120)).max(100).default(['*']),
  }).default({ templates: ['*'] }),
}).strict();

export const ThemeBundleLocaleSchema = z.record(z.string(), ThemeBundleJsonSchema);

export const ThemeBundlePackageMetadataSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  author_name: z.string().min(1).max(160).default('LetBuyy'),
  site_types: z.array(z.string().min(1).max(80)).min(1).max(20).default(['store']),
  status: z.enum(['draft', 'active', 'disabled', 'archived']).default('active'),
  pricing_type: z.enum(['free', 'paid', 'subscription']).default('free'),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('INR'),
  version: z.string().min(1).max(40),
  version_number: z.number().int().positive().default(1),
  release_status: z.enum(['draft', 'published', 'deprecated', 'revoked']).default('published'),
  compatibility_range: z.string().min(1).max(120).default('>=2026-05-json-contract'),
  checksum: z.string().min(1).max(160).optional(),
}).strict();

export const ThemeBundleRendererManifestSchema = z.object({
  engine: z.literal('json-contract').default('json-contract'),
  renderer_version: z.string().min(1).max(40).default(THEME_BUNDLE_RENDERER_VERSION),
  liquid_ready: z.boolean().default(false),
  assets: z.record(z.string(), z.object({
    type: z.enum(['stylesheet', 'script', 'font', 'image', 'media', 'json', 'other']),
    path: z.string().min(1).max(500),
    content_type: z.string().max(120).optional(),
    checksum: z.string().max(160).optional(),
  }).strict()).default({}),
}).strict();

export const ThemePackageBundleSchema = z.object({
  schema_version: z.string().min(1).max(40).default(THEME_BUNDLE_SCHEMA_VERSION),
  package: ThemeBundlePackageMetadataSchema,
  config: z.object({
    settings_schema: ThemeBundleSettingsSchema,
    settings_data: ThemeBundleSettingsDataSchema.default({ current: {}, presets: {} }),
  }).strict(),
  templates: z.record(z.string(), ThemeBundleTemplateSchema).default({}),
  sections: z.record(z.string(), ThemeBundleSectionDefinitionSchema).default({}),
  blocks: z.record(z.string(), ThemeBundleBlockDefinitionSchema).default({}),
  locales: z.record(z.string(), ThemeBundleLocaleSchema).default({}),
  renderer: ThemeBundleRendererManifestSchema.default({
    engine: 'json-contract',
    renderer_version: THEME_BUNDLE_RENDERER_VERSION,
    liquid_ready: false,
    assets: {},
  }),
})
  // This is the portable on-disk contract for a JSON-contract theme package.
  // It mirrors the existing theme_packages/theme_package_versions persistence
  // spine without making this package depend on a database client.
  .strict()
  .superRefine((bundle, ctx) => {
  for (const [sectionType, section] of Object.entries(bundle.sections)) {
    if (section.type !== sectionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections', sectionType, 'type'],
        message: `Section definition key "${sectionType}" must match its type "${section.type}"`,
      });
    }

    for (const blockType of section.block_types) {
      if (!bundle.blocks[blockType]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections', sectionType, 'block_types'],
          message: `Section "${sectionType}" references missing block definition "${blockType}"`,
        });
      }
    }
  }

  for (const [blockType, block] of Object.entries(bundle.blocks)) {
    if (block.type !== blockType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks', blockType, 'type'],
        message: `Block definition key "${blockType}" must match its type "${block.type}"`,
      });
    }
  }

  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    for (const [sectionId, section] of Object.entries(template.sections)) {
      if (!bundle.sections[section.type]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['templates', templateKey, 'sections', sectionId, 'type'],
          message: `Template "${templateKey}" references missing section definition "${section.type}"`,
        });
        continue;
      }

      const sectionDefinition = bundle.sections[section.type];
      for (const [blockId, block] of Object.entries(section.blocks)) {
        if (!bundle.blocks[block.type]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['templates', templateKey, 'sections', sectionId, 'blocks', blockId, 'type'],
            message: `Template "${templateKey}" references missing block definition "${block.type}"`,
          });
        }

        if (sectionDefinition.block_types.length > 0 && !sectionDefinition.block_types.includes(block.type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['templates', templateKey, 'sections', sectionId, 'blocks', blockId, 'type'],
            message: `Block "${block.type}" is not allowed in section "${section.type}"`,
          });
        }
      }
    }
  }
});

function liquidSectionAcceptedBlockTypes(section: z.infer<typeof ThemeLiquidSectionFileSchema>): Set<string> {
  return new Set(section.schema.blocks.map((block) => block.type));
}

export function isLiquidAppBlockType(blockType: string): boolean {
  return blockType === '@app' || blockType.startsWith('app:');
}

export const LiquidThemePackageBundleSchema = z.object({
  schema_version: z.string().min(1).max(40).default(THEME_LIQUID_BUNDLE_SCHEMA_VERSION),
  package: ThemeBundlePackageMetadataSchema.extend({
    compatibility_range: z.string().min(1).max(120).default(`>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`),
  }).strict(),
  layout: z.object({
    theme: ThemeLiquidLayoutFileSchema,
  }).strict(),
  config: z.object({
    settings_schema: ThemeBundleSettingsSchema,
    settings_data: ThemeBundleSettingsDataSchema.default({ current: {}, presets: {} }),
  }).strict(),
  templates: z.record(z.string(), ThemeBundleTemplateSchema).default({}),
  sections: z.record(z.string(), ThemeLiquidSectionFileSchema).default({}),
  blocks: z.record(z.string(), ThemeLiquidBlockFileSchema).default({}),
  locales: z.record(z.string(), ThemeBundleLocaleSchema).default({}),
  renderer: ThemeLiquidRendererManifestSchema.default({
    engine: 'liquid',
    renderer_version: THEME_LIQUID_RENDERER_VERSION,
    liquid_ready: true,
    assets: {},
  }),
}).strict().superRefine((bundle, ctx) => {
  for (const [sectionType, section] of Object.entries(bundle.sections)) {
    const fileType = liquidFileTypeFromPath(section.path);
    if (fileType !== sectionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections', sectionType, 'path'],
        message: `Liquid section key "${sectionType}" must match file path type "${fileType}"`,
      });
    }
  }

  for (const [blockType, block] of Object.entries(bundle.blocks)) {
    const fileType = liquidFileTypeFromPath(block.path);
    if (fileType !== blockType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks', blockType, 'path'],
        message: `Liquid block key "${blockType}" must match file path type "${fileType}"`,
      });
    }
  }

  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    for (const [sectionId, section] of Object.entries(template.sections)) {
      const sectionDefinition = bundle.sections[section.type];
      if (!sectionDefinition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['templates', templateKey, 'sections', sectionId, 'type'],
          message: `Liquid template "${templateKey}" references missing section file "${section.type}"`,
        });
        continue;
      }

      const acceptedBlockTypes = liquidSectionAcceptedBlockTypes(sectionDefinition);
      for (const [blockId, block] of Object.entries(section.blocks)) {
        const appBlockAllowed = isLiquidAppBlockType(block.type) && acceptedBlockTypes.has('@app');
        const reusableBlockAllowed = Boolean(bundle.blocks[block.type]);
        const inlineBlockAllowed = acceptedBlockTypes.has(block.type);

        if (!appBlockAllowed && !reusableBlockAllowed && !inlineBlockAllowed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['templates', templateKey, 'sections', sectionId, 'blocks', blockId, 'type'],
            message: `Block "${block.type}" is not allowed in liquid section "${section.type}"`,
          });
        }
      }
    }
  }
});

export const PortableThemePackageBundleSchema = z.union([
  ThemePackageBundleSchema,
  LiquidThemePackageBundleSchema,
]);

export const UploadThemePackageSchema = z.object({
  store_id: z.string().uuid().optional(),
  bundle: PortableThemePackageBundleSchema,
  submission_mode: z.enum(['marketplace', 'private_install']).default('marketplace'),
}).strict();

export const UploadPortableThemePackageSchema = UploadThemePackageSchema;

export type ThemeBundle = z.infer<typeof ThemePackageBundleSchema>;
export type ThemePackageBundle = z.infer<typeof ThemePackageBundleSchema>;
export type LiquidThemePackageBundle = z.infer<typeof LiquidThemePackageBundleSchema>;
export type PortableThemePackageBundle = z.infer<typeof PortableThemePackageBundleSchema>;
export type UploadThemePackageInput = z.infer<typeof UploadThemePackageSchema>;
export type UploadPortableThemePackageInput = z.infer<typeof UploadPortableThemePackageSchema>;
export type ThemeBundleTemplate = z.infer<typeof ThemeBundleTemplateSchema>;
export type ThemeBundleTemplateSection = z.infer<typeof ThemeBundleTemplateSectionSchema>;
// ThemeBundleTemplateBlock is the explicit interface defined above (not z.infer<...>) so that
// the self-recursive type resolves correctly without "excessively deep" TypeScript errors.
export type ThemeBundleSectionDefinition = z.infer<typeof ThemeBundleSectionDefinitionSchema>;
export type ThemeBundleBlockDefinition = z.infer<typeof ThemeBundleBlockDefinitionSchema>;
export type ThemeLiquidSectionFile = z.infer<typeof ThemeLiquidSectionFileSchema>;
export type ThemeLiquidBlockFile = z.infer<typeof ThemeLiquidBlockFileSchema>;
export type ThemeLiquidSectionDefinition = z.infer<typeof ThemeLiquidSectionSchema>;
export type ThemeLiquidBlockDefinition = z.infer<typeof ThemeLiquidReusableBlockSchema>;
export type ThemeBundleSettingsSchemaDefinition = z.infer<typeof ThemeBundleSettingsSchema>;
export type ThemeBundleSettingsData = z.infer<typeof ThemeBundleSettingsDataSchema>;
export type ThemeBundleLocale = z.infer<typeof ThemeBundleLocaleSchema>;
export type ThemeBundleLocaleMap = Record<string, ThemeBundleLocale>;

export const DEFAULT_THEME_LOCALE = 'en';
export const THEME_TRANSLATION_PREFIX = 't:';

function asThemeBundleRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeThemeLocale(locale?: string | null): string {
  const normalized = (locale || DEFAULT_THEME_LOCALE).trim().replace(/_/g, '-');
  if (!normalized) return DEFAULT_THEME_LOCALE;

  const [language, ...rest] = normalized.split('-').filter(Boolean);
  if (!language) return DEFAULT_THEME_LOCALE;

  return [
    language.toLowerCase(),
    ...rest.map((part) => (part.length === 2 ? part.toUpperCase() : part.toLowerCase())),
  ].join('-');
}

export function getThemeLocaleCandidates(locale?: string | null): string[] {
  const normalized = normalizeThemeLocale(locale);
  const language = normalized.split('-')[0] || DEFAULT_THEME_LOCALE;

  return Array.from(new Set([
    normalized,
    normalized.toLowerCase(),
    language,
    DEFAULT_THEME_LOCALE,
  ]));
}

function resolveLocaleEntry(locales: ThemeBundleLocaleMap, candidate: string): ThemeBundleLocale | undefined {
  if (locales[candidate]) return locales[candidate];

  const lowerCandidate = candidate.toLowerCase();
  const matchingKey = Object.keys(locales).find((key) => key.toLowerCase() === lowerCandidate);
  return matchingKey ? locales[matchingKey] : undefined;
}

export function resolveThemeLocaleDictionary(
  locales: ThemeBundleLocaleMap,
  locale?: string | null,
): ThemeBundleLocale | undefined {
  for (const candidate of getThemeLocaleCandidates(locale)) {
    const entry = resolveLocaleEntry(locales, candidate);
    if (entry) return entry;
  }

  return undefined;
}

function readThemeLocalePath(dictionary: ThemeBundleLocale, path: string): ThemeBundleJson | undefined {
  let current: unknown = dictionary;

  for (const segment of path.split('.').map((part) => part.trim()).filter(Boolean)) {
    const record = asThemeBundleRecord(current);
    if (!(segment in record)) return undefined;
    current = record[segment];
  }

  return current as ThemeBundleJson | undefined;
}

export function resolveThemeTranslation(
  locales: ThemeBundleLocaleMap,
  locale: string | null | undefined,
  value: string,
): ThemeBundleJson | undefined {
  if (!value.startsWith(THEME_TRANSLATION_PREFIX)) return value;

  const translationKey = value.slice(THEME_TRANSLATION_PREFIX.length).trim();
  if (!translationKey) return undefined;

  for (const candidate of getThemeLocaleCandidates(locale)) {
    const dictionary = resolveLocaleEntry(locales, candidate);
    if (!dictionary) continue;

    const translated = readThemeLocalePath(dictionary, translationKey);
    if (translated !== undefined) return translated;
  }

  return undefined;
}

function localizeThemeNode(
  value: unknown,
  locales: ThemeBundleLocaleMap,
  locale: string | null | undefined,
): unknown {
  if (typeof value === 'string') {
    const translated = resolveThemeTranslation(locales, locale, value);
    return translated === undefined ? value : translated;
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeThemeNode(item, locales, locale));
  }

  if (value && typeof value === 'object') {
    const localized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      localized[key] = key === 'locales' ? child : localizeThemeNode(child, locales, locale);
    }
    return localized;
  }

  return value;
}

export function localizeThemeTemplateConfig(
  templateConfig: Record<string, unknown>,
  locale?: string | null,
): Record<string, unknown> {
  const locales = asThemeBundleRecord(templateConfig.locales) as ThemeBundleLocaleMap;
  if (Object.keys(locales).length === 0) return templateConfig;

  return localizeThemeNode(templateConfig, locales, locale) as Record<string, unknown>;
}

export interface ThemePackagePersistencePayload {
  themePackage: {
    slug: string;
    name: string;
    description: string;
    author_name: string;
    site_types: string[];
    status: 'draft' | 'active' | 'disabled' | 'archived';
    pricing_type: 'free' | 'paid' | 'subscription';
    price: number;
    currency: string;
    marketplace_metadata: Record<string, unknown>;
  };
  themePackageVersion: {
    version: string;
    version_number: number;
    release_status: 'draft' | 'published' | 'deprecated' | 'revoked';
    renderer_version: string;
    schema_version: string;
    compatibility_range: string;
    package_manifest: Record<string, unknown>;
    checksum?: string;
  };
  schemaManifest: {
    manifest_version: string;
    schema_manifest: Record<string, unknown>;
    section_schemas: Record<string, unknown>;
    block_schemas: Record<string, unknown>;
    settings_schema: Record<string, unknown>;
    template_schema: Record<string, unknown>;
    layout_schema: Record<string, unknown>;
    validation_rules: Record<string, unknown>;
  };
  rendererManifest: {
    renderer_manifest: Record<string, unknown>;
    approved_renderer_keys: string[];
    asset_manifest: Record<string, unknown>;
    performance_budget: Record<string, unknown>;
  };
}

export interface ThemeBundleValidationResult {
  ok: boolean;
  bundle?: ThemePackageBundle;
  issues: string[];
}

type LiquidSettingField = z.infer<typeof ThemeLiquidSchemaSettingFieldSchema>;
type LiquidSectionBlockDefinition = z.infer<typeof ThemeLiquidSectionInlineBlockSchema> | z.infer<typeof ThemeLiquidAppBlockSchema>;

function liquidSetting(
  id: string,
  type: LiquidSettingField['type'],
  label: string,
  extra: Omit<LiquidSettingField, 'id' | 'type' | 'label'> = {},
): LiquidSettingField {
  return { id, type, label, ...extra };
}

function liquidInlineBlock(
  type: string,
  name: string,
  settings: LiquidSettingField[] = [],
): LiquidSectionBlockDefinition {
  return { type, name, settings };
}

function liquidAppBlock(): LiquidSectionBlockDefinition {
  return { type: '@app', name: 'App block' };
}

function buildLiquidSectionSchemaSource(schema: ThemeLiquidSectionDefinition): string {
  return [
    '{% schema %}',
    JSON.stringify({
      name: schema.name,
      settings: schema.settings,
      blocks: schema.blocks,
      presets: schema.presets,
    }, null, 2),
    '{% endschema %}',
  ].join('\n');
}

function createLiquidSectionFile(input: {
  type: string;
  name: string;
  settings?: LiquidSettingField[];
  blocks?: LiquidSectionBlockDefinition[];
  body: string[];
}): ThemeLiquidSectionFile {
  const schema: ThemeLiquidSectionDefinition = {
    name: input.name,
    tag: 'section',
    settings: input.settings || [],
    blocks: input.blocks || [],
    presets: [{ name: input.name, settings: {}, blocks: [] }],
    enabled_on: { templates: ['*'] },
    disabled_on: { templates: [] },
  };

  return {
    path: `sections/${input.type}.liquid`,
    source: [
      ...input.body,
      buildLiquidSectionSchemaSource(schema),
    ].join('\n'),
    schema,
  };
}

// T5/W1 — a small, hand-authored icon set (plain geometric primitives — a circle+line for search,
// a chevron path, two crossing lines for close, three horizontal lines for a menu toggle — none
// derived from any third-party icon library). Needs theme-renderer.ts's DOMPurify ADD_TAGS/ADD_ATTR
// expansion (svg/path/circle/line/polyline/rect/g + viewBox/fill/stroke/d/points/…) to survive the
// sanitizer at all — confirmed empirically, since USE_PROFILES.html does not include SVG by default.
// Every icon is decorative (aria-hidden="true" focusable="false") and is always paired with a
// visible or sr-only text label at the call site, never the sole content of a control.
const LIQUID_ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 4h2l2 12h11l2-8H6"></path><circle cx="9" cy="20" r="1"></circle><circle cx="17" cy="20" r="1"></circle></svg>',
  hamburger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="lb-icon-chevron"><path d="M6 9l6 6 6-6"></path></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 4h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1h3z"></path></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="4" y1="4" x2="20" y2="20"></line><line x1="20" y1="4" x2="4" y2="20"></line></svg>',
  // T6/W2 — a filled star for the product card/PDP rating display. Built from <path> only (no new
  // SVG primitive needed beyond the T5 sanitizer allowlist) — a plain 5-point star polygon, not
  // derived from any icon library.
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" class="lb-icon-star"><path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.8 1.5 6.9L12 17.8l-6.1 3.5 1.5-6.9-5.2-4.8 6.9-.7z"></path></svg>',
};

// T6/W2 — the ONE product card, used identically by collection-product-list.liquid,
// featured-products.liquid and product-grid.liquid (previously three byte-identical copies of the
// same markup maintained independently — a change to one silently drifted from the other two).
// Assumes the enclosing `{% for item in collection.products %}` loop variable is always `item`,
// which all three call sites already use. Data-driven only: badges (sold out / sale / low stock),
// the second hover image, and the rating row all render exclusively from fields confirmed to reach
// this drop (composition-engine.tsx's productToLiquidDrop) — never fabricated. Two Dawn-class
// features were investigated and deliberately left out because the data does not exist: `vendor`
// (productToLiquidDrop has no such field) and colour swatches (product.options carries option
// name/value strings, not swatch colour data) — see docs/theme-deploy-chain.md-adjacent report
// notes rather than inventing either. True responsive `srcset` (multiple resolutions of the same
// image) is also not buildable: `image_url`/`safeLiquidUrl` is a pass-through sanitizer with no
// resize/CDN parameter support anywhere in this asset pipeline — `sizes` + `loading="lazy"` +
// `aspect-ratio` (CSS) are the real, honest substitute that still prevents layout shift.
const LIQUID_PRODUCT_CARD = [
  '<article class="lb-product-card">',
  '  <a class="lb-product-card__link" href="{{ item.url }}">',
  '    <div class="lb-product-card__media">',
  '      {% if item.featured_image %}',
  `      <img class="lb-product-card__image lb-product-card__image--primary" src="{{ item.featured_image | image_url }}" alt="{{ item.title }}" loading="lazy" decoding="async" sizes="(min-width: 64em) 25vw, (min-width: 48em) 33vw, 50vw">`,
  '      {% if item.images.size > 1 %}<img class="lb-product-card__image lb-product-card__image--hover" src="{{ item.images[1] | image_url }}" alt="" aria-hidden="true" loading="lazy" decoding="async">{% endif %}',
  '      {% else %}',
  '      <span class="lb-product-card__placeholder">No image yet</span>',
  '      {% endif %}',
  '      {% if item.available == false %}',
  '      <span class="lb-product-card__badges"><span class="lb-product-card__badge lb-product-card__badge--sold-out">Sold out</span></span>',
  '      {% elsif item.compare_at_price and item.compare_at_price > item.price %}',
  '      <span class="lb-product-card__badges"><span class="lb-product-card__badge lb-product-card__badge--sale">Sale</span></span>',
  '      {% elsif item.stock > 0 and item.stock <= 5 %}',
  '      <span class="lb-product-card__badges"><span class="lb-product-card__badge lb-product-card__badge--low-stock">Only {{ item.stock }} left</span></span>',
  '      {% endif %}',
  '    </div>',
  '    <div class="lb-product-card__body">',
  '      <h3 class="lb-product-card__title">{{ item.title }}</h3>',
  '      {% if item.review_count > 0 %}',
  `      <div class="lb-product-card__rating" aria-label="Rated {{ item.rating }} out of 5 from {{ item.review_count }} reviews">${LIQUID_ICONS.star}<span class="lb-product-card__rating-value">{{ item.rating }}</span><span class="lb-product-card__rating-count">({{ item.review_count }})</span></div>`,
  '      {% endif %}',
  '      <div class="lb-product-card__price">',
  '        <span>{{ item.price | times: 100 | money_with_currency: item.currency }}</span>',
  '        {% if item.compare_at_price and item.compare_at_price > item.price %}<s>{{ item.compare_at_price | times: 100 | money_with_currency: item.currency }}</s>{% endif %}',
  '      </div>',
  '    </div>',
  '  </a>',
  '  <div class="lb-product-card__actions">',
  '    <lb-add-to-cart data-lb-island="add-to-cart" data-product-id="{{ item.id }}" data-product-name="{{ item.title }}" data-product-price="{{ item.price }}" data-product-currency="{{ item.currency }}" data-product-url="{{ item.url }}">',
  '      <button type="button" class="lb-product-card__cta" data-lb-add-to-cart{% if item.available == false %} disabled{% endif %}>{% if item.available == false %}Sold out{% else %}Quick add{% endif %}</button>',
  '    </lb-add-to-cart>',
          '    <lb-wishlist-toggle data-lb-island="wishlist-toggle" data-product-id="{{ item.id }}" data-store-id="{{ shop.id }}" data-in-wishlist="{% if item.in_wishlist %}true{% endif %}"{% if buyer_wishlist.authenticated %} data-authenticated="true" data-account-type="buyer" data-buyer-id="{{ buyer_wishlist.buyerId }}" data-buyer-linked="{% if buyer_wishlist.linked %}true{% endif %}" data-buyer-unavailable="{% if buyer_wishlist.unavailable or buyer_wishlist.storeAccountUnavailable %}true{% endif %}"{% elsif customer %} data-authenticated="true" data-account-type="store_customer"{% endif %} data-base-path="/store/{{ shop.subdomain }}" aria-label="Add {{ item.title }} to wishlist"></lb-wishlist-toggle>',
  '  </div>',
  '</article>',
].join('');

export function createLiquidParitySectionFiles(): Record<string, ThemeLiquidSectionFile> {
  return {
    'announcement-bar': createLiquidSectionFile({
      type: 'announcement-bar',
      name: 'Announcement Bar',
      settings: [
        liquidSetting('text', 'text', 'Message', { default: 'Free shipping on fresh drops this week.' }),
        liquidSetting('linkLabel', 'text', 'Link label', { default: 'Shop now' }),
        liquidSetting('linkHref', 'url', 'Link URL', { default: '/products' }),
      ],
      body: [
        '<section class="lb-announcement-bar" data-section-id="{{ section.id }}">',
        '  <span>{{ section.settings.text }}</span>',
        '  {% if section.settings.linkLabel %}<a href="{{ section.settings.linkHref | store_url }}">{{ section.settings.linkLabel }}</a>{% endif %}',
        '</section>',
      ],
    }),
    'about-section': createLiquidSectionFile({
      type: 'about-section',
      name: 'About Section',
      settings: [
        liquidSetting('title', 'text', 'Title', { default: 'About us' }),
        liquidSetting('content', 'richtext', 'Content'),
        liquidSetting('imageUrl', 'image', 'Image'),
        liquidSetting('layout', 'select', 'Layout', { default: 'left', options: ['left', 'right', 'center'] }),
      ],
      body: [
        // B3: layout drives a real class (side-by-side left/right vs centered), mirroring the
        // structural branch about-section.tsx already implements — see LIQUID_THEME_BASE_CSS for
        // the matching `lb-about-section--layout-*` rules.
        '{% assign layout_value = section.settings.layout | default: \'left\' %}',
        '<section class="lb-about-section lb-about-section--layout-{{ layout_value }}" data-section-id="{{ section.id }}">',
        '  <div class="lb-about-section__body">',
        '    <h2>{{ section.settings.title }}</h2>',
        '    <div>{{ section.settings.content }}</div>',
        '  </div>',
        '  {% if section.settings.imageUrl %}<img class="lb-about-section__image" src="{{ section.settings.imageUrl | image_url }}" alt="{{ section.settings.title }}">{% endif %}',
        '</section>',
      ],
    }),
    'app-block-slot': createLiquidSectionFile({
      type: 'app-block-slot',
      name: 'App Block Slot',
      settings: [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('slot', 'text', 'Slot', { default: 'storefront.home.after-hero' }),
      ],
      blocks: [liquidAppBlock()],
      body: [
        '<section class="lb-app-block-slot" data-section-id="{{ section.id }}">',
        '  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}',
        '  {% for block in section.blocks %}{{ block.content | raw }}{% endfor %}',
        '</section>',
      ],
    }),
    'banner-carousel': createLiquidSectionFile({
      type: 'banner-carousel',
      name: 'Banner Carousel',
      settings: [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('autoplay', 'toggle', 'Autoplay', { default: true }),
      ],
      blocks: [liquidInlineBlock('slide', 'Slide', [
        liquidSetting('heading', 'text', 'Heading'),
        liquidSetting('image', 'image', 'Image'),
        liquidSetting('link', 'url', 'Link'),
      ])],
      body: [
        // S3-FIX item 3, decision (a): banner-carousel.tsx renders the active slide's heading as
        // an <h1> (single-slide carousel UX), which Liquid's static, all-slides-at-once list
        // rendering cannot copy verbatim (multiple <h1> per page is a real a11y anti-pattern, not
        // a cosmetic one). Instead this matches the ALREADY-established convention this same theme
        // uses everywhere else a list-of-items has its own per-item title alongside a section-level
        // <h2> (trust-badges' block.settings.label, skills-section's grouping label,
        // portfolio-grid's block.settings.title, experience-timeline's block.settings.title all
        // render as <h3>) — a minimal, idiomatic, consistent fix, not a section-level parity
        // exclusion. banner-carousel remains structurally unusual (its React counterpart is not a
        // registered storefront section — see hero.tsx/renderer-registry.tsx — only reachable via
        // hero.tsx's multi-banner branch), but that does not make ITS OWN heading semantics wrong to
        // fix on the Liquid side.
        '<section class="lb-banner-carousel" data-section-id="{{ section.id }}" data-autoplay="{{ section.settings.autoplay }}">',
        '  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}',
        '  <div class="lb-banner-carousel__slides">',
        '    {% for block in section.blocks %}<a href="{{ block.settings.link | store_url }}">{% if block.settings.image %}<img src="{{ block.settings.image | image_url }}" alt="{{ block.settings.heading }}">{% endif %}<h3>{{ block.settings.heading }}</h3></a>{% endfor %}',
        '  </div>',
        '</section>',
      ],
    }),
    'brand-marquee': createLiquidSectionFile({
      type: 'brand-marquee',
      name: 'Brand Marquee',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'Featured brands' })],
      blocks: [liquidInlineBlock('brand', 'Brand', [liquidSetting('name', 'text', 'Name')])],
      body: [
        '<section class="lb-brand-marquee" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  <div>{% for block in section.blocks %}<span>{{ block.settings.name }}</span>{% endfor %}</div>',
        '</section>',
      ],
    }),
    'category-grid': createLiquidSectionFile({
      type: 'category-grid',
      name: 'Category Grid',
      settings: [
        liquidSetting('title', 'text', 'Heading', { default: 'Shop by style' }),
        liquidSetting('subtitle', 'text', 'Subheading'),
      ],
      blocks: [liquidInlineBlock('category', 'Category', [
        liquidSetting('name', 'text', 'Name'),
        liquidSetting('slug', 'text', 'Slug'),
        liquidSetting('tagline', 'text', 'Tagline'),
      ])],
      body: [
        '<section class="lb-category-grid" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% if section.settings.subtitle %}<p>{{ section.settings.subtitle }}</p>{% endif %}',
        '  <div class="lb-category-grid__items">',
        '    {% for block in section.blocks %}<a class="lb-category-card" href="{{ routes.collections_url }}/{{ block.settings.slug }}"><strong>{{ block.settings.name }}</strong><span>{{ block.settings.tagline }}</span></a>{% endfor %}',
        '  </div>',
        '</section>',
      ],
    }),
    // Collection Filter — data source VERIFIED against the live collection drop:
    // composition-engine.tsx builds `collection` as { id, handle, title, description, products }
    // and the gateway's public product query (storefront.ts PublicProductQueryOptions) accepts only
    // { limit, page, ids, category, search }. There is NO sort, price or vendor facet anywhere in the
    // platform today, and the collection route does not read query params at all — the ONE control
    // that round-trips end to end is `search`, which the search route turns into search.terms /
    // search.results. So this section renders the real search form and nothing it cannot honour.
    // The sort/price/vendor controls are gated on facet payloads the PLATFORM supplies (with the
    // hrefs it supplies): absent today, so they render nothing rather than fabricating dead links —
    // the same discipline blog-listing applies to pagination.
    'collection-filter': createLiquidSectionFile({
      type: 'collection-filter',
      name: 'Collection Filter',
      settings: [
        liquidSetting('showSearch', 'toggle', 'Show search', { default: true }),
        liquidSetting('showSort', 'toggle', 'Show sort', { default: true }),
        liquidSetting('showPriceFilter', 'toggle', 'Show price filter', { default: true }),
        liquidSetting('showVendorFilter', 'toggle', 'Show vendor filter', { default: false }),
        liquidSetting('layout', 'select', 'Layout', { default: 'sidebar', options: ['sidebar', 'drawer', 'topbar'] }),
      ],
      body: [
        '<section class="lb-collection-filter" data-section-id="{{ section.id }}" data-layout="{{ section.settings.layout }}">',
        '  {% if section.settings.showSearch %}',
        '  <form class="lb-collection-filter__form" role="search" method="get" action="{{ routes.search_url }}">',
        '    <label class="lb-collection-filter__label" for="lb-collection-filter-{{ section.id }}">Search products</label>',
        '    <input class="lb-collection-filter__input" id="lb-collection-filter-{{ section.id }}" type="search" name="search" value="{{ search.terms }}" placeholder="Search products">',
        '    <button class="lb-collection-filter__submit" type="submit">Search</button>',
        '  </form>',
        '  {% endif %}',
        '  {% if section.settings.showSort and collection.sort_options.size > 0 %}',
        '  <nav class="lb-collection-filter__sort" aria-label="Sort products">',
        '    {% for option in collection.sort_options %}<a class="lb-collection-filter__sort-link" href="{{ option.url }}"{% if option.active %} aria-current="true"{% endif %}>{{ option.label }}</a>{% endfor %}',
        '  </nav>',
        '  {% endif %}',
        '  {% if section.settings.showPriceFilter and collection.price_ranges.size > 0 %}',
        '  <nav class="lb-collection-filter__price" aria-label="Filter by price">',
        '    {% for range in collection.price_ranges %}<a class="lb-collection-filter__price-link" href="{{ range.url }}"{% if range.active %} aria-current="true"{% endif %}>{{ range.label }}</a>{% endfor %}',
        '  </nav>',
        '  {% endif %}',
        '  {% if section.settings.showVendorFilter and collection.vendors.size > 0 %}',
        '  <nav class="lb-collection-filter__vendor" aria-label="Filter by brand">',
        '    {% for vendor in collection.vendors %}<a class="lb-collection-filter__vendor-link" href="{{ vendor.url }}"{% if vendor.active %} aria-current="true"{% endif %}>{{ vendor.label }}</a>{% endfor %}',
        '  </nav>',
        '  {% endif %}',
        '  {% if search.terms != blank %}<p class="lb-collection-filter__active" role="status">Showing results for "{{ search.terms }}"{% if collection.handle != blank %} <a class="lb-collection-filter__clear" href="{{ routes.collections_url }}/{{ collection.handle }}">Clear</a>{% endif %}</p>',
        '  {% elsif collection.products.size > 0 %}<p class="lb-collection-filter__count" role="status">{{ collection.products.size }} products</p>',
        '  {% else %}<p class="lb-collection-filter__empty" role="status">No products to filter yet.</p>{% endif %}',
        '</section>',
      ],
    }),
    'contact-form': createLiquidSectionFile({
      type: 'contact-form',
      name: 'Contact Form',
      settings: [
        liquidSetting('title', 'text', 'Title', { default: 'Contact us' }),
        liquidSetting('subtitle', 'text', 'Subtitle'),
        liquidSetting('showPhone', 'toggle', 'Show phone field', { default: true }),
      ],
      body: [
        '<section class="lb-contact-form" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  <p>{{ section.settings.subtitle }}</p>',
        '  <form action="/contact" method="post"><input name="name" aria-label="Name"><input type="email" name="email" aria-label="Email">{% if section.settings.showPhone %}<input name="phone" aria-label="Phone">{% endif %}<button type="submit">Send</button></form>',
        '</section>',
      ],
    }),
    'cta-section': createLiquidSectionFile({
      type: 'cta-section',
      name: 'Call to Action',
      settings: [
        liquidSetting('heading', 'text', 'Heading', { default: 'Ready to get started?' }),
        liquidSetting('subheading', 'text', 'Subheading'),
        liquidSetting('ctaText', 'text', 'Button text', { default: 'Shop now' }),
        liquidSetting('ctaLink', 'url', 'Button link', { default: '/products' }),
      ],
      body: [
        '<section class="lb-cta-section" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.heading }}</h2>',
        '  <p>{{ section.settings.subheading }}</p>',
        '  <a href="{{ section.settings.ctaLink | store_url }}">{{ section.settings.ctaText }}</a>',
        '</section>',
      ],
    }),
    'featured-products': createLiquidSectionFile({
      type: 'featured-products',
      name: 'Featured Products',
      settings: [
        liquidSetting('title', 'text', 'Heading', { default: 'Drop-ready collection' }),
        liquidSetting('subtitle', 'text', 'Subheading'),
        liquidSetting('viewAllLabel', 'text', 'View all label', { default: 'View collection' }),
        liquidSetting('viewAllHref', 'url', 'View all URL', { default: '/collections/new-arrivals' }),
      ],
      blocks: [liquidInlineBlock('product-card', 'Product card', [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('price', 'text', 'Price'),
        liquidSetting('url', 'url', 'Product URL'),
      ])],
      body: [
        '<section class="lb-featured-products" data-section-id="{{ section.id }}">',
        '  <div><h2>{{ section.settings.title }}</h2>{% if section.settings.subtitle %}<p>{{ section.settings.subtitle }}</p>{% endif %}</div>',
        '  <div class="lb-featured-products__items">',
        '    {% for block in section.blocks %}<article class="lb-product-card"><a href="{{ block.settings.url }}"><strong>{{ block.settings.title }}</strong><span>{{ block.settings.price }}</span></a></article>{% endfor %}',
        '  </div>',
        '  <a href="{{ section.settings.viewAllHref | store_url }}">{{ section.settings.viewAllLabel }}</a>',
        '</section>',
      ],
    }),
    'experience-timeline': createLiquidSectionFile({
      type: 'experience-timeline',
      name: 'Experience Timeline',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'Experience' })],
      blocks: [liquidInlineBlock('experience', 'Experience', [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('company', 'text', 'Company'),
        liquidSetting('period', 'text', 'Period'),
      ])],
      body: [
        '<section class="lb-experience-timeline" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.company }}</p><time>{{ block.settings.period }}</time></article>{% endfor %}',
        '</section>',
      ],
    }),
    // FAQ Accordion — merchant-authored content only (no commerce drop involved).
    // Disclosure is native <details>/<summary>: the sanitizer forbids <script>, so a JS accordion
    // could never ship, and the HTML element is keyboard- and screen-reader-accessible for free.
    // allowMultipleOpen === false maps onto the exclusive-accordion `name` attribute, scoped to the
    // section id so two FAQ sections on one page never close each other's items.
    'faq-accordion': createLiquidSectionFile({
      type: 'faq-accordion',
      name: 'FAQ Accordion',
      settings: [
        liquidSetting('title', 'text', 'Title', { default: 'Frequently asked questions' }),
        liquidSetting('allowMultipleOpen', 'toggle', 'Allow multiple open', { default: false }),
      ],
      blocks: [liquidInlineBlock('faq-item', 'FAQ item', [
        liquidSetting('question', 'text', 'Question'),
        liquidSetting('answer', 'richtext', 'Answer'),
      ])],
      body: [
        '<section class="lb-faq-accordion" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% if section.blocks.size > 0 %}',
        '  <div class="lb-faq-accordion__items">',
        '    {% for block in section.blocks %}<details class="lb-faq-accordion__item"{% unless section.settings.allowMultipleOpen %} name="lb-faq-{{ section.id }}"{% endunless %}><summary class="lb-faq-accordion__question">{{ block.settings.question }}</summary><div class="lb-faq-accordion__answer">{{ block.settings.answer }}</div></details>{% endfor %}',
        '  </div>',
        '  {% else %}',
        '  <p class="lb-faq-accordion__empty">No questions published yet.</p>',
        '  {% endif %}',
        '</section>',
      ],
    }),
    footer: createLiquidSectionFile({
      type: 'footer',
      name: 'Footer',
      settings: [
        liquidSetting('storeName', 'text', 'Store name'),
        liquidSetting('tagline', 'text', 'Tagline'),
        liquidSetting('contactEmail', 'text', 'Contact email'),
        liquidSetting('contactPhone', 'text', 'Contact phone'),
        liquidSetting('instagramUrl', 'url', 'Instagram URL'),
        liquidSetting('facebookUrl', 'url', 'Facebook URL'),
        liquidSetting('twitterUrl', 'url', 'Twitter/X URL'),
      ],
      blocks: [liquidInlineBlock('link', 'Link', [
        liquidSetting('label', 'text', 'Label'),
        liquidSetting('href', 'url', 'URL'),
      ])],
      body: [
        // T2a/W3c — was brand + tagline + two bare links, single column at every width. Real
        // multi-column footer: brand/social, merchant quick links (real `link` blocks — unchanged
        // data source, T1 already routed them through `store_url`), the store's own real policy
        // pages (routes.root_url + the actual /privacy /terms /shipping /returns routes — not
        // invented paths, all four exist under /store/[subdomain]/), contact, and a LetBuyy
        // watermark. Social links render only when the merchant has actually set one — never a
        // placeholder icon linking nowhere.
        '<footer class="lb-footer" data-section-id="{{ section.id }}">',
        '  <div class="lb-footer__grid">',
        '    <div class="lb-footer__brand">',
        '      <h3>{{ section.settings.storeName | default: shop.name }}</h3>',
        '      {% if section.settings.tagline %}<p>{{ section.settings.tagline }}</p>{% endif %}',
        '      {% if section.settings.instagramUrl != blank or section.settings.facebookUrl != blank or section.settings.twitterUrl != blank %}',
        '      <div class="lb-footer__social">',
        `        {% if section.settings.instagramUrl != blank %}<a href="{{ section.settings.instagramUrl }}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${LIQUID_ICONS.instagram}</a>{% endif %}`,
        `        {% if section.settings.facebookUrl != blank %}<a href="{{ section.settings.facebookUrl }}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${LIQUID_ICONS.facebook}</a>{% endif %}`,
        `        {% if section.settings.twitterUrl != blank %}<a href="{{ section.settings.twitterUrl }}" target="_blank" rel="noopener noreferrer" aria-label="Twitter/X">${LIQUID_ICONS.twitter}</a>{% endif %}`,
        '      </div>',
        '      {% endif %}',
        '    </div>',
        // T5/W5 — same override precedence as the header (W1): explicit `link` blocks win when
        // present (existing stores keep exactly what they configured); an empty block list falls
        // through to the merchant's real footer_menu linklist. Policies below are DELIBERATELY left
        // on shop.policies (T3-fix/T4's source, storefront_policies) rather than linklists.
        // policy_menu — the phase brief's own protected invariant is "policies conditional on
        // publication," and shop.policies is what publication actually gates; nav.policies is a
        // separate, unrelated navigation list that has no relationship to what is published, so
        // switching sources here would silently change what "protected invariant" means.
        '    {% if section.blocks.size > 0 %}',
        '    <div class="lb-footer__col"><h4>Quick links</h4><nav>{% for block in section.blocks %}<a href="{{ block.settings.href | store_url }}">{{ block.settings.label }}</a>{% endfor %}</nav></div>',
        '    {% elsif linklists.footer_menu.links.size > 0 %}',
        '    <div class="lb-footer__col"><h4>Quick links</h4><nav>{% for link in linklists.footer_menu.links %}<a href="{{ link.url | store_url }}"{% if link.active %} aria-current="page"{% endif %}>{{ link.title }}</a>{% endfor %}</nav></div>',
        '    {% endif %}',
        // T3-fix W3 — shop.policies is the real set of policy TYPES this store has published
        // (composition-engine.tsx, sourced from storefront_policies), not a hardcoded assumption
        // that all four exist. Only link to a policy page this store can actually answer with
        // 200; the whole column disappears rather than showing an empty "Policies" heading when
        // none are published. Returns checks both historical type names (refund/returns) — see
        // returns/page.tsx's own identical fallback.
        '    {% if shop.policies.size > 0 %}<div class="lb-footer__col">',
        '      <h4>Policies</h4>',
        '      <nav>',
        '        {% if shop.policies contains \'privacy\' %}<a href="{{ routes.root_url }}/privacy">Privacy policy</a>{% endif %}',
        '        {% if shop.policies contains \'terms\' %}<a href="{{ routes.root_url }}/terms">Terms of service</a>{% endif %}',
        '        {% if shop.policies contains \'shipping\' %}<a href="{{ routes.root_url }}/shipping">Shipping policy</a>{% endif %}',
        '        {% if shop.policies contains \'refund\' or shop.policies contains \'returns\' %}<a href="{{ routes.root_url }}/returns">Returns policy</a>{% endif %}',
        '      </nav>',
        '    </div>{% endif %}',
        '    <div class="lb-footer__col">',
        '      <h4>Contact</h4>',
        '      {% if section.settings.contactEmail != blank %}<p><a href="mailto:{{ section.settings.contactEmail }}">{{ section.settings.contactEmail }}</a></p>{% endif %}',
        '      {% if section.settings.contactPhone != blank %}<p><a href="tel:{{ section.settings.contactPhone }}">{{ section.settings.contactPhone }}</a></p>{% endif %}',
        '      <a href="{{ routes.contact_url }}">Contact us</a>',
        '    </div>',
        '  </div>',
        '  <div class="lb-footer__bottom">',
        '    <p>&copy; {{ shop.name }}. All rights reserved.</p>',
        '    <a class="lb-footer__watermark" href="https://letbuyy.com" target="_blank" rel="noopener noreferrer">Powered by LetBuyy</a>',
        '  </div>',
        '</footer>',
      ],
    }),
    header: createLiquidSectionFile({
      type: 'header',
      name: 'Header',
      settings: [
        liquidSetting('storeName', 'text', 'Store name'),
        liquidSetting('showSearch', 'toggle', 'Show search', { default: true }),
        liquidSetting('showCart', 'toggle', 'Show cart', { default: true }),
        // T2a/W3a — mirrors the React header's own `behavior` setting (template_config.sections.
        // header.settings.behavior). Was declared nowhere on the Liquid side, so "Sticky" never had
        // anything to actually turn on; header.liquid's data-sticky attribute now reads it directly.
        liquidSetting('behavior', 'select', 'Header behavior', { default: 'sticky', options: ['static', 'sticky'] }),
        // T5/W1 — which linklist (built by navToLinklists from the merchant's real
        // control-plane navigation) populates the primary nav when no explicit `link` blocks are
        // configured. There is no link_list-picker control in SchemaFormRenderer yet (checked
        // apps/merchant/web/src/components/theme-editor/controls/ — only the types in
        // ThemeBundleSettingFieldSchema exist: text/textarea/richtext/color/image/select/toggle/
        // range/number/url/radio), so this is a `select` over the three fixed handles
        // navToLinklists actually produces — an accurate, if coarse, interim per the phase brief.
        liquidSetting('menu', 'select', 'Menu', { default: 'main_menu', options: ['main_menu', 'footer_menu', 'policy_menu'] }),
        liquidSetting('layout', 'select', 'Layout', { default: 'inline', options: ['inline', 'centered'] }),
      ],
      // T5/W1 — explicit `link` blocks remain a supported OVERRIDE: any store that already
      // configured them keeps exactly its existing header, unchanged. Only a header with ZERO
      // blocks falls through to the merchant's real linklist. This precedence (blocks win when
      // present) is deliberate backward compatibility, not an accident of code order.
      blocks: [liquidInlineBlock('link', 'Link', [
        liquidSetting('label', 'text', 'Label'),
        liquidSetting('href', 'url', 'URL'),
      ])],
      body: [
        '<header class="lb-header" data-section-id="{{ section.id }}" data-sticky="{% if section.settings.behavior == \'sticky\' %}true{% else %}false{% endif %}" data-layout="{{ section.settings.layout | default: \'inline\' }}">',
        '  <div class="lb-header__inner">',
        // T2a/W3a — <lb-mobile-nav> wraps the toggle button + the ONE nav-links list; CSS
        // repositions the SAME markup between the mobile off-canvas drawer and the desktop inline
        // row (see LIQUID_THEME_BASE_CSS), so there is exactly one list to keep in sync — no
        // separate mobile/desktop nav content to duplicate or drift. T5/W2 kept this one-DOM
        // design deliberately (see docs/theme-deploy-chain.md sibling report section X) rather than
        // splitting into two nav trees, since the existing architecture note above already argued
        // the drift risk of two copies, and CSS alone is enough to give each width a native-feeling
        // affordance (inline row vs. off-canvas drawer) over identical markup.
        '    <lb-mobile-nav class="lb-mobile-nav" data-lb-island="mobile-nav">',
        `      <button type="button" class="lb-header__toggle" data-lb-nav-toggle aria-expanded="false" aria-controls="lb-nav-panel-{{ section.id }}" aria-label="Menu">${LIQUID_ICONS.hamburger}<span class="lb-sr-only">Menu</span></button>`,
        '      <nav class="lb-header__nav" data-lb-nav-panel id="lb-nav-panel-{{ section.id }}" aria-label="Primary">',
        `        <div class="lb-header__nav-head"><span class="lb-header__nav-head-brand">{{ section.settings.storeName | default: shop.name }}</span><button type="button" class="lb-header__nav-close" data-lb-nav-close aria-label="Close menu">${LIQUID_ICONS.close}<span class="lb-sr-only">Close menu</span></button></div>`,
        '        <div class="lb-header__nav-links">',
        '        {% if section.blocks.size > 0 %}',
        '          {% for block in section.blocks %}<a href="{{ block.settings.href | store_url }}">{{ block.settings.label }}</a>{% endfor %}',
        '        {% else %}',
        '          {% assign lb_menu_handle = section.settings.menu | default: \'main_menu\' %}',
        '          {% assign lb_nav_links = linklists[lb_menu_handle].links %}',
        '          {% for link in lb_nav_links %}',
        '            {% if link.links.size > 0 %}',
        `            <details class="lb-header__nav-item" data-lb-nav-dropdown><summary{% if link.active %} aria-current="page"{% endif %}>{{ link.title }}${LIQUID_ICONS.chevron}</summary>`,
        '              <div class="lb-header__nav-submenu">{% for child in link.links %}<a href="{{ child.url | store_url }}"{% if child.active %} aria-current="page"{% endif %}>{{ child.title }}</a>{% endfor %}</div>',
        '            </details>',
        '            {% else %}<a href="{{ link.url | store_url }}"{% if link.active %} aria-current="page"{% endif %}>{{ link.title }}</a>{% endif %}',
        '          {% endfor %}',
        '        {% endif %}',
        '        </div>',
        '        <div class="lb-header__nav-foot">',
        `          {% if customer %}<a href="{{ routes.account_url }}">${LIQUID_ICONS.account}<span>Account</span></a>{% else %}<a href="{{ routes.customer_login_url }}">${LIQUID_ICONS.account}<span>Log in</span></a>{% endif %}`,
        '        </div>',
        '      </nav>',
        '      <div class="lb-header__scrim" data-lb-nav-scrim></div>',
        '    </lb-mobile-nav>',
        '    <a class="lb-header__brand" href="{{ routes.root_url }}">',
        '      {% if shop.logo_url %}<img class="lb-header__logo" src="{{ shop.logo_url | image_url }}" alt="{{ section.settings.storeName | default: shop.name }}">{% else %}{{ section.settings.storeName | default: shop.name }}{% endif %}',
        '    </a>',
        '    <div class="lb-header__actions">',
        `      {% if section.settings.showSearch %}<button type="button" class="lb-header__search-toggle" data-lb-search-toggle aria-expanded="false" aria-controls="lb-search-overlay-{{ section.id }}" aria-label="Search">${LIQUID_ICONS.search}<span class="lb-sr-only">Search</span></button>{% endif %}`,
        `      <a class="lb-header__account" href="{% if customer %}{{ routes.account_url }}{% else %}{{ routes.customer_login_url }}{% endif %}">${LIQUID_ICONS.account}<span class="lb-sr-only">{% if customer %}Account{% else %}Log in{% endif %}</span></a>`,
        // T5/W4 — the header cart control is now the drawer's ONLY open trigger (data-lb-cart-trigger,
        // wired to CART_OPEN_EVENT in liquid-hydration-islands.tsx). The real href to routes.cart_url
        // is kept so the cart PAGE stays reachable with JS disabled, via right-click "open in new tab",
        // and via the drawer's own "View cart" link (see LbCartDrawerElement) — clicking it normally
        // opens the drawer instead of navigating away. cart.item_count is null at SSR (no cart token
        // exists server-side — T1's own documented, deliberate honesty); `default: 0` is the same
        // standard placeholder every storefront shows before the client-side cart hydrates via the
        // same CART_CHANGED_EVENT the cart-drawer/cart-page islands already dispatch.
        `      {% if section.settings.showCart %}<a class="lb-header__cart" href="{{ routes.cart_url }}" data-lb-cart-trigger>${LIQUID_ICONS.cart}<span class="lb-sr-only">{{ "general.cart" | t }}</span> (<span data-lb-cart-count>{{ cart.item_count | default: 0 }}</span>)</a>{% endif %}`,
        '    </div>',
        '  </div>',
        '  {% if section.settings.showSearch %}',
        '  <div class="lb-header__search-overlay" id="lb-search-overlay-{{ section.id }}" data-lb-search-overlay hidden>',
        '    <lb-predictive-search class="lb-predictive-search" data-lb-island="predictive-search" data-search-url="{{ routes.search_url }}">',
        '      <form role="search" method="get" action="{{ routes.search_url }}" data-lb-search-form>',
        '        <label class="lb-sr-only" for="lb-search-input-{{ section.id }}">Search products</label>',
        '        <input type="search" name="search" id="lb-search-input-{{ section.id }}" data-lb-search-input placeholder="Search products" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="lb-search-results-{{ section.id }}" aria-autocomplete="list">',
        `        <button type="submit" aria-label="Search">${LIQUID_ICONS.search}<span class="lb-sr-only">Search</span></button>`,
        `        <button type="button" data-lb-search-close aria-label="Close search">${LIQUID_ICONS.close}<span class="lb-sr-only">Close search</span></button>`,
        '      </form>',
        '      <div id="lb-search-results-{{ section.id }}" class="lb-predictive-search__results" data-lb-search-results role="listbox" aria-live="polite"></div>',
        '    </lb-predictive-search>',
        '  </div>',
        '  {% endif %}',
        '</header>',
      ],
    }),
    'hero-banner': createLiquidSectionFile({
      type: 'hero-banner',
      name: 'Hero Banner',
      settings: [
        // D6: added image, overlay, height, textAlign to match React heroBanner schema parity.
        // eyebrow is additive (Liquid superset — not in React schema but kept for backwards compat).
        liquidSetting('eyebrow', 'text', 'Eyebrow', { default: 'New season essentials' }),
        liquidSetting('heading', 'text', 'Heading', { default: 'Fresh drops for daily buyers' }),
        liquidSetting('subheading', 'textarea', 'Subheading'),
        liquidSetting('ctaText', 'text', 'Button text', { default: 'Shop Now' }),
        liquidSetting('ctaLink', 'url', 'Button link', { default: '/products' }),
        liquidSetting('image', 'image', 'Background Image'),
        liquidSetting('overlay', 'range', 'Overlay Opacity', { default: 0.4, min: 0, max: 1, step: 0.1 }),
        liquidSetting('height', 'select', 'Height', { options: ['full', 'large', 'medium', 'small'], default: 'full' }),
        liquidSetting('textAlign', 'select', 'Text Alignment', { options: ['left', 'center', 'right'], default: 'center' }),
      ],
      body: [
        '{% assign overlay_value = section.settings.overlay | default: 0.4 %}',
        '<section class="lb-hero-banner" data-section-id="{{ section.id }}" data-height="{{ section.settings.height | default: \'full\' }}" data-text-align="{{ section.settings.textAlign | default: \'center\' }}">',
        '  {% if section.settings.image %}<div class="lb-hero-banner__bg" data-image-url="{{ section.settings.image | image_url }}" data-overlay="{{ overlay_value }}"></div>{% endif %}',
        '  {% if section.settings.eyebrow %}<p class="lb-hero-banner__eyebrow">{{ section.settings.eyebrow }}</p>{% endif %}',
        '  <h1 class="lb-hero-banner__heading">{{ section.settings.heading }}</h1>',
        '  {% if section.settings.subheading %}<p class="lb-hero-banner__subheading">{{ section.settings.subheading }}</p>{% endif %}',
        '  <a href="{{ section.settings.ctaLink | store_url }}" class="lb-hero-banner__cta">{{ section.settings.ctaText }}</a>',
        '</section>',
      ],
    }),
    marquee: createLiquidSectionFile({
      type: 'marquee',
      name: 'Marquee',
      settings: [liquidSetting('text', 'text', 'Text', { default: 'Featured announcement' })],
      body: [
        '<section class="lb-marquee" data-section-id="{{ section.id }}">',
        '  <p>{{ section.settings.text }}</p>',
        '</section>',
      ],
    }),
    'portfolio-grid': createLiquidSectionFile({
      type: 'portfolio-grid',
      name: 'Portfolio Grid',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'Portfolio' })],
      blocks: [liquidInlineBlock('project', 'Project', [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('summary', 'textarea', 'Summary'),
        liquidSetting('link', 'url', 'Link'),
      ])],
      body: [
        '<section class="lb-portfolio-grid" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.summary }}</p><a href="{{ block.settings.link | store_url }}">View</a></article>{% endfor %}',
        '</section>',
      ],
    }),
    'product-detail': createLiquidSectionFile({
      type: 'product-detail',
      name: 'Product Detail',
      settings: [
        liquidSetting('showGallery', 'toggle', 'Show gallery', { default: true }),
        liquidSetting('showDescription', 'toggle', 'Show description', { default: true }),
        liquidSetting('showReviews', 'toggle', 'Show reviews', { default: true }),
      ],
      body: [
        '<section class="lb-product-detail" data-section-id="{{ section.id }}">',
        // T6/W3 — a real, visible breadcrumb (the JSON-LD structured-data breadcrumb already ships
        // separately from apps/commerce/web's own page component, see buildBreadcrumbJsonLd in
        // lib/seo.ts — this is the on-page, clickable counterpart Dawn also ships). Every href through
        // store_url, matching the rest of this bundle's convention.
        '  <nav class="lb-product-detail__breadcrumb" aria-label="Breadcrumb">',
        '    <a href="{{ routes.root_url }}">Home</a>',
        '    <a href="{{ routes.all_products_collection_url }}">Shop</a>',
        '    <span aria-current="page">{{ product.title }}</span>',
        '  </nav>',
        '  <div class="lb-product-detail__layout">',
        // T6/W3 — a real image carousel + thumbnails (lb-product-gallery, liquid-hydration-islands.tsx).
        // No-JS-first: every image renders up front, `hidden` on all but the first — a browser with
        // JS disabled sees a plain stacked image list, never zero images. images.size > 1 gates the
        // thumbnail row so a single-image product does not render a redundant one-thumbnail strip.
        '  {% if section.settings.showGallery and product.images.size > 0 %}',
        '  <lb-product-gallery class="lb-product-detail__gallery" data-lb-island="product-gallery">',
        '    <div class="lb-product-detail__gallery-main">',
        '      {% for image in product.images %}<img class="lb-product-detail__gallery-image" src="{{ image | image_url }}" alt="{{ product.title }}" data-lb-gallery-image data-index="{{ forloop.index0 }}"{% unless forloop.first %} hidden{% endunless %} loading="{% if forloop.first %}eager{% else %}lazy{% endif %}" decoding="async">{% endfor %}',
        '    </div>',
        '    {% if product.images.size > 1 %}',
        '    <div class="lb-product-detail__gallery-thumbs" role="tablist" aria-label="Product images">',
        '      {% for image in product.images %}<button type="button" class="lb-product-detail__gallery-thumb" data-lb-gallery-thumb data-index="{{ forloop.index0 }}" role="tab" aria-selected="{% if forloop.first %}true{% else %}false{% endif %}" tabindex="{% if forloop.first %}0{% else %}-1{% endif %}" aria-label="Image {{ forloop.index }} of {{ product.images.size }}"><img src="{{ image | image_url }}" alt="" aria-hidden="true" loading="lazy" decoding="async"></button>{% endfor %}',
        '    </div>',
        '    {% endif %}',
        '  </lb-product-gallery>',
        '  {% endif %}',
        '  <div class="lb-product-detail__info">',
        '  <h1>{{ product.title }}</h1>',
        '  {% if product.review_count > 0 %}<p class="lb-product-detail__rating" aria-label="Rated {{ product.rating }} out of 5">★ {{ product.rating }} <span class="lb-product-detail__rating-count">({{ product.review_count }})</span></p>{% endif %}',
        // T6/W3 — compare-at price + real percentage savings, the same "compare_at_price >
        // price" gate the product card already uses (never a fabricated discount).
        '  <div class="lb-product-detail__price">',
        '    <span class="lb-product-detail__price-current">{{ product.price | times: 100 | money_with_currency: product.currency }}</span>',
        '    {% if product.compare_at_price and product.compare_at_price > product.price %}',
        '    <s class="lb-product-detail__price-compare">{{ product.compare_at_price | times: 100 | money_with_currency: product.currency }}</s>',
        '    <span class="lb-product-detail__price-save">Save {{ product.compare_at_price | minus: product.price | times: 100.0 | divided_by: product.compare_at_price | round }}%</span>',
        '    {% endif %}',
        '  </div>',
        // T6/W3 — data-variants carries the real product.variants array (id/options/stock, the same
        // shape commerce-core's ProductVariant already declares) so LbVariantPickerElement can judge
        // real availability once every option group is selected — see its own doc comment for why
        // this attribute is safe to embed with raw quotes (the engine's outputEscape already proved
        // it HTML-entity-escapes {{ }} output landing inside an attribute, confirmed against
        // data-product-name earlier in this same template).
        '  {% if product.options.size > 0 %}<lb-variant-picker data-lb-island="variant-picker" data-product-id="{{ product.id }}" data-variants="{{ product.variants | json }}" class="lb-product-detail__variants">{% for option in product.options %}<div class="lb-product-detail__variant-group"><span class="lb-variant-option__name">{{ option.name }}</span><div class="lb-product-detail__variant-values">{% for value in option.values %}<button type="button" data-lb-variant-option data-variant-name="{{ option.name }}" data-variant-value="{{ value }}" aria-pressed="false">{{ value }}</button>{% endfor %}</div></div>{% endfor %}<p class="lb-product-detail__variant-status" data-lb-variant-status role="status"></p></lb-variant-picker>{% endif %}',
        // T6/W3 — quantity was already fully supported by LbAddToCartElement/quantityFromElement
        // ([name="quantity"] or [data-lb-quantity] within the element) but never rendered anywhere;
        // this is the first Liquid template to actually surface it. Buy now reuses the exact same
        // add-to-cart call (see LbAddToCartElement.addCurrentProduct) and then redirects straight to
        // the one existing checkout route instead of opening the drawer — not a second checkout path.
        '  <div class="lb-product-detail__purchase">',
        '    <lb-add-to-cart data-lb-island="add-to-cart" data-product-id="{{ product.id }}" data-product-name="{{ product.title }}" data-product-price="{{ product.price }}" data-product-currency="{{ product.currency }}" data-product-url="{{ product.url }}">',
        '      <label class="lb-sr-only" for="lb-quantity-{{ section.id }}">Quantity</label>',
        '      <input type="number" name="quantity" id="lb-quantity-{{ section.id }}" class="lb-product-detail__quantity" value="1" min="1" inputmode="numeric">',
        '      <button type="button" class="lb-product-detail__cta lb-product-detail__cta--primary" data-lb-add-to-cart{% if product.available == false %} disabled{% endif %}>{% if product.available == false %}Sold out{% else %}Add to cart{% endif %}</button>',
        '      <button type="button" class="lb-product-detail__cta lb-product-detail__cta--secondary" data-lb-buy-now{% if product.available == false %} disabled{% endif %}>Buy now</button>',
        '      <span data-lb-add-to-cart-status aria-live="polite"></span>',
        '    </lb-add-to-cart>',
        '    <lb-wishlist-toggle data-lb-island="wishlist-toggle" data-product-id="{{ product.id }}" data-store-id="{{ shop.id }}" data-in-wishlist="{% if product.in_wishlist %}true{% endif %}"{% if buyer_wishlist.authenticated %} data-authenticated="true" data-account-type="buyer" data-buyer-id="{{ buyer_wishlist.buyerId }}" data-buyer-linked="{% if buyer_wishlist.linked %}true{% endif %}" data-buyer-unavailable="{% if buyer_wishlist.unavailable or buyer_wishlist.storeAccountUnavailable %}true{% endif %}"{% elsif customer %} data-authenticated="true" data-account-type="store_customer"{% endif %} data-base-path="/store/{{ shop.subdomain }}" aria-label="Add {{ product.title }} to wishlist"></lb-wishlist-toggle>',
        '  </div>',
        // T6/W3 — description, shipping and returns as <details> accordions (confirmed to survive the
        // sanitizer, matching faq-accordion.liquid's own established pattern). Shipping/returns are
        // gated on shop.policies (the SAME published-policy source T3-fix/T4/T5 already wired the
        // footer to, deliberately not a second data-fetch) and link to the real policy pages rather
        // than duplicating policy body text inline — no legal text authored here, and an unpublished
        // policy renders no accordion at all, not an empty one.
        '  {% if section.settings.showDescription and product.description %}',
        '  <details class="lb-product-detail__accordion"><summary>Description</summary><div class="lb-product-detail__accordion-body">{{ product.description }}</div></details>',
        '  {% endif %}',
        '  {% if shop.policies contains \'shipping\' %}',
        '  <details class="lb-product-detail__accordion"><summary>Shipping</summary><div class="lb-product-detail__accordion-body"><a href="{{ routes.root_url }}/shipping">Read our shipping policy</a></div></details>',
        '  {% endif %}',
        '  {% if shop.policies contains \'refund\' or shop.policies contains \'returns\' %}',
        '  <details class="lb-product-detail__accordion"><summary>Returns</summary><div class="lb-product-detail__accordion-body"><a href="{{ routes.root_url }}/returns">Read our returns policy</a></div></details>',
        '  {% endif %}',
        '  </div>',
        '  </div>',
        '  {% if section.settings.showReviews and product.reviews.size > 0 %}<div class="lb-product-reviews" data-section-id="{{ section.id }}-reviews">',
        '    <h2 class="lb-product-reviews__title">Customer reviews ({{ product.review_count }})</h2>',
        '    {% for review in product.reviews %}<article class="lb-product-review">',
        '      <header class="lb-product-review__head"><strong class="lb-product-review__author">{{ review.author }}</strong><span class="lb-product-review__stars" aria-label="Rated {{ review.rating }} out of 5">★ {{ review.rating }}</span>{% if review.is_verified %}<span class="lb-product-review__verified">Verified purchase</span>{% endif %}</header>',
        '      {% if review.title %}<h3 class="lb-product-review__heading">{{ review.title }}</h3>{% endif %}',
        '      {% if review.body %}<p class="lb-product-review__body">{{ review.body }}</p>{% endif %}',
        '      {% if review.helpful_count > 0 %}<footer class="lb-product-review__helpful">{{ review.helpful_count }} found this helpful</footer>{% endif %}',
        '    </article>{% endfor %}',
        '  </div>{% endif %}',
        '  {% if section.settings.showReviews %}<lb-review-form data-lb-island="review-form" data-product-id="{{ product.id }}" data-store-id="{{ shop.id }}"></lb-review-form>{% endif %}',
        '</section>',
      ],
    }),
    'product-grid': createLiquidSectionFile({
      type: 'product-grid',
      name: 'Product Grid',
      settings: [
        liquidSetting('title', 'text', 'Heading', { default: 'Featured Products' }),
        liquidSetting('subtitle', 'text', 'Subheading'),
        liquidSetting('columns', 'range', 'Columns', { min: 2, max: 4, step: 1, default: 4 }),
      ],
      body: [
        '<section class="lb-product-grid" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% if section.settings.subtitle %}<p>{{ section.settings.subtitle }}</p>{% endif %}',
        '  <div class="lb-product-grid__items" data-columns="{{ section.settings.columns }}">',
        '    {% for item in collection.products %}<article class="lb-product-card"><a href="{{ item.url }}"><strong>{{ item.title }}</strong><span>{{ item.price | times: 100 | money_with_currency: item.currency }}</span></a><lb-add-to-cart data-lb-island="add-to-cart" data-product-id="{{ item.id }}" data-product-name="{{ item.title }}" data-product-price="{{ item.price }}" data-product-currency="{{ item.currency }}" data-product-url="{{ item.url }}"><button type="button" data-lb-add-to-cart>Add to cart</button></lb-add-to-cart><lb-wishlist-toggle data-lb-island="wishlist-toggle" data-product-id="{{ item.id }}" data-store-id="{{ shop.id }}" data-in-wishlist="{% if item.in_wishlist %}true{% endif %}"{% if buyer_wishlist.authenticated %} data-authenticated="true" data-account-type="buyer" data-buyer-id="{{ buyer_wishlist.buyerId }}" data-buyer-linked="{% if buyer_wishlist.linked %}true{% endif %}" data-buyer-unavailable="{% if buyer_wishlist.unavailable or buyer_wishlist.storeAccountUnavailable %}true{% endif %}"{% elsif customer %} data-authenticated="true" data-account-type="store_customer"{% endif %} data-base-path="/store/{{ shop.subdomain }}"></lb-wishlist-toggle></article>{% endfor %}',
        '  </div>',
        '</section>',
      ],
    }),
    'rich-content': createLiquidSectionFile({
      type: 'rich-content',
      name: 'Rich Content',
      settings: [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('body', 'richtext', 'Body'),
      ],
      body: [
        '<section class="lb-rich-content" data-section-id="{{ section.id }}">',
        '  <h1>{{ section.settings.title }}</h1>',
        '  <div>{{ section.settings.body }}</div>',
        '</section>',
      ],
    }),
    'services-grid': createLiquidSectionFile({
      type: 'services-grid',
      name: 'Services Grid',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'Services' })],
      blocks: [liquidInlineBlock('service', 'Service', [
        liquidSetting('title', 'text', 'Title'),
        liquidSetting('description', 'textarea', 'Description'),
        liquidSetting('link', 'url', 'Link'),
      ])],
      body: [
        '<section class="lb-services-grid" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.description }}</p><a href="{{ block.settings.link | store_url }}">Learn more</a></article>{% endfor %}',
        '</section>',
      ],
    }),
    'skills-section': createLiquidSectionFile({
      type: 'skills-section',
      name: 'Skills Section',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'Skills' })],
      blocks: [liquidInlineBlock('skill', 'Skill', [
        liquidSetting('name', 'text', 'Skill'),
        liquidSetting('level', 'range', 'Level', { min: 0, max: 100, step: 5 }),
      ])],
      body: [
        '<section class="lb-skills-section" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        // React groups skills by a per-skill "category" field, defaulting ungrouped skills to
        // "General" (skills-section.tsx). The Liquid skill block declares no category field today
        // (every skill is uncategorized), so "General" applies universally here — this mirrors
        // React's actual current behavior exactly rather than fabricating a grouping feature the
        // schema does not yet support.
        '  {% if section.blocks.size > 0 %}<h3>General</h3>{% endif %}',
        '  {% for block in section.blocks %}<span data-level="{{ block.settings.level }}">{{ block.settings.name }} {{ block.settings.level }}%</span>{% endfor %}',
        '</section>',
      ],
    }),
    testimonials: createLiquidSectionFile({
      type: 'testimonials',
      name: 'Testimonials',
      settings: [liquidSetting('title', 'text', 'Title', { default: 'What customers say' })],
      blocks: [liquidInlineBlock('testimonial', 'Testimonial', [
        liquidSetting('quote', 'textarea', 'Quote'),
        liquidSetting('author', 'text', 'Author'),
      ])],
      body: [
        '<section class="lb-testimonials" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% if section.blocks.size > 0 %}<div class="lb-testimonials__items">{% for block in section.blocks %}<blockquote><p>{{ block.settings.quote }}</p><cite>{{ block.settings.author }}</cite></blockquote>{% endfor %}</div>',
        '  {% else %}<p class="lb-testimonials__empty">Add customer reviews to build trust.</p>{% endif %}',
        '</section>',
      ],
    }),
    'trust-badges': createLiquidSectionFile({
      type: 'trust-badges',
      name: 'Trust Badges',
      settings: [liquidSetting('title', 'text', 'Title')],
      blocks: [liquidInlineBlock('badge', 'Badge', [
        liquidSetting('label', 'text', 'Label'),
        liquidSetting('description', 'text', 'Description'),
      ])],
      body: [
        '<section class="lb-trust-badges" data-section-id="{{ section.id }}">',
        '  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}',
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.label }}</h3><span>{{ block.settings.description }}</span></article>{% endfor %}',
        '</section>',
      ],
    }),
    'newsletter-signup': createLiquidSectionFile({
      type: 'newsletter-signup',
      name: 'Newsletter Signup',
      settings: [
        liquidSetting('title', 'text', 'Heading', { default: 'Get first access' }),
        liquidSetting('subtitle', 'text', 'Subheading'),
        liquidSetting('buttonLabel', 'text', 'Button label', { default: 'Sign up' }),
      ],
      body: [
        '<section class="lb-newsletter-signup" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  {% if section.settings.subtitle %}<p>{{ section.settings.subtitle }}</p>{% endif %}',
        '  <form action="/contact" method="post"><input type="email" name="email" aria-label="Email" required><button type="submit">{{ section.settings.buttonLabel }}</button></form>',
        '</section>',
      ],
    }),
  };
}

function isLiquidThemePackageBundle(input: PortableThemePackageBundle): input is LiquidThemePackageBundle {
  return input.renderer.engine === 'liquid';
}

function liquidSettingsToFieldRecord(settings: LiquidSettingField[]): Record<string, Record<string, unknown>> {
  return settings.reduce<Record<string, Record<string, unknown>>>((fields, setting) => {
    const { id, ...field } = setting;
    fields[id] = field;
    return fields;
  }, {});
}

function liquidInlineBlockDefinitionToSchema(
  block: LiquidSectionBlockDefinition,
): { name: string; fields: Record<string, Record<string, unknown>> } {
  if (block.type === '@app' || !('settings' in block)) {
    return {
      name: block.name,
      fields: {
        extension_handle: {
          type: 'text',
          label: 'Extension handle',
          maxLength: 120,
        },
        slot: {
          type: 'text',
          label: 'Slot',
          maxLength: 160,
        },
      },
    };
  }

  return {
    name: block.name,
    fields: liquidSettingsToFieldRecord(block.settings),
  };
}

function liquidReusableBlockDefinitionToSchema(
  block: ThemeLiquidBlockDefinition,
): { name: string; fields: Record<string, Record<string, unknown>> } {
  return {
    name: block.name,
    fields: liquidSettingsToFieldRecord(block.settings),
  };
}

function buildLiquidRuntimeSectionSchemas(bundle: LiquidThemePackageBundle): Record<string, Record<string, unknown>> {
  const reusableBlockSchemas = Object.entries(bundle.blocks).reduce<Record<string, { name: string; fields: Record<string, Record<string, unknown>> }>>(
      (schemas, [blockType, block]) => {
      schemas[blockType] = liquidReusableBlockDefinitionToSchema(block.schema);
      return schemas;
    },
    {},
  );

  return Object.entries(bundle.sections).reduce<Record<string, Record<string, unknown>>>((schemas, [sectionType, sectionFile]) => {
    const inlineBlockSchemas = sectionFile.schema.blocks.reduce<Record<string, { name: string; fields: Record<string, Record<string, unknown>> }>>(
      (blocks, block) => {
        // Empty reference declarations inherit their reusable block schema.
        // Zod defaults settings to [], so presence alone is not a definition.
        blocks[block.type] = block.type !== '@app' && 'settings' in block && block.settings.length === 0 && reusableBlockSchemas[block.type]
          ? reusableBlockSchemas[block.type]
          : liquidInlineBlockDefinitionToSchema(block);
        return blocks;
      },
      {},
    );

    schemas[sectionType] = {
      name: sectionFile.schema.name,
      type: sectionType,
      description: `Liquid section file ${sectionFile.path}`,
      defaults: sectionFile.schema.presets[0]?.settings || {},
      presets: sectionFile.schema.presets.map((preset) => ({
        name: preset.name,
        settings: preset.settings,
      })),
      renderer_key: `liquid.section.${sectionType}`,
      settings_schema: liquidSettingsToFieldRecord(sectionFile.schema.settings),
      blocks_schema: {
        ...inlineBlockSchemas,
      },
      source_path: sectionFile.path,
    };
    return schemas;
  }, {});
}

function buildLiquidRuntimeBlockSchemas(bundle: LiquidThemePackageBundle): Record<string, Record<string, unknown>> {
  const blockSchemas = Object.entries(bundle.blocks).reduce<Record<string, Record<string, unknown>>>((schemas, [blockType, blockFile]) => {
    schemas[blockType] = {
      name: blockFile.schema.name,
      fields: liquidSettingsToFieldRecord(blockFile.schema.settings),
      source_path: blockFile.path,
    };
    return schemas;
  }, {});

  blockSchemas['@app'] = {
    name: 'App block',
    fields: {
      extension_handle: {
        type: 'text',
        label: 'Extension handle',
        maxLength: 120,
      },
      slot: {
        type: 'text',
        label: 'Slot',
        maxLength: 160,
      },
    },
  };

  return blockSchemas;
}

export function parseThemeBundle(input: unknown): ThemeBundle {
  return ThemePackageBundleSchema.parse(input);
}

export function parseThemePackageBundle(input: unknown): ThemePackageBundle {
  return ThemePackageBundleSchema.parse(input);
}

export function parseLiquidThemePackageBundle(input: unknown): LiquidThemePackageBundle {
  const bundle = LiquidThemePackageBundleSchema.parse(input);
  // G4: fail-closed on an unrecognized schema_version. A missing version was already stamped to the
  // current version by the schema `.default(...)`, so this only rejects an EXPLICIT unknown/future value.
  if (!isKnownLiquidBundleSchemaVersion(bundle.schema_version)) {
    throw new UnsupportedLiquidBundleSchemaVersionError(bundle.schema_version);
  }
  return bundle;
}

export function parsePortableThemePackageBundle(input: unknown): PortableThemePackageBundle {
  return PortableThemePackageBundleSchema.parse(input);
}

export function validateThemeBundle(input: unknown): ThemeBundleValidationResult {
  const result = ThemePackageBundleSchema.safeParse(input);
  if (result.success) {
    return {
      ok: true,
      bundle: result.data,
      issues: [],
    };
  }

  return {
    ok: false,
    issues: formatThemeBundleIssues(result.error.issues),
  };
}

export function collectThemePackageBundleIssues(input: unknown): string[] {
  const result = ThemePackageBundleSchema.safeParse(input);
  if (result.success) return [];

  return formatThemeBundleIssues(result.error.issues);
}

export function collectLiquidThemePackageBundleIssues(input: unknown): string[] {
  const result = LiquidThemePackageBundleSchema.safeParse(input);
  if (result.success) return [];

  return formatThemeBundleIssues(result.error.issues);
}

function formatThemeBundleIssues(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

export function buildThemePackagePersistencePayload(input: ThemePackageBundle): ThemePackagePersistencePayload {
  const bundle = parseThemePackageBundle(input);
  const rendererKeys = Array.from(new Set(Object.values(bundle.sections).map((section) => section.renderer_key)));
  const runtimeSectionSchemas: Record<string, Record<string, unknown>> = {};

  for (const [sectionType, section] of Object.entries(bundle.sections)) {
    const blocksSchema: Record<string, { name: string; fields: Record<string, unknown> }> = {};

    for (const blockType of section.block_types) {
      const block = bundle.blocks[blockType];
      if (!block) continue;

      blocksSchema[blockType] = {
        name: block.name,
        fields: block.settings_schema,
      };
    }

    runtimeSectionSchemas[sectionType] = {
      ...section,
      blocks_schema: blocksSchema,
    };
  }

  return {
    themePackage: {
      slug: bundle.package.slug,
      name: bundle.package.name,
      description: bundle.package.description,
      author_name: bundle.package.author_name,
      site_types: bundle.package.site_types,
      status: bundle.package.status,
      pricing_type: bundle.package.pricing_type,
      price: bundle.package.price,
      currency: bundle.package.currency,
      marketplace_metadata: {
        bundle_schema_version: bundle.schema_version,
        bundle_paths: THEME_BUNDLE_PATHS,
        engine: bundle.renderer.engine,
      },
    },
    themePackageVersion: {
      version: bundle.package.version,
      version_number: bundle.package.version_number,
      release_status: bundle.package.release_status,
      renderer_version: bundle.renderer.renderer_version,
      schema_version: bundle.schema_version,
      compatibility_range: bundle.package.compatibility_range,
      package_manifest: {
        bundle_schema_version: bundle.schema_version,
        package: bundle.package,
        config: bundle.config,
        templates: bundle.templates,
        sections: bundle.sections,
        blocks: bundle.blocks,
        locales: bundle.locales,
        renderer: bundle.renderer,
        bundle_paths: THEME_BUNDLE_PATHS,
      },
      checksum: bundle.package.checksum,
    },
    schemaManifest: {
      manifest_version: bundle.schema_version,
      schema_manifest: {
        bundle_schema_version: bundle.schema_version,
        settings_path: THEME_BUNDLE_PATHS.settingsSchema,
        settings_data_path: THEME_BUNDLE_PATHS.settingsData,
        templates_path: THEME_BUNDLE_PATHS.templates,
        locales_path: THEME_BUNDLE_PATHS.locales,
      },
      section_schemas: runtimeSectionSchemas,
      block_schemas: bundle.blocks,
      settings_schema: bundle.config.settings_schema,
      template_schema: bundle.templates,
      layout_schema: {},
      validation_rules: {
        order_requires_existing_sections: true,
        block_order_requires_existing_blocks: true,
        template_sections_require_definitions: true,
        template_blocks_require_definitions: true,
        section_block_types_constrain_template_blocks: true,
      },
    },
    rendererManifest: {
      renderer_manifest: bundle.renderer,
      approved_renderer_keys: rendererKeys,
      asset_manifest: bundle.renderer.assets,
      performance_budget: {},
    },
  };
}

export function buildLiquidThemePackagePersistencePayload(input: LiquidThemePackageBundle): ThemePackagePersistencePayload {
  const bundle = parseLiquidThemePackageBundle(input);
  const runtimeSectionSchemas = buildLiquidRuntimeSectionSchemas(bundle);
  const runtimeBlockSchemas = buildLiquidRuntimeBlockSchemas(bundle);

  return {
    themePackage: {
      slug: bundle.package.slug,
      name: bundle.package.name,
      description: bundle.package.description,
      author_name: bundle.package.author_name,
      site_types: bundle.package.site_types,
      status: bundle.package.status,
      pricing_type: bundle.package.pricing_type,
      price: bundle.package.price,
      currency: bundle.package.currency,
      marketplace_metadata: {
        bundle_schema_version: bundle.schema_version,
        bundle_paths: LIQUID_THEME_BUNDLE_PATHS,
        engine: bundle.renderer.engine,
        liquid_ready: true,
      },
    },
    themePackageVersion: {
      version: bundle.package.version,
      version_number: bundle.package.version_number,
      release_status: bundle.package.release_status,
      renderer_version: bundle.renderer.renderer_version,
      schema_version: bundle.schema_version,
      compatibility_range: bundle.package.compatibility_range,
      package_manifest: {
        bundle_schema_version: bundle.schema_version,
        package: bundle.package,
        layout: bundle.layout,
        config: bundle.config,
        templates: bundle.templates,
        sections: bundle.sections,
        blocks: bundle.blocks,
        locales: bundle.locales,
        renderer: bundle.renderer,
        liquidBundle: bundle,
        themeBundle: bundle,
        bundle_paths: LIQUID_THEME_BUNDLE_PATHS,
      },
      checksum: bundle.package.checksum,
    },
    schemaManifest: {
      manifest_version: bundle.schema_version,
      schema_manifest: {
        bundle_schema_version: bundle.schema_version,
        engine: bundle.renderer.engine,
        layout_path: LIQUID_THEME_BUNDLE_PATHS.layout,
        settings_path: LIQUID_THEME_BUNDLE_PATHS.settingsSchema,
        settings_data_path: LIQUID_THEME_BUNDLE_PATHS.settingsData,
        templates_path: LIQUID_THEME_BUNDLE_PATHS.templates,
        sections_path: LIQUID_THEME_BUNDLE_PATHS.sections,
        blocks_path: LIQUID_THEME_BUNDLE_PATHS.blocks,
        locales_path: LIQUID_THEME_BUNDLE_PATHS.locales,
      },
      section_schemas: runtimeSectionSchemas,
      block_schemas: runtimeBlockSchemas,
      settings_schema: bundle.config.settings_schema,
      template_schema: bundle.templates,
      layout_schema: bundle.layout,
      validation_rules: {
        liquid_sections_require_schema_tags: true,
        template_sections_require_liquid_files: true,
        template_blocks_require_allowed_liquid_blocks: true,
        app_blocks_require_section_app_block_support: true,
      },
    },
    rendererManifest: {
      renderer_manifest: bundle.renderer,
      approved_renderer_keys: [
        'liquid',
        ...Object.keys(bundle.sections).map((sectionType) => `liquid.section.${sectionType}`),
        ...Object.keys(bundle.blocks).map((blockType) => `liquid.block.${blockType}`),
        'liquid.app-block',
      ],
      asset_manifest: bundle.renderer.assets,
      performance_budget: {},
    },
  };
}

export function buildPortableThemePackagePersistencePayload(input: PortableThemePackageBundle): ThemePackagePersistencePayload {
  const bundle = parsePortableThemePackageBundle(input);
  return isLiquidThemePackageBundle(bundle)
    ? buildLiquidThemePackagePersistencePayload(bundle)
    : buildThemePackagePersistencePayload(bundle);
}

export function createMinimalThemeBundleFixture(): ThemeBundle {
  return parseThemeBundle({
    schema_version: THEME_BUNDLE_SCHEMA_VERSION,
    package: {
      slug: 'starter-store',
      name: 'Starter Store',
      description: 'Minimal portable JSON-contract storefront theme.',
      version: '1.0.0',
    },
    config: {
      settings_schema: {
        settings: {
          colors: {
            label: 'Colors',
            description: 'Primary storefront color settings.',
            fields: {
              primaryColor: {
                type: 'color',
                label: 'Primary color',
                default: '#00B3B3',
              },
            },
          },
        },
      },
      settings_data: {
        current: {
          primaryColor: '#00B3B3',
        },
      },
    },
    templates: {
      index: {
        name: 'Home page',
        sections: {
          hero: {
            type: 'hero-banner',
            settings: {
              heading: 'Starter Store',
            },
          },
        },
        order: ['hero'],
      },
    },
    sections: {
      'hero-banner': {
        type: 'hero-banner',
        name: 'Hero Banner',
        description: 'Introductory storefront hero.',
        renderer_key: 'heroBanner',
        settings_schema: {
          heading: {
            type: 'text',
            label: 'Heading',
            default: 'Starter Store',
          },
        },
      },
    },
    blocks: {},
    locales: {
      en: {
        general: {
          cart: 'Cart',
        },
      },
      hi: {
        general: {
          cart: 'कार्ट',
        },
      },
      bn: {
        general: {
          cart: 'কার্ট',
        },
      },
      mr: {
        general: {
          cart: 'कार्ट',
        },
      },
      ta: {
        general: {
          cart: 'வண்டி',
        },
      },
      te: {
        general: {
          cart: 'కార్ట్',
        },
      },
      kn: {
        general: {
          cart: 'ಕಾರ್ಟ್',
        },
      },
    },
  });
}

export function createMinimalLiquidThemeBundleFixture(): LiquidThemePackageBundle {
  return parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
    package: {
      slug: 'liquid-starter',
      name: 'Liquid Starter',
      description: 'Minimal portable Liquid storefront theme.',
      version: '1.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: {
      theme: {
        path: LIQUID_THEME_BUNDLE_PATHS.layout,
        source: [
          '<!doctype html>',
          '<html lang="{{ request.locale | default: "en" }}">',
          '<head>',
          '  <meta charset="utf-8">',
          '  <title>{{ shop.name }}</title>',
          '  {{ content_for_header | raw }}',
          '</head>',
          '<body>',
          '  {{ content_for_layout | raw }}',
          '  {{ content_for_footer | raw }}',
          '</body>',
          '</html>',
        ].join('\n'),
      },
    },
    config: {
      settings_schema: {
        settings: {
          colors: {
            label: 'Colors',
            description: 'Primary storefront color settings.',
            fields: {
              primaryColor: {
                type: 'color',
                label: 'Primary color',
                default: '#00B3B3',
              },
            },
          },
        },
      },
      settings_data: {
        current: {
          primaryColor: '#00B3B3',
        },
      },
    },
    templates: {
      index: {
        name: 'Home page',
        layout: 'theme',
        sections: {
          spotlight: {
            type: 'spotlight',
            settings: {
              heading: 'A portable Liquid storefront',
              subheading: 'This section is interpreted from theme bundle files.',
            },
            blocks: {
              first_badge: {
                type: 'badge',
                settings: {
                  label: 'Zero storefront code change',
                },
              },
              app_offer: {
                type: '@app',
                settings: {
                  extension_handle: 'demo-offer',
                },
              },
            },
            block_order: ['first_badge', 'app_offer'],
          },
        },
        order: ['spotlight'],
      },
    },
    sections: {
      spotlight: {
        path: 'sections/spotlight.liquid',
        source: [
          '<section class="lb-spotlight" data-section-id="{{ section.id }}">',
          '  <p>{{ section.settings.subheading }}</p>',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <div class="lb-spotlight__blocks">',
          '    {% for block in section.blocks %}',
          '      {{ block.content | raw }}',
          '    {% endfor %}',
          '  </div>',
          '  <lb-variant-picker data-lb-island="variant-picker" data-product-id="demo-liquid-product">',
          '    <button type="button" data-lb-variant-option data-variant-name="Size" data-variant-value="M" aria-pressed="true">M</button>',
          '    <button type="button" data-lb-variant-option data-variant-name="Size" data-variant-value="L" aria-pressed="false">L</button>',
          '  </lb-variant-picker>',
          '  <lb-add-to-cart data-lb-island="add-to-cart" data-product-id="demo-liquid-product" data-product-name="{{ section.settings.heading }}" data-product-price="499" data-product-currency="INR" data-product-url="/products/demo-liquid-product">',
          '    <button type="button" data-lb-add-to-cart>Add to cart</button>',
          '    <span data-lb-add-to-cart-status aria-live="polite"></span>',
          '  </lb-add-to-cart>',
          '  <lb-search data-lb-island="search" data-search-url="{{ routes.search_url }}"></lb-search>',
          '  <lb-cart-drawer data-lb-island="cart-drawer"></lb-cart-drawer>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Spotlight",',
          '  "settings": [',
          '    { "id": "heading", "type": "text", "label": "Heading", "default": "A portable Liquid storefront" },',
          '    { "id": "subheading", "type": "text", "label": "Subheading", "default": "Rendered from bundle files" }',
          '  ],',
          '  "blocks": [',
          '    { "type": "badge", "name": "Badge", "settings": [{ "id": "label", "type": "text", "label": "Label" }] },',
          '    { "type": "@app", "name": "App block" }',
          '  ],',
          '  "presets": [{ "name": "Spotlight" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Spotlight',
          settings: [
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
              default: 'A portable Liquid storefront',
            },
            {
              id: 'subheading',
              type: 'text',
              label: 'Subheading',
              default: 'Rendered from bundle files',
            },
          ],
          blocks: [
            {
              type: 'badge',
              name: 'Badge',
              settings: [
                {
                  id: 'label',
                  type: 'text',
                  label: 'Label',
                },
              ],
            },
            {
              type: '@app',
              name: 'App block',
            },
          ],
          presets: [
            {
              name: 'Spotlight',
            },
          ],
        },
      },
    },
    blocks: {
      badge: {
        path: 'blocks/badge.liquid',
        source: '<span class="lb-badge" data-block-id="{{ block.id }}">{{ block.settings.label }}</span>',
        schema: {
          name: 'Badge',
          settings: [
            {
              id: 'label',
              type: 'text',
              label: 'Label',
              default: 'Portable block',
            },
          ],
        },
      },
    },
    locales: {
      en: {
        general: {
          cart: 'Cart',
        },
      },
    },
    renderer: {
      engine: 'liquid',
      renderer_version: THEME_LIQUID_RENDERER_VERSION,
      liquid_ready: true,
      assets: {},
    },
  });
}

export function createUrbanKicksLiquidThemeBundleFixture(): LiquidThemePackageBundle {
  // S4-FIX/Defect 1 — settingsSchema is hoisted out of the returned literal so
  // buildLiquidThemeExperiencePresets() can filter preset keys against the bundle's OWN declared
  // schema (see that function's doc comment) instead of a hardcoded denylist.
  const settingsSchema = {
    settings: {
      colors: {
        label: 'Colors',
        description: 'Urban Kicks storefront color tokens.',
        fields: {
          primaryColor: {
            type: 'color',
            label: 'Primary color',
            default: '#8B5CF6',
          },
          // S4/W1: secondaryColor, backgroundColor, textColor were undeclared — every one of the
          // 10 Experiences (theme-presets.ts) sets them, so a preset referencing them would have
          // been rejected by the editor (the exact migration-193 "not defined by the theme
          // settings schema" failure class). Field NAMES converge on migration 197
          // (database/supabase/migrations/197_letbuyy_core_first_class_theme.sql), the named
          // convergence authority for this theme's appearance fields. TYPE stays 'color' (not
          // 197's 'text'): this bundle's OWN settings_schema.json already used 'color' for
          // primaryColor/accentColor/surfaceColor before this phase (a pre-existing divergence
          // from 197, not created here — reconciling it would mean editing an applied migration,
          // out of scope) — 'color' keeps every color field in THIS artifact rendering the same
          // native color-picker control, rather than 3 fields with a picker and 3 with a bare
          // text box in the same settings group.
          secondaryColor: {
            type: 'color',
            label: 'Secondary color',
            default: '#3B82F6',
          },
          accentColor: {
            type: 'color',
            label: 'Accent color',
            default: '#F59E0B',
          },
          backgroundColor: {
            type: 'color',
            label: 'Background color',
            default: '#FFFFFF',
          },
          textColor: {
            type: 'color',
            label: 'Text color',
            default: '#1F2937',
          },
          surfaceColor: {
            type: 'color',
            label: 'Surface color',
            default: '#F8FAFC',
          },
        },
      },
      typography: {
        label: 'Typography',
        description: 'First-party type settings mirrored from the JSON-contract Urban Kicks theme.',
        fields: {
          headingFontFamily: {
            type: 'text',
            label: 'Heading font',
            default: 'Inter',
          },
          bodyFontFamily: {
            type: 'text',
            label: 'Body font',
            default: 'Inter',
          },
        },
      },
      // S4/W1: borderRadius was undeclared — every Experience sets it (ExperienceTokensSchema:
      // z.number().int().min(0).max(48)). Type 'number' converges exactly with migration 197
      // (which also uses 'number' for this field — no pre-existing bundle convention to conflict
      // with, unlike the color fields above). isDark/enableShadows/enableAnimations (197's other
      // 3 appearance fields) are deliberately NOT declared here: no Experience in
      // theme-presets.ts references them, so declaring them would be speculative schema surface
      // with no preset ever driving a real value into it — scope creep for this phase, not full
      // 13-field convergence. A later phase that gives an Experience (or the editor) a real
      // reason to set them can add them then.
      appearance: {
        label: 'Appearance',
        description: 'Layout tokens shared by every section.',
        fields: {
          borderRadius: {
            type: 'number',
            label: 'Corner radius',
            default: 12,
          },
        },
      },
      // Head metadata the layout renders. Kept as merchant-editable theme settings rather than
      // hard-coded markup so each store controls its own search/social preview. Every value is
      // emitted through an escaped {{ }} output in layout/theme.liquid — never `| raw`.
      seo: {
        label: 'SEO and social',
        description: 'Metadata rendered into <head> by the theme layout.',
        fields: {
          metaDescription: {
            type: 'textarea',
            label: 'Meta description',
            info: 'Falls back to the shop description. Truncated to 160 characters on output.',
            default: '',
            maxLength: 160,
          },
          socialImageUrl: {
            type: 'url',
            label: 'Social share image URL',
            info: 'Used for og:image and twitter:image. Left empty until the merchant uploads one.',
            default: '',
          },
          faviconUrl: {
            type: 'url',
            label: 'Favicon URL',
            info: 'Rendered as <link rel="icon">. Left empty until the merchant uploads one.',
            default: '',
          },
        },
      },
    },
  };

  return parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
    package: {
      slug: 'urban-kicks-liquid',
      name: 'Urban Kicks Liquid',
      description: 'First-party Urban Kicks storefront converted to portable Liquid sections and blocks.',
      version: '1.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: {
      theme: {
        path: LIQUID_THEME_BUNDLE_PATHS.layout,
        source: [
          '<!doctype html>',
          '<html lang="{{ request.locale | default: "en" }}">',
          '<head>',
          '  <meta charset="utf-8">',
          '  <meta name="viewport" content="width=device-width, initial-scale=1">',
          // Compute the title and the description ONCE so <title>, og:* and twitter:* can never drift
          // apart. Both are plain escaped outputs — never `| raw` — so merchant-authored copy can never
          // inject markup into <head> (THEME-R4 / SEC-R11).
          // T1: the page <title> is the merchant's own shop name — it must never carry the theme's
          // own brand suffix (this used to literally append " - Urban Kicks", so every storefront's
          // browser tab and search-result title advertised the THEME, not the merchant).
          '  {% assign lb_page_title = shop.name %}',
          '  {% assign lb_meta_description = settings.metaDescription | default: shop.description | strip_html | truncate: 160 %}',
          '  <title>{{ lb_page_title }}</title>',
          '  {% if lb_meta_description != blank %}<meta name="description" content="{{ lb_meta_description }}">{% endif %}',
          // Open Graph uses the spec-required `property=` attribute and the favicon needs <link>. Neither
          // `property` nor the `link` tag is in the renderer's DOMPurify allowlist (ADD_ATTR / ADD_TAGS in
          // theme-renderer.ts), so the render-time sanitizer strips these three lines today; they are
          // correct in the exported theme artifact and start working the moment the allowlist is widened.
          // The `name=`-based tags below carry the same values through the sanitizer unchanged, so link
          // previews are never left with nothing.
          // Open Graph (`<meta property=…>`) and the favicon (`<link rel=…>`) are intentionally ABSENT.
          // The WHOLE_DOCUMENT DOMPurify pass allowlists `name` and `content` but not `property` or
          // `rel`, so those tags survive only as `<meta content="website">` / `<link href="…">` —
          // malformed markup that no crawler can use. Emitting them would be worse than omitting them.
          // Restoring them means adding `property` and `rel` to ADD_ATTR in theme-renderer.ts, which is
          // a sanitizer-allowlist change and therefore an ARB gate under THEME-R4 / SEC-R11.
          // The twitter:* tags below use `name=`, which IS allowlisted, so they render intact and give
          // link previews on the platforms that honour them.
          '  <meta name="twitter:card" content="{% if settings.socialImageUrl != blank %}summary_large_image{% else %}summary{% endif %}">',
          '  <meta name="twitter:title" content="{{ lb_page_title }}">',
          '  {% if lb_meta_description != blank %}<meta name="twitter:description" content="{{ lb_meta_description }}">{% endif %}',
          '  {% if settings.socialImageUrl != blank %}<meta name="twitter:image" content="{{ settings.socialImageUrl | image_url }}">{% endif %}',
          // Layout-scoped stylesheet. It is deliberately separate from LIQUID_THEME_BASE_CSS (injected via
          // content_for_header below) because it styles chrome the base sheet does not know about, and
          // because the exported theme artifact must stand on its own when rendered outside LetBuyy.
          // Everything is expressed as --lb-* custom properties (UI-R1/R7); the hex values inside var()
          // are FALLBACKS only, for that standalone case where the renderer's :root token block is absent.
          '  <style data-lb-layout="1">',
          '    :root{--lb-focus-ring-width:2px;--lb-focus-ring-color:var(--accent,#2563eb);--lb-focus-offset:2px;--lb-space-sm:0.5rem;--lb-space-md:0.75rem;--lb-space-lg:1rem;--lb-radius-sm:0.375rem;--lb-layout-max:72rem;--lb-layout-gutter:1rem;--lb-layout-breakpoint:48em;}',
          // WCAG 2.4.7 Focus Visible: before this rule the bundle shipped ZERO focus styling, so keyboard
          // users had only the UA default (which several of the lb-* backgrounds wash out). Never remove.
          '    .lb-theme :where(a,button,input,select,textarea,summary,details,[tabindex]):focus-visible{outline:var(--lb-focus-ring-width) solid var(--lb-focus-ring-color);outline-offset:var(--lb-focus-offset);}',
          // WCAG 2.4.1 Bypass Blocks: off-screen until focused, then pinned to the top-left of the page.
          '    .lb-skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:var(--lb-space-md) var(--lb-space-lg);border-radius:var(--lb-radius-sm);background:var(--surface,#f8fafc);color:var(--foreground,#1a1a2e);font-weight:600;}',
          '    .lb-skip-link:focus,.lb-skip-link:focus-visible{left:var(--lb-space-lg);top:var(--lb-space-lg);}',
          // Mobile-first: the chrome stacks by default so it fits the ~360px floor, and only becomes a
          // single row at the breakpoint. min-width (not max-width) keeps the small screen the base case.
          '    .lb-layout__header,.lb-layout__footer{display:flex;flex-direction:column;align-items:flex-start;gap:var(--lb-space-md);margin-inline:auto;max-width:min(var(--lb-layout-max),calc(100vw - var(--lb-layout-gutter) * 2));padding-block:var(--lb-space-lg);padding-inline:var(--lb-layout-gutter);}',
          '    .lb-layout__brand{font-family:var(--font-display,inherit);font-weight:700;}',
          '    .lb-layout__nav{display:flex;flex-wrap:wrap;gap:var(--lb-space-md);}',
          '    .lb-layout__legal{margin:0;font-size:0.875rem;}',
          '    @media (min-width:48em){.lb-layout__header,.lb-layout__footer{flex-direction:row;align-items:center;justify-content:space-between;}}',
          '  </style>',
          '  {{ content_for_header | raw }}',
          '</head>',
          '<body class="lb-theme lb-theme--urban-kicks">',
          '  <a class="lb-skip-link" href="#MainContent">Skip to content</a>',
          // <header>/<footer> as direct children of <body> are the implicit banner / contentinfo
          // landmarks. The layout document renders only content_for_layout (the main template) — the
          // header/footer TEMPLATES are rendered separately by theme-renderer.ts into liquid.header /
          // liquid.footer — so these landmarks cannot duplicate the ones sections/header.liquid emits.
          // The nav falls back to the always-present `routes` drop, so the landmark is never empty.
          '  <header class="lb-layout__header">',
          '    <a class="lb-layout__brand" href="{{ routes.root_url }}">{{ shop.name }}</a>',
          '    <nav class="lb-layout__nav" aria-label="Primary">',
          '      {% if linklists.main_menu.links.size > 0 %}{% for link in linklists.main_menu.links %}<a href="{{ link.url | store_url }}"{% if link.active %} aria-current="page"{% endif %}>{{ link.title }}</a>{% endfor %}',
          '      {% else %}<a href="{{ routes.all_products_collection_url }}">Products</a><a href="{{ routes.search_url }}">Search</a><a href="{{ routes.cart_url }}">Cart</a><a href="{{ routes.account_url }}">Account</a>{% endif %}',
          '    </nav>',
          '  </header>',
          '  <main id="MainContent">',
          '    {{ content_for_layout | raw }}',
          '  </main>',
          '  <footer class="lb-layout__footer">',
          '    {% if linklists.footer.links.size > 0 %}<nav class="lb-layout__nav" aria-label="Footer">{% for link in linklists.footer.links %}<a href="{{ link.url | store_url }}">{{ link.title }}</a>{% endfor %}</nav>{% endif %}',
          '    <p class="lb-layout__legal">&copy; {{ shop.name }}</p>',
          '  </footer>',
          // content_for_footer carries app-embed <script>/markup, not page chrome, so it stays OUTSIDE
          // the contentinfo landmark exactly where it has always been.
          '  {{ content_for_footer | raw }}',
          '</body>',
          '</html>',
        ].join('\n'),
      },
    },
    config: {
      settings_schema: settingsSchema,
      settings_data: {
        current: {
          primaryColor: '#8B5CF6',
          secondaryColor: '#3B82F6',
          accentColor: '#F59E0B',
          backgroundColor: '#FFFFFF',
          textColor: '#1F2937',
          surfaceColor: '#F8FAFC',
          headingFontFamily: 'Inter',
          bodyFontFamily: 'Inter',
          borderRadius: 12,
          // Empty, not fabricated marketing copy: the layout falls back to the real shop.description
          // ({% assign lb_meta_description = settings.metaDescription | default: shop.description ... %}),
          // so a blank default here is what lets that fallback actually engage for every merchant.
          metaDescription: '',
          // Empty, not a fabricated URL: an unset asset must render no tag at all, and the layout
          // guards both with `!= blank` so nothing broken is emitted before a merchant uploads one.
          socialImageUrl: '',
          faviconUrl: '',
        },
        // S4/W2: the 10 Experiences as real theme-level presets — see
        // buildLiquidThemeExperiencePresets(). Shopify caps a theme at 5 presets; LetBuyy's 10 is a
        // deliberate overshoot (theme-presets.ts's own header), not trimmed to fit.
        // urban-kicks and letbuyy-core deliberately get the SAME ten: both bundles are produced from
        // this one shared object literal (letbuyy-core is a branding-token clone of it — see
        // theme-bundle-core.ts), and `presets` is not text that clone touches, so giving urban-kicks
        // a different preset set would mean adding new per-bundle branching logic to what is
        // currently a single generic clone-via-string-substitution mechanism. urban-kicks is
        // reference-only and never installed to a live store, so ten inert presets cost nothing;
        // diverging them would cost real complexity for zero live benefit.
        presets: buildLiquidThemeExperiencePresets(settingsSchema),
      },
    },
    templates: {
      header: {
        name: 'Urban Kicks header',
        layout: 'theme',
        sections: {
          // T2a/W3b — moved from the `index` template. `header`, `contentForLayout` and `footer` are
          // three SEPARATE rendered fragments concatenated by composition-engine.tsx's renderLiquidPlan
          // (`${header}${contentForLayout}${footer}`) — an announcement bar living inside `index`'s own
          // sections is part of `contentForLayout`, which is concatenated AFTER `header`, so it always
          // rendered below the header chrome and only on the home page. `header` renders on every
          // route, so placing it first here makes it appear above the header on EVERY page, which is
          // what an announcement bar is for. LIQUID_THEME_BASE_CSS gives `.lb-announcement-bar` its own
          // full-bleed background (removed from the shared max-width container selector) with an inner
          // `.lb-announcement-bar__inner` that stays readably centered.
          'announcement-default': {
            type: 'announcement-bar',
            settings: {
              text: 'Free shipping on fresh drops this week.',
              linkLabel: 'Shop now',
              linkHref: '/products',
            },
          },
          // T6/W0 — this section used to ship two example `link` blocks ("Products", "Collections").
          // header.liquid's own precedence is `section.blocks.size > 0` WINS over
          // `linklists[section.settings.menu].links` (an explicit override for stores that already
          // configured blocks, kept intact — see header.liquid's own body comment). Because every
          // fresh store and every regenerated example bundle carried these two blocks by
          // construction, the linklist path (T5's actual feature) was UNREACHABLE from the shipped
          // fixture — T5 only ever demonstrated it live after hand-stripping this exact field from a
          // deployed database row, which the repo itself never reflected. Dawn's own ordering is the
          // menu setting is primary; blocks are an app/opt-in surface, not the default nav source.
          // Emptied so `linklists.main_menu` is the default path for every new store and every
          // regenerated bundle; a store that configures its own blocks still overrides it, unchanged.
          'header-default': {
            type: 'header',
            settings: {
              showSearch: true,
              showCart: true,
              behavior: 'sticky',
            },
            blocks: {},
            block_order: [],
          },
        },
        order: ['announcement-default', 'header-default'],
      },
      footer: {
        name: 'Urban Kicks footer',
        layout: 'theme',
        sections: {
          // T4 W1 — removed the fixture's own 'footer-policy' quick-link block (was
          // '/policies/shipping-policy', a Shopify URL convention this app never served;
          // T3-fix corrected it to '/shipping', but that only swapped one hardcoded dead
          // link for another that is honest only when the store happens to have a
          // published shipping policy). The Policies column alone is the single, real,
          // data-driven source for policy links.
          // T6/W0 — the remaining 'footer-contact' example block is ALSO emptied for the same
          // reason as header-default above: it unconditionally beat `linklists.footer_menu` in
          // every shipped fixture, making the footer's linklist path just as unreachable by
          // default as the header's was. The generic "Quick links" override mechanism stays
          // available for a merchant to add their own arbitrary link blocks.
          'footer-default': {
            type: 'footer',
            settings: {},
            blocks: {},
            block_order: [],
          },
        },
        order: ['footer-default'],
      },
      index: {
        name: 'Urban Kicks home page',
        layout: 'theme',
        sections: {
          // S5/W1 — banner-carousel existed as sections/banner-carousel.liquid but was never composed
          // into a template. Two slides so the real carousel path renders (its React counterpart,
          // banner-carousel.tsx, only engages above one slide — it is a sub-component of hero.tsx, not
          // a standalone registered section; see renderer-registry.tsx). No slide image: this bundle
          // has no real hosted product photography to link to, so — matching hero-banner's own image
          // setting and every other externally-hosted asset in this template — the image is left
          // unset rather than pointing at a fabricated URL; banner-carousel.liquid already guards
          // `{% if block.settings.image %}`, so an unset image renders no <img>, just the heading link.
          'banner-carousel-default': {
            type: 'banner-carousel',
            settings: {
              title: 'This week',
              autoplay: true,
            },
            blocks: {
              'carousel-monsoon': {
                type: 'slide',
                settings: {
                  heading: 'Monsoon-ready sneakers, restocked',
                  link: '/collections/new-arrivals',
                },
              },
              'carousel-apparel': {
                type: 'slide',
                settings: {
                  heading: 'Apparel drop: up to 30% off',
                  link: '/products',
                },
              },
            },
            block_order: ['carousel-monsoon', 'carousel-apparel'],
          },
          'hero-default': {
            type: 'hero-banner',
            settings: {
              eyebrow: 'New season essentials',
              heading: 'Fresh drops for daily buyers',
              subheading: 'Launch-ready sneakers, apparel, and accessories for a commerce storefront.',
              ctaText: 'Shop Now',
              ctaLink: '/products',
              // D6: new fields added for React heroBanner schema parity
              height: 'full',
              textAlign: 'center',
              overlay: 0.4,
            },
          },
          // T2a/W1b — no more fabricated category cards (Sneakers/Apparel/Accessories never existed
          // as real collections on any merchant's store). Binds the real `collections` drop directly.
          'category-grid-default': {
            type: 'category-grid',
            settings: {
              title: 'Shop by style',
              subtitle: 'Launch-ready groupings for daily buyers.',
            },
          },
          // T1/W3 — no more fabricated product-card blocks (Velocity Runner/Everyday Hoodie/Street
          // Cap never existed in any merchant's catalog). Both sections now bind the real, tenant-
          // scoped `collection.products` drop directly; productLimit replaces per-block curation.
          'featured-collection-default': {
            type: 'featured-products',
            settings: {
              title: 'Drop-ready collection',
              subtitle: 'Curated items for the first storefront launch.',
              viewAllLabel: 'View collection',
              viewAllHref: '/collections/new-arrivals',
              productLimit: 3,
            },
          },
          'product-grid-default': {
            type: 'product-grid',
            settings: {
              title: 'Featured Products',
              subtitle: 'Products selected from your catalog.',
              columns: 4,
              productLimit: 8,
            },
          },
          // S5/W2 — video-hero (new Liquid-only section; see its definition comment above for the
          // full sanitizer/type-system reasoning). videoUrl is deliberately OMITTED (not an empty
          // string): matching hero-default's own unset `image`, this ships with no fabricated,
          // unowned public video baked into every merchant's default demo storefront — the section
          // renders its heading/subheading copy and guards the <iframe> on videoUrl being set.
          'video-hero-default': {
            type: 'video-hero',
            settings: {
              heading: 'See the fit in motion',
              subheading: 'A quick look at how each drop moves, from the box to your feet.',
            },
          },
          // T1/W4 — was developer/proof-of-concept copy describing the section's own implementation
          // ("Added as sections/spotlight.liquid without changing the storefront React registry.",
          // "Zero storefront code change") — text about the codebase, not the merchant's store.
          // Replaced with generic, brand-neutral merchant marketing copy a real storefront could ship.
          'spotlight-default': {
            type: 'spotlight',
            settings: {
              heading: 'Made for daily buyers',
              subheading: 'A little extra with every order.',
            },
            blocks: {
              'spotlight-badge': {
                type: 'badge',
                settings: {
                  label: 'New',
                },
              },
              'spotlight-app': {
                type: '@app',
                settings: {
                  extension_handle: 'urban-offer',
                  slot: 'home.spotlight.offer',
                },
              },
            },
            block_order: ['spotlight-badge', 'spotlight-app'],
          },
          // S5/W1 — social proof. Chose testimonials over trust-badges and brand-marquee (all three
          // exist as sections; composing all three would give the home page three separate
          // social-proof bands, which is worse, not better). testimonials is the closest literal
          // match to "social proof" — real buyer quotes, not a generic trust/shipping badge or a
          // list of third-party brand names (brand-marquee reads as a multi-brand marketplace band,
          // which LetBuyy Core is not: this is a single merchant's own storefront). Placed right
          // before the newsletter signup: reinforcing trust immediately before asking for an email
          // is a deliberate ordering choice, not incidental.
          // T2a/W1 — was two invented reviewers (Ananya R./Rohan K.), real Indian cities, reviewing a
          // product that never existed, shipped as a THEME DEFAULT so every merchant using this theme
          // unknowingly published fabricated customer reviews on their own storefront (a real
          // compliance exposure under India's fabricated-review guidance, not just untidy seed data).
          // Ships with zero blocks; testimonials.liquid renders a merchant-facing empty state instead.
          'testimonials-default': {
            type: 'testimonials',
            settings: {
              title: 'What our buyers say',
            },
          },
          'newsletter-default': {
            type: 'newsletter-signup',
            settings: {
              title: 'Get first access',
              subtitle: 'Store updates, new drops, and offers sent to your inbox.',
              buttonLabel: 'Sign up',
            },
          },
        },
        order: [
          'banner-carousel-default',
          'hero-default',
          'category-grid-default',
          'featured-collection-default',
          'product-grid-default',
          'video-hero-default',
          'spotlight-default',
          'testimonials-default',
          'newsletter-default',
        ],
      },
      product: {
        name: 'Urban Kicks product',
        layout: 'theme',
        sections: {
          'product-detail-default': {
            type: 'product-detail',
            settings: { showGallery: true, showDescription: true },
          },
          'product-related': {
            type: 'featured-products',
            settings: { title: 'You may also like' },
          },
        },
        order: ['product-detail-default', 'product-related'],
      },
      collection: {
        name: 'Urban Kicks collection',
        layout: 'theme',
        sections: {
          'collection-banner-default': { type: 'collection-banner', settings: { showDescription: true } },
          // T2b — collection-filter was a fully real, already-implemented section (search form bound to
          // the live search route; sort/price/vendor facets correctly gated on data the platform does
          // not yet supply, per its own header comment) that was simply never placed into this template's
          // default composition. Wiring up an already-built section, not new design work.
          'collection-filter-default': { type: 'collection-filter', settings: { showSearch: true, showSort: true, showPriceFilter: true, showVendorFilter: false, layout: 'topbar' } },
          'collection-products': { type: 'collection-product-list', settings: { title: 'Products' } },
        },
        order: ['collection-banner-default', 'collection-filter-default', 'collection-products'],
      },
      search: {
        name: 'Urban Kicks search',
        layout: 'theme',
        sections: {
          'search-box-default': { type: 'search-box', settings: { placeholder: 'Search products' } },
          'search-results': { type: 'collection-product-list', settings: { title: 'Results' } },
        },
        order: ['search-box-default', 'search-results'],
      },
      cart: {
        name: 'Urban Kicks cart',
        layout: 'theme',
        sections: { 'cart-summary-default': { type: 'cart-summary', settings: {} } },
        order: ['cart-summary-default'],
      },
      // The collection-list page. Shopify's OS-2.0 template key is `list-collections`; without it a
      // storefront asking for that key falls through to `index`, which silently renders the homepage.
      // category-grid is the existing section that lists collections, so no new section is needed.
      'list-collections': {
        name: 'All collections',
        layout: 'theme',
        sections: {
          'list-collections-grid': {
            type: 'category-grid',
            settings: { title: 'All collections', subtitle: 'Browse every collection in the store.' },
          },
        },
        order: ['list-collections-grid'],
      },
      // Contact page. contact-form has shipped as a section since the first Liquid bundle but no
      // template routed to it, so the section was unreachable.
      contact: {
        name: 'Contact',
        layout: 'theme',
        sections: {
          'contact-form-default': { type: 'contact-form', settings: { title: 'Contact us', showPhone: true } },
        },
        order: ['contact-form-default'],
      },
      'customers/login': {
        name: 'Login',
        layout: 'theme',
        // W2 (PHASE-T3) — settings:{} now correctly picks up the section schema's own `heading`
        // default at render time (theme-renderer.ts applyLiquidSectionSchemaDefaults). T2b had
        // worked around the prior renderer-level gap by composing each section's already-declared
        // default value explicitly; every one of those 9 compositions is now back to settings:{},
        // proven byte-identical via the parity harness and liquid-w2-schema-defaults.test.ts.
        sections: { 'customer-login-default': { type: 'customer-login', settings: {} } },
        order: ['customer-login-default'],
      },
      'customers/register': {
        name: 'Register',
        layout: 'theme',
        sections: { 'customer-register-default': { type: 'customer-register', settings: {} } },
        order: ['customer-register-default'],
      },
      'customers/account': {
        name: 'Account',
        layout: 'theme',
        sections: { 'customer-account-default': { type: 'customer-account', settings: {} } },
        order: ['customer-account-default'],
      },
      'customers/orders': {
        name: 'Order history',
        layout: 'theme',
        sections: { 'customer-orders-default': { type: 'customer-orders', settings: {} } },
        order: ['customer-orders-default'],
      },
      'customers/order': {
        name: 'Order detail',
        layout: 'theme',
        sections: { 'customer-order-detail-default': { type: 'customer-order-detail', settings: {} } },
        order: ['customer-order-detail-default'],
      },
      'customers/settings': {
        name: 'Account settings',
        layout: 'theme',
        sections: { 'customer-settings-default': { type: 'customer-settings', settings: {} } },
        order: ['customer-settings-default'],
      },
      'customers/wishlist': {
        name: 'Wishlist',
        layout: 'theme',
        sections: { 'customer-wishlist-default': { type: 'customer-wishlist', settings: {} } },
        order: ['customer-wishlist-default'],
      },
      'customers/addresses': {
        name: 'Addresses',
        layout: 'theme',
        sections: { 'customer-addresses-default': { type: 'customer-addresses', settings: {} } },
        order: ['customer-addresses-default'],
      },
      policy: {
        name: 'Policy page',
        layout: 'theme',
        sections: { 'policy-content-default': { type: 'policy-content', settings: {} } },
        order: ['policy-content-default'],
      },
      // E1: blog listing template — data source: GET /:subdomain/blog (public-routes.ts line 1226)
      // Fields: id, title, slug, excerpt, featured_image, published_at. Author name NOT returned.
      // Populated by LANE-B composition-engine via liquidContext.blog.
      blog: {
        name: 'Blog',
        layout: 'theme',
        sections: { 'blog-listing-default': { type: 'blog-listing', settings: { heading: 'Our Blog' } } },
        order: ['blog-listing-default'],
      },
      // E2: article (blog post) template — data source: GET /:subdomain/blog/:slug (public-routes.ts line 1248)
      // Fields: id, title, slug, excerpt, content, content_html, featured_image, published_at, updated_at.
      // Author name NOT returned by public endpoint — omitted from template.
      // body_html is merchant-authored HTML; flows through sanitizeRenderedHtml (the authoritative sanitizer).
      article: {
        name: 'Article',
        layout: 'theme',
        sections: { 'article-content-default': { type: 'article-content', settings: {} } },
        order: ['article-content-default'],
      },
      // E3: CMS page template — data source: GET /:subdomain/pages/:slug (public-routes.ts line 1158)
      // Backed by storefront_pages (primary) or legacy pages table (fallback); both normalize to same shape.
      // body_html is merchant-authored HTML; flows through sanitizeRenderedHtml (the authoritative sanitizer).
      // Note: the storefront catch-all page.tsx only handles single-segment slugs (path.length === 1).
      page: {
        name: 'Page',
        layout: 'theme',
        sections: { 'page-content-default': { type: 'page-content', settings: {} } },
        order: ['page-content-default'],
      },
      // E4 (LANE-A): not_found template — static 404 markup only; no data binding beyond routes.
      // Note: Next.js not-found.tsx cannot receive subdomain params; store-aware Liquid 404 rendering
      // requires proxy-level routing to pass subdomain — Phase F scope.
      // Key uses underscore to match StorefrontRouteType 'not_found'.
      not_found: {
        name: '404 Not Found',
        layout: 'theme',
        sections: { '404-page-default': { type: '404-page', settings: {} } },
        order: ['404-page-default'],
      },
      // E5: password/coming-soon template — rendered in bundle for editor preview and isolation tests.
      // NOTE: proxy.ts (line 296) always routes password-mode stores to /preview/coming-soon (React).
      // This Liquid template is NOT in the production rendering path until proxy.ts checks render engine.
      // See: Phase F scope for proxy routing update.
      password: {
        name: 'Password',
        layout: 'theme',
        sections: { 'password-gate-default': { type: 'password-gate', settings: { heading: 'Coming Soon' } } },
        order: ['password-gate-default'],
      },
    },
    sections: {
      'customer-orders': createLiquidSectionFile({
        type: 'customer-orders',
        name: 'Order History',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your orders' })],
        body: [
          '<section class="lb-orders" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          // Storefront order ownership is the verified canonical buyer-order link,
          // never a store-customer email match.
          '  {% if buyer_unavailable %}<p class="lb-orders__error" role="alert">Orders are temporarily unavailable. Please try again.</p>{% elsif buyer %}',
          '  <form class="lb-orders__claim" method="post" action="/api/buyer/orders"><input type="hidden" name="return_to" value="{{ routes.account_orders_url }}"><p>Find past orders from this store placed with your verified LetBuyy email.</p><button type="submit">Find past orders</button></form>',
          '  {% if request.query.buyer_claim == "complete" %}<p role="status" aria-live="polite">The verified orders for this store have been checked and linked.</p>{% elsif request.query.buyer_claim == "partial" %}<p role="status" aria-live="polite">Some eligible orders could not be linked. Contact the store for help.</p>{% elsif request.query.buyer_claim == "unverified" %}<p role="status" aria-live="polite">Verify your LetBuyy email before claiming historical orders.</p>{% elsif request.query.buyer_claim == "unavailable" %}<p role="status" aria-live="polite">Historical orders could not be checked right now. Please try again.</p>{% elsif request.query.buyer_claim == "unauthorized" %}<p role="status" aria-live="polite">Sign in to LetBuyy before claiming past orders.</p>{% endif %}',
          '  {% if buyer.orders and buyer.orders.size > 0 %}',
          '  <ul class="lb-orders__list">{% for order in buyer.orders %}<li class="lb-orders__row"><a href="{{ routes.account_orders_url }}/{{ order.id }}"><span class="lb-orders__num">#{{ order.number }}</span><span class="lb-orders__status">{{ order.status }}</span><span class="lb-orders__total">{{ order.total | money_with_currency: order.currency }}</span></a></li>{% endfor %}</ul>',
          '  {% if buyer.has_more and buyer.next_cursor %}<a class="lb-orders__next" href="{{ routes.account_orders_url }}?cursor={{ buyer.next_cursor }}">Older orders</a>{% endif %}',
          '  {% else %}<p class="lb-orders__empty">No orders yet.</p>{% endif %}',
          '  {% else %}',
          '  <p class="lb-orders__guest">Please <a href="/api/buyer-auth/start?return_to={{ routes.account_orders_url }}">sign in with LetBuyy</a> to view your orders.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'customer-order-detail': createLiquidSectionFile({
        type: 'customer-order-detail',
        name: 'Order Detail',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Order' })],
        body: [
          '<section class="lb-order-detail" data-section-id="{{ section.id }}">',
          '  {% if buyer_unavailable %}<p class="lb-order-detail__error" role="alert">This order is temporarily unavailable. Please try again.</p>{% elsif buyer %}',
          '  {% if order %}',
          '  <h1>Order #{{ order.number }}</h1>',
          '  <p class="lb-order-detail__status">Status: {{ order.status }}</p>',
          '  <ul class="lb-order-detail__items">{% for item in order.line_items %}<li><span class="lb-order-detail__title">{{ item.title }}</span><span class="lb-order-detail__qty">{{ item.quantity }}</span><span class="lb-order-detail__line">{{ item.line_price | money_with_currency: order.currency }}</span></li>{% endfor %}</ul>',
          '  <p class="lb-order-detail__total">Total: {{ order.total | money_with_currency: order.currency }}</p>',
          '  {% if order.gst_invoice_number != blank %}<p class="lb-order-detail__invoice">GST Invoice: {{ order.gst_invoice_number }} (Tax: {{ order.tax_total | money_with_currency: order.currency }})</p>{% endif %}',
          '  <ol class="lb-order-detail__timeline">{% for step in order.timeline %}<li class="lb-order-detail__step{% if step.reached %} is-reached{% endif %}">{{ step.label }}</li>{% endfor %}</ol>',
          '  {% if order.tracking_number != blank %}<p class="lb-order-detail__tracking">Tracking: {{ order.tracking_number }}{% if order.carrier != blank %} ({{ order.carrier }}){% endif %}</p>{% endif %}',
          '  {% else %}<p class="lb-order-detail__missing">Order not found.</p>{% endif %}',
          '  {% else %}<p class="lb-order-detail__guest">Please <a href="/api/buyer-auth/start?return_to={{ routes.account_orders_url }}">sign in with LetBuyy</a> to view this order.</p>{% endif %}',
          '</section>',
        ],
      }),
      'customer-account': createLiquidSectionFile({
        type: 'customer-account',
        name: 'Customer Account',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your account' })],
        body: [
          '<section class="lb-account" data-section-id="{{ section.id }}">',
          '  {% if buyer %}',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <p class="lb-account__hello">Signed in to LetBuyy as {{ buyer.full_name | default: buyer.email }}</p>',
          '  <nav class="lb-account__nav"><a href="{{ routes.account_orders_url }}">Orders</a><a href="{{ routes.account_addresses_url }}">Addresses</a><a href="{{ routes.account_url }}/loyalty">Rewards</a><a href="{{ routes.account_settings_url }}">Settings</a><form method="post" action="/api/buyer-auth/logout?return_to={{ routes.account_url }}"><button type="submit" class="lb-account__nav-link">Sign out at this store</button></form></nav>',
          '  {% elsif buyer_unavailable %}<p class="lb-account__unavailable" role="status">We could not load your LetBuyy account right now. Please refresh and try again.</p>',
          '  {% elsif customer %}',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <p class="lb-account__hello">Signed in as {{ customer.name | default: customer.email }}</p>',
          // F7-Lane-A: Replace GET anchor with lb-logout island + no-JS <form method="post"> fallback.
          // routes.account_logout_url resolves to /api/customer/logout (POST-only endpoint).
          // The no-JS <form method="post"> is the authoritative behavior; lb-logout is a progressive
          // enhancement island registered by LANE-B (liquid-hydration-islands.tsx via defineLiquidIsland).
          // lb-logout is in LIQUID_HYDRATION_CUSTOM_ELEMENTS and DOMPurify ADD_TAGS/tagNameCheck so it
          // passes sanitization. data-logout-url is in ADD_ATTR for the same reason.
          // F7-Lane-A: lb-logout island wraps a no-JS <form method="post"> fallback.
          // style="display:contents" is intentionally omitted — DOMPurify FORBID_ATTR:['style'] strips
          // inline styles from sanitized HTML. The form remains functional without it.
          // LANE-B (liquid-hydration-islands.tsx) registers LbLogoutElement to intercept the click
          // and do fetch(logoutUrl, {method:'POST'}) + redirect; falls back to native form.submit().
          '  <nav class="lb-account__nav"><a href="{{ routes.account_orders_url }}">Orders</a><a href="{{ routes.account_addresses_url }}">Addresses</a><a href="{{ routes.account_settings_url }}">Settings</a><lb-logout data-logout-url="{{ routes.account_logout_url }}"><form method="post" action="{{ routes.account_logout_url }}"><button type="submit" class="lb-account__nav-link">Sign out</button></form></lb-logout></nav>',
          '  {% else %}',
          '  <p class="lb-account__guest">Please <a href="{{ routes.customer_login_url }}">sign in</a> to view your account.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'customer-login': createLiquidSectionFile({
        type: 'customer-login',
        name: 'Customer Login',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Sign in' })],
        body: [
          '<section class="lb-auth lb-auth--login" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  {% if request.error %}<p class="lb-auth__error" role="alert">{% case request.error %}{% when "missing_fields" %}Please fill in all required fields.{% when "invalid_credentials" %}Incorrect email or password.{% when "account_exists" %}An account with this email already exists. Please sign in.{% when "rate_limited" %}Too many attempts. Please try again shortly.{% when "bot_verification" %}We could not verify you are not a robot. Please try again.{% else %}Something went wrong. Please try again.{% endcase %}</p>{% endif %}',
          '  <form class="lb-auth__form" method="post" action="/api/customer/login">',
          // E8 (LANE-A): hidden storeId field — mirrors D10 pattern from customer-register.
          // Enables no-JS form submission to the D10 dual-content-type login route.
          '    <input type="hidden" name="storeId" value="{{ shop.id }}">',
          '    <input type="hidden" name="turnstileToken" value="">',
          '    <lb-turnstile data-lb-island="turnstile"></lb-turnstile>',
          '    <label>Email<input type="email" name="email" autocomplete="email" required></label>',
          '    <label>Password<input type="password" name="password" autocomplete="current-password" required></label>',
          '    <button type="submit">Sign in</button>',
          '  </form>',
          '  <a href="{{ routes.customer_register_url }}">Create an account</a>',
          // APPID-P4c: sign in with the buyer's LetBuyy account instead, through identity-platform.
          '  <p class="lb-auth__letbuyy"><a href="/api/buyer-auth/start?return_to={{ routes.account_url }}">Continue with LetBuyy</a></p>',
          // An existing store-only customer can connect from this entry point without first minting
          // another legacy password session; the callback still requires verified buyer email.
          '  <p>Have an older store account? Connect it with your verified LetBuyy account.</p>',
          '  <form class="lb-auth__link-store" method="post" action="/api/buyer-auth/start">',
          // `action` is treated as a DOM-clobbering name by the Liquid HTML sanitizer; use intent.
          '    <input type="hidden" name="intent" value="link_store_customer">',
          '    <input type="hidden" name="return_to" value="{{ routes.account_url }}">',
          '    <button type="submit">Connect my store account</button>',
          '  </form>',
          '</section>',
        ],
      }),
      'customer-register': createLiquidSectionFile({
        type: 'customer-register',
        name: 'Customer Register',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Create account' })],
        body: [
          '<section class="lb-auth lb-auth--register" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <p>Create one LetBuyy account to use across participating storefronts.</p>',
          '  <p class="lb-auth__letbuyy"><a href="/api/buyer-auth/start?return_to={{ routes.account_url }}">Create or sign in with LetBuyy</a></p>',
          '  <p>Have an older store-only account? <a href="{{ routes.customer_login_url }}">Sign in to connect it with your verified LetBuyy account</a>.</p>',
          '</section>',
        ],
      }),
      'customer-settings': createLiquidSectionFile({
        type: 'customer-settings',
        name: 'Account Settings',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Account settings' })],
        body: [
          '<section class="lb-settings" data-section-id="{{ section.id }}">',
          '  {% if buyer %}',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <div class="lb-settings__current"><p class="lb-settings__email">{{ buyer.email }}</p>{% if buyer.full_name %}<p class="lb-settings__name">{{ buyer.full_name }}</p>{% endif %}{% if buyer.phone %}<p class="lb-settings__phone">{{ buyer.phone }}</p>{% endif %}</div>',
          '  <lb-customer-settings data-lb-island="customer-settings" data-account-type="buyer" data-base-path="/store/{{ shop.subdomain }}" data-authenticated="true"></lb-customer-settings>',
          '  {% elsif buyer_unavailable %}<p class="lb-settings__unavailable" role="status">We could not load your LetBuyy profile right now. Please refresh and try again.</p>',
          '  {% elsif customer %}',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <div class="lb-settings__current">',
          '    <p class="lb-settings__email">{{ customer.email }}</p>',
          '    {% if customer.name %}<p class="lb-settings__name">{{ customer.name }}</p>{% endif %}',
          '    {% if customer.phone %}<p class="lb-settings__phone">{{ customer.phone }}</p>{% endif %}',
          '  </div>',
          '  <lb-customer-settings',
          '    data-lb-island="customer-settings"',
          '    data-email="{{ customer.email | escape }}"',
          '    data-name="{{ customer.name | default: "" | escape }}"',
          '    data-phone="{{ customer.phone | default: "" | escape }}"',
          '    data-base-path="/store/{{ shop.subdomain }}"',
          '    data-authenticated="true"',
          '  ></lb-customer-settings>',
          '  {% else %}',
          '  <p class="lb-settings__guest">Please <a href="{{ routes.customer_login_url }}">sign in</a> to manage your settings.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'customer-wishlist': createLiquidSectionFile({
        type: 'customer-wishlist',
        name: 'Wishlist',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your wishlist' })],
        body: [
          '<section class="lb-wishlist" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}{% if customer.wishlist_products.size > 0 %} <span class="lb-wishlist__count">({{ customer.wishlist_products.size }})</span>{% elsif buyer_wishlist.products.size > 0 %} <span class="lb-wishlist__count">({{ buyer_wishlist.products.size }})</span>{% endif %}</h1>',
          '  {% if buyer_wishlist.authenticated %}',
          '    {% if buyer_wishlist.unavailable %}<p class="lb-wishlist__unavailable" role="status">Your wishlist is temporarily unavailable. Please try again.</p>',
          '    {% elsif buyer_wishlist.storeAccountUnavailable %}<p class="lb-wishlist__unavailable" role="status">This store account is unavailable. Contact the store for help.</p>',
          '    {% elsif buyer_wishlist.linked and buyer_wishlist.products.size > 0 %}',
          '      <div class="lb-product-grid__items">{% for item in buyer_wishlist.products %}<article class="lb-product-card"><a href="{{ item.url }}"><strong>{{ item.title }}</strong><span>{{ item.price | times: 100 | money_with_currency: item.currency }}</span></a><lb-wishlist-toggle data-lb-island="wishlist-toggle" data-product-id="{{ item.id }}" data-store-id="{{ shop.id }}" data-in-wishlist="true" data-authenticated="true" data-account-type="buyer" data-buyer-id="{{ buyer_wishlist.buyerId }}" data-buyer-linked="true" data-base-path="/store/{{ shop.subdomain }}"></lb-wishlist-toggle></article>{% endfor %}</div>',
          '    {% elsif buyer_wishlist.linked %}<p class="lb-wishlist__empty">Your wishlist is empty. <a href="{{ routes.all_products_collection_url }}">Browse products</a></p>',
          '    {% else %}<p class="lb-wishlist__guest">Connect your verified store account in <a href="{{ routes.account_settings_url }}">account settings</a> to use this store wishlist.</p>{% endif %}',
          '  {% elsif customer.wishlist_products and customer.wishlist_products.size > 0 %}',
          '  <div class="lb-product-grid__items">',
          '    {% for item in customer.wishlist_products %}<article class="lb-product-card"><a href="{{ item.url }}"><strong>{{ item.title }}</strong><span>{{ item.price | times: 100 | money_with_currency: item.currency }}</span></a><lb-wishlist-toggle data-lb-island="wishlist-toggle" data-product-id="{{ item.id }}" data-store-id="{{ shop.id }}" data-in-wishlist="true" data-authenticated="true" data-account-type="store_customer" data-base-path="/store/{{ shop.subdomain }}"></lb-wishlist-toggle></article>{% endfor %}',
          '  </div>',
          '  {% elsif customer %}',
          '  <p class="lb-wishlist__empty">Your wishlist is empty. <a href="{{ routes.all_products_collection_url }}">Browse products</a></p>',
          '  {% else %}',
          '  <p class="lb-wishlist__guest">Please <a href="{{ routes.customer_login_url }}">sign in</a> to view your wishlist.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'customer-addresses': createLiquidSectionFile({
        type: 'customer-addresses',
        name: 'Addresses',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your addresses' })],
        body: [
          '<section class="lb-addresses" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  {% if buyer %}',
          '  <lb-address-manager data-lb-island="address-manager" data-account-type="buyer" data-base-path="/store/{{ shop.subdomain }}" data-authenticated="true"></lb-address-manager>',
          '  {% elsif buyer_unavailable %}<p class="lb-addresses__unavailable" role="status">We could not load your LetBuyy addresses right now. Please refresh and try again.</p>',
          '  {% elsif customer %}',
          '  {% if customer.addresses and customer.addresses.size > 0 %}',
          '  <div class="lb-addresses__grid">',
          '    {% for addr in customer.addresses %}<div class="lb-address-card{% if addr.is_default %} lb-address-card--default{% endif %}"><span class="lb-address-card__label">{{ addr.label | default: "address" }}</span>{% if addr.is_default %}<span class="lb-address-card__default-badge">Default</span>{% endif %}<p class="lb-address-card__address">{{ addr.address1 }}{% if addr.address2 %}, {{ addr.address2 }}{% endif %}</p><p class="lb-address-card__city">{{ addr.city }}, {{ addr.province }} {{ addr.zip }}</p></div>{% endfor %}',
          '  </div>',
          '  {% else %}',
          '  <p class="lb-addresses__empty">No saved addresses.</p>',
          '  {% endif %}',
          '  <lb-address-manager',
          '    data-lb-island="address-manager"',
          '    data-base-path="/store/{{ shop.subdomain }}"',
          '    data-authenticated="true"',
          '  ></lb-address-manager>',
          '  {% else %}',
          '  <p class="lb-addresses__guest">Please <a href="{{ routes.customer_login_url }}">sign in</a> to manage your addresses.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'policy-content': createLiquidSectionFile({
        type: 'policy-content',
        name: 'Policy Content',
        settings: [],
        body: [
          '<section class="lb-policy" data-section-id="{{ section.id }}">',
          '  {% if page %}',
          '  <h1 class="lb-policy__title">{{ page.title }}</h1>',
          '  {% if page.body_html != blank %}<div class="lb-policy__body">{{ page.body_html | raw }}</div>',
          '  {% elsif page.content != blank %}<div class="lb-policy__body">{{ page.content | raw }}</div>{% endif %}',
          '  {% endif %}',
          '</section>',
        ],
      }),
      'cart-summary': createLiquidSectionFile({
        type: 'cart-summary',
        name: 'Cart',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your cart' })],
        body: [
          '<section class="lb-cart-page" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <lb-cart data-lb-island="cart" data-base-path="/store/{{ shop.subdomain }}">',
          '    {% if cart.item_count > 0 %}',
          '    <ul class="lb-cart__items">{% for item in cart.items %}<li class="lb-cart__item"><span class="lb-cart__title">{{ item.title }}</span><span class="lb-cart__qty">x{{ item.quantity }}</span><span class="lb-cart__line">{{ item.line_price | money_with_currency: cart.currency }}</span></li>{% endfor %}</ul>',
          '    <div class="lb-liquid-cart__totals">',
          '      {% if cart.subtotal %}<div class="lb-liquid-cart__row"><span>Subtotal</span><span>{{ cart.subtotal | money_with_currency: cart.currency }}</span></div>{% endif %}',
          '      {% if cart.coupon_codes.size > 0 %}<div class="lb-liquid-cart__row"><span>Coupons</span><span>{{ cart.coupon_codes | join: ", " }}</span></div>{% endif %}',
          '      {% if cart.discount_total %}<div class="lb-liquid-cart__row"><span>Discounts</span><span>{{ cart.discount_total | money_with_currency: cart.currency }}</span></div>{% endif %}',
          '      {% if cart.shipping_total %}<div class="lb-liquid-cart__row"><span>Shipping</span><span>{{ cart.shipping_total | money_with_currency: cart.currency }}</span></div>{% endif %}',
          '      {% if cart.tax_total %}<div class="lb-liquid-cart__row"><span>Tax (GST)</span><span>{{ cart.tax_total | money_with_currency: cart.currency }}</span></div>{% endif %}',
          '    </div>',
          '    <p class="lb-cart__total">Total: {{ cart.total_price | money_with_currency: cart.currency }}</p>',
          '    <a class="lb-cart__checkout" href="{{ cart.checkout_url }}">Checkout</a>',
          '    {% else %}<p class="lb-cart__empty">Your cart is empty. <a href="{{ routes.all_products_collection_url }}">Browse products</a></p>{% endif %}',
          '  </lb-cart>',
          '</section>',
        ],
      }),
      'search-box': createLiquidSectionFile({
        type: 'search-box',
        name: 'Search',
        settings: [liquidSetting('placeholder', 'text', 'Placeholder', { default: 'Search products' })],
        body: [
          '<section class="lb-search" data-section-id="{{ section.id }}">',
          '  <lb-search data-lb-island="search" data-search-url="{{ routes.search_url }}">',
          '    <form role="search" method="get" action="{{ routes.search_url }}" data-lb-search-form>',
          '      <label class="lb-sr-only" for="lb-search-input-{{ section.id }}">Search products</label>',
          '      <input type="search" name="search" id="lb-search-input-{{ section.id }}" data-lb-search-input placeholder="{{ section.settings.placeholder }}" aria-label="Search products" value="{{ search.terms }}">',
          `      <button type="submit" aria-label="Search">${LIQUID_ICONS.search}<span class="lb-sr-only">Search</span></button>`,
          '    </form>',
          '  </lb-search>',
          '  {% if search.terms %}<p class="lb-search__terms">Results for "{{ search.terms }}"</p>{% endif %}',
          '</section>',
        ],
      }),
      'collection-banner': createLiquidSectionFile({
        type: 'collection-banner',
        name: 'Collection Banner',
        settings: [liquidSetting('showDescription', 'toggle', 'Show description', { default: true })],
        body: [
          '<section class="lb-collection-banner" data-section-id="{{ section.id }}">',
          // E7: image_url field verified available from public-routes.ts line 989 (collection endpoint).
          // Using conditional <img> element directly — image_url filter returns a safe URL but
          // img_tag filter is not registered in registerLetbuyyLiquidFilters, so we use <img> directly.
          '  {% if collection.image_url != blank %}<img class="lb-collection-banner__image" src="{{ collection.image_url | image_url }}" alt="{{ collection.title }}">{% endif %}',
          '  <h1>{{ collection.title }}</h1>',
          // E7: product count — collection.products is the flat product array returned by the endpoint.
          // Display count only when the collection has products.
          '  {% if collection.products.size > 0 %}<p class="lb-collection-banner__count">{{ collection.products.size }} products</p>{% endif %}',
          '  {% if section.settings.showDescription and collection.description %}<div class="lb-collection-banner__desc">{{ collection.description }}</div>{% endif %}',
          '</section>',
        ],
      }),
      'collection-product-list': createLiquidSectionFile({
        type: 'collection-product-list',
        name: 'Collection Products',
        settings: [liquidSetting('title', 'text', 'Heading', { default: 'Products' })],
        body: [
          '<section class="lb-product-grid" data-section-id="{{ section.id }}">',
          '  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}',
          '  {% if collection.products.size > 0 %}',
          '  <div class="lb-product-grid__items">',
          `    {% for item in collection.products %}${LIQUID_PRODUCT_CARD}{% endfor %}`,
          '  </div>',
          '  {% else %}',
          '  <div class="lb-product-grid__empty"><h2>No products found</h2><p>Products added to this store will appear here.</p></div>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      // E1: Blog Listing section — data source VERIFIED REAL: GET /:subdomain/blog (public-routes.ts line 1226).
      // Fields from blog_posts table: id, title, slug, excerpt, featured_image, published_at, is_pinned.
      // Author name NOT returned by the public endpoint — omitted from template.
      // blog.articles populated by LANE-B composition-engine via liquidContext.blog.
      // Pagination: current_page and pages_count exposed when provided; no fabricated controls.
      'blog-listing': createLiquidSectionFile({
        type: 'blog-listing',
        name: 'Blog Listing',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Our Blog' })],
        body: [
          '<section class="lb-blog-listing" data-section-id="{{ section.id }}">',
          '  <h1 class="lb-blog-listing__heading">{{ section.settings.heading }}</h1>',
          '  {% if blog.articles and blog.articles.size > 0 %}',
          '  <div class="lb-blog-listing__articles">',
          '    {% for article in blog.articles %}',
          '    <article class="lb-blog-article-card">',
          '      <h2 class="lb-blog-article-card__title"><a href="{{ routes.blog_url }}/{{ article.slug }}">{{ article.title }}</a></h2>',
          '      {% if article.excerpt %}<p class="lb-blog-article-card__excerpt">{{ article.excerpt }}</p>{% endif %}',
          '      {% if article.published_at %}<time class="lb-blog-article-card__date" datetime="{{ article.published_at }}">{{ article.published_at | date: "%B %-d, %Y" }}</time>{% endif %}',
          '    </article>',
          '    {% endfor %}',
          '  </div>',
          '  {% if blog.pages_count and blog.pages_count > 1 %}',
          '  <nav class="lb-blog-listing__pagination" aria-label="Blog pagination">',
          '    {% if blog.current_page and blog.current_page > 1 %}<a class="lb-blog-listing__prev" href="{{ routes.blog_url }}?page={{ blog.current_page | minus: 1 }}" rel="prev">Previous</a>{% endif %}',
          '    {% assign next_page = blog.current_page | plus: 1 %}',
          '    {% if next_page <= blog.pages_count %}<a class="lb-blog-listing__next" href="{{ routes.blog_url }}?page={{ next_page }}" rel="next">Next</a>{% endif %}',
          '  </nav>',
          '  {% endif %}',
          '  {% else %}',
          '  <p class="lb-blog-listing__empty">No posts published yet.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      // E2: Article (blog post) section — data source VERIFIED REAL: GET /:subdomain/blog/:slug (public-routes.ts line 1248).
      // Fields: id, title, slug, excerpt, content, content_html, featured_image, published_at, updated_at.
      // Author name NOT returned by public endpoint — omitted from template.
      // article.body_html is merchant-authored HTML; all section output is post-processed by
      // sanitizeRenderedHtml (theme-renderer.ts line 646) — the authoritative sanitizer.
      // The | raw filter prevents double-escaping (outputEscape: 'escape' is set on the engine).
      'article-content': createLiquidSectionFile({
        type: 'article-content',
        name: 'Article Content',
        settings: [],
        body: [
          '<section class="lb-article" data-section-id="{{ section.id }}">',
          '  {% if article %}',
          '  <h1 class="lb-article__title">{{ article.title }}</h1>',
          '  {% if article.published_at %}<time class="lb-article__date" datetime="{{ article.published_at }}">{{ article.published_at | date: "%B %-d, %Y" }}</time>{% endif %}',
          '  {% if article.image %}<img class="lb-article__image" src="{{ article.image | image_url }}" alt="{{ article.title }}">{% endif %}',
          '  {% if article.body_html != blank %}<div class="lb-article__body">{{ article.body_html | raw }}</div>{% endif %}',
          '  {% else %}',
          '  <p class="lb-article__missing">Article not found.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      // E3: CMS Page section — data source VERIFIED REAL: GET /:subdomain/pages/:slug (public-routes.ts line 1158).
      // Backed by storefront_pages table (primary) or legacy pages table (fallback); both normalize to same shape.
      // body_html is merchant-authored HTML; flows through sanitizeRenderedHtml (the authoritative sanitizer).
      // The | raw filter prevents double-escaping (outputEscape: 'escape' on the engine).
      // Note: the storefront catch-all page.tsx handles only single-segment slugs (path.length === 1).
      'page-content': createLiquidSectionFile({
        type: 'page-content',
        name: 'Page Content',
        settings: [],
        body: [
          '<section class="lb-page" data-section-id="{{ section.id }}">',
          '  {% if page %}',
          '  <h1 class="lb-page__title">{{ page.title }}</h1>',
          '  {% if page.body_html != blank %}<div class="lb-page__body">{{ page.body_html | raw }}</div>',
          '  {% else %}<p class="lb-page__empty">No content yet.</p>{% endif %}',
          '  {% else %}',
          '  <p class="lb-page__missing">Page not found.</p>',
          '  {% endif %}',
          '</section>',
        ],
      }),
      // E4 (LANE-A): 404 Not Found section — static markup only; routes.root_url links back to home.
      // Note: Next.js not-found.tsx cannot receive subdomain params — store-aware Liquid 404 rendering
      // requires proxy-level routing to pass subdomain to not-found.tsx (Phase F scope).
      // This template is exercised via editor preview and in-isolation tests in Phase E.
      '404-page': createLiquidSectionFile({
        type: '404-page',
        name: '404 Not Found',
        settings: [],
        body: [
          '<section class="lb-404" data-section-id="{{ section.id }}">',
          '  <h1 class="lb-404__code">404</h1>',
          '  <p class="lb-404__message">Page not found</p>',
          '  <a class="lb-404__home" href="{{ routes.root_url }}">Back to home</a>',
          '</section>',
        ],
      }),
      // E5: Password / coming-soon section — gate flow: proxy.ts (line 296) detects access_mode === 'password'
      // and always routes to /preview/coming-soon (React). This Liquid template is NOT in the production
      // rendering path until proxy.ts checks render engine — Phase F scope for proxy routing update.
      // POST endpoint /store-access/password exists at proxy.ts line 269.
      // NOTE: BLOCKED_DROP_KEYS blocks 'password' as a settings field key — the input name='password'
      // in the form is an HTML attribute in the source string, not a settings key, so it is unaffected.
      'password-gate': createLiquidSectionFile({
        type: 'password-gate',
        name: 'Password Gate',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Coming Soon' })],
        body: [
          '<!-- password gate rendering requires proxy routing update (Phase F) -->',
          '<section class="lb-password-gate" data-section-id="{{ section.id }}">',
          '  <h1 class="lb-password-gate__heading">{{ shop.name }}</h1>',
          '  <p class="lb-password-gate__message">{{ section.settings.heading }}</p>',
          '  <p class="lb-password-gate__info">This store is password protected.</p>',
          '  <form class="lb-password-gate__form" method="post" action="/store-access/password">',
          '    <label class="lb-password-gate__label">Enter password<input class="lb-password-gate__input" type="password" name="password" autocomplete="current-password" required></label>',
          '    <button type="submit" class="lb-password-gate__btn">Enter</button>',
          '  </form>',
          '  {% if shop.access_message and shop.access_message != blank %}<p class="lb-password-gate__access-message">{{ shop.access_message }}</p>{% endif %}',
          '</section>',
        ],
      }),
      ...createLiquidParitySectionFiles(),
      'announcement-bar': {
        path: 'sections/announcement-bar.liquid',
        source: [
          '<section class="lb-announcement-bar" data-section-id="{{ section.id }}">',
          '  <div class="lb-announcement-bar__inner">',
          '    <span>{{ section.settings.text }}</span>',
          '    {% if section.settings.linkLabel %}<a href="{{ section.settings.linkHref | store_url }}">{{ section.settings.linkLabel }}</a>{% endif %}',
          '  </div>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Announcement Bar",',
          '  "settings": [',
          '    { "id": "text", "type": "text", "label": "Message", "default": "Free shipping on fresh drops this week." },',
          '    { "id": "linkLabel", "type": "text", "label": "Link label", "default": "Shop now" },',
          '    { "id": "linkHref", "type": "url", "label": "Link URL", "default": "/products" }',
          '  ],',
          '  "presets": [{ "name": "Announcement Bar" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Announcement Bar',
          settings: [
            {
              id: 'text',
              type: 'text',
              label: 'Message',
              default: 'Free shipping on fresh drops this week.',
            },
            {
              id: 'linkLabel',
              type: 'text',
              label: 'Link label',
              default: 'Shop now',
            },
            {
              id: 'linkHref',
              type: 'url',
              label: 'Link URL',
              default: '/products',
            },
          ],
          presets: [
            {
              name: 'Announcement Bar',
            },
          ],
        },
      },
      // D6: hero-banner schema parity with React heroBanner schema (image, overlay, height, textAlign added).
      // eyebrow is additive (Liquid superset — not in React schema, kept for backwards compat).
      'hero-banner': {
        path: 'sections/hero-banner.liquid',
        source: [
          '{% assign overlay_value = section.settings.overlay | default: 0.4 %}',
          '{% assign height_value = section.settings.height | default: \'full\' %}',
          '{% assign align_value = section.settings.textAlign | default: \'center\' %}',
          '<section class="lb-hero-banner lb-hero-banner--height-{{ height_value }} lb-hero-banner--align-{{ align_value }}" data-section-id="{{ section.id }}" data-height="{{ height_value }}" data-text-align="{{ align_value }}">',
          '  {% if section.settings.image %}<img class="lb-hero-banner__bg-image" src="{{ section.settings.image | image_url }}" data-image-url="{{ section.settings.image | image_url }}" data-overlay="{{ overlay_value }}" alt="">{% endif %}',
          '  {% if section.settings.eyebrow %}<p class="lb-hero-banner__eyebrow">{{ section.settings.eyebrow }}</p>{% endif %}',
          '  <h1 class="lb-hero-banner__heading">{{ section.settings.heading }}</h1>',
          '  {% if section.settings.subheading %}<p class="lb-hero-banner__subheading">{{ section.settings.subheading }}</p>{% endif %}',
          '  <a href="{{ section.settings.ctaLink | store_url }}" class="lb-hero-banner__cta">{{ section.settings.ctaText }}</a>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Hero Banner",',
          '  "settings": [',
          '    { "id": "eyebrow", "type": "text", "label": "Eyebrow", "default": "New season essentials" },',
          '    { "id": "heading", "type": "text", "label": "Heading", "default": "Fresh drops for daily buyers" },',
          '    { "id": "subheading", "type": "textarea", "label": "Subheading" },',
          '    { "id": "ctaText", "type": "text", "label": "Button text", "default": "Shop Now" },',
          '    { "id": "ctaLink", "type": "url", "label": "Button link", "default": "/products" },',
          '    { "id": "image", "type": "image", "label": "Background Image" },',
          '    { "id": "overlay", "type": "range", "label": "Overlay Opacity", "default": 0.4, "min": 0, "max": 1, "step": 0.1 },',
          '    { "id": "height", "type": "select", "label": "Height", "options": ["full", "large", "medium", "small"], "default": "full" },',
          '    { "id": "textAlign", "type": "select", "label": "Text Alignment", "options": ["left", "center", "right"], "default": "center" }',
          '  ],',
          '  "blocks": [],',
          '  "presets": [{ "name": "Hero Banner" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Hero Banner',
          settings: [
            {
              id: 'eyebrow',
              type: 'text',
              label: 'Eyebrow',
              default: 'New season essentials',
            },
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
              default: 'Fresh drops for daily buyers',
            },
            {
              id: 'subheading',
              type: 'textarea',
              label: 'Subheading',
            },
            {
              id: 'ctaText',
              type: 'text',
              label: 'Button text',
              default: 'Shop Now',
            },
            {
              id: 'ctaLink',
              type: 'url',
              label: 'Button link',
              default: '/products',
            },
            {
              id: 'image',
              type: 'image',
              label: 'Background Image',
            },
            {
              id: 'overlay',
              type: 'range',
              label: 'Overlay Opacity',
              default: 0.4,
              min: 0,
              max: 1,
              step: 0.1,
            },
            {
              id: 'height',
              type: 'select',
              label: 'Height',
              options: ['full', 'large', 'medium', 'small'],
              default: 'full',
            },
            {
              id: 'textAlign',
              type: 'select',
              label: 'Text Alignment',
              options: ['left', 'center', 'right'],
              default: 'center',
            },
          ],
          blocks: [],
          presets: [
            {
              name: 'Hero Banner',
            },
          ],
        },
      },
      'category-grid': {
        path: 'sections/category-grid.liquid',
        source: [
          // T2a/W1b — was block-driven (3 merchant-typed category cards — Sneakers/Apparel/
          // Accessories — pointing to collection slugs that do not exist on a fresh store).
          // Rewritten to bind the real `collections` drop (composition-engine.tsx). Known scope
          // limit, not fixed here (out of this phase's reach — a real "list all of this store's
          // collections" fetch does not exist anywhere in the platform today; `collections/page.tsx`'s
          // own comment confirms this is a deliberate, pre-existing gap, not something this section
          // introduced): `collections` is currently a 0-or-1-item wrapper around whatever `collection`
          // is already in scope for the CURRENT page (composition-engine.tsx `collections: collection
          // ? [collection] : []`), not a genuine multi-collection listing. On a store with 0 real
          // collections (e.g. `snaz`) this correctly renders the empty state below — real, not
          // fabricated, even though it is not yet the full "browse all our collections" experience a
          // merchant with collections would expect. Never re-introduce hardcoded category cards here.
          '<section class="lb-category-grid" data-section-id="{{ section.id }}">',
          '  <h2>{{ section.settings.title }}</h2>',
          '  <p>{{ section.settings.subtitle }}</p>',
          '  {% if collections.size > 0 %}',
          '  <div class="lb-category-grid__items">{% for item in collections %}<a class="lb-category-card" href="{{ routes.collections_url }}/{{ item.handle }}"><strong>{{ item.title }}</strong>{% if item.description %}<span>{{ item.description | strip_html | truncate: 60 }}</span>{% endif %}</a>{% endfor %}</div>',
          '  {% else %}',
          '  <div class="lb-category-grid__empty"><h2>No collections yet</h2><p>Collections added to this store will appear here.</p></div>',
          '  {% endif %}',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Category Grid",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Shop by style" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" }',
          '  ],',
          '  "blocks": [],',
          '  "presets": [{ "name": "Category Grid" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Category Grid',
          settings: [
            {
              id: 'title',
              type: 'text',
              label: 'Heading',
              default: 'Shop by style',
            },
            {
              id: 'subtitle',
              type: 'text',
              label: 'Subheading',
            },
          ],
          blocks: [],
          presets: [
            {
              name: 'Category Grid',
            },
          ],
        },
      },
      'featured-products': {
        path: 'sections/featured-products.liquid',
        source: [
          // T1/W3 — was block-driven (each product-card block held merchant-TYPED title/price/url
          // literals — fabricated data, never a real product). Rewritten to bind the same real,
          // already tenant-scoped `collection.products` drop collection-product-list.liquid uses
          // (composition-engine.tsx's buildLiquidCommerceContext / data-binding-engine.ts's
          // buildSectionDataPlan — the PROVEN product-fetching pipeline, not a new query). `collection`
          // is a single PAGE-LEVEL scope shared by every product-bearing section on this page (see
          // theme-renderer.ts buildLiquidScope) — there is no per-section "pick a different collection"
          // fetch today, so featured-products and product-grid intentionally show the SAME underlying
          // list, differentiated only by `productLimit` via the `limit:` filter. This is a documented
          // scope simplification (T1 final report), not silent under-delivery: 0 real products renders
          // 0 cards + the empty state below; N real products renders N real cards, never fabricated ones.
          '<section class="lb-featured-products" data-section-id="{{ section.id }}">',
          '  <div>',
          '    <h2>{{ section.settings.title }}</h2>',
          '    <p>{{ section.settings.subtitle }}</p>',
          '  </div>',
          '  {% if collection.products.size > 0 %}',
          `  <div class="lb-featured-products__items">{% for item in collection.products limit: section.settings.productLimit %}${LIQUID_PRODUCT_CARD}{% endfor %}</div>`,
          '  <a href="{{ section.settings.viewAllHref | store_url }}">{{ section.settings.viewAllLabel }}</a>',
          '  {% else %}',
          '  <div class="lb-featured-products__empty"><h2>No featured products</h2><p>Featured products added to this store will appear here.</p></div>',
          '  {% endif %}',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Featured Products",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Drop-ready collection" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" },',
          '    { "id": "viewAllLabel", "type": "text", "label": "View all label", "default": "View collection" },',
          '    { "id": "viewAllHref", "type": "url", "label": "View all URL", "default": "/collections/new-arrivals" },',
          '    { "id": "productLimit", "type": "range", "label": "Products to show", "min": 1, "max": 12, "step": 1, "default": 3 }',
          '  ],',
          '  "blocks": [],',
          '  "presets": [{ "name": "Featured Products" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Featured Products',
          settings: [
            {
              id: 'title',
              type: 'text',
              label: 'Heading',
              default: 'Drop-ready collection',
            },
            {
              id: 'subtitle',
              type: 'text',
              label: 'Subheading',
            },
            {
              id: 'viewAllLabel',
              type: 'text',
              label: 'View all label',
              default: 'View collection',
            },
            {
              id: 'viewAllHref',
              type: 'url',
              label: 'View all URL',
              default: '/collections/new-arrivals',
            },
            {
              id: 'productLimit',
              type: 'range',
              label: 'Products to show',
              min: 1,
              max: 12,
              step: 1,
              default: 3,
            },
          ],
          blocks: [],
          presets: [
            {
              name: 'Featured Products',
            },
          ],
        },
      },
      'product-grid': {
        path: 'sections/product-grid.liquid',
        source: [
          // T1/W3 — was block-driven (fabricated per-block title/price/url literals). Rewritten to
          // bind the same real, tenant-scoped `collection.products` drop as featured-products.liquid
          // (see that section's comment for the full "shared page-level collection, per-section
          // productLimit" reasoning — the documented scope simplification, not silent under-delivery).
          '<section class="lb-product-grid" data-section-id="{{ section.id }}">',
          '  <h2>{{ section.settings.title }}</h2>',
          '  <p>{{ section.settings.subtitle }}</p>',
          '  {% if collection.products.size > 0 %}',
          `  <div class="lb-product-grid__items" data-columns="{{ section.settings.columns }}">{% for item in collection.products limit: section.settings.productLimit %}${LIQUID_PRODUCT_CARD}{% endfor %}</div>`,
          '  {% else %}',
          '  <div class="lb-product-grid__empty"><h2>No products found</h2><p>Products added to this store will appear here.</p></div>',
          '  {% endif %}',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Product Grid",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Featured Products" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" },',
          '    { "id": "columns", "type": "range", "label": "Columns", "min": 2, "max": 4, "step": 1, "default": 4 },',
          '    { "id": "productLimit", "type": "range", "label": "Products to show", "min": 1, "max": 24, "step": 1, "default": 8 }',
          '  ],',
          '  "blocks": [],',
          '  "presets": [{ "name": "Product Grid" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Product Grid',
          settings: [
            {
              id: 'title',
              type: 'text',
              label: 'Heading',
              default: 'Featured Products',
            },
            {
              id: 'subtitle',
              type: 'text',
              label: 'Subheading',
            },
            {
              id: 'columns',
              type: 'range',
              label: 'Columns',
              min: 2,
              max: 4,
              step: 1,
              default: 4,
            },
            {
              id: 'productLimit',
              type: 'range',
              label: 'Products to show',
              min: 1,
              max: 24,
              step: 1,
              default: 8,
            },
          ],
          blocks: [],
          presets: [
            {
              name: 'Product Grid',
            },
          ],
        },
      },
      spotlight: {
        path: 'sections/spotlight.liquid',
        source: [
          '<section class="lb-first-party-spotlight" data-section-id="{{ section.id }}">',
          '  <p>{{ section.settings.subheading }}</p>',
          '  <h2>{{ section.settings.heading }}</h2>',
          '  <div class="lb-first-party-spotlight__blocks">',
          '    {% for block in section.blocks %}',
          '      {{ block.content | raw }}',
          '    {% endfor %}',
          '  </div>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Spotlight",',
          '  "settings": [',
          '    { "id": "heading", "type": "text", "label": "Heading", "default": "Made for daily buyers" },',
          '    { "id": "subheading", "type": "text", "label": "Subheading" }',
          '  ],',
          '  "blocks": [',
          '    { "type": "badge", "name": "Badge" },',
          '    { "type": "@app", "name": "App block" }',
          '  ],',
          '  "presets": [{ "name": "Spotlight" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Spotlight',
          settings: [
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
              default: 'Made for daily buyers',
            },
            {
              id: 'subheading',
              type: 'text',
              label: 'Subheading',
            },
          ],
          blocks: [
            {
              type: 'badge',
              name: 'Badge',
            },
            {
              type: '@app',
              name: 'App block',
            },
          ],
          presets: [
            {
              name: 'Spotlight',
            },
          ],
        },
      },
      // S5/W2 — Video, decision (b): a NEW Liquid section, not a React one (ART-17 freezes React
      // sections at 20 FILES; Liquid sections are the sanctioned path per
      // no-new-react-sections-validator's own message). No section had a video-capable setting —
      // rich-content.liquid only carries title/richtext body, and neither the theme-registry.ts
      // React section-schema model nor this portable ThemeBundleSettingFieldSchema declares a
      // video-typed field for any EXISTING section. The Phase-U VideoControl/VideoUrlControl
      // (apps/merchant/web/.../controls/) are wired for a DIFFERENT, parallel type system
      // (theme-registry.ts's ExtendedFieldType, the React/JSON-contract editor model) that this
      // portable Liquid bundle's ThemeBundleSettingFieldSchema enum does not include — deliberately
      // NOT reused here. Instead the video URL is a plain `url`-typed setting, a type ALREADY in
      // ThemeBundleSettingFieldSchema's enum with an ALREADY-working editor control (UrlInput, via
      // SchemaFormRenderer's `case 'url'`) — zero type-system or control changes needed. The value
      // is rendered as an <iframe> (YouTube/Vimeo embed), which the sanitizer ALREADY permits:
      // `iframe` is in LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG's ADD_TAGS, and `src`/`width`/`height`/
      // `title`/`loading`/`sandbox` are all in ADD_ATTR (theme-renderer.ts) — verified by reading the
      // config before writing this, not assumed. No sanitizer change was made or needed. The `src`
      // value is filtered through the new `video_url` Liquid filter (registered above; identical to
      // `asset_url`/`image_url`'s existing safeLiquidUrl — a javascript:/data: scheme becomes '', an
      // http(s) URL passes through), and only ever reaches the page via an escaped `{{ }}` output
      // (never `| raw`), so a quote-breakout attempt is HTML-attribute-escaped by the Liquid engine's
      // own outputEscape:'escape' regardless of what the filter does with the scheme. Two independent
      // layers, matching the same pattern image_url/asset_url already use. Deliberately NOT added to
      // THEME_LIQUID_PORTABLE_SECTION_PARITY (theme-governance.ts): that list pairs a Liquid section
      // with a React counterpart file, and this section has none — adding it would create a
      // permanent, unclosable parity failure for a section that structurally cannot have a React
      // twin without a 21st frozen React file. videoUrl ships with NO default (empty), matching the
      // established convention for every other externally-hosted asset in this bundle (hero image,
      // socialImageUrl, faviconUrl): an unset external URL renders no tag at all rather than a
      // fabricated, unowned public video baked into every merchant's default demo storefront.
      'video-hero': createLiquidSectionFile({
        type: 'video-hero',
        name: 'Video Hero',
        settings: [
          liquidSetting('heading', 'text', 'Heading', { default: 'See the fit in motion' }),
          liquidSetting('subheading', 'textarea', 'Subheading', { default: 'A quick look at how each drop moves, from the box to your feet.' }),
          liquidSetting('videoUrl', 'url', 'Video embed URL', { info: 'A YouTube or Vimeo embed URL (for example https://www.youtube.com/embed/VIDEO_ID). Leave blank to hide the video.' }),
        ],
        body: [
          '<section class="lb-video-hero" data-section-id="{{ section.id }}">',
          '  <div class="lb-video-hero__copy">',
          '    <h2 class="lb-video-hero__heading">{{ section.settings.heading }}</h2>',
          '    {% if section.settings.subheading %}<p class="lb-video-hero__subheading">{{ section.settings.subheading }}</p>{% endif %}',
          '  </div>',
          '  {% if section.settings.videoUrl != blank %}<div class="lb-video-hero__embed"><iframe src="{{ section.settings.videoUrl | video_url }}" title="{{ section.settings.heading }}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen></iframe></div>{% endif %}',
          '</section>',
        ],
      }),
      'newsletter-signup': {
        path: 'sections/newsletter-signup.liquid',
        source: [
          '<section class="lb-newsletter-signup" data-section-id="{{ section.id }}">',
          '  <h2>{{ section.settings.title }}</h2>',
          '  <p>{{ section.settings.subtitle }}</p>',
          '  <form action="/contact" method="post">',
          '    <input type="email" name="email" aria-label="Email" required>',
          '    <button type="submit">{{ section.settings.buttonLabel }}</button>',
          '  </form>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Newsletter Signup",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Get first access" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" },',
          '    { "id": "buttonLabel", "type": "text", "label": "Button label", "default": "Sign up" }',
          '  ],',
          '  "presets": [{ "name": "Newsletter Signup" }]',
          '}',
          '{% endschema %}',
        ].join('\n'),
        schema: {
          name: 'Newsletter Signup',
          settings: [
            {
              id: 'title',
              type: 'text',
              label: 'Heading',
              default: 'Get first access',
            },
            {
              id: 'subtitle',
              type: 'text',
              label: 'Subheading',
            },
            {
              id: 'buttonLabel',
              type: 'text',
              label: 'Button label',
              default: 'Sign up',
            },
          ],
          presets: [
            {
              name: 'Newsletter Signup',
            },
          ],
        },
      },
    },
    blocks: {
      badge: {
        path: 'blocks/badge.liquid',
        source: '<span class="lb-badge" data-block-id="{{ block.id }}">{{ block.settings.label }}</span>',
        schema: {
          name: 'Badge',
          settings: [
            {
              id: 'label',
              type: 'text',
              label: 'Label',
              default: 'New',
            },
          ],
        },
      },
    },
    locales: {
      en: {
        general: {
          cart: 'Cart',
        },
      },
    },
    renderer: {
      engine: 'liquid',
      renderer_version: THEME_LIQUID_RENDERER_VERSION,
      liquid_ready: true,
      assets: {},
    },
  });
}
