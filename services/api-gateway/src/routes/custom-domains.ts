import { Hono } from 'hono';
import { z } from 'zod';
import {
    createStorefrontPreviewToken,
    LETBUYY_PREVIEW_MERCHANT_TTL_SECONDS,
    LETBUYY_PREVIEW_SHARE_TTL_SECONDS,
    type StorefrontPreviewScope,
} from '@letbuyy/auth-core';
import {
    isReservedStorefrontLabel,
    normalizeRequestHost,
    normalizeStoreRootDomain,
} from '@letbuyy/tenant-core';
import { DEFAULT_PLATFORM_DOMAIN, StoreAccessModeSchema } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { dnsAnswerMatchesTarget, getCustomDomainCnameTarget } from '../lib/custom-domain-config';
import { screenCustomDomainClaim } from '../lib/custom-domain-abuse';
import { readCustomDomainHealth } from '../lib/custom-domain-health';
import { customDomainCustomerVerification } from '../lib/turnstile-domain';
import { resolveDoh, resolveMxOrNsSnapshot } from '../lib/dns';
import { dbErrorBody, getSupabaseAdmin, success } from '../lib/supabase';
import { requireOwnedSite } from '../lib/tenant-context';
import { storefrontHostBelongsToSite } from '../lib/storefront-visitor-access';
import { AppError } from '../lib/errors';
import { connectedDomainCheckoutPlan, getStoreCheckoutDomainSetup, prepareStoreCheckoutDomain } from '../lib/store-checkout-domain';
import { hashStoreAccessPassword } from '../lib/store-access-password';
import { attachVercelProjectDomain, readVercelDomainStatus, verifyVercelProjectDomain, vercelOwnershipRecords, VercelDomainConfigError } from '../lib/vercel-domains';
import { detectDnsProvider } from '../lib/domain-provider';
import {
    findSiteDomain,
    listDomainVerifications,
    listSiteDomains,
    patchSiteDomainStatus,
    recordDomainVerification,
    softDeleteSiteDomain,
    upsertSiteDomain,
    type SiteDomainStatus,
} from '../lib/site-domains';

const customDomainsRouter = new Hono<{ Bindings: Env }>();
export const storeAccessRouter = new Hono<{ Bindings: Env }>();

const PUBLIC_SUFFIX_LIKE_DOMAINS = new Set([
    'com',
    'net',
    'org',
    'in',
    'co.in',
    'store',
    'app',
    'dev',
    'io',
    'co',
]);

const DomainRequestSchema = z.object({
    site_id: z.string().uuid(),
    domain: z.string().min(3).max(255),
});

const DomainVerifySchema = DomainRequestSchema;

const StoreAccessSchema = z.object({
    site_id: z.string().uuid(),
    access_mode: StoreAccessModeSchema,
    password: z.string().min(4).max(128).optional(),
    access_message: z.string().max(1000).optional().nullable(),
});

const PreviewLinkSchema = z.object({
    site_id: z.string().uuid(),
    scope: z.enum(['merchant-preview', 'share-link']).default('merchant-preview'),
    theme_id: z.string().max(120).optional().nullable(),
    host: z.string().min(3).max(255),
});

function getPreviewSigningKey(env: Env): string {
    const key = env.PREVIEW_SIGNING_KEY;
    if (!key || key.length < 16) {
        throw new Error('PREVIEW_SIGNING_KEY is required for storefront preview links');
    }
    return key;
}

function getOwnZones(env: Env): string[] {
    return [
        normalizeStoreRootDomain(env.NEXT_PUBLIC_STORE_ROOT_DOMAIN),
        normalizeStoreRootDomain(env.STOREFRONT_ROOT_DOMAIN),
        normalizeStoreRootDomain(DEFAULT_PLATFORM_DOMAIN),
        ...(env.PLATFORM_ROOT_DOMAIN?.trim() ? [normalizeStoreRootDomain(env.PLATFORM_ROOT_DOMAIN)] : []),
    ].filter((value, index, values) => value && values.indexOf(value) === index);
}

