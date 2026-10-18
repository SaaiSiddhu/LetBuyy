import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { getStorefrontBuyerSession } from '../middleware/storefront-buyer-session';

export interface BuyerReviewInput {
    product_id: string;
    rating: number;
    title: string | null;
    body: string | null;
}

export const BUYER_REVIEW_REFUSALS = [
    'BUYER_SESSION_INVALID', 'BUYER_DISABLED', 'BUYER_SCOPE_MISMATCH',
    'STORE_ACCOUNT_NOT_LINKED', 'STORE_ACCOUNT_UNAVAILABLE', 'NOT_FOUND',
    'PRODUCT_UNAVAILABLE', 'CONFLICT', 'REVIEW_SOURCE_BUSY', 'VALIDATION',
] as const;

const Outcome = z.discriminatedUnion('accepted', [
    z.object({ accepted: z.literal(true), review_id: z.string().uuid() }).strict(),
    z.object({ accepted: z.literal(false), code: z.enum(BUYER_REVIEW_REFUSALS) }).strict(),
]);
export type BuyerReviewOutcome = z.infer<typeof Outcome>;

/** Verified storefront context supplies the subject/site/epoch; the database owns both writes. */
export class BuyerReviewExecutionAdapter {
    constructor(private readonly c: Context<{ Bindings: Env }>) {}

    async create(input: BuyerReviewInput): Promise<{ data: BuyerReviewOutcome | null; error: unknown }> {
        const session = getStorefrontBuyerSession(this.c);
        if (!session || !Number.isSafeInteger(session.sessionEpoch) || session.sessionEpoch < 1) {
            return { data: { accepted: false, code: 'BUYER_SESSION_INVALID' }, error: null };
        }
        const { data, error } = await getSupabaseAdmin(this.c).rpc('create_storefront_buyer_review_v1', {
            p_buyer: session.buyerAccountId, p_site: session.siteId, p_epoch: session.sessionEpoch,
            p_product: input.product_id, p_rating: input.rating, p_title: input.title, p_body: input.body,
        });
        // Never project database errors, private ownership fields or unknown RPC shapes.
        if (error) return { data: null, error: true };
        const parsed = Outcome.safeParse(data);
        return parsed.success ? { data: parsed.data, error: null } : { data: null, error: true };
    }
}
