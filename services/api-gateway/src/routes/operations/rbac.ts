import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    InternalPermissionScopeSchema,
    type InternalPermissionScope,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import {
    loadEffectivePermissionScopes,
    platformEmployeeRows,
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();

const ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['active', 'expired', 'revoked', 'all']).default('active'),
});

const PermissionPatchSchema = z.object({
    scopes: z.array(InternalPermissionScopeSchema).max(100).default([]),
    reason: z.string().trim().min(8).max(1000),
});

const BreakGlassGrantSchema = z.object({
    employee_id: z.string().uuid(),
    scope: InternalPermissionScopeSchema,
    reason: z.string().trim().min(8).max(1000),
    expires_at: z.string().datetime(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const ExpireBreakGlassGrantSchema = z.object({
    reason: z.string().trim().min(8).max(1000),
});

const AccessReviewRecordSchema = z.object({
    reviewer_id: z.string().uuid(),
    period: z.string().trim().regex(/^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$/),
    decisions: z.record(z.string(), z.unknown()).default({}),
    completed_at: z.string().datetime().optional(),
    reason: z.string().trim().min(8).max(1000),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

type Db = ReturnType<typeof getSupabaseAdmin>;
type AppContext = Context<{ Bindings: Env }>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

function actorUserId(c: AppContext): string {
    return c.get('auth').user.id;
}

function actorEmail(c: AppContext): string | null {
    return c.get('auth').user.email || null;
}

function rangeFor(page: number, limit: number) {
    const from = (page - 1) * limit;
    return { from, to: from + limit - 1 };
}

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
}

// Platform employees only: a store's staff row is never an RBAC subject here (APPID-P5b).
async function activeEmployeeIdForUser(db: Db, userId: string): Promise<string | null> {
    const { data, error } = await platformEmployeeRows(db, 'id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw new Error('Platform employee lookup failed');

    const row = data as unknown as { id?: unknown } | null;
    return typeof row?.id === 'string' ? row.id : null;
}

async function writeAudit(
    db: Db,
    input: {
        actorId: string;
        actorEmail: string | null;
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason: string;
        metadata?: Record<string, unknown>;
    },
) {
    await db.from('audit_logs').insert({
        actor_id: input.actorId,
        actor_type: 'employee',
        actor_email: input.actorEmail,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason,
        },
    });
}

async function employeeExists(db: Db, employeeId: string): Promise<boolean> {
    const { data, error } = await platformEmployeeRows(db, 'id')
        .eq('id', employeeId)
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw new Error('Platform employee lookup failed');

    return Boolean(data);
}

router.get('/employees/:employeeId/permissions', requirePermission('rbac:view'), async (c) => {
    const employeeId = c.req.param('employeeId');
    const db = getSupabaseAdmin(c);

    const { data: found, error } = await platformEmployeeRows(db, 'id, user_id, email, role, role_id, permissions, status, is_active')
        .eq('id', employeeId)
        .maybeSingle();

    if (error) throw new Error('Employee permission lookup failed');
    const employee = found as unknown as { id: string; user_id: string | null; email: string | null } | null;
    if (!employee) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } }, 404);
    }

    const effective = typeof employee.user_id === 'string'
        ? await loadEffectivePermissionScopes(db, employee.user_id, typeof employee.email === 'string' ? employee.email : undefined)
        : { scopes: [], breakGlassGrantIds: [], employeeId: employee.id, isSuperAdmin: false };

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.permission.read',
        resourceType: 'employee',
        resourceId: employeeId,
        reason: 'RBAC permission inspection',
        metadata: { target_employee_id: employeeId, audit_kind: 'sensitive_read' },
    });

    return c.json(success({
        employee,
        effective_scopes: effective.scopes,
        break_glass_grant_ids: effective.breakGlassGrantIds,
    }));
});

router.patch('/employees/:employeeId/permissions', requirePermission('rbac:manage'), async (c) => {
    const body = await readJson(c);
    const parsed = PermissionPatchSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid employee permission update payload', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const employeeId = c.req.param('employeeId');
    const db = getSupabaseAdmin(c);
    // A store's staff row is not the platform's to grant scopes on (APPID-P5b): only a row with no store.
    const { data, error } = await db
        .from('employees')
        .update({
            permissions: { scopes: parsed.data.scopes },
        })
        .eq('id', employeeId)
        .filter('store_id', 'is', null)
        .is('deleted_at', null)
        .select('id, user_id, email, role, permissions, status')
        .maybeSingle();

    if (error) throw new Error('Employee permission update failed');
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } }, 404);

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.permission.update',
        resourceType: 'employee',
        resourceId: employeeId,
        reason,
        metadata: { scopes: parsed.data.scopes },
    });

    return c.json(success({ employee: data }));
});

