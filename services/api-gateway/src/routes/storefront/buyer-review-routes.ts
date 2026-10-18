// Canonical buyer review transport. Ownership and both writes share one transaction.
import type { Hono } from 'hono';
import type { Env } from '../../index';
import type { BuyerReviewInput, BuyerReviewOutcome } from '../../execution/buyer-review-execution.adapter';
import { dbFailureBody, success } from '../../lib/supabase';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import { CreateStorefrontProductReviewSchema } from '../../schemas/review.schema';
import type { AppContext } from './customer-engagement-routes';

export interface BuyerReviewRoutesDeps {
    requireValidTurnstile: (c: AppContext, body: unknown) => Promise<Response | null>;
    createReview: (c: AppContext, input: BuyerReviewInput) => Promise<{ data: BuyerReviewOutcome | null; error: unknown }>;
}

const messages = {
    BUYER_SESSION_INVALID: [401, 'A storefront sign-in is required.'],
    BUYER_DISABLED: [403, 'Account is disabled.'],
    BUYER_SCOPE_MISMATCH: [403, 'This sign-in cannot submit that review.'],
    STORE_ACCOUNT_NOT_LINKED: [409, 'Connect this store account before submitting a review.'],
    STORE_ACCOUNT_UNAVAILABLE: [409, 'This store account is unavailable for reviews.'],
    NOT_FOUND: [404, 'Product not found for this store.'],
    PRODUCT_UNAVAILABLE: [400, 'This product is not accepting reviews.'],
    CONFLICT: [409, 'You have already reviewed this product.'],
    REVIEW_SOURCE_BUSY: [503, 'Account or product data is changing. Retry shortly.'],
    VALIDATION: [400, 'A valid product review is required.'],
} as const;

export function registerBuyerReviewRoutes(router: Hono<{ Bindings: Env }>, deps: BuyerReviewRoutesDeps): void {
    router.post('/buyer/reviews', requireStorefrontBuyerSession, async (c) => {
        if (!getStorefrontBuyerSession(c)) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        const raw = await c.req.json().catch(() => null);
        const parsed = CreateStorefrontProductReviewSchema
            .pick({ product_id: true, rating: true, title: true, body: true, turnstile_token: true }).safeParse(raw);
        if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'A valid product review is required.' } }, 400);
        const challenged = await deps.requireValidTurnstile(c, parsed.data);
        if (challenged) return challenged;
        const result = await deps.createReview(c, {
            product_id: parsed.data.product_id, rating: parsed.data.rating,
            title: parsed.data.title || null, body: parsed.data.body || null,
        });
        if (result.error || !result.data) return c.json(dbFailureBody(), 500);
        if (!result.data.accepted) {
            const [status, message] = messages[result.data.code];
            return c.json({ success: false, error: { code: result.data.code, message } }, status);
        }
        return c.json(success({ review: { id: result.data.review_id, status: 'pending' }, message: 'Review submitted! It will appear after approval.' }), 201);
    });
}
