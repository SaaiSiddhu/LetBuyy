// Phase 2 / F2.7 (Section 11) — buyer-facing data-rights request intake.
//
// WIRES the buyer realm onto the support system this repository already has (the same pattern
// buyer-support-routes.ts established for support conversations), rather than introducing a
// parallel privacy platform: a privacy request is a support_tickets row with topic = 'privacy',
// scoped by requester_user_id exactly like every other buyer ticket.
//
// This is REQUEST INTAKE ONLY. It never exports data and never executes an erasure. Status is
// reported honestly: closing a support ticket is a workflow action an agent can take for many
// reasons (fulfilled, rejected, duplicate, withdrawn) and support_tickets has no status value that
// distinguishes them (its CHECK constraint: open/pending_customer/pending_internal/escalated/
// resolved/closed — nothing that means "fulfilled"). So a resolved/closed ticket is reported as
// 'closed_no_fulfillment' unless metadata explicitly carries a recorded fulfillment outcome
// (metadata.fulfillment_outcome — nothing writes this today; D05, data purpose/retention/deletion
// exceptions, remains OPEN_FOUNDER_DECISION, and no export/erasure execution exists to set it).
// An unrecognized ticket status is reported as 'unknown', never defaulted toward anything that
// reads as success.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

export type PrivacyRequestType = 'access' | 'erasure';
const PRIVACY_REQUEST_TYPES: readonly PrivacyRequestType[] = ['access', 'erasure'];
const MAX_NOTES = 1000;

export type PrivacyRequestStatus = 'received' | 'in_review' | 'closed_no_fulfillment' | 'fulfilled' | 'unknown';

export interface PrivacyRequestRow {
    id: string;
    ticket_ref: string | null;
    status: string;
    metadata: { privacy_request_type?: string; fulfillment_outcome?: string } | null;
    created_at: string;
    updated_at: string;
}

export interface BuyerPrivacyRoutesDeps {
    /// The buyer's own OPEN request of this exact type, if one already exists -- a fast-path check
    /// that avoids an unnecessary insert attempt in the common case. NOT itself what makes this
    /// idempotent: two concurrent requests can both pass this check before either commits. The
    /// actual atomicity is the partial unique index (migration 262) that createRequest relies on.
    findOpenRequest: (c: AppContext, buyerAccountId: string, type: PrivacyRequestType) => Promise<{ data: PrivacyRequestRow | null; error: unknown }>;
    /// Attempts to insert a new request. If a concurrent request already created one for this exact
    /// (buyer, type) between the caller's own findOpenRequest check and this call, the unique index
    /// makes this insert fail with SQLSTATE 23505; the implementation must catch exactly that code,
    /// re-query for the row the other request created, and return it with created: false. Any other
    /// error is a real failure and must be returned as such, never silently treated as a conflict.
    createRequest: (c: AppContext, buyerAccountId: string, type: PrivacyRequestType, notes: string | null) => Promise<{ data: PrivacyRequestRow | null; error: unknown; created: boolean }>;
    listRequests: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: PrivacyRequestRow[] | null; error: unknown }>;
}

function unauthorized(c: AppContext) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
}

const KNOWN_FULFILLMENT_OUTCOMES = new Set(['fulfilled']);

// support_tickets.status is a workflow vocabulary ('open', 'pending_customer', ...) meant for
// agents. The buyer-facing status readback is a coarser, request-shaped projection -- but never a
// more OPTIMISTIC one: a resolved/closed ticket can only ever read as 'fulfilled' if something
// explicitly recorded that outcome; otherwise it is 'closed_no_fulfillment', not 'completed'.
function buyerFacingStatus(ticketStatus: string, metadata: PrivacyRequestRow['metadata']): PrivacyRequestStatus {
    if (ticketStatus === 'resolved' || ticketStatus === 'closed') {
        const outcome = metadata?.fulfillment_outcome;
        return outcome && KNOWN_FULFILLMENT_OUTCOMES.has(outcome) ? 'fulfilled' : 'closed_no_fulfillment';
    }
    if (ticketStatus === 'open') return 'received';
    if (ticketStatus === 'pending_customer' || ticketStatus === 'pending_internal' || ticketStatus === 'escalated') return 'in_review';
    // An unrecognized status (a future support_tickets status value this route does not yet know
    // about) must never be presented as anything resembling success.
    return 'unknown';
}

function serialize(row: PrivacyRequestRow) {
    return {
        id: row.id,
        reference: row.ticket_ref,
        type: row.metadata?.privacy_request_type ?? null,
        status: buyerFacingStatus(row.status, row.metadata),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// A JSON body can parse successfully as null, an array, or a scalar (all valid JSON) without
// throwing -- only `payload.type` on a null/undefined payload throws. Every one of those shapes is
// invalid input here and must be rejected the same way, before any property is read from it.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    // Idempotent by (buyer, type, still-open), enforced by a database-level partial unique index
    // (migration 262), not merely by this check: a second request of the same type while the first
    // is unresolved returns the existing one (200), never a duplicate (201), even under real
    // concurrency.
    router.post('/buyer/privacy-requests', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);

        let rawPayload: unknown;
        try {
            rawPayload = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }
        if (!isPlainObject(rawPayload)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'The request body must be a JSON object.' } }, 400);
        }
        const payload = rawPayload;

        const type = typeof payload.type === 'string' ? payload.type : '';
        if (!PRIVACY_REQUEST_TYPES.includes(type as PrivacyRequestType)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `type must be one of: ${PRIVACY_REQUEST_TYPES.join(', ')}` } }, 400);
        }
        if (payload.notes !== undefined && typeof payload.notes !== 'string') {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'notes must be a string.' } }, 400);
        }
        const rawNotes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
        if (rawNotes.length > MAX_NOTES) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `notes must be at most ${MAX_NOTES} characters.` } }, 400);
        }

        // Fast path only -- does not by itself make this idempotent under concurrency (see
        // createRequest's own contract, which is where the real guarantee lives).
        const existing = await findOpenRequest(c, session.buyerAccountId, type as PrivacyRequestType);
        if (existing.error) return c.json(dbFailureBody(), 500);
        if (existing.data) return c.json(success(serialize(existing.data)), 200);

        const { data, error, created } = await createRequest(c, session.buyerAccountId, type as PrivacyRequestType, rawNotes || null);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(serialize(data)), created ? 201 : 200);
    });
}
