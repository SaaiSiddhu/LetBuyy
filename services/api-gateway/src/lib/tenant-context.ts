import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../index';
import { ForbiddenError, NotFoundError } from './errors';
import { resolveCustomUser, verifySiteOwnership } from './auth-user';
import { getSupabaseAdmin } from './supabase';
import { SaasService } from '../services/saas.service';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';

export type TenantContext = RuntimeTenantContext;

type AppContext = Context<{ Bindings: Env }>;

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
    const entitlementSnapshot = await new SaasService(db).resolveEntitlements(siteId, plan);

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

export async function resolveTenantContextForOwnedSite(c: AppContext, siteId: string): Promise<TenantContext> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    const ownsStore = await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const access = await resolveTenantAccessProfile(
        db,
        siteId,
        customUser.id,
        auth.user.role ? [auth.user.role] : ['owner'],
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

export async function resolveTenantContextForOrder(c: AppContext, orderId: string): Promise<TenantContext> {
    const db = getSupabaseAdmin(c);
    const { data: order } = await db
        .from('orders')
        .select('id, store_id')
        .eq('id', orderId)
        .is('deleted_at', null)
        .maybeSingle();

    if (!order?.store_id) {
        throw new NotFoundError('Order not found');
    }

    return resolveTenantContextForOwnedSite(c, order.store_id as string);
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
