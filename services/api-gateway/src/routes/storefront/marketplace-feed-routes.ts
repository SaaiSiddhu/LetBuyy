import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';
import { withPublicPriceObservation, type PublicPriceObservation } from '../../lib/public-product-view';
import { validate } from '../../middleware/validation';
import { MarketplaceFeedQuery, type MarketplaceFeedInput } from '../../schemas/channel-listing.schema';

type AppContext = Context<{ Bindings: Env }>;
type DatabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

export type StorefrontMarketplaceFeedDependencies = {
    // MKT-1 — marketplace reads. Optional so the storefront.ts call site is untouched; the defaults
    // below call the SECURITY DEFINER functions from migration 217. Injectable for unit tests.
    loadMarketplaceFeed?: (c: AppContext, params: MarketplaceFeedParams) => Promise<{ data: MarketplaceFeedRow[] | null; error: DatabaseErrorLike }>;
    loadMarketplacePriceObservations?: (c: AppContext, productIds: string[], channel: 'marketplace') => Promise<{ data: MarketplacePriceObservation[] | null; error: DatabaseErrorLike }>;
    listMarketplaceCategories?: (c: AppContext) => Promise<{ data: MarketplaceCategoryRow[] | null; error: DatabaseErrorLike }>;
    listMarketplaceOrigins?: (c: AppContext) => Promise<{ data: MarketplaceOriginRow[] | null; error: DatabaseErrorLike }>;
};

// ── MKT-1: marketplace feed + taxonomy (public reads) ─────────────────────────────────────────
// marketplace_feed (217) is the ONE designed cross-tenant read: SECURITY DEFINER, explicit column
// allowlist, filters mirroring the storefront. Gateway forwards canonical parameters instead of
// reimplementing eligibility joins; visibility-sensitive feed reads bypass cached approvals.
export const MARKETPLACE_FEED_RPC = 'marketplace_feed';

export type MarketplaceFeedParams = {
    siteId?: string;
    category: string | null;
    search: string | null;
    limit: number;
    afterApprovedAt: string | null;
    afterId: string | null;
    countryOfOrigin: string | null;
};

export type MarketplaceFeedRow = {
    listing_id: string;
    product_id: string;
    site_id: string;
    store_name: string | null;
    subdomain: string | null;
    name: string;
    slug: string | null;
    images: string[] | null;
    price: number | string | null;
    compare_price: number | string | null;
    category_slug: string | null;
    approved_at: string;
    country_of_origin?: string | null;
};

export type MarketplacePriceObservation = PublicPriceObservation & { product_id: string; variant_id: string | null };

export type MarketplaceCategoryRow = {
    id: string;
    slug: string;
    name: string;
    parent_id: string | null;
    position: number;
};

export type MarketplaceOriginRow = { country_of_origin: string };

export async function loadMarketplaceFeedFromDatabase(
    c: AppContext,
    params: MarketplaceFeedParams,
): Promise<{ data: MarketplaceFeedRow[] | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc(MARKETPLACE_FEED_RPC, {
        // Preserve the deployed six-argument overload for ordinary feed clients. The seller
        // overload applies its scope inside SQL, before the keyset limit, never after a page.
        ...(params.siteId ? { p_site_id: params.siteId } : {}),
        p_category_slug: params.category,
        p_search: params.search,
        p_limit: params.limit,
        p_after_approved_at: params.afterApprovedAt,
        p_after_id: params.afterId,
        p_country_of_origin: params.countryOfOrigin,
    });
    return { data: (data as MarketplaceFeedRow[] | null) ?? null, error: error as DatabaseErrorLike };
}

export async function loadMarketplacePriceObservationsFromDatabase(
    c: AppContext,
    productIds: string[],
    channel: 'marketplace',
): Promise<{ data: MarketplacePriceObservation[] | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('product_price_reference_window', {
        p_product_ids: productIds,
        p_channel: channel,
    });
    return { data: (data as MarketplacePriceObservation[] | null) ?? null, error: error as DatabaseErrorLike };
}

export async function listMarketplaceCategoriesFromDatabase(
    c: AppContext,
): Promise<{ data: MarketplaceCategoryRow[] | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    // Mirrors marketplace_categories_public_read (217): only live taxonomy is ever exposed.
    const { data, error } = await db
        .from('marketplace_categories')
        .select('id, slug, name, parent_id, position')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('name', { ascending: true });
    return { data: (data as MarketplaceCategoryRow[] | null) ?? null, error: error as DatabaseErrorLike };
}

