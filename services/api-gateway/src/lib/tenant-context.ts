import type { Context } from 'hono';
import { z } from 'zod';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../index';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';
import { resolveCustomUser, verifySiteOwnership, type CustomUser, type WorkerAuthUser } from './auth-user';
import { getSupabaseAdmin, getSupabaseAdminUnguarded } from './supabase';
import { SaasExecutionAdapter } from '../execution/saas-execution.adapter';
import {
    TENANT_SITE_GUC,
    requireSiteIdPredicate,
    tenantGucSetLocalStatement,
    type RuntimeTenantContext,
    type TenantGucSetLocalStatement,
    type TenantScopedQueryRequirement,
} from '@letbuyy/tenant-core';
import { withTenantTx, type TenantTxCallback } from './tenant-transaction';

export type TenantContext = RuntimeTenantContext;

type AppContext = Context<{ Bindings: Env }>;

export interface OwnedStoreScope {
    siteId: string;
    storeId: string;
    db: SupabaseClient;
    authUser: WorkerAuthUser;
    customUser: CustomUser;
    tenant: TenantContext;
}

interface MembershipRow {
    id: string;
    role_slugs: string[] | null;
    permissions: string[] | null;
}

interface SiteRoleRow {
    id: string;
    slug: string;
}

interface RolePermissionRow {
    permission: string;
    effect: 'allow' | 'deny';
}

declare module 'hono' {
    interface ContextVariableMap {
        tenant: TenantContext;
    }
}

export function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

export { TENANT_SITE_GUC };

export function tenantSetLocalStatement(siteId: string): TenantGucSetLocalStatement {
    return tenantGucSetLocalStatement(siteId);
}

export function assertTenantScopedQuery(requirement: TenantScopedQueryRequirement): void {
    requireSiteIdPredicate(requirement);
}

export function withResolvedTenantTx<T>(
    c: AppContext,
    tenant: Pick<TenantContext, 'siteId' | 'requestId'>,
    callback: TenantTxCallback<T>,
): Promise<T> {
    return withTenantTx(c.env, tenant, callback);
}

