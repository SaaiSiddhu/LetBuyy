import type {
  SectionModel,
  StoreTemplateConfig,
  StorefrontSectionGroupConfig,
  StorefrontTemplateConfig,
} from './index';
import type { SectionSchema } from './theme-registry';
import { BUILT_IN_SECTION_SCHEMAS } from './built-in-section-schemas';

export type ThemeRendererGovernanceMode = 'warn' | 'enforce';
export type ThemeRendererRegistryAuditStatus = 'pass' | 'warn' | 'fail';

export const THEME_RENDERER_GOVERNANCE_DEFAULT_MODE: ThemeRendererGovernanceMode = 'warn';
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
export const THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20;
export const THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = {
  status: 'deferred',
  authority: 'ARB',
  reason: 'Liquid remains per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green.',
  defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED,
} as const;

export const THEME_LIQUID_PORTABLE_SECTION_PARITY = [
  { reactFile: 'about-section.tsx', rendererKey: 'core.about', liquidSectionType: 'about-section' },
  { reactFile: 'app-block-slot.tsx', rendererKey: 'apps.app-block-slot', liquidSectionType: 'app-block-slot' },
  { reactFile: 'banner-carousel.tsx', rendererKey: 'frozen.banner-carousel', liquidSectionType: 'banner-carousel' },
  { reactFile: 'brand-marquee.tsx', rendererKey: 'commerce.brand-marquee', liquidSectionType: 'brand-marquee' },
  { reactFile: 'category-grid.tsx', rendererKey: 'commerce.category-grid', liquidSectionType: 'category-grid' },
  { reactFile: 'contact-form.tsx', rendererKey: 'core.contact-form', liquidSectionType: 'contact-form' },
  { reactFile: 'cta-section.tsx', rendererKey: 'core.cta', liquidSectionType: 'cta-section' },
  { reactFile: 'experience-timeline.tsx', rendererKey: 'core.experience-timeline', liquidSectionType: 'experience-timeline' },
  { reactFile: 'featured-products.tsx', rendererKey: 'core.featured-products', liquidSectionType: 'featured-products' },
  { reactFile: 'hero.tsx', rendererKey: 'core.hero', liquidSectionType: 'hero-banner' },
  { reactFile: 'marquee.tsx', rendererKey: 'frozen.marquee', liquidSectionType: 'marquee' },
  { reactFile: 'newsletter.tsx', rendererKey: 'core.newsletter', liquidSectionType: 'newsletter-signup' },
  { reactFile: 'portfolio-grid.tsx', rendererKey: 'core.portfolio-grid', liquidSectionType: 'portfolio-grid' },
  { reactFile: 'product-detail-section.tsx', rendererKey: 'core.product-detail', liquidSectionType: 'product-detail' },
  { reactFile: 'product-grid.tsx', rendererKey: 'core.product-grid', liquidSectionType: 'product-grid' },
  { reactFile: 'rich-content-section.tsx', rendererKey: 'core.rich-content', liquidSectionType: 'rich-content' },
  { reactFile: 'services-grid.tsx', rendererKey: 'core.services-grid', liquidSectionType: 'services-grid' },
  { reactFile: 'skills-section.tsx', rendererKey: 'core.skills', liquidSectionType: 'skills-section' },
  { reactFile: 'testimonials.tsx', rendererKey: 'core.testimonials', liquidSectionType: 'testimonials' },
  { reactFile: 'trust-badges.tsx', rendererKey: 'commerce.trust-badges', liquidSectionType: 'trust-badges' },
] as const;

export type ThemeLiquidPortableSectionParityEntry = typeof THEME_LIQUID_PORTABLE_SECTION_PARITY[number];

export interface ThemeRendererRegistryAuditIssue {
  path: string;
  sectionId?: string;
  sectionType?: string;
  rendererKey?: string;
  severity: 'warning' | 'error';
  message: string;
}

export interface ThemeRendererRegistryAudit {
  mode: ThemeRendererGovernanceMode;
  status: ThemeRendererRegistryAuditStatus;
  unresolvedCount: number;
  warnings: ThemeRendererRegistryAuditIssue[];
  errors: ThemeRendererRegistryAuditIssue[];
}

export interface ThemeRendererRegistryAuditInput {
  templateConfig: StoreTemplateConfig;
  sectionSchemas?: Record<string, SectionSchema>;
  approvedRendererKeys?: readonly string[];
  mode?: ThemeRendererGovernanceMode;
}

export interface ThemeLiquidRenderingDecisionInput {
  templateConfig: StoreTemplateConfig;
  defaultEnabled?: boolean;
}

export interface ThemeSectionSchemaMigration {
  sectionType: string;
  fromVersion: string;
  toVersion: string;
  migrateSettings(settings: Record<string, unknown>, section: SectionModel): Record<string, unknown>;
}

export interface AppliedThemeSchemaMigration {
  sectionId: string;
  sectionType: string;
  fromVersion: string;
  toVersion: string;
  path: string;
}

