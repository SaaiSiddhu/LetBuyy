import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
    EXECUTIVE_ANALYTICS_STALE_AFTER_HOURS,
    EXECUTIVE_METRIC_DEFINITIONS,
    isExecutiveAnalyticsStale,
    InternalPermissionScopeSchema,
} from '@letbuyy/shared-types';
import type { Env } from '../index';
import { sha256Hex, timingSafeEqualText } from '../lib/crypto';
import { ValidationError } from '../lib/errors';
import { isInternalApiSecretRequest } from '../lib/internal-secret';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../lib/supabase';
import { checkSegregationOfDuty, validateSensitiveReason } from '../middleware/rbac';
import internalConsoleComplianceRouter from './internal-console/compliance';
import internalConsoleDevelopersRouter from './internal-console/developers';
import internalConsoleMoneyRouter from './internal-console/money-reconciliation';
import {
    dayBounds,
    daysAgo,
    intValue,
    isUuid,
    numberValue,
    periodDateDaysAgo,
    recordValue,
    stringValue,
    type CohortSnapshotRow,
    type DbRecord,
    type FunnelStepRow,
    type MerchantOwnerRow,
    type MerchantSiteRow,
    type MetricRollupRow,
    type MrrRollupRow,
    type RevenueSubscriptionRow,
} from './internal-console/shapes';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
const ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
    actor_type: z.enum(['user', 'employee', 'super_admin', 'system']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const AuditLogWriteSchema = z.object({
    actor_id: z.string().uuid().nullable().optional(),
    actor_type: z.enum(['user', 'employee', 'super_admin', 'system']).default('super_admin'),
    actor_email: z.string().email().nullable().optional(),
    action: z.string().trim().min(1).max(120),
    resource_type: z.string().trim().min(1).max(120),
    resource_id: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ip_address: z.string().trim().max(200).nullable().optional(),
    user_agent: z.string().trim().max(500).nullable().optional(),
});
const EmployeePermissionPatchSchema = z.object({
    scopes: z.array(InternalPermissionScopeSchema).max(100).default([]),
    reason: z.string().trim().min(8).max(1000),
    actor_email: z.string().email().nullable().optional(),
    actor_id: z.string().uuid().nullable().optional(),
});
const MerchantSearchQuerySchema = ListQuerySchema.extend({
    q: z.string().trim().min(1).max(120),
});
const MerchantActorSchema = z.object({
    actor_id: z.string().uuid(),
    actor_email: z.string().email().nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
});
const MerchantImpersonationStartSchema = MerchantActorSchema.extend({
    operator_id: z.string().uuid().optional(),
    operator_email: z.string().email().nullable().optional(),
    ttl_minutes: z.coerce.number().int().min(5).max(60).default(30),
});
const MerchantModerationSchema = MerchantActorSchema.extend({
    action: z.enum(['suspend', 'restore']),
    secondary_approver_id: z.string().uuid(),
});
const ExecutiveAnalyticsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(90).default(13),
    days: z.coerce.number().int().min(1).max(365).default(30),
    actor_id: z.string().uuid().optional(),
    actor_email: z.string().email().optional(),
    reason: z.string().trim().max(1000).optional(),
});
type ListQuery = z.infer<typeof ListQuerySchema>;
function readBearerToken(value: string | undefined): string | null {
    if (!value?.startsWith('Bearer ')) return null;
    return value.slice('Bearer '.length).trim() || null;
}
router.use('*', async (c, next) => {
    const expectedToken = c.env.PLATFORM_CONSOLE_API_TOKEN;
    const token = readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token');

    if (!expectedToken) {
        return c.json({
            error: {
                code: 'CONSOLE_TOKEN_NOT_CONFIGURED',
                message: 'Platform console API token is not configured.',
            },
        }, 503);
    }

    if (!token || !timingSafeEqualText(token, expectedToken)) {
        return c.json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid platform console token.',
            },
        }, 401);
    }

    await next();
});
router.route('/developers', internalConsoleDevelopersRouter);
router.route('/compliance', internalConsoleComplianceRouter);
router.route('/money', internalConsoleMoneyRouter);
function cleanOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
function parseListQuery(c: AppContext): ListQuery {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        q: cleanOptional(c.req.query('q')),
        status: cleanOptional(c.req.query('status')),
        actor_type: cleanOptional(c.req.query('actor_type')),
        date: cleanOptional(c.req.query('date')),
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid platform console list query', parsed.error.flatten());
    }

    return parsed.data;
}
function rangeFor(query: ListQuery) {
    const offset = (query.page - 1) * query.limit;
    return { from: offset, to: offset + query.limit - 1 };
}
function searchExpression(columns: string[], search: string | undefined): string | null {
    if (!search) return null;

    const cleaned = search
        .replace(/[%_,(){}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return null;

    return columns.map((column) => `${column}.ilike.%${cleaned}%`).join(',');
}
function dbError(message: string) {
    return {
        error: {
            code: 'DB_ERROR',
            message,
        },
    };
}
function emptyConsoleSummary() {
    return {
        total_users: 0,
        total_stores: 0,
        active_stores: 0,
        total_subscriptions: 0,
        active_subscriptions: 0,
        total_employees: 0,
        total_audit_logs: 0,
        monthly_revenue_paise: 0,
    };
}
function emptyConsoleAnalytics() {
    return {
        period_days: 30,
        new_signups: 0,
        stores_created: 0,
        subscriptions_created: 0,
        audit_events: 0,
        signup_to_store_conversion_percent: 0,
    };
}
function rollupFreshness(computedAt: string | null | undefined, hasRows: boolean) {
    const stale = isExecutiveAnalyticsStale(computedAt);
    return {
        computed_at: computedAt || null,
        stale,
        stale_after_hours: EXECUTIVE_ANALYTICS_STALE_AFTER_HOURS,
        stale_reason: !hasRows
            ? 'No executive analytics rollups are available yet.'
            : stale
                ? 'Latest executive analytics rollup is stale.'
                : null,
    };
}
function mrrPayload(row: MrrRollupRow) {
    return {
        ...row,
        period_date: row.period_date || null,
        mrr_paise: intValue(row.mrr_paise),
        arr_paise: intValue(row.arr_paise),
        new_mrr_paise: intValue(row.new_mrr_paise),
        expansion_mrr_paise: intValue(row.expansion_mrr_paise),
        contraction_mrr_paise: intValue(row.contraction_mrr_paise),
        churned_mrr_paise: intValue(row.churned_mrr_paise),
        active_subscriptions: intValue(row.active_subscriptions),
        logo_churn_count: intValue(row.logo_churn_count),
        subscription_revenue_paise: intValue(row.subscription_revenue_paise),
        app_revenue_paise: intValue(row.app_revenue_paise),
        theme_revenue_paise: intValue(row.theme_revenue_paise),
        partner_payout_liability_paise: intValue(row.partner_payout_liability_paise),
        definition_version: row.definition_version || EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        computed_at: row.computed_at || row.created_at || new Date(0).toISOString(),
        metadata: recordValue(row.metadata),
    };
}
function metricPayload(row: MetricRollupRow) {
    return {
        ...row,
        metric_key: row.metric_key || 'unknown',
        dimension: recordValue(row.dimension),
        period_date: row.period_date || null,
        value: numberValue(row.value),
        unit: row.unit || 'count',
        definition_version: row.definition_version || EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        computed_at: row.computed_at || row.created_at || new Date(0).toISOString(),
        metadata: recordValue(row.metadata),
    };
}
function cohortPayload(row: CohortSnapshotRow) {
    return {
        ...row,
        cohort_month: row.cohort_month || null,
        period_index: intValue(row.period_index),
        metric_key: row.metric_key || 'active_stores',
        cohort_size: intValue(row.cohort_size),
        retained_count: intValue(row.retained_count),
        conversion_count: intValue(row.conversion_count),
        definition_version: row.definition_version || EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        computed_at: row.computed_at || row.created_at || new Date(0).toISOString(),
        metadata: recordValue(row.metadata),
    };
}
function funnelPayload(row: FunnelStepRow) {
    return {
        ...row,
        period_date: row.period_date || null,
        step_key: row.step_key || 'unknown',
        step_index: intValue(row.step_index),
        count: intValue(row.count),
        conversion_rate_bps: intValue(row.conversion_rate_bps),
        definition_version: row.definition_version || EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        computed_at: row.computed_at || row.created_at || new Date(0).toISOString(),
        metadata: recordValue(row.metadata),
    };
}
function actorFromQuery(c: AppContext) {
    const actorId = c.req.query('actor_id');
    return {
        actor_id: actorId && isUuid(actorId) ? actorId : null,
        actor_email: cleanOptional(c.req.query('actor_email')) || null,
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
function compactRecords<T extends { id?: unknown }>(rows: T[]): T[] {
    const seen = new Set<string>();
    const output: T[] = [];
    for (const row of rows) {
        const id = stringValue(row.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        output.push(row);
    }
    return output;
}
async function readMerchantSite(c: AppContext, merchantId: string): Promise<MerchantSiteRow | null> {
    const db = getSupabaseAdmin(c);
    let query = db
        .from('sites')
        .select('id, user_id, custom_user_id, name, store_name, site_type, subdomain, custom_domain, custom_domain_status, access_mode, status, published, published_at, views_count, product_count, order_count, current_theme_release_id, currency, locale, trial_status, trial_ends_at, created_at, updated_at')
        .is('deleted_at', null);

    query = isUuid(merchantId)
        ? query.eq('id', merchantId)
        : query.eq('subdomain', merchantId);

    const { data, error } = await query.maybeSingle();
    if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) return null;
    if (error) throw new Error(error.message);
    return (data || null) as MerchantSiteRow | null;
}
// The impersonation token's signature was never verified anywhere in this
// codebase (grep the whole repository for "lb_imp" -- the only occurrence is
// the construction site below); the sole authenticity control is token_hash,
// matched against impersonation_sessions.token_hash. A CSPRNG-generated
// opaque credential provides the same (actually stronger -- unguessable
// rather than merely unforgeable-without-the-key) guarantee without signing
// with a shared symmetric secret (SEC-R7). The session's real claims (site,
// operator, expiry) are already persisted on the impersonation_sessions row
// itself, so none of that needs to be embedded in the token.
function randomOpaqueTokenHex(byteCount = 32): string {
    const bytes = new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function generateImpersonationToken(): Promise<{ token: string; token_hash: string }> {
    const token = `lb_imp_${randomOpaqueTokenHex()}`;
    return {
        token,
        token_hash: await sha256Hex(token),
    };
}
router.get('/summary', async (c) => {
    const db = getSupabaseAdmin(c);

    const [users, stores, activeStores, subscriptions, activeSubscriptions, employees, auditLogs, revenueRows] = await Promise.all([
        db.from('users_custom').select('id', { count: 'exact', head: true }),
        db.from('sites').select('id', { count: 'exact', head: true }),
        db.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        db.from('subscriptions').select('id', { count: 'exact', head: true }),
        db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        // The platform's own staff, not every store's (APPID-P5b).
        db.from('employees').select('id', { count: 'exact', head: true }).filter('store_id', 'is', null).is('deleted_at', null),
        db.from('audit_logs').select('id', { count: 'exact', head: true }),
        db.from('subscriptions').select('amount_paid').eq('status', 'active'),
    ]);

    for (const result of [users, stores, activeStores, subscriptions, activeSubscriptions, employees, auditLogs, revenueRows]) {
        if (result.error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, result.error)) {
                return c.json(success(emptyConsoleSummary()));
            }
            return c.json(dbError(result.error.message), 500);
        }
    }

    const revenuePaise = ((revenueRows.data || []) as RevenueSubscriptionRow[]).reduce((total, row) => (
        total + Number(row.amount_paid || 0)
    ), 0);

    return c.json(success({
        total_users: users.count || 0,
        total_stores: stores.count || 0,
        active_stores: activeStores.count || 0,
        total_subscriptions: subscriptions.count || 0,
        active_subscriptions: activeSubscriptions.count || 0,
        total_employees: employees.count || 0,
        total_audit_logs: auditLogs.count || 0,
        monthly_revenue_paise: revenuePaise,
    }));
});
router.get('/analytics', async (c) => {
    const db = getSupabaseAdmin(c);
    const since = daysAgo(30);

    const [users, stores, subscriptions, auditLogs] = await Promise.all([
        db.from('users_custom').select('id', { count: 'exact', head: true }).gte('created_at', since),
        db.from('sites').select('id', { count: 'exact', head: true }).gte('created_at', since),
        db.from('subscriptions').select('id', { count: 'exact', head: true }).gte('created_at', since),
        db.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);

    for (const result of [users, stores, subscriptions, auditLogs]) {
        if (result.error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, result.error)) {
                return c.json(success(emptyConsoleAnalytics()));
            }
            return c.json(dbError(result.error.message), 500);
        }
    }

    const newUsers = users.count || 0;
    const storesCreated = stores.count || 0;

    return c.json(success({
        period_days: 30,
        new_signups: newUsers,
        stores_created: storesCreated,
        subscriptions_created: subscriptions.count || 0,
        audit_events: auditLogs.count || 0,
        signup_to_store_conversion_percent: newUsers > 0 ? Math.round((storesCreated / newUsers) * 1000) / 10 : 0,
    }));
});
router.get('/analytics/mrr', async (c) => {
    const parsed = ExecutiveAnalyticsQuerySchema.safeParse({
        limit: c.req.query('limit'),
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
    });
    if (!parsed.success) throw new ValidationError('Invalid executive MRR analytics query', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('mrr_arr_rollups')
        .select('*')
        .is('deleted_at', null)
        .order('period_date', { ascending: false })
        .limit(parsed.data.limit);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
                definitions: EXECUTIVE_METRIC_DEFINITIONS,
                freshness: rollupFreshness(null, false),
                latest: null,
                trend: [],
            }));
        }
        return c.json(dbError(error.message), 500);
    }

    const rows = ((data || []) as MrrRollupRow[]).map(mrrPayload);
    const latest = rows[0] || null;

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id || null,
        actorEmail: parsed.data.actor_email || null,
        action: 'executive_analytics.mrr.read',
        resourceType: 'executive_analytics',
        metadata: { rows: rows.length, definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION },
    });

    return c.json(success({
        definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        definitions: EXECUTIVE_METRIC_DEFINITIONS,
        freshness: rollupFreshness(latest?.computed_at, rows.length > 0),
        latest,
        trend: [...rows].reverse(),
    }));
});
router.get('/analytics/funnels', async (c) => {
    const parsed = ExecutiveAnalyticsQuerySchema.safeParse({
        days: c.req.query('days'),
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
    });
    if (!parsed.success) throw new ValidationError('Invalid executive funnel analytics query', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const since = periodDateDaysAgo(parsed.data.days);
    const { data, error } = await db
        .from('funnel_steps')
        .select('*')
        .is('deleted_at', null)
        .gte('period_date', since)
        .order('period_date', { ascending: false })
        .order('step_index', { ascending: true })
        .limit(500);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
                freshness: rollupFreshness(null, false),
                latest_period_date: null,
                steps: [],
                history: [],
            }));
        }
        return c.json(dbError(error.message), 500);
    }

    const history = ((data || []) as FunnelStepRow[]).map(funnelPayload);
    const latestPeriodDate = history[0]?.period_date || null;
    const steps = latestPeriodDate
        ? history.filter((row) => row.period_date === latestPeriodDate).sort((left, right) => left.step_index - right.step_index)
        : [];

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id || null,
        actorEmail: parsed.data.actor_email || null,
        action: 'executive_analytics.funnels.read',
        resourceType: 'executive_analytics',
        metadata: { rows: history.length, days: parsed.data.days, definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION },
    });

    return c.json(success({
        definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        freshness: rollupFreshness(steps[0]?.computed_at || history[0]?.computed_at, history.length > 0),
        latest_period_date: latestPeriodDate,
        steps,
        history: [...history].reverse(),
    }));
});
router.get('/analytics/cohorts', async (c) => {
    const parsed = ExecutiveAnalyticsQuerySchema.safeParse({
        limit: c.req.query('limit'),
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
    });
    if (!parsed.success) throw new ValidationError('Invalid executive cohort analytics query', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('cohort_snapshots')
        .select('*')
        .is('deleted_at', null)
        .order('cohort_month', { ascending: false })
        .order('period_index', { ascending: false })
        .limit(parsed.data.limit);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
                freshness: rollupFreshness(null, false),
                snapshots: [],
            }));
        }
        return c.json(dbError(error.message), 500);
    }

    const snapshots = ((data || []) as CohortSnapshotRow[]).map(cohortPayload);

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id || null,
        actorEmail: parsed.data.actor_email || null,
        action: 'executive_analytics.cohorts.read',
        resourceType: 'executive_analytics',
        metadata: { rows: snapshots.length, definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION },
    });

    return c.json(success({
        definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        freshness: rollupFreshness(snapshots[0]?.computed_at, snapshots.length > 0),
        snapshots,
    }));
});
router.get('/analytics/company-health', async (c) => {
    const parsed = ExecutiveAnalyticsQuerySchema.safeParse({
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
    });
    if (!parsed.success) throw new ValidationError('Invalid executive company health query', parsed.error.flatten());

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('metric_rollups')
        .select('*')
        .is('deleted_at', null)
        .in('metric_key', [
            'support.open_tickets',
            'support.sla_breaches',
            'risk.high_scores',
            'trust_safety.open_cases',
            'incidents.open',
            'error_budget.latest',
        ])
        .order('period_date', { ascending: false })
        .limit(100);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
                freshness: rollupFreshness(null, false),
                metrics: [],
            }));
        }
        return c.json(dbError(error.message), 500);
    }

    const rows = ((data || []) as MetricRollupRow[]).map(metricPayload);
    const latestPeriodDate = rows[0]?.period_date || null;
    const metrics = latestPeriodDate ? rows.filter((row) => row.period_date === latestPeriodDate) : [];

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id || null,
        actorEmail: parsed.data.actor_email || null,
        action: 'executive_analytics.company_health.read',
        resourceType: 'executive_analytics',
        metadata: { rows: metrics.length, definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION },
    });

    return c.json(success({
        definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
        freshness: rollupFreshness(metrics[0]?.computed_at || rows[0]?.computed_at, rows.length > 0),
        metrics,
    }));
});
router.get('/analytics/cohorts/:cohortMonth/merchants', async (c) => {
    const hasInternalConsoleGuard = isInternalApiSecretRequest(c.env, c.req)
        || Boolean(readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token'));
    if (!hasInternalConsoleGuard) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid platform console token.' } }, 401);
    }

    const cohortMonth = c.req.param('cohortMonth');
    if (!/^\d{4}-\d{2}$/.test(cohortMonth)) {
        return c.json({ error: { code: 'INVALID_COHORT', message: 'Cohort must be formatted as YYYY-MM.' } }, 400);
    }

    const parsed = ExecutiveAnalyticsQuerySchema.safeParse({
        limit: c.req.query('limit'),
        actor_id: cleanOptional(c.req.query('actor_id')),
        actor_email: cleanOptional(c.req.query('actor_email')),
        reason: cleanOptional(c.req.query('reason')),
    });
    if (!parsed.success) throw new ValidationError('Invalid executive cohort merchant drill query', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({
            error: {
                code: 'REASON_REQUIRED',
                message: 'A reason of at least 8 characters is required for cohort merchant drill-through.',
            },
        }, 400);
    }

    const start = `${cohortMonth}-01T00:00:00.000Z`;
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('sites')
        .select('id, name, store_name, subdomain, custom_domain, status, published, published_at, site_type, order_count, created_at')
        .is('deleted_at', null)
        .gte('created_at', start)
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(parsed.data.limit);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({
                cohort_month: cohortMonth,
                merchants: [],
            }));
        }
        return c.json(dbError(error.message), 500);
    }

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id || null,
        actorEmail: parsed.data.actor_email || null,
        action: 'executive_analytics.cohort_merchants.read',
        resourceType: 'merchant_cohort',
        reason,
        metadata: { cohort_month: cohortMonth, rows: (data || []).length, audit_kind: 'sensitive_read' },
    });

    return c.json(success({
        cohort_month: cohortMonth,
        merchants: data || [],
    }));
});
router.get('/settings', async (c) => {
    return c.json(success({
        environment: c.env.ENVIRONMENT || c.env.APP_ENV || c.env.NODE_ENV || 'unknown',
        runtime_name: c.env.RUNTIME_NAME || 'api-gateway',
        primary_region: c.env.PRIMARY_REGION || 'unset',
        edge_scope: c.env.EDGE_SCOPE || 'global-edge',
        console_api_token_configured: Boolean(c.env.PLATFORM_CONSOLE_API_TOKEN),
        csrf_secret_configured: Boolean(c.env.CSRF_SECRET),
        internal_api_secret_configured: Boolean(c.env.INTERNAL_API_SECRET),
        queues: {
            event_queue: Boolean(c.env.EVENT_QUEUE),
            analytics_queue: Boolean(c.env.ANALYTICS_QUEUE),
            search_queue: Boolean(c.env.SEARCH_QUEUE),
            notification_queue: Boolean(c.env.NOTIFICATION_QUEUE),
            runtime_queue: Boolean(c.env.RUNTIME_QUEUE),
        },
        bindings: {
            r2_bucket: Boolean(c.env.R2_BUCKET),
            runtime_db: Boolean(c.env.RUNTIME_DB),
            cache: Boolean(c.env.CACHE),
            runtime_coordinator: Boolean(c.env.RUNTIME_COORDINATOR),
            webhook_service: Boolean(c.env.WEBHOOK_SERVICE),
            runtime_telemetry: Boolean(c.env.RUNTIME_TELEMETRY),
        },
    }));
});
router.get('/users', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('users_custom')
        .select('id, email, email_verified, full_name, auth_provider, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    const search = searchExpression(['email', 'full_name'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});
router.get('/stores', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('sites')
        .select('id, user_id, name, store_name, site_type, subdomain, custom_domain, status, published_at, views_count, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.status) request = request.eq('status', query.status);

    const search = searchExpression(['name', 'store_name', 'subdomain', 'custom_domain'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});
router.get('/merchants/search', async (c) => {
    const hasInternalConsoleGuard = isInternalApiSecretRequest(c.env, c.req)
        || Boolean(readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token'));
    if (!hasInternalConsoleGuard) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid platform console token.' } }, 401);
    }

    const parsed = MerchantSearchQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        q: cleanOptional(c.req.query('q')),
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid merchant search query', parsed.error.flatten());
    }

    const query = parsed.data;
    const db = getSupabaseAdmin(c);
    const search = searchExpression(['name', 'store_name', 'subdomain', 'custom_domain'], query.q);
    const siteRows: MerchantSiteRow[] = [];

    let siteRequest = db
        .from('sites')
        .select('id, user_id, custom_user_id, name, store_name, site_type, subdomain, custom_domain, status, views_count, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (isUuid(query.q)) {
        siteRequest = siteRequest.or(`id.eq.${query.q},user_id.eq.${query.q},custom_user_id.eq.${query.q}`);
    } else if (search) {
        siteRequest = siteRequest.or(search);
    }

    const { data: directSites, error: directError } = await siteRequest;
    if (directError) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, directError)) {
            return c.json(success({
                query: query.q,
                results: [],
                total: 0,
            }));
        }
        return c.json(dbError(directError.message), 500);
    }
    siteRows.push(...((directSites || []) as MerchantSiteRow[]));

    const ownerSearch = searchExpression(['email', 'full_name'], query.q);
    if (ownerSearch) {
        const { data: owners, error: ownerError } = await db
            .from('users_custom')
            .select('id, email, full_name')
            .or(ownerSearch)
            .limit(25);

        if (ownerError) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, ownerError)) {
                return c.json(success({
                    query: query.q,
                    results: compactRecords(siteRows).slice(0, query.limit),
                    total: compactRecords(siteRows).slice(0, query.limit).length,
                }));
            }
            return c.json(dbError(ownerError.message), 500);
        }

        const ownerIds = ((owners || []) as MerchantOwnerRow[]).map((owner) => owner.id).filter(Boolean);
        if (ownerIds.length > 0) {
            const [userSites, customUserSites] = await Promise.all([
                db
                    .from('sites')
                    .select('id, user_id, custom_user_id, name, store_name, site_type, subdomain, custom_domain, status, views_count, created_at, updated_at')
                    .in('user_id', ownerIds)
                    .is('deleted_at', null)
                    .limit(query.limit),
                db
                    .from('sites')
                    .select('id, user_id, custom_user_id, name, store_name, site_type, subdomain, custom_domain, status, views_count, created_at, updated_at')
                    .in('custom_user_id', ownerIds)
                    .is('deleted_at', null)
                    .limit(query.limit),
            ]);

            if (userSites.error || customUserSites.error) {
                const searchError = userSites.error || customUserSites.error;
                if (shouldReturnEmptyForMissingLocalSchema(c.env, searchError)) {
                    const uniqueRows = compactRecords(siteRows).slice(0, query.limit);
                    return c.json(success({
                        query: query.q,
                        results: uniqueRows,
                        total: uniqueRows.length,
                    }));
                }
                return c.json(dbError(userSites.error?.message || customUserSites.error?.message || 'Merchant owner search failed'), 500);
            }

            siteRows.push(...((userSites.data || []) as MerchantSiteRow[]));
            siteRows.push(...((customUserSites.data || []) as MerchantSiteRow[]));
        }
    }

    const uniqueRows = compactRecords(siteRows).slice(0, query.limit);
    return c.json(success({
        query: query.q,
        results: uniqueRows,
        total: uniqueRows.length,
    }));
});
router.get('/merchants/:id/overview', async (c) => {
    const hasInternalConsoleGuard = isInternalApiSecretRequest(c.env, c.req)
        || Boolean(readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token'));
    if (!hasInternalConsoleGuard) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid platform console token.' } }, 401);
    }

    const merchantId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const site = await readMerchantSite(c, merchantId);

    if (!site) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Merchant not found.' } }, 404);
    }

    const ownerIds = [site.user_id, site.custom_user_id].filter((id): id is string => Boolean(id));
    const subscriptionQuery = site.user_id
        ? `store_id.eq.${site.id},user_id.eq.${site.user_id}`
        : `store_id.eq.${site.id}`;
    const orderQuery = `store_id.eq.${site.id},site_id.eq.${site.id}`;
    const { actor_id: actorId, actor_email: actorEmail } = actorFromQuery(c);

    const [
        ownersResult,
        subscriptionsResult,
        ordersResult,
        appsResult,
        themeResult,
        riskResult,
        casesResult,
        supportResult,
        auditResult,
        impersonationResult,
    ] = await Promise.all([
        ownerIds.length > 0
            ? db.from('users_custom').select('id, email, full_name, email_verified, auth_provider, created_at').in('id', ownerIds)
            : Promise.resolve({ data: [], error: null }),
        db
            .from('subscriptions')
            .select('id, user_id, store_id, plan, status, billing_period, amount_paid, currency, current_period_start, current_period_end, created_at, updated_at')
            .or(subscriptionQuery)
            .order('created_at', { ascending: false })
            .limit(5),
        db
            .from('orders')
            .select('id, total, currency, status, payment_status, created_at')
            .or(orderQuery)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(500),
        db
            .from('app_installations')
            .select('id, app_id, status, scopes_granted, installed_at, uninstalled_at')
            .eq('store_id', site.id)
            .order('installed_at', { ascending: false })
            .limit(25),
        db
            .from('theme_instances')
            .select('id, theme_slug, instance_status, active_release_id, activated_at, created_at, updated_at')
            .eq('store_id', site.id)
            .is('deleted_at', null)
            .order('activated_at', { ascending: false, nullsFirst: false })
            .limit(5),
        db
            .from('risk_scores')
            .select('id, entity_type, entity_id, score, band, status, breakdown, scored_at, updated_at')
            .eq('entity_type', 'site')
            .eq('entity_id', site.id)
            .is('deleted_at', null)
            .order('scored_at', { ascending: false })
            .limit(1),
        db
            .from('ts_cases')
            .select('id, category, severity, status, title, assignee_id, created_at, updated_at')
            .eq('site_id', site.id)
            .is('deleted_at', null)
            .in('status', ['open', 'under_review', 'actioned', 'appealed'])
            .order('created_at', { ascending: false })
            .limit(10),
        db
            .from('support_tickets')
            .select('id, ticket_ref, subject, status, priority, topic, assignee_id, requester_email, first_response_due_at, resolution_due_at, updated_at, created_at')
            .eq('site_id', site.id)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .limit(10),
        db
            .from('audit_logs')
            .select('id, actor_id, actor_type, actor_email, action, resource_type, resource_id, created_at')
            .eq('resource_type', 'site')
            .eq('resource_id', site.id)
            .order('created_at', { ascending: false })
            .limit(10),
        db
            .from('impersonation_sessions')
            .select('id, operator_id, operator_email, reason, read_only, expires_at, started_at, ended_at')
            .eq('site_id', site.id)
            .is('deleted_at', null)
            .order('started_at', { ascending: false })
            .limit(5),
    ]);

    for (const result of [ownersResult, subscriptionsResult, ordersResult, appsResult, themeResult, riskResult, casesResult, supportResult, auditResult, impersonationResult]) {
        if (result.error) return c.json(dbError(result.error.message), 500);
    }

    const orders = (ordersResult.data || []) as DbRecord[];
    const paidOrders = orders.filter((order) => String(order.payment_status || '') === 'paid');
    const revenueMajor = paidOrders.reduce((total, order) => total + numberValue(order.total), 0);
    const recentOrders = orders.slice(0, 10);

    await writeConsoleAudit(c, {
        actorId,
        actorEmail,
        action: 'merchant.view',
        resourceType: 'site',
        resourceId: site.id,
        metadata: {
            merchant_id: site.id,
            viewed_sections: ['identity', 'commerce', 'ecosystem', 'risk', 'trust_safety', 'support', 'audit'],
        },
    });

    return c.json(success({
        site,
        owners: ownersResult.data || [],
        subscription: ((subscriptionsResult.data || []) as DbRecord[])[0] || null,
        subscriptions: subscriptionsResult.data || [],
        commerce: {
            order_count: orders.length,
            paid_order_count: paidOrders.length,
            revenue_paise: Math.round(revenueMajor * 100),
            recent_orders: recentOrders,
        },
        ecosystem: {
            installed_apps: appsResult.data || [],
            active_theme: ((themeResult.data || []) as DbRecord[]).find((theme) => String(theme.instance_status || '') === 'active') || ((themeResult.data || []) as DbRecord[])[0] || null,
            theme_instances: themeResult.data || [],
        },
        trust: {
            risk_score: ((riskResult.data || []) as DbRecord[])[0] || null,
            open_cases: casesResult.data || [],
        },
        support: {
            configured: true,
            open_ticket_count: ((supportResult.data || []) as DbRecord[]).filter((ticket) => !['resolved', 'closed'].includes(String(ticket.status || ''))).length,
            tickets: supportResult.data || [],
        },
        impersonation_sessions: impersonationResult.data || [],
        recent_audit_events: auditResult.data || [],
    }));
});
router.post('/merchants/:id/impersonation', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = MerchantImpersonationStartSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid merchant impersonation payload', parsed.error.flatten());

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) throw new ValidationError('Impersonation requires a clear reason between 8 and 1000 characters');

    const site = await readMerchantSite(c, c.req.param('id'));
    if (!site) return c.json({ error: { code: 'NOT_FOUND', message: 'Merchant not found.' } }, 404);

    const operatorId = parsed.data.operator_id || parsed.data.actor_id;
    const expiresAt = new Date(Date.now() + parsed.data.ttl_minutes * 60_000).toISOString();
    const sessionId = crypto.randomUUID();
    const signed = await generateImpersonationToken();

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('impersonation_sessions')
        .insert({
            id: sessionId,
            site_id: site.id,
            operator_id: operatorId,
            operator_email: parsed.data.operator_email || parsed.data.actor_email || null,
            reason,
            token_hash: signed.token_hash,
            read_only: true,
            expires_at: expiresAt,
            created_by: parsed.data.actor_id,
            metadata: {
                ttl_minutes: parsed.data.ttl_minutes,
                policy_status: 'pending_human_signoff',
            },
        })
        .select('id, site_id, operator_id, operator_email, reason, read_only, expires_at, started_at, ended_at')
        .single();

    if (error || !data) return c.json(dbError(error?.message || 'Impersonation session create failed'), 500);

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id,
        actorEmail: parsed.data.actor_email || parsed.data.operator_email || null,
        action: 'merchant.impersonation.start',
        resourceType: 'site',
        resourceId: site.id,
        reason,
        metadata: {
            impersonation_session_id: sessionId,
            read_only: true,
            expires_at: expiresAt,
        },
    });

    return c.json(success({
        session: data,
        token: signed.token,
    }), 201);
});
router.post('/merchants/:id/impersonation/:sessionId/end', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = MerchantActorSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid merchant impersonation end payload', parsed.error.flatten());

    const site = await readMerchantSite(c, c.req.param('id'));
    if (!site) return c.json({ error: { code: 'NOT_FOUND', message: 'Merchant not found.' } }, 404);

    const db = getSupabaseAdmin(c);
    const endedAt = new Date().toISOString();
    const { data, error } = await db
        .from('impersonation_sessions')
        .update({
            ended_at: endedAt,
            end_reason: parsed.data.reason,
            updated_by: parsed.data.actor_id,
        })
        .eq('id', c.req.param('sessionId'))
        .eq('site_id', site.id)
        .select('id, site_id, operator_id, operator_email, reason, read_only, expires_at, started_at, ended_at')
        .single();

    if (error || !data) return c.json(dbError(error?.message || 'Impersonation session end failed'), 500);

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id,
        actorEmail: parsed.data.actor_email || null,
        action: 'merchant.impersonation.end',
        resourceType: 'site',
        resourceId: site.id,
        reason: parsed.data.reason,
        metadata: {
            impersonation_session_id: c.req.param('sessionId'),
            ended_at: endedAt,
        },
    });

    return c.json(success({ session: data }));
});
router.post('/merchants/:id/moderation', async (c) => {
    const hasInternalConsoleGuard = isInternalApiSecretRequest(c.env, c.req)
        || Boolean(readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token'));
    if (!hasInternalConsoleGuard) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid platform console token.' } }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = MerchantModerationSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid merchant moderation payload', parsed.error.flatten());

    const sod = checkSegregationOfDuty({
        actorId: parsed.data.actor_id,
        secondaryApproverId: parsed.data.secondary_approver_id,
        targetAction: 'merchant.suspend',
    });
    if (!sod.ok) {
        return c.json({ error: { code: sod.code || 'SEGREGATION_OF_DUTY_FAILED', message: sod.message || 'Segregation of duty failed.' } }, 403);
    }

    const site = await readMerchantSite(c, c.req.param('id'));
    if (!site) return c.json({ error: { code: 'NOT_FOUND', message: 'Merchant not found.' } }, 404);

    const nextStatus = parsed.data.action === 'suspend' ? 'suspended' : 'published';
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('sites')
        .update({
            status: nextStatus,
            updated_by: parsed.data.actor_id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', site.id)
        .select('id, name, store_name, subdomain, custom_domain, status, updated_at')
        .single();

    if (error || !data) return c.json(dbError(error?.message || 'Merchant moderation update failed'), 500);

    await writeConsoleAudit(c, {
        actorId: parsed.data.actor_id,
        actorEmail: parsed.data.actor_email || null,
        action: parsed.data.action === 'suspend' ? 'merchant.suspend' : 'merchant.restore',
        resourceType: 'site',
        resourceId: site.id,
        reason: parsed.data.reason,
        metadata: {
            old_status: site.status || null,
            new_status: nextStatus,
            secondary_approver_id: parsed.data.secondary_approver_id,
        },
    });

    return c.json(success({ site: data }));
});
router.get('/subscriptions', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('subscriptions')
        .select('id, user_id, store_id, plan, status, billing_period, payment_gateway, amount_paid, currency, current_period_start, current_period_end, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.status) request = request.eq('status', query.status);

    const search = searchExpression(['plan', 'status', 'payment_gateway', 'external_subscription_id'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});
router.get('/employees', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    // Platform employees only: merchant store staff live in the same table and are not the platform's to list or
    // grant scopes to here (APPID-P5b).
    let request = db
        .from('employees')
        .select('id, user_id, email, full_name, phone, role, role_id, permissions, status, is_active, last_login_at, created_by, created_at, updated_at', { count: 'exact' })
        .filter('store_id', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.status === 'active') request = request.eq('is_active', true);
    if (query.status === 'inactive') request = request.eq('is_active', false);

    const search = searchExpression(['email', 'full_name', 'role'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});
router.patch('/employees/:id/permissions', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = EmployeePermissionPatchSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid employee permission update payload', parsed.error.flatten());
    }

    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('employees')
        .update({
            permissions: { scopes: parsed.data.scopes },
        })
        .eq('id', employeeId)
        .filter('store_id', 'is', null)
        .is('deleted_at', null)
        .select('id, user_id, email, full_name, role, permissions, status, is_active, updated_at')
        .maybeSingle();

    if (error) {
        return c.json(dbError(error.message || 'Employee permission update failed'), 500);
    }
    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } }, 404);
    }

    await db.from('audit_logs').insert({
        actor_id: parsed.data.actor_id || null,
        actor_type: 'super_admin',
        actor_email: parsed.data.actor_email || null,
        action: 'rbac.permission.update',
        resource_type: 'employee',
        resource_id: employeeId,
        metadata: {
            reason: parsed.data.reason,
            scopes: parsed.data.scopes,
            source: 'admin-web',
        },
        ip_address: c.req.header('CF-Connecting-IP') || null,
        user_agent: c.req.header('User-Agent') || null,
    });

    return c.json(success({ employee: data }));
});
router.get('/audit-logs', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('audit_logs')
        .select('id, actor_id, actor_type, actor_email, action, resource_type, resource_id, ip_address, user_agent, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.actor_type) request = request.eq('actor_type', query.actor_type);
    if (query.date) {
        const { start, end } = dayBounds(query.date);
        request = request.gte('created_at', start).lt('created_at', end);
    }

    const search = searchExpression(['actor_email', 'action', 'resource_type', 'actor_type'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, query.page, query.limit));
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});
router.post('/audit-logs', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AuditLogWriteSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid platform console audit log payload', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('audit_logs')
        .insert({
            actor_id: parsed.data.actor_id || null,
            actor_type: parsed.data.actor_type,
            actor_email: parsed.data.actor_email || null,
            action: parsed.data.action,
            resource_type: parsed.data.resource_type,
            resource_id: parsed.data.resource_id || null,
            metadata: parsed.data.metadata || {},
            ip_address: parsed.data.ip_address || null,
            user_agent: parsed.data.user_agent || null,
        })
        .select('id, created_at')
        .single();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({ id: null, created_at: new Date().toISOString(), local_schema_missing: true }), 202);
        }
        return c.json(dbError(error.message), 500);
    }

    return c.json(success(data), 201);
});

export default router;
