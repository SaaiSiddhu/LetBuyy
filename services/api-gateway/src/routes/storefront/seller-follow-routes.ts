// CAP-FB-SOCIAL (D-9) — the buyer→seller follower graph (schema: migration 229).
//
// The seller profile in apps/customer_app renders a Follow button whose onTap is
// `setState(() => _isFollowing = !_isFollowing)` and nothing else, beside `final int _followersCount = 0`
// — a field that can never change. The button has been reporting a state it never stored. This is the
// state.
//
// Every buyer-scoped route takes its owner from the VERIFIED session and never from a request
// parameter: a follow list that takes its owner from the query string is a follow list anyone can
// read, and the response looks entirely normal while being addressed to the wrong person.
//
// The follower COUNT is a projection over the table. There is deliberately no follower_count column:
// the Firestore implementation kept both a subcollection count and a denormalised counter on the
// seller document, and those disagree the moment one write lands and the other does not.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export interface FollowedSellerRow {
    site_id: string;
    followed_at: string;
    store_name: string | null;
    subdomain: string | null;
}

export interface SellerFollowRoutesDeps {
    /// Idempotent by (buyer, site): following twice is one row, not two and not an error. Returns
    /// `created: false` when the follow already existed so the caller can tell "now following" from
    /// "already following" without a second round trip.
    follow: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ created: boolean; error: unknown }>;
    /// Scoped by BOTH ids. Scoping by site alone would let any buyer unfollow on another's behalf.
    unfollow: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ removed: boolean; error: unknown }>;
    listFollowing: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: FollowedSellerRow[] | null; error: unknown }>;
    isFollowing: (c: AppContext, buyerAccountId: string, siteId: string) => Promise<{ following: boolean; error: unknown }>;
    countFollowers: (c: AppContext, siteId: string) => Promise<{ count: number | null; error: unknown }>;
}

function siteIdParam(c: AppContext): string | null {
    const id = c.req.param('siteId') || '';
    return UUID.test(id) ? id : null;
}

export function registerSellerFollowRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: SellerFollowRoutesDeps,
): void {
    const { follow, unfollow, listFollowing, isFollowing, countFollowers } = deps;

    // POST /storefront/buyer/follows { site_id }
    router.post('/buyer/follows', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        let body: { site_id?: unknown };
        try {
            body = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body with site_id is required.' } }, 400);
        }
        const siteId = typeof body.site_id === 'string' ? body.site_id.trim() : '';
        if (!UUID.test(siteId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'site_id must be a UUID.' } }, 400);
        }

        const { created, error } = await follow(c, session.buyerAccountId, siteId);
        if (error) {
            // 229's trigger refuses a follow of a site that is not published and undeleted. That is a
            // 422 about the request, not a 500 about us — and the message must not distinguish "no
            // such site" from "not published", which would make this an existence oracle for
            // unpublished stores.
            if (isNotFollowableError(error)) {
                return c.json({ success: false, error: { code: 'UNPROCESSABLE', message: 'That seller cannot be followed.' } }, 422);
            }
            return c.json(dbFailureBody(), 500);
        }
        return c.json(success({ site_id: siteId, following: true, created }), created ? 201 : 200);
    });

    // DELETE /storefront/buyer/follows/:siteId
    router.delete('/buyer/follows/:siteId', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        const siteId = siteIdParam(c);
        if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'siteId must be a UUID.' } }, 400);

        const { removed, error } = await unfollow(c, session.buyerAccountId, siteId);
        if (error) return c.json(dbFailureBody(), 500);
        // Unfollowing something you do not follow is the state you asked for, so it is a 200 and not a
        // 404. `removed` still reports what actually happened rather than flattening the two.
        return c.json(success({ site_id: siteId, following: false, removed }));
    });

    // GET /storefront/buyer/follows — who this buyer follows.
    router.get('/buyer/follows', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

        const { data, error } = await listFollowing(c, session.buyerAccountId, limit);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });

    // GET /storefront/buyer/follows/:siteId — whether this buyer follows one seller.
    router.get('/buyer/follows/:siteId', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        const siteId = siteIdParam(c);
        if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'siteId must be a UUID.' } }, 400);

        const { following, error } = await isFollowing(c, session.buyerAccountId, siteId);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ site_id: siteId, following }));
    });

    // GET /storefront/marketplace/sellers/:siteId/follower-count — public, unauthenticated.
    // A follower count is public information on a public seller profile; the follower IDENTITIES are
    // not exposed by any route here.
    router.get('/marketplace/sellers/:siteId/follower-count', async (c) => {
        const siteId = siteIdParam(c);
        if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'siteId must be a UUID.' } }, 400);

        const { count, error } = await countFollowers(c, siteId);
        // A count failure is a 500, never a 0. Zero is a real answer — a seller genuinely has no
        // followers — and serving it for an outage would make the profile quietly wrong instead of
        // visibly broken.
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ site_id: siteId, follower_count: count ?? 0 }));
    });
}

// 229 raises with SQLSTATE 23514 (check_violation). Matched on the code, with the message text only
// as a fallback: a message match alone would break the moment the wording changes, and a code match
// alone would miss a driver that surfaces it as a bare Error.
export function isNotFollowableError(error: unknown): boolean {
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (code === '23514') return true;
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
    return /is not followable/i.test(message);
}
