import { z } from 'zod';
import { UuidSchema } from './uuid';

const id = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/);
const label = z.string().min(1).max(100).refine(value => value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value), 'Use a visible label without surrounding whitespace.');
const choice = z.object({ id, label }).strict();

/** Public, merchant-authored text capabilities. No file uploads, arbitrary patterns or inferred promises. */
export const PersonalizationFactsSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(1).max(2147483647),
  methods: z.array(z.object({
    id, label,
    min_graphemes: z.number().int().min(1).max(80),
    max_graphemes: z.number().int().min(1).max(80),
    character_set: z.enum(['latin-name', 'unicode-letters']),
    styles: z.array(choice).min(1).max(8),
    placements: z.array(choice).min(1).max(8),
  }).strict()).min(1).max(4),
  production_note: z.string().max(1000).optional(),
}).strict().superRefine((facts, ctx) => {
  const unique = (rows: { id: string }[], path: (string | number)[]) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (seen.has(row.id)) ctx.addIssue({ code: 'custom', path: [...path, index, 'id'], message: 'Each identifier must appear once.' });
      seen.add(row.id);
    });
  };
  unique(facts.methods, ['methods']);
  facts.methods.forEach((method, index) => {
    if (method.min_graphemes > method.max_graphemes) ctx.addIssue({ code: 'custom', path: ['methods', index, 'max_graphemes'], message: 'Maximum length must be at least the minimum length.' });
    unique(method.styles, ['methods', index, 'styles']);
    unique(method.placements, ['methods', index, 'placements']);
  });
});
export type PersonalizationFacts = z.infer<typeof PersonalizationFactsSchema>;

export const PersonalizationDraftSchema = z.object({
  method_id: id, style_id: id, placement_id: id, text: z.string().max(1000),
}).strict();
export type PersonalizationDraft = z.infer<typeof PersonalizationDraftSchema>;
export const AcceptedPersonalizationSchema = z.object({
  version: z.literal(1), facts_revision: z.number().int().min(1).max(2147483647),
  method: choice, style: choice, placement: choice,
  text: z.string().min(1).max(1000).refine(value => value === value.normalize('NFC') && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value), 'Accepted text must be NFC without control characters.'),
}).strict();
export type AcceptedPersonalization = z.infer<typeof AcceptedPersonalizationSchema>;
const uuid = UuidSchema.transform(value => value.toLowerCase());
export const PersonalizationReviewQuerySchema = z.object({ variant_id: uuid.optional() }).strict();
export const PersonalizationReviewContextSchema = z.object({
  product_id: uuid, variant_id: uuid.nullable(), facts: PersonalizationFactsSchema,
  facts_revision: z.number().int().min(1).max(2147483647), review_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}).strict().refine(context => context.facts_revision === context.facts.revision, { message: 'The review context must match its supplied facts revision.', path: ['facts_revision'] });
export type PersonalizationReviewContext = z.infer<typeof PersonalizationReviewContextSchema>;
