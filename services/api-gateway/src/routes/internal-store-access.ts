import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    normalizeRequestHost,
    resolveStorefrontHost,
} from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { dbErrorBody, getSupabaseAdmin, success } from '../lib/supabase';
import { verifyInternalAppRequest } from '../lib/internal-auth';
import { resolveStorefrontSiteByHost } from '../middleware/store-context';
import { verifyStoreAccessPassword } from '../lib/store-access-password';
import { checkRateLimitKey } from '../middleware/rateLimit';
import { timingSafeEqualText } from '../lib/crypto';

const router = new Hono<{ Bindings: Env }>();

async function requireStorefrontInternal(c: Context<{ Bindings: Env }>) {
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

    const db = getSupabaseAdmin(c);
    const resolved = await resolveStorefrontSiteByHost(db, host, c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    if (!resolved) {
        const parsed = resolveStorefrontHost(host, c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
        return c.json({ success: false, error: { code: 'STORE_NOT_FOUND', message: 'Store not found' }, host, host_type: parsed.kind }, 404);
    }

    return c.json(success({
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

router.post('/verify', async (c) => {
    const unauthorized = await requireStorefrontInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json().catch(() => null) as {
        site_id?: string;
        host?: string;
        password?: string;
        ip?: string;
    } | null;
    const siteId = body?.site_id;
    const host = normalizeRequestHost(body?.host || c.req.header('Host')) || '';
    const password = body?.password || '';
    if (!siteId || !host || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'site_id, host, and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const ip = body?.ip || c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || null;
    const recentQuery = db
        .from('site_gate_attempts')
        .select('id, ok, ts')
        .eq('site_id', siteId)
        .eq('host', host)
        .gte('ts', new Date(Date.now() - 15 * 60_000).toISOString())
        .order('ts', { ascending: false })
        .limit(20);
    const { data: recentAttempts } = ip ? await recentQuery.eq('ip', ip) : await recentQuery;

    const { data: site, error } = await db
        .from('sites')
        .select('id, access_password_hash, access_mode')
        .eq('id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) return c.json(dbErrorBody(), 500);

    const ok = Boolean(site && site.access_mode === 'password' && await verifyStoreAccessPassword(password, site.access_password_hash));
    const consecutiveFailures = (recentAttempts || []).reduce((count: number, attempt: { ok?: boolean }) => (
        count >= 0 && attempt.ok === true ? -1 : count >= 0 ? count + 1 : count
    ), 0);
    const directLimit = await checkRateLimitKey(c.env, {
        key: `store-gate:${siteId}:${host}:${ip || 'unknown'}`,
        prefix: 'rl:store-gate',
        windowMs: 15 * 60_000,
        max: 30,
    });
    const lockedOut = consecutiveFailures >= 5 || !directLimit.allowed;

    await db.from('site_gate_attempts').insert({
        site_id: siteId,
        ip,
        host,
        ok,
    });

    if (!ok && lockedOut) {
        return c.json({ success: false, error: { code: 'STORE_ACCESS_THROTTLED', message: 'Store access is temporarily unavailable. Try again later.' } }, 429);
    }

    if (!ok) {
        return c.json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Invalid store password' } }, 401);
    }

    return c.json(success({ site_id: siteId, ok: true }));
});

export default router;
