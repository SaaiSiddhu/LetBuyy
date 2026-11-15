import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success, paginated } from '../lib/supabase';
import {
    planEmployeeStaffCreate,
    planEmployeeUpdate,
} from '@letbuyy/auth-core';
import { z } from 'zod';
import { executeStaffMutation, readStaffSeatPolicy } from '../execution/staff-execution.adapter';
import { AppError } from '../lib/errors';
import { createStaffInvitation, previewStaffInvitation, acceptStaffInvitation } from '../execution/staff-invitation-execution.adapter';
import { getRequestId } from '../lib/tenant-context';
import { EmployeeListQuerySchema } from '@letbuyy/shared-types';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

async function mutationBody(c: Context<{ Bindings: Env }>): Promise<Record<string, unknown>> {
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new AppError('A JSON staff request is required.', 400, 'VALIDATION'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('A JSON object staff request is required.', 400, 'VALIDATION');
    return body as Record<string, unknown>;
}
type ActiveEmployeeProfile = { id: string; role: string; store_id?: string; [key: string]: unknown };
async function activeEmployeeProfile(db: ReturnType<typeof getSupabaseAdmin>, user: WorkerAuthUser, columns: string) {
    let query = db.from('employees').select(columns).eq('user_id', user.id)
        .eq('status', 'active').eq('is_active', true).is('deleted_at', null);
    if (user.storeId) query = query.eq('store_id', user.storeId);
    const result = await query.single();
    if (result.error && result.error.code !== 'PGRST116') throw new AppError('Staff state is unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
    return { data: result.data as unknown as ActiveEmployeeProfile | null, error: result.error };
}
function mutationKey(c: Context<{ Bindings: Env }>): string {
    const key = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key') || '';
    if (key.length < 8 || key.length > 200) throw new AppError('A stable staff request key of 8–200 characters is required.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
    return key;
}
function expectedVersion(body: Record<string, unknown>): string {
    const version = z.string().datetime({ offset: true }).safeParse(body.expected_updated_at);
    if (!version.success) throw new AppError('The current staff updated_at is required.', 400, 'STAFF_VERSION_REQUIRED');
    return version.data;
}

async function countStoreStaff(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<number> {
    const { count, error } = await db
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .neq('status', 'removed')
        .is('deleted_at', null);
    if (error || !Number.isSafeInteger(count)) throw new AppError('Staff usage is unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
    return count as number;
}

// ============================================================
// EMPLOYEE CRUD (existing routes, kept from before)
// ============================================================

// GET /employees — List employees for the authenticated user's stores
router.get('/', validate('query', EmployeeListQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id: storeId, page, limit } = c.get('validatedQuery') as z.infer<typeof EmployeeListQuerySchema>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(paginated([], 0, page, limit));
    const from = (page - 1) * limit;
    const { data, error, count } = await db.from('employees')
        .select('*', { count: 'exact' }).in('store_id', ownedStoreIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, from + limit - 1);
    // PostgREST returns 416 for an offset beyond the last row. Confirm the
    // current count under the identical owner/deletion predicates; a missing
    // schema or unknown count must never be normalized into an empty roster.
    if (page > 1 && error?.code === 'PGRST103') {
        const current = await db.from('employees').select('id', { count: 'exact', head: true })
            .in('store_id', ownedStoreIds).is('deleted_at', null);
        if (!current.error && typeof current.count === 'number' &&
            Number.isSafeInteger(current.count) && current.count >= 0 && current.count <= from) {
            return c.json(paginated([], current.count, page, limit));
        }
    }
    if (error || !Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
        data.length !== Math.min(limit, Math.max(0, count - from))) {
        throw new AppError('Staff records are temporarily unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
    }
    return c.json(paginated(data, count, page, limit));
});

// POST /employees — Provision verified staff or retain an unlinked pending record.
router.post('/', async (c) => {
    const auth = c.get('auth');
    const body = await mutationBody(c);
    const key = mutationKey(c);
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const plan = planEmployeeStaffCreate(body, customUser?.id || '');
    if (!plan.ok || !z.string().uuid().safeParse(plan.ok && plan.value.store_id).success) {
        return c.json({ error: { code: 'VALIDATION', message: plan.ok ? 'A valid store_id is required.' : plan.message } }, 400);
    }
    if (!customUser || !(await verifySiteOwnership(db, plan.value.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
    }
    const result = await executeStaffMutation({ db, actor: auth.user, storeId: plan.value.store_id,
        operation: 'create', intent: { email: plan.value.email, full_name: plan.value.full_name,
            role: plan.value.role, permissions: plan.value.permissions }, key, requestId: getRequestId(c) });
    if (result.replayed) c.header('X-Idempotent-Replay', 'true');
    return c.json(result.body, result.status);
});

// GET /employees/me — Only a current active canonical membership can enter.
router.get('/me', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await activeEmployeeProfile(db, auth.user, '*, sites(store_name, subdomain)');

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

    const { limit, plan_slug, plan_name } = await readStaffSeatPolicy(db, auth.user, storeId);
    const used = await countStoreStaff(db, storeId);

    return c.json(success({
        staff_limit: limit,
        staff_used: used,
        plan_slug,
        plan_name,
    }));
});

// Explicit owner invitation; no membership is activated until the invited verified account consents.
router.post('/invite', async (c) => {
    const body=await mutationBody(c),key=mutationKey(c),auth=c.get('auth'),db=getSupabaseAdmin(c);
    const customUser=await resolveCustomUser(db,auth.user),plan=planEmployeeStaffCreate(body,customUser?.id || '');
    if(!plan.ok || !z.string().uuid().safeParse(plan.ok && plan.value.store_id).success) return c.json({error:{code:'VALIDATION',message:plan.ok?'A valid store_id is required.':plan.message}},400);
    if(!customUser || !(await verifySiteOwnership(db,plan.value.store_id,customUser.id,auth.user.storeId))) return c.json({error:{code:'FORBIDDEN',message:'Not authorized for this store'}},403);
    let employeeId: string|undefined,version:string|undefined;
    if(body.employee_id !== undefined) {
        const id=z.string().uuid().safeParse(body.employee_id);if(!id.success)return c.json({error:{code:'VALIDATION',message:'A valid employee_id is required.'}},400);
        employeeId=id.data;version=expectedVersion(body);
    }
    const result=await createStaffInvitation({db,env:c.env,actor:auth.user,storeId:plan.value.store_id,key,
        intent:{email:plan.value.email,full_name:plan.value.full_name,role:plan.value.role,permissions:plan.value.permissions},
        employeeId,expectedUpdatedAt:version,requestId:getRequestId(c)});
    if(result.replayed)c.header('X-Idempotent-Replay','true');return c.json(success(result.data),result.status);
});
router.post('/invitations/preview',async(c)=>{
    const body=await mutationBody(c);const data=await previewStaffInvitation({db:getSupabaseAdmin(c),env:c.env,actor:c.get('auth').user,token:body.token});
    return c.json(success(data));
});
router.post('/auth/accept-invite',async(c)=>{
    const body=await mutationBody(c),key=mutationKey(c);
    const result=await acceptStaffInvitation({db:getSupabaseAdmin(c),env:c.env,actor:c.get('auth').user,token:body.token,key,requestId:getRequestId(c)});
    if(result.replayed)c.header('X-Idempotent-Replay','true');return c.json(success(result.data),result.status);
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
    const { data: employee } = await activeEmployeeProfile(db, auth.user, 'id, role, store_id');

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
    const { data: employee } = await activeEmployeeProfile(db, auth.user, 'id, role');

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

// PATCH /employees/:id — Exact-version role/grant update with a retained retry receipt.
router.patch('/:id', async (c) => {
    const auth = c.get('auth'), employeeId = c.req.param('id');
    const body = await mutationBody(c);
    const key = mutationKey(c), version = expectedVersion(body);
    const db = getSupabaseAdmin(c);
    const ownership = await verifyEmployeeOwnership(db, getSupabaseAdminUnguarded(c), employeeId, auth.user);
    if (!ownership || (body.store_id && body.store_id !== ownership.storeId)) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    const plan = planEmployeeUpdate(body);
    if (!plan.ok) return c.json({ error: { code: 'VALIDATION', message: plan.message } }, 400);
    const result = await executeStaffMutation({ db, actor: auth.user, storeId: ownership.storeId, employeeId,
        operation: 'update', intent: plan.value, key, expectedUpdatedAt: version, requestId: getRequestId(c) });
    if (result.replayed) c.header('X-Idempotent-Replay', 'true');
    return c.json(result.body, result.status);
});

// DELETE /employees/:id — Removal revokes runtime grants in the same audited transaction.
router.delete('/:id', async (c) => {
    const auth = c.get('auth'), employeeId = c.req.param('id');
    const body = await mutationBody(c);
    const key = mutationKey(c), version = expectedVersion(body);
    const db = getSupabaseAdmin(c);
    const ownership = await verifyEmployeeOwnership(db, getSupabaseAdminUnguarded(c), employeeId, auth.user);
    if (!ownership || (body.store_id && body.store_id !== ownership.storeId)) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    const result = await executeStaffMutation({ db, actor: auth.user, storeId: ownership.storeId, employeeId,
        operation: 'remove', intent: {}, key, expectedUpdatedAt: version, requestId: getRequestId(c) });
    if (result.replayed) c.header('X-Idempotent-Replay', 'true');
    return c.json(result.body, result.status);
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
    // Retain removed rows for authorized lost-removal-reply recovery; the SQL
    // transaction distinguishes an exact receipt replay from a new stale write.
    const { data, error } = await unguardedDb.from('employees').select('store_id').eq('id', employeeId).single();
    if (error && error.code !== 'PGRST116') throw new AppError('Staff state is unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');

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
    const ids: string[] = [];
    let total: number | undefined;
    for (let page = 0; page < 10000; page++) {
        let query = db
            .from('sites')
            .select('id', { count: 'exact' })
            .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);
        if (sessionStoreId) query = query.eq('id', sessionStoreId);
        const { data, error, count } = await query.is('deleted_at', null)
            .order('id', { ascending: true }).range(page * 50, page * 50 + 49);
        if (error || !Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
            total !== undefined && count !== total ||
            data.length !== Math.min(50, Math.max(0, count - page * 50))) {
            throw new AppError('Staff ownership is temporarily unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
        }
        total = count;
        ids.push(...data.map(store => store.id as string));
        if (ids.length === total) return ids;
    }
    throw new AppError('Staff ownership is temporarily unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
}

export default router;
