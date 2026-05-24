import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, success, paginated } from '../lib/supabase';
import {
    createSupabaseAnonClient,
    createSupabaseServiceClient,
} from '@letbuyy/infrastructure/supabase-adapter';

const router = new Hono<{ Bindings: Env }>();

function isMissingColumnError(
    error: { message?: string } | null | undefined,
    tableName: string,
    columnName: string
): boolean {
    return Boolean(
        error?.message?.includes(`${tableName}.${columnName}`) &&
        error.message.includes('does not exist')
    );
}

function isMissingEmployeeStoreColumn(error: { message?: string } | null | undefined): boolean {
    return isMissingColumnError(error, 'employees', 'store_id');
}

function isMissingEmployeeDeletedAtColumn(error: { message?: string } | null | undefined): boolean {
    return isMissingColumnError(error, 'employees', 'deleted_at');
}

function isMissingSitesDeletedAtColumn(error: { message?: string } | null | undefined): boolean {
    return isMissingColumnError(error, 'sites', 'deleted_at');
}

// ============================================================
// EMPLOYEE AUTH
// ============================================================

// POST /employees/auth/login — Employee login
router.post('/auth/login', async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and password required' } }, 400);
    }

    const supabase = createSupabaseAnonClient(c.env);
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
    const supabase = createSupabaseServiceClient(c.env);
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
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    const buildEmployeesQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('employees')
            .select('*')
            .in('store_id', ownedStoreIds)
            .order('created_at', { ascending: false });

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildEmployeesQuery(true);

    if (isMissingEmployeeDeletedAtColumn(error)) {
        ({ data, error } = await buildEmployeesQuery(false));
    }

    if (isMissingEmployeeStoreColumn(error)) {
        return c.json(success([]));
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /employees — Create an invited store staff record from merchant admin
router.post('/', async (c) => {
    const auth = c.get('auth');
    const { email, store_id, role } = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!email || !store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and store_id required' } }, 400);
    }

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data, error } = await db
        .from('employees')
        .insert({
            store_id,
            email: normalizedEmail,
            full_name: normalizedEmail,
            role: role || 'editor',
            status: 'invited',
            is_active: true,
            created_by: customUser.id,
        })
        .select()
        .single();

    if (isMissingEmployeeStoreColumn(error)) {
        return c.json(
            {
                error: {
                    code: 'EMPLOYEE_SCHEMA_MISSING',
                    message: 'Staff invites require store-scoped employee columns before they can be created',
                },
            },
            503
        );
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// GET /employees/me — Current employee info
router.get('/me', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('employees')
        .select('*, sites(store_name, subdomain)')
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
    const customUser = await resolveCustomUser(db, auth.user);

    if (!email || !store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and store_id required' } }, 400);
    }

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
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
            invited_by: customUser.id,
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

// GET /employees/tickets — Support tickets
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

    return c.json(
        { error: { code: 'SUPPORT_TICKETS_UNAVAILABLE', message: 'Support ticket infrastructure is not configured' } },
        501
    );
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
        db.from('sites').select('id', { count: 'exact', head: true }),
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
    const auth = c.get('auth');
    const employeeId = c.req.param('id');
    const { role, permissions } = await c.req.json();
    const db = getSupabaseAdmin(c);

    const ownsEmployee = await verifyEmployeeOwnership(db, employeeId, auth.user);
    if (!ownsEmployee) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

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
    const auth = c.get('auth');
    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const ownsEmployee = await verifyEmployeeOwnership(db, employeeId, auth.user);
    if (!ownsEmployee) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('employees')
        .update({ deleted_at: new Date().toISOString(), status: 'removed', is_active: false })
        .eq('id', employeeId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

async function verifyEmployeeOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    employeeId: string,
    authUser: WorkerAuthUser
) {
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser) return false;

    const buildEmployeeQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('employees')
            .select('store_id')
            .eq('id', employeeId);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildEmployeeQuery(true).single();

    if (isMissingEmployeeDeletedAtColumn(error)) {
        ({ data, error } = await buildEmployeeQuery(false).single());
    }

    if (isMissingEmployeeStoreColumn(error)) return false;

    const employee = data as { store_id?: string | null } | null;
    if (!employee?.store_id) return false;
    return verifySiteOwnership(db, employee.store_id, customUser.id, authUser.storeId);
}

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    const buildOwnedStoresQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select('id')
            .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);

        if (sessionStoreId) query = query.eq('id', sessionStoreId);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildOwnedStoresQuery(true);

    if (isMissingSitesDeletedAtColumn(error)) {
        ({ data, error } = await buildOwnedStoresQuery(false));
    }

    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
