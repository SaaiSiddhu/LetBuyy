import { z } from 'zod';

const measurement = z.number().finite().positive().max(100000);
const shortText = z.string().trim().min(1).max(200);
const suppliedText = z.string().trim().min(1).max(2000);

/** Supplied lengths, never inferred from a product photograph. */
export const FurnitureDimensionsSchema = z.object({
  unit: z.enum(['mm', 'cm', 'in']),
  width: measurement.optional(),
  depth: measurement.optional(),
  height: measurement.optional(),
  diameter: measurement.optional(),
}).strict().refine(value => [value.width, value.depth, value.height, value.diameter].some(v => v !== undefined), {
  message: 'Supply at least one measured dimension.',
});

export const FurnitureLengthSchema = z.object({ value: measurement, unit: z.enum(['mm', 'cm', 'in']) }).strict();
export const FurnitureWeightSchema = z.object({ value: z.number().finite().positive().max(100000), unit: z.enum(['g', 'kg']) }).strict();
const commonFields = {
  assembled: FurnitureDimensionsSchema.optional(),
  package: FurnitureDimensionsSchema.optional(),
  seat_height: FurnitureLengthSchema.optional(),
  weight: FurnitureWeightSchema.optional(),
  materials: z.array(shortText).min(1).max(20).optional(),
  finish: shortText.optional(),
  assembly: z.object({
    status: z.enum(['assembled', 'required', 'not_supplied']),
    instructions: suppliedText.optional(),
    tools: z.string().trim().min(1).max(500).optional(),
  }).strict().optional(),
  care: suppliedText.optional(),
};

/** Inline canonical variant namespace. The enclosing variant DTO owns its durable ID. */
export const FurnitureVariantFactsSchema = z.object(commonFields).strict();

/** Leaf merchant domain contract. Omitted facts remain unknown; no delivery promises or claims. */
export const FurnitureFactsSchema = z.object(commonFields).strict();

export type FurnitureFacts = z.infer<typeof FurnitureFactsSchema>;
export type FurnitureDimensions = z.infer<typeof FurnitureDimensionsSchema>;
export type FurnitureVariantFacts = z.infer<typeof FurnitureVariantFactsSchema>;

/** Private sibling metadata and malformed/historical furniture payloads are never returned. */
export function readFurnitureFacts(metadata: unknown): FurnitureFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  if (!Object.prototype.hasOwnProperty.call(metadata, 'furniture')) return null;
  try {
    const parsed = FurnitureFactsSchema.safeParse((metadata as Record<string, unknown>).furniture);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function furnitureLengthMm(value: number, unit: FurnitureDimensions['unit']): number {
  if (!['mm', 'cm', 'in'].includes(unit) || !Number.isFinite(value) || value <= 0 || value > 100000) throw new RangeError('Invalid supplied length');
  return Math.round(value * (unit === 'cm' ? 10 : unit === 'in' ? 25.4 : 1) * 1000) / 1000;
}

/** Resolve common facts with the enclosing selected variant's validated inline namespace. */
export function resolveFurnitureFacts(facts: FurnitureFacts, variantFacts?: FurnitureVariantFacts | null): FurnitureFacts {
  const common = FurnitureFactsSchema.parse(facts);
  if (variantFacts == null) return common;
  const overrides = FurnitureVariantFactsSchema.parse(variantFacts);
  // Replace each dimension group atomically, including its unit. Never mix inherited cm with in.
  return FurnitureFactsSchema.parse({ ...common, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) });
}
