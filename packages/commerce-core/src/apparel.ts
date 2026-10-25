import { z } from 'zod';
import { validateProductNicheMetadata } from './niche-product-facts';
import { StorefrontDiscoveryQuerySchema, type StorefrontDiscoveryQuery } from './storefront-discovery';

const measurement = z.number().finite().positive().max(1000).optional();
/** Merchant-authored garment facts. No body profiling or inferred size recommendation. */
export const ApparelFactsSchema = z.object({
  fit: z.string().trim().max(1000).default(''),
  fabric: z.string().trim().max(2000).default(''),
  care: z.string().trim().max(2000).default(''),
  unit: z.enum(['cm', 'in']).default('cm'),
  measurements: z.array(z.object({
    size: z.string().trim().min(1).max(40), chest: measurement, shoulder: measurement, length: measurement,
  }).strict()).max(30).default([]),
}).strict().superRefine((facts, ctx) => {
  const sizes = new Set<string>();
  for (const [index, row] of facts.measurements.entries()) {
    if (sizes.has(row.size.toLocaleLowerCase('en'))) ctx.addIssue({ code: 'custom', path: ['measurements', index, 'size'], message: 'Each garment size must appear once.' });
    sizes.add(row.size.toLocaleLowerCase('en'));
  }
});
export type ApparelFacts = z.infer<typeof ApparelFactsSchema>;

/** Transitional name only; there is one query contract for every niche. */
export const StorefrontApparelQuerySchema = StorefrontDiscoveryQuerySchema;
export type StorefrontApparelQuery = StorefrontDiscoveryQuery;

/** Unrelated merchant metadata is not a public drop. Invalid historical facts stay unavailable. */
export function readApparelFacts(metadata: unknown): ApparelFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const parsed = ApparelFactsSchema.safeParse((metadata as Record<string, unknown>).apparel);
  return parsed.success ? parsed.data : null;
}

export const ProductMetadataSchema = z.record(z.string(), z.unknown()).superRefine((metadata, ctx) => {
  validateProductNicheMetadata(metadata, ctx);
  if (!Object.prototype.hasOwnProperty.call(metadata, 'apparel')) return;
  const parsed = ApparelFactsSchema.safeParse(metadata.apparel);
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ code: 'custom', path: ['apparel', ...issue.path], message: issue.message });
});
