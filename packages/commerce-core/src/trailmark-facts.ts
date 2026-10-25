import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const distance = z.object({ value: z.number().finite().positive().max(100000), unit: z.enum(['mm', 'cm', 'm', 'in']) }).strict();
const mass = z.object({ value: z.number().finite().positive().max(100000), unit: z.enum(['g', 'kg']) }).strict();
const dimensions = z.object({ length: z.number().finite().positive().max(100000), width: z.number().finite().positive().max(100000), height: z.number().finite().positive().max(100000).optional(), unit: z.enum(['mm', 'cm', 'm', 'in']) }).strict();
const measurements = { length: distance.optional(), weight: mass.optional(), gripCircumference: distance.optional(), dimensions: dimensions.optional() };
/** Inline on the canonical variant DTO; its durable UUID stays on the enclosing variant. */
export const SportsVariantFactsSchema = z.object({ ...measurements }).strict().refine(
  row => row.length !== undefined || row.weight !== undefined || row.gripCircumference !== undefined || row.dimensions !== undefined,
  { message: 'Supply at least one equipment measurement for this variant.' },
);
export type SportsVariantFacts = z.infer<typeof SportsVariantFactsSchema>;

/** Merchant facts for non-safety-critical recreation, never generated claims or garment sizes. */
export const SportsFactsSchema = z.object({
  version: z.literal(1).default(1),
  activity: text(80),
  equipmentType: z.enum(['racket', 'shuttles', 'storage', 'recreational-accessory']),
  ...measurements,
  material: text(1000).optional(),
  contents: z.array(text(200)).max(30).optional(),
  conditions: text(2000).optional(),
  care: text(2000).optional(),
  compatibility: z.discriminatedUnion('status', [
    z.object({ status: z.literal('unconfirmed'), note: text(1000).optional() }).strict(),
    z.object({ status: z.literal('merchant-supplied'), reference: text(1000), note: text(1000).optional() }).strict(),
  ]).optional(),
 }).strict();
export type SportsFacts = z.infer<typeof SportsFactsSchema>;
export type SportsMeasurements = Pick<SportsFacts, 'length' | 'weight' | 'gripCircumference' | 'dimensions'>;

/** Only this bounded namespace is public. Inherited/accessor metadata is not read. */
export function readSportsFacts(metadata: unknown): SportsFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const property = Object.getOwnPropertyDescriptor(metadata, 'sports');
  if (!property || !('value' in property)) return null;
  const result = SportsFactsSchema.safeParse(property.value);
  return result.success ? result.data : null;
}

/** The canonical owner supplies facts from the selected enclosing variant UUID. */
export function resolveSportsMeasurements(facts: SportsFacts, variant?: SportsVariantFacts | null): SportsMeasurements {
  return { length: variant?.length ?? facts.length, weight: variant?.weight ?? facts.weight, gripCircumference: variant?.gripCircumference ?? facts.gripCircumference, dimensions: variant?.dimensions ?? facts.dimensions };
}