function normalizeCustomDomain(input: string): string | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        const host = normalizeRequestHost(url.hostname);
        if (!host || host.includes('_')) return null;
        return host;
    } catch {
        return null;
    }
}

function isIpv4(host: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isPublicSuffixLikeDomain(domain: string): boolean {
    if (PUBLIC_SUFFIX_LIKE_DOMAINS.has(domain)) return true;
    const labels = domain.split('.');
    if (labels.length < 2) return true;
    return PUBLIC_SUFFIX_LIKE_DOMAINS.has(labels.slice(-2).join('.')) && labels.length < 3;
}

function validateCustomDomain(domain: string, env: Env): string | null {
    if (domain.length > 244) return 'Domain is too long to provision its secure checkout address';
    if (domain === 'localhost' || domain.endsWith('.localhost') || isIpv4(domain) || domain.startsWith('[')) {
        return 'Infrastructure and local domains are not allowed';
    }

    const labels = domain.split('.');
    if (labels.some((label) => label.length === 0 || label.length > 63)) return 'Domain label length is invalid';
    if (isReservedStorefrontLabel(labels[0])) return 'This hostname is reserved for LetBuyy infrastructure';
    if (isPublicSuffixLikeDomain(domain)) return 'Public suffix domains cannot be claimed';

    for (const zone of getOwnZones(env)) {
        if (domain === zone || domain.endsWith(`.${zone}`)) {
            return 'LetBuyy-owned zones cannot be claimed as custom domains';
        }
    }

    return null;
}

function randomToken(byteCount = 24): string {
    const bytes = new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

customDomainsRouter.get('/checkout-domain', async (c) => {
    const parsed = z.string().uuid().safeParse(c.req.query('site_id'));
    if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: 'A valid site_id is required' } }, 400);
    const { response } = await requireOwnedSite(c, parsed.data);
    if (response) return response;
    c.header('Cache-Control', 'no-store');
    return c.json(success(await getStoreCheckoutDomainSetup(c, parsed.data)));
});

customDomainsRouter.post('/checkout-domain', async (c) => {
    const parsed = z.object({ site_id: z.string().uuid() }).strict().safeParse(await c.req.json().catch(() => null));
    const key = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key');
    if (!parsed.success || !z.string().min(8).max(200).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)).safeParse(key).success)
        return c.json({ error: { code: 'VALIDATION', message: 'A valid site_id and idempotency key are required' } }, 400);
    const { response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;
    c.header('Cache-Control', 'no-store');
    // Exact derived hostname and DB/provider uniqueness are the operation key:
    // a retry cannot create another domain or publish a storefront/theme.
    const setup = await prepareStoreCheckoutDomain(c, parsed.data.site_id, { force: true });
    return c.json(success(setup), setup.status === 'active' ? 200 : 202);
});

