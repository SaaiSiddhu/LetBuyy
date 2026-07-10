// ============================================================================
// Phase O — Experience Apply Engine (ThemeDocument V2 level)
// ----------------------------------------------------------------------------
// Implements the document-level experience apply, parallel to (and independent
// from) the existing bundle-level apply functions in theme-presets.ts:
//
//   bundle level  → applyExperienceToSettingsData / applyExperienceToTemplateConfig
//                    (store-creation + editor draft paths; UNCHANGED)
//   document level → applyExperienceToDocument / computeExperienceApplyDiff (NEW)
//
// Design rules:
//   - DETERMINISTIC: same (document, experienceId, mode) → same output.
//     No Date.now()/Math.random() in any code path.
//   - CONTENT PRESERVATION LAW: never silently delete merchant data.
//     Classify every setting/block; preserve by default; expose loss in diff.
//   - RISK-DUAL-N01: NEVER mutate section_definitions, block_definitions,
//     layout, locales, or renderer. Only templates[] and
//     config.settings_data.current are touch targets.
//   - ART-17: no new React section implementations; compositions use only
//     canonical JSON/Liquid section types.
//   - FAIL-CLOSED: parseThemeDocument() is called on the output before return.
//     If the compose step would produce an invalid document, the failing section
//     is skipped (incompatible) — never inserted.
// ============================================================================

import { BUILT_IN_SECTION_SCHEMAS } from './built-in-section-schemas';
import type { BuiltInThemeSectionType } from './built-in-section-schemas';
import { type ThemeBundleJson } from './theme-bundle';
import {
  parseThemeDocument,
  type ThemeDocument,
  type ThemeDocumentSection,
  type ThemeDocumentBlock,
} from './theme-document';
import {
  getExperience,
  buildExperienceSettingsOverlay,
  validateExperienceOverlay,
} from './theme-presets';
import {
  resolveLiquidSectionType,
  BUILT_IN_TO_LIQUID_SECTION_TYPE,
} from './section-type-map';
import { EXPERIENCE_COMPOSITIONS, type SectionSpec } from './experience-compositions';

// ── Public types ─────────────────────────────────────────────────────────────

/** Apply modes: STYLE_ONLY touches only token settings; COMPLETE_DESIGN rebuilds templates. */
export type ExperienceApplyMode = 'STYLE_ONLY' | 'COMPLETE_DESIGN';

/**
 * Classification of a single setting key+value pair.
 * Used to determine what can be safely replaced vs. what must be preserved.
 *
 * app-owned: block-level classification (block type is @app or in block_definitions);
 *   not used for individual setting keys within a section, but included in
 *   SettingClass for completeness per the API contract.
 */
export type SettingClass =
  | 'token'
  | 'merchant-content'
  | 'generated-placeholder'
  | 'resource-binding'
  | 'app-owned';

/** Diff entry for a single section change within a template. */
export interface SectionDiffEntry {
  /** Section id from the NEW composition (for added/reordered/retained) or OLD template (for removed). */
  sectionId: string;
  /** Kebab-case Liquid section type as resolved. */
  type: string;
  action: 'added' | 'removed' | 'reordered' | 'retained' | 'settings-updated' | 'incompatible';
  /**
   * Settings/blocks that would be lost.
   * For 'removed' entries: populated whenever the section has merchant-content,
   * resource-binding, or app-owned content, regardless of preserveContent.
   * For 'retained'/'reordered' entries: populated only when preserveContent=false
   * and the section has non-@app blocks that would be discarded.
   */
  lostContent?: {
    settings?: Record<string, unknown>;
    blocks?: Array<{ id: string; type: string; settings: Record<string, unknown> }>;
  };
  /** For 'added': placeholder settings applied from the SectionSpec. */
  newSettings?: Record<string, unknown>;
  /** For 'reordered': the section's index in the OLD template. */
  previousIndex?: number;
  /** For 'incompatible': reason the type could not be resolved. */
  incompatibleReason?: string;
}

/** Diff entry for a single settings_data.current key change. */
export interface SettingsDiffEntry {
  key: string;
  previousValue: unknown;
  newValue: unknown;
  classification: SettingClass;
}

