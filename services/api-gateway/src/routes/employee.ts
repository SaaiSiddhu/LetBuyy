import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success, paginated } from '../lib/supabase';
import {
    employeeRemovalPatch,
    planEmployeeStaffCreate,
    planEmployeeUpdate,
} from '@letbuyy/auth-core';
import { applyStorePlanTierDefaults, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();

// ============================================================
// STAFF SEAT LIMITS — plan-driven, server-authoritative
// The merchant's plan caps how many staff (employees, excluding the owner) a
// store may have. The limit comes from the plan catalog (or its tier default);
// null means unlimited (e.g. Enterprise). Both the create and invite paths
// enforce this so the UI cap can never be bypassed.
// ============================================================

interface StoreStaffLimit {
    limit: number | null;
    plan_slug: string;
    plan_name: string;
}

async function resolveStoreStaffLimit(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<StoreStaffLimit> {
    const { data: site } = await db
        .from('sites')
        .select('site_type')
        .eq('id', storeId)
        .maybeSingle();
    const siteType = typeof site?.site_type === 'string' && site.site_type ? site.site_type : 'store';

    // Active (or dunning) subscription decides the plan; trial/no-sub falls back to free.
    const { data: sub } = await db
        .from('subscriptions')
        .select('plan')
        .eq('store_id', storeId)
        .in('status', ['active', 'past_due', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const slug = typeof sub?.plan === 'string' && sub.plan ? sub.plan : 'free';

    const { data: planRow } = await db
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    const plan = applyStorePlanTierDefaults(
        (planRow as BillingPlanCatalogRecord) ||
            ({ slug, site_type: siteType, name: slug } as unknown as BillingPlanCatalogRecord),
    );

    return {
        limit: typeof plan.staff_limit === 'number' ? plan.staff_limit : null,
        plan_slug: plan.slug || slug,
        plan_name: plan.name || slug,
    };
}

async function countStoreStaff(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<number> {
    const { count } = await db
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .neq('status', 'removed')
        .is('deleted_at', null);
    return count || 0;
}

/**
 * Returns a 409 body when adding one more staff member would exceed the plan
 * seat limit, or null when there is room. null limit = unlimited.
 */
async function staffSeatExceeded(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<{ limit: number; plan_name: string; used: number } | null> {
    const { limit, plan_name } = await resolveStoreStaffLimit(db, storeId);
    if (limit === null) return null;
    const used = await countStoreStaff(db, storeId);
    if (used < limit) return null;
    return { limit, plan_name, used };
}

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

// Phase-4.5 — traceability for staff lifecycle changes. Best-effort: an audit
// failure must never fail the underlying employee mutation.
async function writeEmployeeAudit(
    c: Context<{ Bindings: Env }>,
    db: ReturnType<typeof getSupabaseAdmin>,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    try {
        const auth = c.get('auth');
        await db.from('audit_logs').insert({
            actor_id: auth?.user?.id || null,
            actor_type: 'merchant',
            actor_email: auth?.user?.email || null,
            action,
            resource_type: 'employee',
            resource_id: resourceId || null,
            metadata,
            ip_address: c.req.header('CF-Connecting-IP') || null,
            user_agent: c.req.header('User-Agent') || null,
        });
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            event: 'employee_audit_failed',
            action,
            message: err instanceof Error ? err.message : String(err),
        }));
    }
}

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
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const createPlan = planEmployeeStaffCreate(body, customUser?.id || '');

    if (!createPlan.ok) {
        return c.json({ error: { code: 'VALIDATION', message: createPlan.message } }, 400);
    }

    if (!customUser || !(await verifySiteOwnership(db, createPlan.value.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    const seatExceeded = await staffSeatExceeded(db, createPlan.value.store_id);
    if (seatExceeded) {
        return c.json({
            error: {
                code: 'STAFF_LIMIT_REACHED',
                message: `Your ${seatExceeded.plan_name} plan includes ${seatExceeded.limit} staff ${seatExceeded.limit === 1 ? 'account' : 'accounts'}. Upgrade your plan to add more staff.`,
                details: { staff_limit: seatExceeded.limit, staff_used: seatExceeded.used },
            },
        }, 409);
    }

    const { data, error } = await db
        .from('employees')
        .insert(createPlan.value)
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

    await writeEmployeeAudit(c, db, 'employee.created', String((data as { id?: string }).id || ''), {
        store_id: createPlan.value.store_id,
    });

    return c.json(success(data), 201);
});

// GET /employees/me — Current employee info.
// Phase N3: structurally unreachable pending a future employee-realm
// design (Phase N2's spike). Migration 208 repointed `employees.user_id`
// to `users_custom(id)` (it referenced `auth.users(id)`, Supabase Auth,
// until then), so the FK is no longer the blocker -- but no write path
// populates `employees.user_id` yet (POST / only sets created_by; the
// column stays NULL until staff-account activation exists). This still
// always 404s today, honestly (no employee row will ever match), not
// silently. Left in place rather than deleted -- not dead code, a route
// awaiting its correct auth wiring per Phase N2's recommended design.
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

// GET /employees/limits — Plan staff seat usage for the merchant admin UI
router.get('/limits', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }
    if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }

    const { limit, plan_slug, plan_name } = await resolveStoreStaffLimit(db, storeId);
    const used = await countStoreStaff(db, storeId);

    return c.json(success({
        staff_limit: limit,
        staff_used: used,
        plan_slug,
        plan_name,
    }));
});

// POST /employees/invite — Staff self-service invite. Phase N3 retired the
// only completion path for an invite (the GoTrue-backed accept-invite
// endpoint and its email link never worked end-to-end -- see the Phase N3
// report). Rather than create an employee_invites row and send an email
// that can never be completed (ANTI-R9: a stub must never read as success),
// this fails closed with an explicit, honest error. Use POST /employees
// (direct staff creation, unaffected by this) to add staff instead.
router.post('/invite', async (c) => {
    return c.json({
        error: {
            code: 'STAFF_INVITE_UNAVAILABLE',
            message: 'Staff self-service invites are not available. Add staff directly instead.',
        },
    }, 503);
});

// ============================================================
// EMPLOYEE PORTAL — Team features
// ============================================================

// GET /employees/tickets — Support tickets
router.get('/tickets', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 25)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Verify employee
    const { data: employee } = await db
        .from('employees')
        .select('id, role, store_id')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .single();

    if (!employee?.store_id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Employee access required' } }, 403);
    }

    // Phase 2 / F2.7: support_tickets is a registered tenant table (scopeColumns: site_id,
    // requester_user_id); this query had neither, so it already 500'd via the tenant guard for
    // every caller ("Tenant table support_tickets requires a tenant/owner predicate before
    // execution") -- silently reported to the caller as a misleading 503 "schema unavailable" by
    // the unconditional catch below. Scoping by the caller's OWN store both fixes that (this
    // endpoint returned no ticket to any employee before this change) and closes what would
    // otherwise become a real cross-tenant leak the moment someone "fixes" the 500 by reaching for
    // an unguarded client instead of a real predicate: without site scoping, ANY active employee of
    // ANY store could read every ticket platform-wide, including buyer privacy requests
    // (buyer-privacy-routes.ts), which are platform-level (site_id IS NULL) and therefore -- as a
    // direct structural consequence of this exact filter, not a special case -- excluded here too:
    // NULL never satisfies `= <a specific site_id>`.
    const { data, error, count } = await db
        .from('support_tickets')
        .select('id, ticket_ref, site_id, requester_email, subject, status, priority, assignee_id, first_response_due_at, resolution_due_at, created_at, updated_at', { count: 'exact' })
        .eq('site_id', employee.store_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        return c.json(
            { error: { code: 'SUPPORT_TICKETS_SCHEMA_UNAVAILABLE', message: 'Support ticket schema is not available in this environment' } },
            503
        );
    }

    return c.json(success({
        available: true,
        tickets: data || [],
        total: count || 0,
        page,
        limit,
    }));
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
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);

    const ownership = await verifyEmployeeOwnership(db, getSupabaseAdminUnguarded(c), employeeId, auth.user);
    if (!ownership) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const plan = planEmployeeUpdate(body);
    if (!plan.ok) {
        return c.json({ error: { code: 'VALIDATION', message: plan.message } }, 400);
    }
    const updates = plan.value;

    const { data, error } = await db
        .from('employees')
        .update(updates)
        .eq('id', employeeId)
        .eq('store_id', ownership.storeId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    await writeEmployeeAudit(c, db, 'employee.updated', employeeId, { updates });

    return c.json(success(data));
});

