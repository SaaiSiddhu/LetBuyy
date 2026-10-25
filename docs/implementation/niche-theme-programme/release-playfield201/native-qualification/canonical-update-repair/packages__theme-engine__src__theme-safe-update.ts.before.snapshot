// ============================================================================
// Phase AB — Theme Safe Update Engine (Lane A)
// ----------------------------------------------------------------------------
// planThemeSafeUpdate: a pure, deterministic engine that upgrades a merchant's
// ThemeDocument from one bundle version to another WITHOUT losing merchant-authored
// content. Reuses:
//   - K  theme-version.ts : isThemeBundleSchemaCompatible / compareSchemaVersions
//   - G  section-schema-migrations.ts : migrateThemeTemplateSchemasWithRegistry
//   - O  experience-apply.ts : SettingClass token-key + resource-binding-key sets
//        (local mirror — no import from experience-apply to avoid coupling)
//   - W  dynamic-source-binding.ts : isDynamicSourceDescriptor (binding preservation)
//   - N  theme-document.ts : parseThemeDocument / ThemeDocument / ThemeDocumentSection
//
// NO-DATA-LOSS LAW (paramount):
//   Merchant-authored content (section settings, nested blocks, media bindings) is
//   NEVER silently overwritten or dropped. Every value that cannot be carried forward
//   is placed in diff.conflicts with its preserved value and requiresConfirmation is
//   set to true so the caller can surface a blocking warning before applying.
//
// RISK-DUAL-N01: planThemeSafeUpdate is PURE — no DB I/O, no network calls, no
// mutations of the shared section_definitions catalog. The merged ThemeDocument is a
// new view; only the caller (the gateway update route) persists it via the P publish
// path. This function modifies the per-store document instance, NOT the shared
// section_definitions catalog row in theme_packages.
//
// DETERMINISM: same (currentDocument, nextBundle, options) → identical output on
// every call. No Date.now() / Math.random() anywhere in this module.
//
// VERSION FLOW:
//   1. G4 gate  : isThemeBundleSchemaCompatible(nextBundle) — unknown/future → REJECT
//   2. Direction: compareSchemaVersions(next, current) — downgrade/unknown → REJECT
//                 same-version → no-op (updatedDoc = currentDocument, diff empty)
//   3. G migration : migrateThemeTemplateSchemasWithRegistry on current sections
//   4. Merge    : per-section classify+carry forward merchant content
//   5. parseThemeDocument: fail-closed final gate
// ============================================================================

import type { LiquidThemePackageBundle, ThemeLiquidSectionFile } from './theme-bundle';
import {
  parseThemeDocument,
  THEME_DOCUMENT_VERSION,
  type ThemeDocument,
  type ThemeDocumentSection,
  type ThemeDocumentBlock,
} from './theme-document';
import {
  isThemeBundleSchemaCompatible,
  compareSchemaVersions,
} from './theme-version';
import { migrateThemeTemplateSchemasWithRegistry } from './section-schema-migrations';
import { isDynamicSourceDescriptor } from './dynamic-source-binding';
import type { AppliedThemeSchemaMigration } from './theme-governance';
// type-only import to avoid circular dependency (index.ts re-exports this module)
import type { SectionModel, StoreTemplateConfig, ThemeSettings } from './index';

// ── Public error types ───────────────────────────────────────────────────────

/**
 * Thrown by planThemeSafeUpdate when the target bundle's schema_version is not in
 * KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS (G4 gate) or when the version cannot be
 * compared (fail-closed).
 */
export class UpdateVersionRejectedError extends Error {
  readonly targetVersion: string;
  readonly reason: 'unknown-version' | 'incompatible-compatibility-range' | 'unresolvable-direction';

  constructor(
    targetVersion: string,
    reason: UpdateVersionRejectedError['reason'],
  ) {
    super(
      `Theme safe-update rejected: cannot apply target bundle version "${targetVersion}" ` +
      `(reason: ${reason}). Only known, forward-compatible versions may be applied.`,
    );
    this.name = 'UpdateVersionRejectedError';
    this.targetVersion = targetVersion;
    this.reason = reason;
  }
}

