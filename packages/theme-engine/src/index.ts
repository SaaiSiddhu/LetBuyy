import { z } from 'zod';
import { SlugSchema, UuidSchema } from '@letbuyy/shared-types';
import {
  getDefaultStorefrontThemeTemplate,
  hasRenderableThemeTemplate,
  type SchemaField,
  type SectionSchema,
  type ThemeSettingsSchema,
} from './theme-registry';
import type { LiquidThemePackageBundle } from './theme-bundle';

export * from './theme-registry';
export * from './execution-runtime';
export * from './theme-bundle';
export * from './theme-renderer';

export type BuiltInSectionType =
  | 'header'
  | 'announcementBar'
  | 'heroBanner'
  | 'productGrid'
  | 'footer'
  | 'featuredProducts'
  | 'testimonials'
  | 'aboutSection'
  | 'collectionFilter'
  | 'newsletter'
  | 'contentPage'
  | 'instagramFeed'
  | 'faqAccordion'
  | 'videoHero'
  | 'trustBadges'
  | 'appBlockSlot'
  | 'categoryGrid'
  | 'brandMarquee'
  | 'portfolioGrid'
  | 'servicesGrid'
  | 'skillsSection'
  | 'experienceTimeline'
  | 'contactForm'
  | 'ctaSection';

export type SectionType = BuiltInSectionType | (string & {});
export type LegacySectionType = 'hero' | 'product_grid' | 'featured_collection' | 'newsletter' | 'header' | 'footer';

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  headingFontFamily: string;
  borderRadius: number;
  enableAnimations: boolean;
  enableShadows: boolean;
  isDark?: boolean;
  surfaceColor?: string;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: '#00B3B3',
  secondaryColor: '#008080',
  accentColor: '#A4E500',
  backgroundColor: '#FFFFFF',
  textColor: '#1A1A2E',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  borderRadius: 12,
  enableAnimations: true,
  enableShadows: true,
  isDark: false,
  surfaceColor: '#F9FAFB',
};

export interface SectionModel {
  id: string;
  type: SectionType;
  order: number;
  rendererKey?: string;
  schemaVersion?: string;
  settings: Record<string, unknown>;
  blocks?: BlockModel[];
  isVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockModel {
  id: string;
  type: string;
  order: number;
  rendererKey?: string;
  schemaVersion?: string;
  settings: Record<string, unknown>;
  isVisible: boolean;
}

export interface StorefrontTemplateConfig {
  id?: string;
  type?: string;
  layoutKey?: string;
  sections: SectionModel[];
}

export interface StorefrontSectionGroupConfig {
  id?: string;
  role?: 'header' | 'footer' | 'aside' | 'custom';
  sections: SectionModel[];
}

export interface StoreTemplateConfig {
  storeId?: string;
  themeId: string;
  releaseId?: string;
  releaseVersion?: number;
  releasePublishedAt?: string;
  engineVersion?: string;
  themeSettings: ThemeSettings;
  sections: SectionModel[];
  sectionGroups?: Record<string, StorefrontSectionGroupConfig>;
  templates?: Record<string, StorefrontTemplateConfig>;
  liquidBundle?: LiquidThemePackageBundle;
  appBlocks?: unknown;
  releaseManifest?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeRelease {
  id: string;
  store_id: string;
  theme_id: string;
  release_version: number;
  release_status: 'published' | 'superseded' | 'rolled_back';
  is_current: boolean;
  release_config: Record<string, unknown>;
  source_draft_id?: string | null;
  source_draft_version?: number | null;
  publish_message?: string | null;
  published_by?: string | null;
  published_at: string;
  rollback_of_release_id?: string | null;
}

export interface ThemeEditorPayload {
  store: {
    id: string;
    name?: string;
    subdomain?: string;
    status?: string;
  };
  theme: {
    id: string;
    slug: string;
    name: string;
    renderer_key: string;
  };
  template_config: Record<string, unknown>;
  draft: {
    exists: boolean;
    updated_at: string | null;
    version: number;
  };
  release: {
    id: string;
    version: number;
    published_at: string;
  } | null;
  schemas: {
    sections: Record<string, unknown>;
    settings: Record<string, unknown>;
  };
  version: number;
}

export interface ThemeDraftSaveResult {
  saved_at: string;
  version: number;
  draft: {
    id: string;
    version: number;
    auto_saved_at: string;
  };
}

export interface ThemePublishResult {
  store: {
    id: string;
    status: string;
    theme_id: string;
    current_theme_release_id?: string;
    storefront_release_version?: number;
    updated_at?: string;
  } | null;
  theme: {
    id: string;
    slug: string;
    name: string;
  };
  release: {
    release_id: string;
    release_version: number;
    published_at: string;
  };
  published_at: string;
}

export interface ThemePreviewSessionResult {
  preview_session_id: string;
  preview_token: string;
  expires_at: string;
  draft_version: number;
}

export type ThemeTemplateRecord = Record<string, unknown>;

export interface ThemeTemplateReference {
  slug: string;
  config?: ThemeTemplateRecord | null;
  default_template?: ThemeTemplateRecord | null;
}

export interface ThemeTemplateValidationRuntime {
  sectionSchemas: Record<string, SectionSchema>;
  settingsSchema: ThemeSettingsSchema;
}

interface ThemeSectionConfig extends ThemeTemplateRecord {
  id?: string;
  type?: string;
  visible?: boolean;
  settings?: ThemeTemplateRecord | null;
  blocks?: unknown;
}

export function asThemeRecord(value: unknown): ThemeTemplateRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ThemeTemplateRecord)
    : {};
}

