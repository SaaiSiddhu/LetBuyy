// CAP-FB-ADS (D-9) — the public sponsored-product read (schema: migration 232, governed by D-5).
//
// This is the ONE thing System A's client actually does with ads: marketplace_ad_provider.dart reads
// active campaigns, then their active ad_products, then hydrates each product. Nothing in this
// repository writes campaigns, so nothing else here is a port — it would be an invention.
//
// A sponsored placement must be DISCLOSED. Returning paid placements indistinguishable from organic
// results is what advertising regulators call undisclosed advertising, so every row carries
// `sponsored: true` and the field is not optional.
//
// The projection is the narrow public product view: a paid placement must not become a way to read
// catalogue fields an ordinary storefront read would refuse (SEC-1's rule).

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';
import type { AppContext } from './customer-engagement-routes';

const MAX_SPONSORED = 20;

export interface SponsoredPlacementRow {
    campaign_id: string;
    product_id: string;
    site_id: string;
    position: number;
    name: string | null;
    slug: string | null;
    price: number | null;
    image_url: string | null;
}

export interface SponsoredProductRoutesDeps {
    /// Active placements on active campaigns whose products are publicly visible. The filtering is
    /// the dependency's job so a caller cannot obtain the unfiltered set.
    loadSponsored: (c: AppContext, limit: number) => Promise<{ data: SponsoredPlacementRow[] | null; error: unknown }>;
}

export function registerSponsoredProductRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: SponsoredProductRoutesDeps,
): void {
    const { loadSponsored } = deps;

    router.get('/marketplace/sponsored-products', async (c) => {
        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_SPONSORED) : 10;

        const key = await storefrontRequestCacheKey(c, 'marketplace:sponsored');
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await loadSponsored(c, limit);
            // An empty list is a real answer — nobody is advertising right now. A 500 for an outage
            // keeps the cache from storing the outage as "no advertisers" for the whole TTL.
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: success((data || []).map((row) => ({ ...row, sponsored: true as const }))),
                tags: ['marketplace:sponsored'],
            };
        });
    });
}
