// ============================================================
// ANALYTICS — Store analytics + revenue (Doc 04 + Doc 09 § 5.2)
// ============================================================
import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

type AnalyticsRollupRow = {
    metric_name: string;
    rollup_date: string;
    dimensions: Record<string, unknown> | null;
    metric_value: number | string | null;
};

type AnalyticsDb = ReturnType<typeof getSupabaseAdmin>;

function analyticsRollupReadsEnabled(env: Pick<Env, 'ANALYTICS_PROJECTION_READS'>): boolean {
    return (env.ANALYTICS_PROJECTION_READS || 'on').trim().toLowerCase() !== 'off';
}

function analyticsPeriodDays(period: string): number {
    if (period === '7d') return 7;
    if (period === '90d') return 90;
    if (period === '12m') return 365;
    return 30;
}

function rollupDate(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

function rollupNumber(value: number | string | null | undefined): number {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function rollupDimension(row: AnalyticsRollupRow, key: string): string | null {
    const value = row.dimensions?.[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function rollupRowsBetween(rows: AnalyticsRollupRow[], fromDate: string, toDate?: string): AnalyticsRollupRow[] {
    return rows.filter((row) => row.rollup_date >= fromDate && (!toDate || row.rollup_date < toDate));
}

function sumRollup(rows: AnalyticsRollupRow[], metricName: string): number {
    return rows
        .filter((row) => row.metric_name === metricName)
        .reduce((sum, row) => sum + rollupNumber(row.metric_value), 0);
}

async function loadRollups(
    db: AnalyticsDb,
    storeId: string,
    metricNames: string[],
    sinceDate?: string,
    limit = 1000,
): Promise<AnalyticsRollupRow[] | null> {
    let query = db
        .from('analytics_rollups_daily')
        .select('metric_name, rollup_date, dimensions, metric_value')
        .eq('site_id', storeId)
        .in('metric_name', metricNames)
        .is('deleted_at', null)
        .order('rollup_date', { ascending: true })
        .limit(limit);

    if (sinceDate) query = query.gte('rollup_date', sinceDate);

    const { data, error } = await query;
    if (error) return null;
    return Array.isArray(data) ? data as AnalyticsRollupRow[] : [];
}

async function loadStoreEntityCounts(db: AnalyticsDb, storeId: string): Promise<{ products: number; customers: number }> {
    const [{ count: productCount }, { count: customerCount }] = await Promise.all([
        db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'active'),
        db.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
    ]);

    return {
        products: productCount || 0,
        customers: customerCount || 0,
    };
}

async function loadRollupDashboard(db: AnalyticsDb, storeId: string, period: string) {
    const days = analyticsPeriodDays(period);
    const currentSince = rollupDate(days);
    const previousSince = rollupDate(days * 2);
    const rows = await loadRollups(db, storeId, ['orders.created', 'orders.paid', 'revenue.paid_minor'], previousSince);
    if (!rows) return null;

    const currentRows = rollupRowsBetween(rows, currentSince);
    const previousRows = rollupRowsBetween(rows, previousSince, currentSince);
    const revenue = Math.round(sumRollup(currentRows, 'revenue.paid_minor') / 100);
    const prevRevenue = Math.round(sumRollup(previousRows, 'revenue.paid_minor') / 100);
    const currentOrders = sumRollup(currentRows, 'orders.created');
    const previousOrders = sumRollup(previousRows, 'orders.created');
    const counts = await loadStoreEntityCounts(db, storeId);
    const changePct = (curr: number, prev: number) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 1000) / 10;

    return {
        period,
        summary: {
            revenue: { value: revenue, change_pct: changePct(revenue, prevRevenue), prev: prevRevenue },
            orders: { value: currentOrders, change_pct: changePct(currentOrders, previousOrders), prev: previousOrders },
            products: counts.products,
            customers: counts.customers,
            avg_order_value: currentOrders > 0 ? Math.round(revenue / currentOrders) : 0,
        },
    };
}

async function loadRollupRevenue(db: AnalyticsDb, storeId: string, period: string) {
    const days = analyticsPeriodDays(period === '12m' ? '90d' : period);
    const rows = await loadRollups(db, storeId, ['orders.paid', 'revenue.paid_minor'], rollupDate(days));
    if (!rows) return null;

    const byDate = new Map<string, { revenue: number; orders: number }>();
    for (const row of rows) {
        const entry = byDate.get(row.rollup_date) || { revenue: 0, orders: 0 };
        if (row.metric_name === 'revenue.paid_minor') entry.revenue += rollupNumber(row.metric_value) / 100;
        if (row.metric_name === 'orders.paid') entry.orders += rollupNumber(row.metric_value);
        byDate.set(row.rollup_date, entry);
    }

    return {
        period,
        chart: Array.from(byDate.entries()).map(([date, value]) => ({
            date,
            revenue: Math.round(value.revenue),
            orders: value.orders,
        })),
    };
}

async function loadRollupTopProducts(db: AnalyticsDb, storeId: string, limit: number) {
    const rows = await loadRollups(db, storeId, ['product.units_sold', 'product.revenue_minor'], undefined, 2000);
    if (!rows) return null;

    const products = new Map<string, { id: string; name: string; sku: string | null; total_sold: number; revenue: number }>();
    for (const row of rows) {
        const productId = rollupDimension(row, 'product_id');
        if (!productId) continue;

        const current = products.get(productId) || {
            id: productId,
            name: rollupDimension(row, 'product_name') || productId,
            sku: rollupDimension(row, 'sku'),
            total_sold: 0,
            revenue: 0,
        };

        if (row.metric_name === 'product.units_sold') current.total_sold += rollupNumber(row.metric_value);
        if (row.metric_name === 'product.revenue_minor') current.revenue += rollupNumber(row.metric_value) / 100;
        products.set(productId, current);
    }

    return Array.from(products.values())
        .sort((left, right) => right.total_sold - left.total_sold || right.revenue - left.revenue)
        .slice(0, limit)
        .map((product) => ({
            ...product,
            revenue: Math.round(product.revenue),
        }));
}

async function loadRollupOrderBreakdown(db: AnalyticsDb, storeId: string) {
    const rows = await loadRollups(db, storeId, ['orders.status'], undefined, 2000);
    if (!rows) return null;

    const breakdown: Record<string, number> = {};
    for (const row of rows) {
        const status = rollupDimension(row, 'status');
        if (!status) continue;
        breakdown[status] = (breakdown[status] || 0) + rollupNumber(row.metric_value);
    }

    return {
        breakdown,
        total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    };
}

// GET /analytics/dashboard — Main dashboard metrics
router.get('/dashboard', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const period = c.req.query('period') || '30d';
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);

    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (analyticsRollupReadsEnabled(c.env)) {
        const projected = await loadRollupDashboard(db, storeId, period);
        if (projected) return c.json(success(projected));
    }

    const days = analyticsPeriodDays(period);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

    // Current period orders
    const { data: orders } = await db.from('orders').select('total, status, payment_status, created_at')
        .eq('store_id', storeId).gte('created_at', since);

    // Previous period orders (for comparison)
    const { data: prevOrders } = await db.from('orders').select('total, status, payment_status')
        .eq('store_id', storeId).gte('created_at', prevSince).lt('created_at', since);

    const currentOrders = orders || [];
    const previousOrders = prevOrders || [];

    const revenue = currentOrders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total || 0), 0);
    const prevRevenue = previousOrders.filter((o) => o.payment_status === 'paid').reduce((s, o) => s + (o.total || 0), 0);

    const { products: productCount, customers: customerCount } = await loadStoreEntityCounts(db, storeId);

    const changePct = (curr: number, prev: number) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 1000) / 10;

    return c.json(success({
        period,
        summary: {
            revenue: { value: revenue, change_pct: changePct(revenue, prevRevenue), prev: prevRevenue },
            orders: { value: currentOrders.length, change_pct: changePct(currentOrders.length, previousOrders.length), prev: previousOrders.length },
            products: productCount || 0,
            customers: customerCount || 0,
            avg_order_value: currentOrders.length > 0 ? Math.round(revenue / currentOrders.length) : 0,
        },
    }));
});

