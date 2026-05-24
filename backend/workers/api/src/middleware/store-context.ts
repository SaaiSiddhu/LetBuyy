// ============================================================
// STORE CONTEXT MIDDLEWARE — Resolves store + trial/subscription
// Ref: Doc 09 § 2.3 — Store Context Middleware
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';
import { getRequestId, resolveTenantAccessProfile, type TenantContext } from '../lib/tenant-context';

interface StoreContext {
    id: string;
    user_id: string;
    name: string;
    subdomain: string;
    site_type: string;
    status: string;
    trial_status: string;
    trial_ends_at: string | null;
    plan: string;
    currency: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        store: StoreContext;
        plan: string;
    }
}

/**
 * Resolves the store from route param, query, header, or body.
 * Verifies ownership, checks trial/frozen status, and sets store + plan in context.
 *
 * Usage:
 *   api.use('/stores/:storeId/*', storeContext());
 */
export const storeContext = () =>
    createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);

        // Resolve store ID from multiple sources
        const storeId =
            c.req.param('storeId') ||
            c.req.header('X-Store-ID') ||
            c.req.query('store_id') ||
            null;

        if (!storeId) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'STORE_REQUIRED',
                        message: 'Store ID is required (param, header, or query)',
                        status: 400,
                    },
                },
                400
            );
        }

        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'STORE_NOT_FOUND',
                        message: 'Store not found or access denied',
                        status: 404,
                    },
                },
                404
            );
        }

        const { data: store, error } = await db
            .from('sites')
            .select('*')
            .eq('id', storeId)
            .is('deleted_at', null)
            .single();

        if (error || !store) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'STORE_NOT_FOUND',
                        message: 'Store not found or access denied',
                        status: 404,
                    },
                },
                404
            );
        }

        // Check frozen status
        if (store.trial_status === 'frozen') {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'STORE_FROZEN',
                        message: 'Store is frozen. Please upgrade your plan to continue.',
                        status: 403,
                        upgrade_url: 'https://admin.letbuyy.store/billing',
                    },
                },
                403
            );
        }

        const { data: subscription } = await db
            .from('subscriptions')
            .select('plan')
            .eq('store_id', storeId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const plan = subscription?.plan || 'free';
        const access = await resolveTenantAccessProfile(
            db,
            store.id,
            customUser.id,
            auth.user.role ? [auth.user.role] : ['owner'],
            ['store:owner'],
            plan
        );

        c.set('store', {
            id: store.id,
            user_id: store.user_id,
            name: store.store_name || store.name || '',
            subdomain: store.subdomain,
            site_type: store.site_type,
            status: store.status,
            trial_status: store.trial_status,
            trial_ends_at: store.trial_ends_at,
            plan,
            currency: store.currency || 'INR',
        });
        c.set('plan', plan);
        c.set('tenant', {
            siteId: store.id,
            userId: customUser.id,
            membershipId: access.membershipId,
            roles: access.roles,
            permissions: access.permissions,
            plan: access.plan,
            entitlements: access.entitlements,
            requestId: getRequestId(c),
        } satisfies TenantContext);

        await next();
    });