customDomainsRouter.post('/domains', async (c) => {
    const parsed = DomainRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid domain request' } }, 400);
    }

    const domain = normalizeCustomDomain(parsed.data.domain);
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const validationError = validateCustomDomain(domain, c.env);
    if (validationError) return c.json({ error: { code: 'INVALID_DOMAIN', message: validationError } }, 400);

    const { db, customUser, response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;
    const cnameTarget = getCustomDomainCnameTarget(c.env);
    const screening = await screenCustomDomainClaim(c.env, domain);

    const { data: existing, error: claimError } = await db
        .from('sites')
        .select('id, custom_domain, custom_domain_verification_token')
        .eq('custom_domain', domain)
        .is('deleted_at', null)
        .maybeSingle();

    if (claimError) throw new AppError('Domain availability could not be checked. Please retry.', 503, 'DOMAIN_CHECK_UNAVAILABLE');

    if (existing && existing.id !== parsed.data.site_id) {
        return c.json({ error: { code: 'DOMAIN_TAKEN', message: 'Domain is already assigned to another store' } }, 409);
    }

    const prior = await findSiteDomain(db, parsed.data.site_id, domain);
    const verificationToken = prior?.verification_token || randomToken();
    if (screening.action === 'reject') {
        await db.from('site_domain_reviews').insert({
            site_id: parsed.data.site_id,
            domain,
            risk_tier: screening.tier,
            status: 'rejected',
            reasons: screening.reasons,
            provider_evidence: screening.providerEvidence,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        });
        return c.json({ error: { code: 'DOMAIN_ABUSE_REJECTED', message: 'Domain requires trust-and-safety rejection before issuance' } }, 422);
    }

    if (screening.action === 'review') {
        await db.from('site_domain_reviews').insert({
            site_id: parsed.data.site_id,
            domain,
            risk_tier: screening.tier,
            status: 'pending',
            reasons: screening.reasons,
            provider_evidence: screening.providerEvidence,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        });
    }

    const apex = domain.split('.').slice(-2).join('.');
    const dnsSnapshot = await resolveMxOrNsSnapshot(apex).catch(() => ({ mx: [], ns: [] }));

    // Multi-domain (migration 185) — best-effort; falls back to sites.custom_domain when absent.
    const provider = detectDnsProvider(dnsSnapshot.ns);
    const connectStatus: SiteDomainStatus = prior?.status === 'active' ? 'active' : screening.action === 'review' ? 'review' : 'pending';
    const saved = await upsertSiteDomain(db, {
        siteId: parsed.data.site_id,
        domain,
        status: connectStatus,
        verificationToken,
        provider,
        actorId: customUser?.id || null,
    });
    if (!saved.ok || !saved.row) throw new AppError('Domain could not be reserved. Reload to check its current status.', 503, 'DOMAIN_RESERVATION_UNAVAILABLE');
    const connectedRow = saved.row;
    // Adding an alias must not replace a different primary domain. Promotion
    // remains the existing explicit, atomic /primary command after verification.
    if (connectedRow.role === 'primary') {
        const sync = await db.from('sites').update({ custom_domain: domain, custom_domain_status: connectStatus,
            custom_domain_verification_token: verificationToken, updated_by: customUser?.id || null }).eq('id', parsed.data.site_id);
        if (sync.error) throw new AppError('Domain setup could not be saved. Please retry.', 503, 'DOMAIN_SYNC_UNAVAILABLE');
    }
    await recordDomainVerification(db, {
        siteId: parsed.data.site_id,
        siteDomainId: connectedRow?.id ?? null,
        domain,
        checkType: 'connect',
        status: connectStatus,
        result: { provider, apex_mx_warning: dnsSnapshot.mx.length > 0 },
        checkedBy: customUser?.id || null,
    });

    return c.json(success({
        domain,
        status: connectStatus,
        role: connectedRow.role,
        provider,
        checkout: await connectedDomainCheckoutPlan(c, parsed.data.site_id, domain),
        records: {
            txt: { name: `_letbuyy-challenge.${domain}`, value: verificationToken },
            cname: { name: domain, value: cnameTarget },
        },
        apex_mx_warning: dnsSnapshot.mx.length > 0,
        dns_snapshot: dnsSnapshot,
        abuse_screening: {
            tier: screening.tier,
            action: screening.action,
            reasons: screening.reasons,
        },
    }), screening.action === 'review' ? 202 : 201);
});