router.get('/break-glass', requirePermission('rbac:view'), async (c) => {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status') || 'active',
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid break-glass list query', parsed.error.flatten());
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    const now = new Date().toISOString();

    let request = db
        .from('break_glass_grants')
        .select('id, employee_id, scope, reason, granted_by, expires_at, used_at, revoked_at, created_at, updated_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (parsed.data.status === 'active') request = request.gt('expires_at', now).is('revoked_at', null);
    if (parsed.data.status === 'expired') request = request.lte('expires_at', now);
    if (parsed.data.status === 'revoked') request = request.not('revoked_at', 'is', null);

    const { data, error, count } = await request;
    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, parsed.data.page, parsed.data.limit));
        }
        throw new Error('Break-glass grant list failed');
    }

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.break_glass.read',
        resourceType: 'break_glass_grant',
        reason: 'Break-glass grant inspection',
        metadata: { status: parsed.data.status, audit_kind: 'sensitive_read' },
    });

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/break-glass', requirePermission('rbac:manage'), async (c) => {
    const body = await readJson(c);
    const parsed = BreakGlassGrantSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid break-glass grant payload', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const expiresAtMs = Date.parse(parsed.data.expires_at);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        return c.json({ error: { code: 'INVALID_EXPIRY', message: 'Break-glass expiry must be in the future.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    if (!(await employeeExists(db, parsed.data.employee_id))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Employee not found or inactive.' } }, 404);
    }

    const grantorEmployeeId = await activeEmployeeIdForUser(db, actorUserId(c));
    if (!grantorEmployeeId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Active employee profile required to grant break-glass access.' } }, 403);
    }

    const { data, error } = await db
        .from('break_glass_grants')
        .insert({
            employee_id: parsed.data.employee_id,
            scope: parsed.data.scope,
            reason,
            granted_by: grantorEmployeeId,
            expires_at: parsed.data.expires_at,
            metadata: parsed.data.metadata,
            created_by: grantorEmployeeId,
            updated_by: grantorEmployeeId,
        })
        .select('id, employee_id, scope, reason, granted_by, expires_at, used_at, revoked_at, created_at')
        .single();

    if (error || !data) throw new Error('Break-glass grant creation failed');

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.break_glass.grant',
        resourceType: 'break_glass_grant',
        resourceId: data.id,
        reason,
        metadata: {
            employee_id: parsed.data.employee_id,
            scope: parsed.data.scope,
            expires_at: parsed.data.expires_at,
        },
    });

    return c.json(success({ grant: data }), 201);
});

router.post('/break-glass/:id/expire', requirePermission('rbac:manage'), async (c) => {
    const body = await readJson(c);
    const parsed = ExpireBreakGlassGrantSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid break-glass expiry payload', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const actorEmployeeId = await activeEmployeeIdForUser(db, actorUserId(c));
    if (!actorEmployeeId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Active employee profile required to expire break-glass access.' } }, 403);
    }

    const now = new Date().toISOString();
    const { data, error } = await db
        .from('break_glass_grants')
        .update({
            revoked_at: now,
            updated_by: actorEmployeeId,
        })
        .eq('id', c.req.param('id'))
        .is('deleted_at', null)
        .select('id, employee_id, scope, reason, granted_by, expires_at, used_at, revoked_at, created_at')
        .single();

    if (error || !data) throw new Error('Break-glass grant expiry failed');

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.break_glass.expire',
        resourceType: 'break_glass_grant',
        resourceId: data.id,
        reason: parsed.data.reason,
        metadata: { scope: data.scope, employee_id: data.employee_id },
    });

    return c.json(success({ grant: data }));
});

router.get('/access-reviews', requirePermission('rbac:view'), async (c) => {
    const parsed = ListQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: 'all',
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid access review list query', parsed.error.flatten());
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    const { data, error, count } = await db
        .from('access_review_records')
        .select('id, reviewer_id, period, decisions, completed_at, metadata, created_at, updated_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, parsed.data.page, parsed.data.limit));
        }
        throw new Error('Access review list failed');
    }

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.access_review.read',
        resourceType: 'access_review_record',
        reason: 'Access review inspection',
        metadata: { audit_kind: 'sensitive_read' },
    });

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/access-reviews', requirePermission('rbac:manage'), async (c) => {
    const body = await readJson(c);
    const parsed = AccessReviewRecordSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid access review record payload', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    if (!(await employeeExists(db, parsed.data.reviewer_id))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Reviewer employee not found or inactive.' } }, 404);
    }

    const actorEmployeeId = await activeEmployeeIdForUser(db, actorUserId(c));
    if (!actorEmployeeId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Active employee profile required to record access reviews.' } }, 403);
    }

    const { data, error } = await db
        .from('access_review_records')
        .insert({
            reviewer_id: parsed.data.reviewer_id,
            period: parsed.data.period,
            decisions: parsed.data.decisions,
            completed_at: parsed.data.completed_at || new Date().toISOString(),
            metadata: parsed.data.metadata,
            created_by: actorEmployeeId,
            updated_by: actorEmployeeId,
        })
        .select('id, reviewer_id, period, decisions, completed_at, metadata, created_at, updated_at')
        .single();

    if (error || !data) throw new Error('Access review record creation failed');

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'rbac.access_review.record',
        resourceType: 'access_review_record',
        resourceId: data.id,
        reason: parsed.data.reason,
        metadata: { period: parsed.data.period, reviewer_id: parsed.data.reviewer_id },
    });

    return c.json(success({ access_review: data }), 201);
});

export default router;
