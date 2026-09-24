// ============================================================
// RBAC MIDDLEWARE — Role-based access control
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import {
    INTERNAL_EMPLOYEE_ROLE_DEFAULT_TIERS,
    INTERNAL_PERMISSION_SCOPES,
    INTERNAL_PERMISSION_TIERS,
    type InternalEffectivePermissionScope,
    type InternalPermissionScope,
} from '@letbuyy/shared-types';
import type { RbacRoleCategory } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';

type RbacDb = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

export type SensitiveAction =
    | 'merchant.suspend'
    | 'developer.suspend'
    | 'refund.approve'
    | 'payout.release'
    | 'money.reconciliation.resolve'
    | 'ts.appeal.decide'
    | 'ts.reinstate'
    | 'runtime.control-command';

export interface EmployeePermissionResolutionInput {
    role?: string | null;
    inlinePermissions?: unknown;
    rolePermissionRows?: readonly { permission?: string | null }[];
    employeeRolePermissions?: unknown;
    breakGlassGrants?: readonly {
        id?: string | null;
        scope?: string | null;
        expires_at?: string | null;
        revoked_at?: string | null;
        deleted_at?: string | null;
    }[];
    isSuperAdmin?: boolean;
    now?: Date;
}

export interface EffectivePermissionResolution {
    scopes: InternalEffectivePermissionScope[];
    breakGlassGrantIds: string[];
}

export interface SegregationCheckInput {
    actorId: string;
    targetAction: SensitiveAction;
    originalActorId?: string | null;
    secondaryApproverId?: string | null;
}

export interface SegregationCheckResult {
    ok: boolean;
    code?: 'SOD_REVIEWER_CONFLICT' | 'DUAL_CONTROL_REQUIRED';
    message?: string;
}

function isJsonRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizePermissionScope(value: unknown): InternalEffectivePermissionScope | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '*') return '*';
    return (INTERNAL_PERMISSION_SCOPES as readonly string[]).includes(trimmed)
        ? trimmed as InternalPermissionScope
        : null;
}

function collectJsonPermissionScopes(value: unknown): InternalEffectivePermissionScope[] {
    if (Array.isArray(value)) {
        return value.map(normalizePermissionScope).filter((scope): scope is InternalEffectivePermissionScope => Boolean(scope));
    }

    if (!isJsonRecord(value)) return [];

    const candidates: unknown[] = [];
    if (Array.isArray(value.scopes)) candidates.push(...value.scopes);
    if (Array.isArray(value.permissions)) candidates.push(...value.permissions);

    for (const [key, enabled] of Object.entries(value)) {
        if (enabled === true) candidates.push(key);
    }

    return candidates
        .map(normalizePermissionScope)
        .filter((scope): scope is InternalEffectivePermissionScope => Boolean(scope));
}

function normalizeRole(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
}

function appendRole(target: Set<string>, value: unknown): void {
    const role = normalizeRole(value);
    if (role) target.add(role);
}

function hasAnyRequiredRole(granted: ReadonlySet<string>, required: readonly string[]): boolean {
    return required.map(normalizeRole).some((role) => Boolean(role && granted.has(role)));
}

export function scopeMatches(granted: InternalEffectivePermissionScope, required: InternalPermissionScope): boolean {
    if (granted === '*' || granted === required) return true;
    if (!granted.endsWith(':*')) return false;
    return required.startsWith(granted.slice(0, -1));
}

export function hasPermissionScope(
    grantedScopes: readonly InternalEffectivePermissionScope[],
    requiredScope: InternalPermissionScope,
): boolean {
    return grantedScopes.some((scope) => scopeMatches(scope, requiredScope));
}

export function validateSensitiveReason(reason: unknown): string | null {
    if (typeof reason !== 'string') return null;
    const trimmed = reason.trim();
    return trimmed.length >= 8 && trimmed.length <= 1000 ? trimmed : null;
}