customDomainsRouter.post('/domains/verify', async (c) => {
    const parsed = DomainVerifySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid domain verify request' } }, 400);
    }

    const domain = normalizeCustomDomain(parsed.data.domain);
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const { db, response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;
    const cnameTarget = getCustomDomainCnameTarget(c.env);

    const row = await findSiteDomain(db, parsed.data.site_id, domain);
    if (!row?.verification_token) {
        return c.json({ error: { code: 'DOMAIN_NOT_PENDING', message: 'Domain has no pending ownership challenge' } }, 409);
    }
    const updateStatus = async (status: SiteDomainStatus) => {
        await patchSiteDomainStatus(db, parsed.data.site_id, domain, { status });
        if (row.role === 'primary') {
            const saved = await db.from('sites').update({ custom_domain_status: status }).eq('id', parsed.data.site_id).eq('custom_domain', domain);
            if (saved.error) throw new AppError('Domain status could not be saved.', 503, 'DOMAIN_SYNC_UNAVAILABLE');
        }
    };

    const txtAnswers = await resolveDoh(`_letbuyy-challenge.${domain}`, 'TXT').catch(() => []);
    const txtMatches = txtAnswers.filter((answer) => answer.includes(row.verification_token!));
    if (txtMatches.length < 2) {
        await updateStatus('pending');
        return c.json(success({ domain, status: 'pending', txt_verified: false, reason: 'TXT_NOT_VERIFIED',
            checkout: await connectedDomainCheckoutPlan(c, parsed.data.site_id, domain) }), 202);
    }
    if (row.status === 'review') {
        return c.json(success({ domain, status: 'review', reason: 'TRUST_REVIEW_REQUIRED',
            checkout: await connectedDomainCheckoutPlan(c, parsed.data.site_id, domain) }), 202);
    }

    await updateStatus('verifying');

    const cnameAnswers = await resolveDoh(domain, 'CNAME').catch(() => []);
    const cnameActive = cnameAnswers.some((answer) => dnsAnswerMatchesTarget(answer, cnameTarget));
    if (!cnameActive) {
        return c.json(success({
            domain,
            status: 'verifying',
            txt_verified: true,
            cname_verified: false,
            cname_target: cnameTarget,
            checkout: await connectedDomainCheckoutPlan(c, parsed.data.site_id, domain),
        }));
    }

    try {
        const attached = await attachVercelProjectDomain(c.env, domain);
        if (attached?.verified !== true) {
            try { await verifyVercelProjectDomain(c.env, domain); } catch { /* exact provider TXT instructions remain below until visible */ }
        }
    } catch (error) {
        const status = error instanceof VercelDomainConfigError ? error.status : 503;
        return c.json({
            error: {
                code: error instanceof VercelDomainConfigError ? error.code : 'VERCEL_DOMAIN_ATTACH_FAILED',
                message: 'LetBuyy could not finish connecting this domain. Please retry. If this continues, contact LetBuyy support.',
            },
        }, status as 400 | 401 | 403 | 409 | 429 | 500 | 503);
    }

    const vercel = await readVercelDomainStatus(c.env, domain);
    const binding = vercel.projectDomain;
    const exactBinding = binding?.name === domain && binding.projectId === c.env.VERCEL_STOREFRONT_PROJECT_ID
        && binding.gitBranch == null && binding.customEnvironmentId == null && binding.redirect == null;
    const status = !exactBinding || vercel.status === 'pending' ? 'verifying' : vercel.status;
    await updateStatus(status);

    const verifiedRow = await findSiteDomain(db, parsed.data.site_id, domain).catch(() => null);
    const verifyProvider = await detectLiveProvider(domain).catch(() => null);
    await patchSiteDomainStatus(db, parsed.data.site_id, domain, {
        status: status as SiteDomainStatus,
        ssl_status: status === 'active' ? 'active' : vercel.misconfigured ? 'error' : 'pending',
        provider: verifyProvider,
    });
    const customerVerification = await customDomainCustomerVerification(c.env, parsed.data.site_id, domain, {
        txt_verified: true, cname_verified: cnameActive, ssl_active: status === 'active',
    });
    await recordDomainVerification(db, {
        siteId: parsed.data.site_id,
        siteDomainId: verifiedRow?.id ?? null,
        domain,
        checkType: 'verify',
        status,
        txtVerified: true,
        cnameVerified: cnameActive,
        sslActive: status === 'active',
        result: { vercel: { status: vercel.status, misconfigured: vercel.misconfigured }, customer_verification: customerVerification },
    });

    if (status === 'active' && row.role === 'primary') {
        await prepareStoreCheckoutDomain(c, parsed.data.site_id, { reserveOnly: true });
        c.executionCtx.waitUntil(prepareStoreCheckoutDomain(c, parsed.data.site_id).catch(() => undefined));
    }

    return c.json(success({
        domain,
        status,
        txt_verified: true,
        customer_verification: customerVerification,
        cname_verified: cnameActive,
        cname_target: cnameTarget,
        provider_dns_records: vercelOwnershipRecords(vercel.projectDomain),
        checkout: await connectedDomainCheckoutPlan(c, parsed.data.site_id, domain),
        vercel,
    }));
});