function hasThemeKeys(value: unknown): value is ThemeTemplateRecord {
  return Object.keys(asThemeRecord(value)).length > 0;
}

function isUnsafeThemeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized === '__proto__' ||
    normalized === 'prototype' ||
    normalized === 'constructor' ||
    normalized === 'dangerouslysetinnerhtml' ||
    normalized === 'innerhtml' ||
    normalized === 'outerhtml' ||
    normalized === 'srcdoc' ||
    normalized === 'script' ||
    /^on[a-z]/.test(normalized)
  );
}

function isUnsafeThemeUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('data:application/xhtml')
  );
}

function validateSafeThemeJson(value: unknown, path: string, issues: string[]) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    if (value.length > 100) {
      issues.push(`${path} exceeds the maximum array length`);
      return;
    }
    value.forEach((item, index) => validateSafeThemeJson(item, `${path}[${index}]`, issues));
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as ThemeTemplateRecord)) {
      if (isUnsafeThemeKey(key)) {
        issues.push(`${path}.${key} is not allowed`);
        continue;
      }
      validateSafeThemeJson(child, `${path}.${key}`, issues);
    }
    return;
  }

  if (typeof value === 'string' && value.length > 5000) {
    issues.push(`${path} exceeds the maximum text length`);
  }
}

function validateThemeFieldValue(field: SchemaField, value: unknown, path: string, issues: string[]) {
  if (value === null || value === undefined || value === '') return;

  switch (field.type) {
    case 'toggle':
      if (typeof value !== 'boolean') issues.push(`${path} must be a boolean`);
      return;
    case 'range':
    case 'number': {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) {
        issues.push(`${path} must be a number`);
        return;
      }
      if (typeof field.min === 'number' && numeric < field.min) {
        issues.push(`${path} must be at least ${field.min}`);
      }
      if (typeof field.max === 'number' && numeric > field.max) {
        issues.push(`${path} must be at most ${field.max}`);
      }
      return;
    }
    case 'select':
    case 'radio':
      if (typeof value !== 'string') {
        issues.push(`${path} must be a string`);
        return;
      }
      if (field.options && !field.options.includes(value)) {
        issues.push(`${path} must be one of: ${field.options.join(', ')}`);
      }
      return;
    case 'color':
      if (typeof value !== 'string') {
        issues.push(`${path} must be a color string`);
        return;
      }
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) && !/^rgba?\(/i.test(value)) {
        issues.push(`${path} must be a valid CSS color`);
      }
      return;
    case 'url':
    case 'image':
      if (typeof value !== 'string') {
        issues.push(`${path} must be a URL string`);
        return;
      }
      if (isUnsafeThemeUrl(value)) issues.push(`${path} contains an unsafe URL protocol`);
      return;
    default:
      if (typeof value !== 'string') {
        issues.push(`${path} must be text`);
        return;
      }
      if (typeof field.maxLength === 'number' && value.length > field.maxLength) {
        issues.push(`${path} must be ${field.maxLength} characters or less`);
      }
      if (isUnsafeThemeUrl(value)) issues.push(`${path} contains an unsafe URL protocol`);
  }
}