// GET /analytics/revenue — Revenue breakdown
router.get('/revenue', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const period = c.req.query('period') || '30d';
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (analyticsRollupReadsEnabled(c.env)) {
        const projected = await loadRollupRevenue(db, storeId, period);
        if (projected) return c.json(success(projected));
    }

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: orders } = await db.from('orders').select('total, created_at, payment_status')
        .eq('store_id', storeId).gte('created_at', since).eq('payment_status', 'paid')
        .order('created_at', { ascending: true });

    // Group by date
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders || []) {
        const date = o.created_at.slice(0, 10);
        const entry = dailyMap.get(date) || { revenue: 0, orders: 0 };
        entry.revenue += o.total || 0;
        entry.orders += 1;
        dailyMap.set(date, entry);
    }

    const chart = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d }));

    return c.json(success({ period, chart }));
});

// GET /analytics/top-products — Top-selling products
router.get('/top-products', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (analyticsRollupReadsEnabled(c.env)) {
        const projected = await loadRollupTopProducts(db, storeId, limit);
        if (projected) return c.json(success(projected));
    }

    const { data } = await db.from('products')
        .select('id, name, slug, price, total_sold, images, stock_quantity')
        .eq('store_id', storeId).eq('status', 'active')
        .order('total_sold', { ascending: false }).limit(limit);

    return c.json(success(data || []));
});

// GET /analytics/orders — Order status breakdown
router.get('/orders', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (analyticsRollupReadsEnabled(c.env)) {
        const projected = await loadRollupOrderBreakdown(db, storeId);
        if (projected) return c.json(success(projected));
    }

    const { data } = await db.from('orders').select('status').eq('store_id', storeId);
    const breakdown: Record<string, number> = {};
    for (const o of data || []) { breakdown[o.status] = (breakdown[o.status] || 0) + 1; }

    return c.json(success({ breakdown, total: (data || []).length }));
});

async function canAccessStore(
    db: ReturnType<typeof getSupabaseAdmin>,
    authUser: WorkerAuthUser,
    storeId: string
) {
    const customUser = await resolveCustomUser(db, authUser);
    return customUser
        ? verifySiteOwnership(db, storeId, customUser.id, authUser.storeId)
        : false;
}

export default router;
