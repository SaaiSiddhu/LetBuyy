import { z } from 'zod';

export const THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract';
export const THEME_BUNDLE_RENDERER_VERSION = '1.0.0';
export const THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections';
export const THEME_LIQUID_RENDERER_VERSION = '0.1.0';

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
  type: z.enum(['text', 'textarea', 'richtext', 'color', 'image', 'select', 'toggle', 'range', 'number', 'url', 'radio']),
  label: z.string().min(1).max(120),
  default: ThemeBundleJsonSchema.optional(),
  description: z.string().max(500).optional(),
  info: z.string().max(500).optional(),
  placeholder: z.string().max(160).optional(),
  options: z.array(z.string().min(1).max(120)).max(100).optional(),
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

export const ThemeBundleTemplateBlockSchema = z.object({
  type: z.string().min(1).max(120),
  settings: ThemeBundleJsonObjectSchema.default({}),
  disabled: z.boolean().default(false),
}).strict();

export const ThemeBundleTemplateSectionSchema = z.object({
  type: z.string().min(1).max(120),
  settings: ThemeBundleJsonObjectSchema.default({}),
  blocks: z.record(z.string(), ThemeBundleTemplateBlockSchema).default({}),
  block_order: z.array(z.string().min(1).max(120)).default([]),
  disabled: z.boolean().default(false),
}).strict();

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
  bundle: ThemePackageBundleSchema,
  submission_mode: z.enum(['marketplace', 'private_install']).default('marketplace'),
}).strict();

export const UploadPortableThemePackageSchema = z.object({
  bundle: PortableThemePackageBundleSchema,
  submission_mode: z.enum(['marketplace', 'private_install']).default('marketplace'),
}).strict();

export type ThemeBundle = z.infer<typeof ThemePackageBundleSchema>;
export type ThemePackageBundle = z.infer<typeof ThemePackageBundleSchema>;
export type LiquidThemePackageBundle = z.infer<typeof LiquidThemePackageBundleSchema>;
export type PortableThemePackageBundle = z.infer<typeof PortableThemePackageBundleSchema>;
export type UploadThemePackageInput = z.infer<typeof UploadThemePackageSchema>;
export type UploadPortableThemePackageInput = z.infer<typeof UploadPortableThemePackageSchema>;
export type ThemeBundleTemplate = z.infer<typeof ThemeBundleTemplateSchema>;
export type ThemeBundleTemplateSection = z.infer<typeof ThemeBundleTemplateSectionSchema>;
export type ThemeBundleTemplateBlock = z.infer<typeof ThemeBundleTemplateBlockSchema>;
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

export function parseThemeBundle(input: unknown): ThemeBundle {
  return ThemePackageBundleSchema.parse(input);
}

export function parseThemePackageBundle(input: unknown): ThemePackageBundle {
  return ThemePackageBundleSchema.parse(input);
}

export function parseLiquidThemePackageBundle(input: unknown): LiquidThemePackageBundle {
  return LiquidThemePackageBundleSchema.parse(input);
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
          '  {{ content_for_header }}',
          '</head>',
          '<body>',
          '  {{ content_for_layout }}',
          '  {{ content_for_footer }}',
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
          '      {{ block.content }}',
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
