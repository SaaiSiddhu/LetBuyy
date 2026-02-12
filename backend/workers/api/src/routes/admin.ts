import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success, paginated } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// ============================================================
// SUPER ADMIN MIDDLEWARE — Verify super admin for all routes
// ============================================================

async function verifySuperAdmin(c: any): Promise<boolean> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data } = await db
        .from('super_admin_allowlist')
        .select('id')
        .eq('user_id', auth.user.id)
        .single();

    return !!data;
}

// ============================================================
// DASHBOARD
// ============================================================

// GET /admin/dashboard — Platform metrics
router.get('/dashboard', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);

    const [storesResult, products, orders, users, employees] = await Promise.all([
        db.from('stores').select('id', { count: 'exact', head: true }),
        db.from('products').select('id', { count: 'exact', head: true }),
        db.from('orders').select('id', { count: 'exact', head: true }),
        db.from('user_profiles').select('id', { count: 'exact', head: true }),
        db.from('employees').select('id', { count: 'exact', head: true }),
    ]);

    // Recent revenue (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders } = await db
        .from('orders')
        .select('total')
        .gte('created_at', thirtyDaysAgo)
        .eq('payment_status', 'paid');

    const revenue30d = (recentOrders || []).reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

    return c.json(success({
        total_stores: storesResult.count || 0,
        total_products: products.count || 0,
        total_orders: orders.count || 0,
        total_users: users.count || 0,
        total_employees: employees.count || 0,
        revenue_30d: revenue30d,
    }));
});

// ============================================================
// USERS
// ============================================================

// GET /admin/users — List all platform users
router.get('/users', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await db
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// ============================================================
// STORES
// ============================================================

// GET /admin/stores — List all platform stores
router.get('/stores', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const status = c.req.query('status');

    let query = db
        .from('stores')
        .select('*, user_profiles!inner(email, full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// PATCH /admin/stores/:id/status — Suspend/unsuspend a store
router.patch('/stores/:id/status', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const storeId = c.req.param('id');
    const { status } = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!['draft', 'published', 'suspended', 'frozen'].includes(status)) {
        return c.json({ error: { code: 'VALIDATION', message: 'Invalid status' } }, 400);
    }

    const { data, error } = await db
        .from('stores')
        .update({ status })
        .eq('id', storeId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Audit log
    await db.from('audit_logs').insert({
        actor_id: c.get('auth').user.id,
        actor_type: 'super_admin',
        action: `store_status_${status}`,
        resource_type: 'store',
        resource_id: storeId,
        metadata: { new_status: status },
    });

    return c.json(success(data));
});

// DELETE /admin/stores/:id — Hard delete a store
router.delete('/stores/:id', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    // Cascade delete: products, orders, etc. are handled by FK constraints
    const { error } = await db.from('stores').delete().eq('id', storeId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Audit log
    await db.from('audit_logs').insert({
        actor_id: c.get('auth').user.id,
        actor_type: 'super_admin',
        action: 'store_deleted',
        resource_type: 'store',
        resource_id: storeId,
    });

    return c.json({ data: { deleted: true } });
});

// ============================================================
// SUBSCRIPTIONS & ANALYTICS
// ============================================================

// GET /admin/subscriptions — Billing & revenue overview
router.get('/subscriptions', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);

    const { data, error, count } = await db
        .from('subscriptions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ subscriptions: data || [], total: count || 0 }));
});

// GET /admin/analytics — Platform-wide analytics
router.get('/analytics', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);

    // Get time-series data for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [newStores, newOrders, newUsers] = await Promise.all([
        db.from('stores').select('id, created_at').gte('created_at', thirtyDaysAgo),
        db.from('orders').select('id, total, created_at').gte('created_at', thirtyDaysAgo),
        db.from('user_profiles').select('id, created_at').gte('created_at', thirtyDaysAgo),
    ]);

    return c.json(success({
        period: '30d',
        new_stores: newStores.data?.length || 0,
        new_orders: newOrders.data?.length || 0,
        new_users: newUsers.data?.length || 0,
        revenue: (newOrders.data || []).reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0),
    }));
});

// ============================================================
// AUDIT LOGS
// ============================================================

// GET /admin/audit-logs — All audit logs
router.get('/audit-logs', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const offset = (page - 1) * limit;

    const { data, error, count } = await db
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// ============================================================
// EMPLOYEE MANAGEMENT (from Super Admin)
// ============================================================

// GET /admin/employees — List all employees
router.get('/employees', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('employees')
        .select('*, stores(name, subdomain)')
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /admin/employees/invite — Invite an employee (Super Admin)
router.post('/employees/invite', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const auth = c.get('auth');
    const { email, store_id, role } = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email required' } }, 400);
    }

    const token = crypto.randomUUID();
    const { data, error } = await db
        .from('employee_invites')
        .insert({
            store_id: store_id || null,
            email,
            role: role || 'support',
            token,
            invited_by: auth.user.id,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // TODO: Send invite email via Resend

    return c.json(success(data), 201);
});

// PATCH /admin/employees/:id/deactivate — Deactivate an employee
router.patch('/employees/:id/deactivate', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('employees')
        .update({ status: 'deactivated' })
        .eq('id', employeeId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Audit log
    await db.from('audit_logs').insert({
        actor_id: c.get('auth').user.id,
        actor_type: 'super_admin',
        action: 'employee_deactivated',
        resource_type: 'employee',
        resource_id: employeeId,
    });

    return c.json(success(data));
});

// DELETE /admin/employees/:id — Remove an employee
router.delete('/employees/:id', async (c) => {
    if (!(await verifySuperAdmin(c))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
    }

    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db.from('employees').delete().eq('id', employeeId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Audit log
    await db.from('audit_logs').insert({
        actor_id: c.get('auth').user.id,
        actor_type: 'super_admin',
        action: 'employee_removed',
        resource_type: 'employee',
        resource_id: employeeId,
    });

    return c.json({ data: { deleted: true } });
});

export default router;
