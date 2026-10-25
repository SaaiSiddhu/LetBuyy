import { z } from 'zod';

export const ElectronicsConnectorSchema = z.object({
  kind: z.enum(['usb-c', 'usb-a', 'hdmi', 'displayport', 'sd', 'microsd', 'audio-3.5mm', 'ac-plug', 'other']),
  role: z.enum(['host', 'power-input', 'power-output', 'data', 'video', 'card-reader', 'audio']),
  count: z.number().int().min(1).max(16),
}).strict();

const empty = (value: unknown) => typeof value === 'string' && value.trim() === '' ? undefined : value;
const text = (maximum: number) => z.preprocess(empty, z.string().trim().min(1).max(maximum).optional());
const numeric = (minimum: number, maximum: number, integer = false) => {
  const number = integer ? z.number().finite().int().min(minimum).max(maximum) : z.number().finite().min(minimum).max(maximum);
  return z.union([z.number().finite(), z.string().trim().regex(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i)]).pipe(z.coerce.number<number | string>().pipe(number));
};
const number = (minimum: number, maximum: number) => z.preprocess(empty, numeric(minimum, maximum).optional());
const choice = <T extends readonly [string, ...string[]]>(options: T) => z.preprocess(empty, z.enum(options).optional());
const slug = z.preprocess(empty, z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_-]*$/).optional());
const interest = z.preprocess(empty, z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9-]*$/).optional());
const giftKey = z.preprocess(empty, z.string().trim().min(1).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional());
const connector = ElectronicsConnectorSchema.shape.kind;
export const STOREFRONT_LENGTH_UNITS = ['mm', 'cm', 'm', 'in'] as const;

