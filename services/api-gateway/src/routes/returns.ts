import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, paginated, success } from '../lib/supabase';
import { resolveTenantContextForOrder } from '../lib/tenant-context';
import { OrderExecutionAdapter } from '../execution/order-execution.adapter';
import { validate } from '../middleware/validation';
import {
    CompleteReturnRefundSchema,
    CreateReturnSchema,
    ListReturnsQuery,
    UpdateReturnStatusSchema,
    type CompleteReturnRefundInput,
    type CreateReturnInput,
    type ListReturnsInput,
    type UpdateReturnStatusInput,
} from '../schemas/return.schema';

const router = new Hono<{ Bindings: Env }>();

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

type ReturnRow = {
    id: string;
    site_id: string;
    order_id: string;
    status: string;
    customer_email?: string | null;
    reason?: string | null;
    refund_method?: string | null;
    authorized_at?: string | null;
    received_at?: string | null;
    inspected_at?: string | null;
    refunded_at?: string | null;
    closed_at?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    orders?: {
        order_number?: string | null;
        customer_name?: string | null;
        total?: number | string | null;
        currency?: string | null;
    } | null;
    return_lines?: Array<Record<string, unknown>> | null;
    refunds?: Array<Record<string, unknown>> | null;
};

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingDeletedAtError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('deleted_at') && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function normalizeReturn(row: ReturnRow) {
    const order = recordValue(row.orders);
    const refunds = Array.isArray(row.refunds) ? row.refunds : [];
    const primaryRefund = recordValue(refunds[0]);
    return {
        id: row.id,
        site_id: row.site_id,
        store_id: row.site_id,
        order_id: row.order_id,
        order_number: order.order_number || null,
        customer_name: order.customer_name || null,
        customer_email: row.customer_email || null,
        status: row.status,
        reason: row.reason || null,
        refund_method: row.refund_method || 'original_payment',
        refund_id: primaryRefund.id || null,
        refund_status: primaryRefund.status || null,
        refund_amount: primaryRefund.amount || null,
        currency: primaryRefund.currency || order.currency || 'INR',
        authorized_at: row.authorized_at || null,
        received_at: row.received_at || null,
        inspected_at: row.inspected_at || null,
        refunded_at: row.refunded_at || null,
        closed_at: row.closed_at || null,
        metadata: row.metadata || {},
        lines: Array.isArray(row.return_lines) ? row.return_lines : [],
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    };
}

async function loadOwnedReturn(
    db: ReturnType<typeof getSupabaseAdmin>,
    unguardedDb: ReturnType<typeof getSupabaseAdminUnguarded>,
    returnId: string,
    customUserId: string,
    sessionStoreId?: string,
) {
    const selectReturn = (includeDeletedAtFilter: boolean) => {
        let request = unguardedDb
            .from('returns')
            .select('*, orders(order_number, customer_name, total, currency), return_lines(*), refunds(id, amount, currency, status, provider_refund_id)')
            .eq('id', returnId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.maybeSingle();
    };

    let { data, error } = await selectReturn(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await selectReturn(false));
    }
    if (error) throw new Error('Return lookup failed');
    const row = data as ReturnRow | null;
    if (!row?.site_id || !(await verifySiteOwnership(db, row.site_id, customUserId, sessionStoreId))) {
        return null;
    }
    return row;
}

router.get('/', validate('query', ListReturnsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListReturnsInput;
    const offset = (query.page - 1) * query.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const selectReturns = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('returns')
            .select('*, orders(order_number, customer_name, total, currency), return_lines(*), refunds(id, amount, currency, status, provider_refund_id)', { count: 'exact' })
            .eq('site_id', query.store_id);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        if (query.status !== 'all') request = request.eq('status', query.status);
        if (query.order_id) request = request.eq('order_id', query.order_id);
        return request
            .order('created_at', { ascending: false })
            .range(offset, offset + query.limit - 1);
    };

    let { data, error, count } = await selectReturns(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await selectReturns(false));
    }
    if (error) {
        return c.json({ success: false, error: { code: 'RETURNS_UNAVAILABLE', message: 'Returns are temporarily unavailable.' } }, 503);
    }

    return c.json(paginated(((data || []) as ReturnRow[]).map(normalizeReturn), count || 0, query.page, query.limit));
});