function validateThemeSectionSettings(
  schema: SectionSchema,
  settings: ThemeTemplateRecord,
  path: string,
  issues: string[],
) {
  const fieldSchemas = schema.settings_schema || {};
  const allowedKeys = new Set([
    ...Object.keys(fieldSchemas),
    ...Object.keys(asThemeRecord(schema.defaults)),
  ]);

  for (const [key, value] of Object.entries(settings)) {
    if (isUnsafeThemeKey(key)) {
      issues.push(`${path}.${key} is not allowed`);
      continue;
    }

    if (!allowedKeys.has(key)) {
      issues.push(`${path}.${key} is not defined by the ${schema.type} schema`);
      continue;
    }

    const field = fieldSchemas[key];
    if (field) validateThemeFieldValue(field, value, `${path}.${key}`, issues);
    validateSafeThemeJson(value, `${path}.${key}`, issues);
  }
}

function validateThemeBlocks(
  schema: SectionSchema,
  blocks: unknown,
  path: string,
  issues: string[],
) {
  if (blocks === undefined || blocks === null) return;
  if (!Array.isArray(blocks)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (blocks.length > 50) {
    issues.push(`${path} exceeds the maximum block count`);
    return;
  }

  const blockSchemas = schema.blocks_schema || {};
  blocks.forEach((block, index) => {
    const record = asThemeRecord(block);
    const type = typeof record.type === 'string' ? record.type : '';
    const blockSchema = blockSchemas[type];
    if (!blockSchema) {
      issues.push(`${path}[${index}].type is not defined by the ${schema.type} schema`);
      return;
    }

    const settings = asThemeRecord(record.settings);
    for (const [key, value] of Object.entries(settings)) {
      const field = blockSchema.fields[key];
      if (!field) {
        issues.push(`${path}[${index}].settings.${key} is not defined by the ${type} block schema`);
        continue;
      }
      validateThemeFieldValue(field, value, `${path}[${index}].settings.${key}`, issues);
      validateSafeThemeJson(value, `${path}[${index}].settings.${key}`, issues);
    }
  });
}

function validateThemeBlock(
  schema: SectionSchema,
  block: unknown,
  path: string,
  issues: string[],
) {
  const record = asThemeRecord(block);
  if (!hasThemeKeys(record)) {
    issues.push(`${path} must be an object`);
    return;
  }

  const type = typeof record.type === 'string' ? record.type : '';
  const blockSchema = schema.blocks_schema?.[type];
  if (!blockSchema) {
    issues.push(`${path}.type is not defined by the ${schema.type} schema`);
    return;
  }

  if (record.disabled !== undefined && typeof record.disabled !== 'boolean') {
    issues.push(`${path}.disabled must be a boolean`);
  }

  for (const [key, value] of Object.entries(asThemeRecord(record.settings))) {
    const field = blockSchema.fields[key];
    if (!field) {
      issues.push(`${path}.settings.${key} is not defined by the ${type} block schema`);
      continue;
    }
    validateThemeFieldValue(field, value, `${path}.settings.${key}`, issues);
    validateSafeThemeJson(value, `${path}.settings.${key}`, issues);
  }
}

function validateThemeSection(
  section: unknown,
  sectionSchemas: Record<string, SectionSchema>,
  path: string,
  issues: string[],
) {
  const record = asThemeRecord(section) as ThemeSectionConfig;
  if (!hasThemeKeys(record)) {
    issues.push(`${path} must be an object`);
    return;
  }

  const type = typeof record.type === 'string' ? record.type : '';
  const schema = sectionSchemas[type];
  if (!schema) {
    issues.push(`${path}.type "${type || 'unknown'}" is not registered for this theme`);
    return;
  }

  if (record.id !== undefined && (typeof record.id !== 'string' || record.id.length > 100)) {
    issues.push(`${path}.id must be a short string`);
  }

  if (record.visible !== undefined && typeof record.visible !== 'boolean') {
    issues.push(`${path}.visible must be a boolean`);
  }

  validateThemeSectionSettings(schema, asThemeRecord(record.settings), `${path}.settings`, issues);
  validateThemeBlocks(schema, record.blocks, `${path}.blocks`, issues);
  validateSafeThemeJson(record, path, issues);
}

function validatePortableThemeSection(
  section: unknown,
  sectionSchemas: Record<string, SectionSchema>,
  sectionDefinitions: ThemeTemplateRecord,
  path: string,
  issues: string[],
) {
  const record = asThemeRecord(section) as ThemeSectionConfig & { disabled?: unknown; block_order?: unknown };
  if (!hasThemeKeys(record)) {
    issues.push(`${path} must be an object`);
    return;
  }

  const type = typeof record.type === 'string' ? record.type : '';
  const definition = asThemeRecord(sectionDefinitions[type]);
  const rendererKey = typeof definition.renderer_key === 'string' ? definition.renderer_key : '';
  const schema = sectionSchemas[type] || sectionSchemas[rendererKey];
  if (!schema) {
    issues.push(`${path}.type "${type || 'unknown'}" is not registered for this theme`);
    return;
  }

  if (record.disabled !== undefined && typeof record.disabled !== 'boolean') {
    issues.push(`${path}.disabled must be a boolean`);
  }

  validateThemeSectionSettings(schema, asThemeRecord(record.settings), `${path}.settings`, issues);

  const blocks = asThemeRecord(record.blocks);
  if (Object.keys(blocks).length > 50) {
    issues.push(`${path}.blocks exceeds the maximum block count`);
  }

  for (const [blockId, block] of Object.entries(blocks)) {
    validateThemeBlock(schema, block, `${path}.blocks.${blockId}`, issues);
  }

  if (Array.isArray(record.block_order)) {
    const blockIds = new Set(Object.keys(blocks));
    for (const blockId of record.block_order) {
      if (typeof blockId !== 'string' || !blockIds.has(blockId)) {
        issues.push(`${path}.block_order references missing block "${String(blockId)}"`);
      }
    }
  } else if (record.block_order !== undefined) {
    issues.push(`${path}.block_order must be an array`);
  }

  validateSafeThemeJson(record, path, issues);
}

function validateThemeSettings(
  settingsSchema: ThemeSettingsSchema,
  settings: ThemeTemplateRecord,
  issues: string[],
) {
  const settingsGroups = settingsSchema.settings ?? {};
  const fields = Object.values(settingsGroups).reduce<Record<string, SchemaField>>((acc, group) => {
    return { ...acc, ...(group.fields || {}) };
  }, {});

  for (const [key, value] of Object.entries(settings)) {
    if (isUnsafeThemeKey(key)) {
      issues.push(`themeSettings.${key} is not allowed`);
      continue;
    }

    const field = fields[key];
    if (!field) {
      issues.push(`themeSettings.${key} is not defined by the theme settings schema`);
      continue;
    }

    validateThemeFieldValue(field, value, `themeSettings.${key}`, issues);
    validateSafeThemeJson(value, `themeSettings.${key}`, issues);
  }
}

function collectTemplateSettings(templateConfig: ThemeTemplateRecord): ThemeTemplateRecord {
  const configSettings = asThemeRecord(asThemeRecord(asThemeRecord(templateConfig.config).settings_data).current);
  const rootSettings = asThemeRecord(asThemeRecord(templateConfig.settings_data).current);

  return {
    ...configSettings,
    ...rootSettings,
    ...asThemeRecord(templateConfig.themeSettings),
  };
}

function validateLegacySectionSlots(
  sections: ThemeTemplateRecord,
  sectionSchemas: Record<string, SectionSchema>,
  issues: string[],
) {
  const sectionKeys = Object.keys(sections);

  for (const key of sectionKeys) {
    if (!['header', 'footer', 'template'].includes(key)) {
      issues.push(`sections.${key} is not a supported section slot`);
    }
  }

  if (sections.header !== undefined) {
    validateThemeSection(sections.header, sectionSchemas, 'sections.header', issues);
  }

  if (sections.footer !== undefined) {
    validateThemeSection(sections.footer, sectionSchemas, 'sections.footer', issues);
  }

  if (sections.template !== undefined) {
    if (!Array.isArray(sections.template)) {
      issues.push('sections.template must be an array');
    } else if (sections.template.length > 50) {
      issues.push('sections.template exceeds the maximum section count');
    } else {
      sections.template.forEach((section, index) => {
        validateThemeSection(section, sectionSchemas, `sections.template[${index}]`, issues);
      });
    }
  }
}

function validatePortableTemplates(
  templates: ThemeTemplateRecord,
  sectionSchemas: Record<string, SectionSchema>,
  sectionDefinitions: ThemeTemplateRecord,
  issues: string[],
) {
  for (const [templateKey, template] of Object.entries(templates)) {
    const templateRecord = asThemeRecord(template);
    const sections = asThemeRecord(templateRecord.sections);
    const sectionIds = new Set(Object.keys(sections));

    if (sectionIds.size > 80) {
      issues.push(`templates.${templateKey}.sections exceeds the maximum section count`);
      continue;
    }

    for (const [sectionId, section] of Object.entries(sections)) {
      validatePortableThemeSection(section, sectionSchemas, sectionDefinitions, `templates.${templateKey}.sections.${sectionId}`, issues);
    }

    if (Array.isArray(templateRecord.order)) {
      for (const sectionId of templateRecord.order) {
        if (typeof sectionId !== 'string' || !sectionIds.has(sectionId)) {
          issues.push(`templates.${templateKey}.order references missing section "${String(sectionId)}"`);
        }
      }
    } else if (templateRecord.order !== undefined) {
      issues.push(`templates.${templateKey}.order must be an array`);
    }
  }
}

export function getThemeDefaultTemplate(theme: ThemeTemplateReference): ThemeTemplateRecord {
  const config = asThemeRecord(theme.config);
  const defaultTemplate = asThemeRecord(theme.default_template);
  const configDefault = asThemeRecord(config.default_template);

  if (Object.keys(defaultTemplate).length > 0) return defaultTemplate;
  if (Object.keys(configDefault).length > 0) return configDefault;

  return getDefaultStorefrontThemeTemplate(theme.slug, config) as unknown as ThemeTemplateRecord;
}

export function mergeThemeIdentity(
  templateConfig: ThemeTemplateRecord,
  theme: Pick<ThemeTemplateReference, 'slug'>,
): ThemeTemplateRecord {
  return {
    ...templateConfig,
    themeId: theme.slug,
  };
}

export function resolveRenderableThemeTemplateConfig(
  templateConfig: unknown,
  theme: ThemeTemplateReference,
): ThemeTemplateRecord {
  const existing = asThemeRecord(templateConfig);
  const existingThemeId = typeof existing.themeId === 'string' ? existing.themeId : null;

  if (hasRenderableThemeTemplate(existing) && (!existingThemeId || existingThemeId === theme.slug)) {
    return mergeThemeIdentity(existing, theme);
  }

  const fallback = getThemeDefaultTemplate(theme);
  return {
    ...existing,
    ...fallback,
    themeSettings: {
      ...asThemeRecord(fallback.themeSettings),
      ...asThemeRecord(existing.themeSettings),
    },
    themeId: theme.slug,
  };
}

export function collectThemeTemplateValidationIssues(input: {
  templateConfig: ThemeTemplateRecord;
  runtime: ThemeTemplateValidationRuntime;
  themeSlug: string;
  maxSerializedLength?: number;
}): string[] {
  const issues: string[] = [];
  const serialized = JSON.stringify(input.templateConfig);
  const maxLength = input.maxSerializedLength ?? 256_000;

  if (serialized.length > maxLength) {
    issues.push('Theme template exceeds the maximum allowed size');
    return issues;
  }

  if (typeof input.templateConfig.themeId === 'string' && input.templateConfig.themeId !== input.themeSlug) {
    issues.push(`themeId must match ${input.themeSlug}`);
  }

  const { sectionSchemas, settingsSchema } = input.runtime;
  const sections = asThemeRecord(input.templateConfig.sections);
  const templates = asThemeRecord(input.templateConfig.templates);
  const hasPortableTemplates = Object.keys(templates).length > 0;
  const hasLegacySlots = ['header', 'footer', 'template'].some((key) => sections[key] !== undefined);

  if (hasLegacySlots || !hasPortableTemplates) {
    validateLegacySectionSlots(sections, sectionSchemas, issues);
  }

  if (hasPortableTemplates) {
    validatePortableTemplates(templates, sectionSchemas, sections, issues);
  }

  validateThemeSettings(settingsSchema, collectTemplateSettings(input.templateConfig), issues);
  validateSafeThemeJson(input.templateConfig, 'template_config', issues);

  return issues;
}

export interface HeroBannerSettings {
  image: string;
  heading: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: 'primary' | 'secondary' | 'outline';
  overlay: number;
  overlayColor: string;
  height: 'full' | 'large' | 'medium' | 'small';
  textAlign: 'left' | 'center' | 'right';
  textPosition: 'top' | 'center' | 'bottom';
  animation: 'none' | 'fade' | 'slide' | 'zoom';
}

export interface ProductGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
  columnsTablet?: number;
  columnsMobile?: number;
  rows?: number;
  showTitle: boolean;
  showPrice: boolean;
  showRating: boolean;
  showAddToCart: boolean;
  productIds?: string[];
  sortBy?: 'newest' | 'price_low' | 'price_high' | 'popular';
  cardStyle?: 'standard' | 'minimal' | 'detailed';
}

