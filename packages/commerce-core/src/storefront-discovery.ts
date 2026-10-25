import { z } from 'zod';
import { PRODUCT_NICHE_FACT_SCHEMAS, VARIANT_NICHE_FACT_SCHEMAS } from './niche-product-facts';
import { StorefrontDiscoveryQuerySchema, STOREFRONT_DISCOVERY_QUERY_KEYS, STOREFRONT_DISCOVERY_FILTER_KEYS, STOREFRONT_LENGTH_UNITS, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFilterKey } from '@letbuyy/shared-types';
export { StorefrontDiscoveryQuerySchema, STOREFRONT_DISCOVERY_QUERY_KEYS, STOREFRONT_DISCOVERY_FILTER_KEYS, StorefrontDiscoveryMetadataSchema, StorefrontDiscoveryMeasurementCapabilitiesSchema, type StorefrontDiscoveryQuery, type StorefrontDiscoveryQueryInput, type StorefrontDiscoveryFilterKey, type StorefrontDiscoveryFacet, type StorefrontDiscoveryMatch, type StorefrontDiscoveryMetadata, type StorefrontDiscoveryMeasurementCapabilities } from '@letbuyy/shared-types';
const lengthUnits = STOREFRONT_LENGTH_UNITS;

/** Read repeated connector checkboxes without losing a selected value; scalar repeats are invalid. */
export function storefrontDiscoveryQueryFromEntries(entries: Iterable<readonly [string, string]>, transportKeys: readonly string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of entries) {
    if (transportKeys.includes(key)) continue;
    if (Object.hasOwn(result, key)) result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    else result[key] = value;
  }
  return result;
}

/** All navigation is relative to the current authorized store route. */
export function storefrontDiscoveryUrl(path: string, input: unknown, patch: Partial<Record<keyof StorefrontDiscoveryQuery, unknown>> = {}): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[?#\\\u0000-\u001f]/.test(path)) throw new TypeError('Use a store-relative path without query or fragment.');
  const query = StorefrontDiscoveryQuerySchema.parse({ ...StorefrontDiscoveryQuerySchema.parse(input), ...patch });
  const params = new URLSearchParams();
  for (const key of STOREFRONT_DISCOVERY_QUERY_KEYS) {
    const value = query[key];
    if (value === undefined || key === 'page' && value === 1) continue;
    for (const item of Array.isArray(value) ? [...value].sort() : [value]) params.append(key, String(item));
  }
  return path + (params.size ? `?${params}` : '');
}
export function clearStorefrontDiscoveryFilterUrl(path: string, query: unknown, key: StorefrontDiscoveryFilterKey, selectedValue?: string): string {
  if (!STOREFRONT_DISCOVERY_FILTER_KEYS.includes(key)) throw new TypeError('Unknown discovery filter.');
  const parsed = StorefrontDiscoveryQuerySchema.parse(query), current = parsed[key];
  let next: unknown;
  if (selectedValue !== undefined) {
    if (Array.isArray(current)) { const remaining = current.filter(value => String(value) !== selectedValue);next = remaining.length ? remaining : undefined; }
    else if (current !== undefined && String(current) !== selectedValue) next = current;
  }
  return storefrontDiscoveryUrl(path, parsed, { [key]: next, page: 1 });
}
export function normalizeDiscoveryLengthMm(value: number, unit: (typeof lengthUnits)[number]): number | null {
  if (!Number.isFinite(value) || value <= 0 || value > 1000000 || !lengthUnits.includes(unit)) return null;
  return Math.round(value * { mm: 1, cm: 10, m: 1000, in: 25.4 }[unit] * 1000) / 1000;
}

/** Match the native PostgreSQL16 simple-lowercase facet key. Whole-string JS
 * lowercasing expands capital dotted I and applies contextual final sigma,
 * which otherwise leaves a server-selected manufacturer unchecked in the UI. */
export function normalizeStorefrontManufacturerKey(value: string): string {
  return Array.from(value.trim(), point => point === '\u0130' ? 'i' : point.toLowerCase()).join('');
}

/** Migration386 embeds these canonical schemas; its parity test rejects hand-maintained shape drift. */
export function storefrontDiscoverySchemaSnapshot() {
  return {
    query: z.toJSONSchema(StorefrontDiscoveryQuerySchema, { io: 'output' }),
    product: Object.fromEntries(Object.entries(PRODUCT_NICHE_FACT_SCHEMAS).map(([key, schema]) => [key, z.toJSONSchema(schema, { io: 'input' })])),
    variant: Object.fromEntries(Object.entries(VARIANT_NICHE_FACT_SCHEMAS).map(([key, schema]) => [key, z.toJSONSchema(schema, { io: 'input' })])),
  };
}