/** Complete diff between the input document and the proposed apply result. */
export interface ExperienceApplyDiff {
  experienceId: string;
  mode: ExperienceApplyMode;
  /** Per-template section diffs (keys: 'index', 'product', 'collection'). */
  templates: Record<
    string,
    {
      sections: SectionDiffEntry[];
      /** True when at least one section change involves content loss. */
      hasContentLoss: boolean;
    }
  >;
  /** settings_data.current key diffs (includes the 10 token overlay keys). */
  settings: SettingsDiffEntry[];
  /**
   * True when at least one section would be REMOVED from a template AND that
   * section has MERCHANT-CONTENT/RESOURCE-BINDING settings with non-empty values
   * or APP-OWNED blocks, OR when a RETAINED/REORDERED section has non-@app blocks
   * that would be discarded (only possible when preserveContent=false).
   * The caller should offer "Duplicate before applying" UX whenever this is true,
   * regardless of whether preserveContent was set.
   */
  requiresDuplicateBeforeApply: boolean;
  summary: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsReordered: number;
    sectionsRetained: number;
    settingsChanged: number;
    contentAtRisk: number;
  };
}

/** Options controlling apply behaviour. */
export interface ExperienceApplyOptions {
  mode: ExperienceApplyMode;
  /**
   * When true (default), COMPLETE_DESIGN carries forward MERCHANT-CONTENT and
   * RESOURCE-BINDING settings from same-typed old sections to new sections.
   * When false, all section settings are replaced with composition placeholders.
   */
  preserveContent?: boolean;
}

/** Return value of applyExperienceToDocument. */
export interface ExperienceApplyResult {
  /** The new ThemeDocument after applying the experience. Validated by parseThemeDocument(). */
  document: ThemeDocument;
  /** Computed diff describing every change. Pure — computed during the apply pass. */
  diff: ExperienceApplyDiff;
}

// ── Internal constants ────────────────────────────────────────────────────────

/** The 10 token overlay keys written by buildExperienceSettingsOverlay(). */
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
 * Keys that semantically bind a section to a DB entity (collection, product).
 * Identified by key-name patterns matching collection/product handles and ids.
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

/** The templates Phase O manages. Other templates are never touched. */
const MANAGED_TEMPLATE_KEYS = new Set(['index', 'product', 'collection']);

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Inverted map: Liquid kebab type → camelCase BUILT_IN type. */
const LIQUID_TO_CAMEL_SECTION_TYPE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(BUILT_IN_TO_LIQUID_SECTION_TYPE).map(([camel, kebab]) => [kebab, camel]),
);

/**
 * Retrieve the schema default value for a specific setting key on a kebab-typed section.
 * Returns undefined when the section type or key has no default.
 */
function getSchemaDefault(kebabType: string, settingKey: string): unknown {
  const camelType = LIQUID_TO_CAMEL_SECTION_TYPE[kebabType];
  if (!camelType) return undefined;
  const schema = BUILT_IN_SECTION_SCHEMAS[camelType as BuiltInThemeSectionType];
  if (!schema) return undefined;
  const defaults = schema.defaults as Record<string, unknown> | undefined;
  if (!defaults) return undefined;
  return defaults[settingKey];
}

/** True for setting keys that bind the section to a specific DB entity. */
function isResourceBindingKey(key: string): boolean {
  if (EXPLICIT_RESOURCE_BINDING_KEYS.has(key)) return true;
  // camelCase patterns: ends with 'Handle' or 'Id' (e.g. vendorId, productHandle)
  if (key.endsWith('Handle') || (key.endsWith('Id') && key.length > 3)) return true;
  // snake_case patterns
  if (key.endsWith('_handle') || key.endsWith('_id')) return true;
  return false;
}

/**
 * Classify a single setting key+value pair.
 * Precedence (highest first):
 *   1. TOKEN keys
 *   2. RESOURCE-BINDING key patterns
 *   3. GENERATED-PLACEHOLDER (empty or === schemaDefault)
 *   4. MERCHANT-CONTENT (everything else)
 */
function classifySetting(
  key: string,
  value: unknown,
  kebabType: string,
): SettingClass {
  if (TOKEN_KEYS.has(key)) return 'token';
  if (isResourceBindingKey(key)) return 'resource-binding';
  const schemaDefault = getSchemaDefault(kebabType, key);
  if (value === '' || value === null || value === undefined) return 'generated-placeholder';
  if (value === schemaDefault) return 'generated-placeholder';
  return 'merchant-content';
}