export function resolveEffectivePermissionScopes(input: EmployeePermissionResolutionInput): EffectivePermissionResolution {
    const scopes = new Set<InternalEffectivePermissionScope>();
    const breakGlassGrantIds: string[] = [];
    const now = input.now || new Date();

    if (input.isSuperAdmin) {
        for (const scope of INTERNAL_PERMISSION_TIERS.admin) scopes.add(scope);
    }

    const role = input.role?.trim();
    const tier = role ? INTERNAL_EMPLOYEE_ROLE_DEFAULT_TIERS[role] : undefined;
    if (tier) {
        for (const scope of INTERNAL_PERMISSION_TIERS[tier]) scopes.add(scope);
    }

    for (const row of input.rolePermissionRows || []) {
        const scope = normalizePermissionScope(row.permission);
        if (scope) scopes.add(scope);
    }

    for (const scope of collectJsonPermissionScopes(input.employeeRolePermissions)) {
        scopes.add(scope);
    }

    for (const scope of collectJsonPermissionScopes(input.inlinePermissions)) {
        scopes.add(scope);
    }

    for (const grant of input.breakGlassGrants || []) {
        const scope = normalizePermissionScope(grant.scope);
        const expiresAt = grant.expires_at ? Date.parse(grant.expires_at) : NaN;
        const active = scope
            && Number.isFinite(expiresAt)
            && expiresAt > now.getTime()
            && !grant.revoked_at
            && !grant.deleted_at;

        if (active) {
            scopes.add(scope);
            if (grant.id) breakGlassGrantIds.push(grant.id);
        }
    }

    return {
        scopes: Array.from(scopes).sort(),
        breakGlassGrantIds,
    };
}

export function checkSegregationOfDuty(input: SegregationCheckInput): SegregationCheckResult {
    if (input.targetAction === 'ts.appeal.decide' && input.originalActorId === input.actorId) {
        return {
            ok: false,
            code: 'SOD_REVIEWER_CONFLICT',
            message: 'Appeals must be reviewed by a different operator than the original enforcement reviewer.',
        };
    }

    const requiresDualControl = new Set<SensitiveAction>([
        'merchant.suspend',
        'developer.suspend',
        'refund.approve',
        'payout.release',
        'money.reconciliation.resolve',
        'ts.reinstate',
        'runtime.control-command',
    ]);

    if (requiresDualControl.has(input.targetAction) && (!input.secondaryApproverId || input.secondaryApproverId === input.actorId)) {
        return {
            ok: false,
            code: 'DUAL_CONTROL_REQUIRED',
            message: 'This action requires a second approver distinct from the requesting operator.',
        };
    }

    return { ok: true };
}

async function hasOpsAllowlistEntry(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    email?: string,
): Promise<boolean> {
    const { data: userEntry } = await db
        .from('super_admin_allowlist')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    if (userEntry) return true;
    if (!email) return false;

    const { data: emailEntry } = await db
        .from('super_admin_allowlist')
        .select('id')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

    return Boolean(emailEntry);
}

async function hasPartnerDeveloperEntry(db: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<boolean> {
    const { data } = await db
        .from('app_developers')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['approved'])
        .maybeSingle();

    return Boolean(data);
}

/**
 * The platform's own staff: `employees` rows that belong to NO store.
 *
 * The same table holds every merchant's store staff (store_id → sites.id), written by the merchant's
 * own staff routes, and nothing a merchant writes may count as the platform's. Until APPID-P5b the
 * platform RBAC read this table by user alone, so an active store `editor` held the platform operator
 * tier (merchant:pii, risk:decide), a store `admin` the admin tier, and a store owner could add any
 * scope through the row's permissions JSON. Every operator-side read of `employees` goes through here.
 */
export function platformEmployeeRows(db: RbacDb, columns: string) {
    // `store_id IS NULL` is the predicate that excludes every store's rows, and the tenant query guard
    // counts a filter on a scope column as scoping (tenant-scoped.ts), so this passes it without widening it.
    return db.from('employees').select(columns).filter('store_id', 'is', null).is('deleted_at', null);
}

interface PlatformEmployeeRow {
    id: string;
    user_id: string | null;
    email: string | null;
    role: string | null;
    role_id: string | null;
    permissions: unknown;
    is_active: boolean | null;
    status: string | null;
}

