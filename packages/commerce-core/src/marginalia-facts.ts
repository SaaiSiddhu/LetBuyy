import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().positive().max(10000);
const dimensions = z.object({ width: z.number().finite().positive().max(5000), height: z.number().finite().positive().max(5000) }).strict();
const isbn = text(32).transform(value => value.replace(/[ -]/g, '').toUpperCase()).refine(value => {
  if (/^97[89]\d{10}$/.test(value)) return [...value].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
  if (/^\d{9}[\dX]$/.test(value)) return [...value].reduce((sum, digit, index) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0;
  return false;
}, 'Supply a valid ISBN-10 or ISBN-13, or omit the identifier.');
const bookFields = {
  authors: z.array(text(200)).min(1).max(8).optional(),
  subjects: z.array(text(100)).min(1).max(16).optional(),
  language: text(80).optional(),
  format: z.enum(['paperback', 'hardback', 'board-book', 'spiral-bound', 'other']).optional(),
  edition: text(200).optional(),
  publisher: text(200).optional(),
  publication_year: z.number().int().min(1450).max(2200).optional(),
  pages: count.optional(),
  dimensions_mm: dimensions.optional(),
  isbn: isbn.optional(),
};
const paperFields = {
  paper_gsm: z.number().finite().min(10).max(1500).optional(),
  dimensions_mm: dimensions.optional(),
  page_count: count.optional(),
  sheet_count: count.optional(),
  ruling: z.enum(['blank', 'lined', 'dotted', 'grid', 'other']).optional(),
  binding: text(200).optional(),
  included: z.array(text(300)).min(1).max(20).optional(),
  materials: text(1000).optional(),
};
/** Stored inside the canonical variant, whose enclosing DTO owns the durable UUID. */
export const BooksVariantFactsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('book'), ...bookFields, language: text(80), format: z.enum(['paperback', 'hardback', 'board-book', 'spiral-bound', 'other']) }).strict(),
  z.object({ kind: z.literal('stationery'), ...paperFields }).strict(),
]).superRefine((facts, ctx) => {
  if (facts.kind === 'stationery' && facts.page_count !== undefined && facts.sheet_count !== undefined && facts.page_count !== facts.sheet_count * 2) ctx.addIssue({ code: 'custom', path: ['page_count'], message: 'A sheet has two pages; supplied counts must agree.' });
});
export type BooksVariantFacts = z.infer<typeof BooksVariantFactsSchema>;
/** Bounded merchant-authored print bibliography or paper facts; never price/stock/auth authority. */
export const BooksFactsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('book'), ...bookFields,
    excerpt: z.object({
      text: text(12000),
      permission: z.enum(['merchant_owned', 'licensed', 'public_domain']),
      attribution: text(500),
    }).strict().optional(),
  }).strict(),
  z.object({ kind: z.literal('stationery'), ...paperFields }).strict(),
]).superRefine((facts, ctx) => {
  if (facts.kind === 'stationery' && facts.page_count !== undefined && facts.sheet_count !== undefined && facts.page_count !== facts.sheet_count * 2) {
    ctx.addIssue({ code: 'custom', path: ['page_count'], message: 'A sheet has two pages; supplied counts must agree.' });
  }
});
export type BooksFacts = z.infer<typeof BooksFactsSchema>;

/** Deliberately project only metadata.books. Private or unrelated metadata never becomes a drop. */
export function readBooksFacts(metadata: unknown): BooksFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(metadata, 'books');
    if (!descriptor || !('value' in descriptor)) return null;
    const result = BooksFactsSchema.safeParse(descriptor.value);
    return result.success ? result.data : null;
  } catch { return null; }
}

/** Caller selects a canonical persisted variant by UUID; no lookup by mutable labels here. */
export function mergeBooksVariantFacts(common: BooksFacts | null, variant: unknown): BooksFacts | null {
  const override = BooksVariantFactsSchema.safeParse(variant);
  if (!override.success || (common && override.data.kind !== common.kind)) return null;
  const parsed = BooksFactsSchema.safeParse({ ...common, ...override.data });
  return parsed.success ? parsed.data : null;
}