// DELETE /employees/:id — Remove an employee
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const employeeId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const ownership = await verifyEmployeeOwnership(db, getSupabaseAdminUnguarded(c), employeeId, auth.user);
    if (!ownership) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('employees')
        .update(employeeRemovalPatch(new Date().toISOString()))
        .eq('id', employeeId)
        .eq('store_id', ownership.storeId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    await writeEmployeeAudit(c, db, 'employee.removed', employeeId, {});

    return c.json({ data: { deleted: true } });
});

// Phase 2 / F2.5: returns the employee's store_id (not just a boolean) so PATCH/DELETE can scope
// their own mutation to it. `employees` is a registered tenant table (tenant-tables.registry.ts):
// the tenant guard (tenant-scoped.ts) requires a scopeColumn predicate on any mutation, and
// .eq('id', employeeId) alone does not name one, so the previous boolean-only shape left both
// callers building a bare `.eq('id', employeeId)` update/delete that the guard throws 500 on
// ("Tenant table employees requires a tenant/owner predicate before execution") -- for the owner,
// not just staff. Reproduced live: DELETE /employees/:id 500s for the real owner session.
async function verifyEmployeeOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    unguardedDb: ReturnType<typeof getSupabaseAdminUnguarded>,
    employeeId: string,
    authUser: WorkerAuthUser
): Promise<{ storeId: string } | null> {
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser) return null;

    // Bootstrap lookup by employeeId (a globally-unique PK) before the store_id -- and therefore any
    // tenant scope predicate -- is known. Bounded to one row (.single()), and the result is
    // re-verified via verifySiteOwnership below before it is trusted for anything: matches the
    // documented getSupabaseAdminUnguarded contract (lib/supabase.ts).
    const buildEmployeeQuery = (includeDeletedAtFilter: boolean) => {
        const query = unguardedDb
            .from('employees')
            .select('store_id')
            .eq('id', employeeId);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildEmployeeQuery(true).single();

    if (isMissingEmployeeDeletedAtColumn(error)) {
        ({ data, error } = await buildEmployeeQuery(false).single());
    }

    if (isMissingEmployeeStoreColumn(error)) return null;

    const employee = data as { store_id?: string | null } | null;
    if (!employee?.store_id) return null;
    const owns = await verifySiteOwnership(db, employee.store_id, customUser.id, authUser.storeId);
    return owns ? { storeId: employee.store_id } : null;
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