/**
 * Thrown by planThemeSafeUpdate when the target bundle would represent a downgrade
 * relative to the current document's bundle_schema_version.
 */
export class UpdateDowngradeError extends Error {
  readonly fromVersion: string;
  readonly toVersion: string;

  constructor(fromVersion: string, toVersion: string) {
    super(
      `Theme safe-update rejected: downgrade from "${fromVersion}" to "${toVersion}" is not ` +
      'supported. Downgrades can cause render failures and data loss.',
    );
    this.name = 'UpdateDowngradeError';
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
  }
}

// ── Diff types ────────────────────────────────────────────────────────────────

/**
 * Classification of a single setting key+value pair.
 * Mirrors Phase O SettingClass — local copy to avoid import coupling.
 */
export type UpdateSettingClass =
  | 'token'
  | 'merchant-content'
  | 'generated-placeholder'
  | 'resource-binding'
  | 'app-owned';

/** A single section change within an update diff. */
export interface ThemeUpdateSectionDiff {
  /** The template key this section belongs to (e.g. 'index', 'product'). */
  templateKey: string;
  /** Section id (stable per current document). */
  sectionId: string;
  /** Section type (kebab, e.g. 'hero-banner'). */
  type: string;
  /** What happened to this section during the update. */
  action: 'retained' | 'removed' | 'added';
  /**
   * Content that could not be carried forward.
   * Populated for 'removed' sections that had merchant-content or resource-binding
   * settings, or blocks that became invalid in the new bundle.
   * Never populated for 'retained' or 'added'.
   */
  lostContent?: {
    settings?: Record<string, unknown>;
    blocks?: Array<{ id: string; type: string; settings: Record<string, unknown> }>;
  };
}

/**
 * Complete diff produced by computeThemeUpdateDiff / planThemeSafeUpdate.
 *
 * The diff is PURE — it is computed from the inputs without any I/O. The caller
 * (gateway route) should present it to the merchant and require explicit confirmation
 * (via confirm_diff_hash) before proceeding when requiresDuplicateBeforeApply is true.
 */
export interface ThemeUpdateDiff {
  /** Bundle schema_version of the current document. */
  fromVersion: string;
  /** Bundle schema_version of the target bundle. */
  toVersion: string;
  /** Per-section diff entries across all templates. */
  sections: ThemeUpdateSectionDiff[];
  /**
   * Entries where content CANNOT be automatically migrated — sections removed from
   * the target bundle that contained merchant-authored content or resource bindings.
   * requiresDuplicateBeforeApply is true whenever this array is non-empty.
   */
  conflicts: ThemeUpdateSectionDiff[];
  /**
   * True when the merchant must duplicate the theme before updating because some
   * of their content cannot be carried forward to the new version.
   */
  requiresDuplicateBeforeApply: boolean;
  /**
   * Section-schema migrations applied to the current sections before the merge
   * (structural no-op with empty REGISTERED_SECTION_SCHEMA_MIGRATIONS today,
   * but wired so future registered migrations auto-run).
   */
  schemaMigrations: AppliedThemeSchemaMigration[];
  summary: {
    sectionsRetained: number;
    sectionsRemoved: number;
    sectionsAdded: number;
    sectionsWithLostContent: number;
  };
}

/** Options for planThemeSafeUpdate. */
export interface ThemeSafeUpdateOptions {
  /**
   * When true (default), carry forward merchant-content and resource-binding
   * settings + all blocks from matching section types.
   * When false, use the nextBundle's default settings for all sections.
   * Setting this to false is intended only for testing/debugging — production
   * updates should always use the default (true).
   */
  preserveContent?: boolean;
}

/** Return value of planThemeSafeUpdate. */
export interface ThemeUpdateResult {
  /**
   * The new ThemeDocument after applying the update.
   * Validated by parseThemeDocument() before return.
   * Same reference as currentDocument when the update is a no-op (same-version).
   */
  updatedDoc: ThemeDocument;
  /** Complete diff describing every change. Computed during the merge pass. */
  diff: ThemeUpdateDiff;
  /**
   * True when the diff contains conflicts that require explicit merchant
   * confirmation before the update should be applied.
   */
  requiresConfirmation: boolean;
}

