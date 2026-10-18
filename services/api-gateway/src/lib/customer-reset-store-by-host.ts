import type { Context } from 'hono';
import { normalizeRequestHost } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { getSupabaseAdminUnguarded } from './supabase';
import { resolveStorefrontSiteByHost } from '../middleware/store-context';

/**
 * Resolve a storefront host before its tenant is known so a password-reset destination can be
 * checked against the customer being reset. The host lookup is globally unique and bounded to one
 * result by resolveStorefrontSiteByHost; its returned site ID is still compared with the requested
 * store before the URL is trusted. Keep this bootstrap bypass isolated to this single-purpose file.
 */
export async function resolveCustomerResetSiteByHost(
    c: Context<{ Bindings: Env }>,
    host: string,
    storeRootDomain: string | null | undefined,
): Promise<{ id: string } | null> {
    const normalizedHost = normalizeRequestHost(host);
    if (!normalizedHost) return null;

    const site = await resolveStorefrontSiteByHost(
        getSupabaseAdminUnguarded(c),
        normalizedHost,
        storeRootDomain,
    );
    return site ? { id: site.id } : null;
}
