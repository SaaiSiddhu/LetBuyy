// Merchant ad-campaign contracts (phase F-ADS-2; schema: migrations 232 and 238).
//
// The vocabularies repeat 232's CHECK constraints, so a bad value is rejected at the edge with a
// typed error rather than as a Postgres constraint failure. `.strict()` on every body: a client
// cannot smuggle `site_id` or `allocated_minor` — the site comes from the resolved owned-store scope,
// and the budget moves ONLY through allocate_ad_campaign_budget, which writes a matching ledger
// entry. Migration 236 already makes a direct write to allocated_minor impossible at the database;
// leaving it out here means a client never gets as far as being refused.

import { z } from 'zod';

const uuid = z.string().uuid();

// 232's status vocabulary MINUS 'exhausted'. A campaign becomes exhausted by spending its budget,
// which is a fact about the ledger; letting a merchant assert it would make the status disagree with
// the money. 'ended' is the merchant's way of stopping a campaign for good.
export const AdCampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'ended']);

export const ListAdCampaignsQuery = z.object({
    store_id: uuid,
    status: AdCampaignStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdAccountQuery = z.object({
    store_id: uuid,
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const CreateAdCampaignSchema = z
    .object({
        store_id: uuid,
        name: z.string().trim().min(1).max(200),
        status: AdCampaignStatusSchema.default('draft'),
        starts_at: z.string().datetime().nullable().optional(),
        ends_at: z.string().datetime().nullable().optional(),
    })
    .strict();

export const UpdateAdCampaignSchema = z
    .object({
        store_id: uuid,
        name: z.string().trim().min(1).max(200).optional(),
        status: AdCampaignStatusSchema.optional(),
        starts_at: z.string().datetime().nullable().optional(),
        ends_at: z.string().datetime().nullable().optional(),
    })
    .strict()
    .refine(
        (body) => ['name', 'status', 'starts_at', 'ends_at'].some((key) => body[key as 'name'] !== undefined),
        { message: 'at least one of name, status, starts_at or ends_at must be supplied' },
    );

export const AllocateAdBudgetSchema = z
    .object({
        store_id: uuid,
        // Paise. Integer and strictly positive: 232 refuses zero or negative, and a float here would
        // be a fraction of a paisa nobody can account for.
        amount_minor: z.coerce.number().int().positive(),
        // Required, not generated server-side: the caller owns the retry, and a key the server
        // invented would make every retry a new allocation.
        idempotency_key: z.string().trim().min(8).max(200),
    })
    .strict();

export const CreateAdPlacementSchema = z
    .object({
        store_id: uuid,
        product_id: uuid,
        position: z.coerce.number().int().min(0).max(1000).default(0),
    })
    .strict();

export const AdPlacementQuery = z.object({
    store_id: uuid,
});

export type ListAdCampaignsInput = z.infer<typeof ListAdCampaignsQuery>;
export type AdAccountInput = z.infer<typeof AdAccountQuery>;
export type CreateAdCampaignInput = z.infer<typeof CreateAdCampaignSchema>;
export type UpdateAdCampaignInput = z.infer<typeof UpdateAdCampaignSchema>;
export type AllocateAdBudgetInput = z.infer<typeof AllocateAdBudgetSchema>;
export type CreateAdPlacementInput = z.infer<typeof CreateAdPlacementSchema>;
export type AdPlacementInput = z.infer<typeof AdPlacementQuery>;