/** One transport contract for every storefront theme. Unknown filters are never silently ignored. */
export const StorefrontDiscoveryQuerySchema = z.object({
  page: z.preprocess(empty, numeric(1, 10000, true).default(1)),
  limit: z.preprocess(empty, numeric(1, 100, true).default(20)),
  search: text(200), category: text(100), country_of_origin: text(100),
  sort: z.preprocess(empty, z.enum(['display_order', 'price-asc', 'price-desc', 'newest', 'name']).default('display_order')),
  collection_id: z.preprocess(empty, z.string().uuid().optional()),
  size: text(100), color: text(100),
  min_price: number(0, 100000000), max_price: number(0, 100000000),
  age_band: choice(['3-5', '6-8', '9-12']), interest,
  electronics_kind: choice(['hub', 'adapter', 'charger', 'cable', 'audio', 'device', 'other']),
  electronics_manufacturer: text(120),
  compatibility_evidence: choice(['supplied', 'unconfirmed']),
  connector: z.preprocess(empty, z.union([connector, z.array(connector).min(1).max(9).refine(rows => new Set(rows).size === rows.length, 'Choose each connector once.')]).optional()),
  power_input_w: number(Number.MIN_VALUE, 10000), power_output_w: number(Number.MIN_VALUE, 10000),
  power_capacity_w: number(Number.MIN_VALUE, 10000), pass_through_output_w: number(Number.MIN_VALUE, 10000),
  data_rate_mbps: number(Number.MIN_VALUE, 1000000), length_mm: number(Number.MIN_VALUE, 100000),
  pack_size: z.preprocess(empty, z.string().regex(/^(g|ml):[1-9]\d{0,9}$/).refine(value => Number(value.split(':')[1]) <= 1000000000, 'Pack quantity is too large.').optional()),
  material: text(200), finish: text(200), max_width_cm: number(Number.MIN_VALUE, 1000000), max_depth_cm: number(Number.MIN_VALUE, 1000000),
  occasion: giftKey, recipient: giftKey, personalization_method: slug,
  routine_stage: choice(['cleanse', 'care', 'colour']), format: text(80), shade: text(100),
  activity: text(80), equipment_type: choice(['racket', 'shuttles', 'storage', 'recreational-accessory']),
  length_value: number(Number.MIN_VALUE, 100000), length_unit: choice(STOREFRONT_LENGTH_UNITS),
  books_kind: choice(['book', 'stationery']), books_author: text(200), books_subject: text(100), books_language: text(80),
  books_format: choice(['paperback', 'hardback', 'board-book', 'spiral-bound', 'other']),
  books_ruling: choice(['blank', 'lined', 'dotted', 'grid', 'other']),
}).strict().superRefine((query, context) => {
  if (query.min_price !== undefined && query.max_price !== undefined && query.min_price > query.max_price)
    context.addIssue({ code: 'custom', path: ['min_price'], message: 'Minimum price must not exceed maximum price.' });
  if ((query.length_value === undefined) !== (query.length_unit === undefined))
    context.addIssue({ code: 'custom', path: ['length_value'], message: 'Supply an equipment length and its unit together.' });
});
export type StorefrontDiscoveryQuery = z.infer<typeof StorefrontDiscoveryQuerySchema>;
/** SDK inputs use canonical values; HTTP strings are normalized by the server schema. */
export type StorefrontDiscoveryQueryInput = Partial<StorefrontDiscoveryQuery>;
export const STOREFRONT_DISCOVERY_QUERY_KEYS = Object.keys(StorefrontDiscoveryQuerySchema.shape) as Array<keyof StorefrontDiscoveryQuery>;
export const STOREFRONT_DISCOVERY_FILTER_KEYS = STOREFRONT_DISCOVERY_QUERY_KEYS.filter(key => !['page', 'limit', 'sort', 'search'].includes(key));
export type StorefrontDiscoveryFilterKey = Exclude<keyof StorefrontDiscoveryQuery, 'page' | 'limit' | 'sort' | 'search'>;
export interface StorefrontDiscoveryFacet { key: StorefrontDiscoveryFilterKey; value: string; label: string; count: number }
export interface StorefrontDiscoveryMatch { product_id: string; price: number; variant_ids: string[] }
/** Explicit server capability only. Absent metadata remains unsupported on migration386. */
export const StorefrontDiscoveryMeasurementCapabilitiesSchema = z.object({
  equipment_length: z.object({
    available: z.boolean(), allowed_units: z.array(z.enum(STOREFRONT_LENGTH_UNITS)).max(STOREFRONT_LENGTH_UNITS.length),
  }).strict().superRefine((capability, context) => {
    if (capability.available !== (capability.allowed_units.length > 0))
      context.addIssue({ code: 'custom', path: ['allowed_units'], message: 'Available equipment length requires units; unavailable length must have none.' });
    let previous = -1;
    capability.allowed_units.forEach((unit, index) => {
      const position = STOREFRONT_LENGTH_UNITS.indexOf(unit);
      if (position <= previous) context.addIssue({ code: 'custom', path: ['allowed_units', index], message: 'Supply each length unit once in canonical order.' });
      previous = position;
    });
  }),
  max_width_cm: z.object({ available: z.boolean() }).strict(),
  max_depth_cm: z.object({ available: z.boolean() }).strict(),
}).strict();
export type StorefrontDiscoveryMeasurementCapabilities = z.infer<typeof StorefrontDiscoveryMeasurementCapabilitiesSchema>;
export interface StorefrontDiscoveryMetadata {
  query: StorefrontDiscoveryQuery;
  facets: StorefrontDiscoveryFacet[];
  matches: StorefrontDiscoveryMatch[];
  measurement_capabilities?: StorefrontDiscoveryMeasurementCapabilities;
}
export const StorefrontDiscoveryMetadataSchema = z.object({
  query: StorefrontDiscoveryQuerySchema,
  facets: z.array(z.object({ key: StorefrontDiscoveryQuerySchema.keyof().exclude(['page','limit','sort','search']), value: z.string().max(500), label: z.string().max(500), count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict()).max(2000),
  matches: z.array(z.object({ product_id: z.string().uuid(), price: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER), variant_ids: z.array(z.string().uuid()).max(100) }).strict()).max(100),
  measurement_capabilities: StorefrontDiscoveryMeasurementCapabilitiesSchema.optional(),
}).strict();