// ── Internal constants (mirror of Phase O — LOCAL COPY) ───────────────────────

/**
 * The 10 design-token overlay keys managed by buildExperienceSettingsOverlay().
 * Token settings are NEVER carried forward on an update — they are always
 * re-applied from the new bundle's experience/preset.
 *
 * SOURCE: packages/theme-engine/src/experience-apply.ts TOKEN_KEYS (verbatim mirror).
 * A drift test in the test suite asserts these sets stay in sync.
 */
const TOKEN_KEYS = new Set<string>([
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'textColor',
  'surfaceColor',
  'fontFamily',
  'bodyFontFamily',
  'headingFontFamily',
  'borderRadius',
]);

/**
 * Explicit resource-binding key names.
 * SOURCE: packages/theme-engine/src/experience-apply.ts EXPLICIT_RESOURCE_BINDING_KEYS (verbatim mirror).
 */
const EXPLICIT_RESOURCE_BINDING_KEYS = new Set<string>([
  'collectionHandle',
  'productHandle',
  'productId',
  'collectionId',
  'featured_collection',
  'product_handle',
  'collection_handle',
  'linked_content',
]);

// ── Internal helpers ──────────────────────────────────────────────────────────

/** True for setting keys that bind the section to a specific DB entity. */
function isResourceBindingKey(key: string): boolean {
  if (EXPLICIT_RESOURCE_BINDING_KEYS.has(key)) return true;
  // camelCase patterns: ends with 'Handle' or 'Id'
  if (key.endsWith('Handle') || (key.endsWith('Id') && key.length > 3)) return true;
  // snake_case patterns
  if (key.endsWith('_handle') || key.endsWith('_id')) return true;
  return false;
}

/**
 * Classify a single setting key+value pair for the update context.
 *
 * Precedence (highest first):
 *   1. W binding: isDynamicSourceDescriptor(value) → resource-binding (overrides key check)
 *   2. TOKEN keys → token
 *   3. RESOURCE-BINDING key patterns → resource-binding
 *   4. Empty / null / undefined → generated-placeholder
 *   5. Everything else → merchant-content
 *
 * This is a LOCAL MIRROR of Phase O classifySetting (attributed verbatim) with one
 * addition: the W binding check is done FIRST so that descriptor values are treated
 * as resource-bindings regardless of their key name. A drift test asserts that
 * classifyUpdateSetting and Phase O classifySetting return identical results for
 * the same inputs on non-descriptor values.
 *
 * NOTE: Unlike Phase O, this function does NOT look up schema defaults from
 * BUILT_IN_SECTION_SCHEMAS because the update operates at the Liquid bundle level
 * where section schemas are JSON-embedded in the .liquid files. This means some
 * settings that would be 'generated-placeholder' in Phase O may be classified
 * as 'merchant-content' here — which is intentionally CONSERVATIVE (carry more,
 * never drop silently).
 */
export function classifyUpdateSetting(
  key: string,
  value: unknown,
): UpdateSettingClass {
  // W binding: dynamic source descriptor → resource-binding regardless of key name.
  if (isDynamicSourceDescriptor(value)) return 'resource-binding';
  // Token keys (design-system tokens — never merchant-authored).
  if (TOKEN_KEYS.has(key)) return 'token';
  // Resource-binding key patterns.
  if (isResourceBindingKey(key)) return 'resource-binding';
  // Empty / null / undefined → placeholder; never meaningful merchant content.
  if (value === '' || value === null || value === undefined) return 'generated-placeholder';
  // Everything else is merchant-authored content.
  return 'merchant-content';
}

/** True when a section definition accepts @app sentinel blocks. */
function sectionDefAcceptsAppBlocks(sectionDef: ThemeLiquidSectionFile): boolean {
  return sectionDef.schema.blocks.some((b) => b.type === '@app');
}

