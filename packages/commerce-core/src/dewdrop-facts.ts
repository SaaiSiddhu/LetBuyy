import { z } from 'zod';
const suppliedText = (max: number) => z.string().trim().max(max).optional().nullable();
/** Public presentation of an existing named option, never a replacement variant or SKU. */
export const BeautyShadeSchema = z.object({
    value: z.string().trim().min(1).max(100),
    code: z.string().trim().min(1).max(40).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    ingredients: suppliedText(6000),
}).strict();
/** Merchant-supplied, non-medical care facts. An omitted field is unknown, not a claim. */
export const BeautyFactsSchema = z.object({
    schemaVersion: z.literal(1).default(1),
    routineStage: z.enum(['cleanse', 'care', 'colour']).optional(),
    format: z.string().trim().min(1).max(80).optional(),
    netQuantity: z.object({
        value: z.number().finite().positive().max(100000),
        unit: z.enum(['g', 'ml']),
    }).strict().optional(),
    ingredients: suppliedText(6000),
    directions: suppliedText(4000),
    warnings: suppliedText(4000),
    shadeOptionName: z.string().trim().min(1).max(100).default('Shade'),
    shades: z.array(BeautyShadeSchema).max(100).default([]),
}).strict().superRefine((facts, ctx) => {
    const values = new Set<string>();
    for (const [index, shade] of facts.shades.entries()) {
        if (values.has(shade.value))
            ctx.addIssue({ code: 'custom', path: ['shades', index, 'value'], message: 'Each shade option value must appear once.' });
        values.add(shade.value);
    }
});
export type BeautyFacts = z.infer<typeof BeautyFactsSchema>;
export type BeautyShade = z.infer<typeof BeautyShadeSchema>;
/** Only the validated beauty namespace is public. Invalid historical input fails closed. */
export function readBeautyFacts(metadata: unknown): BeautyFacts | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
        || !Object.prototype.hasOwnProperty.call(metadata, 'beauty'))
        return null;
    try {
        const result = BeautyFactsSchema.safeParse((metadata as Record<string, unknown>).beauty);
        return result.success ? result.data : null;
    }
    catch {
        return null;
    }
}
