import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { InternalMoneyResolutionExecuteSchema } from '@letbuyy/shared-types';
import { consoleApprovalRpc, consolePermission, credentialArguments, requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import { AppError } from '../../lib/errors';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, paginated } from '../../lib/supabase';
import { validateSensitiveReason } from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type DbRecord = Record<string, unknown>;

const MoneyReconciliationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['verified', 'mismatch']).optional(),
    site_id: z.string().uuid().optional(),
    actor_id: z.string().uuid().optional(),
    actor_email: z.string().email().optional(),
    reason: z.string().trim().max(1000).optional(),
});
type MoneyReconciliationQuery = z.infer<typeof MoneyReconciliationQuerySchema>;

function cleanOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function rangeFor(query: MoneyReconciliationQuery) {
    const offset = (query.page - 1) * query.limit;
    return { from: offset, to: offset + query.limit - 1 };
}

function parseMoneyReconciliationQuery(c: AppContext): MoneyReconciliationQuery {
    const parsed = MoneyReconciliationQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: cleanOptional(c.req.query('status')),
        site_id: cleanOptional(c.req.query('site_id')),
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
        reason: cleanOptional(c.req.query('reason')),
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid money ledger reconciliation query', parsed.error.flatten());
    }

    return parsed.data;
}

async function writeConsoleAudit(c: AppContext, input: {
    actorId?: string | null;
    actorType: 'employee' | 'super_admin';
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    reason?: string | null;
    metadata?: DbRecord;
}) {
    const db = getSupabaseAdmin(c);
    const { error } = await db.from('audit_logs').insert({
        actor_id: input.actorId || null,
        actor_type: input.actorType,
        actor_email: input.actorEmail || null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason || null,
            source: 'admin-web',
        },
        ip_address: c.req.header('CF-Connecting-IP') || null,
        user_agent: c.req.header('User-Agent') || null,
    });
    if (error) throw new AppError('The required money review audit could not be saved.',503,'AUDIT_UNAVAILABLE');
}

router.get('/reconciliation', consolePermission('payout:view'), async (c) => {
    const { state: operator } = await requireConsolePermission(c, 'payout:view', false);
    const query = parseMoneyReconciliationQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdminForOperatorRead(c);

    if (query.status === 'mismatch') {
        const reason = validateSensitiveReason(query.reason);
        if (!reason) {
            return c.json({
                error: {
                    code: 'REASON_REQUIRED',
                    message: 'A reason of at least 8 characters is required for money ledger break review.',
                },
            }, 400);
        }
    }

    let request = db
        .from('money_ledger_site_reconciliations')
        .select('site_id, status, wallet_available_minor, ledger_merchant_payable_minor, variance_minor, verified_at, updated_at, sites(id, name, store_name, subdomain)', { count: 'exact' })
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(from, to);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error, count } = await request;

    if (error) throw new AppError('Money reconciliation is unavailable. Retry this review.',503,'MONEY_RECONCILIATION_UNAVAILABLE');

    await writeConsoleAudit(c, {
        actorId: operator.actor_id,
        actorType: operator.is_super_admin ? 'super_admin' : 'employee',
        actorEmail: operator.email,
        action: query.status === 'mismatch' ? 'money_ledger.breaks.read' : 'money_ledger.reconciliation.read',
        resourceType: 'money_ledger_site_reconciliation',
        resourceId: query.site_id || null,
        reason: query.reason || null,
        metadata: {
            status: query.status || null,
            page: query.page,
            limit: query.limit,
        },
    });

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});

router.post('/reconciliation/:siteId/resolve', async (c) => {
    const parsed = InternalMoneyResolutionExecuteSchema.safeParse(await c.req.json().catch(() => null));
    const site = z.string().uuid().safeParse(c.req.param('siteId'));
    if (!parsed.success || !site.success) throw new ValidationError('Invalid money reconciliation resolution payload.');
    const { credential, state, witness } = await requireConsolePermission(c, 'money:reconcile');
    if (parsed.data.actor_id && parsed.data.actor_id !== state.actor_id) throw new AppError('The action actor does not match this session.',403,'ACTOR_MISMATCH');
    if (!parsed.data.approval_id) throw new AppError('An independently approved request is required before this action.',428,'INDEPENDENT_APPROVAL_REQUIRED');
    const result = await consoleApprovalRpc(c, 'execute_console_money_resolution_v1', {
        ...credentialArguments(credential), p_permission_hash: witness, p_id: parsed.data.approval_id,
        p_site_id: site.data, p_reason: parsed.data.reason, p_details: { resolution: parsed.data.resolution,
            provider_reference: parsed.data.provider_reference, suspense_ledger_transaction_id: parsed.data.suspense_ledger_transaction_id },
    });
    return c.json({ success: true, data: result.result });
});
export default router;