async function activeEmployeeForUser(db: RbacDb, userId: string): Promise<PlatformEmployeeRow | null> {
    const { data, error } = await platformEmployeeRows(db, 'id, user_id, email, role, role_id, permissions, is_active, status')
        .eq('user_id', userId)
        .in('status', ['active'])
        .maybeSingle();

    // Fail closed: a platform employee that cannot be read grants nothing, and says so.
    if (error) throw new Error('Platform employee lookup failed');
    return (data as unknown as PlatformEmployeeRow | null) || null;
}

async function readEmployeeRolePermissions(db: RbacDb, roleId: unknown): Promise<unknown> {
    if (typeof roleId !== 'string' || !roleId) return [];

    const { data } = await db
        .from('employee_roles')
        .select('permissions')
        .eq('id', roleId)
        .maybeSingle();

    return isJsonRecord(data) ? data.permissions : [];
}

export async function loadEffectivePermissionScopes(
    db: RbacDb,
    userId: string,
    email?: string,
): Promise<EffectivePermissionResolution & { employeeId: string | null; isSuperAdmin: boolean }> {
    const [employee, isSuperAdmin] = await Promise.all([
        activeEmployeeForUser(db, userId),
        hasOpsAllowlistEntry(db, userId, email),
    ]);

    if (!employee && !isSuperAdmin) {
        return { scopes: [], breakGlassGrantIds: [], employeeId: null, isSuperAdmin: false };
    }

    const role = typeof employee?.role === 'string' ? employee.role : null;
    const roleId = isJsonRecord(employee) ? employee.role_id : null;
    const employeeId = typeof employee?.id === 'string' ? employee.id : null;
    const now = new Date().toISOString();

    const [rolePermissionRows, employeeRolePermissions, breakGlassGrants] = await Promise.all([
        role
            ? db.from('employee_permissions').select('permission').eq('role', role)
            : Promise.resolve({ data: [], error: null }),
        readEmployeeRolePermissions(db, roleId),
        employeeId
            ? db
                .from('break_glass_grants')
                .select('id, scope, expires_at, revoked_at, deleted_at')
                .eq('employee_id', employeeId)
                .gt('expires_at', now)
                .is('revoked_at', null)
                .is('deleted_at', null)
            : Promise.resolve({ data: [], error: null }),
    ]);

    const resolution = resolveEffectivePermissionScopes({
        role,
        inlinePermissions: isJsonRecord(employee) ? employee.permissions : undefined,
        rolePermissionRows: (rolePermissionRows.data || []) as { permission?: string | null }[],
        employeeRolePermissions,
        breakGlassGrants: (breakGlassGrants.data || []) as EmployeePermissionResolutionInput['breakGlassGrants'],
        isSuperAdmin,
    });

    if (resolution.breakGlassGrantIds.length > 0) {
        await db
            .from('break_glass_grants')
            .update({ used_at: now })
            .in('id', resolution.breakGlassGrantIds)
            .is('used_at', null);
    }

    return { ...resolution, employeeId, isSuperAdmin };
}

export function requirePermission(...requiredScopes: InternalPermissionScope[]) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const auth = c.get('auth');

        if (!auth?.user) {
            return c.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                401
            );
        }

        const resolution = await loadEffectivePermissionScopes(getSupabaseAdmin(c), auth.user.id, auth.user.email);
        const missing = requiredScopes.filter((scope) => !hasPermissionScope(resolution.scopes, scope));

        if (missing.length > 0) {
            return c.json(
                {
                    error: {
                        code: 'PERMISSION_SCOPE_DENIED',
                        message: `Missing required permission scope: ${missing.join(', ')}`,
                    },
                },
                403
            );
        }

        await next();
    });
}

export function requireReason() {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const reason = validateSensitiveReason(c.req.header('X-LetBuyy-Reason'));
        if (!reason) {
            return c.json(
                {
                    error: {
                        code: 'REASON_REQUIRED',
                        message: 'A reason of at least 8 characters is required for this privileged action.',
                    },
                },
                400
            );
        }

        await next();
    });
}

