import { ProductVariantMetadataSchema, VARIANT_NICHE_FACT_SCHEMAS } from '@letbuyy/commerce-core';
import type { VariantRow } from './product-form-state';

export type VariantFactsNamespace = keyof typeof VARIANT_NICHE_FACT_SCHEMAS;
export const VARIANT_FACT_NAMESPACES = Object.freeze(Object.keys(VARIANT_NICHE_FACT_SCHEMAS) as VariantFactsNamespace[]);

export function isVariantFactsNamespace(value: unknown): value is VariantFactsNamespace {
  return typeof value === 'string' && Object.hasOwn(VARIANT_NICHE_FACT_SCHEMAS, value);
}

/** Read the raw object without validating away incomplete fields or inserting defaults.
 * Only absent metadata is normalized to the empty editor baseline. Invalid top-level
 * shapes require explicit recovery/clear; they must not silently become an empty write.
 */
export function readVariantFactsDraft(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error('Variant facts could not be read. Recover the saved facts or explicitly clear this draft before saving.');
  }
  const entries: [string, unknown][] = [];
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!('value' in descriptor)) throw new Error('Variant facts contain unreadable fields. Your draft is kept.');
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}

/** A child null removes exactly one namespace. Even the final removal returns {},
 * so a changed parent command can explicitly clear old server metadata.
 */
export function updateVariantFactsDraft(value: unknown, namespace: string, next: unknown | null): Record<string, unknown> {
  if (!isVariantFactsNamespace(namespace)) throw new Error('Unsupported variant facts category.');
  const draft = readVariantFactsDraft(value);
  if (next === null) delete draft[namespace];
  else draft[namespace] = next;
  return draft;
}

/** Parent calls before building its existing atomic variant command. Raw drafts
 * remain separate from parsed data; this never mutates a caller's draft/baseline.
 * Unreadable top-level values throw the same recovery error as the raw reader.
 */
export function validateVariantFactsDraft(value: unknown) {
  return ProductVariantMetadataSchema.safeParse(readVariantFactsDraft(value));
}

/** JSON metadata equality ignores object key order, but preserves arrays and clear markers. */
export function variantFactsEqual(left: unknown, right: unknown): boolean {
  const encode = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  try { return encode(left) === encode(right); } catch { return false; }
}
export function variantFactsBaselineKnown(row: VariantRow): boolean {
  return !row.id || (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id) && Object.hasOwn(row, 'factsMetadataBaseline'));
}
export function variantFactsValue(row: VariantRow): unknown {
  return Object.hasOwn(row, 'factsMetadataDraft') ? row.factsMetadataDraft : Object.hasOwn(row, 'factsMetadataBaseline') ? row.factsMetadataBaseline : row.id ? undefined : {};
}
export function hydrateVariantFacts(row: VariantRow, metadata: unknown): VariantRow {
  return { ...row, factsMetadataBaseline: structuredClone(metadata), factsMetadataDraft: structuredClone(metadata), factsMetadataEdited: false };
}
export function editVariantFacts(row: VariantRow, metadata: Record<string, unknown>): VariantRow {
  if (!variantFactsBaselineKnown(row)) throw new Error('Review the latest product before editing restored variant facts.');
  const baseline = Object.hasOwn(row, 'factsMetadataBaseline') ? row.factsMetadataBaseline : {};
  return { ...row, factsMetadataBaseline: baseline, factsMetadataDraft: metadata, factsMetadataEdited: !variantFactsEqual(baseline, metadata) };
}
export function variantFactsCommand(row: VariantRow): { metadata?: ReturnType<typeof ProductVariantMetadataSchema.parse> } {
  if (!variantFactsBaselineKnown(row)) {
    if (row.factsMetadataEdited || Object.hasOwn(row, 'factsMetadataDraft')) throw new Error('Review the latest product before saving restored variant facts.');
    return {};
  }
  const baseline = Object.hasOwn(row, 'factsMetadataBaseline') ? row.factsMetadataBaseline : {};
  const draft = variantFactsValue(row);
  if (variantFactsEqual(baseline, draft)) return {};
  const result = validateVariantFactsDraft(draft);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Check variant facts (${row.title}${issue.path.length ? ` / ${issue.path.join(' / ')}` : ''}): ${issue.message}`);
  }
  return { metadata: result.data };
}

/** Retain newer raw values only with their existing durable UUID, never a label/SKU. */
export function rebaseVariantFacts(rows: VariantRow[], apiRows: unknown[]): VariantRow[] {
  const byId = new Map(apiRows.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)).filter(value => typeof value.id === 'string').map(value => [value.id, value]));
  return rows.map(row => {
    const saved = row.id ? byId.get(row.id) : undefined;
    if (!saved || !variantFactsBaselineKnown(row)) return row;
    const baseline = Object.hasOwn(saved, 'metadata') ? saved.metadata : {};
    const draft = variantFactsValue(row);
    return { ...row, factsMetadataBaseline: structuredClone(baseline), factsMetadataDraft: structuredClone(draft), factsMetadataEdited: !variantFactsEqual(baseline, draft) };
  });
}
export function variantRowsHaveBoundIdentityOrFacts(rows: VariantRow[]): boolean {
  return rows.some(row => row.id || [row.factsMetadataBaseline, row.factsMetadataDraft].some(value => value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0)));
}