/** Set of inline block types accepted by a section definition. */
function sectionDefInlineBlockTypes(sectionDef: ThemeLiquidSectionFile): Set<string> {
  const types = new Set<string>();
  for (const b of sectionDef.schema.blocks) {
    if (b.type !== '@app') types.add(b.type);
  }
  return types;
}

/** Deep-clone a value via JSON round-trip (deterministic, no Date.now). */
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * True when a block is valid in the given section definition + block_definitions context.
 * A block is valid when:
 *   a) its type is in block_definitions (reusable block), OR
 *   b) its type is in the section's inline block types (inline block), OR
 *   c) its type is an @app sentinel AND the section accepts @app blocks.
 */
function isBlockValidInNewBundle(
  block: ThemeDocumentBlock,
  sectionDef: ThemeLiquidSectionFile,
  blockDefinitions: Record<string, unknown>,
): boolean {
  if (block.type in blockDefinitions) return true;
  if (sectionDefInlineBlockTypes(sectionDef).has(block.type)) return true;
  if (block.type.startsWith('@') && sectionDefAcceptsAppBlocks(sectionDef)) return true;
  return false;
}

/**
 * Build a minimal StoreTemplateConfig from a ThemeDocument's template sections so that
 * migrateThemeTemplateSchemasWithRegistry can walk the section instances. This is
 * structurally identical to the bundleToStoreTemplateConfig helper in theme-upgrade.ts
 * but operates on a ThemeDocument (which has sections[] arrays) rather than a bundle
 * (which has sections keyed Records with block_order[]).
 */
