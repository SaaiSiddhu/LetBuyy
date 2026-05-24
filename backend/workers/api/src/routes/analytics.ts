// ============================================================
// ANALYTICS — Store analytics + revenue (Doc 04 + Doc 09 § 5.2)
// ============================================================
import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

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

    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '12m' ? 365 : 30;
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

    const { count: productCount } = await db.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'active');
    const { count: customerCount } = await db.from('customers').select('*', { count: 'exact', head: true }).eq('store_id', storeId);

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
