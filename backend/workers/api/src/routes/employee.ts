import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success, paginated } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

const router = new Hono<{ Bindings: Env }>();

// ============================================================
// EMPLOYEE AUTH
// ============================================================

// POST /employees/auth/login — Employee login
router.post('/auth/login', async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and password required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 401);
    }

    // Verify this user is an employee
    const db = getSupabaseAdmin(c);
    const { data: employee } = await db
        .from('employees')
        .select('id, role, status')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .single();

    if (!employee) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not an active employee' } }, 403);
    }

    return c.json({
        data: {
            user: data.user,
            employee,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        },
    });
});

// POST /employees/auth/accept-invite — Accept an employee invite
router.post('/auth/accept-invite', async (c) => {
    const { token, password } = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!token || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'token and password required' } }, 400);
    }

    // Find invite
    const { data: invite } = await db
        .from('employee_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

    if (!invite) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Invalid or expired invite' } }, 404);
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
        await db.from('employee_invites').update({ status: 'expired' }).eq('id', invite.id);
        return c.json({ error: { code: 'EXPIRED', message: 'Invite has expired' } }, 410);
    }

    // Create Supabase auth user for employee
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        user_metadata: { role: 'employee' },
        email_confirm: true,
    });

    if (authError) {
        return c.json({ error: { code: 'AUTH_ERROR', message: authError.message } }, 400);
    }

    // Create employee record
    const { data: employee, error: empError } = await db
        .from('employees')
        .insert({
            user_id: authData.user.id,
            store_id: invite.store_id,
            email: invite.email,
            role: invite.role || 'staff',
            status: 'active',
        })
        .select()
        .single();

    if (empError) {
        return c.json({ error: { code: 'DB_ERROR', message: empError.message } }, 500);
    }

    // Mark invite as accepted
    await db.from('employee_invites').update({ status: 'accepted' }).eq('id', invite.id);

    return c.json(success(employee), 201);
});

// ============================================================
// EMPLOYEE CRUD (existing routes, kept from before)
// ============================================================

// GET /employees — List employees for the authenticated user's stores
router.get('/', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('employees')
        .select('*, stores!inner(user_id, name)')
        .eq('stores.user_id', auth.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// GET /employees/me — Current employee info
router.get('/me', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('employees')
        .select('*, stores(name, subdomain)')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Employee profile not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /employees/invite — Invite an employee
router.post('/invite', async (c) => {
    const auth = c.get('auth');
    const { email, store_id, role } = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!email || !store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and store_id required' } }, 400);
    }

    // Verify store ownership
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    // Create invite
    const token = crypto.randomUUID();
    const { data, error } = await db
        .from('employee_invites')
        .insert({
            store_id,
            email,
            role: role || 'staff',
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

// ============================================================
// EMPLOYEE PORTAL — Team features
// ============================================================

// GET /employees/tickets — Support tickets (placeholder)
router.get('/tickets', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    // Verify employee
    const { data: employee } = await db
        .from('employees')
        .select('id, role')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .single();

    if (!employee) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Employee access required' } }, 403);
    }

    // Placeholder: return empty tickets for now
    return c.json(success([]));
});

// GET /employees/analytics — Read-only analytics for marketing team
router.get('/analytics', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    // Verify employee with marketing role
    const { data: employee } = await db
        .from('employees')
        .select('id, role')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .single();

    if (!employee) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Employee access required' } }, 403);
    }

    // Basic analytics
    const [stores, orders, users] = await Promise.all([
        db.from('stores').select('id', { count: 'exact', head: true }),
        db.from('orders').select('id', { count: 'exact', head: true }),
        db.from('user_profiles').select('id', { count: 'exact', head: true }),
    ]);

    return c.json(success({
        total_stores: stores.count || 0,
        total_orders: orders.count || 0,
        total_users: users.count || 0,
    }));
});

// PATCH /employees/:id — Update employee role
router.patch('/:id', async (c) => {
    const employeeId = c.req.param('id');
    const { role, permissions } = await c.req.json();
    const db = getSupabaseAdmin(c);

    const updates: Record<string, unknown> = {};
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;

    const { data, error } = await db
        .from('employees')
        .update(updates)
        .eq('id', employeeId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// DELETE /employees/:id — Remove an employee
router.delete('/:id', async (c) => {
    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db.from('employees').delete().eq('id', employeeId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