export interface HeaderSettings {
  behavior: 'sticky' | 'scroll' | 'hide-on-scroll';
  storeName?: string;
  logoPlacement: 'left' | 'center';
  logoUrl?: string;
  displayMode: 'logo' | 'name' | 'both';
  logoHeight?: number;
  navPlacement: 'left' | 'right';
  navPages: HeaderNavPage[];
  showSearch: boolean;
  showCart: boolean;
  showAccount: boolean;
  sticky?: boolean;
  transparent?: boolean;
  height?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  textColor?: string;
}

export interface HeaderNavPage {
  id: string;
  label: string;
  href: string;
  isDefault: boolean;
  isVisible: boolean;
  openInNewTab?: boolean;
  children?: HeaderNavPage[];
  targetType?: string;
  targetResourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FooterSettings {
  columns: number;
  showLogo: boolean;
  showNewsletter: boolean;
  showSocial: boolean;
  showPaymentIcons: boolean;
  copyrightText?: string;
  backgroundColor?: string;
  textColor?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  youtubeUrl?: string;
  contactEmail?: string;
}

export interface TestimonialsSettings {
  title: string;
  subtitle?: string;
  layout: 'carousel' | 'grid' | 'masonry';
  autoplay: boolean;
  showRating: boolean;
  showImage: boolean;
}

export interface AboutSectionSettings {
  heading: string;
  content: string;
  image?: string;
  imagePosition: 'left' | 'right';
  showButton: boolean;
  buttonText?: string;
  buttonLink?: string;
}

export interface PortfolioGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
  layout: 'grid' | 'masonry';
}

