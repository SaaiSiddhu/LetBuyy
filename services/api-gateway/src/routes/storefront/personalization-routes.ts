// CAP-FB-PERSONALIZE (D-9) — the buyer's recently-viewed list and the curated search suggestions
// (schema: migration 230).
//
// Two properties this file exists to hold.
//
// The recently-viewed list is scoped to the buyer id from the VERIFIED session, never a request
// parameter — it is a browsing history, and one addressed to the wrong person looks entirely normal.
//
// A recorded view is NOT a permission. A buyer can post any product_id, so the READ joins products
// and returns only publicly-visible ones. Without that, posting ids and reading the list back would
// turn a history feature into a name-and-price oracle for unpublished catalogue.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECENT = 50;
const DEFAULT_RECENT = 10;

export interface RecentlyViewedRow {
    product_id: string;
    viewed_at: string;
    name: string | null;
    slug: string | null;
    price: number | null;
    image_url: string | null;
    site_id: string | null;
}

export interface TrendingSearchRow {
    id: string;
    term: string;
    position: number;
}

export interface PersonalizationRoutesDeps {
    recordView: (c: AppContext, buyerAccountId: string, productId: string) => Promise<{ error: unknown }>;
    listRecentlyViewed: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: RecentlyViewedRow[] | null; error: unknown }>;
    clearRecentlyViewed: (c: AppContext, buyerAccountId: string) => Promise<{ error: unknown }>;
    listTrendingSearches: (c: AppContext) => Promise<{ data: TrendingSearchRow[] | null; error: unknown }>;
}

export function registerPersonalizationRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: PersonalizationRoutesDeps,
): void {
    const { recordView, listRecentlyViewed, clearRecentlyViewed, listTrendingSearches } = deps;

    // POST /storefront/buyer/product-views { product_id }
    router.post('/buyer/product-views', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        let body: { product_id?: unknown };
        try {
            body = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body with product_id is required.' } }, 400);
        }
        const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
        if (!UUID.test(productId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'product_id must be a UUID.' } }, 400);
        }

        const { error } = await recordView(c, session.buyerAccountId, productId);
        if (error) {
            // A product that no longer exists fails the foreign key. That is the caller's request being
            // wrong, not us being broken, and the response must not distinguish "no such product" from
            // "product you may not see" — which would make this an existence oracle for the catalogue.
            if (isUnknownProductError(error)) {
                return c.json({ success: false, error: { code: 'UNPROCESSABLE', message: 'That product cannot be recorded.' } }, 422);
            }
            return c.json(dbFailureBody(), 500);
        }
        return c.json(success({ product_id: productId, recorded: true }));
    });

    // GET /storefront/buyer/product-views
    router.get('/buyer/product-views', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_RECENT) : DEFAULT_RECENT;

        const { data, error } = await listRecentlyViewed(c, session.buyerAccountId, limit);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });

    // DELETE /storefront/buyer/product-views — clear the history.
    // A browsing history a buyer cannot clear is a browsing history they cannot consent to.
    router.delete('/buyer/product-views', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        const { error } = await clearRecentlyViewed(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ cleared: true }));
    });

    // GET /storefront/marketplace/trending-searches — public, cached, identical for every visitor.
    router.get('/marketplace/trending-searches', async (c) => {
        const key = await storefrontRequestCacheKey(c, 'marketplace:trending-searches');
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await listTrendingSearches(c);
            // An empty list is a real answer — nothing is curated yet. Serving it for an outage would
            // cache the outage as valid curation for the whole TTL.
            if (error) return { status: 500, body: dbFailureBody() };
            return { body: success(data || []), tags: ['marketplace:trending-searches'] };
        });
    });
}

// 23503 is foreign_key_violation: the product_id does not exist.
export function isUnknownProductError(error: unknown): boolean {
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (code === '23503') return true;
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
    return /violates foreign key constraint/i.test(message);
}
