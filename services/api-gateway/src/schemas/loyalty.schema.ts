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
const bps = z.coerce.number().int().min(0).max(10000);

export const LOYALTY_SETTING_KEYS = ['is_active', 'earn_rate_bps', 'redeem_cap_bps', 'point_value_minor'] as const;

export const GetLoyaltyProgramQuery = z.object({
    store_id: uuid,
});

export const SetLoyaltyProgramSchema = z
    .object({
        store_id: uuid,
        is_active: z.boolean().optional(),
        earn_rate_bps: bps.optional(),
        redeem_cap_bps: bps.optional(),
        // Paise per point. Strictly positive: a zero-value point is a point that can never pay for
        // anything, which is what `is_active = false` already expresses.
        point_value_minor: z.coerce.number().int().positive().optional(),
    })
    .strict()
    .refine(
        (body) => LOYALTY_SETTING_KEYS.some((key) => body[key] !== undefined),
        { message: 'at least one of is_active, earn_rate_bps, redeem_cap_bps or point_value_minor must be supplied' },
    );

export type GetLoyaltyProgramInput = z.infer<typeof GetLoyaltyProgramQuery>;
export type SetLoyaltyProgramInput = z.infer<typeof SetLoyaltyProgramSchema>;
