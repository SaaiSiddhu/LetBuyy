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
import { dbFailureBody, decodeListCursor, encodeListCursor, success } from '../../lib/supabase';
import { buyerSupportRequestKey, type BuyerSupportMutation } from '../../lib/buyer-support-mutations';
import { getBuyerSession } from '../../middleware/buyer-session';
import { requireBuyerDataSession } from '../../middleware/buyer-data-session';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TICKETS = 50;
const MAX_BODY = 4000;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export interface BuyerSupportCursor { value: string; id: string }

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
    listTickets: (c: AppContext, buyerAccountId: string, limit: number, cursor?: BuyerSupportCursor) => Promise<{ data: BuyerTicketRow[] | null; error: unknown }>;
    /// Scoped by BOTH the ticket id and the buyer: scoping by ticket alone would let any buyer read
    /// any other buyer's support conversation by guessing a uuid.
    getTicket: (c: AppContext, buyerAccountId: string, ticketId: string) => Promise<{ data: BuyerTicketRow | null; error: unknown }>;
    /// PUBLIC messages only. The internal filter is the dependency's job so it cannot be skipped by a
    /// caller, and a source contract asserts the real query carries it.
    listPublicMessages: (c: AppContext, ticketId: string, limit: number, cursor?: BuyerSupportCursor) => Promise<{ data: BuyerTicketMessageRow[] | null; error: unknown }>;
    mutate: (c: AppContext, input: BuyerSupportMutation) => Promise<{ data: unknown; error: unknown }>;
    recover?: (c: AppContext, input: Pick<BuyerSupportMutation, 'operation' | 'targetId' | 'key'>) => Promise<{ data: unknown; error: unknown }>;
}

function cursorFor(c: AppContext): { paged: boolean; cursor?: BuyerSupportCursor; invalid: boolean } {
    const mode = c.req.query('pagination'), raw = c.req.query('cursor');
    const paged = mode === 'cursor';
    if ((mode !== undefined && !paged) || (raw !== undefined && !paged)) return { paged, invalid: true };
    if (raw === undefined) return { paged, invalid: false };
    if (raw.length > 1024) return { paged, invalid: true };
    const value = decodeListCursor(raw);
    if (!raw || !value || !UUID.test(value.id) || typeof value.value !== 'string' || !TIMESTAMP.test(value.value) || !Number.isFinite(Date.parse(value.value))) return { paged, invalid: true };
    return { paged, cursor: { value: value.value, id: value.id }, invalid: false };
}

function page<T extends { id: string; created_at: string }>(rows: T[], limit: number) {
    const items = rows.slice(0, limit), hasMore = rows.length > limit;
    return { items, has_more: hasMore, next_cursor: hasMore ? encodeListCursor(items[items.length - 1] as unknown as Record<string, unknown>, 'created_at') : null };
}

function mutationFailure(c: AppContext, error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'PT401') return unauthorized(c);
    if (['PT404','P0002','23503'].includes(code)) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Support resource not found.' } }, 404);
    if (['PT409','23505'].includes(code)) return c.json({ success: false, error: { code: 'SUPPORT_REQUEST_CONFLICT', message: 'This request key is already bound to another support action. Recover the original request before submitting a different one.' } }, 409);
    if (['22023','22P02'].includes(code)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support request.' } }, 400);
    return c.json(dbFailureBody(), 500);
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
    const { listTickets, getTicket, listPublicMessages, mutate, recover } = deps;

    // GET /storefront/buyer/support/tickets
    router.get('/buyer/support/tickets', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_TICKETS) : 20;
        const pagination = cursorFor(c);
        if (pagination.invalid) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support cursor.' } }, 400);
        const { data, error } = await listTickets(c, session.buyerAccountId, pagination.paged ? limit + 1 : limit, pagination.cursor);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(pagination.paged ? page(data || [], limit) : data || []));
    });

    // POST keeps the opaque action key out of URLs and access logs. No writer
    // fallback: an unavailable receipt is not proof an in-flight write cannot commit.
    router.post('/buyer/support/tickets/recovery', requireBuyerDataSession, async (c) => {
        if (!getBuyerSession(c)) return unauthorized(c);
        const payload = await c.req.json().catch(() => null);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
            || !['create','reply'].includes(payload.operation)
            || (payload.operation === 'create' ? payload.target_id !== null : typeof payload.target_id !== 'string' || !UUID.test(payload.target_id))) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support receipt request.' } }, 400);
        }
        let key: string;
        try {
            if (typeof payload.key !== 'string') throw new Error('missing key');
            key = buyerSupportRequestKey(new Headers({ 'X-Idempotency-Key': payload.key }));
        } catch { return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support receipt key.' } }, 400); }
        if (!recover) return c.json(dbFailureBody(), 500);
        const { data, error } = await recover(c, { operation: payload.operation, targetId: payload.target_id, key });
        if (error) return mutationFailure(c, error);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(data));
    });

    // POST /storefront/buyer/support/tickets { subject, body, site_id? }
    router.post('/buyer/support/tickets', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);

        let payload: { subject?: unknown; body?: unknown; site_id?: unknown; order_id?: unknown };
        try {
            payload = await c.req.json();
        } catch {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON object is required.' } }, 400);
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

        const rawOrder = typeof payload.order_id === 'string' ? payload.order_id.trim() : '';
        if (rawOrder && !UUID.test(rawOrder)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'order_id must be a UUID.' } }, 400);
        let key: string;
        try { key = buyerSupportRequestKey(c.req.raw.headers); } catch { return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support request key.' } }, 400); }
        const { data, error } = await mutate(c, { operation: 'create', targetId: null, key,
            payload: { subject, body, site_id: rawSite || null, order_id: rawOrder || null } });
        if (error) return mutationFailure(c, error);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(data), 201);
    });

    // GET /storefront/buyer/support/tickets/:ticketId/messages — PUBLIC messages only.
    router.get('/buyer/support/tickets/:ticketId/messages', requireBuyerDataSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return unauthorized(c);
        const ticketId = ticketIdParam(c);
        if (!ticketId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'ticketId must be a UUID.' } }, 400);
        const pagination = cursorFor(c);
        if (pagination.invalid) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support cursor.' } }, 400);

        // Ownership is checked BEFORE any message is read. Reading first and filtering after would
        // mean another buyer's conversation had already been loaded into this request.
        const ticket = await getTicket(c, session.buyerAccountId, ticketId);
        if (ticket.error) return c.json(dbFailureBody(), 500);
        if (!ticket.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = pagination.paged && Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 200;
        const { data, error } = await listPublicMessages(c, ticketId, pagination.paged ? limit + 1 : limit, pagination.cursor);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(pagination.paged ? page(data || [], limit) : data || []));
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
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'A JSON object is required.' } }, 400);
        const body = typeof payload.body === 'string' ? payload.body.trim() : '';
        if (!body || body.length > MAX_BODY) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `body is required (1-${MAX_BODY} characters).` } }, 400);
        }

        const ticket = await getTicket(c, session.buyerAccountId, ticketId);
        if (ticket.error) return c.json(dbFailureBody(), 500);
        if (!ticket.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } }, 404);

        let key: string;
        try { key = buyerSupportRequestKey(c.req.raw.headers); } catch { return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid support request key.' } }, 400); }
        const { data, error } = await mutate(c, { operation: 'reply', targetId: ticketId, key, payload: { body } });
        if (error) return mutationFailure(c, error);
        if (!data) return c.json(dbFailureBody(), 500);
        return c.json(success(data), 201);
    });
}
