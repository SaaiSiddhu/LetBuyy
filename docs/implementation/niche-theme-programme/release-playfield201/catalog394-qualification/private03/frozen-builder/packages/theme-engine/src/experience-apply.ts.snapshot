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
//     Destruction is a MODE, never a side effect — see ExperienceApplyMode:
//     STYLE_ONLY and COMPOSE_ADDITIVE cannot remove a section; only
//     COMPLETE_DESIGN can, and the caller has to name it to get it.
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
import {
  EXPERIENCE_TEMPLATE_KEYS,
  getExperienceComposition,
  type ExperienceTemplateKey,
  type SectionSpec,
} from './experience-compositions';

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * How much of an Experience to apply. The mode IS the content-safety contract:
 *
 *  - `STYLE_ONLY` — write the 10-key token overlay into settings_data.current.
 *    Templates are not read or written. Nothing can be lost.
 *
 *  - `COMPOSE_ADDITIVE` — tokens PLUS the section composition, applied as
 *    add + reorder only. Composition sections the template lacks are added;
 *    sections it already has are reordered into the composition's order and keep
 *    their id, merchant settings and blocks. Every section the composition does
 *    not claim is KEPT (appended after the composed run, in its original relative
 *    order). Nothing is ever removed, so `requiresDuplicateBeforeApply` is always
 *    false and `preserveContent` is implied (a `preserveContent: false` is ignored
 *    — replacement is what COMPLETE_DESIGN is for). This is the mode a merchant
 *    UI should use for "apply this Experience".
 *
 *  - `COMPLETE_DESIGN` — tokens PLUS the composition as the WHOLE template: the
 *    managed templates become exactly the composition, so any merchant-authored
 *    section outside it is REMOVED. DESTRUCTIVE, and therefore opt-in by name.
 *    Preview it with computeExperienceApplyDiff() and offer "duplicate the theme
 *    first" whenever `requiresDuplicateBeforeApply` is true.
 */
export type ExperienceApplyMode = 'STYLE_ONLY' | 'COMPOSE_ADDITIVE' | 'COMPLETE_DESIGN';

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

/**
 * What happens to one section when the experience is applied.
 *
 *  - `added`        — composition section the template did not have.
 *  - `retained`     — composition section already at the target position.
 *  - `reordered`    — composition section that moves to a new position.
 *  - `removed`      — merchant section dropped (COMPLETE_DESIGN only).
 *  - `kept`         — merchant section the composition does not claim, preserved
 *                     as-is after the composed run (COMPOSE_ADDITIVE only).
 *  - `incompatible` — composition section whose type the bundle does not ship;
 *                     skipped, never written.
 */
export type SectionDiffAction =
  | 'added'
  | 'removed'
  | 'reordered'
  | 'retained'
  | 'kept'
  | 'incompatible';

/** Diff entry for a single section change within a template. */
export interface SectionDiffEntry {
  /** The section's id in the RESULT (added/retained/reordered/kept) or in the OLD template (removed). */
  sectionId: string;
  /** Kebab-case Liquid section type as resolved. */
  type: string;
  action: SectionDiffAction;
  /**
   * Settings/blocks that would be lost.
   * For 'removed' entries: populated whenever the section has merchant-content,
   * resource-binding, or app-owned content, regardless of preserveContent.
   * For 'retained'/'reordered' entries: populated only when preserveContent=false
   * and the section has non-@app blocks that would be discarded.
   * Never populated for 'kept' — COMPOSE_ADDITIVE loses nothing.
   */
  lostContent?: {
    settings?: Record<string, unknown>;
    blocks?: Array<{ id: string; type: string; settings: Record<string, unknown> }>;
  };
  /** For 'added': placeholder settings applied from the SectionSpec. */
  newSettings?: Record<string, unknown>;
  /** For 'reordered' / 'kept' / 'removed': the section's index in the OLD template. */
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
   * Always false for STYLE_ONLY and COMPOSE_ADDITIVE — neither can destroy content.
   */
  requiresDuplicateBeforeApply: boolean;
  summary: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsReordered: number;
    sectionsRetained: number;
    /** Merchant sections preserved outside the composition (COMPOSE_ADDITIVE only). */
    sectionsKept: number;
    settingsChanged: number;
    contentAtRisk: number;
  };
}

