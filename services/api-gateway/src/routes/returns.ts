import { verifyMerchantStepUp } from '../lib/merchant-step-up';
import {tryRestoreGiftCardForReversedOrder} from '../lib/gift-card-refund-recovery';
import {stepUpErrorBody} from '../lib/security-controls';
import {tryRestoreRedeemedLoyalty} from '../lib/loyalty-refund-recovery';
import {resolveTenantContextForOwnedSite} from '../lib/tenant-context';
import { Hono, type Context } from 'hono';
import {resolveReturnScope} from '../lib/return-scope';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
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
    c: Context<{ Bindings: Env }>, returnId: string, customUserId: string,
) {
    const scope=await resolveReturnScope(c,returnId,customUserId);
    if(!scope)return null;
    const {data,error}=await getSupabaseAdmin(c).from('returns')
        .select('*, orders(order_number, customer_name, total, currency), return_lines(*), refunds(id, amount, currency, status, provider_refund_id)')
        .eq('id',returnId).eq('site_id',scope.siteId).eq('order_id',scope.orderId)
        .eq('refunds.site_id',scope.siteId).eq('refunds.order_id',scope.orderId).is('refunds.deleted_at',null)
        .eq('return_lines.site_id',scope.siteId).eq('return_lines.order_id',scope.orderId).is('return_lines.deleted_at',null)
        .is('deleted_at',null).maybeSingle();
    if(error)throw new Error('Return lookup failed');
    return data as ReturnRow|null;
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

    const selectReturns = () => {
        let request = db
            .from('returns')
            .select('*, orders(order_number, customer_name, total, currency), return_lines(*), refunds(id, amount, currency, status, provider_refund_id)', { count: 'exact' })
            .eq('site_id', query.store_id).is('deleted_at',null)
            .eq('orders.store_id',query.store_id).eq('refunds.site_id',query.store_id).eq('return_lines.site_id',query.store_id);

        if (query.status !== 'all') request = request.eq('status', query.status);
        if (query.order_id) request = request.eq('order_id', query.order_id);
        return request
            .order('created_at', { ascending: false })
            .range(offset, offset + query.limit - 1);
    };

    const { data, error, count } = await selectReturns();
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

    const row = await loadOwnedReturn(c, returnId, customUser.id);
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
    const row = await loadOwnedReturn(c, returnId, customUser.id);
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

    const existing = await loadOwnedReturn(c, returnId, customUser.id);
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

    const row = await loadOwnedReturn(c, returnId, customUser.id);
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

    const existing = await loadOwnedReturn(c, returnId, customUser.id);
    if (!existing) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } }, 404);
    }

    const tenant=await resolveTenantContextForOwnedSite(c,existing.site_id);
    const approval=await verifyMerchantStepUp(db, {action:'refund.approve',actorId:tenant.userId,siteId:tenant.siteId,
        token:c.req.header('X-Step-Up-Token'),verifiedAt:c.req.header('X-Step-Up-Verified-At'),signingSecret:c.env.STEP_UP_SIGNING_SECRET});
    if(!approval.ok)return c.json(stepUpErrorBody(approval),428);
    const service=new OrderExecutionAdapter(db);
    const completed=await service.completeReturnRefund(existing.order_id,returnId,tenant,body,approval.metadata);
    await tryRestoreGiftCardForReversedOrder(db,{...tenant,orderId:existing.order_id},recordValue(completed).order);
    await tryRestoreRedeemedLoyalty(db,{...tenant,orderId:existing.order_id});
    const row=await loadOwnedReturn(c,returnId,customUser.id);
    if(!row)return c.json({success:false,error:{code:'RETURN_READBACK_UNAVAILABLE',message:'Refund completed; retry to reload this return.'}},503);
    const refund=recordValue(recordValue(completed).refund);
    // Completion responds with the selected source, not the arbitrary first
    // embedded refund when a return has more than one partial refund intent.
    return c.json(success({...normalizeReturn(row),refund_id:refund.id,refund_status:refund.status,
        refund_amount:refund.amount,currency:refund.currency||'INR'}));
});

export default router;
