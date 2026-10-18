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
import { toPublicVariant, withPublicPriceObservation, type PublicPriceObservation } from '../../lib/public-product-view';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';

type AppContext = Context<{ Bindings: Env }>;
type DatabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

export const MARKETPLACE_LISTING_DETAIL_RPC = 'marketplace_listing_detail';

// MKT-3: the columns hydrated for a public variant. sku and barcode are not requested at all — the
// query does not ask for what the response may not carry — and every row still passes through
// toPublicVariant, so the projection remains the backstop if this list is ever widened. `stock` is
// derived from inventory_qty, matching the storefront's own public variant shape.
export const PUBLIC_VARIANT_SELECT = 'id, product_id, title, price, compare_price, inventory_qty, weight, weight_unit, option1, option2, option3, image_url, position';

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
    country_of_origin?: string | null;
    importer_details?: string | null;
};

export type MarketplaceProductDisclosure = {
    countryOfOrigin: string | null;
    importerDetails: string | null;
};

export async function loadListingDisclosureFromDatabase(
    c: AppContext,
    productId: string,
    siteId: string,
): Promise<{ data: MarketplaceProductDisclosure | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('products')
        .select('country_of_origin,importer_details')
        .eq('id', productId)
        // productId came from marketplace_listing_detail, but products remains tenant-guarded.
        // Carry the RPC's authoritative site id through this public read instead of weakening the guard.
        .eq('site_id', siteId)
        .maybeSingle();
    const row = data as { country_of_origin?: string | null; importer_details?: string | null } | null;
    return {
        data: row ? {
            countryOfOrigin: row.country_of_origin ?? null,
            importerDetails: row.importer_details ?? null,
        } : null,
        error: error as DatabaseErrorLike,
    };
}

export async function loadMarketplaceListingDetailFromDatabase(
    c: AppContext,
    listingId: string,
): Promise<{ data: MarketplaceListingDetailRow | null; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc(MARKETPLACE_LISTING_DETAIL_RPC, { p_listing_id: listingId });
    const rows = (data as MarketplaceListingDetailRow[] | null) ?? null;
    return { data: rows && rows.length > 0 ? rows[0] : null, error: error as DatabaseErrorLike };
}

// MKT-3: hydrated from the canonical product_variants rows — not from products.variants, which is a
// jsonb projection of them (migration 086) and depends on a reconcile having run, and not by widening
// migration 220's return shape, which would put a second variant allowlist in SQL where it could
// drift from SEC-2's. Called ONLY after the RPC returns a row, so 220's seven-predicate fence stays
// the single authority on whether this listing is visible at all.
export async function loadListingVariantsFromDatabase(
    c: AppContext,
    productId: string,
): Promise<{ data: Record<string, unknown>[]; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('product_variants')
        .select(PUBLIC_VARIANT_SELECT)
        .eq('product_id', productId)
        .order('position', { ascending: true });
    return { data: (data as Record<string, unknown>[] | null) ?? [], error: error as DatabaseErrorLike };
}

export async function loadListingPriceObservationsFromDatabase(
    c: AppContext,
    productId: string,
): Promise<{ data: (PublicPriceObservation & { product_id: string; variant_id: string | null })[]; error: DatabaseErrorLike }> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('product_price_reference_window', {
        p_product_ids: [productId],
        p_channel: 'marketplace',
    });
    return {
        data: (data as (PublicPriceObservation & { product_id: string; variant_id: string | null })[] | null) ?? [],
        error: error as DatabaseErrorLike,
    };
}

export interface StorefrontMarketplaceDetailDependencies {
    loadMarketplaceListingDetail?: (c: AppContext, listingId: string) => Promise<{ data: MarketplaceListingDetailRow | null; error: DatabaseErrorLike }>;
    loadListingVariants?: (c: AppContext, productId: string) => Promise<{ data: Record<string, unknown>[]; error: DatabaseErrorLike }>;
    loadPriceObservations?: typeof loadListingPriceObservationsFromDatabase;
    loadDisclosure?: typeof loadListingDisclosureFromDatabase;
}

export function registerStorefrontMarketplaceDetailRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontMarketplaceDetailDependencies = {},
): void {
    const loadListing = dependencies.loadMarketplaceListingDetail ?? loadMarketplaceListingDetailFromDatabase;
    const loadVariants = dependencies.loadListingVariants ?? loadListingVariantsFromDatabase;
    const loadPriceObservations = dependencies.loadPriceObservations ?? loadListingPriceObservationsFromDatabase;
    const loadDisclosure = dependencies.loadDisclosure ?? loadListingDisclosureFromDatabase;

    // GET /storefront/marketplace/listings/:id — one approved listing, or 404.
    // Registered with the other /marketplace routes, before the `/:subdomain/...` family, so no
    // handle-shaped pattern can shadow it.
    router.get('/marketplace/listings/:id', async (c) => {
        const listingId = c.req.param('id');
        if (!UUID.test(listingId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid listing identifier' } }, 400);
        }
        const key = await storefrontRequestCacheKey(c, 'marketplace:listing', listingId);
        // A direct listing link is an eligibility-sensitive read; never serve a previously
        // approved response after the canonical fence has changed.
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
            // The listing exists and is publicly visible; only now are its variants read.
            const variants = await loadVariants(c, data.product_id);
            const priceObservations = await loadPriceObservations(c, data.product_id);
            const disclosure = await loadDisclosure(c, data.product_id, data.site_id);
            if (disclosure.error) return { status: 500, body: dbFailureBody() };
            if (priceObservations.error
                && priceObservations.error.code !== 'PGRST202'
                && priceObservations.error.code !== '42883') {
                return { status: 500, body: dbFailureBody() };
            }
            const observationByVariantId = new Map<string, PublicPriceObservation>();
            let productObservation: PublicPriceObservation | undefined;
            for (const observation of priceObservations.data) {
                if (observation.variant_id) observationByVariantId.set(observation.variant_id, observation);
                else productObservation = observation;
            }
            const effectiveProductObservation = productObservation ?? {
                current_price: data.price,
                prior_lowest_price_30d: null,
                prior_coverage_complete: false,
                price_observed_at: null,
            };
            const productWithPriceEvidence = withPublicPriceObservation({
                ...data,
                country_of_origin: disclosure.data?.countryOfOrigin ?? null,
                importer_details: disclosure.data?.importerDetails ?? null,
            }, effectiveProductObservation);
            // A variant-read failure must not turn a good listing into a 500 — a product page
            // without a variant picker is degraded, not broken, and the storefront's own hydration
            // treats a missing product_variants table the same way.
            const publicVariants = (variants.error ? [] : variants.data).map((variant) => {
                const variantId = typeof variant.id === 'string' ? variant.id : '';
                const observation = observationByVariantId.get(variantId) ?? {
                    current_price: variant.price as number | string | null,
                    prior_lowest_price_30d: null,
                    prior_coverage_complete: false,
                    price_observed_at: null,
                };
                return toPublicVariant(withPublicPriceObservation(variant, observation));
            });
            return {
                body: success({ ...productWithPriceEvidence, variants: publicVariants }),
                tags: ['marketplace:feed', `marketplace:listing:${listingId}`],
            };
        }, { bypassCache: true });
    });
}