/** Options controlling apply behaviour. */
export interface ExperienceApplyOptions {
  mode: ExperienceApplyMode;
  /**
   * When true (default), section settings classified as MERCHANT-CONTENT or
   * RESOURCE-BINDING are carried forward from the matched old section onto the
   * composed section, and its blocks are carried with it.
   * When false, section settings are replaced with the composition placeholders
   * and the old blocks are dropped — reported as lostContent in the diff.
   *
   * Only COMPLETE_DESIGN honours `false`; COMPOSE_ADDITIVE always preserves.
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

/** Return value of composeExperienceTemplateSections — one template's composed result. */
export interface ExperienceTemplateComposeResult {
  /** The template's new ordered section list. Never aliases the input sections. */
  sections: ThemeDocumentSection[];
  /** One entry per section change, in result order followed by removed/kept entries. */
  diff: SectionDiffEntry[];
  /** True when at least one entry carries a lostContent payload. */
  hasContentLoss: boolean;
  /** True when merchant content would be permanently lost — prompt to duplicate first. */
  requiresDuplicate: boolean;
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
  if (!Object.prototype.hasOwnProperty.call(LIQUID_TO_CAMEL_SECTION_TYPE, kebabType)) return undefined;
  const camelType = LIQUID_TO_CAMEL_SECTION_TYPE[kebabType];
  const schema = BUILT_IN_SECTION_SCHEMAS[camelType as BuiltInThemeSectionType];
  if (!schema) return undefined;
  const defaults = schema.defaults as Record<string, unknown> | undefined;
  if (!defaults) return undefined;
  if (!Object.prototype.hasOwnProperty.call(defaults, settingKey)) return undefined;
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
  return block.type.startsWith('@')
    || Object.prototype.hasOwnProperty.call(blockDefinitions, block.type);
}

/**
 * True if the section definition at kebabType accepts @app blocks.
 * We check the section's schema.blocks list for any entry with type === '@app'.
 */
function sectionAcceptsAppBlocks(
  kebabType: string,
  sectionDefinitions: Record<string, unknown>,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(sectionDefinitions, kebabType)) return false;
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

/** Deep clone a section list, so composed output never aliases the caller's input. */
function cloneSections(sections: readonly ThemeDocumentSection[]): ThemeDocumentSection[] {
  return JSON.parse(JSON.stringify(sections)) as ThemeDocumentSection[];
}

/**
 * Return `desired`, or the first '{desired}-{n}' (n ≥ 2) that is free.
 * COMPOSE_ADDITIVE keeps every merchant section id, so a composition id could in
 * principle collide with one; two sections sharing an id collapse into one when the
 * document is written back to the bundle's keyed `sections` map. Deterministic, and
 * a no-op in the common case (re-applying an experience re-matches its own sections
 * by type and reuses their ids).
 */
function uniqueSectionId(desired: string, taken: ReadonlySet<string>): string {
  if (!taken.has(desired)) return desired;
  let suffix = 2;
  while (taken.has(`${desired}-${suffix}`)) suffix++;
  return `${desired}-${suffix}`;
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
 * THE compose path (THEME-R3): produces a managed template's new section list AND the
 * diff entries describing how it was produced. Preview and apply both go through this
 * one function, so the diff a merchant approves is exactly what gets written.
 *
 * Pure — the input sections are cloned up front, so neither the returned sections nor
 * the lostContent payloads alias the caller's document.
 */
function composeTemplateSections(
  currentSections: readonly ThemeDocumentSection[],
  specs: readonly SectionSpec[],
  sectionDefinitions: Record<string, unknown>,
  blockDefinitions: Record<string, unknown>,
  mode: Exclude<ExperienceApplyMode, 'STYLE_ONLY'>,
  preserveContent: boolean,
): ExperienceTemplateComposeResult {
  const additive = mode === 'COMPOSE_ADDITIVE';
  // COMPOSE_ADDITIVE is the non-destructive mode by definition, so content migration is
  // not negotiable there — an explicit preserveContent:false only applies to the mode
  // that is allowed to replace, COMPLETE_DESIGN.
  const carryContent = additive || preserveContent;
  const oldSections = cloneSections(currentSections);

  const sections: ThemeDocumentSection[] = [];
  const diff: SectionDiffEntry[] = [];
  let hasContentLoss = false;
  let requiresDuplicate = false;

  // Match a spec to the FIRST old section of the same kebab type. Claims are tracked by
  // INDEX, not by type: that is what makes a second same-typed section (two rich-content
  // sections, say) visible as its own outcome instead of being swallowed by the first
  // one's match and silently dropped.
  const firstIndexByType = new Map<string, number>();
  for (let i = 0; i < oldSections.length; i++) {
    if (!firstIndexByType.has(oldSections[i].type)) firstIndexByType.set(oldSections[i].type, i);
  }
  const claimedIndices = new Set<number>();
  // COMPOSE_ADDITIVE keeps every merchant section (and its id), so composition ids have
  // to be checked against them. COMPLETE_DESIGN writes only composition ids, which the
  // composition guarantees are unique.
  const usedIds = new Set<string>(additive ? oldSections.map((s) => s.id) : []);

  for (const spec of specs) {
    const kebab = resolveLiquidSectionType(spec.type, sectionDefinitions);

    if (kebab === null) {
      // Incompatible: the bundle does not ship this section. Skipped entirely — it never
      // enters the template (which would fail parseThemeDocument) and never occupies a
      // position, so the remaining sections still compose in their intended order.
      const attempted = BUILT_IN_TO_LIQUID_SECTION_TYPE[spec.type] ?? spec.type;
      diff.push({
        sectionId: spec.id,
        type: attempted,
        action: 'incompatible',
        incompatibleReason: `Section type '${attempted}' is not present in section_definitions. `
          + `Add the Liquid section file to make this Experience composition fully compatible.`,
      });
      continue;
    }

    const oldIndex = firstIndexByType.get(kebab);
    const oldSection = oldIndex === undefined ? undefined : oldSections[oldIndex];
    if (oldIndex !== undefined) claimedIndices.add(oldIndex);

    const settings: Record<string, unknown> = { ...spec.settings };
    const blocks: ThemeDocumentBlock[] = [];
    let disabled = false;
    let lostContent: SectionDiffEntry['lostContent'] | undefined;

    if (oldSection && carryContent) {
      // Carry forward MERCHANT-CONTENT and RESOURCE-BINDING settings over the placeholders.
      for (const [key, value] of Object.entries(oldSection.settings)) {
        const cls = classifySetting(key, value, kebab);
        if (cls === 'merchant-content' || cls === 'resource-binding') {
          settings[key] = value;
        }
      }

      // Carry forward ALL blocks. The only block type that requires a section-compatibility
      // check is the literal '@app' sentinel (LiquidAppBlock). Every other block type —
      // inline-only (defined in the section schema) or reusable (defined in
      // block_definitions) — is merchant content and must always survive. Gating those on
      // sectionAcceptsAppBlocks would wrongly discard 'category', 'product-card', ….
      for (const b of oldSection.blocks) {
        if (b.type.startsWith('@')) {
          // True app-block sentinel — carry forward only if the section accepts it.
          // Otherwise the section definition itself rejects it: a structural
          // incompatibility, not silent loss of merchant data.
          if (sectionAcceptsAppBlocks(kebab, sectionDefinitions)) blocks.push(b);
        } else {
          blocks.push(b);
        }
      }

      // A merchant who hid this section meant it; re-enabling it on apply would be an
      // unrequested content change.
      disabled = oldSection.disabled;
    } else if (oldSection && oldSection.blocks.length > 0) {
      // preserveContent=false under COMPLETE_DESIGN: blocks are NOT carried. Surface every
      // one of them so the caller can offer "duplicate before applying". Only the '@app'
      // sentinel is excluded — it is a dynamic app extension, not merchant data.
      const lostBlocks = oldSection.blocks
        .filter((b) => !b.type.startsWith('@'))
        .map((b) => ({ id: b.id, type: b.type, settings: b.settings }));
      if (lostBlocks.length > 0) {
        lostContent = { blocks: lostBlocks };
        hasContentLoss = true;
        requiresDuplicate = true;
      }
    }

    const newIndex = sections.length;
    const action: SectionDiffAction = oldSection === undefined
      ? 'added'
      : (oldIndex === newIndex ? 'retained' : 'reordered');
    // Additive keeps the merchant's section id (editor selection, app-block wiring and any
    // external reference stay valid, and a re-apply is idempotent); replace uses the
    // composition's stable id.
    const id = oldSection && additive ? oldSection.id : uniqueSectionId(spec.id, usedIds);
    usedIds.add(id);

    sections.push({
      id,
      type: kebab,
      settings: settings as Record<string, ThemeBundleJson>,
      disabled,
      blocks,
    });

    const entry: SectionDiffEntry = { sectionId: id, type: kebab, action };
    if (action === 'added') entry.newSettings = spec.settings;
    if (action === 'reordered') entry.previousIndex = oldIndex;
    if (lostContent) entry.lostContent = lostContent;
    diff.push(entry);
  }

  // Every old section the composition did not claim: kept (additive) or removed (replace).
  for (let i = 0; i < oldSections.length; i++) {
    if (claimedIndices.has(i)) continue;
    const s = oldSections[i];

    if (additive) {
      sections.push(s);
      diff.push({ sectionId: s.id, type: s.type, action: 'kept', previousIndex: i });
      continue;
    }

    // Classify what disappears with this section.
    const lostSettings: Record<string, unknown> = {};
    let hasNonPlaceholderSettings = false;
    for (const [key, value] of Object.entries(s.settings)) {
      const cls = classifySetting(key, value, s.type);
      if (cls === 'merchant-content' || cls === 'resource-binding') {
        lostSettings[key] = value;
        hasNonPlaceholderSettings = true;
      }
    }

    const lostAppBlocks: Array<{ id: string; type: string; settings: Record<string, unknown> }> = [];
    for (const b of s.blocks) {
      if (isAppOwnedBlock(b, blockDefinitions)) {
        lostAppBlocks.push({ id: b.id, type: b.type, settings: b.settings });
      }
    }

    const hasMeaningfulLoss = hasNonPlaceholderSettings || lostAppBlocks.length > 0;
    if (hasMeaningfulLoss) {
      hasContentLoss = true;
      // Raised regardless of preserveContent: the flag means "content would be permanently
      // lost if this apply proceeds without a duplicate first", which is true whether or
      // not content migration is attempted on the sections that do survive.
      requiresDuplicate = true;
    }

    const entry: SectionDiffEntry = {
      sectionId: s.id,
      type: s.type,
      action: 'removed',
      previousIndex: i,
    };
    if (hasMeaningfulLoss) {
      entry.lostContent = {
        settings: hasNonPlaceholderSettings ? lostSettings : undefined,
        blocks: lostAppBlocks.length > 0 ? lostAppBlocks : undefined,
      };
    }
    diff.push(entry);
  }

  return { sections, diff, hasContentLoss, requiresDuplicate };
}

// ── Plan (one pass shared by preview and apply) ───────────────────────────────

/** The composed result for every managed template present in the document, plus its diff. */
interface ExperienceApplyPlan {
  /** Keyed by template key; only contains templates the document actually has. */
  composed: Map<string, ExperienceTemplateComposeResult>;
  diff: ExperienceApplyDiff;
}

/** A diff that states "nothing changes" — used by the fail-safe overlay guard. */
function emptyApplyDiff(experienceId: string, mode: ExperienceApplyMode): ExperienceApplyDiff {
  return {
    experienceId,
    mode,
    templates: {},
    settings: [],
    requiresDuplicateBeforeApply: false,
    summary: {
      sectionsAdded: 0,
      sectionsRemoved: 0,
      sectionsReordered: 0,
      sectionsRetained: 0,
      sectionsKept: 0,
      settingsChanged: 0,
      contentAtRisk: 0,
    },
  };
}

/**
 * Resolve the experience + composition and compose every managed template the document
 * has. Both computeExperienceApplyDiff (preview) and applyExperienceToDocument (write)
 * are built on this single pass, so the preview can never disagree with the apply.
 */
function buildExperienceApplyPlan(
  document: ThemeDocument,
  experienceId: string,
  options: ExperienceApplyOptions,
): ExperienceApplyPlan {
  const preserveContent = options.preserveContent ?? true;
  const mode = options.mode;

  if (!getExperience(experienceId)) {
    throw new Error(
      `Unknown experience id '${experienceId}'. `
      + `Available ids are registered in EXPERIENCE_REGISTRY (theme-presets.ts).`,
    );
  }

  // Settings diff (always computed — every mode updates settings_data.current).
  const settingsDiff = computeSettingsDiff(document.config.settings_data.current, experienceId);

  const composed = new Map<string, ExperienceTemplateComposeResult>();
  const templateDiffs: ExperienceApplyDiff['templates'] = {};
  let globalRequiresDuplicate = false;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalReordered = 0;
  let totalRetained = 0;
  let totalKept = 0;
  let totalContentAtRisk = 0;

  if (mode !== 'STYLE_ONLY') {
    const composition = getExperienceComposition(experienceId);
    if (!composition) {
      throw new Error(
        `No composition defined for experience '${experienceId}'. `
        + `Add it to EXPERIENCE_COMPOSITIONS in experience-compositions.ts.`,
      );
    }

    for (const templateKey of EXPERIENCE_TEMPLATE_KEYS) {
      const template = document.templates.find((t) => t.key === templateKey);
      // Template not present in this document — an Experience never CREATES a template,
      // because the bundle (not the experience) owns a template's name and layout.
      if (!template) continue;

      const result = composeTemplateSections(
        template.sections,
        composition[templateKey],
        document.section_definitions,
        document.block_definitions,
        mode,
        preserveContent,
      );
      composed.set(templateKey, result);

      if (result.requiresDuplicate) globalRequiresDuplicate = true;

      for (const entry of result.diff) {
        if (entry.action === 'added') totalAdded++;
        else if (entry.action === 'removed') totalRemoved++;
        else if (entry.action === 'reordered') totalReordered++;
        else if (entry.action === 'retained') totalRetained++;
        else if (entry.action === 'kept') totalKept++;
      }
      // contentAtRisk counts every entry carrying a lostContent payload — i.e. every
      // section where applying this experience would discard merchant data.
      totalContentAtRisk += result.diff.filter((e) => e.lostContent !== undefined).length;

      templateDiffs[templateKey] = {
        sections: result.diff,
        hasContentLoss: result.hasContentLoss,
      };
    }
  }

  return {
    composed,
    diff: {
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
        sectionsKept: totalKept,
        settingsChanged: settingsDiff.length,
        contentAtRisk: totalContentAtRisk,
      },
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compose ONE template's sections against an Experience — the primitive
 * applyExperienceToDocument is built on, exposed for callers that hold a single
 * template's section list rather than a whole ThemeDocument.
 *
 * `sections` and `sectionDefinitions` must be in the same type space: section types
 * are the Liquid kebab keys of `section_definitions` (that is what a ThemeDocument
 * stores). A composition section whose type is absent from `sectionDefinitions` is
 * reported as 'incompatible' and never written.
 *
 * STYLE_ONLY returns the sections unchanged with an empty diff — that mode does not
 * touch templates.
 *
 * @throws if experienceId is not in EXPERIENCE_REGISTRY or has no composition.
 */
export function composeExperienceTemplateSections(input: {
  experienceId: string;
  templateKey: ExperienceTemplateKey;
  sections: readonly ThemeDocumentSection[];
  sectionDefinitions: Record<string, unknown>;
  /** Needed only to classify app-owned blocks in removed sections. Defaults to none. */
  blockDefinitions?: Record<string, unknown>;
  options: ExperienceApplyOptions;
}): ExperienceTemplateComposeResult {
  const { experienceId, templateKey, sections, sectionDefinitions, options } = input;

  if (!getExperience(experienceId)) {
    throw new Error(
      `Unknown experience id '${experienceId}'. `
      + `Available ids are registered in EXPERIENCE_REGISTRY (theme-presets.ts).`,
    );
  }
  const composition = getExperienceComposition(experienceId);
  if (!composition) {
    throw new Error(
      `No composition defined for experience '${experienceId}'. `
      + `Add it to EXPERIENCE_COMPOSITIONS in experience-compositions.ts.`,
    );
  }

  if (options.mode === 'STYLE_ONLY') {
    return {
      sections: cloneSections(sections),
      diff: [],
      hasContentLoss: false,
      requiresDuplicate: false,
    };
  }

  return composeTemplateSections(
    sections,
    composition[templateKey],
    sectionDefinitions,
    input.blockDefinitions ?? {},
    options.mode,
    options.preserveContent ?? true,
  );
}

/**
 * Compute the diff between a ThemeDocument and the result of applying an
 * experience in the given mode. Pure and idempotent — never touches the input
 * document.
 *
 * Use this as a PREVIEW before applying: inspect diff.requiresDuplicateBeforeApply
 * and diff.summary.contentAtRisk to decide whether to prompt the merchant to
 * duplicate the theme first. (Both are always false/0 in COMPOSE_ADDITIVE, which
 * cannot destroy content.)
 */
export function computeExperienceApplyDiff(
  document: ThemeDocument,
  experienceId: string,
  options: ExperienceApplyOptions,
): ExperienceApplyDiff {
  return buildExperienceApplyPlan(document, experienceId, options).diff;
}

/**
 * Apply an experience to a ThemeDocument (V2), returning the updated document
 * and the diff that produced it.
 *
 * All modes merge the 10-key token overlay into config.settings_data.current.
 * On top of that:
 *
 * STYLE_ONLY: templates are not touched.
 *
 * COMPOSE_ADDITIVE: the 'index', 'product' and 'collection' templates gain the
 *   experience's composition — missing sections added, shared sections reordered
 *   into the composition order with their id/settings/blocks intact, merchant
 *   sections outside the composition kept after it. Nothing is removed.
 *
 * COMPLETE_DESIGN: those three templates become exactly the composition; merchant
 *   sections outside it are removed (see diff.requiresDuplicateBeforeApply).
 *
 * Other templates (cart, search, customers/*, …) are NEVER touched, and
 * section_definitions, block_definitions, layout, locales and renderer are NEVER
 * mutated (RISK-DUAL-N01). A managed template the document does not have is left
 * alone — an Experience never creates one, because the bundle owns a template's
 * name and layout.
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
  const experience = getExperience(experienceId);
  if (!experience) {
    throw new Error(
      `Unknown experience id '${experienceId}'. `
      + `Available ids are registered in EXPERIENCE_REGISTRY (theme-presets.ts).`,
    );
  }

  // ── 1. Deep clone (ensures input document is never mutated) ────────────────
  const cloned = deepCloneDocument(document);

  // ── 2. Token overlay (every mode) ─────────────────────────────────────────
  const rawOverlay = buildExperienceSettingsOverlay(experience);
  const validation = validateExperienceOverlay(rawOverlay);
  if (!validation.ok) {
    // G6 guard: a malformed overlay must never reach merchant data. Nothing is applied —
    // neither tokens nor sections — so the diff reports exactly that: no changes.
    console.warn(
      `[experience-apply] experience '${experienceId}' produced invalid overlay; apply skipped: `
      + validation.issues.join('; '),
    );
    return { document: cloned, diff: emptyApplyDiff(experienceId, options.mode) };
  }

  // Merge overlay into settings_data.current.
  cloned.config.settings_data.current = {
    ...cloned.config.settings_data.current,
    ...validation.overlay,
  } as Record<string, ThemeBundleJson>;

  // ── 3. Section composition (COMPOSE_ADDITIVE / COMPLETE_DESIGN) ───────────
  // The plan is computed from the ORIGINAL document and is the single source of both
  // the written sections and the returned diff.
  const plan = buildExperienceApplyPlan(document, experienceId, options);
  for (const t of cloned.templates) {
    const composed = plan.composed.get(t.key);
    if (!composed) continue; // Not a managed template, or STYLE_ONLY.
    t.sections = composed.sections;
  }

  // ── 4. Validate output (fail-closed: any schema drift is a hard error) ─────
  const validatedDoc = parseThemeDocument(cloned);

  return { document: validatedDoc, diff: plan.diff };
}
