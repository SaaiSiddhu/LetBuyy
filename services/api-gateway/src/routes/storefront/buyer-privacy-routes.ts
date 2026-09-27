// Phase 2 / F2.7 (Section 11) — buyer-facing data-rights request intake.
//
// WIRES the buyer realm onto the support system this repository already has (the same pattern
// buyer-support-routes.ts established for support conversations), rather than introducing a
// parallel privacy platform: a privacy request is a support_tickets row with topic = 'privacy',
// scoped by requester_user_id exactly like every other buyer ticket.
//
// This is REQUEST INTAKE ONLY. It never exports data, never deletes an account, and never claims
// a request is "completed" -- status starts at 'received' (support_tickets' own default is
// 'open'; the create path maps 'open' -> 'received' in the response so a buyer never sees an
// internal ticket-workflow word for what is, for them, an unresolved rights request) and only
// ever reads back whatever the real ticket status is. D05 (data purpose, retention, deletion
// exceptions) remains OPEN_FOUNDER_DECISION -- this never gets closer to executing an erasure or an
// export than recording that one was asked for.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

export type PrivacyRequestType = 'access' | 'erasure';
const PRIVACY_REQUEST_TYPES: readonly PrivacyRequestType[] = ['access', 'erasure'];
const MAX_NOTES = 1000;

export interface PrivacyRequestRow {
    id: string;
    ticket_ref: string | null;
    status: string;
    metadata: { privacy_request_type?: string } | null;
    created_at: string;
    updated_at: string;
}

export interface BuyerPrivacyRoutesDeps {
    /// The buyer's own OPEN request of this exact type, if one already exists -- the idempotency
    /// check. Scoped by requester_user_id AND topic='privacy' AND the metadata request type.
    findOpenRequest: (c: AppContext, buyerAccountId: string, type: PrivacyRequestType) => Promise<{ data: PrivacyRequestRow | null; error: unknown }>;
    createRequest: (c: AppContext, buyerAccountId: string, type: PrivacyRequestType, notes: string | null) => Promise<{ data: PrivacyRequestRow | null; error: unknown }>;
    listRequests: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: PrivacyRequestRow[] | null; error: unknown }>;
}

function unauthorized(c: AppContext) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
}

// support_tickets.status is a workflow vocabulary ('open', 'pending_customer', ...) meant for
// agents. The buyer-facing status readback is a coarser, request-shaped projection so this route
// never has to teach a buyer what 'pending_internal' means, and never has to invent its own second
// status column to avoid doing so.
function buyerFacingStatus(ticketStatus: string): 'received' | 'in_progress' | 'completed' {
    if (ticketStatus === 'resolved' || ticketStatus === 'closed') return 'completed';
    if (ticketStatus === 'open') return 'received';
    return 'in_progress';
}

function serialize(row: PrivacyRequestRow) {
    return {
        id: row.id,
        reference: row.ticket_ref,
        type: row.metadata?.privacy_request_type ?? null,
        status: buyerFacingStatus(row.status),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export function registerBuyerPrivacyRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerPrivacyRoutesDeps,
): void {
    const { findOpenRequest, createRequest, listRequests } = deps;

    // GET /storefront/buyer/privacy-requests
    router.get('/buyer/privacy-requests', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const { data, error } = await listRequests(c, session.buyerAccountId, 50);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success((data || []).map(serialize)));
    });

    // POST /storefront/buyer/privacy-requests { type: 'access' | 'erasure', notes? }
    //
    // Idempotent by (buyer, type, still-open): a second request of the same type while the first
    // is unresolved returns the existing one (200), not a duplicate (201). requester_user_id is the
    // verified session's buyerAccountId -- never taken from the request body.
    router.post('/buyer/privacy-requests', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);

        let payload: { type?: unknown; notes?: unknown };
        try {
            payload = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }
        const type = typeof payload.type === 'string' ? payload.type : '';
        if (!PRIVACY_REQUEST_TYPES.includes(type as PrivacyRequestType)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `type must be one of: ${PRIVACY_REQUEST_TYPES.join(', ')}` } }, 400);
        }
        const rawNotes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
        if (rawNotes.length > MAX_NOTES) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `notes must be at most ${MAX_NOTES} characters.` } }, 400);
        }

        const existing = await findOpenRequest(c, session.buyerAccountId, type as PrivacyRequestType);
        if (existing.error) return c.json(dbFailureBody(), 500);
        if (existing.data) return c.json(success(serialize(existing.data)), 200);

        const { data, error } = await createRequest(c, session.buyerAccountId, type as PrivacyRequestType, rawNotes || null);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(serialize(data)), 201);
    });
}