export interface ThemeSchemaMigrationResult {
  templateConfig: StoreTemplateConfig;
  applied: AppliedThemeSchemaMigration[];
  warnings: string[];
}

function collectTemplateSections(templateConfig: StoreTemplateConfig): Array<{ path: string; section: SectionModel }> {
  const sections: Array<{ path: string; section: SectionModel }> = [];

  templateConfig.sections.forEach((section, index) => sections.push({ path: `sections[${index}]`, section }));

  for (const [groupKey, group] of Object.entries(templateConfig.sectionGroups || {})) {
    const groupSections = Array.isArray(group)
      ? group
      : Array.isArray((group as StorefrontSectionGroupConfig).sections)
        ? (group as StorefrontSectionGroupConfig).sections
        : [];
    groupSections.forEach((section, index) => sections.push({ path: `sectionGroups.${groupKey}.sections[${index}]`, section }));
  }

  for (const [templateKey, template] of Object.entries(templateConfig.templates || {})) {
    (template.sections || []).forEach((section, index) => sections.push({ path: `templates.${templateKey}.sections[${index}]`, section }));
  }

  return sections;
}

function asGovernanceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readBooleanDecision(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'enabled', 'on', 'canary'].includes(normalized)) return true;
    if (['0', 'false', 'disabled', 'off'].includes(normalized)) return false;
  }

  const record = asGovernanceRecord(value);
  for (const key of ['enabled', 'liquid_enabled', 'liquidEnabled', 'canary', 'value']) {
    if (key in record) {
      const decision = readBooleanDecision(record[key]);
      if (decision !== undefined) return decision;
    }
  }

  return undefined;
}

export function resolveThemeLiquidRenderingEnabled(input: ThemeLiquidRenderingDecisionInput): boolean {
  const releaseManifest = asGovernanceRecord(input.templateConfig.releaseManifest);
  const rendererManifest = asGovernanceRecord(releaseManifest.renderer || releaseManifest.renderer_manifest);
  const themeSettings = asGovernanceRecord(input.templateConfig.themeSettings);

  // Explicit per-theme renderer engine — the production activation switch (Phase 9). A published Liquid
  // release sets release_manifest.renderer_engine = 'liquid' (gateway buildReleaseArtifacts, set whenever
  // the theme has a liquidBundle); a Liquid theme/store may also carry templateConfig.rendererEngine =
  // 'liquid'. Either flips the store to Liquid. React / json-contract themes have no such signal and fall
  // through to the canary checks + default-off below, untouched.
  const explicitEngine = [
    asGovernanceRecord(input.templateConfig).rendererEngine,
    releaseManifest.renderer_engine,
    releaseManifest.rendererEngine,
    rendererManifest.engine,
  ].map((value) => (typeof value === 'string' ? value.toLowerCase() : undefined));
  if (explicitEngine.includes('liquid')) return true;

  const candidates = [
    input.templateConfig.liquidRenderingCanary,
    themeSettings.liquidRenderingCanary,
    themeSettings.liquid_rendering_canary,
    releaseManifest.liquidRenderingCanary,
    releaseManifest.liquid_rendering_canary,
    releaseManifest.liquidCanary,
    releaseManifest.liquid_canary,
    rendererManifest.liquidRenderingCanary,
    rendererManifest.liquid_rendering_canary,
    rendererManifest.liquidCanary,
    rendererManifest.liquid_canary,
  ];

  for (const candidate of candidates) {
    const decision = readBooleanDecision(candidate);
    if (decision !== undefined) return decision;
  }

  return input.defaultEnabled ?? THEME_LIQUID_RENDERING_DEFAULT_ENABLED;
}

export function collectLiquidPortableSectionParityGaps(sectionTypes: Iterable<string>): string[] {
  const available = new Set(sectionTypes);
  return THEME_LIQUID_PORTABLE_SECTION_PARITY
    .filter((entry) => !available.has(entry.liquidSectionType))
    .map((entry) => `${entry.reactFile} requires Liquid section "${entry.liquidSectionType}"`);
}

