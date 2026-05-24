// ============================================================
// PERMISSION GUARD — Plan-based feature gating
// Ref: Doc 09 § 2.4 — Permission Guard
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import type { TenantContext } from '../lib/tenant-context';

type AppContext = Context<{ Bindings: Env }>;

type Permission =
    | 'products:read'
    | 'products:write'
    | 'orders:read'
    | 'orders:write'
    | 'analytics:read'
    | 'ai:use'
    | 'settings:write'
    | 'billing:manage'
    | 'blog:write'
    | 'portfolio:write'
    | 'team:manage'
    | 'export:use'
    | 'custom_domain:use'
    | 'app_store:use';

const planPermissions: Record<string, Permission[]> = {
    free: [
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
    ],
    starter: [
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'analytics:read',
        'ai:use',
        'blog:write',
        'portfolio:write',
        'export:use',
    ],
    business: [
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'analytics:read',
        'ai:use',
        'blog:write',
        'portfolio:write',
        'export:use',
        'settings:write',
        'team:manage',
        'custom_domain:use',
        'app_store:use',
    ],
    enterprise: [
        'products:read',
        'products:write',
        'orders:read',
        'orders:write',
        'analytics:read',
        'ai:use',
        'blog:write',
        'portfolio:write',
        'export:use',
        'settings:write',
        'billing:manage',
        'team:manage',
        'custom_domain:use',
        'app_store:use',
    ],
};

function getTenant(c: AppContext): TenantContext | null {
    try {
        return c.get('tenant') as TenantContext | null;
    } catch {
        return null;
    }
}

function permissionMatches(granted: string, required: string): boolean {
    if (granted === '*' || granted === required) return true;
    if (!granted.endsWith(':*')) return false;
    return required.startsWith(granted.slice(0, -1));
}

/**
 * Requires the store's active plan to include ALL specified permissions.
 * Returns 403 with upgrade prompt if any permission is missing.
 *
 * Usage:
 *   router.post('/ai/generate', requirePermission('ai:use'), handler);
 */
export const requirePermission = (...perms: Permission[]) =>
    createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const plan = c.get('plan') || 'free';
        const allowed = planPermissions[plan] || planPermissions.free;
        const tenant = getTenant(c);
        const tenantPermissions = tenant?.permissions || [];

        const missing = perms.filter((p) => (
            !allowed.includes(p) &&
            !tenantPermissions.some((permission) => permissionMatches(permission, p))
        ));

        if (missing.length > 0) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'PLAN_UPGRADE_REQUIRED',
                        message: `Your plan (${plan}) does not include: ${missing.join(', ')}. Upgrade to unlock.`,
                        status: 403,
                        upgrade_url: 'https://admin.letbuyy.store/billing',
                    },
                },
                403
            );
        }

        await next();
    });
