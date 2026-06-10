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
    updated_at?: string | null;
};

type CommerceAnalyticsDailyMvRow = {
    rollup_date: string;
    orders_created: number | string | null;
    orders_paid: number | string | null;
    revenue_paid_minor: number | string | null;
    media_processed: number | string | null;
    media_size_bytes: number | string | null;
    refreshed_from_rollups_at?: string | null;
};

type AnalyticsDb = ReturnType<typeof getSupabaseAdmin>;

const LIVE_VIEW_METRICS = [
    'storefront.sessions.active',
    'storefront.sessions.started',
    'storefront.page.views',
    'storefront.page.view',
    'storefront.product.views',
    'storefront.cart.added',
    'storefront.checkouts.started',
    'storefront.traffic.source',
    'storefront.session.device',
    'storefront.session.country',
];
const TRAFFIC_SOURCE_METRICS = [
    'storefront.sessions.started',
    'storefront.page.views',
    'storefront.page.view',
    'storefront.traffic.source',
];

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

function warehouseReadiness(env: Pick<Env, 'LETBUYY_WAREHOUSE_MODE'>) {
    const mode = env.LETBUYY_WAREHOUSE_MODE?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
    if (mode === 'live') {
        // [HUMAN-REQUIRED] HR-WAREHOUSE-LIVE: warehouse/replica credentials and data contracts are not activated in V1 local mode.
        return {
            mode: 'live',
            status: 'human_required',
            message: 'External warehouse activation requires operator approval.',
        };
    }

    return {
        mode: 'sandbox',
        status: 'deferred',
        message: 'Dashboards read from in-DB rollups in this release.',
    };
}

