import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { dnsAnswerMatchesTarget, getCustomDomainCnameTarget } from '../lib/custom-domain-config';
import { resolveDoh } from '../lib/dns';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { readVercelDomainStatus } from '../lib/vercel-domains';
import { timingSafeEqualText } from '../lib/crypto';

const router = new Hono<{ Bindings: Env }>();

type ReconciledStatus = 'verifying' | 'active' | 'error';

interface DomainRow {
    id: string;
    custom_domain: string | null;
    custom_domain_status: string | null;
    custom_domain_verification_token: string | null;
}

function requireInternal(c: Context<{ Bindings: Env }>) {
    const directSecret = c.req.header('X-Internal-API-Secret');
    if (c.env.INTERNAL_API_SECRET && timingSafeEqualText(directSecret, c.env.INTERNAL_API_SECRET)) {
        return null;
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal reconciliation request' } }, 401);
}

function batchLimit(c: Context<{ Bindings: Env }>): number {
    const parsed = Number(c.req.query('limit') || c.env.CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT || 25);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 100) : 25;
}

async function emitDriftAlert(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    domain: string,
    previousStatus: string | null,
    nextStatus: ReconciledStatus,
    reason: string,
): Promise<void> {
    const bucket = new Date().toISOString().slice(0, 13);
    await db.from('platform_queue_jobs').upsert({
        queue_name: 'analytics-events',
        site_id: siteId,
        job_type: 'custom_domain.status_drift',
        status: 'queued',
        payload: {
            event_type: 'custom_domain.status_drift',
            site_id: siteId,
            domain,
            previous_status: previousStatus,
            next_status: nextStatus,
            reason,
        },
        idempotency_key: `custom-domain-drift:${siteId}:${nextStatus}:${bucket}`,
        available_at: new Date().toISOString(),
        request_id: `custom-domain-reconcile:${bucket}`,
        trace_id: `custom-domain-reconcile:${siteId}`,
    }, { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true });
}

async function reconcileDomain(
    c: Context<{ Bindings: Env }>,
    row: DomainRow,
    target: string,
): Promise<{ domain: string; previous_status: string | null; status: ReconciledStatus; changed: boolean; reason: string }> {
    const domain = row.custom_domain || '';
    const txtVerified = row.custom_domain_verification_token
        ? (await resolveDoh(`_letbuyy-challenge.${domain}`, 'TXT').catch(() => []))
            .some((answer) => answer.includes(row.custom_domain_verification_token || ''))
        : true;
    const cnameVerified = (await resolveDoh(domain, 'CNAME').catch(() => []))
        .some((answer) => dnsAnswerMatchesTarget(answer, target));
    const vercel = await readVercelDomainStatus(c.env, domain);

    const nextStatus: ReconciledStatus = !txtVerified
        ? 'verifying'
        : !cnameVerified
            ? 'error'
            : vercel.status === 'active'
                ? 'active'
                : vercel.status === 'error'
                    ? 'error'
                    : 'verifying';
    const reason = !txtVerified
        ? 'TXT_MISSING'
        : !cnameVerified
            ? 'CNAME_DRIFT'
            : vercel.status === 'error'
                ? 'VERCEL_CONFIG_ERROR'
                : vercel.status === 'active'
                    ? 'RECOVERED'
                    : 'VERCEL_PENDING';

    const changed = row.custom_domain_status !== nextStatus;
    if (changed) {
        const db = getSupabaseAdmin(c);
        await db.from('sites').update({ custom_domain_status: nextStatus }).eq('id', row.id);
        await emitDriftAlert(db, row.id, domain, row.custom_domain_status, nextStatus, reason);
    }

    return {
        domain,
        previous_status: row.custom_domain_status,
        status: nextStatus,
        changed,
        reason,
    };
}

router.post('/run', async (c) => {
    const unauthorized = requireInternal(c);
    if (unauthorized) return unauthorized;

    const target = getCustomDomainCnameTarget(c.env);
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('sites')
        .select('id, custom_domain, custom_domain_status, custom_domain_verification_token')
        .in('custom_domain_status', ['active', 'verifying', 'error'])
        .not('custom_domain', 'is', null)
        .is('deleted_at', null)
        .limit(batchLimit(c));

    if (error) throw new Error(`Custom-domain reconcile lookup failed: ${error.message}`);

    const rows = Array.isArray(data) ? data as DomainRow[] : [];
    const results = [];
    for (const row of rows) {
        if (!row.custom_domain) continue;
        results.push(await reconcileDomain(c, row, target));
    }

    return c.json(success({
        checked: results.length,
        changed: results.filter((result) => result.changed).length,
        results,
    }));
});

export default router;
