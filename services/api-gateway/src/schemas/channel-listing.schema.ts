// Channel-listing and marketplace-feed contracts (phase MKT-1; schema: migration 217,
// docs/architecture/MARKETPLACE_CHANNEL_MODEL.md). The vocabularies below repeat 217's CHECK
// constraints verbatim so a bad value is rejected at the edge with a typed error instead of a
// Postgres CHECK failure. `.strict()` on every body: a client cannot smuggle `site_id`, `store_id`
// (beyond the ownership-resolved one) or `status` — the site comes from the resolved owned-store
// scope and status moves only through the transition RPC.

import { z } from 'zod';

export const ChannelListingChannelSchema = z.enum(['storefront', 'marketplace', 'instant']);
export const ChannelListingStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'paused', 'delisted']);
export const ChannelListingVisibilitySchema = z.enum(['public', 'hidden']);

// The edges a MERCHANT may request (MARKETPLACE_CHANNEL_MODEL.md §4). Operator edges (approve, reject,
// take down) are not expressible here at all — they belong to ADM-1's operator route.
export const MerchantTransitionTargetSchema = z.enum(['pending_review', 'paused', 'approved', 'delisted', 'draft']);

const uuid = z.string().uuid();
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case');

export const ListChannelListingsQuery = z.object({
    store_id: uuid,
    channel: ChannelListingChannelSchema.optional(),
    status: ChannelListingStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GetChannelListingQuery = z.object({
    store_id: uuid,
});

export const CreateChannelListingSchema = z
    .object({
        store_id: uuid,
        product_id: uuid,
        channel: ChannelListingChannelSchema,
        marketplace_category_id: uuid.nullable().optional(),
        visibility: ChannelListingVisibilitySchema.default('public'),
        pricing_policy: z.record(z.string(), z.unknown()).optional(),
    })
    .strict();

export const UpdateChannelListingSchema = z
    .object({
        store_id: uuid,
        marketplace_category_id: uuid.nullable().optional(),
        visibility: ChannelListingVisibilitySchema.optional(),
        pricing_policy: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .refine(
        (body) => body.marketplace_category_id !== undefined || body.visibility !== undefined || body.pricing_policy !== undefined,
        { message: 'nothing to update' },
    );

export const TransitionChannelListingSchema = z
    .object({
        store_id: uuid,
        to_status: MerchantTransitionTargetSchema,
        reason: z.string().trim().max(500).optional(),
        idempotency_key: z.string().min(1).max(200),
    })
    .strict();

// Public feed query. `limit` is clamped, not rejected, so a stale client never gets a 400 for asking
// for too much; the RPC clamps again server-side (217: GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))).
export const MarketplaceFeedQuery = z
    .object({
        category: slug.optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.coerce
            .number()
            .int()
            .default(20)
            .transform((n) => Math.min(100, Math.max(1, n))),
        after_approved_at: z.string().datetime({ offset: true }).optional(),
        after_id: uuid.optional(),
    })
    .refine((q) => (q.after_approved_at === undefined) === (q.after_id === undefined), {
        message: 'after_approved_at and after_id must be given together',
    });

// ── Operator realm (ADM-1) ──────────────────────────────────────────────────────────────────────
// The operator queue lists across sites (no store scope) and decides through fixed endpoints —
// approve / reject / take-down — so `to_status` is never a client field: the route sets it.
export const OperatorListingListQuery = z.object({
    status: ChannelListingStatusSchema.default('pending_review'),
    channel: ChannelListingChannelSchema.default('marketplace'),
    site_id: uuid.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const OperatorListingDecisionSchema = z
    .object({
        // rbac.ts validateSensitiveReason enforces 8..1000 for reject / take-down; approve may omit it.
        reason: z.string().trim().max(1000).optional(),
        idempotency_key: z.string().min(1).max(200),
    })
    .strict();

export type OperatorListingListInput = z.infer<typeof OperatorListingListQuery>;
export type OperatorListingDecisionInput = z.infer<typeof OperatorListingDecisionSchema>;

export type ListChannelListingsInput = z.infer<typeof ListChannelListingsQuery>;
export type GetChannelListingInput = z.infer<typeof GetChannelListingQuery>;
export type CreateChannelListingInput = z.infer<typeof CreateChannelListingSchema>;
export type UpdateChannelListingInput = z.infer<typeof UpdateChannelListingSchema>;
export type TransitionChannelListingInput = z.infer<typeof TransitionChannelListingSchema>;
export type MarketplaceFeedInput = z.infer<typeof MarketplaceFeedQuery>;