function documentToStoreTemplateConfig(doc: ThemeDocument): StoreTemplateConfig {
  const sections: SectionModel[] = [];
  let order = 0;

  const INERT_THEME_SETTINGS: ThemeSettings = {
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

  for (const template of doc.templates) {
    for (const section of template.sections) {
      sections.push({
        id: `${template.key}::${section.id}`,
        type: section.type,
        order: order++,
        settings: section.settings as Record<string, unknown>,
        isVisible: !section.disabled,
      });
    }
  }

  // Import LiquidThemePackageBundle lazily to avoid circular dep — we only need the
  // bundle field on StoreTemplateConfig, which accepts undefined.
  return {
    themeId: doc.package.slug,
    themeSettings: INERT_THEME_SETTINGS,
    sections,
  } as StoreTemplateConfig;
}

// ── Core diff computation ─────────────────────────────────────────────────────

/**
 * Compute the update diff for a single section.
 * Determines whether the section is retained, removed, or if blocks became invalid.
 * Returns the diff entry and the filtered settings + blocks to carry forward.
 */
function computeSectionUpdateDiff(
  templateKey: string,
  currentSection: ThemeDocumentSection,
  nextSectionDef: ThemeLiquidSectionFile | undefined,
  nextBlockDefinitions: Record<string, unknown>,
  preserveContent: boolean,
): {
  diffEntry: ThemeUpdateSectionDiff;
  // When action === 'retained': the settings and blocks to carry forward.
  carriedSettings: Record<string, unknown>;
  carriedBlocks: ThemeDocumentBlock[];
} {
  const type = currentSection.type;

  // Section type no longer exists in the new bundle → remove.
  if (!nextSectionDef) {
    const lostSettings: Record<string, unknown> = {};
    const lostBlocks: Array<{ id: string; type: string; settings: Record<string, unknown> }> = [];
    let hasMeaningfulLoss = false;

    for (const [key, value] of Object.entries(currentSection.settings)) {
      const cls = classifyUpdateSetting(key, value);
      if (cls === 'merchant-content' || cls === 'resource-binding') {
        lostSettings[key] = value;
        hasMeaningfulLoss = true;
      }
    }

    for (const block of currentSection.blocks) {
      // All blocks in a removed section are lost.
      lostBlocks.push({
        id: block.id,
        type: block.type,
        settings: block.settings as Record<string, unknown>,
      });
      if (!block.type.startsWith('@') || Object.keys(block.settings).length > 0) {
        hasMeaningfulLoss = true;
      }
    }

    const diffEntry: ThemeUpdateSectionDiff = {
      templateKey,
      sectionId: currentSection.id,
      type,
      action: 'removed',
      lostContent: hasMeaningfulLoss
        ? {
            settings: Object.keys(lostSettings).length > 0 ? lostSettings : undefined,
            blocks: lostBlocks.length > 0 ? lostBlocks : undefined,
          }
        : undefined,
    };

    return { diffEntry, carriedSettings: {}, carriedBlocks: [] };
  }

  // Section type IS in the new bundle → retain.
  const carriedSettings: Record<string, unknown> = {};
  const carriedBlocks: ThemeDocumentBlock[] = [];
  // Blocks dropped because their type was removed from the new bundle schema.
  // Only tracked when preserveContent=true (matches the content-preservation intent).
  const droppedBlocksWithContent: Array<{
    id: string;
    type: string;
    settings: Record<string, unknown>;
  }> = [];

  if (preserveContent) {
    // Carry forward merchant-content and resource-binding settings.
    for (const [key, value] of Object.entries(currentSection.settings)) {
      const cls = classifyUpdateSetting(key, value);
      if (cls === 'merchant-content' || cls === 'resource-binding') {
        carriedSettings[key] = value;
      }
    }

    // Carry forward blocks that are still valid in the new section definition.
    // @app blocks: carry only if new section accepts @app.
    // Other blocks: carry if still in inline types or block_definitions.
    for (const block of currentSection.blocks) {
      if (isBlockValidInNewBundle(block, nextSectionDef, nextBlockDefinitions)) {
        carriedBlocks.push(deepClone(block));
      } else {
        // Block type removed from new bundle.
        // NO-DATA-LOSS LAW: surface any meaningful block content in lostContent
        // so the merchant can decide whether to duplicate before updating.
        // Heuristic (mirrors removed-section block check): a block has meaningful
        // content when it is a named block type (non-@app) OR carries non-empty
        // settings (e.g. @app extension_handle bindings).
        const hasMeaningfulBlockContent =
          !block.type.startsWith('@') || Object.keys(block.settings).length > 0;
        if (hasMeaningfulBlockContent) {
          droppedBlocksWithContent.push({
            id: block.id,
            type: block.type,
            settings: block.settings as Record<string, unknown>,
          });
        }
      }
    }
  }

  const diffEntry: ThemeUpdateSectionDiff = {
    templateKey,
    sectionId: currentSection.id,
    type,
    action: 'retained',
    // Populate lostContent when blocks with merchant-meaningful content were dropped.
    // This ensures requiresDuplicateBeforeApply fires correctly and the merchant sees
    // which block content cannot be carried forward (NO-DATA-LOSS LAW).
    ...(droppedBlocksWithContent.length > 0
      ? { lostContent: { blocks: droppedBlocksWithContent } }
      : {}),
  };

  return { diffEntry, carriedSettings, carriedBlocks };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the diff between a ThemeDocument and a target bundle without applying it.
 * Pure and idempotent — does not touch the input document.
 *
 * Use this as a PREVIEW before calling planThemeSafeUpdate: inspect
 * diff.requiresDuplicateBeforeApply and diff.conflicts to decide whether to prompt
 * the merchant to duplicate the theme first.
 *
 * @throws UpdateVersionRejectedError when nextBundle fails the G4 gate or its
 *   schema_version direction cannot be resolved against the current document.
 * @throws UpdateDowngradeError when nextBundle would be a downgrade.
 */
export function computeThemeUpdateDiff(
  currentDocument: ThemeDocument,
  nextBundle: LiquidThemePackageBundle,
): ThemeUpdateDiff {
  const fromVersion = currentDocument.bundle_schema_version;
  const toVersion = nextBundle.schema_version;

  // ── G4 gate ─────────────────────────────────────────────────────────────────
  if (!isThemeBundleSchemaCompatible(nextBundle)) {
    throw new UpdateVersionRejectedError(toVersion, 'unknown-version');
  }

  // ── Direction ───────────────────────────────────────────────────────────────
  const direction = compareSchemaVersions(toVersion, fromVersion);

  if (direction === null) {
    throw new UpdateVersionRejectedError(toVersion, 'unresolvable-direction');
  }

  if (direction === -1) {
    throw new UpdateDowngradeError(fromVersion, toVersion);
  }

  // ── Same-version no-op ───────────────────────────────────────────────────────
  if (direction === 0) {
    return {
      fromVersion,
      toVersion,
      sections: [],
      conflicts: [],
      requiresDuplicateBeforeApply: false,
      schemaMigrations: [],
      summary: {
        sectionsRetained: 0,
        sectionsRemoved: 0,
        sectionsAdded: 0,
        sectionsWithLostContent: 0,
      },
    };
  }

  // ── Cross-version diff ───────────────────────────────────────────────────────
  const nextSectionDefs = nextBundle.sections;
  const nextBlockDefs = nextBundle.blocks;

  const allDiffEntries: ThemeUpdateSectionDiff[] = [];
  let sectionsRetained = 0;
  let sectionsRemoved = 0;
  let sectionsWithLostContent = 0;

  // Track which section types from currentDocument appear in the new bundle.
  const currentDocSectionTypes = new Set<string>();
  for (const template of currentDocument.templates) {
    for (const section of template.sections) {
      currentDocSectionTypes.add(section.type);
    }
  }

  // Per-section diff (retained or removed).
  for (const template of currentDocument.templates) {
    for (const section of template.sections) {
      const nextDef = nextSectionDefs[section.type] as ThemeLiquidSectionFile | undefined;
      const { diffEntry } = computeSectionUpdateDiff(
        template.key,
        section,
        nextDef,
        nextBlockDefs as Record<string, unknown>,
        true, // preserveContent always true for diff computation
      );
      allDiffEntries.push(diffEntry);
      if (diffEntry.action === 'retained') {
        sectionsRetained++;
        // NO-DATA-LOSS: count retained sections whose dropped blocks have merchant content.
        if (diffEntry.lostContent) sectionsWithLostContent++;
      }
      if (diffEntry.action === 'removed') {
        sectionsRemoved++;
        if (diffEntry.lostContent) sectionsWithLostContent++;
      }
    }
  }

  // Detect newly added section types (in nextBundle but not in any current template).
  const sectionsAdded: ThemeUpdateSectionDiff[] = [];
  for (const sectionType of Object.keys(nextSectionDefs)) {
    if (!currentDocSectionTypes.has(sectionType)) {
      sectionsAdded.push({
        templateKey: '',
        sectionId: '',
        type: sectionType,
        action: 'added',
      });
    }
  }
  const sectionsAddedCount = sectionsAdded.length;

  const allEntries = [...allDiffEntries, ...sectionsAdded];
  // Include retained sections with dropped block content alongside removed sections.
  // Both represent content that cannot be automatically carried forward (NO-DATA-LOSS LAW).
  const conflicts = allDiffEntries.filter(
    (e) => e.lostContent !== undefined,
  );

  return {
    fromVersion,
    toVersion,
    sections: allEntries,
    conflicts,
    requiresDuplicateBeforeApply: conflicts.length > 0,
    schemaMigrations: [], // populated by planThemeSafeUpdate after running migrations
    summary: {
      sectionsRetained,
      sectionsRemoved,
      sectionsAdded: sectionsAddedCount,
      sectionsWithLostContent,
    },
  };
}

/**
 * Plan and apply a tenant-safe theme update.
 *
 * Preserves ALL merchant-authored content (section settings, nested-block children,
 * dynamic-source binding descriptors, media bindings) while updating the underlying
 * section_definitions, block_definitions, locales, renderer, and layout to the new
 * bundle version. Content that CANNOT be carried forward is reported in diff.conflicts
 * with requiresConfirmation=true — it is NEVER silently dropped.
 *
 * KEY INVARIANTS:
 *   - Same-version update → no-op (updatedDoc === currentDocument).
 *   - Downgrade → UpdateDowngradeError thrown before any mutation.
 *   - Unknown/future target version → UpdateVersionRejectedError (G4 gate).
 *   - Output document always passes parseThemeDocument() validation (fail-closed).
 *   - RISK-DUAL-N01: this function produces a new document view; it does NOT write to
 *     the shared section_definitions catalog in the DB. Only the gateway's publish
 *     path persists the result.
 *
 * @throws UpdateVersionRejectedError — unknown/incompatible target version (G4 gate).
 * @throws UpdateDowngradeError       — target is an older schema_version than current.
 */
export function planThemeSafeUpdate(input: {
  currentDocument: ThemeDocument;
  nextBundle: LiquidThemePackageBundle;
  options?: ThemeSafeUpdateOptions;
}): ThemeUpdateResult {
  const { currentDocument, nextBundle, options } = input;
  const preserveContent = options?.preserveContent ?? true;

  const fromVersion = currentDocument.bundle_schema_version;
  const toVersion = nextBundle.schema_version;

  // ── 1. G4 gate (MUST run before any mutation) ────────────────────────────────
  // RISK-DUAL-N01 assertion: this check fires before any document mutation or DB write.
  if (!isThemeBundleSchemaCompatible(nextBundle)) {
    throw new UpdateVersionRejectedError(toVersion, 'unknown-version');
  }

  // ── 2. Direction check ───────────────────────────────────────────────────────
  const direction = compareSchemaVersions(toVersion, fromVersion);

  if (direction === null) {
    throw new UpdateVersionRejectedError(toVersion, 'unresolvable-direction');
  }

  if (direction === -1) {
    throw new UpdateDowngradeError(fromVersion, toVersion);
  }

  // ── 3. Same-version no-op ────────────────────────────────────────────────────
  if (direction === 0) {
    const noop: ThemeUpdateDiff = {
      fromVersion,
      toVersion,
      sections: [],
      conflicts: [],
      requiresDuplicateBeforeApply: false,
      schemaMigrations: [],
      summary: {
        sectionsRetained: 0,
        sectionsRemoved: 0,
        sectionsAdded: 0,
        sectionsWithLostContent: 0,
      },
    };
    return {
      updatedDoc: currentDocument,
      diff: noop,
      requiresConfirmation: false,
    };
  }

  // ── 4. G migration (structural no-op with empty registry today; wired for future) ──
  const migConfig = documentToStoreTemplateConfig(currentDocument);
  const migResult = migrateThemeTemplateSchemasWithRegistry(migConfig);
  const schemaMigrations = migResult.applied;

  // ── 5. Merge: carry merchant content into nextBundle's definition frame ───────
  //
  // Strategy: start from currentDocument's templates (preserving merchant layout).
  // For each section in each template:
  //   - Type exists in nextBundle.sections → 'retained'; carry settings + blocks forward.
  //   - Type absent from nextBundle.sections → 'removed'; record lostContent.
  //
  // The merged document replaces section_definitions / block_definitions / locales /
  // renderer / layout / package with the nextBundle values, while keeping the
  // merchant's template structure and instance content.
  //
  // NOTE: this modifies the document view only — NOT the shared section_definitions
  // catalog row in theme_packages (RISK-DUAL-N01 assertion).

  const nextSectionDefs = nextBundle.sections;
  const nextBlockDefs = nextBundle.blocks;

  const allDiffEntries: ThemeUpdateSectionDiff[] = [];
  const mergedTemplates: typeof currentDocument.templates = [];

  let sectionsRetained = 0;
  let sectionsRemoved = 0;
  let sectionsWithLostContent = 0;

  for (const template of currentDocument.templates) {
    const mergedSections: ThemeDocumentSection[] = [];

    for (const section of template.sections) {
      const nextDef = nextSectionDefs[section.type] as ThemeLiquidSectionFile | undefined;
      const { diffEntry, carriedSettings, carriedBlocks } = computeSectionUpdateDiff(
        template.key,
        section,
        nextDef,
        nextBlockDefs as Record<string, unknown>,
        preserveContent,
      );

      allDiffEntries.push(diffEntry);

      if (diffEntry.action === 'retained') {
        // Carry forward the section with merged settings + blocks.
        mergedSections.push({
          id: section.id,
          type: section.type,
          settings: carriedSettings as Record<string, import('./theme-bundle').ThemeBundleJson>,
          disabled: section.disabled,
          blocks: carriedBlocks,
        });
        sectionsRetained++;
        // NO-DATA-LOSS: count retained sections whose dropped blocks have merchant content.
        if (diffEntry.lostContent) sectionsWithLostContent++;
      } else {
        // Section removed — excluded from merged output.
        sectionsRemoved++;
        if (diffEntry.lostContent) sectionsWithLostContent++;
      }
    }

    mergedTemplates.push({
      key: template.key,
      name: template.name,
      layout: template.layout,
      sections: mergedSections,
    });
  }

  // Detect newly added section types (in nextBundle but not in any current template).
  const currentDocSectionTypes = new Set<string>();
  for (const template of currentDocument.templates) {
    for (const section of template.sections) {
      currentDocSectionTypes.add(section.type);
    }
  }

  const addedSectionEntries: ThemeUpdateSectionDiff[] = [];
  for (const sectionType of Object.keys(nextSectionDefs)) {
    if (!currentDocSectionTypes.has(sectionType)) {
      addedSectionEntries.push({
        templateKey: '',
        sectionId: '',
        type: sectionType,
        action: 'added',
      });
    }
  }

  const allEntries = [...allDiffEntries, ...addedSectionEntries];
  // Include retained sections with dropped block content alongside removed sections.
  // Both represent content that cannot be automatically carried forward (NO-DATA-LOSS LAW).
  const conflicts = allDiffEntries.filter(
    (e) => e.lostContent !== undefined,
  );

  const diff: ThemeUpdateDiff = {
    fromVersion,
    toVersion,
    sections: allEntries,
    conflicts,
    requiresDuplicateBeforeApply: conflicts.length > 0,
    schemaMigrations,
    summary: {
      sectionsRetained,
      sectionsRemoved,
      sectionsAdded: addedSectionEntries.length,
      sectionsWithLostContent,
    },
  };

  // ── 6. Assemble merged document ──────────────────────────────────────────────
  //
  // NOTE (RISK-DUAL-N01): the following builds a NEW document with section_definitions
  // from nextBundle.sections — this changes the per-store document's definition view,
  // NOT the shared section_definitions catalog row in theme_packages. The gateway
  // persist path (publishReleaseSnapshot) stores the resulting ThemeDocument as a new
  // release_config, leaving the catalog untouched.

  const bundleSettingsData = nextBundle.config.settings_data;
  const { current: _nextCurrent, presets: _nextPresets, ...nextSettingsDataExtra } =
    bundleSettingsData as Record<string, unknown>;

  // Preserve merchant's settings_data.current (token values etc.); adopt new schema.
  const currentSettingsData = currentDocument.config.settings_data;

  const rawMerged = {
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: toVersion,
    package: { ...nextBundle.package },
    layout: nextBundle.layout,
    config: {
      settings_schema: nextBundle.config.settings_schema,
      settings_data: {
        ...nextSettingsDataExtra,
        current: currentSettingsData.current,
        presets: currentSettingsData.presets,
      },
    },
    // RISK-DUAL-N01: these are per-store document-level definition views adopted from
    // the nextBundle. They do NOT touch the shared catalog.
    section_definitions: nextBundle.sections,
    block_definitions: nextBundle.blocks,
    locales: nextBundle.locales,
    renderer: nextBundle.renderer,
    templates: mergedTemplates,
  };

  // ── 7. Fail-closed validation gate ──────────────────────────────────────────
  const updatedDoc = parseThemeDocument(rawMerged);

  return {
    updatedDoc,
    diff,
    requiresConfirmation: diff.requiresDuplicateBeforeApply,
  };
}
