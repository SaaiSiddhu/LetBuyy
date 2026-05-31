import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { ValidationError } from '../lib/errors';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

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

type ListQuery = z.infer<typeof ListQuerySchema>;

interface RevenueSubscriptionRow {
    amount_paid?: number | string | null;
}

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

    if (!token || token !== expectedToken) {
        return c.json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid platform console token.',
            },
        }, 401);
    }

    await next();
});

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

function dayBounds(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}

function dbError(message: string) {
    return {
        error: {
            code: 'DB_ERROR',
            message,
        },
    };
}

function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

router.get('/summary', async (c) => {
    const db = getSupabaseAdmin(c);

    const [users, stores, activeStores, subscriptions, activeSubscriptions, employees, auditLogs, revenueRows] = await Promise.all([
        db.from('users_custom').select('id', { count: 'exact', head: true }),
        db.from('sites').select('id', { count: 'exact', head: true }),
        db.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        db.from('subscriptions').select('id', { count: 'exact', head: true }),
        db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        db.from('employees').select('id', { count: 'exact', head: true }),
        db.from('audit_logs').select('id', { count: 'exact', head: true }),
        db.from('subscriptions').select('amount_paid').eq('status', 'active'),
    ]);

    for (const result of [users, stores, activeStores, subscriptions, activeSubscriptions, employees, auditLogs, revenueRows]) {
        if (result.error) {
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

router.get('/settings', async (c) => {
    return c.json(success({
        environment: c.env.ENVIRONMENT || c.env.APP_ENV || c.env.NODE_ENV || 'unknown',
        runtime_name: c.env.RUNTIME_NAME || 'api-gateway',
        primary_region: c.env.PRIMARY_REGION || 'unset',
        failover_region: c.env.FAILOVER_REGION || 'unset',
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
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
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
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});

router.get('/employees', async (c) => {
    const query = parseListQuery(c);
    const { from, to } = rangeFor(query);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('employees')
        .select('id, user_id, email, full_name, phone, role, is_active, last_login_at, created_by, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.status === 'active') request = request.eq('is_active', true);
    if (query.status === 'inactive') request = request.eq('is_active', false);

    const search = searchExpression(['email', 'full_name', 'role'], query.q);
    if (search) request = request.or(search);

    const { data, error, count } = await request;

    if (error) {
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
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
        return c.json(dbError(error.message), 500);
    }

    return c.json(paginated(data || [], count || 0, query.page, query.limit));
});

export default router;