export function auditThemeRendererRegistry(input: ThemeRendererRegistryAuditInput): ThemeRendererRegistryAudit {
  const mode = input.mode || THEME_RENDERER_GOVERNANCE_DEFAULT_MODE;
  const sectionSchemas: Record<string, SectionSchema> = {
    ...BUILT_IN_SECTION_SCHEMAS,
    ...(input.sectionSchemas || {}),
  };
  const approvedRendererKeys = new Set(input.approvedRendererKeys || []);
  const issues: ThemeRendererRegistryAuditIssue[] = [];

  for (const { path, section } of collectTemplateSections(input.templateConfig)) {
    const schema = sectionSchemas[section.type] || (section.rendererKey ? sectionSchemas[section.rendererKey] : undefined);
    if (!schema) {
      issues.push({
        path,
        sectionId: section.id,
        sectionType: section.type,
        rendererKey: section.rendererKey,
        severity: mode === 'enforce' ? 'error' : 'warning',
        message: `${path}.type "${section.type}" is not registered in the theme section schema registry`,
      });
      continue;
    }

    if (section.rendererKey && approvedRendererKeys.size > 0 && !approvedRendererKeys.has(section.rendererKey)) {
      issues.push({
        path,
        sectionId: section.id,
        sectionType: section.type,
        rendererKey: section.rendererKey,
        severity: mode === 'enforce' ? 'error' : 'warning',
        message: `${path}.rendererKey "${section.rendererKey}" is not approved by the renderer manifest`,
      });
    }

    const blockSchemas = schema.blocks_schema || {};
    for (const [blockIndex, block] of (section.blocks || []).entries()) {
      if (!blockSchemas[block.type]) {
        issues.push({
          path: `${path}.blocks[${blockIndex}]`,
          sectionId: section.id,
          sectionType: section.type,
          rendererKey: block.rendererKey,
          severity: mode === 'enforce' ? 'error' : 'warning',
          message: `${path}.blocks[${blockIndex}].type "${block.type}" is not registered by the ${section.type} block schema`,
        });
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    mode,
    status: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    unresolvedCount: issues.length,
    warnings,
    errors,
  };
}

export function assertThemeRendererRegistry(input: ThemeRendererRegistryAuditInput): ThemeRendererRegistryAudit {
  const audit = auditThemeRendererRegistry({ ...input, mode: input.mode || 'enforce' });
  if (audit.status === 'fail') {
    throw new Error(`Theme renderer registry enforcement failed: ${audit.errors.map((issue) => issue.message).join('; ')}`);
  }
  return audit;
}

function cloneSection(section: SectionModel): SectionModel {
  return {
    ...section,
    settings: { ...section.settings },
    blocks: section.blocks?.map((block) => ({
      ...block,
      settings: { ...block.settings },
    })),
  };
}

function migrateSection(
  section: SectionModel,
  path: string,
  migrations: ThemeSectionSchemaMigration[],
  applied: AppliedThemeSchemaMigration[],
  warnings: string[],
): SectionModel {
  let next = cloneSection(section);
  const seen = new Set<string>();

  for (let i = 0; i < 20; i += 1) {
    const version = next.schemaVersion || 'unversioned';
    const migration = migrations.find((candidate) => (
      candidate.sectionType === next.type && candidate.fromVersion === version
    ));

    if (!migration) return next;

    const key = `${migration.sectionType}:${migration.fromVersion}:${migration.toVersion}`;
    if (seen.has(key)) {
      warnings.push(`${path} has a schema migration loop at ${key}`);
      return next;
    }
    seen.add(key);

    next = {
      ...next,
      settings: migration.migrateSettings({ ...next.settings }, next),
      schemaVersion: migration.toVersion,
      updatedAt: next.updatedAt || new Date(0).toISOString(),
    };
    applied.push({
      sectionId: next.id,
      sectionType: next.type,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      path,
    });
  }

  warnings.push(`${path} exceeded the maximum schema migration chain length`);
  return next;
}

function migrateSections(
  sections: SectionModel[],
  path: string,
  migrations: ThemeSectionSchemaMigration[],
  applied: AppliedThemeSchemaMigration[],
  warnings: string[],
): SectionModel[] {
  return sections.map((section, index) => migrateSection(section, `${path}[${index}]`, migrations, applied, warnings));
}

export function migrateThemeTemplateSchemas(input: {
  templateConfig: StoreTemplateConfig;
  migrations: ThemeSectionSchemaMigration[];
}): ThemeSchemaMigrationResult {
  const applied: AppliedThemeSchemaMigration[] = [];
  const warnings: string[] = [];
  const templateConfig = input.templateConfig;

  const sectionGroups = Object.fromEntries(
    Object.entries(templateConfig.sectionGroups || {}).map(([groupKey, group]) => {
      const groupSections = Array.isArray(group)
        ? migrateSections(group, `sectionGroups.${groupKey}`, input.migrations, applied, warnings)
        : migrateSections(group.sections, `sectionGroups.${groupKey}.sections`, input.migrations, applied, warnings);

      return [
        groupKey,
        Array.isArray(group)
          ? groupSections
          : { ...group, sections: groupSections },
      ];
    }),
  ) as Record<string, StorefrontSectionGroupConfig>;

  const templates = Object.fromEntries(
    Object.entries(templateConfig.templates || {}).map(([templateKey, template]) => [
      templateKey,
      {
        ...template,
        sections: migrateSections(template.sections || [], `templates.${templateKey}.sections`, input.migrations, applied, warnings),
      } satisfies StorefrontTemplateConfig,
    ]),
  );

  return {
    templateConfig: {
      ...templateConfig,
      sections: migrateSections(templateConfig.sections, 'sections', input.migrations, applied, warnings),
      sectionGroups,
      templates,
    },
    applied,
    warnings,
  };
}
