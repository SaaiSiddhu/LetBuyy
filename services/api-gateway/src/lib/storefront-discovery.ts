import { z } from 'zod';
import {
  StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema,
  storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryQuery, type StorefrontDiscoveryMetadata,
} from '@letbuyy/commerce-core';
import { AppError } from './errors';

export const STOREFRONT_DISCOVERY_RPC = 'browse_storefront_products_v1';
const ids = z.array(z.string().uuid()).max(100);
const response = z.object({ data: z.array(z.record(z.string(), z.unknown())).max(100), count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), facets: StorefrontDiscoveryMetadataSchema.shape.facets, matches: StorefrontDiscoveryMetadataSchema.shape.matches, measurement_capabilities: StorefrontDiscoveryMetadataSchema.shape.measurement_capabilities }).strict();

export function parseStorefrontDiscoveryRequest(url: string, options: { transportKeys?: readonly string[]; overrides?: Record<string, unknown> } = {}) {
  const entries = storefrontDiscoveryQueryFromEntries(new URL(url).searchParams, options.transportKeys);
  return StorefrontDiscoveryQuerySchema.safeParse({ ...entries, ...options.overrides });
}

/** Parameters stay values in one RPC. A store UUID is scope, never a caller authorization grant. */
export function storefrontDiscoveryRpcArgs(storeId: string, query: unknown, productIds?: string[]) {
  const store = z.string().uuid().safeParse(storeId), parsed = StorefrontDiscoveryQuerySchema.safeParse(query), products = ids.optional().safeParse(productIds);
  if (!store.success || !parsed.success || !products.success) throw new AppError('Invalid product discovery query.', 400, 'VALIDATION');
  return { p_store_id: store.data, p_query: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown>, p_product_ids: products.data ?? null };
}

export function readStorefrontDiscoveryPayload(input: unknown, query: StorefrontDiscoveryQuery): { data: Record<string, unknown>[]; count: number; discovery: StorefrontDiscoveryMetadata } {
  const parsed = response.safeParse(input);
  if (!parsed.success) throw new AppError('Product discovery is unavailable.', 500, 'INTERNAL_ERROR');
  const value = parsed.data, productIds = value.data.map(row => row.id);
  if (value.data.length > query.limit || new Set(productIds).size !== productIds.length || value.count < value.data.length || value.matches.length !== value.data.length
    || value.matches.some((row, index) => row.product_id !== productIds[index] || new Set(row.variant_ids).size !== row.variant_ids.length)
    || value.facets.some(row => row.count > value.count)) throw new AppError('Product discovery is unavailable.', 500, 'INTERNAL_ERROR');
  return { data: value.data, count: value.count, discovery: { query, facets: value.facets, matches: value.matches,
    ...(value.measurement_capabilities !== undefined ? { measurement_capabilities: value.measurement_capabilities } : {}),
  } };
}