export interface ServicesGridSettings {
  title: string;
  subtitle?: string;
  columns: number;
}

export interface SkillsSectionSettings {
  title: string;
  subtitle?: string;
  layout: 'bars' | 'tags';
}

export interface ExperienceTimelineSettings {
  title: string;
  subtitle?: string;
}

export interface ContactFormSettings {
  title: string;
  subtitle?: string;
  email?: string;
  showPhone?: boolean;
  showAddress?: boolean;
}

export interface CtaSectionSettings {
  heading: string;
  subheading?: string;
  ctaText: string;
  ctaLink: string;
  style: 'primary' | 'gradient' | 'dark';
}

export const ThemeSlugParamSchema = z.object({
  slug: SlugSchema,
});

export const ThemeStoreQuerySchema = z.object({
  store_id: UuidSchema,
});

export const InstallThemeSchema = z.object({
  store_id: UuidSchema,
  config_overrides: z.record(z.string(), z.unknown()).default({}),
});

export const SaveThemeDraftSchema = z.object({
  store_id: UuidSchema,
  template_config: z.record(z.string(), z.unknown()),
  base_version: z.number().int().positive().optional(),
  client: z.enum(['admin-web', 'flutter-builder', 'api']).default('api'),
});

export const PublishThemeSchema = z.object({
  store_id: UuidSchema,
  base_version: z.number().int().positive().optional(),
  make_store_live: z.boolean().default(true),
  publish_message: z.string().max(500).optional(),
});