async function loadPlan(db: SupabaseClient, siteId: string): Promise<string> {
    const { data } = await db
        .from('subscriptions')
        .select('plan')
        .eq('store_id', siteId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return (data?.plan as string | undefined) || 'free';
}

function isMissingSaasTable(error: { message?: string } | null | undefined, tableName: string): boolean {
    return Boolean(error?.message?.includes(tableName) && error.message.includes('schema cache'));
}

async function loadMembership(db: SupabaseClient, siteId: string, userId: string): Promise<MembershipRow | null> {
    const { data, error } = await db
        .from('site_memberships')
        .select('id, role_slugs, permissions')
        .eq('site_id', siteId)
        .eq('custom_user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

    if (error) {
        if (isMissingSaasTable(error, 'site_memberships')) return null;
        throw new Error(`Membership lookup failed: ${error.message}`);
    }

    return (data as MembershipRow | null) || null;
}

async function loadRolePermissions(
    db: SupabaseClient,
    siteId: string,
    roleSlugs: string[]
): Promise<string[]> {
    const { data: roles, error: rolesError } = await db
        .from('site_roles')
        .select('id, slug')
        .in('slug', roleSlugs)
        .or(`site_id.is.null,site_id.eq.${siteId}`)
        .is('deleted_at', null);

    if (rolesError) {
        if (isMissingSaasTable(rolesError, 'site_roles')) return [];
        throw new Error(`Role lookup failed: ${rolesError.message}`);
    }

    const scopedRoles = ((roles || []) as SiteRoleRow[]).filter((role) => role.slug && role.id);
    const roleIds = scopedRoles.map((role) => role.id);
    if (roleIds.length === 0) return [];

    const { data: permissions, error: permissionsError } = await db
        .from('site_role_permissions')
        .select('permission, effect')
        .in('role_id', roleIds)
        .is('deleted_at', null);

    if (permissionsError) {
        if (isMissingSaasTable(permissionsError, 'site_role_permissions')) return [];
        throw new Error(`Role permission lookup failed: ${permissionsError.message}`);
    }

    const allowed = new Set<string>();
    const denied = new Set<string>();

    for (const permission of (permissions || []) as RolePermissionRow[]) {
        if (permission.effect === 'deny') {
            denied.add(permission.permission);
        } else {
            allowed.add(permission.permission);
        }
    }

    return [...allowed].filter((permission) => !denied.has(permission));
}

export async function resolveTenantAccessProfile(
    db: SupabaseClient,
    siteId: string,
    userId: string | null,
    fallbackRoles: string[],
    fallbackPermissions: string[],
    fallbackPlan?: string
): Promise<Pick<TenantContext, 'membershipId' | 'roles' | 'permissions' | 'plan' | 'entitlements'>> {
    const membership = userId ? await loadMembership(db, siteId, userId) : null;
    const roles = membership?.role_slugs?.length ? membership.role_slugs : fallbackRoles;
    const rolePermissions = await loadRolePermissions(db, siteId, roles);
    const explicitPermissions = membership?.permissions || fallbackPermissions;
    const permissions = [...new Set([...rolePermissions, ...explicitPermissions])];
    const plan = fallbackPlan || await loadPlan(db, siteId);
    const entitlementSnapshot = await new SaasExecutionAdapter(db).resolveEntitlements(siteId, plan);

    return {
        membershipId: membership?.id || null,
        roles,
        permissions,
        plan: entitlementSnapshot.plan || plan,
        entitlements: {
            features: entitlementSnapshot.features,
            limits: entitlementSnapshot.limits,
            ...entitlementSnapshot.entitlements,
        },
    };
}

async function buildOwnedTenantContext(
    c: AppContext,
    db: SupabaseClient,
    siteId: string,
    customUser: CustomUser,
    authUser: WorkerAuthUser
): Promise<TenantContext> {
    const ownsStore = await verifySiteOwnership(db, siteId, customUser.id, authUser.storeId);
    if (!ownsStore) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const access = await resolveTenantAccessProfile(
        db,
        siteId,
        customUser.id,
        authUser.role ? [authUser.role] : ['owner'],
        ['store:owner']
    );

    const tenant: TenantContext = {
        siteId,
        userId: customUser.id,
        membershipId: access.membershipId,
        roles: access.roles,
        permissions: access.permissions,
        plan: access.plan,
        entitlements: access.entitlements,
        requestId: getRequestId(c),
    };

    c.set('tenant', tenant);
    return tenant;
}

export async function resolveOwnedStoreScope(c: AppContext, siteId: string): Promise<OwnedStoreScope> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    const tenant = await buildOwnedTenantContext(c, db, siteId, customUser, auth.user);
    return {
        siteId,
        storeId: siteId,
        db,
        authUser: auth.user,
        customUser,
        tenant,
    };
}

/** Scope an ID-addressed merchant resource before reading it. Never bootstrap
 * tenant tables with an unscoped resource-ID lookup. Older owner clients may
 * omit selection; their queries remain fenced to their current owned sites. */
export async function resolveMerchantResourceStoreIds(c: AppContext): Promise<string[]> {
    const selected = c.req.header('X-Store-ID') || c.req.query('store_id') || c.get('auth').user.storeId;
    if (selected) {
        const parsed = z.string().uuid().safeParse(selected);
        if (!parsed.success) throw new ValidationError('Choose a valid store before accessing this resource.');
        await resolveOwnedStoreScope(c, parsed.data);
        return [parsed.data];
    }
    const db = getSupabaseAdmin(c);
    const user = await resolveCustomUser(db, c.get('auth').user);
    if (!user) throw new ForbiddenError('User profile not found');
    const { data, error } = await db.from('sites').select('id')
        .eq('custom_user_id', user.id).is('deleted_at', null).limit(100);
    if (error) throw new Error('Owned store scope unavailable');
    return (data || []).map(row => String(row.id));
}

export async function resolveTenantContextForOwnedSite(c: AppContext, siteId: string): Promise<TenantContext> {
    return (await resolveOwnedStoreScope(c, siteId)).tenant;
}

export async function resolveTenantContextForOrder(c: AppContext, orderId: string): Promise<TenantContext> {
    const auth = c.get('auth');
    // A signed session scope wins over an untrusted selection hint. Verify the
    // live owner before using either as a tenant predicate; a hint grants nothing.
    const hint = auth.user.storeId || c.req.header('X-Store-ID')?.trim();
    const knownTenant = hint ? await resolveTenantContextForOwnedSite(c, hint) : null;
    // Without a hint, order.id is a globally unique platform key and the tenant
    // is not yet known. This is the documented four-condition bootstrap: one
    // bounded id/store_id read, followed by live ownership verification. Every
    // subsequent order read/write continues through the default guarded client.
    const db = hint ? getSupabaseAdmin(c) : getSupabaseAdminUnguarded(c);
    let query = db.from('orders').select('id, store_id').eq('id', orderId).is('deleted_at', null);
    if (hint) query = query.eq('store_id', hint);
    const { data: order, error } = await query.maybeSingle();
    if (error) throw new Error('Order scope lookup failed');
    if (!order?.store_id) throw new NotFoundError('Order not found');
    return knownTenant || resolveTenantContextForOwnedSite(c, order.store_id as string);
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * W1 (route-ownership consolidation): canonical replacement for the
 * `requireOwnedSite` definition previously duplicated verbatim in
 * custom-domains.ts and domains.ts. 404 STORE_NOT_FOUND folds "no profile"
 * and "not the owner" into one branch -- do not split it, callers depend on
 * that single shape. This is intentionally lighter than resolveOwnedStoreScope
 * (no membership/role/entitlement resolution, no tenant context side effect)
 * because those two routes never needed that work.
 */
export async function requireOwnedSite(c: AppContext, siteId: string) {
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return { db, customUser: null, response: c.json({ error: { code: 'STORE_NOT_FOUND', message: 'Store not found or access denied' } }, 404) };
    }
    return { db, customUser, response: null };
}

/**
 * W1 (route-ownership consolidation): canonical replacement for the
 * `requireOwnedSite` definition previously duplicated verbatim in
 * app-store/growth-routes.ts. Deliberately a separate export from
 * requireOwnedSite above -- this one distinguishes "no profile" (403) from
 * "no site_id" (400) from "not the owner" (403), and falls back to
 * auth.user.storeId when no site_id is supplied. Do not merge the two: the
 * domain routes must never gain the site_id fallback, and this one must never
 * collapse to a single 404 branch.
 */
export async function requireOwnedSiteOrError(c: AppContext, requestedSiteId?: string | null) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return { ok: false as const, status: 403, error: { code: 'FORBIDDEN', message: 'User profile not found' } };
    }

    const siteId = stringOrNull(requestedSiteId) || stringOrNull(auth.user.storeId);
    if (!siteId) {
        return { ok: false as const, status: 400, error: { code: 'VALIDATION', message: 'site_id is required' } };
    }

    const ownsStore = await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return { ok: false as const, status: 403, error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } };
    }

    return { ok: true as const, db, customUser, siteId };
}

export async function createPublicStorefrontTenantContext(
    c: AppContext,
    siteId: string
): Promise<TenantContext> {
    const db = getSupabaseAdmin(c);
    const access = await resolveTenantAccessProfile(
        db,
        siteId,
        null,
        ['storefront_customer'],
        ['checkout:create']
    );

    const tenant: TenantContext = {
        siteId,
        userId: null,
        membershipId: access.membershipId,
        roles: access.roles,
        permissions: access.permissions,
        plan: access.plan,
        entitlements: access.entitlements,
        requestId: getRequestId(c),
    };

    c.set('tenant', tenant);
    return tenant;
}
