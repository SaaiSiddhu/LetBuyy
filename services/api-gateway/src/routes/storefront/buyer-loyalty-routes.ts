// CAP-FB-LOYALTY (D-9) — the buyer's loyalty balance, per merchant (schema: migration 231, D-17).
//
// READ ONLY. Every mutation of a loyalty balance goes through award_loyalty_points /
// redeem_loyalty_points, which are SECURITY DEFINER RPCs with idempotency keys and advisory locks;
// canonical-ledger-only-validator exists to stop money tables being written from TypeScript, and
// nothing here writes.
//
// Balances are PER MERCHANT (D-17's accepted cost of merchant funding), so every route takes a
// siteId and the buyer from the verified session. The balance itself comes from the database's own
// loyalty_balance() projection — never summed here, because a second projection that disagreed with
// the first would be a second source of truth for a money balance.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HISTORY = 100;

export interface LoyaltySummary {
    site_id: string;
    balance: number | string;
    is_active: boolean;
    earn_rate_bps: number;
    redeem_cap_bps: number;
    point_value_minor: number;
}

export interface LoyaltyEntryRow {
    id: string;
    entry_type: string;
    points: number | string;
    balance_after: number | string;
    order_id: string | null;
    created_at: string;
}

export interface BuyerLoyaltyRoutesDeps {
    /// Returns null when the merchant is not enrolled at all — distinct from enrolled with a zero
    /// balance, which is a real state a buyer should see.
    loadSummary: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ data: LoyaltySummary | null; error: unknown }>;
    listEntries: (c: AppContext, buyerAccountId: string, siteId: string, limit: number) => Promise<{ data: LoyaltyEntryRow[] | null; error: unknown }>;
}

function siteIdParam(c: AppContext): string | null {
    const id = c.req.param('siteId') || '';
    return UUID.test(id) ? id : null;
}

export function registerBuyerLoyaltyRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerLoyaltyRoutesDeps,
): void {
    const { loadSummary, listEntries } = deps;

    // The account page runs on the merchant's origin and only has a site-bound storefront token.
    // Its site comes from signed state, never a caller-selected path segment. These routes are
    // deliberately read-only; the checkout/ledger RPCs remain the only money mutation authority.
    router.get('/buyer/storefront-loyalty', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);

        const { data, error } = await loadSummary(c, session.buyerAccountId, session.siteId);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json(success({ site_id: session.siteId, enrolled: false, balance: null }));
        return c.json(success({ ...data, enrolled: true }));
    });

    router.get('/buyer/storefront-loyalty/history', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_HISTORY) : 25;
        const { data, error } = await listEntries(c, session.buyerAccountId, session.siteId, limit);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });

    // GET /storefront/buyer/loyalty/:siteId
    router.get('/buyer/loyalty/:siteId', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        const siteId = siteIdParam(c);
        if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'siteId must be a UUID.' } }, 400);

        const { data, error } = await loadSummary(c, session.buyerAccountId, siteId);
        // A balance failure is a 500, never a zero. Zero is a real balance, and serving it for an
        // outage would tell a buyer their points are gone.
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) {
            // Not enrolled. Reported as an explicit state rather than a zero balance, so a client
            // shows "this seller has no rewards programme" instead of "you have 0 points".
            return c.json(success({ site_id: siteId, enrolled: false, balance: null }));
        }
        return c.json(success({ ...data, enrolled: true }));
    });

    // GET /storefront/buyer/loyalty/:siteId/history
    router.get('/buyer/loyalty/:siteId/history', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        const siteId = siteIdParam(c);
        if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'siteId must be a UUID.' } }, 400);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_HISTORY) : 25;

        const { data, error } = await listEntries(c, session.buyerAccountId, siteId, limit);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });
}
