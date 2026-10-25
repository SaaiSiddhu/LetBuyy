import { z } from 'zod';
import { ToyFactsSchema, ToyVariantFactsSchema } from './playfield-facts';
import { ElectronicsFactsSchema } from './circuit-facts';
import { FoodFactsSchema, FoodVariantFactsSchema } from './pantry-facts';
import { FurnitureFactsSchema, FurnitureVariantFactsSchema } from './habitat-facts';
import { GiftFactsSchema } from './kindred-facts';
import { PersonalizationFactsSchema } from './madeyours-facts';
import { BeautyFactsSchema } from './dewdrop-facts';
import { SportsFactsSchema, SportsVariantFactsSchema } from './trailmark-facts';
import { BooksFactsSchema, BooksVariantFactsSchema } from './marginalia-facts';

/** Bounded domain namespaces on the existing product, independent of theme selection. */
export const PRODUCT_NICHE_FACT_SCHEMAS = {
  toys: ToyFactsSchema,
  electronics: ElectronicsFactsSchema,
  food: FoodFactsSchema,
  furniture: FurnitureFactsSchema,
  gifts: GiftFactsSchema,
  personalization: PersonalizationFactsSchema,
  beauty: BeautyFactsSchema,
  sports: SportsFactsSchema,
  books: BooksFactsSchema,
} as const;

export type ProductNicheNamespace = keyof typeof PRODUCT_NICHE_FACT_SCHEMAS;
export type ProductNicheFacts = {
  [K in ProductNicheNamespace]?: z.infer<(typeof PRODUCT_NICHE_FACT_SCHEMAS)[K]> | null;
};

/** Inline facts are persisted with the enclosing variant, never keyed by mutable option labels. */
export const VARIANT_NICHE_FACT_SCHEMAS = {
  toys: ToyVariantFactsSchema,
  food: FoodVariantFactsSchema,
  furniture: FurnitureVariantFactsSchema,
  sports: SportsVariantFactsSchema,
  books: BooksVariantFactsSchema,
} as const;
export type VariantNicheFacts = {
  [K in keyof typeof VARIANT_NICHE_FACT_SCHEMAS]?: z.infer<(typeof VARIANT_NICHE_FACT_SCHEMAS)[K]> | null;
};

export const ProductVariantMetadataSchema = z.object({
  toys: ToyVariantFactsSchema.nullable().optional(),
  food: FoodVariantFactsSchema.nullable().optional(),
  furniture: FurnitureVariantFactsSchema.nullable().optional(),
  sports: SportsVariantFactsSchema.nullable().optional(),
  books: BooksVariantFactsSchema.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (encodedSize(value) > MAX_PUBLIC_FACT_BYTES) context.addIssue({ code: 'custom', message: 'Variant facts exceed the supported size.' });
});

const MAX_NAMESPACE_BYTES = 64 * 1024;
const MAX_PUBLIC_FACT_BYTES = 128 * 1024;
const encodedSize = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function ownData(record: unknown, key: string): { present: boolean; value?: unknown } {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { present: false };
  const field = Object.getOwnPropertyDescriptor(record, key);
  return field && 'value' in field ? { present: true, value: field.value } : { present: false };
}

/** Write validation preserves unrelated private metadata while validating declared public facts. */
export function validateProductNicheMetadata(metadata: Record<string, unknown>, context: z.RefinementCtx): void {
  let total = 0;
  for (const [namespace, schema] of Object.entries(PRODUCT_NICHE_FACT_SCHEMAS)) {
    const field = ownData(metadata, namespace);
    if (!field.present) continue;
    const result = schema.safeParse(field.value);
    if (!result.success) {
      for (const issue of result.error.issues) context.addIssue({ code: 'custom', path: [namespace, ...issue.path], message: issue.message });
      continue;
    }
    const bytes = encodedSize(result.data);
    total += bytes;
    if (bytes > MAX_NAMESPACE_BYTES) context.addIssue({ code: 'custom', path: [namespace], message: 'Product facts exceed the supported size.' });
  }
  if (total > MAX_PUBLIC_FACT_BYTES) context.addIssue({ code: 'custom', message: 'Combined product facts exceed the supported size.' });
}

/** Anonymous projection never copies arbitrary metadata, accessors or invalid historical facts. */
export function readProductNicheFacts(metadata: unknown): ProductNicheFacts {
  const output: Record<string, unknown> = {};
  let total = 0;
  for (const [namespace, schema] of Object.entries(PRODUCT_NICHE_FACT_SCHEMAS)) {
    const field = ownData(metadata, namespace);
    if (!field.present) continue;
    const result = schema.safeParse(field.value);
    if (!result.success) continue;
    const bytes = encodedSize(result.data);
    if (bytes > MAX_NAMESPACE_BYTES || total + bytes > MAX_PUBLIC_FACT_BYTES) continue;
    total += bytes;
    output[namespace] = result.data;
  }
  return output as ProductNicheFacts;
}

export function readVariantNicheFacts(metadata: unknown): VariantNicheFacts {
  const output: Record<string, unknown> = {};
  let total = 0;
  for (const [namespace, schema] of Object.entries(VARIANT_NICHE_FACT_SCHEMAS)) {
    const field = ownData(metadata, namespace);
    if (!field.present || field.value == null) continue;
    const result = schema.safeParse(field.value);
    if (!result.success) continue;
    const bytes = encodedSize(result.data);
    if (bytes > MAX_NAMESPACE_BYTES || total + bytes > MAX_PUBLIC_FACT_BYTES) continue;
    total += bytes;
    output[namespace] = result.data;
  }
  return output as VariantNicheFacts;
}
