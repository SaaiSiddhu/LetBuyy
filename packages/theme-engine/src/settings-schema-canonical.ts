// Phase G / G3 — Settings-schema canonicalization (flat <-> 5-group), lossless.
//
// Two settings-schema shapes coexist in production:
//   - CANONICAL 5-group: the frozen `THEME_SETTINGS_SCHEMA` (theme-registry.ts) — groups colors,
//     typography, layout, header, footer, each with named fields.
//   - FLAT one-group: the Urban Kicks DB `settings_schema` (migrations 180-181) puts every field under a
//     single `appearance` group.
//
// The RENDER-time drop already tolerates both (Phase D2 builds grouped sub-objects AND flat keys). This
// module is the SCHEMA-form canonicalizer for the publish/editor path: it maps a flat `settings_data.current`
// value map to the canonical grouped form and back, deterministically and losslessly. The field->group
// index is DERIVED from `THEME_SETTINGS_SCHEMA` at load time, so it can never drift from the frozen schema.
//
// Losslessness rule: any field not present in the canonical schema is preserved under the `appearance`
// catch-all group, so `groupSettingsFields(flattenSettingsData(x))` restores every value `x` carried.

import { THEME_SETTINGS_SCHEMA } from './theme-registry';

// The catch-all group name for values that have no home in the canonical schema. Matches the Urban Kicks
// DB convention (migrations 180-181), so a flat `appearance` group round-trips through here unchanged.
export const CANONICAL_UNMAPPED_GROUP = 'appearance';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// field key -> canonical group key, derived once from the frozen schema.
export const CANONICAL_FIELD_GROUP_INDEX: Readonly<Record<string, string>> = (() => {
  const index: Record<string, string> = {};
  for (const [groupKey, group] of Object.entries(THEME_SETTINGS_SCHEMA.settings)) {
    const fields = (group as { fields?: Record<string, unknown> }).fields ?? {};
    for (const fieldKey of Object.keys(fields)) {
      // First declaration wins; canonical schema has no duplicate field keys across groups.
      if (!(fieldKey in index)) index[fieldKey] = groupKey;
    }
  }
  return Object.freeze(index);
})();

// The ordered canonical group keys plus the catch-all, so callers can render forms in a stable order.
export const CANONICAL_GROUP_ORDER: readonly string[] = Object.freeze([
  ...Object.keys(THEME_SETTINGS_SCHEMA.settings),
  CANONICAL_UNMAPPED_GROUP,
]);

// Flatten any settings shape into a single field->value map.
// - A flat map ({ primaryColor: '#000' }) passes through unchanged.
// - A grouped map ({ colors: { primaryColor: '#000' } }) is walked one level deep: every group whose
//   value is a record contributes its leaf entries. Non-record top-level entries are treated as flat
//   fields (so a mixed map is tolerated). Later groups win on key collision (deterministic, order = input).
export function flattenSettingsData(settings: unknown): Record<string, unknown> {
  if (!isRecord(settings)) return {};
  const flat: Record<string, unknown> = {};
  const groupKeys = new Set<string>(CANONICAL_GROUP_ORDER);
  for (const [key, value] of Object.entries(settings)) {
    if (groupKeys.has(key) && isRecord(value)) {
      for (const [fieldKey, fieldValue] of Object.entries(value)) flat[fieldKey] = fieldValue;
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

// Group a flat field->value map into the canonical 5-group shape. Unknown fields go to `appearance`.
// Empty groups are omitted so the output stays minimal. Lossless inverse of flattenSettingsData for any
// flat input (grouped input is flattened first, so grouping is idempotent through flatten).
export function groupSettingsFields(settings: unknown): Record<string, Record<string, unknown>> {
  const flat = flattenSettingsData(settings);
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const [fieldKey, value] of Object.entries(flat)) {
    const groupKey = CANONICAL_FIELD_GROUP_INDEX[fieldKey] ?? CANONICAL_UNMAPPED_GROUP;
    (grouped[groupKey] ??= {})[fieldKey] = value;
  }
  return grouped;
}
