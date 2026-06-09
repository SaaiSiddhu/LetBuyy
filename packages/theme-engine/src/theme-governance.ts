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
