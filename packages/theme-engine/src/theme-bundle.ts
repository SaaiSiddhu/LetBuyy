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
        '  {% if section.settings.linkLabel %}<a href="{{ section.settings.linkHref }}">{{ section.settings.linkLabel }}</a>{% endif %}',
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
        '<section class="lb-about-section" data-section-id="{{ section.id }}">',
        '  <h2>{{ section.settings.title }}</h2>',
        '  <div>{{ section.settings.content }}</div>',
        '  {% if section.settings.imageUrl %}<img src="{{ section.settings.imageUrl | image_url }}" alt="{{ section.settings.title }}">{% endif %}',
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
        '<section class="lb-banner-carousel" data-section-id="{{ section.id }}" data-autoplay="{{ section.settings.autoplay }}">',
        '  {% if section.settings.title %}<h2>{{ section.settings.title }}</h2>{% endif %}',
        '  <div class="lb-banner-carousel__slides">',
        '    {% for block in section.blocks %}<a href="{{ block.settings.link }}">{% if block.settings.image %}<img src="{{ block.settings.image | image_url }}" alt="{{ block.settings.heading }}">{% endif %}<span>{{ block.settings.heading }}</span></a>{% endfor %}',
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
        '    {% for block in section.blocks %}<a class="lb-category-card" href="/collections/{{ block.settings.slug }}"><strong>{{ block.settings.name }}</strong><span>{{ block.settings.tagline }}</span></a>{% endfor %}',
        '  </div>',
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
        '  <a href="{{ section.settings.ctaLink }}">{{ section.settings.ctaText }}</a>',
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
        '  <a href="{{ section.settings.viewAllHref }}">{{ section.settings.viewAllLabel }}</a>',
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
    footer: createLiquidSectionFile({
      type: 'footer',
      name: 'Footer',
      settings: [
        liquidSetting('storeName', 'text', 'Store name', { default: '{{ shop.name }}' }),
        liquidSetting('tagline', 'text', 'Tagline'),
      ],
      blocks: [liquidInlineBlock('link', 'Link', [
        liquidSetting('label', 'text', 'Label'),
        liquidSetting('href', 'url', 'URL'),
      ])],
      body: [
        '<footer class="lb-footer" data-section-id="{{ section.id }}">',
        '  <div><strong>{{ section.settings.storeName }}</strong>{% if section.settings.tagline %}<p>{{ section.settings.tagline }}</p>{% endif %}</div>',
        '  <nav>{% for block in section.blocks %}<a href="{{ block.settings.href }}">{{ block.settings.label }}</a>{% endfor %}</nav>',
        '</footer>',
      ],
    }),
    header: createLiquidSectionFile({
      type: 'header',
      name: 'Header',
      settings: [
        liquidSetting('storeName', 'text', 'Store name', { default: '{{ shop.name }}' }),
        liquidSetting('showSearch', 'toggle', 'Show search', { default: true }),
        liquidSetting('showCart', 'toggle', 'Show cart', { default: true }),
      ],
      blocks: [liquidInlineBlock('link', 'Link', [
        liquidSetting('label', 'text', 'Label'),
        liquidSetting('href', 'url', 'URL'),
      ])],
      body: [
        '<header class="lb-header" data-section-id="{{ section.id }}">',
        '  <a class="lb-header__brand" href="/">{{ section.settings.storeName }}</a>',
        '  <nav>{% for block in section.blocks %}<a href="{{ block.settings.href }}">{{ block.settings.label }}</a>{% endfor %}</nav>',
        '  <div class="lb-header__actions">{% if section.settings.showSearch %}<lb-search data-lb-island="search" data-search-url="/search"></lb-search>{% endif %}{% if section.settings.showCart %}<a href="/cart">{{ "general.cart" | t }} ({{ cart.item_count }})</a>{% endif %}</div>',
        '</header>',
      ],
    }),
    'hero-banner': createLiquidSectionFile({
      type: 'hero-banner',
      name: 'Hero Banner',
      settings: [
        liquidSetting('eyebrow', 'text', 'Eyebrow', { default: 'New season essentials' }),
        liquidSetting('heading', 'text', 'Heading', { default: 'Fresh drops for daily buyers' }),
        liquidSetting('subheading', 'textarea', 'Subheading'),
        liquidSetting('ctaText', 'text', 'Button text', { default: 'Shop Now' }),
        liquidSetting('ctaLink', 'url', 'Button link', { default: '/products' }),
      ],
      body: [
        '<section class="lb-hero-banner" data-section-id="{{ section.id }}">',
        '  {% if section.settings.eyebrow %}<p>{{ section.settings.eyebrow }}</p>{% endif %}',
        '  <h1>{{ section.settings.heading }}</h1>',
        '  {% if section.settings.subheading %}<p>{{ section.settings.subheading }}</p>{% endif %}',
        '  <a href="{{ section.settings.ctaLink }}">{{ section.settings.ctaText }}</a>',
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
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.summary }}</p><a href="{{ block.settings.link }}">View</a></article>{% endfor %}',
        '</section>',
      ],
    }),
    'product-detail': createLiquidSectionFile({
      type: 'product-detail',
      name: 'Product Detail',
      settings: [
        liquidSetting('showGallery', 'toggle', 'Show gallery', { default: true }),
        liquidSetting('showDescription', 'toggle', 'Show description', { default: true }),
      ],
      body: [
        '<section class="lb-product-detail" data-section-id="{{ section.id }}">',
        '  <h1>{{ product.title }}</h1>',
        '  {% if section.settings.showGallery %}<div class="lb-product-detail__gallery">{% for image in product.images %}<img src="{{ image | image_url }}" alt="{{ product.title }}">{% endfor %}</div>{% endif %}',
        '  <p>{{ product.price | money_with_currency: product.currency }}</p>',
        '  {% if section.settings.showDescription %}<div>{{ product.description }}</div>{% endif %}',
        '  <lb-add-to-cart data-lb-island="add-to-cart" data-product-id="{{ product.id }}" data-product-name="{{ product.title }}" data-product-price="{{ product.price }}" data-product-currency="{{ product.currency }}" data-product-url="{{ product.url }}"><button type="button" data-lb-add-to-cart>Add to cart</button><span data-lb-add-to-cart-status aria-live="polite"></span></lb-add-to-cart>',
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
        '    {% for item in collection.products %}<article class="lb-product-card"><a href="{{ item.url }}"><strong>{{ item.title }}</strong><span>{{ item.price | money_with_currency: item.currency }}</span></a></article>{% endfor %}',
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
        '  {% for block in section.blocks %}<article><h3>{{ block.settings.title }}</h3><p>{{ block.settings.description }}</p><a href="{{ block.settings.link }}">Learn more</a></article>{% endfor %}',
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
        '  {% for block in section.blocks %}<blockquote><p>{{ block.settings.quote }}</p><cite>{{ block.settings.author }}</cite></blockquote>{% endfor %}',
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
        '  {% for block in section.blocks %}<article><strong>{{ block.settings.label }}</strong><span>{{ block.settings.description }}</span></article>{% endfor %}',
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
  if (!('settings' in block)) {
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
        blocks[block.type] = liquidInlineBlockDefinitionToSchema(block);
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
        ...reusableBlockSchemas,
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
          '  <title>{{ shop.name }} - Urban Kicks</title>',
          '  {{ content_for_header | raw }}',
          '</head>',
          '<body class="lb-theme lb-theme--urban-kicks">',
          '  <main id="MainContent">',
          '    {{ content_for_layout | raw }}',
          '  </main>',
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
            description: 'Urban Kicks storefront color tokens.',
            fields: {
              primaryColor: {
                type: 'color',
                label: 'Primary color',
                default: '#8B5CF6',
              },
              accentColor: {
                type: 'color',
                label: 'Accent color',
                default: '#F59E0B',
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
        },
      },
      settings_data: {
        current: {
          primaryColor: '#8B5CF6',
          accentColor: '#F59E0B',
          surfaceColor: '#F8FAFC',
          headingFontFamily: 'Inter',
          bodyFontFamily: 'Inter',
        },
      },
    },
    templates: {
      header: {
        name: 'Urban Kicks header',
        layout: 'theme',
        sections: {
          'header-default': {
            type: 'header',
            settings: {
              storeName: 'Urban Kicks',
              showSearch: true,
              showCart: true,
            },
            blocks: {
              'header-products': {
                type: 'link',
                settings: {
                  label: 'Products',
                  href: '/products',
                },
              },
              'header-collections': {
                type: 'link',
                settings: {
                  label: 'Collections',
                  href: '/collections/new-arrivals',
                },
              },
            },
            block_order: ['header-products', 'header-collections'],
          },
        },
        order: ['header-default'],
      },
      footer: {
        name: 'Urban Kicks footer',
        layout: 'theme',
        sections: {
          'footer-default': {
            type: 'footer',
            settings: {
              storeName: 'Urban Kicks',
              tagline: 'First-party Liquid commerce storefront.',
            },
            blocks: {
              'footer-contact': {
                type: 'link',
                settings: {
                  label: 'Contact',
                  href: '/contact',
                },
              },
              'footer-policy': {
                type: 'link',
                settings: {
                  label: 'Policies',
                  href: '/policies/shipping-policy',
                },
              },
            },
            block_order: ['footer-contact', 'footer-policy'],
          },
        },
        order: ['footer-default'],
      },
      index: {
        name: 'Urban Kicks home page',
        layout: 'theme',
        sections: {
          'announcement-default': {
            type: 'announcement-bar',
            settings: {
              text: 'Free shipping on fresh drops this week.',
              linkLabel: 'Shop now',
              linkHref: '/products',
            },
          },
          'hero-default': {
            type: 'hero-banner',
            settings: {
              eyebrow: 'New season essentials',
              heading: 'Fresh drops for daily buyers',
              subheading: 'Launch-ready sneakers, apparel, and accessories for a commerce storefront.',
              ctaText: 'Shop Now',
              ctaLink: '/products',
            },
          },
          'category-grid-default': {
            type: 'category-grid',
            settings: {
              title: 'Shop by style',
              subtitle: 'Launch-ready groupings for daily buyers.',
            },
            blocks: {
              'category-sneakers': {
                type: 'category',
                settings: {
                  name: 'Sneakers',
                  slug: 'sneakers',
                  tagline: 'Fresh pairs',
                },
              },
              'category-apparel': {
                type: 'category',
                settings: {
                  name: 'Apparel',
                  slug: 'apparel',
                  tagline: 'Daily fits',
                },
              },
              'category-accessories': {
                type: 'category',
                settings: {
                  name: 'Accessories',
                  slug: 'accessories',
                  tagline: 'Finish the look',
                },
              },
            },
            block_order: ['category-sneakers', 'category-apparel', 'category-accessories'],
          },
          'featured-collection-default': {
            type: 'featured-products',
            settings: {
              title: 'Drop-ready collection',
              subtitle: 'Curated items for the first storefront launch.',
              viewAllLabel: 'View collection',
              viewAllHref: '/collections/new-arrivals',
            },
            blocks: {
              'product-sneaker': {
                type: 'product-card',
                settings: {
                  title: 'Velocity Runner',
                  price: 'Rs 4,999',
                  url: '/products/velocity-runner',
                },
              },
              'product-hoodie': {
                type: 'product-card',
                settings: {
                  title: 'Everyday Hoodie',
                  price: 'Rs 2,499',
                  url: '/products/everyday-hoodie',
                },
              },
              'product-cap': {
                type: 'product-card',
                settings: {
                  title: 'Street Cap',
                  price: 'Rs 899',
                  url: '/products/street-cap',
                },
              },
            },
            block_order: ['product-sneaker', 'product-hoodie', 'product-cap'],
          },
          'product-grid-default': {
            type: 'product-grid',
            settings: {
              title: 'Featured Products',
              subtitle: 'Products selected from your catalog.',
              columns: 4,
            },
            blocks: {
              'grid-sneaker': {
                type: 'product-card',
                settings: {
                  title: 'Court Sneaker',
                  price: 'Rs 3,499',
                  url: '/products/court-sneaker',
                },
              },
              'grid-backpack': {
                type: 'product-card',
                settings: {
                  title: 'Transit Backpack',
                  price: 'Rs 1,999',
                  url: '/products/transit-backpack',
                },
              },
            },
            block_order: ['grid-sneaker', 'grid-backpack'],
          },
          'spotlight-default': {
            type: 'spotlight',
            settings: {
              heading: 'A brand-new Liquid section',
              subheading: 'Added as sections/spotlight.liquid without changing the storefront React registry.',
            },
            blocks: {
              'spotlight-badge': {
                type: 'badge',
                settings: {
                  label: 'Zero storefront code change',
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
          'announcement-default',
          'hero-default',
          'category-grid-default',
          'featured-collection-default',
          'product-grid-default',
          'spotlight-default',
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
          'collection-products': { type: 'collection-product-list', settings: { title: 'Products' } },
        },
        order: ['collection-banner-default', 'collection-products'],
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
    },
    sections: {
      'cart-summary': createLiquidSectionFile({
        type: 'cart-summary',
        name: 'Cart',
        settings: [liquidSetting('heading', 'text', 'Heading', { default: 'Your cart' })],
        body: [
          '<section class="lb-cart" data-section-id="{{ section.id }}">',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  {% if cart.item_count > 0 %}',
          '  <ul class="lb-cart__items">{% for item in cart.items %}<li class="lb-cart__item"><span class="lb-cart__title">{{ item.title }}</span><span class="lb-cart__qty">{{ item.quantity }}</span><span class="lb-cart__line">{{ item.line_price | money_with_currency: cart.currency }}</span></li>{% endfor %}</ul>',
          '  <p class="lb-cart__total">Total: {{ cart.total_price | money_with_currency: cart.currency }}</p>',
          '  <a class="lb-cart__checkout" href="{{ cart.checkout_url }}">Checkout</a>',
          '  {% else %}<p class="lb-cart__empty">Your cart is empty.</p>{% endif %}',
          '</section>',
        ],
      }),
      'search-box': createLiquidSectionFile({
        type: 'search-box',
        name: 'Search',
        settings: [liquidSetting('placeholder', 'text', 'Placeholder', { default: 'Search products' })],
        body: [
          '<section class="lb-search" data-section-id="{{ section.id }}">',
          '  <lb-search data-lb-island="search" data-search-url="/search"><input type="search" placeholder="{{ section.settings.placeholder }}" aria-label="Search products"></lb-search>',
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
          '  <h1>{{ collection.title }}</h1>',
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
          '  <div class="lb-product-grid__items">',
          '    {% for item in collection.products %}<article class="lb-product-card"><a href="{{ item.url }}"><strong>{{ item.title }}</strong><span>{{ item.price | money_with_currency: item.currency }}</span></a></article>{% endfor %}',
          '  </div>',
          '</section>',
        ],
      }),
      ...createLiquidParitySectionFiles(),
      'announcement-bar': {
        path: 'sections/announcement-bar.liquid',
        source: [
          '<section class="lb-announcement-bar" data-section-id="{{ section.id }}">',
          '  <span>{{ section.settings.text }}</span>',
          '  <a href="{{ section.settings.linkHref }}">{{ section.settings.linkLabel }}</a>',
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
      'hero-banner': {
        path: 'sections/hero-banner.liquid',
        source: [
          '<section class="lb-hero-banner" data-section-id="{{ section.id }}">',
          '  <p>{{ section.settings.eyebrow }}</p>',
          '  <h1>{{ section.settings.heading }}</h1>',
          '  <p>{{ section.settings.subheading }}</p>',
          '  <a href="{{ section.settings.ctaLink }}">{{ section.settings.ctaText }}</a>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Hero Banner",',
          '  "settings": [',
          '    { "id": "eyebrow", "type": "text", "label": "Eyebrow", "default": "New season essentials" },',
          '    { "id": "heading", "type": "text", "label": "Heading", "default": "Fresh drops for daily buyers" },',
          '    { "id": "subheading", "type": "textarea", "label": "Subheading" },',
          '    { "id": "ctaText", "type": "text", "label": "Button text", "default": "Shop Now" },',
          '    { "id": "ctaLink", "type": "url", "label": "Button link", "default": "/products" }',
          '  ],',
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
          ],
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
          '<section class="lb-category-grid" data-section-id="{{ section.id }}">',
          '  <h2>{{ section.settings.title }}</h2>',
          '  <p>{{ section.settings.subtitle }}</p>',
          '  <div class="lb-category-grid__items">',
          '    {% for block in section.blocks %}',
          '      {{ block.content | raw }}',
          '    {% endfor %}',
          '  </div>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Category Grid",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Shop by style" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" }',
          '  ],',
          '  "blocks": [{ "type": "category", "name": "Category" }],',
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
          blocks: [
            {
              type: 'category',
              name: 'Category',
            },
          ],
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
          '<section class="lb-featured-products" data-section-id="{{ section.id }}">',
          '  <div>',
          '    <h2>{{ section.settings.title }}</h2>',
          '    <p>{{ section.settings.subtitle }}</p>',
          '  </div>',
          '  <div class="lb-featured-products__items">',
          '    {% for block in section.blocks %}',
          '      {{ block.content | raw }}',
          '    {% endfor %}',
          '  </div>',
          '  <a href="{{ section.settings.viewAllHref }}">{{ section.settings.viewAllLabel }}</a>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Featured Products",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Drop-ready collection" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" },',
          '    { "id": "viewAllLabel", "type": "text", "label": "View all label", "default": "View collection" },',
          '    { "id": "viewAllHref", "type": "url", "label": "View all URL", "default": "/collections/new-arrivals" }',
          '  ],',
          '  "blocks": [{ "type": "product-card", "name": "Product card" }],',
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
          ],
          blocks: [
            {
              type: 'product-card',
              name: 'Product card',
            },
          ],
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
          '<section class="lb-product-grid" data-section-id="{{ section.id }}">',
          '  <h2>{{ section.settings.title }}</h2>',
          '  <p>{{ section.settings.subtitle }}</p>',
          '  <div class="lb-product-grid__items" data-columns="{{ section.settings.columns }}">',
          '    {% for block in section.blocks %}',
          '      {{ block.content | raw }}',
          '    {% endfor %}',
          '  </div>',
          '</section>',
          '{% schema %}',
          '{',
          '  "name": "Product Grid",',
          '  "settings": [',
          '    { "id": "title", "type": "text", "label": "Heading", "default": "Featured Products" },',
          '    { "id": "subtitle", "type": "text", "label": "Subheading" },',
          '    { "id": "columns", "type": "range", "label": "Columns", "min": 2, "max": 4, "step": 1, "default": 4 }',
          '  ],',
          '  "blocks": [{ "type": "product-card", "name": "Product card" }],',
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
          ],
          blocks: [
            {
              type: 'product-card',
              name: 'Product card',
            },
          ],
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
          '    { "id": "heading", "type": "text", "label": "Heading", "default": "A brand-new Liquid section" },',
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
              default: 'A brand-new Liquid section',
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
      category: {
        path: 'blocks/category.liquid',
        source: [
          '<a class="lb-category-card" href="/collections/{{ block.settings.slug }}" data-block-id="{{ block.id }}">',
          '  <strong>{{ block.settings.name }}</strong>',
          '  <span>{{ block.settings.tagline }}</span>',
          '</a>',
        ].join('\n'),
        schema: {
          name: 'Category',
          settings: [
            {
              id: 'name',
              type: 'text',
              label: 'Name',
            },
            {
              id: 'slug',
              type: 'text',
              label: 'Slug',
            },
            {
              id: 'tagline',
              type: 'text',
              label: 'Tagline',
            },
          ],
        },
      },
      'product-card': {
        path: 'blocks/product-card.liquid',
        source: [
          '<article class="lb-product-card" data-block-id="{{ block.id }}">',
          '  <a href="{{ block.settings.url }}">',
          '    <strong>{{ block.settings.title }}</strong>',
          '    <span>{{ block.settings.price }}</span>',
          '  </a>',
          '</article>',
        ].join('\n'),
        schema: {
          name: 'Product card',
          settings: [
            {
              id: 'title',
              type: 'text',
              label: 'Title',
            },
            {
              id: 'price',
              type: 'text',
              label: 'Price',
            },
            {
              id: 'url',
              type: 'url',
              label: 'Product URL',
            },
          ],
        },
      },
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
              default: 'Zero storefront code change',
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
