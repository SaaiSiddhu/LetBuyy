import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema } from '../../lib/supabase';
import { validateSensitiveReason } from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type DbRecord = Record<string, unknown>;

const MoneyReconciliationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
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

function dbError(message: string) {
    return {
        error: {
            code: 'DB_ERROR',
            message,
        },
    };
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
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    reason?: string | null;
    metadata?: DbRecord;
}) {
    const db = getSupabaseAdmin(c);
    await db.from('audit_logs').insert({
        actor_id: input.actorId || null,
        actor_type: 'super_admin',
        actor_email: input.actorEmail || null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason || null,
            source: 'platform-console',
        },
        ip_address: c.req.header('CF-Connecting-IP') || null,
        user_agent: c.req.header('User-Agent') || null,
    });
}

router.get('/reconciliation', async (c) => {
    const query = parseMoneyReconciliationQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

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
        .order('updated_at', { ascending: false })
        .range(from, to);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    await writeConsoleAudit(c, {
        actorId: query.actor_id || null,
        actorEmail: query.actor_email || null,
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

export default router;
