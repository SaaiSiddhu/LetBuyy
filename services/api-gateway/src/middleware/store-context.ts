// ============================================================
// STORE CONTEXT MIDDLEWARE — Resolves store + trial/subscription
// Ref: Doc 09 § 2.3 — Store Context Middleware
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { resolveStorefrontHost } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { AppError } from '../lib/errors';
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
    custom_domain?: string | null;
    custom_domain_status?: string | null;
    access_mode?: string | null;
    access_message?: string | null;
    published?: boolean | null;
}

export interface StorefrontHostSiteContext {
    id: string;
    // The store's display name: public, and what identity-platform shows a buyer who is signing in.
    name?: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    custom_domain_status: string | null;
    access_mode: string | null;
    access_message: string | null;
    published: boolean | null;
    status: string | null;
    // Multi-domain (migration 185): set when the host matched a site_domains row
    // (rather than the legacy sites.custom_domain primary).
    matched_domain_role?: 'primary' | 'redirect' | null;
    matched_redirect_to?: string | null;
}

declare module 'hono' {
    interface ContextVariableMap {
        store: StoreContext;
        plan: string;
    }
}

function billingUpgradeUrl(env: Env): string {
    const rawDomain = env.NEXT_PUBLIC_PLATFORM_DOMAIN || env.LETBUYY_PLATFORM_DOMAIN || env.PLATFORM_ROOT_DOMAIN || 'letbuyy.com';
    const domain = rawDomain
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '') || 'letbuyy.com';
    const base = (env.NEXT_PUBLIC_ADMIN_URL || `https://admin.${domain}`).replace(/\/+$/, '');
    return `${base}/billing`;
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
                        upgrade_url: billingUpgradeUrl(c.env),
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
            custom_domain: store.custom_domain || null,
            custom_domain_status: store.custom_domain_status || 'none',
            access_mode: store.access_mode || 'public',
            access_message: store.access_message || null,
            published: Boolean(store.published),
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

export async function resolveStorefrontSiteByHost(
    db: SupabaseClient,
    host: string,
    storeRootDomain: string | null | undefined,
): Promise<StorefrontHostSiteContext | null> {
    const parsed = resolveStorefrontHost(host, storeRootDomain);
    const select = 'id, name, subdomain, custom_domain, custom_domain_status, access_mode, access_message, published, status';

    if (parsed.kind === 'subdomain') {
        const { data, error } = await db
            .from('sites')
            .select(select)
            .eq('subdomain', parsed.subdomain)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
        return (data as StorefrontHostSiteContext | null) || null;
    }

    if (parsed.kind === 'custom_domain') {
        const { data, error } = await db
            .from('sites')
            .select(select)
            .eq('custom_domain', parsed.domain)
            .eq('custom_domain_status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
        if (data) return data as StorefrontHostSiteContext;

        // Multi-domain (185): match a connected secondary/redirect domain. supabase-js
        // reports a missing legacy table as an error. Only that recognized schema
        // absence is compatible; outages/permission/schema errors are unavailable.
        const { data: sd, error: aliasError } = await db
            .from('site_domains')
            .select('site_id, role, redirect_to, status')
            .eq('domain', parsed.domain)
            .eq('purpose', 'storefront')
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (aliasError) {
            if (['42P01', 'PGRST205'].includes(aliasError.code)) return null;
            throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
        }
        if (sd?.site_id) {
            const { data: site, error: siteError } = await db
                .from('sites')
                .select(select)
                .eq('id', sd.site_id)
                .is('deleted_at', null)
                .maybeSingle();
            if (siteError) throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
            if (site) {
                return {
                    ...(site as StorefrontHostSiteContext),
                    matched_domain_role: sd.role as 'primary' | 'redirect',
                    matched_redirect_to: (sd.redirect_to as string | null) ?? null,
                };
            }
        }
        return null;
    }

    return null;
}
