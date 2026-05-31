import { z } from 'zod';

export const THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract';
export const THEME_BUNDLE_RENDERER_VERSION = '1.0.0';

export const THEME_BUNDLE_PATHS = {
  settingsSchema: 'config/settings_schema.json',
  settingsData: 'config/settings_data.json',
  templates: 'templates/*.json',
  sections: 'sections/manifest.json',
  blocks: 'blocks/definitions.json',
  locales: 'locales/*.json',
} as const;

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

export type ThemeBundle = z.infer<typeof ThemePackageBundleSchema>;
export type ThemePackageBundle = z.infer<typeof ThemePackageBundleSchema>;
export type ThemeBundleTemplate = z.infer<typeof ThemeBundleTemplateSchema>;
export type ThemeBundleTemplateSection = z.infer<typeof ThemeBundleTemplateSectionSchema>;
export type ThemeBundleTemplateBlock = z.infer<typeof ThemeBundleTemplateBlockSchema>;
export type ThemeBundleSectionDefinition = z.infer<typeof ThemeBundleSectionDefinitionSchema>;
export type ThemeBundleBlockDefinition = z.infer<typeof ThemeBundleBlockDefinitionSchema>;
export type ThemeBundleSettingsSchemaDefinition = z.infer<typeof ThemeBundleSettingsSchema>;
export type ThemeBundleSettingsData = z.infer<typeof ThemeBundleSettingsDataSchema>;

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

function formatThemeBundleIssues(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

export function buildThemePackagePersistencePayload(input: ThemePackageBundle): ThemePackagePersistencePayload {
  const bundle = parseThemePackageBundle(input);
  const rendererKeys = Array.from(new Set(Object.values(bundle.sections).map((section) => section.renderer_key)));

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
      section_schemas: bundle.sections,
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
    },
  });
}