/**
 * True if a block is APP-OWNED (type starts with '@' or is in block_definitions).
 * The @app pattern covers LiquidAppBlock entries.
 */
function isAppOwnedBlock(
  block: ThemeDocumentBlock,
  blockDefinitions: Record<string, unknown>,
): boolean {
  return block.type.startsWith('@') || block.type in blockDefinitions;
}

/**
 * True if the section definition at kebabType accepts @app blocks.
 * We check the section's schema.blocks list for any entry with type === '@app'.
 */
function sectionAcceptsAppBlocks(
  kebabType: string,
  sectionDefinitions: Record<string, unknown>,
): boolean {
  const sectionDef = sectionDefinitions[kebabType] as
    | { schema?: { blocks?: Array<{ type: string }> } }
    | undefined;
  if (!sectionDef?.schema?.blocks) return false;
  return sectionDef.schema.blocks.some((b) => b.type === '@app');
}

/** Deep clone a ThemeDocument via JSON round-trip (deterministic, no Date.now). */
function deepCloneDocument(doc: ThemeDocument): ThemeDocument {
  return JSON.parse(JSON.stringify(doc)) as ThemeDocument;
}

// ── Diff computation ──────────────────────────────────────────────────────────

/**
 * Compute the settings_data.current diff (the 10 token keys + any others that
 * would be written). Pure — does not mutate the input document.
 */
function computeSettingsDiff(
  current: Record<string, unknown>,
  experienceId: string,
): SettingsDiffEntry[] {
  const experience = getExperience(experienceId);
  if (!experience) return [];
  const overlay = buildExperienceSettingsOverlay(experience);
  const entries: SettingsDiffEntry[] = [];
  for (const [key, newValue] of Object.entries(overlay)) {
    const previousValue = current[key];
    if (previousValue !== newValue) {
      entries.push({
        key,
        previousValue,
        newValue,
        classification: 'token',
      });
    }
  }
  return entries;
}

/**
 * Compute the section diff for a single managed template.
 * Pure — does not mutate anything.
 */
