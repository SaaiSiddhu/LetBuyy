// MKT-2 — the marketplace's single-listing public read.
//
// MKT-1 gave the marketplace a feed and a category list; neither can open a product. Without this
// route an app had to fall back to the merchant's own GET /storefront/:subdomain/products/:slug,
// which enforces p.is_active and the store's publication but never reads channel_listings — so a
// listing an operator rejected or took down through ADM-1 still rendered from the marketplace. The
// moderation decision existed in the database and was unenforced on the surface a shopper opens.
//
// marketplace_listing_detail (220) carries the seven fence predicates verbatim from marketplace_feed,
// so a listing hidden from the grid is unreachable by direct link and a listing in the grid opens.
// The gateway never re-implements that fence: it passes the id and caches the answer.
//
// This lives in its own module rather than in public-routes.ts because that file sits at 1488 of the
// 1500-line ceiling route-line-count-validator enforces, and because the register*Routes convention
// (cart-routes, checkout-payment-routes, customer-engagement-routes) is how this router already
// splits route families.

import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';

type AppContext = Context<{ Bindings: Env }>;
type DatabaseErrorLike = { message?: string; details?: string; hint?: string } | null | undefined;

export const MARKETPLACE_LISTING_DETAIL_RPC = 'marketplace_listing_detail';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The RPC's return shape (220). No cost_price, cost_per_item, sku or barcode: SEC-1's rule for any
// public product read. No variants either — products.variants is an unaudited jsonb blob and
// variant-level sku/barcode is an open finding, so a new public read must not carry it.
export type MarketplaceListingDetailRow = {
    listing_id: string;
    product_id: string;
    site_id: string;
    store_name: string | null;
    subdomain: string | null;
    name: string;
    slug: string | null;
    description: string | null;
    images: string[] | null;
    price: number | string | null;
    compare_price: number | string | null;
    product_type: string | null;
    tags: string[] | null;
    thumbnail_url: string | null;
    stock: number | null;
    track_inventory: boolean | null;
    seo_title: string | null;
    seo_description: string | null;
    category_slug: string | null;
    approved_at: string;
};

export async function loadMarketplaceListingDetailFromDatabase(
    c: AppContext,
    listingId: string,
): Promise<{ data: MarketplaceListingDetailRow | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc(MARKETPLACE_LISTING_DETAIL_RPC, { p_listing_id: listingId });
    const rows = (data as MarketplaceListingDetailRow[] | null) ?? null;
    return { data: rows && rows.length > 0 ? rows[0] : null, error: error as DatabaseErrorLike };
}

export interface StorefrontMarketplaceDetailDependencies {
    loadMarketplaceListingDetail?: (c: AppContext, listingId: string) => Promise<{ data: MarketplaceListingDetailRow | null; error: DatabaseErrorLike }>;
}

export function registerStorefrontMarketplaceDetailRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontMarketplaceDetailDependencies = {},
): void {
    const loadListing = dependencies.loadMarketplaceListingDetail ?? loadMarketplaceListingDetailFromDatabase;

    // GET /storefront/marketplace/listings/:id — one approved listing, or 404.
    // Registered with the other /marketplace routes, before the `/:subdomain/...` family, so no
    // handle-shaped pattern can shadow it.
    router.get('/marketplace/listings/:id', async (c) => {
        const listingId = c.req.param('id');
        if (!UUID.test(listingId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid listing identifier' } }, 400);
        }
        const key = await storefrontRequestCacheKey(c, 'marketplace:listing', listingId);
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await loadListing(c, listingId);
            // A query failure is not an absence: reporting it as 404 would hide a schema or
            // connection fault behind an indistinguishable "not found" (the defect PHASE-T3 fixed on
            // the storefront's own product detail). The raw error never reaches the client.
            if (error) return { status: 500, body: dbFailureBody() };
            if (!data) {
                // Absent, unapproved, hidden, taken down, inactive, deleted, or on an unpublished
                // site — the fence does not distinguish, and neither should the response.
                return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found' } } };
            }
            return {
                body: success(data),
                tags: ['marketplace:feed', `marketplace:listing:${listingId}`],
            };
        });
    });
}
