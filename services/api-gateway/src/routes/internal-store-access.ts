import {loadVisitorSite,visitorGrants,storefrontHostBelongsToSite} from '../lib/storefront-visitor-access';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import type { Context } from 'hono';
import {
    normalizeRequestHost,
    resolveStorefrontHost,
} from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success } from '../lib/supabase';
import { verifyInternalAppRequest } from '../lib/internal-auth';
import { hasBoundStorefrontRequest } from '../lib/storefront-internal-request';
import { resolveStorefrontSiteByHost } from '../middleware/store-context';
import { verifyStoreAccessPassword } from '../lib/store-access-password';
import { checkRateLimitKey } from '../middleware/rateLimit';
import { timingSafeEqualText,sha256Hex } from '../lib/crypto';

const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });

async function requireStorefrontInternal(c: Context<{ Bindings: Env }>) {
    if (c.env.STOREFRONT_INTERNAL_PERIMETER?.trim()) {
        return c.env.STOREFRONT_INTERNAL_PERIMETER?.trim() === 'bound-request-v1' && hasBoundStorefrontRequest(c)
            ? null : c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid storefront internal request' } }, 401);
    }

    const directSecret = c.req.header('X-Internal-API-Secret');
    if (c.env.INTERNAL_API_SECRET && timingSafeEqualText(directSecret, c.env.INTERNAL_API_SECRET)) {
        return null;
    }

    if (await verifyInternalAppRequest(c, 'storefront')) {
        return null;
    }

    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid storefront internal request' } }, 401);
}

router.get('/resolve', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const host = normalizeRequestHost(c.req.query('host') || c.req.header('Host'));
    if (!host) return c.json({ error: { code: 'HOST_REQUIRED', message: 'host is required' } }, 400);

    // Bootstrap lookup: the tenant is not known until the host resolves to one, so a
    // scope predicate cannot be supplied. Matches getSupabaseAdminUnguarded's documented
    // purpose exactly (resolve by a globally-unique key before the tenant is known); the
    // result is public routing metadata only, never trusted as authorization by itself.
    const db = getSupabaseAdminUnguarded(c);
    const resolved = await resolveStorefrontSiteByHost(db, host, c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    if (!resolved) {
        const parsed = resolveStorefrontHost(host, c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
        return c.json({ success: false, error: { code: 'STORE_NOT_FOUND', message: 'Store not found' }, host, host_type: parsed.kind }, 404);
    }

    const accessSite=(resolved.access_mode==='password'&&c.req.header('X-LetBuyy-Storefront-Gate')?await loadVisitorSite(c,{id:resolved.id}):null)||{...resolved,status:resolved.status||'draft',access_revision:null};
    const grants=await visitorGrants(c,accessSite);
    c.header('Cache-Control','no-store');
    return c.json(success({
        access_revision:accessSite.access_revision||null,
        visitor_access:grants,
        host,
        site_id: resolved.id,
        subdomain: resolved.subdomain,
        custom_domain: resolved.custom_domain,
        custom_domain_status: resolved.custom_domain_status || 'none',
        access_mode: resolved.access_mode || 'public',
        access_message: resolved.access_message || null,
        published: Boolean(resolved.published),
        status: resolved.status || 'draft',
        matched_domain_role: resolved.matched_domain_role || 'primary',
        redirect_to: resolved.matched_redirect_to || null,
    }));
});

const VerifyPasswordSchema = z.object({
    site_id: z.string().uuid(),
    host: z.string().min(1).max(300).optional(),
    password: z.string().min(1).max(128),
    ip: z.union([z.ipv4(), z.ipv6()]).nullish(),
});
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const unavailable = () => new AppError('Store access is unavailable', 503, 'STOREFRONT_ACCESS_UNAVAILABLE');
function canonicalIp(value: string): string {
    return value.includes(':') ? new URL(`http://[${value}]`).hostname.slice(1, -1) : value;
}

router.post('/verify', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const parsed = VerifyPasswordSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: 'Valid site_id, host, password and client address are required' } }, 400);
    const siteId = parsed.data.site_id.toLowerCase();
    const host = normalizeRequestHost(parsed.data.host || c.req.header('Host')) || '';
    const address = parsed.data.ip || c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
    if (!host || !address || !z.union([z.ipv4(), z.ipv6()]).safeParse(address).success) {
        return c.json({ error: { code: 'VALIDATION', message: 'A valid store host and client address are required' } }, 400);
    }
    const ip = canonicalIp(address);
    const denied = (resetAt: number) => {
        c.header('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
        return c.json({ success: false, error: { code: 'STORE_ACCESS_THROTTLED', message: 'Store access is temporarily unavailable. Try again later.' } }, 429);
    };

    // Reserve on the existing atomic backend before DB/hash work. Correct
    // credentials cannot bypass a closed quota; missing admission is unavailable.
    const directLimit = await checkRateLimitKey(c.env, {
        key: `store-gate:${siteId}:${host}:${ip}`,
        prefix: 'rl:store-gate', windowMs: ATTEMPT_WINDOW_MS, max: 30,
    });
    if (directLimit.unavailable) { c.header('Retry-After', '1'); throw unavailable(); }
    if (!directLimit.allowed) return denied(directLimit.resetAt);

    const db = getSupabaseAdmin(c);
    const { data: recentAttempts, error: historyError } = await db.from('site_gate_attempts')
        .select('id, ok, ts').eq('site_id', siteId).eq('host', host).eq('ip', ip)
        .is('deleted_at', null).gte('ts', new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString())
        .order('ts', { ascending: false }).limit(20);
    if (historyError) throw unavailable();
    let failures = 0;
    for (const attempt of recentAttempts || []) { if (attempt.ok) break; failures++; }
    if (failures >= 5) return denied(new Date(recentAttempts![0].ts).getTime() + ATTEMPT_WINDOW_MS);

    const { data: site, error } = await db.from('sites')
        .select('id, subdomain, custom_domain, custom_domain_status, access_password_hash, access_mode')
        .eq('id', siteId).is('deleted_at', null).maybeSingle();
    if (error) throw unavailable();
    if (!site || site.access_mode !== 'password' || !(await storefrontHostBelongsToSite(c, host, site))) {
        return c.json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Invalid store password' } }, 401);
    }
    if (!site.access_password_hash) throw unavailable();

    const ok = await verifyStoreAccessPassword(parsed.data.password, site.access_password_hash, { signal: c.req.raw.signal });
    // A valid-password grant is not acknowledged until its required attempt
    // record persists. An unavailable writer is never treated as success.
    const { error: writeError } = await db.from('site_gate_attempts').insert({ site_id: siteId, ip, host, ok });
    if (writeError) throw unavailable();
    if (!ok) return c.json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Invalid store password' } }, 401);
    return c.json(success({ site_id: siteId, ok: true, access_revision: await sha256Hex(site.access_password_hash) }));
});

export default router;
