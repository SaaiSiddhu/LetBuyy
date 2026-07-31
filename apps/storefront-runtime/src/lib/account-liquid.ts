// ============================================================
// ACCOUNT LIQUID RESOLVER — shared server helper for the customer-account routes.
// Resolves the store + render plan + (reused) session so each account page can branch
// Liquid vs React identically. No new auth/session: reuses getSession() verbatim.
// ============================================================

import 'server-only';
import { StoreService } from '@/lib/store-service';
import { getSession } from '@/lib/session';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import type { StoreModel } from '@letbuyy/tenant-core';
import type { StorefrontRenderPlan, StorefrontRouteType } from '@/lib/theme-engine/types';

export interface AccountLiquidResolution {
    store: StoreModel | null;
    plan: StorefrontRenderPlan | null;
    isLiquid: boolean;
    isAuthenticated: boolean;
}

export async function resolveAccountLiquid(
    subdomain: string,
    routeType: StorefrontRouteType,
    templateKey: string,
    routePath: string,
): Promise<AccountLiquidResolution> {
    const [store, session] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        getSession(),
    ]);

    if (!store) {
        return { store: null, plan: null, isLiquid: false, isAuthenticated: false };
    }

    const plan = resolveStorefrontTemplate(store, {
        type: routeType,
        templateKey,
        path: routePath,
        subdomain,
    });

    return {
        store,
        plan,
        isLiquid: plan.rendererEngine === 'liquid',
        isAuthenticated: Boolean(session?.email && session.storeId === store.id),
    };
}