export const PreviewTokenSchema = z.object({
  store_id: UuidSchema,
  ttl_seconds: z.number().int().min(60).max(3600).default(900),
});

export const RollbackThemeReleaseSchema = z.object({
  store_id: UuidSchema,
  make_store_live: z.boolean().default(true),
  rollback_message: z.string().max(500).optional(),
});

export const ThemePurchaseOrderSchema = z.object({
  currency: z.enum(['INR']).default('INR'),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const ThemePurchaseVerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
});

export interface ThemeEngineRenderContext {
  site_id: string;
  route_type: string;
  template_key?: string;
  preview_token?: string;
  release_id?: string;
}

export interface ThemeHydrationContract {
  section_id: string;
  renderer_key: string;
  data_dependencies: string[];
  client_required: boolean;
}

export type InstallThemeInput = z.infer<typeof InstallThemeSchema>;
export type SaveThemeDraftInput = z.infer<typeof SaveThemeDraftSchema>;
export type PublishThemeInput = z.infer<typeof PublishThemeSchema>;
export type PreviewTokenInput = z.infer<typeof PreviewTokenSchema>;
export type RollbackThemeReleaseInput = z.infer<typeof RollbackThemeReleaseSchema>;
export type ThemePurchaseOrderInput = z.infer<typeof ThemePurchaseOrderSchema>;
export type ThemePurchaseVerifyInput = z.infer<typeof ThemePurchaseVerifySchema>;

