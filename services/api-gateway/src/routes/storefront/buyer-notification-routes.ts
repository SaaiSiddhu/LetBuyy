// CAP-FB-NOTIF (D-9) — the marketplace buyer's notification inbox.
//
// Separate from the merchant inbox at every layer, not just the table: separate routes, separate
// session, separate vocabulary. public.notifications is keyed by a users_custom id and its type CHECK
// is merchant events; nothing here touches it.
//
// EVERY route is scoped to the buyer id from a VERIFIED session and never to a request parameter. An
// inbox that takes its owner from the query string is an inbox anyone can read, and the mistake is
// invisible — the response looks entirely normal, just addressed to the wrong person.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export interface BuyerNotificationRow {
    id: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    action_url: string | null;
    read_at: string | null;
    created_at: string;
}

export const BUYER_NOTIFICATION_COLUMNS = 'id, type, title, body, data, action_url, read_at, created_at';

export interface BuyerNotificationRoutesDeps {
    listNotifications: (c: AppContext, buyerAccountId: string, limit: number) => Promise<{ data: BuyerNotificationRow[] | null; error: unknown }>;
    countUnread: (c: AppContext, buyerAccountId: string) => Promise<{ count: number | null; error: unknown }>;
    /// Scoped by BOTH the notification id and the buyer id. Scoping by id alone would let any
    /// authenticated buyer mark any other buyer's notification read — a small harm, but the same
    /// missing predicate that would be a disaster on a read.
    markRead: (c: AppContext, buyerAccountId: string, notificationId: string) => Promise<{ data: BuyerNotificationRow | null; error: unknown }>;
    markAllRead: (c: AppContext, buyerAccountId: string) => Promise<{ error: unknown }>;
}

export function registerBuyerNotificationRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerNotificationRoutesDeps,
): void {
    const { listNotifications, countUnread, markRead, markAllRead } = deps;

    router.get('/buyer/notifications', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0
            ? Math.min(requested, MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;

        const { data, error } = await listNotifications(c, session.buyerAccountId, limit);
        if (error) return c.json(dbFailureBody(), 500);

        return c.json(success({ notifications: data ?? [] }));
    });

    router.get('/buyer/notifications/unread-count', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const { count, error } = await countUnread(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);

        return c.json(success({ unread: count ?? 0 }));
    });

    router.post('/buyer/notifications/:id/read', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const notificationId = c.req.param('id');
        if (!notificationId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'A notification id is required' } }, 400);
        }

        const { data, error } = await markRead(c, session.buyerAccountId, notificationId);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) {
            // Either it does not exist or it belongs to someone else. ONE answer for both: telling
            // them apart confirms that a given notification id exists, which is an enumeration oracle
            // over other buyers' inboxes.
            return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
        }

        return c.json(success({ notification: data }));
    });

    router.post('/buyer/notifications/read-all', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);

        const { error } = await markAllRead(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);

        return c.json(success({ read_all: true }));
    });
}
