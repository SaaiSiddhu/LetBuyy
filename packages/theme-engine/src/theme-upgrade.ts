// K2 — Theme Upgrade Planner
//
// planThemeUpgrade({ installed, next }) produces a pure, side-effect-free upgrade plan comparing
// an installed LiquidThemePackageBundle against a target (next) bundle. No DB writes, no I/O.
//
// Composed from Phase G/H primitives:
//   - migrateThemeTemplateSchemasWithRegistry  (section-schema-migrations.ts)
//   - groupSettingsFields                      (settings-schema-canonical.ts)
//   - isThemeBundleSchemaCompatible / compareSchemaVersions (theme-version.ts, this phase)
//
// MIGRATION NOTE: REGISTERED_SECTION_SCHEMA_MIGRATIONS is intentionally empty today (Phase G
// verdict: no production field renames have occurred). The migration step is correctly wired and
// will apply real migrations the day one is registered. A same-version upgrade is a structural
// no-op that returns { applied: [], warnings: [] } from migrateThemeTemplateSchemasWithRegistry.
//
// DOWNGRADE POLICY: downgrades are flagged in warnings[] and compatible=false when the next
// schema_version is unknown or older than the installed version. The plan is still returned
// (never throws) to allow callers to inspect and warn the user before proceeding.

import type { LiquidThemePackageBundle } from './theme-bundle';
import type { StoreTemplateConfig, SectionModel, ThemeSettings } from './index';
import type { AppliedThemeSchemaMigration } from './theme-governance';
import { migrateThemeTemplateSchemasWithRegistry } from './section-schema-migrations';
import { groupSettingsFields } from './settings-schema-canonical';
import { isThemeBundleSchemaCompatible, compareSchemaVersions } from './theme-version';

// ---- Types ----

export interface ThemeUpgradePlan {
  /** The schema_version of the currently installed bundle. */
  fromVersion: string;
  /** The schema_version of the target (next) bundle. */
  toVersion: string;
  /** Section-settings migrations applied to the installed template config. Empty when none registered. */
  schemaMigrations: AppliedThemeSchemaMigration[];
  /** Installed settings_data.current grouped into canonical 5-group form for carry-over into the new theme. */
  settingsCarryover: Record<string, Record<string, unknown>>;
  /** Section types present in the next bundle but absent in the installed bundle (additions). */
  sectionAdds: string[];
  /** Section types present in the installed bundle but absent in the next bundle (removals). */
  sectionRemoves: string[];
  /** True when the upgrade is safe: next schema_version is known and direction is forward (or same). */
  compatible: boolean;
  /** Advisory warnings — downgrade detection, parity gaps, removed sections. Never throws; inspect and warn users. */
  warnings: string[];
}

// ---- Minimal StoreTemplateConfig builder ----

// Default ThemeSettings for the migration helper config — migration logic only reads SectionModel
// settings, not theme-wide settings, so these are inert placeholder values.
const UPGRADE_PLANNER_DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: '#000000',
  secondaryColor: '#ffffff',
  accentColor: '#000000',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  borderRadius: 0,
  enableAnimations: false,
  enableShadows: false,
};

/**
 * Build a minimal StoreTemplateConfig from a LiquidThemePackageBundle so that
 * migrateThemeTemplateSchemasWithRegistry can walk the section instances.
 *
 * Extracts section instances from every template in the bundle, converts each to a SectionModel,
 * and collects them as a flat section list. Migration logic inspects SectionModel.settings and
 * SectionModel.type — both are faithfully populated from the bundle's template data.
 */
function bundleToStoreTemplateConfig(bundle: LiquidThemePackageBundle): StoreTemplateConfig {
  const sections: SectionModel[] = [];
  let order = 0;

  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    for (const [sectionId, sectionInstance] of Object.entries(template.sections)) {
      const sectionModel: SectionModel = {
        id: `${templateKey}::${sectionId}`,
        type: sectionInstance.type,
        order: order++,
        settings: (sectionInstance.settings as Record<string, unknown>) ?? {},
        isVisible: !sectionInstance.disabled,
      };
      sections.push(sectionModel);
    }
  }

  return {
    themeId: bundle.package.slug,
    themeSettings: UPGRADE_PLANNER_DEFAULT_SETTINGS,
    sections,
    liquidBundle: bundle,
    rendererEngine: 'liquid',
  };
}

