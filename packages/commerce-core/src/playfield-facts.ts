import { z } from 'zod';

/** Merchant statements about a stocked physical product, never a child profile. */
export const ToyAgeBandSchema = z.enum(['3-5', '6-8', '9-12']);
const identifier = z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9-]*$/);
const text = (max: number) => z.string().trim().max(max);
const contents = z.array(z.object({
  label: z.string().trim().min(1).max(120), quantity: z.number().int().positive().max(10000),
}).strict()).max(30);
const dimension = z.number().finite().positive().max(10000).optional();
export const ToyDimensionsSchema = z.object({
  label: text(160).optional(), length: dimension, width: dimension, height: dimension, unit: z.enum(['cm', 'mm']),
}).strict().refine(v => v.length !== undefined || v.width !== undefined || v.height !== undefined,
  { message: 'Supply at least one measured dimension.' });
const warnings = z.array(z.object({
  text: z.string().trim().min(1).max(2000), sourceLabel: z.string().trim().min(1).max(120),
  editionLabel: text(120).optional(),
}).strict()).max(20);
const measurements = z.array(ToyDimensionsSchema.refine(value => Boolean(value.label), { message: 'Name the measured part.' })).max(20);

const ToyFactsBaseSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  ageBands: z.array(ToyAgeBandSchema).max(3).default([]),
  ageStatement: text(200).optional(),
  interests: z.array(identifier).max(12).default([]),
  productType: identifier.optional(),
  contents: contents.default([]),
  contentsComplete: z.boolean().default(false),
  dimensions: ToyDimensionsSchema.nullable().optional(),
  additionalDimensions: measurements.default([]),
  materials: text(2000).optional(),
  finish: text(1000).optional(),
  care: text(2000).optional(),
  warnings: warnings.default([]),
}).strict();
function validateFacts(facts: Partial<z.infer<typeof ToyFactsBaseSchema>>, ctx: z.RefinementCtx): void {
  for (const key of ['ageBands', 'interests'] as const) {
    if (facts[key] && new Set(facts[key]).size !== facts[key].length)
      ctx.addIssue({ code: 'custom', path: [key], message: 'Each value must appear once.' });
  }
  if (facts.contentsComplete && (!facts.contents || facts.contents.length === 0))
    ctx.addIssue({ code: 'custom', path: ['contentsComplete'], message: 'A complete contents statement needs supplied contents.' });
}
export const ToyFactsSchema = ToyFactsBaseSchema.superRefine(validateFacts);
export type ToyFacts = z.infer<typeof ToyFactsSchema>;

/** Inline on the canonical variant command: identity belongs to the enclosing variant.
 * Omitted keys stay omitted so they cannot erase common facts during resolution.
 * Explicit [] / null can clear inherited lists / dimensions for this edition.
 */
export const ToyVariantFactsSchema = z.object({
  schemaVersion: z.literal(1).optional(), ageBands: z.array(ToyAgeBandSchema).max(3).optional(),
  ageStatement: text(200).optional(), interests: z.array(identifier).max(12).optional(),
  productType: identifier.optional(), contents: contents.optional(), contentsComplete: z.boolean().optional(),
  dimensions: ToyDimensionsSchema.nullable().optional(), additionalDimensions: measurements.optional(), materials: text(2000).optional(),
  finish: text(1000).optional(), care: text(2000).optional(), warnings: warnings.optional(),
}).strict().superRefine(validateFacts);
export type ToyVariantFacts = z.infer<typeof ToyVariantFactsSchema>;

/** Resolve one selected canonical variant. The caller owns variant identity and
 * persistence; this pure domain operation never chooses a SKU or invents facts.
 */
export function resolveToyFacts(common: unknown, selected: unknown): ToyFacts | null {
  const base = ToyFactsSchema.safeParse(common ?? {});
  const variant = ToyVariantFactsSchema.safeParse(selected ?? {});
  if (!base.success || !variant.success) return null;
  const merged = { ...base.data, ...variant.data };
  // A new list cannot inherit the completeness assertion for a different list.
  if (variant.data.contents !== undefined) merged.contentsComplete = variant.data.contentsComplete ?? false;
  // A variant age range cannot inherit a conflicting common prose age label.
  if (variant.data.ageBands !== undefined && variant.data.ageStatement === undefined) delete merged.ageStatement;
  return readToyFacts({ toys: merged });
}

/** Never return sibling/private metadata or manufacture missing age/material/warnings. */
export function readToyFacts(metadata: unknown): ToyFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const field = Object.getOwnPropertyDescriptor(metadata, 'toys');
  if (!field || !('value' in field)) return null;
  const parsed = ToyFactsSchema.safeParse(field.value);
  if (!parsed.success) return null;
  const f = parsed.data;
  return f.ageBands.length || f.ageStatement || f.interests.length || f.productType || f.contents.length
    || f.dimensions || f.additionalDimensions.length || f.materials || f.finish || f.care || f.warnings.length ? f : null;
}
