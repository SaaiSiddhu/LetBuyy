// Multi-domain helpers (migration 185 `site_domains` + `site_domain_verifications`).
//
// Every site_domains read/write is BEST-EFFORT: if the migration has not been applied
// yet the table is absent, so we swallow the "relation does not exist" error and let the
// caller fall back to the legacy single `sites.custom_domain` column. This keeps the
// Domain Center working pre-migration and lights multi-domain up once 185 is pushed.

import type { getSupabaseAdmin } from './supabase';

type Db = ReturnType<typeof getSupabaseAdmin>;

export type SiteDomainRole = 'primary' | 'redirect';
export type SiteDomainStatus = 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error';

export interface SiteDomainRow {
    id: string;
    site_id: string;
    domain: string;
    role: SiteDomainRole;
    status: SiteDomainStatus;
    ssl_status: string;
    provider: string | null;
    verification_token: string | null;
    redirect_to: string | null;
    last_checked_at: string | null;
    connected_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

const SITE_DOMAINS_COLUMNS =
    'id, site_id, domain, role, status, ssl_status, provider, verification_token, redirect_to, last_checked_at, connected_at, created_at, updated_at';

/** True when the failure is "site_domains/site_domain_verifications table not yet created". */
export function siteDomainsUnavailable(error: { message?: string; code?: string } | null | undefined): boolean {
    if (!error) return false;
    const message = error.message || '';
    return (
        error.code === '42P01' || // undefined_table
        /relation .*(site_domains|site_domain_verifications).* does not exist/i.test(message) ||
        /could not find the table/i.test(message)
    );
}

/** List a store's connected domains (active rows). Returns null if the table is absent. */
export async function listSiteDomains(db: Db, siteId: string): Promise<SiteDomainRow[] | null> {
    const { data, error } = await db
        .from('site_domains')
        .select(SITE_DOMAINS_COLUMNS)
        .eq('purpose', 'storefront')
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('role', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) return siteDomainsUnavailable(error) ? null : Promise.reject(new Error(error.message));
    return (data as SiteDomainRow[]) || [];
}

export async function findSiteDomain(db: Db, siteId: string, domain: string): Promise<SiteDomainRow | null> {
    const { data, error } = await db
        .from('site_domains')
        .select(SITE_DOMAINS_COLUMNS)
        .eq('purpose', 'storefront')
        .eq('site_id', siteId)
        .eq('domain', domain.toLowerCase())
        .is('deleted_at', null)
        .maybeSingle();
    if (error) {
        if (siteDomainsUnavailable(error)) return null;
        throw new Error(error.message);
    }
    return (data as SiteDomainRow | null) || null;
}

/**
 * Insert or update a connected domain. Picks role: the first domain becomes `primary`,
 * later ones default to `redirect`. Best-effort — silently no-ops if the table is absent.
 */
export async function upsertSiteDomain(
    db: Db,
    input: {
        siteId: string;
        domain: string;
        status: SiteDomainStatus;
        verificationToken?: string | null;
        provider?: string | null;
        actorId?: string | null;
    },
): Promise<{ ok: boolean; row?: SiteDomainRow }> {
    const domain = input.domain.toLowerCase();
    const existing = await findSiteDomain(db, input.siteId, domain).catch(() => null);

    if (existing) {
        const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString(), updated_by: input.actorId || null };
        if (input.verificationToken !== undefined) patch.verification_token = input.verificationToken;
        if (input.provider != null) patch.provider = input.provider;
        if (input.status === 'active' && !existing.connected_at) patch.connected_at = new Date().toISOString();
        const { data, error } = await db.from('site_domains').update(patch).eq('id', existing.id).eq('site_id', input.siteId).eq('purpose', 'storefront').select(SITE_DOMAINS_COLUMNS).maybeSingle();
        if (error) return { ok: false };
        return { ok: true, row: (data as SiteDomainRow) || existing };
    }

    // New row: primary if the site has no domains yet, else redirect.
    const list = await listSiteDomains(db, input.siteId);
    if (list === null) return { ok: false }; // table absent
    const role: SiteDomainRole = list.length === 0 ? 'primary' : 'redirect';
    const { data, error } = await db
        .from('site_domains')
        .insert({
            site_id: input.siteId,
            domain,
            role,
            status: input.status,
            verification_token: input.verificationToken ?? null,
            provider: input.provider ?? null,
            created_by: input.actorId || null,
            updated_by: input.actorId || null,
        })
        .select(SITE_DOMAINS_COLUMNS)
        .maybeSingle();
    if (error) return { ok: false };
    return { ok: true, row: (data as SiteDomainRow) || undefined };
}

/** Update status + ssl on a connected domain (best-effort). */
export async function patchSiteDomainStatus(
    db: Db,
    siteId: string,
    domain: string,
    patch: { status?: SiteDomainStatus; ssl_status?: string; provider?: string | null; checkedAt?: string },
): Promise<void> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) update.status = patch.status;
    if (patch.ssl_status) update.ssl_status = patch.ssl_status;
    if (patch.provider != null) update.provider = patch.provider;
    update.last_checked_at = patch.checkedAt || new Date().toISOString();
    if (patch.status === 'active') update.connected_at = new Date().toISOString();
    await db.from('site_domains').update(update).eq('purpose', 'storefront').eq('site_id', siteId).eq('domain', domain.toLowerCase()).then(
        () => undefined,
        () => undefined,
    );
}

export async function softDeleteSiteDomain(db: Db, siteId: string, domain: string, actorId?: string | null): Promise<void> {
    await db
        .from('site_domains')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId || null })
        .eq('purpose', 'storefront')
        .eq('site_id', siteId)
        .eq('domain', domain.toLowerCase())
        .then(() => undefined, () => undefined);
}

/** Append a verification-history row via the SECURITY DEFINER RPC (best-effort). */
export async function recordDomainVerification(
    db: Db,
    input: {
        siteId: string;
        siteDomainId?: string | null;
        domain: string;
        checkType: 'connect' | 'verify' | 'health' | 'set_primary' | 'set_redirect' | 'delete';
        status: string;
        txtVerified?: boolean;
        cnameVerified?: boolean;
        sslActive?: boolean;
        result?: Record<string, unknown>;
        checkedBy?: string | null;
    },
): Promise<void> {
    await db
        .rpc('record_domain_verification', {
            p_site_id: input.siteId,
            p_site_domain_id: input.siteDomainId ?? null,
            p_domain: input.domain.toLowerCase(),
            p_check_type: input.checkType,
            p_status: input.status,
            p_txt_verified: input.txtVerified ?? false,
            p_cname_verified: input.cnameVerified ?? false,
            p_ssl_active: input.sslActive ?? false,
            p_result: input.result ?? {},
            p_checked_by: input.checkedBy ?? null,
        })
        .then(() => undefined, () => undefined);
}

export async function listDomainVerifications(
    db: Db,
    siteId: string,
    domain?: string,
    limit = 25,
): Promise<Array<Record<string, unknown>> | null> {
    let query = db
        .from('site_domain_verifications')
        .select('id, domain, check_type, status, txt_verified, cname_verified, ssl_active, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (domain) query = query.eq('domain', domain.toLowerCase());
    const { data, error } = await query;
    if (error) return siteDomainsUnavailable(error) ? null : null;
    return (data as Array<Record<string, unknown>>) || [];
}
