// Site-bound buyer reviews reuse the existing product_reviews table, but derive the
// store-customer identity only from the verified buyer_store_customers relationship.
import type { Hono } from 'hono';
import { CreateStorefrontProductReviewSchema } from '../../schemas/review.schema';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import type { AppContext } from './customer-engagement-routes';

type ReviewInput = {
    product_id: string;
    rating: number;
    title?: string | null;
    body?: string | null;
    turnstile_token?: string | null;
};

type LinkedReviewCustomer = {
    customerId: string;
    customerName: string | null;
    customerEmail: string;
    active: boolean;
};

export interface BuyerReviewRoutesDeps {
    resolveLinkedCustomer: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ data: LinkedReviewCustomer | null; error: unknown }>;
    requireValidTurnstile: (c: AppContext, body: unknown) => Promise<Response | null>;
    loadProduct: (c: AppContext, productId: string, siteId: string) => Promise<{ data: { active: boolean } | null; error: unknown }>;
    hasDuplicate: (c: AppContext, productId: string, siteId: string, customerEmail: string) => Promise<{ data: boolean; error: unknown }>;
    insertReview: (c: AppContext, review: {
        store_id: string;
        product_id: string;
        customer_name: string;
        customer_email: string;
        rating: number;
        title: string | null;
        body: string | null;
        is_verified: true;
        is_approved: false;
        status: 'pending';
    }) => Promise<{ data: { id: string } | null; error: unknown }>;
}

export function registerBuyerReviewRoutes(router: Hono<{ Bindings: Env }>, deps: BuyerReviewRoutesDeps): void {
    router.post('/buyer/reviews', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);

        const raw = await c.req.json().catch(() => null) as Record<string, unknown> | null;
        const parsed = CreateStorefrontProductReviewSchema
            .pick({ product_id: true, rating: true, title: true, body: true, turnstile_token: true })
            .safeParse(raw);
        if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'A valid product review is required.' } }, 400);
        const body = parsed.data as ReviewInput;

        const turnstileRejected = await deps.requireValidTurnstile(c, body);
        if (turnstileRejected) return turnstileRejected;

        const linked = await deps.resolveLinkedCustomer(c, session.buyerAccountId, session.siteId);
        if (linked.error) return c.json(dbFailureBody(), 500);
        if (!linked.data) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_NOT_LINKED', message: 'Connect this store account before submitting a review.' } }, 409);
        if (!linked.data.active) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_UNAVAILABLE', message: 'This store account is unavailable for reviews.' } }, 409);

        const product = await deps.loadProduct(c, body.product_id, session.siteId);
        if (product.error) return c.json(dbFailureBody(), 500);
        if (!product.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found for this store.' } }, 404);
        if (!product.data.active) return c.json({ success: false, error: { code: 'PRODUCT_UNAVAILABLE', message: 'This product is not accepting reviews.' } }, 400);

        const duplicate = await deps.hasDuplicate(c, body.product_id, session.siteId, linked.data.customerEmail);
        if (duplicate.error) return c.json(dbFailureBody(), 500);
        if (duplicate.data) return c.json({ success: false, error: { code: 'CONFLICT', message: 'You have already reviewed this product.' } }, 409);

        const inserted = await deps.insertReview(c, {
            store_id: session.siteId,
            product_id: body.product_id,
            customer_name: linked.data.customerName || 'Customer',
            customer_email: linked.data.customerEmail,
            rating: body.rating,
            title: body.title || null,
            body: body.body || null,
            is_verified: true,
            is_approved: false,
            status: 'pending',
        });
        if (inserted.error || !inserted.data) return c.json(dbFailureBody(), 500);

        return c.json(success({ review: { id: inserted.data.id, status: 'pending' }, message: 'Review submitted! It will appear after approval.' }), 201);
    });
}