export async function listMarketplaceOriginsFromDatabase(
    c: AppContext,
): Promise<{ data: MarketplaceOriginRow[] | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('marketplace_origins');
    return { data: (data as MarketplaceOriginRow[] | null) ?? null, error: error as DatabaseErrorLike };
}

export function marketplaceFeedParams(query: MarketplaceFeedInput): MarketplaceFeedParams {
    return {
        ...(query.site_id ? { siteId: query.site_id } : {}),
        category: query.category ?? null,
        search: query.search && query.search.length > 0 ? query.search : null,
        limit: query.limit,
        afterApprovedAt: query.after_approved_at ?? null,
        afterId: query.after_id ?? null,
        countryOfOrigin: query.country_of_origin ?? null,
    };
}

export function registerStorefrontMarketplaceFeedRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontMarketplaceFeedDependencies,
): void {
    const loadMarketplaceFeed = dependencies.loadMarketplaceFeed ?? loadMarketplaceFeedFromDatabase;
    const loadMarketplacePrices = dependencies.loadMarketplacePriceObservations ?? loadMarketplacePriceObservationsFromDatabase;
    const listMarketplaceCategories = dependencies.listMarketplaceCategories ?? listMarketplaceCategoriesFromDatabase;
    const listMarketplaceOrigins = dependencies.listMarketplaceOrigins ?? listMarketplaceOriginsFromDatabase;

    // MKT-1 — registered before the `/:subdomain/...` family so no handle-shaped pattern can shadow them.
    // GET /storefront/marketplace/feed?category=&search=&limit=&after_approved_at=&after_id=
    router.get('/marketplace/feed', validate('query', MarketplaceFeedQuery), async (c) => {
        const query = c.get('validatedQuery') as MarketplaceFeedInput;
        const params = marketplaceFeedParams(query);
        const key = await storefrontRequestCacheKey(
            c,
            'marketplace:feed',
            params.category ?? '',
            params.search ?? '',
            String(params.limit),
            params.afterApprovedAt ?? '',
            params.afterId ?? '',
            params.countryOfOrigin ?? '',
            params.siteId ?? '',
        );
        // Marketplace visibility changes are security-sensitive: a cached approved row must not
        // survive rejection, revocation, or a material revision. Re-run the canonical SQL fence.
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await loadMarketplaceFeed(c, params);
            if (error) return { status: 500, body: dbFailureBody() };
            const items = data || [];
            const productIds = Array.from(new Set(items.map((item) => item.product_id)));
            const priceResult = productIds.length > 0
                ? await loadMarketplacePrices(c, productIds, 'marketplace')
                : { data: [] as MarketplacePriceObservation[], error: null };
            if (priceResult.error
                && priceResult.error.code !== 'PGRST202'
                && priceResult.error.code !== '42883') {
                return { status: 500, body: dbFailureBody() };
            }
            const observationByProduct = new Map<string, PublicPriceObservation>();
            for (const observation of priceResult.data || []) {
                if (observation.variant_id === null) observationByProduct.set(observation.product_id, observation);
            }
            const publicItems = items.map((item) => withPublicPriceObservation(
                item,
                observationByProduct.get(item.product_id) ?? {
                    current_price: item.price,
                    prior_lowest_price_30d: null,
                    prior_coverage_complete: false,
                    price_observed_at: null,
                },
            ));
            const last = items.length === params.limit ? items[items.length - 1] : null;
            return {
                body: success(publicItems, {
                    meta: {
                        limit: params.limit,
                        next_cursor: last ? { after_approved_at: last.approved_at, after_id: last.listing_id } : null,
                    },
                }),
                tags: ['marketplace:feed'],
            };
        }, { bypassCache: true });
    });

    // GET /storefront/marketplace/categories — the live platform taxonomy (no site scope by design)
    router.get('/marketplace/categories', async (c) => {
        const key = await storefrontRequestCacheKey(c, 'marketplace:categories');
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await listMarketplaceCategories(c);
            if (error) return { status: 500, body: dbFailureBody() };
            return { body: success(data || []), tags: ['marketplace:categories'] };
        });
    });

    router.get('/marketplace/origins', async (c) => {
        const key = await storefrontRequestCacheKey(c, 'marketplace:origins');
        return cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await listMarketplaceOrigins(c);
            if (error) return { status: 500, body: dbFailureBody() };
            return { body: success(data || []), tags: ['marketplace:origins'] };
        });
    });

}