router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const returnId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const row = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, auth.user.storeId);
    if (!row) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } }, 404);
    }
    return c.json(success(normalizeReturn(row)));
});

router.post('/', validate('json', CreateReturnSchema), async (c) => {
    const body = c.get('validatedBody') as CreateReturnInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, body.order_id);
    const service = new OrderExecutionAdapter(db);

    const result = await service.createRefund(body.order_id, tenant, {
        idempotency_key: body.idempotency_key,
        lines: body.lines,
        reason: body.reason,
        refund_method: body.refund_method,
        restock: body.restock,
    });

    const resultRecord = recordValue(result);
    const returnId = typeof resultRecord.return_id === 'string' ? resultRecord.return_id : null;
    if (!returnId) {
        return c.json({ success: false, error: { code: 'RETURN_CREATE_FAILED', message: 'Unable to create return.' } }, 503);
    }

    const customUser = await resolveCustomUser(db, c.get('auth').user);
    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const row = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, c.get('auth').user.storeId);
    return c.json(success(row ? normalizeReturn(row) : { id: returnId, order_id: body.order_id }), 201);
});

router.patch('/:id', validate('json', UpdateReturnStatusSchema), async (c) => {
    const auth = c.get('auth');
    const returnId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateReturnStatusInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const existing = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, auth.user.storeId);
    if (!existing) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } }, 404);
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
        status: body.status,
        updated_by: customUser.id,
    };
    if (body.status === 'authorized' || body.status === 'approved') updates.authorized_at = now;
    if (body.status === 'received') updates.received_at = now;
    if (body.status === 'inspected') updates.inspected_at = now;
    if (body.status === 'refunded') updates.refunded_at = now;
    if (body.status === 'closed' || body.status === 'cancelled' || body.status === 'rejected') updates.closed_at = now;
    if (body.notes) {
        updates.metadata = {
            ...recordValue(existing.metadata),
            merchant_notes: body.notes,
        };
    }

    const { error } = await db
        .from('returns')
        .update(updates)
        .eq('id', returnId)
        .eq('site_id', existing.site_id);
    if (error) {
        return c.json({ success: false, error: { code: 'RETURN_UPDATE_FAILED', message: 'Unable to update return.' } }, 503);
    }

    const row = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, auth.user.storeId);
    return c.json(success(row ? normalizeReturn(row) : { id: returnId, status: body.status }));
});

router.post('/:id/refund/complete', validate('json', CompleteReturnRefundSchema), async (c) => {
    const auth = c.get('auth');
    const returnId = c.req.param('id');
    const body = c.get('validatedBody') as CompleteReturnRefundInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const existing = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, auth.user.storeId);
    if (!existing) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } }, 404);
    }

    const refundId = body.refund_id || (recordValue((existing.refunds || [])[0]).id as string | undefined);
    if (!refundId) {
        return c.json({ success: false, error: { code: 'REFUND_NOT_FOUND', message: 'Refund not found for this return.' } }, 404);
    }

    const { error } = await db.rpc('complete_order_refund', {
        p_refund_id: refundId,
        p_provider_refund_id: body.provider_refund_id || null,
        p_provider_event_id: body.provider_event_id || null,
        p_actor_id: customUser.id,
        p_request_id: c.req.header('X-Request-ID') || crypto.randomUUID(),
        p_idempotency_key: body.idempotency_key,
    });
    if (error) {
        return c.json({ success: false, error: { code: 'REFUND_COMPLETE_FAILED', message: 'Unable to complete refund.' } }, 503);
    }

    const row = await loadOwnedReturn(db, getSupabaseAdminUnguarded(c), returnId, customUser.id, auth.user.storeId);
    return c.json(success(row ? normalizeReturn(row) : { id: returnId, status: 'refunded' }));
});

export default router;