customDomainsRouter.get('/domains/:domain/status', async (c) => {
    const domain = normalizeCustomDomain(c.req.param('domain'));
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const siteId = c.req.query('site_id');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id query parameter is required' } }, 400);
    const { db, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    const ownedDomain = await findSiteDomain(db, siteId, domain);
    if (!ownedDomain) {
        return c.json({ error: { code: 'DOMAIN_NOT_FOUND', message: 'Domain is not connected to this store' } }, 404);
    }

    const [health, customerVerification] = await Promise.all([readCustomDomainHealth(c.env, {
        siteId,
        domain,
        status: ownedDomain.status,
        verificationToken: ownedDomain.verification_token,
    }), customDomainCustomerVerification(c.env, siteId, domain)]);
    health.customer_verification = customerVerification;
    if (ownedDomain.role === 'primary') await db.from('sites').update({ custom_domain_status: health.status }).eq('id', siteId).eq('custom_domain', domain);

    // Multi-domain mirror (best-effort) — provider re-detected live from the apex
    // nameservers (NOT the resolved ALIAS target), so a registrar/NS change (e.g.
    // GoDaddy → Cloudflare) is reflected on every health refresh.
    const provider = await detectLiveProvider(domain).catch(() => null);
    const sslStatus = health.ssl_active
        ? 'active'
        : health.provider_status === 'unavailable'
            ? 'unavailable'
            : health.misconfigured
                ? 'error'
                : 'pending';
    await patchSiteDomainStatus(db, siteId, domain, {
        status: health.status as SiteDomainStatus,
        ssl_status: sslStatus,
        provider,
        checkedAt: health.checked_at,
    });
    const healthRow = await findSiteDomain(db, siteId, domain).catch(() => null);
    await recordDomainVerification(db, {
        siteId,
        siteDomainId: healthRow?.id ?? null,
        domain,
        checkType: 'health',
        status: health.status,
        txtVerified: health.txt_verified,
        cnameVerified: health.cname_verified,
        sslActive: health.ssl_active,
        result: { provider, ssl_status: sslStatus },
    });

    return c.json(success({ ...health, provider, vercel: health.vercel, health }));
});

customDomainsRouter.post('/domain-reviews/:reviewId/decision', async (c) => {
    const token = c.req.header('X-Platform-Console-Token');
    if (!token || !c.env.PLATFORM_CONSOLE_API_TOKEN || token !== c.env.PLATFORM_CONSOLE_API_TOKEN) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Platform review token is required' } }, 401);
    }
    const reviewId = c.req.param('reviewId');
    const body = await c.req.json().catch(() => null) as { decision?: string; notes?: string } | null;
    const decision = body?.decision === 'approve' ? 'approved' : body?.decision === 'deny' ? 'denied' : null;
    if (!decision) return c.json({ error: { code: 'VALIDATION', message: 'decision must be approve or deny' } }, 400);

    const db = getSupabaseAdmin(c);
    const { data: review, error } = await db
        .from('site_domain_reviews')
        .update({
            status: decision,
            decision_notes: body?.notes || null,
            decided_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select('id, site_id, domain, status')
        .single();
    if (error || !review) return c.json(dbErrorBody(), 500);

    await db
        .from('sites')
        .update({ custom_domain_status: decision === 'approved' ? 'pending' : 'error' })
        .eq('id', review.site_id)
        .eq('custom_domain', review.domain);

    return c.json(success({ review }));
});

customDomainsRouter.delete('/domains/:domain', async (c) => {
    const domain = normalizeCustomDomain(c.req.param('domain'));
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);

    const siteId = c.req.query('site_id');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id query parameter is required' } }, 400);

    const { db, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    // Only clears the legacy column when this domain was the synced primary; redirect
    // domains live solely in site_domains and leave sites.custom_domain untouched.
    const { error } = await db
        .from('sites')
        .update({
            custom_domain: null,
            custom_domain_status: 'none',
            custom_domain_verification_token: null,
        })
        .eq('id', siteId)
        .eq('custom_domain', domain);

    if (error) return c.json(dbErrorBody(), 500);

    await softDeleteSiteDomain(db, siteId, domain, null);
    await recordDomainVerification(db, { siteId, domain, checkType: 'delete', status: 'none' });
    return c.json(success({ domain, released: true }));
});

// Re-detect the merchant's DNS host from LIVE nameservers, so a registrar/NS switch
// (e.g. GoDaddy → Cloudflare) is reflected instead of the value cached at connect time.
async function detectLiveProvider(domain: string): Promise<string | null> {
    const apex = domain.split('.').slice(-2).join('.');
    const snapshot = await resolveMxOrNsSnapshot(apex).catch(() => ({ mx: [], ns: [] }));
    return detectDnsProvider(snapshot.ns);
}

// GET /custom/domains?site_id= — list all connected domains (multi-domain).
// Falls back to the legacy single sites.custom_domain when migration 185 is not applied.
// Provider is re-detected from live NS on every list so the overview is never stale.
customDomainsRouter.get('/domains', async (c) => {
    const siteId = c.req.query('site_id');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id query parameter is required' } }, 400);
    const { db, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    // Best-effort: listing must not 500 if the CNAME target env is unset — only the
    // connect/verify flows truly need it (to render DNS records).
    let cnameTarget = '';
    try {
        cnameTarget = getCustomDomainCnameTarget(c.env);
    } catch {
        cnameTarget = '';
    }
    const rows = await listSiteDomains(db, siteId).catch(() => null);

    let source: 'site_domains' | 'legacy';
    let domains: Array<Record<string, unknown>>;
    if (rows && rows.length > 0) {
        source = 'site_domains';
        domains = rows as unknown as Array<Record<string, unknown>>;
    } else {
        const { data: site } = await db
            .from('sites')
            .select('custom_domain, custom_domain_status')
            .eq('id', siteId)
            .maybeSingle();
        source = rows === null ? 'legacy' : 'site_domains';
        domains = site?.custom_domain
            ? [{
                id: null,
                site_id: siteId,
                domain: site.custom_domain,
                role: 'primary',
                status: site.custom_domain_status || 'pending',
                ssl_status: site.custom_domain_status === 'active' ? 'active' : 'unknown',
                provider: null,
                redirect_to: null,
                last_checked_at: null,
                connected_at: null,
            }]
            : [];
    }

    // Live provider re-detection (parallel, best-effort) + persist when it changed.
    const enriched = await Promise.all(domains.map(async (d) => {
        const detected = await detectLiveProvider(String(d.domain)).catch(() => null);
        if (detected && detected !== d.provider && d.id) {
            await db.from('site_domains').update({ provider: detected }).eq('id', d.id as string).then(() => undefined, () => undefined);
        }
        return { ...d, provider: detected ?? d.provider };
    }));

    return c.json(success({ cname_target: cnameTarget, source, domains: enriched }));
});

// POST /custom/domains/:domain/primary — promote an active domain to primary (atomic RPC).
customDomainsRouter.post('/domains/:domain/primary', async (c) => {
    const domain = normalizeCustomDomain(c.req.param('domain'));
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const siteId = c.req.query('site_id') || (await c.req.json().catch(() => null) as { site_id?: string } | null)?.site_id;
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const { db, customUser, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    const { data, error } = await db.rpc('set_primary_site_domain', { p_site_id: siteId, p_domain: domain });
    if (error) {
        const message = error.message || 'Unable to set primary domain';
        return c.json({ error: { code: 'SET_PRIMARY_FAILED', message } }, 503);
    }
    const result = (data as { ok?: boolean; message?: string } | null) || null;
    if (!result?.ok) {
        return c.json({ error: { code: 'SET_PRIMARY_REJECTED', message: result?.message || 'Domain cannot be made primary' } }, 409);
    }
    await recordDomainVerification(db, { siteId, domain, checkType: 'set_primary', status: 'active', checkedBy: customUser?.id || null });
    await prepareStoreCheckoutDomain(c, siteId, { reserveOnly: true });
    c.executionCtx.waitUntil(prepareStoreCheckoutDomain(c, siteId).catch(() => undefined));
    return c.json(success(result));
});

// PATCH /custom/domains/:domain — update a domain's role to redirect (+ optional target).
customDomainsRouter.patch('/domains/:domain', async (c) => {
    const domain = normalizeCustomDomain(c.req.param('domain'));
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const body = await c.req.json().catch(() => null) as { site_id?: string; role?: string; redirect_to?: string } | null;
    const siteId = body?.site_id || c.req.query('site_id');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    if (body?.role && body.role !== 'redirect') {
        return c.json({ error: { code: 'VALIDATION', message: 'Use the /primary route to promote a domain' } }, 400);
    }
    const { db, customUser, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    const existing = await findSiteDomain(db, siteId, domain).catch(() => null);
    if (!existing) return c.json({ error: { code: 'DOMAIN_NOT_FOUND', message: 'Domain is not connected to this store' } }, 404);
    if (existing.role === 'primary') {
        return c.json({ error: { code: 'PRIMARY_IMMUTABLE', message: 'Promote another domain to primary first' } }, 409);
    }
    const redirectTo = typeof body?.redirect_to === 'string' ? normalizeCustomDomain(body.redirect_to) : null;
    const { error } = await db
        .from('site_domains')
        .update({ role: 'redirect', redirect_to: redirectTo, updated_at: new Date().toISOString(), updated_by: customUser?.id || null })
        .eq('id', existing.id);
    if (error) return c.json(dbErrorBody(), 500);
    await recordDomainVerification(db, { siteId, siteDomainId: existing.id, domain, checkType: 'set_redirect', status: existing.status });
    return c.json(success({ domain, role: 'redirect', redirect_to: redirectTo }));
});

// GET /custom/domains/:domain/history?site_id= — verification history for a domain.
customDomainsRouter.get('/domains/:domain/history', async (c) => {
    const domain = normalizeCustomDomain(c.req.param('domain'));
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);
    const siteId = c.req.query('site_id');
    if (!siteId) return c.json({ error: { code: 'VALIDATION', message: 'site_id query parameter is required' } }, 400);
    const { db, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    const events = await listDomainVerifications(db, siteId, domain).catch(() => null);
    return c.json(success({ domain, connected: events !== null, events: events || [] }));
});

storeAccessRouter.get('/', async (c) => {
    const siteId = z.uuid().safeParse(c.req.query('site_id'));
    if (!siteId.success) return c.json({ error: { code: 'VALIDATION', message: 'A valid site_id is required' } }, 400);
    const { db, response } = await requireOwnedSite(c, siteId.data);
    if (response) return response;
    const { data, error } = await db.from('sites').select('access_mode,access_message,access_password_hash,published,status').eq('id', siteId.data).single();
    if (error || !data) return c.json(dbErrorBody(), 503);
    return c.json(success({ access_mode: data.access_mode, access_message: data.access_message,
        has_password: Boolean(data.access_password_hash), published: data.published, status: data.status }));
});

storeAccessRouter.put('/', async (c) => {
    const parsed = StoreAccessSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid store access request' } }, 400);
    }

    const { db, customUser, response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;
    const passwordHash = parsed.data.password && parsed.data.access_mode === 'password'
        ? await hashStoreAccessPassword(parsed.data.password, { signal: c.req.raw.signal }) : null;
    const { data, error } = await db.rpc('set_owned_storefront_access_v1', {
        p_actor: customUser?.id, p_site: parsed.data.site_id, p_bound_site: c.get('auth').user.storeId || null,
        p_mode: parsed.data.access_mode, p_message: parsed.data.access_message || null, p_password_hash: passwordHash,
    });
    if (error?.code === '42501') return c.json({ error: { code: 'STORE_NOT_FOUND', message: 'Store not found or access denied' } }, 404);
    if (error?.code === 'PT400') return c.json({ error: { code: 'PASSWORD_REQUIRED', message: 'Set a password before restricting access.' } }, 400);
    if (error) return c.json(dbErrorBody(), 503);
    return c.json(success(data));

});

storeAccessRouter.post('/preview-links', async (c) => {
    const parsed = PreviewLinkSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid preview link request' } }, 400);
    }

    const { db, customUser, response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;

    const ttl = parsed.data.scope === 'share-link'
        ? LETBUYY_PREVIEW_SHARE_TTL_SECONDS
        : LETBUYY_PREVIEW_MERCHANT_TTL_SECONDS;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = nowSeconds + ttl;
    const jti = randomToken(16);
    const host = normalizeRequestHost(parsed.data.host) || parsed.data.host.toLowerCase();
    const scope = parsed.data.scope as StorefrontPreviewScope;
    // Tenant is already known: keep the guarded client and explicit owned ID.
    // Reuse the visitor verifier's host binding rather than opening an unguarded
    // cross-store bootstrap lookup during an authenticated merchant command.
    const { data: site, error: siteError } = await db.from('sites')
        .select('id,subdomain,custom_domain,custom_domain_status')
        .eq('id', parsed.data.site_id).is('deleted_at', null).maybeSingle();
    if (siteError) throw new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
    if (!site || !(await storefrontHostBelongsToSite(c, host, site))) {
        return c.json({ error: { code: 'PREVIEW_HOST_MISMATCH', message: 'Preview host must belong to this store' } }, 400);
    }
    c.header('Cache-Control', 'no-store');

    const token = await createStorefrontPreviewToken({
        sid: parsed.data.site_id,
        scope,
        theme_id: parsed.data.theme_id || null,
        exp,
        jti,
        host,
    }, getPreviewSigningKey(c.env));

    const { error } = await db.from('site_preview_links').insert({
        site_id: parsed.data.site_id,
        jti,
        scope,
        theme_id: parsed.data.theme_id || null,
        created_by: customUser?.id || null,
        expires_at: new Date(exp * 1000).toISOString(),
    });
    if (error) return c.json(dbErrorBody(), 500);

    return c.json(success({ token, jti, expires_at: new Date(exp * 1000).toISOString(), host }));
});

storeAccessRouter.delete('/preview-links/:jti', async (c) => {
    const siteId = c.req.query('site_id');
    const jti = c.req.param('jti');
    if (!siteId || !jti) return c.json({ error: { code: 'VALIDATION', message: 'site_id and jti are required' } }, 400);

    const { db, response } = await requireOwnedSite(c, siteId);
    if (response) return response;

    const { error } = await db
        .from('site_preview_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('site_id', siteId)
        .eq('jti', jti);
    if (error) return c.json(dbErrorBody(), 500);
    return c.json(success({ jti, revoked: true }));
});

export default customDomainsRouter;
