// A storefront buyer may use this store's existing customer wishlist only after the
// verified buyer_store_customers relationship has been explicitly created.
import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import type { AppContext } from './customer-engagement-routes';

const PRODUCT_ID_MAX_LENGTH = 200;
const isProductId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= PRODUCT_ID_MAX_LENGTH;

export interface BuyerWishlistRoutesDeps {
    resolveLinkedCustomer: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ data: { storeCustomerId: string; active: boolean } | null; error: unknown }>;
    list: (c: AppContext, storeCustomerId: string, siteId: string) => Promise<{ data: string[] | null; error: unknown }>;
    save: (c: AppContext, storeCustomerId: string, siteId: string, productId: string, variantId: string | null) => Promise<{ error: unknown }>;
    remove: (c: AppContext, storeCustomerId: string, siteId: string, productId: string) => Promise<{ error: unknown }>;
}

export function registerBuyerWishlistRoutes(router: Hono<{ Bindings: Env }>, deps: BuyerWishlistRoutesDeps): void {
    router.get('/buyer/wishlist', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        const linked = await deps.resolveLinkedCustomer(c, session.buyerAccountId, session.siteId);
        if (linked.error) return c.json(dbFailureBody(), 500);
        if (!linked.data) return c.json(success({ linked: false, reason: 'not_linked', product_ids: [] }));
        if (!linked.data.active) return c.json(success({ linked: false, reason: 'store_account_unavailable', product_ids: [] }));
        const result = await deps.list(c, linked.data.storeCustomerId, session.siteId);
        if (result.error) return c.json(dbFailureBody(), 500);
        return c.json(success({ linked: true, product_ids: result.data ?? [] }));
    });

    router.post('/buyer/wishlist', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        const body = await c.req.json().catch(() => null) as { product_id?: unknown; variant_id?: unknown } | null;
        if (!body || !isProductId(body.product_id) || (body.variant_id != null && !isProductId(body.variant_id))) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A valid product_id is required.' } }, 400);
        }
        const linked = await deps.resolveLinkedCustomer(c, session.buyerAccountId, session.siteId);
        if (linked.error) return c.json(dbFailureBody(), 500);
        if (!linked.data) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_NOT_LINKED', message: 'Connect this store account before saving a wishlist.' } }, 409);
        if (!linked.data.active) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_UNAVAILABLE', message: 'This store account is unavailable for wishlist use.' } }, 409);
        const result = await deps.save(c, linked.data.storeCustomerId, session.siteId, body.product_id, typeof body.variant_id === 'string' ? body.variant_id : null);
        if (result.error) return c.json(dbFailureBody(), 500);
        return c.json(success({ saved: true }));
    });

    router.delete('/buyer/wishlist', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        const body = await c.req.json().catch(() => null) as { product_id?: unknown } | null;
        if (!body || !isProductId(body.product_id)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A valid product_id is required.' } }, 400);
        }
        const linked = await deps.resolveLinkedCustomer(c, session.buyerAccountId, session.siteId);
        if (linked.error) return c.json(dbFailureBody(), 500);
        if (!linked.data) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_NOT_LINKED', message: 'Connect this store account before changing a wishlist.' } }, 409);
        if (!linked.data.active) return c.json({ success: false, error: { code: 'STORE_ACCOUNT_UNAVAILABLE', message: 'This store account is unavailable for wishlist use.' } }, 409);
        const result = await deps.remove(c, linked.data.storeCustomerId, session.siteId, body.product_id);
        if (result.error) return c.json(dbFailureBody(), 500);
        return c.json(success({ removed: true }));
    });
}
