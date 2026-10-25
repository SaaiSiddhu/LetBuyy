import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional().transform(value => value ?? null);

/** Edible net contents of one sellable unit. Never a shipping weight or option-label inference. */
export const FoodNetQuantitySchema = z.object({
  value: z.number().int().positive().max(1_000_000_000),
  unit: z.enum(['g', 'ml']),
}).strict();
export type FoodNetQuantity = z.infer<typeof FoodNetQuantitySchema>;

/** Inline on the canonical variant create/edit input, so newly-created IDs need not exist yet. */
export const FoodVariantFactsSchema = z.object({ netQuantity: FoodNetQuantitySchema.nullable().default(null) }).strict();
export type FoodVariantFacts = z.infer<typeof FoodVariantFactsSchema>;

export const FoodAllergenSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_supplied') }).strict(),
  z.object({ status: z.literal('supplied'), statement: z.string().trim().min(1).max(4000), source: z.string().trim().min(1).max(1000) }).strict(),
]);

/** Merchant facts only. Derived prices and private supplier data are deliberately not accepted. */
export const FoodFactsSchema = z.object({
  ingredients: optionalText(6000),
  allergens: FoodAllergenSchema.default({ status: 'not_supplied' }),
  storage: optionalText(2000),
  preparation: optionalText(4000),
  nutritionText: optionalText(4000),
  // Valid for an unvarianted SKU. For variants, the server must use that variant's inline food facts.
  netQuantity: FoodNetQuantitySchema.nullable().default(null),
}).strict();
export type FoodFacts = z.infer<typeof FoodFactsSchema>;

export function readFoodFacts(metadata: unknown): FoodFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  if (!Object.prototype.hasOwnProperty.call(metadata, 'food')) return null;
  const parsed = FoodFactsSchema.safeParse((metadata as Record<string, unknown>).food);
  return parsed.success ? parsed.data : null;
}

export interface FoodUnitPrice { amountMinor: number; basisQuantity: 100; unit: FoodNetQuantity['unit'] }
/** Server presentation helper: integer paise, nearest paise / ties up; dimensions never mixed. */
export function deriveFoodUnitPrice(priceMinor: number, netQuantity: unknown): FoodUnitPrice | null {
  const parsed = FoodNetQuantitySchema.safeParse(netQuantity);
  if (!parsed.success || !Number.isSafeInteger(priceMinor) || priceMinor < 0) return null;
  const divisor = BigInt(parsed.data.value);
  const amount = (BigInt(priceMinor) * BigInt(100) * BigInt(2) + divisor) / (divisor * BigInt(2));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { amountMinor: Number(amount), basisQuantity: 100, unit: parsed.data.unit };
}

/** Display arithmetic only; stock/price/cart authority remains with the existing server cart. */
export function foodPackSummary(packCount: number, netQuantity: unknown): { packCount: number; totalNetQuantity: FoodNetQuantity } | null {
  const parsed = FoodNetQuantitySchema.safeParse(netQuantity);
  if (!parsed.success || !Number.isSafeInteger(packCount) || packCount < 1 || packCount > 999) return null;
  const value = packCount * parsed.data.value;
  if (!Number.isSafeInteger(value)) return null;
  return { packCount, totalNetQuantity: { value, unit: parsed.data.unit } };
}
