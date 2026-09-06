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
import { adEventIdempotencyKey, issueAdPlacementToken, verifyAdPlacementToken } from '../../lib/ad-placement-token';
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

export interface AdSpendResult {
    charged: boolean;
    charged_minor?: number;
    reason?: string;
}

export interface SponsoredProductRoutesDeps {
    /// Active placements on active campaigns whose products are publicly visible. The filtering is
    /// the dependency's job so a caller cannot obtain the unfiltered set.
    loadSponsored: (c: AppContext, limit: number) => Promise<{ data: SponsoredPlacementRow[] | null; error: unknown }>;
    /// Calls record_ad_spend. The cost is decided in the database from the campaign's own bid; this
    /// side supplies only WHICH campaign and WHAT happened.
    recordAdSpend?: (
        c: AppContext,
        input: { siteId: string; campaignId: string; eventType: 'click' | 'impression'; idempotencyKey: string },
    ) => Promise<{ data: AdSpendResult | null; error: unknown }>;
}

export function registerSponsoredProductRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: SponsoredProductRoutesDeps,
): void {
    const { loadSponsored, recordAdSpend } = deps;

    router.get('/marketplace/sponsored-products', async (c) => {
        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_SPONSORED) : 10;

        const key = await storefrontRequestCacheKey(c, 'marketplace:sponsored');
        const cached = await cachedJson(c, key, STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const { data, error } = await loadSponsored(c, limit);
            // An empty list is a real answer — nobody is advertising right now. A 500 for an outage
            // keeps the cache from storing the outage as "no advertisers" for the whole TTL.
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: success((data || []).map((row) => ({ ...row, sponsored: true as const }))),
                tags: ['marketplace:sponsored'],
            };
        });

        // Tokens are minted HERE, on the response, and never inside the cached body above. The rows
        // are shared across every buyer who hits this TTL; a token in there would be shared too, and
        // since the nonce is the idempotency key that would bill ONE event per cache period instead
        // of one per impression — every later click silently free, and the whole thing looking like
        // it worked. This is the single most important line in the file.
        const secret = c.env.AD_PLACEMENT_SIGNING_SECRET;
        if (!secret || cached.status >= 400) return cached;

        let payload: { success?: boolean; data?: SponsoredPlacementRow[] };
        try {
            payload = (await cached.clone().json()) as typeof payload;
        } catch {
            return cached;
        }
        if (!Array.isArray(payload.data)) return cached;

        const withTokens = await Promise.all(payload.data.map(async (row) => ({
            ...row,
            placement_token: await issueAdPlacementToken(secret, {
                siteId: row.site_id, campaignId: row.campaign_id, productId: row.product_id,
            }),
        })));
        return c.json({ ...payload, data: withTokens });
    });

    // POST /storefront/ads/event — the only path that turns a placement into a charge.
    //
    // Public and unauthenticated, because the feed it follows is. The token is what makes that safe:
    // it proves the platform served this exact placement, it expires, and its nonce is the
    // idempotency key, so record_ad_spend's own replay path makes one token bill exactly once. This
    // route keeps no state and no seen-set of its own.
    router.post('/ads/event', async (c) => {
        const secret = c.env.AD_PLACEMENT_SIGNING_SECRET;
        // Fails CLOSED. Without the secret nothing can be verified, so nothing may be billed —
        // rather than billing on an unverified request, which is the failure that would matter.
        if (!secret || !recordAdSpend) {
            return c.json({ success: false, error: { code: 'AD_EVENTS_UNAVAILABLE', message: 'Ad event recording is not configured.' } }, 503);
        }

        let body: { token?: unknown; event_type?: unknown };
        try {
            body = (await c.req.json()) as typeof body;
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }

        const eventType = body.event_type;
        if (eventType !== 'click' && eventType !== 'impression') {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'event_type must be click or impression.' } }, 400);
        }
        if (typeof body.token !== 'string') {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A placement token is required.' } }, 400);
        }

        const claims = await verifyAdPlacementToken(secret, body.token);
        // One answer for forged, tampered, malformed and expired alike: telling a caller WHICH of
        // those it was is a probing oracle against a money endpoint.
        if (!claims) {
            return c.json({ success: false, error: { code: 'INVALID_PLACEMENT_TOKEN', message: 'This placement token is not valid.' } }, 403);
        }

        const { data, error } = await recordAdSpend(c, {
            siteId: claims.siteId,
            campaignId: claims.campaignId,
            eventType,
            idempotencyKey: adEventIdempotencyKey(claims),
        });
        if (error) return c.json(dbFailureBody(), 500);
        // A decline is a 200 with charged:false, not an error: "the campaign is out of budget" is a
        // correct answer to a well-formed request, and a client must not retry it as if it failed.
        return c.json(success(data ?? { charged: false }));
    });
}