function rollupDimension(row: AnalyticsRollupRow, key: string): string | null {
    const value = row.dimensions?.[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function rollupUpdatedAt(row: AnalyticsRollupRow): string | null {
    return typeof row.updated_at === 'string' && row.updated_at.length > 0 ? row.updated_at : null;
}

function rollupRowsBetween(rows: AnalyticsRollupRow[], fromDate: string, toDate?: string): AnalyticsRollupRow[] {
    return rows.filter((row) => row.rollup_date >= fromDate && (!toDate || row.rollup_date < toDate));
}

function sumRollup(rows: AnalyticsRollupRow[], metricName: string): number {
    return rows
        .filter((row) => row.metric_name === metricName)
        .reduce((sum, row) => sum + rollupNumber(row.metric_value), 0);
}

function percentageChange(current: number, previous: number): number {
    return previous === 0 ? 0 : Math.round(((current - previous) / previous) * 1000) / 10;
}

function metricDelta(current: number, previous: number) {
    return {
        value: current,
        change_pct: percentageChange(current, previous),
        prev: previous,
    };
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
        .select('metric_name, rollup_date, dimensions, metric_value, updated_at')
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

function analyticsLiveWindowMinutes(value: string | undefined): number {
    const parsed = Number(value || 15);
    if (!Number.isFinite(parsed)) return 15;
    return Math.min(Math.max(Math.round(parsed), 5), 60);
}

function analyticsLimit(value: string | undefined, fallback = 10, max = 50): number {
    const parsed = Number(value || fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.round(parsed), 1), max);
}

function liveRollupLabel(row: AnalyticsRollupRow): string {
    return rollupDimension(row, 'page_title')
        || rollupDimension(row, 'path')
        || rollupDimension(row, 'source')
        || rollupDimension(row, 'device')
        || rollupDimension(row, 'country')
        || row.metric_name;
}

function sumMetric(rows: AnalyticsRollupRow[], metricName: string): number {
    return Math.round(sumRollup(rows, metricName));
}

function topDimensionEntries(
    rows: AnalyticsRollupRow[],
    metricNames: string[],
    dimensionKeys: string[],
    limit: number,
): Array<{ label: string; value: number; metadata: Record<string, string | number | boolean | null> }> {
    const grouped = new Map<string, { label: string; value: number; metadata: Record<string, string | number | boolean | null> }>();

    for (const row of rows) {
        if (!metricNames.includes(row.metric_name)) continue;
        const label = dimensionKeys.map((key) => rollupDimension(row, key)).find(Boolean);
        if (!label) continue;
        const entry = grouped.get(label) || { label, value: 0, metadata: {} };
        entry.value += rollupNumber(row.metric_value);
        for (const key of dimensionKeys) {
            const value = rollupDimension(row, key);
            if (value) entry.metadata[key] = value;
        }
        grouped.set(label, entry);
    }

    return Array.from(grouped.values())
        .map((entry) => ({ ...entry, value: Math.round(entry.value) }))
        .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
        .slice(0, limit);
}

async function loadRollupLiveView(db: AnalyticsDb, storeId: string, windowMinutes: number) {
    const rows = await loadRollups(db, storeId, LIVE_VIEW_METRICS, rollupDate(1), 2000);
    if (!rows) return null;

    const now = Date.now();
    const sinceMs = now - windowMinutes * 60000;
    const liveRows = rows.filter((row) => {
        const updatedAt = rollupUpdatedAt(row);
        return updatedAt ? Date.parse(updatedAt) >= sinceMs : false;
    });
    const lastSeenAt = liveRows
        .map(rollupUpdatedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;
    const available = liveRows.some((row) => rollupNumber(row.metric_value) > 0);

    return {
        store_id: storeId,
        available,
        window_minutes: windowMinutes,
        active_sessions: sumMetric(liveRows, 'storefront.sessions.active'),
        visitors: sumMetric(liveRows, 'storefront.sessions.started'),
        page_views: sumMetric(liveRows, 'storefront.page.views') + sumMetric(liveRows, 'storefront.page.view'),
        cart_adds: sumMetric(liveRows, 'storefront.cart.added'),
        checkouts_started: sumMetric(liveRows, 'storefront.checkouts.started'),
        top_pages: topDimensionEntries(liveRows, ['storefront.page.views', 'storefront.page.view'], ['page_title', 'path'], 5),
        traffic_sources: topDimensionEntries(liveRows, ['storefront.traffic.source', 'storefront.sessions.started', 'storefront.page.views', 'storefront.page.view'], ['source', 'referrer'], 5),
        devices: topDimensionEntries(liveRows, ['storefront.session.device', 'storefront.sessions.started'], ['device'], 5),
        countries: topDimensionEntries(liveRows, ['storefront.session.country', 'storefront.sessions.started'], ['country'], 5),
        recent_signals: liveRows
            .slice()
            .sort((left, right) => Date.parse(rollupUpdatedAt(right) || '') - Date.parse(rollupUpdatedAt(left) || ''))
            .slice(0, 8)
            .map((row) => ({
                metric_name: row.metric_name,
                label: liveRollupLabel(row),
                value: Math.round(rollupNumber(row.metric_value)),
                seen_at: rollupUpdatedAt(row),
            })),
        generated_at: new Date(now).toISOString(),
        last_seen_at: lastSeenAt,
        refresh_after_seconds: 30,
        pipeline: {
            status: available ? 'ready' : 'waiting_for_events',
            source: 'analytics_rollups_daily',
            message: available
                ? 'Live storefront signals are being received.'
                : 'Live storefront signals appear after traffic data is collected.',
        },
    };
}

async function loadRollupTrafficSources(db: AnalyticsDb, storeId: string, period: string, limit: number) {
    const rows = await loadRollups(db, storeId, TRAFFIC_SOURCE_METRICS, rollupDate(analyticsPeriodDays(period)), 2000);
    const generatedAt = new Date().toISOString();

    if (!rows) return null;

    const totalSessions = Math.round(sumRollup(rows, 'storefront.sessions.started'));
    const totalPageViews = Math.round(sumRollup(rows, 'storefront.page.views') + sumRollup(rows, 'storefront.page.view'));
    const sourceEntries = topDimensionEntries(rows, ['storefront.traffic.source'], ['source', 'referrer', 'campaign', 'medium'], limit);
    const sourceTotal = sourceEntries.reduce((sum, entry) => sum + entry.value, 0);
    const denominator = sourceTotal || totalSessions || 0;
    const available = denominator > 0 || totalPageViews > 0;

    return {
        store_id: storeId,
        period,
        available,
        total_sessions: totalSessions,
        total_page_views: totalPageViews,
        sources: sourceEntries.map((entry) => ({
            ...entry,
            percentage: denominator > 0 ? Math.round((entry.value / denominator) * 1000) / 10 : 0,
        })),
        generated_at: generatedAt,
        pipeline: {
            status: available ? 'ready' : 'waiting_for_events',
            source: 'analytics_rollups_daily',
            message: available
                ? 'Storefront session sources are being collected.'
                : 'Traffic source attribution appears after storefront visits are collected.',
        },
    };
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
    const currentAverageOrderValue = currentOrders > 0 ? Math.round(revenue / currentOrders) : 0;
    const previousAverageOrderValue = previousOrders > 0 ? Math.round(prevRevenue / previousOrders) : 0;

    return {
        period,
        summary: {
            revenue: metricDelta(revenue, prevRevenue),
            orders: metricDelta(currentOrders, previousOrders),
            products: counts.products,
            customers: counts.customers,
            avg_order_value: currentAverageOrderValue,
        },
        comparison: {
            previous_period: {
                from: previousSince,
                to: currentSince,
                label: `Previous ${days} days`,
            },
            revenue: metricDelta(revenue, prevRevenue),
            orders: metricDelta(currentOrders, previousOrders),
            average_order_value: metricDelta(currentAverageOrderValue, previousAverageOrderValue),
        },
    };
}

function revenueChartFromRollupRows(rows: AnalyticsRollupRow[]) {
    const byDate = new Map<string, { revenue: number; orders: number }>();
    for (const row of rows) {
        const entry = byDate.get(row.rollup_date) || { revenue: 0, orders: 0 };
        if (row.metric_name === 'revenue.paid_minor') entry.revenue += rollupNumber(row.metric_value) / 100;
        if (row.metric_name === 'orders.paid') entry.orders += rollupNumber(row.metric_value);
        byDate.set(row.rollup_date, entry);
    }

    return Array.from(byDate.entries()).map(([date, value]) => ({
        date,
        revenue: Math.round(value.revenue),
        orders: value.orders,
    }));
}

async function loadRollupRevenue(db: AnalyticsDb, storeId: string, period: string) {
    const days = analyticsPeriodDays(period === '12m' ? '90d' : period);
    const currentSince = rollupDate(days);
    const previousSince = rollupDate(days * 2);
    const rows = await loadRollups(db, storeId, ['orders.paid', 'revenue.paid_minor'], previousSince);
    if (!rows) return null;

    const currentRows = rollupRowsBetween(rows, currentSince);
    const previousRows = rollupRowsBetween(rows, previousSince, currentSince);

    return {
        period,
        chart: revenueChartFromRollupRows(currentRows),
        comparison: {
            previous_period: {
                from: previousSince,
                to: currentSince,
                label: `Previous ${days} days`,
            },
            chart: revenueChartFromRollupRows(previousRows),
        },
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

async function loadCommerceAnalyticsMvSummary(db: AnalyticsDb, storeId: string, period: string) {
    const days = analyticsPeriodDays(period);
    const sinceDate = rollupDate(days);
    const { data, error } = await db
        .from('commerce_analytics_daily_mv')
        .select('rollup_date, orders_created, orders_paid, revenue_paid_minor, media_processed, media_size_bytes, refreshed_from_rollups_at')
        .eq('site_id', storeId)
        .gte('rollup_date', sinceDate)
        .order('rollup_date', { ascending: true });

    if (error) return null;
    const rows = Array.isArray(data) ? data as CommerceAnalyticsDailyMvRow[] : [];
    const totals = rows.reduce(
        (acc, row) => ({
            orders_created: acc.orders_created + rollupNumber(row.orders_created),
            orders_paid: acc.orders_paid + rollupNumber(row.orders_paid),
            revenue_paid_minor: acc.revenue_paid_minor + rollupNumber(row.revenue_paid_minor),
            media_processed: acc.media_processed + rollupNumber(row.media_processed),
            media_size_bytes: acc.media_size_bytes + rollupNumber(row.media_size_bytes),
        }),
        { orders_created: 0, orders_paid: 0, revenue_paid_minor: 0, media_processed: 0, media_size_bytes: 0 },
    );

    return {
        store_id: storeId,
        period,
        source: 'commerce_analytics_daily_mv',
        totals: {
            orders_created: Math.round(totals.orders_created),
            orders_paid: Math.round(totals.orders_paid),
            revenue_paid_minor: Math.round(totals.revenue_paid_minor),
            media_processed: Math.round(totals.media_processed),
            media_size_bytes: Math.round(totals.media_size_bytes),
        },
        chart: rows.map((row) => ({
            date: row.rollup_date,
            orders_created: Math.round(rollupNumber(row.orders_created)),
            orders_paid: Math.round(rollupNumber(row.orders_paid)),
            revenue_paid_minor: Math.round(rollupNumber(row.revenue_paid_minor)),
            media_processed: Math.round(rollupNumber(row.media_processed)),
            media_size_bytes: Math.round(rollupNumber(row.media_size_bytes)),
        })),
        refreshed_from_rollups_at: rows
            .map((row) => row.refreshed_from_rollups_at)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) || null,
    };
}

// GET /analytics/live — Storefront live traffic snapshot
router.get('/live', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const windowMinutes = analyticsLiveWindowMinutes(c.req.query('window_minutes'));
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const liveView = await loadRollupLiveView(db, storeId, windowMinutes);
    if (liveView) return c.json(success(liveView));

    return c.json(success({
        store_id: storeId,
        available: false,
        window_minutes: windowMinutes,
        active_sessions: 0,
        visitors: 0,
        page_views: 0,
        cart_adds: 0,
        checkouts_started: 0,
        top_pages: [],
        traffic_sources: [],
        devices: [],
        countries: [],
        recent_signals: [],
        generated_at: new Date().toISOString(),
        last_seen_at: null,
        refresh_after_seconds: 30,
        pipeline: {
            status: 'waiting_for_events',
            source: 'analytics_rollups_daily',
            message: 'Live storefront signals appear after traffic data is collected.',
        },
    }));
});

// GET /analytics/traffic-sources — Storefront session source attribution from rollups.
router.get('/traffic-sources', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const period = c.req.query('period') || '30d';
    const limit = analyticsLimit(c.req.query('limit'));
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const report = analyticsRollupReadsEnabled(c.env)
        ? await loadRollupTrafficSources(db, storeId, period, limit)
        : null;

    if (report) return c.json(success(report));

    return c.json(success({
        store_id: storeId,
        period,
        available: false,
        total_sessions: 0,
        total_page_views: 0,
        sources: [],
        generated_at: new Date().toISOString(),
        pipeline: {
            status: 'waiting_for_events',
            source: 'analytics_rollups_daily',
            message: 'Traffic source attribution appears after storefront visits are collected.',
        },
    }));
});

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

    const currentAverageOrderValue = currentOrders.length > 0 ? Math.round(revenue / currentOrders.length) : 0;
    const previousAverageOrderValue = previousOrders.length > 0 ? Math.round(prevRevenue / previousOrders.length) : 0;
    const previousPeriodFrom = new Date(prevSince).toISOString().slice(0, 10);
    const previousPeriodTo = new Date(since).toISOString().slice(0, 10);

    return c.json(success({
        period,
        summary: {
            revenue: metricDelta(revenue, prevRevenue),
            orders: metricDelta(currentOrders.length, previousOrders.length),
            products: productCount || 0,
            customers: customerCount || 0,
            avg_order_value: currentAverageOrderValue,
        },
        comparison: {
            previous_period: {
                from: previousPeriodFrom,
                to: previousPeriodTo,
                label: `Previous ${days} days`,
            },
            revenue: metricDelta(revenue, prevRevenue),
            orders: metricDelta(currentOrders.length, previousOrders.length),
            average_order_value: metricDelta(currentAverageOrderValue, previousAverageOrderValue),
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

    const days = analyticsPeriodDays(period === '12m' ? '90d' : period);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

    const { data: orders } = await db.from('orders').select('total, created_at, payment_status')
        .eq('store_id', storeId).gte('created_at', since).eq('payment_status', 'paid')
        .order('created_at', { ascending: true });

    const { data: previousOrders } = await db.from('orders').select('total, created_at, payment_status')
        .eq('store_id', storeId).gte('created_at', prevSince).lt('created_at', since).eq('payment_status', 'paid')
        .order('created_at', { ascending: true });

    const dailyChart = (rows: Array<{ total?: number | null; created_at: string }>) => {
        const dailyMap = new Map<string, { revenue: number; orders: number }>();
        for (const o of rows) {
            const date = o.created_at.slice(0, 10);
            const entry = dailyMap.get(date) || { revenue: 0, orders: 0 };
            entry.revenue += o.total || 0;
            entry.orders += 1;
            dailyMap.set(date, entry);
        }

        return Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d }));
    };

    return c.json(success({
        period,
        chart: dailyChart(orders || []),
        comparison: {
            previous_period: {
                from: new Date(prevSince).toISOString().slice(0, 10),
                to: new Date(since).toISOString().slice(0, 10),
                label: `Previous ${days} days`,
            },
            chart: dailyChart(previousOrders || []),
        },
    }));
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

// GET /analytics/:site/summary — V1 in-DB rollup dashboard alias backed by the commerce materialized view.
router.get('/:site/summary', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('site');
    const period = c.req.query('period') || '30d';
    const db = getSupabaseAdmin(c);

    if (!(await canAccessStore(db, auth.user, storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const projected = await loadCommerceAnalyticsMvSummary(db, storeId, period);
    if (projected) {
        return c.json(success({
            ...projected,
            warehouse: warehouseReadiness(c.env),
        }));
    }

    const fallback = await loadRollupDashboard(db, storeId, period);
    return c.json(success({
        store_id: storeId,
        period,
        source: 'analytics_rollups_daily',
        summary: fallback?.summary || null,
        warehouse: warehouseReadiness(c.env),
    }));
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