export async function logSensitiveRead(
    c: Context<{ Bindings: Env }>,
    input: {
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason?: string | null;
        metadata?: JsonRecord;
    },
): Promise<void> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    await db.from('audit_logs').insert({
        actor_id: auth?.user?.id || null,
        actor_type: 'employee',
        actor_email: auth?.user?.email || null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason || null,
            audit_kind: 'sensitive_read',
        },
        ip_address: c.req.header('CF-Connecting-IP') || null,
        user_agent: c.req.header('User-Agent') || null,
    });
}

/**
 * Requires the authenticated user to have one of the specified roles.
 * Roles are resolved from server-side persistence, never from JWT metadata.
 */
export function requireRole(...roles: string[]) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const auth = c.get('auth');

        if (!auth?.user) {
            return c.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                401
            );
        }

        const db = getSupabaseAdmin(c);
        const grantedRoles = new Set<string>();

        if (await hasOpsAllowlistEntry(db, auth.user.id, auth.user.email)) {
            grantedRoles.add('super_admin');
            grantedRoles.add('admin');
        }

        const employee = await activeEmployeeForUser(db, auth.user.id);
        appendRole(grantedRoles, employee?.role);

        if (!hasAnyRequiredRole(grantedRoles, roles)) {
            return c.json(
                {
                    error: {
                        code: 'FORBIDDEN',
                        message: `Insufficient permissions. Required: ${roles.join(' or ')}`,
                    },
                },
                403
            );
        }

        await next();
    });
}

/**
 * Requires an authenticated user to belong to one of the LetBuyy role categories.
 * Category checks are the gateway boundary for cross-app RBAC.
 */
export function requireRoleCategory(...categories: RbacRoleCategory[]) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const auth = c.get('auth');

        if (!auth?.user) {
            return c.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                401
            );
        }

        // SECURITY: never trust role claims carried on the JWT for category gating.
        // Supabase user_metadata is writable by the user themselves (auth.updateUser),
        // so a metadata-derived category would be a privilege-escalation path. Category
        // membership is resolved ONLY from server-side persistence (allowlist / approved
        // developer record) below.
        const db = getSupabaseAdmin(c);
        const allowedByPersistence = await Promise.all(categories.map(async (category) => {
            if (category === 'ops') return hasOpsAllowlistEntry(db, auth.user.id, auth.user.email);
            if (category === 'partner') return hasPartnerDeveloperEntry(db, auth.user.id);
            return false;
        }));

        if (!allowedByPersistence.some(Boolean)) {
            return c.json(
                {
                    error: {
                        code: 'FORBIDDEN',
                        message: `Insufficient role category. Required: ${categories.join(' or ')}`,
                    },
                },
                403
            );
        }

        await next();
    });
}

/**
 * Verifies the authenticated user owns the store specified in the request.
 * Checks store_id from body, query, or route param.
 */
export function requireStoreOwner() {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);

        // Try to get store_id from multiple sources
        let storeId: string | null = null;

        // 1. From route param
        storeId = c.req.param('storeId') || null;

        // 2. From query string
        if (!storeId) {
            storeId = c.req.query('store_id') || null;
        }

        // 3. From validated body
        if (!storeId) {
            const body = c.get('validatedBody') as Record<string, unknown> | undefined;
            if (body?.store_id && typeof body.store_id === 'string') {
                storeId = body.store_id;
            }
        }

        if (!storeId) {
            return c.json(
                { error: { code: 'VALIDATION', message: 'store_id is required' } },
                400
            );
        }

        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'You do not own this store' } },
                403
            );
        }

        await next();
    });
}

/**
 * Verifies the authenticated user is a super admin.
 * Replaces the inline `verifySuperAdmin()` function in admin.ts.
 */
export const requireSuperAdmin = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);

        if (!(await hasOpsAllowlistEntry(db, auth.user.id, auth.user.email))) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
                403
            );
        }

        await next();
    }
);