function computeTemplateDiff(
  oldSections: ThemeDocumentSection[],
  specs: SectionSpec[],
  sectionDefinitions: Record<string, unknown>,
  blockDefinitions: Record<string, unknown>,
  preserveContent: boolean,
): {
  diffEntries: SectionDiffEntry[];
  hasContentLoss: boolean;
  requiresDuplicate: boolean;
} {
  const diffEntries: SectionDiffEntry[] = [];
  let hasContentLoss = false;
  let requiresDuplicate = false;

  // Build a map of old sections by kebab type (first match wins for same-type duplicates).
  // Also track which old section types appear in the new composition.
  const oldByKebabType = new Map<string, { section: ThemeDocumentSection; index: number }>();
  for (let i = 0; i < oldSections.length; i++) {
    const s = oldSections[i];
    if (!oldByKebabType.has(s.type)) {
      oldByKebabType.set(s.type, { section: s, index: i });
    }
  }

  // Track which old section types were matched by the composition (to find removed ones).
  const matchedOldKebabTypes = new Set<string>();
  // Track effective composition position (after skipping incompatible).
  let compositionIndex = 0;

  for (const spec of specs) {
    const kebab = resolveLiquidSectionType(spec.type, sectionDefinitions);

    if (kebab === null) {
      // Incompatible: type not in section_definitions.
      const attempted = BUILT_IN_TO_LIQUID_SECTION_TYPE[spec.type] ?? spec.type;
      diffEntries.push({
        sectionId: spec.id,
        type: attempted,
        action: 'incompatible',
        incompatibleReason: `Section type '${attempted}' is not present in section_definitions. `
          + `Add the Liquid section file to make this Experience composition fully compatible.`,
      });
      continue; // Do NOT count against compositionIndex.
    }

    const oldEntry = oldByKebabType.get(kebab);

    if (!oldEntry) {
      // New section type — added.
      diffEntries.push({
        sectionId: spec.id,
        type: kebab,
        action: 'added',
        newSettings: spec.settings,
      });
    } else {
      matchedOldKebabTypes.add(kebab);
      const oldIndex = oldEntry.index;
      const action = oldIndex === compositionIndex ? 'retained' : 'reordered';

      // When preserveContent=false, ALL blocks in retained sections are discarded
      // (the apply engine skips the block-migration path entirely). Surface every
      // lost block in the diff so the caller can offer "duplicate before apply".
      // Note: we only exclude true @app sentinel blocks (b.type.startsWith('@')),
      // because those are not merchant data — they are dynamic app extensions.
      // Reusable block types (in block_definitions) and inline block types are
      // merchant content and must be reported as lost.
      let retainedLostContent: SectionDiffEntry['lostContent'] | undefined;
      if (!preserveContent && oldEntry.section.blocks.length > 0) {
        const lostBlocks = oldEntry.section.blocks
          .filter((b) => !b.type.startsWith('@'))
          .map((b) => ({ id: b.id, type: b.type, settings: b.settings }));
        if (lostBlocks.length > 0) {
          retainedLostContent = { blocks: lostBlocks };
          hasContentLoss = true;
          requiresDuplicate = true;
        }
      }

      diffEntries.push({
        sectionId: spec.id,
        type: kebab,
        action,
        previousIndex: action === 'reordered' ? oldIndex : undefined,
        lostContent: retainedLostContent,
      });
    }

    compositionIndex++;
  }

  // Find removed sections (old sections whose kebab type wasn't matched by any composition spec).
  for (const s of oldSections) {
    if (!matchedOldKebabTypes.has(s.type)) {
      // Check for content loss in this removed section.
      const lostSettings: Record<string, unknown> = {};
      let hasNonPlaceholderSettings = false;

      for (const [key, value] of Object.entries(s.settings)) {
        const cls = classifySetting(key, value, s.type);
        if (cls === 'merchant-content' || cls === 'resource-binding') {
          lostSettings[key] = value;
          hasNonPlaceholderSettings = true;
        }
      }

      // Check for APP-OWNED blocks in this removed section.
      const lostAppBlocks: Array<{ id: string; type: string; settings: Record<string, unknown> }> = [];
      for (const b of s.blocks) {
        if (isAppOwnedBlock(b, blockDefinitions)) {
          lostAppBlocks.push({ id: b.id, type: b.type, settings: b.settings });
        }
      }

      const hasMeaningfulLoss = hasNonPlaceholderSettings || lostAppBlocks.length > 0;

      if (hasMeaningfulLoss) {
        hasContentLoss = true;
        // Raise requiresDuplicate regardless of preserveContent: the flag means
        // "content would be permanently lost if this apply proceeds without a
        // duplicate first", which is true whether or not content migration is
        // attempted on other sections.
        requiresDuplicate = true;
      }

      diffEntries.push({
        sectionId: s.id,
        type: s.type,
        action: 'removed',
        lostContent: hasMeaningfulLoss
          ? {
              settings: hasNonPlaceholderSettings ? lostSettings : undefined,
              blocks: lostAppBlocks.length > 0 ? lostAppBlocks : undefined,
            }
          : undefined,
      });
    }
  }

  return { diffEntries, hasContentLoss, requiresDuplicate };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the diff between a ThemeDocument and the result of applying an
 * experience in the given mode. Pure and idempotent — never touches the input
 * document.
 *
 * Use this as a PREVIEW before applying: inspect diff.requiresDuplicateBeforeApply
 * and diff.summary.contentAtRisk to decide whether to prompt the merchant to
 * duplicate the theme first.
 */
export function computeExperienceApplyDiff(
  document: ThemeDocument,
  experienceId: string,
  options: ExperienceApplyOptions,
): ExperienceApplyDiff {
  const preserveContent = options.preserveContent ?? true;
  const mode = options.mode;

  const experience = getExperience(experienceId);
  if (!experience) {
    throw new Error(
      `Unknown experience id '${experienceId}'. `
      + `Available ids are registered in EXPERIENCE_REGISTRY (theme-presets.ts).`,
    );
  }

  // Settings diff (always computed — both modes update settings_data.current).
  const current = document.config.settings_data.current;
  const settingsDiff = computeSettingsDiff(current, experienceId);

  const templateDiffs: ExperienceApplyDiff['templates'] = {};
  let globalRequiresDuplicate = false;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalReordered = 0;
  let totalRetained = 0;
  let totalContentAtRisk = 0;

  if (mode === 'COMPLETE_DESIGN') {
    const composition = EXPERIENCE_COMPOSITIONS[experienceId];
    if (!composition) {
      throw new Error(
        `No composition defined for experience '${experienceId}'. `
        + `Add it to EXPERIENCE_COMPOSITIONS in experience-compositions.ts.`,
      );
    }

    const managedCompositions: Record<string, SectionSpec[]> = {
      index: composition.index,
      product: composition.product,
      collection: composition.collection,
    };

    for (const [templateKey, specs] of Object.entries(managedCompositions)) {
      const template = document.templates.find((t) => t.key === templateKey);
      if (!template) continue; // Template not present in this document — skip.

      const { diffEntries, hasContentLoss, requiresDuplicate } = computeTemplateDiff(
        template.sections,
        specs,
        document.section_definitions,
        document.block_definitions,
        preserveContent,
      );

      if (requiresDuplicate) globalRequiresDuplicate = true;

      const removed = diffEntries.filter((e) => e.action === 'removed');
      const added = diffEntries.filter((e) => e.action === 'added');
      const reordered = diffEntries.filter((e) => e.action === 'reordered');
      const retained = diffEntries.filter((e) => e.action === 'retained');
      // contentAtRisk counts every entry (removed OR retained/reordered) that
      // carries a lostContent payload — i.e. every section where applying this
      // experience would discard merchant data.
      const contentAtRisk = diffEntries.filter((e) => e.lostContent !== undefined).length;

      totalAdded += added.length;
      totalRemoved += removed.length;
      totalReordered += reordered.length;
      totalRetained += retained.length;
      totalContentAtRisk += contentAtRisk;

      templateDiffs[templateKey] = {
        sections: diffEntries,
        hasContentLoss,
      };
    }
  }

  return {
    experienceId,
    mode,
    templates: templateDiffs,
    settings: settingsDiff,
    requiresDuplicateBeforeApply: globalRequiresDuplicate,
    summary: {
      sectionsAdded: totalAdded,
      sectionsRemoved: totalRemoved,
      sectionsReordered: totalReordered,
      sectionsRetained: totalRetained,
      settingsChanged: settingsDiff.length,
      contentAtRisk: totalContentAtRisk,
    },
  };
}

/**
 * Apply an experience to a ThemeDocument (V2), returning the updated document
 * and the computed diff.
 *
 * STYLE_ONLY: merges the 10-key token overlay into config.settings_data.current.
 *   Templates are not touched.
 *
 * COMPLETE_DESIGN: applies STYLE_ONLY token update, then rebuilds the 'index',
 *   'product', and 'collection' templates using EXPERIENCE_COMPOSITIONS.
 *   Other templates (cart, search, customers/*, etc.) are NEVER touched.
 *   section_definitions, block_definitions, layout, locales, and renderer
 *   are NEVER mutated (RISK-DUAL-N01).
 *
 * The returned document is validated by parseThemeDocument() before return.
 * An incompatible section type (absent from section_definitions) is skipped
 * and reported as 'incompatible' in the diff — it is never added to the
 * template (which would cause parseThemeDocument to throw).
 *
 * DETERMINISM: same (document, experienceId, options) → same output every call.
 *
 * @throws if experienceId is not in EXPERIENCE_REGISTRY.
 * @throws if the resulting document fails parseThemeDocument() validation
 *   (indicates a bug in the apply engine — should not happen in normal usage).
 */
export function applyExperienceToDocument(
  document: ThemeDocument,
  experienceId: string,
  options: ExperienceApplyOptions,
): ExperienceApplyResult {
  const preserveContent = options.preserveContent ?? true;
  const mode = options.mode;

  const experience = getExperience(experienceId);
  if (!experience) {
    throw new Error(
      `Unknown experience id '${experienceId}'. `
      + `Available ids are registered in EXPERIENCE_REGISTRY (theme-presets.ts).`,
    );
  }

  // ── 1. Deep clone (ensures input document is never mutated) ────────────────
  const cloned = deepCloneDocument(document);

  // ── 2. Token overlay (both modes) ─────────────────────────────────────────
  const rawOverlay = buildExperienceSettingsOverlay(experience);
  const validation = validateExperienceOverlay(rawOverlay);
  if (!validation.ok) {
    // G6 guard: malformed overlay → return document unchanged.
    console.warn(
      `[experience-apply] experience '${experienceId}' produced invalid overlay; apply skipped: `
      + validation.issues.join('; '),
    );
    const diff = computeExperienceApplyDiff(document, experienceId, options);
    return { document: cloned, diff };
  }

  // Merge overlay into settings_data.current.
  cloned.config.settings_data.current = {
    ...cloned.config.settings_data.current,
    ...validation.overlay,
  } as Record<string, ThemeBundleJson>;

  // ── 3. Template rebuild (COMPLETE_DESIGN only) ────────────────────────────
  if (mode === 'COMPLETE_DESIGN') {
    const composition = EXPERIENCE_COMPOSITIONS[experienceId];
    if (!composition) {
      throw new Error(
        `No composition defined for experience '${experienceId}'. `
        + `Add it to EXPERIENCE_COMPOSITIONS in experience-compositions.ts.`,
      );
    }

    // Build old-section lookup maps BEFORE modifying the clone
    // (we use the ORIGINAL document for source-of-truth content migration).
    const originalTemplates = new Map<string, ThemeDocumentSection[]>();
    for (const t of document.templates) {
      if (MANAGED_TEMPLATE_KEYS.has(t.key)) {
        originalTemplates.set(t.key, t.sections);
      }
    }

    const managedCompositions: Record<string, SectionSpec[]> = {
      index: composition.index,
      product: composition.product,
      collection: composition.collection,
    };

    // Rebuild each managed template in the clone.
    for (const t of cloned.templates) {
      if (!MANAGED_TEMPLATE_KEYS.has(t.key)) continue;
      const specs = managedCompositions[t.key];
      if (!specs) continue;

      const originalSections = originalTemplates.get(t.key) ?? [];

      // Build a map of original sections by kebab type (first match wins).
      const originalByKebabType = new Map<string, ThemeDocumentSection>();
      for (const s of originalSections) {
        if (!originalByKebabType.has(s.type)) {
          originalByKebabType.set(s.type, s);
        }
      }

      const newSections: ThemeDocumentSection[] = [];

      for (const spec_ of specs) {
        const kebab = resolveLiquidSectionType(spec_.type, cloned.section_definitions);
        if (kebab === null) continue; // Incompatible — skip (reported in diff).

        const oldSection = originalByKebabType.get(kebab);

        let finalSettings: Record<string, unknown> = { ...spec_.settings };
        let finalBlocks: ThemeDocumentBlock[] = [];

        if (preserveContent && oldSection) {
          // Carry forward MERCHANT-CONTENT and RESOURCE-BINDING settings.
          for (const [key, value] of Object.entries(oldSection.settings)) {
            const cls = classifySetting(key, value, kebab);
            if (cls === 'merchant-content' || cls === 'resource-binding') {
              finalSettings[key] = value;
            }
          }

          // Carry forward ALL blocks from retained sections.
          // The only block type that requires a section-compatibility check is the
          // literal '@app' sentinel (LiquidAppBlock). All other block types —
          // whether inline-only (defined only in the section schema) or reusable
          // (defined in bundle.blocks / block_definitions) — are merchant content
          // and must always be preserved. Checking isAppOwnedBlock would
          // incorrectly gate reusable block types (e.g. 'category', 'product-card')
          // on sectionAcceptsAppBlocks, which is false for most sections.
          for (const b of oldSection.blocks) {
            if (b.type.startsWith('@')) {
              // True app-block sentinel — carry forward only if section accepts it.
              if (sectionAcceptsAppBlocks(kebab, cloned.section_definitions)) {
                finalBlocks.push(b);
              }
              // else: structural incompatibility; NOT silent loss (the section
              // definition itself rejects app blocks, so there is nothing to lose).
            } else {
              // Inline or reusable block — always merchant content; always preserved.
              finalBlocks.push(b);
            }
          }
        }

        newSections.push({
          id: spec_.id,
          type: kebab,
          settings: finalSettings as Record<string, ThemeBundleJson>,
          disabled: false,
          blocks: finalBlocks,
        });
      }

      t.sections = newSections;
    }
  }

  // ── 4. Validate output (fail-closed: any schema drift is a hard error) ─────
  const validatedDoc = parseThemeDocument(cloned);

  // ── 5. Compute the diff from the ORIGINAL document ────────────────────────
  const diff = computeExperienceApplyDiff(document, experienceId, options);

  return { document: validatedDoc, diff };
}
