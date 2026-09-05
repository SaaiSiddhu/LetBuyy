// CAP-FB-RETURNS (D-9) — a marketplace buyer opening a return request on their own order.
//
// SMALLER THAN THE REGISTER IMPLIED, and the correction is worth stating: FB-2 recorded returns as
// having "no canonical owner", but that register was built from Firestore collection names without
// checking the canonical schema. `returns`, `return_requests` and `return_lines` already exist in the
// baseline, and routes/returns.ts already manages them — with verifySiteOwnership on every route, so
// it is the MERCHANT side. What was actually missing is the buyer being able to ask at all. No table
// is added here.
//
// ============================================================================
// THE AUTHORIZATION CHAIN — the whole point of this file
// ============================================================================
// `orders` has no customer FK, only customer_email. So a buyer's ownership of an order is:
//
//   verified buyer session -> buyer_account_id
//     -> buyer_store_customers  (the platform-owned link; BUYER-5)
//     -> store_customers.email  (that buyer's identity AT that seller)
//     -> orders (site_id, customer_email)
//
// Every link is required. Drop any one and a buyer can open a return against a stranger's order, and
// the request would look completely ordinary in the merchant's queue — same shape, same fields, just
// filed by someone with no connection to the purchase.
//
// ============================================================================
// MASS ASSIGNMENT
// ============================================================================
// return_requests carries status, refund_amount, approved_at, refunded_at, processed_by and
// admin_notes. Every one is MERCHANT-owned. A buyer body that reached them would let a shopper file a
// return already marked 'refunded' for an amount of their choosing. This route reads exactly two
// fields from the request and writes the rest itself.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

/// The baseline's own vocabulary (return_requests_reason_check), repeated so a bad reason is refused
/// before the round trip. The CHECK remains the authority.
const RETURN_REASONS = ['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'too_late', 'other'] as const;
const MAX_DESCRIPTION = 2000;

export interface BuyerReturnRequestRow {
    id: string;
    order_id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: string;
}

export const BUYER_RETURN_COLUMNS = 'id, order_id, reason, description, status, created_at';

export interface BuyerReturnRoutesDeps {
    /// Calls request_order_return (migration 225). The ownership walk, the duplicate check and the
    /// insert all happen inside one SECURITY DEFINER transaction, so this route never touches
    /// return_requests directly and the check-then-insert cannot race.
    ///
    /// Returns null when the order is not this buyer's OR does not exist — the RPC does not
    /// distinguish them, deliberately.
    requestOrderReturn: (c: AppContext, input: { buyerAccountId: string; orderId: string; reason: string; description: string | null }) => Promise<{ data: BuyerReturnRequestRow | null; error: unknown; alreadyOpen?: boolean }>;
    listBuyerReturnRequests: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: BuyerReturnRequestRow[] | null; error: unknown }>;
}

export function registerBuyerReturnRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerReturnRoutesDeps,
): void {
    const { requestOrderReturn, listBuyerReturnRequests } = deps;

    router.post('/buyer/orders/:orderId/return-request', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const orderId = c.req.param('orderId');
        const body = await c.req.json().catch(() => null) as { reason?: string; description?: string } | null;

        if (!orderId || !body?.reason) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'An order id and a reason are required' } }, 400);
        }
        if (!RETURN_REASONS.includes(body.reason as typeof RETURN_REASONS[number])) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `reason must be one of: ${RETURN_REASONS.join(', ')}` } }, 400);
        }
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_DESCRIPTION) : null;

        // Ownership, the duplicate check and the insert are ONE transaction inside
        // request_order_return. Doing them as separate queries here is what the first cut did, and it
        // both tripped tenant-isolation-validator correctly and carried a real race: two concurrent
        // taps could each see no open return and each create one.
        const { data: created, error, alreadyOpen } = await requestOrderReturn(c, {
            buyerAccountId: session.buyerAccountId,
            orderId,
            reason: body.reason,
            description,
        });

        if (alreadyOpen) {
            return c.json({ success: false, error: { code: 'RETURN_ALREADY_OPEN', message: 'A return request is already open for this order.' } }, 409);
        }
        if (error) return c.json(dbFailureBody(), 500);
        if (!created) {
            // ONE answer for "no such order" and "not yours". Distinguishing them turns this into an
            // oracle for whether a given order id exists.
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
        }

        return c.json(success({ return_request: created }), 201);
    });

    router.get('/buyer/return-requests', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 50) : 20;

        const { data, error } = await listBuyerReturnRequests(c, session.buyerAccountId, limit);
        if (error) return c.json(dbFailureBody(), 500);

        return c.json(success({ return_requests: data ?? [] }));
    });
}

export const BUYER_RETURN_REASONS = RETURN_REASONS;
