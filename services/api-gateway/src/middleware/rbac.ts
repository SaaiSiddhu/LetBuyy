// ============================================================
// RBAC MIDDLEWARE — Role-based access control
// ============================================================

import { createMiddleware } from 'hono/factory';
import {
    hasAnyLetbuyyRoleCategory,
    normalizeLetbuyyRoleAssignments,
    type LetbuyyRoleAssignment,
    type RbacRoleCategory,
} from '@letbuyy/auth-core';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';

type AuthUserWithRoles = {
    id: string;
    role?: string;
    roles?: LetbuyyRoleAssignment[];
};

function getAuthRoleAssignments(authUser: AuthUserWithRoles): LetbuyyRoleAssignment[] {
    if (Array.isArray(authUser.roles) && authUser.roles.length > 0) {
        return authUser.roles;
    }

    return normalizeLetbuyyRoleAssignments(authUser.role);
}

async function hasOpsAllowlistEntry(db: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<boolean> {
    const { data } = await db
        .from('super_admin_allowlist')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    return Boolean(data);
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
 * Requires the authenticated user to have one of the specified roles.
 * Roles are checked from user_metadata set during signup.
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

        const userRole = auth.user.role || 'seller';

        if (!roles.includes(userRole)) {
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

        const assignments = getAuthRoleAssignments(auth.user);
        if (hasAnyLetbuyyRoleCategory(assignments, categories)) {
            await next();
            return;
        }

        const db = getSupabaseAdmin(c);
        const allowedByPersistence = await Promise.all(categories.map(async (category) => {
            if (category === 'ops') return hasOpsAllowlistEntry(db, auth.user.id);
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

        const { data } = await db
            .from('super_admin_allowlist')
            .select('id')
            .eq('user_id', auth.user.id)
            .single();

        if (!data) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
                403
            );
        }

        await next();
    }
);
