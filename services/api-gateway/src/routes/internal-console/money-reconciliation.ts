import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema } from '../../lib/supabase';
import { checkSegregationOfDuty, validateSensitiveReason } from '../../middleware/rbac';

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
const MoneyReconciliationResolveSchema = z.object({
    actor_id: z.string().uuid(),
    actor_email: z.string().email().nullable().optional(),
    secondary_approver_id: z.string().uuid(),
    reason: z.string().trim().min(8).max(1000),
    resolution: z.enum(['acknowledge_suspense', 'provider_explained', 'request_recheck']),
    provider_reference: z.string().trim().max(160).nullable().optional(),
    suspense_ledger_transaction_id: z.string().uuid().nullable().optional(),
});

type MoneyReconciliationQuery = z.infer<typeof MoneyReconciliationQuerySchema>;
type MoneyReconciliationResolveInput = z.infer<typeof MoneyReconciliationResolveSchema>;

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

function asRecord(value: unknown): DbRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRecord : {};
}

function numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
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

function resolutionAuditAction(resolution: MoneyReconciliationResolveInput['resolution']): string {
    if (resolution === 'request_recheck') return 'money_ledger.reconciliation.recheck_requested';
    return 'money_ledger.breaks.resolve';
}

function resolutionRecord(input: MoneyReconciliationResolveInput, row: DbRecord, reason: string, now: string): DbRecord {
    return {
        resolution: input.resolution,
        reason,
        actor_id: input.actor_id,
        actor_email: input.actor_email || null,
        secondary_approver_id: input.secondary_approver_id,
        provider_reference: input.provider_reference || null,
        suspense_ledger_transaction_id: input.suspense_ledger_transaction_id || null,
        variance_minor: numberValue(row.variance_minor),
        resolved_at: now,
        source: 'admin-web',
    };
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
            source: 'admin-web',
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

router.post('/reconciliation/:siteId/resolve', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = MoneyReconciliationResolveSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid money ledger reconciliation resolution payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({
            error: {
                code: 'REASON_REQUIRED',
                message: 'A reason of at least 8 characters is required for money ledger break resolution.',
            },
        }, 400);
    }

    const sod = checkSegregationOfDuty({
        actorId: parsed.data.actor_id,
        secondaryApproverId: parsed.data.secondary_approver_id,
        targetAction: 'money.reconciliation.resolve',
    });
    if (!sod.ok) {
        return c.json({ error: { code: sod.code || 'SEGREGATION_OF_DUTY_FAILED', message: sod.message || 'Segregation of duty failed.' } }, 403);
    }

    const siteIdResult = z.string().uuid().safeParse(c.req.param('siteId'));
    if (!siteIdResult.success) {
        return c.json({ error: { code: 'INVALID_SITE_ID', message: 'Money reconciliation site id must be a UUID.' } }, 400);
    }
    const siteId = siteIdResult.data;
    const db = getSupabaseAdmin(c);
    const { data: existing, error: lookupError } = await db
        .from('money_ledger_site_reconciliations')
        .select('site_id, status, wallet_available_minor, ledger_merchant_payable_minor, variance_minor, metadata, verified_at, updated_at')
        .eq('site_id', siteId)
        .maybeSingle();

    if (lookupError) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, lookupError)) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Money ledger reconciliation row not found.' } }, 404);
        }
        return c.json(dbError(lookupError.message), 500);
    }
    if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Money ledger reconciliation row not found.' } }, 404);

    const existingRow = existing as DbRecord;
    if (String(existingRow.status) === 'verified' || numberValue(existingRow.variance_minor) === 0) {
        return c.json({
            error: {
                code: 'MONEY_RECONCILIATION_ALREADY_VERIFIED',
                message: 'Verified reconciliation rows do not require operator break resolution.',
            },
        }, 409);
    }

    const now = new Date().toISOString();
    const resolution = resolutionRecord(parsed.data, existingRow, reason, now);
    let updated: unknown = null;

    if (parsed.data.resolution === 'request_recheck') {
        const { data, error } = await db.rpc('refresh_money_ledger_site_reconciliation', { p_site_id: siteId });
        if (error) return c.json(dbError(error.message), 500);
        updated = data;
    } else {
        const { data, error } = await db
            .from('money_ledger_site_reconciliations')
            .update({
                metadata: {
                    ...asRecord(existingRow.metadata),
                    operator_resolution: resolution,
                },
                updated_by: parsed.data.actor_id,
                updated_at: now,
            })
            .eq('site_id', siteId)
            .eq('status', 'mismatch')
            .select('site_id, status, wallet_available_minor, ledger_merchant_payable_minor, variance_minor, metadata, verified_at, updated_at')
            .single();
        if (error || !data) return c.json(dbError(error?.message || 'Money ledger reconciliation resolution update failed'), 500);
        updated = data;
    }

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id,
        actorEmail: parsed.data.actor_email || null,
        action: resolutionAuditAction(parsed.data.resolution),
        resourceType: 'money_ledger_site_reconciliation',
        resourceId: siteId,
        reason,
        metadata: {
            resolution,
            status_before: existingRow.status || null,
            variance_before_minor: numberValue(existingRow.variance_minor),
        },
    });

    return c.json({
        success: true,
        data: {
            reconciliation: updated,
            resolution,
        },
    });
});

export default router;