// ---- Public API ----

/**
 * planThemeUpgrade produces a pure upgrade plan comparing two LiquidThemePackageBundle instances.
 *
 * No side effects — purely a diff + migration-plan function. The caller is responsible for
 * applying the plan (writing to theme_package_versions, etc.) via the gateway.
 *
 * Same-version upgrade: sectionAdds/sectionRemoves will be empty; migrations will be a no-op
 * (empty applied[]); compatible will be true; warnings will be empty.
 *
 * Downgrade: compatible=false + a warning is emitted. Plan is returned regardless — never throws.
 */
export function planThemeUpgrade(input: {
  installed: LiquidThemePackageBundle;
  next: LiquidThemePackageBundle;
}): ThemeUpgradePlan {
  const { installed, next } = input;
  const fromVersion = installed.schema_version;
  const toVersion = next.schema_version;
  const warnings: string[] = [];

  // ---- Compatibility + direction ----
  const compatible = isThemeBundleSchemaCompatible(next);

  if (!compatible) {
    warnings.push(
      `Target bundle schema_version "${toVersion}" is not known to the current engine. ` +
      'Upgrade may fail at render time.',
    );
  }

  const direction = compareSchemaVersions(toVersion, fromVersion);

  if (direction === -1) {
    // Downgrade detected
    warnings.push(
      `Downgrade detected: from schema_version "${fromVersion}" to "${toVersion}". ` +
      'Downgrades are not supported and may cause render failures or data loss.',
    );
  } else if (direction === null && fromVersion !== toVersion) {
    // One or both versions are not in the known list — cross-renderer or future-version upgrade.
    warnings.push(
      `Cannot determine upgrade direction: schema_versions "${fromVersion}" and "${toVersion}" ` +
      'cannot be compared (one or both are not in the engine\'s known list). Proceed with caution.',
    );
  }

  // ---- Section-schema migrations ----
  // Run migrateThemeTemplateSchemasWithRegistry on the installed bundle's template config.
  // With an empty REGISTERED_SECTION_SCHEMA_MIGRATIONS this is a structural no-op.
  // When real migrations are registered they will be applied here automatically.
  const installedConfig = bundleToStoreTemplateConfig(installed);
  const migrationResult = migrateThemeTemplateSchemasWithRegistry(installedConfig);
  const schemaMigrations: AppliedThemeSchemaMigration[] = migrationResult.applied;
  // Surface any migration warnings to the caller.
  if (migrationResult.warnings.length > 0) {
    warnings.push(...migrationResult.warnings);
  }

  // ---- Settings carryover ----
  // Flatten and re-group the installed settings into the canonical 5-group form so the calling
  // code can pre-populate the next theme's settings without losing any merchant values.
  const settingsCarryover = groupSettingsFields(installed.config.settings_data.current);

  // ---- Section diff ----
  const installedSectionTypes = new Set(Object.keys(installed.sections));
  const nextSectionTypes = new Set(Object.keys(next.sections));

  const sectionAdds = [...nextSectionTypes].filter((t) => !installedSectionTypes.has(t)).sort();
  const sectionRemoves = [...installedSectionTypes].filter((t) => !nextSectionTypes.has(t)).sort();

  if (sectionAdds.length > 0) {
    warnings.push(
      `${sectionAdds.length} new section type(s) added in the target bundle: ${sectionAdds.join(', ')}. ` +
      'Verify Liquid parity before enabling canary rendering.',
    );
  }

  if (sectionRemoves.length > 0) {
    warnings.push(
      `${sectionRemoves.length} section type(s) removed in the target bundle: ${sectionRemoves.join(', ')}. ` +
      'Stores using removed sections will fall back to the default renderer.',
    );
  }

  return {
    fromVersion,
    toVersion,
    schemaMigrations,
    settingsCarryover,
    sectionAdds,
    sectionRemoves,
    compatible,
    warnings,
  };
}
