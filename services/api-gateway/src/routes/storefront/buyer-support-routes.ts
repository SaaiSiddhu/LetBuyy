// CAP-FB-CHAT (D-9) — the marketplace buyer's support conversation.
//
// This WIRES the buyer realm onto the support system this repository already has. support_tickets
// already supports requester_type = 'customer' and channel = 'chat'; ticket_messages already carries
// author_type and visibility. Firestore's `support_conversations` is a duplicate of that, and
// recreating it would be the "two implementations" failure this programme keeps finding.
//
// THE CONTROL THIS FILE EXISTS FOR: a ticket_messages row with visibility = 'internal' is an agent's
// private note — triage, fraud suspicion, escalation reasoning — and must NEVER reach the buyer. The
// buyer projection filters it at the query, not in the mapper, so a future caller cannot reach the
// unfiltered rows by using the dependency differently. A buyer also cannot WRITE one: author_type and
// visibility are set here, never taken from the request.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession } from '../../middleware/buyer-session';
import { requireBuyerDataSession } from '../../middleware/buyer-data-session';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TICKETS = 50;
const MAX_BODY = 4000;

export interface BuyerTicketRow {
    id: string;
    ticket_ref: string | null;
    subject: string | null;
    status: string;
    topic: string | null;
    created_at: string;
    last_agent_message_at: string | null;
}

export interface BuyerTicketMessageRow {
    id: string;
    author_type: string;
    body: string;
    created_at: string;
}

export interface BuyerSupportRoutesDeps {
    listTickets: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: BuyerTicketRow[] | null; error: unknown }>;
    /// Scoped by BOTH the ticket id and the buyer: scoping by ticket alone would let any buyer read
    /// any other buyer's support conversation by guessing a uuid.
    getTicket: (c: AppContext, buyerAccountId: string, ticketId: string) => Promise<{ data: BuyerTicketRow | null; error: unknown }>;
    /// PUBLIC messages only. The internal filter is the dependency's job so it cannot be skipped by a
    /// caller, and a source contract asserts the real query carries it.
    listPublicMessages: (c: AppContext, ticketId: string, limit: number) => Promise<{ data: BuyerTicketMessageRow[] | null; error: unknown }>;
    openTicket: (c: AppContext, buyerAccountId: string, input: { subject: string; body: string; siteId: string | null }) => Promise<{ data: BuyerTicketRow | null; complaintCopy: BuyerTicketMessageRow | null; error: unknown }>;
    addRequesterMessage: (c: AppContext, ticketId: string, body: string) => Promise<{ data: BuyerTicketMessageRow | null; error: unknown }>;
}

function ticketIdParam(c: AppContext): string | null {
    const id = c.req.param('ticketId') || '';
    return UUID.test(id) ? id : null;
}

function unauthorized(c: AppContext) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
}

export function registerBuyerSupportRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerSupportRoutesDeps,
): void {
    const { listTickets, getTicket, listPublicMessages, openTicket, addRequesterMessage } = deps;

    // GET /storefront/buyer/support/tickets
    router.get('/buyer/support/tickets', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_TICKETS) : 20;
        const { data, error } = await listTickets(c, session.buyerAccountId, limit);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });

    // POST /storefront/buyer/support/tickets { subject, body, site_id? }
    router.post('/buyer/support/tickets', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);

        let payload: { subject?: unknown; body?: unknown; site_id?: unknown };
        try {
            payload = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }
        const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
        const body = typeof payload.body === 'string' ? payload.body.trim() : '';
        if (!subject || subject.length > 200) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'subject is required (1-200 characters).' } }, 400);
        }
        if (!body || body.length > MAX_BODY) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `body is required (1-${MAX_BODY} characters).` } }, 400);
        }
        // Optional: the seller this is about. Validated as a uuid, never trusted as authorization.
        const rawSite = typeof payload.site_id === 'string' ? payload.site_id.trim() : '';
        if (rawSite && !UUID.test(rawSite)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'site_id must be a UUID.' } }, 400);
        }

        const { data, complaintCopy, error } = await openTicket(c, session.buyerAccountId, { subject, body, siteId: rawSite || null });
        if (error) return c.json(dbFailureBody(), 500);
        if (!data || !complaintCopy) return c.json(dbFailureBody(), 500);
        // Keep existing ticket fields at the response root for callers, while returning an explicit
        // server-confirmed copy of the complaint content actually recorded as the first public message.
        return c.json(success({
            ...data,
            complaint_copy: {
                subject: data.subject,
                body: complaintCopy.body,
                recorded_at: complaintCopy.created_at,
            },
            receipt_confirmed_at: complaintCopy.created_at,
        }), 201);
    });

    // GET /storefront/buyer/support/tickets/:ticketId/messages — PUBLIC messages only.
    router.get('/buyer/support/tickets/:ticketId/messages', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const ticketId = ticketIdParam(c);
        if (!ticketId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'ticketId must be a UUID.' } }, 400);

        // Ownership is checked BEFORE any message is read. Reading first and filtering after would
        // mean another buyer's conversation had already been loaded into this request.
        const ticket = await getTicket(c, session.buyerAccountId, ticketId);
        if (ticket.error) return c.json(dbFailureBody(), 500);
        if (!ticket.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);

        const { data, error } = await listPublicMessages(c, ticketId, 200);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(data || []));
    });

    // POST /storefront/buyer/support/tickets/:ticketId/messages { body }
    router.post('/buyer/support/tickets/:ticketId/messages', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const ticketId = ticketIdParam(c);
        if (!ticketId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'ticketId must be a UUID.' } }, 400);

        let payload: { body?: unknown };
        try {
            payload = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }
        const body = typeof payload.body === 'string' ? payload.body.trim() : '';
        if (!body || body.length > MAX_BODY) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `body is required (1-${MAX_BODY} characters).` } }, 400);
        }

        const ticket = await getTicket(c, session.buyerAccountId, ticketId);
        if (ticket.error) return c.json(dbFailureBody(), 500);
        if (!ticket.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);

        const { data, error } = await addRequesterMessage(c, ticketId, body);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(data), 201);
    });
}
