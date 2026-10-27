import { z } from 'zod';
import { DEFAULT_THEME_SETTINGS, type ThemeSettings } from './theme-settings';
import { SlugSchema, UuidSchema } from '@letbuyy/shared-types';
import { BUILT_IN_SECTION_SCHEMAS } from './built-in-section-schemas';
import { ThemeEditorTemplateKeySchema } from './template-registry';
import { validateFieldValue as validateEditorFieldValue, resolveFieldOptions, isFieldVisible, type ExtendedSchemaField, type ExtendedSectionSchema, type ExtendedThemeSettingsSchema, type ExtendedSchemaField as SchemaField, type ExtendedSectionSchema as SectionSchema, type ExtendedThemeSettingsSchema as ThemeSettingsSchema } from './schema-field-extensions';
import {
  getDefaultStorefrontThemeTemplate,
  hasRenderableThemeTemplate,
} from './theme-registry';
import { localizeThemeTemplateConfig, LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';

export * from './theme-registry';
export * from './theme-settings';
export * from './built-in-section-schemas';
export * from './execution-runtime';
export * from './theme-governance';
export * from './theme-bundle';
export * from './theme-renderer';
export * from './order-receipt-view';
export * from './portable-to-liquid';
export * from './theme-presets';
export * from './industry-experience-map';
export * from './theme-bundle-core';
export * from './first-party-theme-catalog';
export * from './playfield-theme';
export * from './circuit-theme';
export * from './pantry-theme';
export * from './habitat-theme';
export * from './kindred-theme';
export * from './madeyours-theme';
export * from './dewdrop-theme';
export * from './trailmark-theme';
export * from './marginalia-theme';
export * from './experience-fonts';
export * from './section-schema-migrations';
export * from './settings-schema-canonical';
// Phase U — Schema Field Extensions (ExtendedSchemaField + validation/default/visibility helpers)
export * from './schema-field-extensions';
// Phase N — Theme Document V2 (editor-facing stable-id view; lossless adapters)
export * from './theme-document';
// Phase V — Template Type Registry (canonical registry + alternate resolution + context isolation)
export * from './template-registry';
export * from './theme-document-migrations';
export * from './editor-bridge-protocol';
export * from './theme-sdk';
// Phase O — Complete Experience Design (section-type bridge + compositions + apply engine)
export * from './section-type-map';
export * from './experience-compositions';
export * from './experience-apply';
export * from './theme-artifact-exporter';
export * from './theme-linter';
export * from './theme-packager';
// Phase K — theme platform primitives
export * from './theme-version';
export * from './theme-upgrade';
export * from './theme-install';
export * from './theme-install-receipt';
// Phase Q — site-scoped theme library request contracts
export * from './theme-library-schemas';
export * from './theme-publish';
export * from './theme-analytics';
// Phase L — AI Theme Platform SDK (deterministic generative primitives + merchant facade)
export * from './theme-ai-sdk';
// Phase L individual modules — selective exports to avoid re-exporting names already
// provided by theme-ai-sdk (relativeLuminance/contrastRatio/meetsWcagAA, OptimizationReport,
// optimizeThemeBundle, MerchantProfile, MerchantExperienceResolution, selectExperienceForMerchant).
// New / unique Phase L exports:
export { generateColorSystem, meetsWcagAAA } from './ai-color-system';
export type { GeneratedColorSystem } from './ai-color-system';
export * from './ai-typography';
export * from './ai-layout';
export * from './ai-theme-generator';
export * from './ai-accessibility';
export { analyzeThemeOptimizations, collectLintErrors } from './ai-optimizer';
export type {
  OptimizationSuggestion,
  OptimizationSuggestionType,
  OptimizationSuggestionSeverity,
} from './ai-optimizer';
export { applyPersonalizationOverlay, applyPersonalizationOverlayToBundle } from './ai-personalization';
export type { SegmentTokens, PersonalizationResult } from './ai-personalization';
// Phase W — Dynamic Source Binding (descriptor type + tenant-safe resolver)
export * from './dynamic-source-binding';
// Phase Y — App-Block Model (typed reference, validation, settings filtering, NOT-CONNECTED constants)
export * from './app-block-model';
// Phase Z — Theme Markets & Localization (translation resolver + display currency, LANE A)
export * from './theme-locale';
// Phase AA — Custom CSS Sanitizer (Lane A): validateCustomCss / validateAndScopeCustomCss /
// buildScopedCustomCss / hasUnsafeCssUrlScheme / CUSTOM_CSS_MAX_BYTES.
// The gateway PATCH route and the editor UI import validateCustomCss from this barrel.
export * from './custom-css-sanitizer';
// Phase AB — Theme Safe Update Engine (Lane A): planThemeSafeUpdate / computeThemeUpdateDiff.
// Tenant-safe, deterministic update that preserves merchant-content + bindings across versions.
export * from './theme-safe-update';

// Phase AC — AI Customization Intent parser (deterministic): proposeThemeCustomization maps a
// STRUCTURED merchant intent to the Phase L primitives (WCAG-AA palette, known-font typography,
// parity sections, a11y fix) -> a validated, diffable, reversible proposal. Free-text NLU is the
// honestly NOT-CONNECTED model seam (MODEL_BOUNDARY). No fabricated model call.
export * from './ai-intent-parser';
// Phase AE — Theme Marketplace Partner-Submission Validation Contract
// validateThemeForMarketplace: pure, deterministic, fail-closed gate that
// composes all existing validators (K/AA/Y/N) for third-party theme submissions.
// NOT a live marketplace pipeline — frozen apps are untouched.
export * from './theme-marketplace-contract';

export type BuiltInSectionType =
  | 'header'
  | 'announcementBar'
  | 'heroBanner'
  | 'productDetail'
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
  /**
   * Phase T — nested child blocks (optional; absent on flat/legacy blocks).
   * Populated by the editor bridge when a block carries nested ThemeDocumentBlock.children.
   * RISK-DUAL-N01: mutating children mutates the INSTANCE tree, never block_definitions.
   */
  children?: BlockModel[];
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
  liquidRenderingCanary?: boolean;
  rendererEngine?: 'react' | 'liquid' | string;
  appBlocks?: unknown;
  releaseManifest?: Record<string, unknown>;
  // SUSTAINED-G2 — the merchant's Appearance-page custom CSS (sites.site_settings.custom_css),
  // raw/unscoped. Threaded through to LiquidRenderer.render() -> buildLiquidThemeHeadAssets(),
  // which is the single Phase-AA enforcement point that validates, scopes and sanitizes it.
  // Never pre-scope or pre-sanitize this value before it reaches that function.
  customCss?: string;
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
  replayed: boolean;
  current_version: number;
  saved_at: string;
  version: number;
  draft: {
    id: string;
    version: number;
    auto_saved_at: string;
  };
}

