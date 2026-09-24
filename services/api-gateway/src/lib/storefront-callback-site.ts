// APPID-P4b — which store a buyer sign-in callback belongs to.
//
// A host → site BOOTSTRAP lookup, the one the storefront itself makes to serve a request
// (routes/internal-store-access.ts), so a callback is accepted exactly where the storefront would serve
// that store: a published site, at its primary host. It meets all four of getSupabaseAdminUnguarded's
// conditions: a host is unique across the platform; no tenant is known until it resolves;
// resolveStorefrontSiteByHost reads one row; and the answer only decides whether a code may be sent to
// that address, while the code itself stays bound to the buyer's session, their choice to continue,
// the exact callback and a PKCE verifier. This file is on the allowlist in
// __tests__/unguarded-admin-client-contract.test.ts, and nothing else here uses the unguarded client.
//
// It lives in its own file, rather than beside the buyer wiring, so the allowlist admits one function
// and not a module full of ordinary tenant queries. The guarded client in a mock was what let the
// route tests pass while the real lookup was refused by the tenant guard; APPID-P4b's local run found it.

import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveStorefrontSiteByHost } from '../middleware/store-context';
import type { RedirectSite } from '../routes/storefront/buyer-authorization-routes';
import { getSupabaseAdmin, getSupabaseAdminUnguarded } from './supabase';

export async function resolveStorefrontCallbackSite(
    c: Context<{ Bindings: Env }>,
    host: string,
): Promise<{ data: RedirectSite | null; error: unknown }> {
    const site = await resolveStorefrontSiteByHost(getSupabaseAdminUnguarded(c), host, c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    // A redirect domain answers the storefront with a 301 to the primary host, so it is no place to
    // finish a sign-in; an unpublished store serves no buyer.
    if (!site || !site.published || (site.matched_domain_role ?? 'primary') !== 'primary') {
        return { data: null, error: null };
    }
    const { data, error } = await getSupabaseAdmin(c).from('sites').select('name').eq('id', site.id).maybeSingle();
    if (error) return { data: null, error };
    return { data: { id: site.id, name: (data?.name as string | null | undefined) ?? null }, error: null };
}
