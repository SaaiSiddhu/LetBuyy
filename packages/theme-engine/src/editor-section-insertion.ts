import type { LiquidThemePackageBundle } from './theme-bundle';

export type EditorSectionGroup = 'header' | 'template' | 'footer';
// The editor writes the legacy page projection as well as portable templates.
// Keep its existing server limit; portable-only documents retain their 80 cap.
export const EDITOR_LEGACY_TEMPLATE_SECTION_LIMIT = 50;
export type EditorSectionPosition = 'before' | 'after' | 'end';

export interface EditorSectionInsertionTarget {
  group: EditorSectionGroup;
  templateKey: string;
  position: EditorSectionPosition;
  adjacentSectionId?: string;
}

export interface EditorSectionLike {
  id: string;
  type: string;
  order: number;
}

export type EditorSectionGroups<T extends EditorSectionLike> = Record<EditorSectionGroup, T[]>;

export interface EditorSectionCandidate {
  type: string;
  name: string;
  description: string;
  category: string;
  presetName: string;
  available: boolean;
  reason?: string;
}

export interface EditorSectionInsertionResult<T extends EditorSectionLike> {
  sections: EditorSectionGroups<T>;
  inserted: boolean;
  reason?: string;
}

export type EditorSectionEligibility = LiquidThemePackageBundle['sections'][string]['schema'];

function templateMatches(values: readonly string[], key: string): boolean {
  return values.includes('*') || values.includes(key);
}

export function sectionDefinitionAllowsGroup(
  schema: EditorSectionEligibility,
  group: EditorSectionGroup,
  templateKey: string,
): boolean {
  const enabledGroups = schema.enabled_on?.groups ?? ['template'];
  const disabledGroups = schema.disabled_on?.groups ?? [];
  if (!enabledGroups.includes(group) || disabledGroups.includes(group)) return false;
  return group !== 'template' || (
    templateMatches(schema.enabled_on?.templates ?? ['*'], templateKey) &&
    !templateMatches(schema.disabled_on?.templates ?? [], templateKey)
  );
}

/**
 * The installed Liquid bundle is the eligibility authority. A template wildcard never
 * grants access to a shared Header/Footer group; those require an explicit group grant.
 */
export function sectionInsertionRefusal<T extends EditorSectionLike>(
  bundle: LiquidThemePackageBundle | null,
  sections: EditorSectionGroups<T>,
  selectedTemplateKey: string,
  target: EditorSectionInsertionTarget,
  sectionType: string,
): string | null {
  if (!bundle) return 'The installed Liquid theme is unavailable.';
  if (target.templateKey !== selectedTemplateKey) return 'The selected template changed. Choose an insertion point again.';
  if (!Object.hasOwn(bundle.templates, selectedTemplateKey)) return 'This template is not installed in the theme.';
  if (target.group !== 'template' && !Object.hasOwn(bundle.templates, target.group)) return `This theme has no ${target.group} group.`;

  const siblings = sections[target.group];
  if (!Array.isArray(siblings)) return 'The section group is unavailable.';
  if (target.position === 'end') {
    if (target.adjacentSectionId) return 'An end insertion cannot name an adjacent section.';
  } else if (target.position !== 'before' && target.position !== 'after') {
    return 'The insertion position is invalid.';
  } else if (!target.adjacentSectionId || !siblings.some((entry) => entry.id === target.adjacentSectionId)) {
    return 'The insertion point is stale. Choose a section in this group again.';
  }

  const file = bundle.sections[sectionType];
  if (!file || sectionType === 'app-block-slot') return 'This section is not available for insertion.';
  const schema = file.schema;
  if (!schema.presets.length) return 'This section has no addable preset.';
  if (!sectionDefinitionAllowsGroup(schema, target.group, selectedTemplateKey))
    return `This section is not enabled in the ${target.group} group or selected template.`;
  const maximum = target.group === 'template' ? EDITOR_LEGACY_TEMPLATE_SECTION_LIMIT : 80;
  if (siblings.length >= maximum) return `This section group has reached its ${maximum} section limit.`;
  if (schema.limit && siblings.filter((entry) => entry.type === sectionType).length >= schema.limit) {
    return `Only ${schema.limit} ${schema.name} section${schema.limit === 1 ? '' : 's'} may be added here.`;
  }
  return null;
}

export function listEditorSectionCandidates<T extends EditorSectionLike>(
  bundle: LiquidThemePackageBundle | null,
  sections: EditorSectionGroups<T>,
  selectedTemplateKey: string,
  target: EditorSectionInsertionTarget,
): EditorSectionCandidate[] {
  if (!bundle) return [];
  return Object.entries(bundle.sections)
    .filter(([type]) => type !== 'app-block-slot')
    .map(([type, file]) => {
      const preset = file.schema.presets[0];
      const reason = sectionInsertionRefusal(bundle, sections, selectedTemplateKey, target, type);
      return {
        type,
        name: file.schema.name,
        description: preset?.name || file.schema.name,
        category: preset?.category || 'Sections',
        presetName: preset?.name || '',
        available: reason === null,
        ...(reason ? { reason } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Immutable exact-position mutation. The caller creates the instance from the same schema. */
export function insertEditorSection<T extends EditorSectionLike>(
  bundle: LiquidThemePackageBundle | null,
  sections: EditorSectionGroups<T>,
  selectedTemplateKey: string,
  target: EditorSectionInsertionTarget,
  section: T,
): EditorSectionInsertionResult<T> {
  const refusal = sectionInsertionRefusal(bundle, sections, selectedTemplateKey, target, section.type);
  if (refusal) return { sections, inserted: false, reason: refusal };
  if (!section.id || Object.values(sections).some((group) => group.some((entry) => entry.id === section.id))) {
    return { sections, inserted: false, reason: 'The new section ID is missing or already used.' };
  }

  const siblings = sections[target.group];
  const anchorIndex = target.position === 'end'
    ? siblings.length
    : siblings.findIndex((entry) => entry.id === target.adjacentSectionId);
  // The refusal check above requires this anchor; recheck at the mutation boundary.
  if (anchorIndex < 0) return { sections, inserted: false, reason: 'The insertion point is stale.' };
  const index = target.position === 'after' ? anchorIndex + 1 : anchorIndex;
  const next = [...siblings];
  next.splice(index, 0, section);
  return {
    inserted: true,
    sections: {
      ...sections,
      [target.group]: next.map((entry, i) => ({ ...entry, order: (i + 1) * 10 })),
    },
  };
}