export interface ThemePublishResult {
  version: number;
  replayed: boolean;
  current_version: number;
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
  template_key: string;
}

export type ThemeTemplateRecord = Record<string, unknown>;

export interface ThemeTemplateReference {
  slug: string;
  config?: ThemeTemplateRecord | null;
  default_template?: ThemeTemplateRecord | null;
}

export interface ThemeTemplateValidationRuntime {
  sectionSchemas: Record<string, ExtendedSectionSchema>;
  settingsSchema: ExtendedThemeSettingsSchema;
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

function validateRequiredThemeFields(fields: Record<string, ExtendedSchemaField>, settings: ThemeTemplateRecord, path: string, issues: string[]) {
  for (const [key, field] of Object.entries(fields)) {
    if (field.required && isFieldVisible(field, settings) && !Object.hasOwn(settings, key)) validateThemeFieldValue(field, undefined, `${path}.${key}`, issues);
  }
}

function validateThemeFieldValue(field: ExtendedSchemaField, value: unknown, path: string, issues: string[], requiredVisible = true) {
  const descriptorIssue = validateEditorFieldValue({ ...field, required: field.required && requiredVisible }, value);
  if (descriptorIssue) { issues.push(field.type === 'color' && value ? `${path} must be a valid CSS color` : `${path}: ${descriptorIssue}`); return; }
  if (value === null || value === undefined || value === '') return;

  switch (field.type) {
    case 'toggle':
    case 'checkbox':
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
      if (!resolveFieldOptions(field).length && typeof value !== 'string') issues.push(`${path} must be a string`);
      return;
    case 'header':
    case 'paragraph':
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
  schema: ExtendedSectionSchema,
  settings: ThemeTemplateRecord,
  path: string,
  issues: string[],
) {
  const fieldSchemas = schema.settings_schema || {};
  const allowedKeys = new Set([
    ...Object.keys(fieldSchemas),
    ...Object.keys(asThemeRecord(schema.defaults)),
  ]);
  validateRequiredThemeFields(fieldSchemas, settings, path, issues);

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
    if (field) validateThemeFieldValue(field, value, `${path}.${key}`, issues, isFieldVisible(field, settings));
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
    validateRequiredThemeFields(blockSchema.fields, settings, `${path}[${index}].settings`, issues);
    for (const [key, value] of Object.entries(settings)) {
      const field = blockSchema.fields[key];
      if (!field) {
        issues.push(`${path}[${index}].settings.${key} is not defined by the ${type} block schema`);
        continue;
      }
      validateThemeFieldValue(field, value, `${path}[${index}].settings.${key}`, issues, isFieldVisible(field, settings));
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

  const settings = asThemeRecord(record.settings);
  validateRequiredThemeFields(blockSchema.fields, settings, `${path}.settings`, issues);
  for (const [key, value] of Object.entries(settings)) {
    const field = blockSchema.fields[key];
    if (!field) {
      issues.push(`${path}.settings.${key} is not defined by the ${type} block schema`);
      continue;
    }
    validateThemeFieldValue(field, value, `${path}.settings.${key}`, issues, isFieldVisible(field, settings));
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
  validateRequiredThemeFields(fields, settings, 'themeSettings', issues);

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

    validateThemeFieldValue(field, value, `themeSettings.${key}`, issues, isFieldVisible(field, settings));
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
  if (existingThemeId && existingThemeId !== theme.slug && LiquidThemePackageBundleSchema.safeParse(fallback.liquidBundle).success) {
    // Installing a different Liquid package uses that package's settings and
    // instance maps. Outgoing React-only keys/blocks are not import overrides;
    // its existing draft/release remains owned by the outgoing theme instance.
    return mergeThemeIdentity({ ...fallback }, theme);
  }
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

  const { settingsSchema } = input.runtime;
  const sectionSchemas = {
    ...BUILT_IN_SECTION_SCHEMAS,
    ...input.runtime.sectionSchemas,
  };
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
  // The Liquid bundle + release manifest are first-party, schema-validated artifacts
  // (LiquidThemePackageBundleSchema) sanitized at render — they must NOT pass through the React-template
  // safe-JSON validator, whose safe-key + 5000-char limits reject Liquid template keys (e.g.
  // "customers/login") and section sources. Validate everything else.
  const safeTemplateConfig: ThemeTemplateRecord = { ...input.templateConfig };
  delete safeTemplateConfig.liquidBundle;
  delete safeTemplateConfig.releaseManifest;
  delete safeTemplateConfig.rendererEngine;
  validateSafeThemeJson(safeTemplateConfig, 'template_config', issues);

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
  template_key: ThemeEditorTemplateKeySchema.default('index'),
});

export const InstallThemeSchema = z.object({
  store_id: UuidSchema,
  config_overrides: z.record(z.string(), z.unknown()).default({}),
  expected_version: z.string().min(1).max(40).refine(
    value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
    'Choose the exact catalog version',
  ).optional(),
  expected_package_id: UuidSchema.optional(),
  expected_package_version_id: UuidSchema.optional(),
});

const ThemeDraftIntentKeySchema = z.string().min(8).max(200).refine(
  (value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value),
  'Use a stable retry key without surrounding whitespace or control characters',
);

export const SaveThemeDraftSchema = z.object({
  store_id: UuidSchema,
  template_key: ThemeEditorTemplateKeySchema.default('index'),
  template_config: z.record(z.string(), z.unknown()),
  base_version: z.number().int().nonnegative().max(2_147_483_646),
  idempotency_key: ThemeDraftIntentKeySchema,
  client: z.enum(['admin-web', 'flutter-builder', 'api']).default('api'),
});

export const ReorderThemeDraftSchema = SaveThemeDraftSchema.omit({ template_config: true }).extend({
  section_order: z.array(z.string().min(1).max(200)).max(500).refine(
    (ids) => new Set(ids).size === ids.length, 'Section IDs must be distinct',
  ),
});

export const PublishThemeSchema = z.object({
  store_id: UuidSchema,
  template_key: ThemeEditorTemplateKeySchema.default('index'),
  template_config: z.record(z.string(), z.unknown()).optional(),
  base_version: z.number().int().positive().max(2_147_483_646),
  make_store_live: z.boolean().default(true),
  publish_message: z.string().max(500).optional(),
  idempotency_key: ThemeDraftIntentKeySchema,
});

export const DiscardThemeDraftSchema = ThemeStoreQuerySchema.extend({
  base_version: z.number().int().nonnegative().max(2_147_483_646),
  idempotency_key: ThemeDraftIntentKeySchema,
});

export const PreviewTokenSchema = z.object({
  store_id: UuidSchema,
  template_key: ThemeEditorTemplateKeySchema.default('index'),
  ttl_seconds: z.number().int().min(60).max(3600).default(900),
});

export const RollbackThemeReleaseSchema = z.object({
  store_id: UuidSchema,
  make_store_live: z.boolean().default(true),
  rollback_message: z.string().max(500).optional(),
  expected_current_release_id: UuidSchema,
  idempotency_key: ThemeDraftIntentKeySchema,
});

export const ValidateThemeDocumentSchema = z.object({
  store_id: UuidSchema,
  theme_document: z.record(z.string(), z.unknown()),
  bundle: z.record(z.string(), z.unknown()).optional(),
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

export const ThemeReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(140),
  content: z.string().trim().min(10).max(4000),
});

export const ThemeReviewReplySchema = z.object({
  developer_reply: z.string().trim().min(3).max(2000),
});

export const ThemeReportSchema = z.object({
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(2000).optional(),
});

export const ThemeRefundRequestSchema = z.object({
  purchase_id: UuidSchema,
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const ThemeDownloadPlatformSchema = z.enum(['letbuyy', 'wordpress', 'html', 'react']);

export const ThemeMarketplaceSettingsSchema = z.object({
  display_name: z.string().trim().max(120).optional(),
  support_email: z.string().trim().email().max(240).optional(),
  notification_preferences: z.record(z.string(), z.unknown()).default({}),
  saved_filters: z.record(z.string(), z.unknown()).default({}),
});

export const ThemeSavedSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  query: z.record(z.string(), z.unknown()).default({}),
  alerts_enabled: z.boolean().default(false),
});

export const ThemeDeveloperListingSchema = z.object({
  slug: SlugSchema,
  name: z.string().trim().min(3).max(120),
  short_description: z.string().trim().min(10).max(280),
  long_description: z.string().trim().max(5000).optional(),
  category: z.enum(['store', 'portfolio', 'resume', 'landing', 'saas']),
  industries: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  supported_platforms: z.array(ThemeDownloadPlatformSchema).min(1).default(['letbuyy']),
  screenshots: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  pricing: z.record(z.string(), z.unknown()).default({}),
  license_tiers: z.array(z.record(z.string(), z.unknown())).max(10).default([]),
  bundle_manifest: z.record(z.string(), z.unknown()).default({}),
  agreement_accepted: z.boolean().default(false),
  submit: z.boolean().default(false),
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
export type ReorderThemeDraftInput = z.infer<typeof ReorderThemeDraftSchema>;
export type PublishThemeInput = z.infer<typeof PublishThemeSchema>;
export type PreviewTokenInput = z.infer<typeof PreviewTokenSchema>;
export type RollbackThemeReleaseInput = z.infer<typeof RollbackThemeReleaseSchema>;
export type ValidateThemeDocumentInput = z.infer<typeof ValidateThemeDocumentSchema>;
export type ThemePurchaseOrderInput = z.infer<typeof ThemePurchaseOrderSchema>;
export type ThemePurchaseVerifyInput = z.infer<typeof ThemePurchaseVerifySchema>;
export type ThemeReviewCreateInput = z.infer<typeof ThemeReviewCreateSchema>;
export type ThemeReviewReplyInput = z.infer<typeof ThemeReviewReplySchema>;
export type ThemeReportInput = z.infer<typeof ThemeReportSchema>;
export type ThemeRefundRequestInput = z.infer<typeof ThemeRefundRequestSchema>;
export type ThemeDownloadPlatform = z.infer<typeof ThemeDownloadPlatformSchema>;
export type ThemeMarketplaceSettingsInput = z.infer<typeof ThemeMarketplaceSettingsSchema>;
export type ThemeSavedSearchInput = z.infer<typeof ThemeSavedSearchSchema>;
export type ThemeDeveloperListingInput = z.infer<typeof ThemeDeveloperListingSchema>;

export type ThemeCategory = 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
export type ThemePricingType = 'free' | 'one_time' | 'subscription';

export interface ThemeQualityReport {
  measured_at?: string;
  source?: string;
  url?: string;
  lighthouse_performance?: number;
  lighthouse_accessibility?: number;
  status?: 'measured' | 'not_measured' | 'ci_required' | string;
}

export interface ThemeCompatibilityMatrix {
  browsers?: string[];
  locales?: string[];
  platforms?: string[];
  minimum_viewport?: string;
}

export interface ThemeChangelogEntry {
  version: string;
  released_at?: string;
  changes: string[];
}

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
  performance_report?: ThemeQualityReport | null;
  accessibility_report?: ThemeQualityReport | null;
  compatibility?: ThemeCompatibilityMatrix | null;
  changelog?: ThemeChangelogEntry[];
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
  purchase_id?: string | null;
  rating: number;
  title: string;
  content: string;
  is_verified_purchase: boolean;
  status: 'published' | 'pending' | 'rejected';
  created_at: string;
  updated_at?: string;
  developer_reply?: string | null;
  developer_replied_at?: string | null;
  user_name?: string;
  user_avatar?: string;
}

export interface ThemeReviewSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ThemeCollection {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  collection_type: 'manual' | 'auto';
  rule: Record<string, unknown>;
  themes?: Record<string, unknown>[];
}

export interface ThemeAuthorProfile {
  id: string;
  handle: string;
  display_name: string;
  bio?: string | null;
  support_email?: string | null;
  website_url?: string | null;
  avatar_url?: string | null;
  verification_status: 'unverified' | 'verified' | 'suspended';
  support_sla?: string | null;
  aggregate_rating: number;
  review_count: number;
  themes?: Record<string, unknown>[];
}

export interface ThemeDownloadArtifact {
  id: string;
  theme_id: string;
  platform: ThemeDownloadPlatform;
  file_name: string;
  size_bytes: number | null;
  checksum_sha256?: string | null;
  delivery_status: 'available' | 'disabled';
  signed_url?: string | null;
  expires_at?: string | null;
}

export interface ThemePurchaseReceipt {
  id: string;
  purchase_id: string;
  receipt_number: string;
  invoice_number?: string | null;
  license_key?: string | null;
  amount_inr: number;
  currency: 'INR' | string;
  gst_rate: number;
  gst_amount_inr: number;
  buyer_gstin?: string | null;
  seller_gstin?: string | null;
  invoice_json: Record<string, unknown>;
  receipt_status: 'issued' | 'void';
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
  layout?: string;
  tag?: string;
  feature?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  sort?: 'popular' | 'trending' | 'rating' | 'recent' | 'new' | 'name' | 'price_low' | 'price_high';
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

function themeAppearanceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Existing storefront presentation precedence, shared with verified checkout.
 * Template localization/defaults and merchant appearance remain single-sourced.
 * Custom CSS is deliberately outside this data-only presentation result. */
export function resolveStorefrontThemePresentation(rawTemplateConfig:Record<string,unknown>,appearanceSettings:Record<string,unknown>,themeId:string,storeLocale:string) {
    const fallbackTemplateConfig = getDefaultStorefrontThemeTemplate(themeId);
    const resolvedTemplateConfig: Record<string, unknown> = hasRenderableThemeTemplate(rawTemplateConfig)
        ? {
            ...rawTemplateConfig,
            themeId,
        }
        : {
            ...rawTemplateConfig,
            ...fallbackTemplateConfig,
            themeSettings: {
                ...fallbackTemplateConfig.themeSettings,
                ...themeAppearanceRecord(rawTemplateConfig.themeSettings),
            },
            themeId,
        };
    const templateConfig = localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale);
    const bundleSettingsData = themeAppearanceRecord(themeAppearanceRecord(templateConfig.config).settings_data);
    const appearanceOverrides: Record<string, unknown> = {};
    if (typeof appearanceSettings.primary_color === 'string' && appearanceSettings.primary_color) {
        appearanceOverrides.primaryColor = appearanceSettings.primary_color;
    }
    if (typeof appearanceSettings.font_family === 'string' && appearanceSettings.font_family) {
        appearanceOverrides.fontFamily = appearanceSettings.font_family;
        appearanceOverrides.headingFontFamily = appearanceSettings.font_family;
    }
    if (appearanceSettings.border_radius !== undefined && appearanceSettings.border_radius !== null && appearanceSettings.border_radius !== '') {
        const radius = Number(appearanceSettings.border_radius);
        if (Number.isFinite(radius)) appearanceOverrides.borderRadius = radius;
    }
    const themeSettingsRecord = {
        ...themeAppearanceRecord(bundleSettingsData.current),
        ...themeAppearanceRecord(templateConfig.themeSettings),
        ...appearanceOverrides,
    };
    const themeSettings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        ...themeSettingsRecord,
        primaryColor: themeSettingsRecord.primaryColor as string || DEFAULT_THEME_SETTINGS.primaryColor,
        secondaryColor: themeSettingsRecord.secondaryColor as string || DEFAULT_THEME_SETTINGS.secondaryColor,
        accentColor: themeSettingsRecord.accentColor as string || DEFAULT_THEME_SETTINGS.accentColor,
        // Liquid's editable bodyFontFamily is the canonical setting. The
        // presentation DTO retains fontFamily for existing React/checkout callers.
        fontFamily: (appearanceOverrides.fontFamily || themeSettingsRecord.bodyFontFamily || themeSettingsRecord.fontFamily) as string || DEFAULT_THEME_SETTINGS.fontFamily,
        borderRadius: themeSettingsRecord.borderRadius as number ?? DEFAULT_THEME_SETTINGS.borderRadius,
    };

    return { templateConfig, themeSettings };
}
