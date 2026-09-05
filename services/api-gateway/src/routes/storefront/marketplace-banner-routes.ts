// CAP-FB-BANNERS — the marketplace home strip's public read (schema: migration 228).
//
// System A's client read Firestore's flat `banners` collection directly with orderBy('priority') and
// filtered `isActive` IN THE APP, so every inactive banner — unpublished editorial work — was shipped
// to every device that opened the home screen and only then hidden. The filter belongs on the server,
// and 228's marketplace_banners_public_read policy makes it true at the database as well.
//
// Its own module rather than public-routes.ts, which sits near the 1500-line ceiling
// route-line-count-validator enforces; the register*Routes convention is how this router already
// splits route families (cart-routes, checkout-payment-routes, marketplace-detail-routes).
//
// Cached like the feed and the taxonomy: the strip is identical for every visitor — there is no
// site_id and no per-buyer variation — which is exactly the read the storefront cache exists for.

import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';

type AppContext = Context<{ Bindings: Env }>;

// The public projection. is_active is NOT among them: every row in this response is active by
// construction, so returning the flag would invite a client to filter on it again — the client-side
// filtering this route replaces. created_at and updated_at are curation metadata, not display data.
export const PUBLIC_MARKETPLACE_BANNER_COLUMNS =
    'id, title, subtitle, image_url, icon_name, target_route, color_hex, image_width, image_height, aspect_ratio_type, position';

export type PublicMarketplaceBanner = {
    id: string;
    title: string;
    subtitle: string;
    image_url: string;
    icon_name: string | null;
    target_route: string | null;
    color_hex: string | null;
    image_width: number | null;
    image_height: number | null;
    aspect_ratio_type: string | null;
    position: number;
};

export interface MarketplaceBannerRoutesDeps {
    /// Active banners in display order, or an error. Injectable so a unit test can drive the route
    /// without a database; the default below is the real query. A fake that models the active filter
    /// proves nothing about the real one, so the real query is asserted separately as a source
    /// contract in the test file.
    loadActiveBanners?: (c: AppContext) => Promise<{ data: PublicMarketplaceBanner[] | null; error: unknown }>;
}

// The one place the strip's visibility rule is expressed in the gateway. 228's public-read policy
// says the same thing at the database, so a caller that reached the table with the anon role could
// not widen it either — the two are deliberately redundant, not one guarded by the other.
export async function loadActiveMarketplaceBannersFromDatabase(
    c: AppContext,
): Promise<{ data: PublicMarketplaceBanner[] | null; error: unknown }> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('marketplace_banners')
        .select(PUBLIC_MARKETPLACE_BANNER_COLUMNS)
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    return { data: (data || null) as PublicMarketplaceBanner[] | null, error };
}

export function registerMarketplaceBannerRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: MarketplaceBannerRoutesDeps = {},
): void {
    const loadActiveBanners = deps.loadActiveBanners ?? loadActiveMarketplaceBannersFromDatabase;
    router.get('/marketplace/banners', async (c) => {
        const key = await storefrontRequestCacheKey(c, 'marketplace:banners');
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await loadActiveBanners(c);
            // A banner-strip failure is a 500 and not an empty strip: an empty array is a legitimate
            // answer (no banners are published) and must not double as "the database is down", or the
            // cache would store the outage as a valid empty strip for its whole TTL.
            if (error) return { status: 500, body: dbFailureBody() };
            return { body: success(data || []), tags: ['marketplace:banners'] };
        });
    });
}
