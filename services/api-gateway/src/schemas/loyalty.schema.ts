// Merchant loyalty programme contracts (phase F-LOY-3 backend; schema: migrations 231 and 237).
//
// The vocabularies repeat 231's CHECK constraints, so a bad value is rejected at the edge with a
// typed error rather than as a Postgres constraint failure. `.strict()` on the body: a client cannot
// smuggle a `site_id` — the site comes from the resolved owned-store scope, and `store_id` in the
// body only selects WHICH owned store to resolve.
//
// Every setting is OPTIONAL, and that is a money decision rather than convenience. Migration 237
// treats an omitted setting as LEAVE UNCHANGED: with replace semantics a client toggling `is_active`
// while omitting `point_value_minor` would reset it to the column default and revalue every point
// already earned at that store. `.refine` below therefore rejects a body that changes nothing, so
// "omitted" can never mean "the caller meant to clear it".

import { z } from 'zod';

const uuid = z.string().uuid();

// 0..10000 basis points, exactly loyalty_programs' own CHECK range.
const bps = z.union([z.number(),z.string().regex(/^(0|[1-9][0-9]{0,4})$/).transform(Number)]).pipe(z.number().int().min(0).max(10000));

// bigint paise must cross JSON without rounding. Existing safe numeric callers
// normalize to decimal text; large values must already be decimal strings.
const positiveBigint = z.union([
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String),
    z.string().regex(/^[1-9][0-9]{0,18}$/),
]).refine((value) => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, 'value exceeds bigint range');

export const LOYALTY_SETTING_KEYS = ['is_active', 'earn_rate_bps', 'redeem_cap_bps', 'point_value_minor'] as const;

export const GetLoyaltyProgramQuery = z.object({
    store_id: uuid,
});

export const SetLoyaltyProgramSchema = z
    .object({
        store_id: uuid,
        // Null is an explicit first enrolment; omission is never a blind update.
        expected_updated_at: z.string().datetime({ offset: true }).nullable(),
        is_active: z.boolean().optional(),
        earn_rate_bps: bps.optional(),
        redeem_cap_bps: bps.optional(),
        // Paise per point. Strictly positive: a zero-value point is a point that can never pay for
        // anything, which is what `is_active = false` already expresses.
        point_value_minor: positiveBigint.optional(),
    })
    .strict()
    .refine(
        (body) => LOYALTY_SETTING_KEYS.some((key) => body[key] !== undefined),
        { message: 'at least one of is_active, earn_rate_bps, redeem_cap_bps or point_value_minor must be supplied' },
    );

export type GetLoyaltyProgramInput = z.infer<typeof GetLoyaltyProgramQuery>;
export type SetLoyaltyProgramInput = z.infer<typeof SetLoyaltyProgramSchema>;