export type ThemeCategory = 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
export type ThemePricingType = 'free' | 'one_time' | 'subscription';

export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string;
  long_description: string;
  category: ThemeCategory;
  industry: string[];
  theme_preset_id: string;
  version: string;
  is_active: boolean;
  letbuyy_pricing_type: ThemePricingType;
  letbuyy_price_usd: number;
  letbuyy_price_inr: number;
  wordpress_price_usd: number;
  shopify_price_usd: number;
  html_price_usd: number;
  react_price_usd: number;
  thumbnail_url: string;
  preview_url: string;
  screenshots: string[];
  demo_url: string;
  customizable_sections: Record<string, unknown>;
  color_presets: Array<{ name: string; colors: Record<string, string> }>;
  font_options: string[];
  author_id: string | null;
  author_name: string;
  tags: string[];
  features: string[];
  supported_platforms: string[];
  rating: number;
  review_count: number;
  install_count: number;
  download_count: number;
  purchase_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThemePurchase {
  id: string;
  user_id: string;
  theme_id: string;
  payment_provider: 'stripe' | 'razorpay';
  payment_id: string;
  amount_usd: number;
  amount_inr: number;
  currency: string;
  license_key: string;
  license_type: 'single' | 'multi' | 'unlimited';
  status: 'completed' | 'refunded' | 'pending';
  created_at: string;
}

export interface ThemeInstallation {
  id: string;
  site_id: string;
  theme_id: string;
  user_id: string;
  purchase_id: string | null;
  is_active: boolean;
  customizations: Record<string, unknown>;
  version_installed: string;
  installed_at: string;
  updated_at: string;
}

export interface ThemeReview {
  id: string;
  user_id: string;
  theme_id: string;
  rating: number;
  title: string;
  content: string;
  is_verified_purchase: boolean;
  status: 'published' | 'pending' | 'rejected';
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface ThemeFilters {
  category?: ThemeCategory;
  pricing?: ThemePricingType | 'paid';
  sort?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface ThemeSearchFilters {
  category?: string;
  pricingType?: string;
  siteType?: string;
  industry?: string;
  search?: string;
  sort?: 'popular' | 'rating' | 'recent' | 'name' | 'price_low' | 'price_high';
  limit?: number;
  offset?: number;
}

export interface ThemeSearchResult {
  themes: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
