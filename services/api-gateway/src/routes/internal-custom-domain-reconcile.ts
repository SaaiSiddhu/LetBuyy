import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { dnsAnswerMatchesTarget, getCustomDomainCnameTarget } from '../lib/custom-domain-config';
import { resolveDoh } from '../lib/dns';
import { getSupabaseAdmin, readDomainReconcileCandidates, success, type DomainMaintenanceCandidate } from '../lib/supabase';
import { domainReconcileEnvironment } from '@letbuyy/auth-core';
import { AppError } from '../lib/errors';
import { buildDomainEventEnvelope } from '@letbuyy/event-core';
import { readVercelDomainStatus } from '../lib/vercel-domains';
import { timingSafeEqualText } from '../lib/crypto';

const router = new Hono<{ Bindings: Env }>();

type ReconciledStatus = 'verifying' | 'active' | 'error';

type DomainRow = DomainMaintenanceCandidate;
interface ReconcileResult {
    domain: string;
    previous_status: string | null;
    status: ReconciledStatus | null;
    changed: boolean;
    reason: string;
}
// At most3 domains: worst case4 DNS requests +6 Vercel attempts +2 writes each,
// leaving headroom for admission, replay, candidates, cursor and logging under Free50.
const MAX_DOMAINS_PER_INVOCATION = 3;
const CURSOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readCursor(c: Context<{ Bindings: Env }>, key: string): Promise<string | undefined> {
    try { const value = await c.env.CACHE?.get(key); return typeof value === 'string' && CURSOR_UUID.test(value) ? value : undefined; }
    catch { return undefined; }
}

async function saveCursor(c: Context<{ Bindings: Env }>, key: string, value: string): Promise<void> {
    try { await c.env.CACHE?.put(key, value, { expirationTtl: 86400 }); }
    catch { /* A scheduling hint never changes authorization or domain status. */ }
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
    const now = new Date().toISOString();
    const bucket = now.slice(0, 13);
    const eventId = crypto.randomUUID();
    const idempotencyKey = `custom-domain-drift:${siteId}:${domain}:${nextStatus}:${bucket}`;
    const { error } = await db.from('platform_queue_jobs').upsert({
        event_id: eventId,
        queue_name: 'analytics-events',
        site_id: siteId,
        job_type: 'custom_domain.status_drift',
        status: 'queued',
        payload: buildDomainEventEnvelope({
            event_id: eventId, event_type: 'custom_domain.status_drift', site_id: siteId,
            aggregate_type: 'site', aggregate_id: siteId, created_at: now,
            request_id: `custom-domain-reconcile:${bucket}`, trace_id: `custom-domain-reconcile:${siteId}`,
            idempotency_key: idempotencyKey, schema_version: 1,
            payload: { site_id: siteId, domain, previous_status: previousStatus, next_status: nextStatus, reason },
        }),
        idempotency_key: idempotencyKey,
        available_at: new Date().toISOString(),
        request_id: `custom-domain-reconcile:${bucket}`,
        trace_id: `custom-domain-reconcile:${siteId}`,
    }, { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true });
    if (error) throw new AppError('Domain observation could not be queued', 503, 'DOMAIN_RECONCILE_UNAVAILABLE');
}

async function reconcileDomain(
    c: Context<{ Bindings: Env }>,
    row: DomainRow,
    target: string,
): Promise<ReconcileResult> {
    const domain = row.custom_domain || '';
    const txtVerified = row.custom_domain_verification_token
        ? (await resolveDoh(`_letbuyy-challenge.${domain}`, 'TXT', { requireConclusive: true, signal: AbortSignal.timeout(3000) }))
            .some((answer) => answer.includes(row.custom_domain_verification_token || ''))
        : true;
    const cnameVerified = (await resolveDoh(domain, 'CNAME', { requireConclusive: true, signal: AbortSignal.timeout(3000) }))
        .some((answer) => dnsAnswerMatchesTarget(answer, target));
    const vercel = await readVercelDomainStatus(c.env, domain, (input, init) => fetch(input, { ...init, redirect: 'manual' }));

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
        // This is an observed provider drift, not a successful-mutation event. Queue it first:
        // an uncertain write or retry cannot advance the status while silently losing its observation.
        await emitDriftAlert(db, row.id, domain, row.custom_domain_status, nextStatus, reason);
        const { data, error } = await db.from('sites').update({ custom_domain_status: nextStatus })
            .eq('id', row.id).eq('custom_domain', domain).eq('custom_domain_status', row.custom_domain_status)
            .is('deleted_at', null).select('id').maybeSingle();
        if (error) throw new AppError('Domain status could not be saved', 503, 'DOMAIN_RECONCILE_UNAVAILABLE');
        if (!data) return { domain, previous_status: row.custom_domain_status, status: null, changed: false, reason: 'STATE_CHANGED' };
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
    const limit = batchLimit(c);
    const cursorKey = `custom-domain-reconcile:v1:${domainReconcileEnvironment(c.env)}`;
    const afterId = await readCursor(c, cursorKey);
    const rows = await readDomainReconcileCandidates(c, { limit, afterId });
    const results: ReconcileResult[] = [];
    const batch = rows.slice(0, MAX_DOMAINS_PER_INVOCATION);
    for (const row of batch) {
        try { results.push(await reconcileDomain(c, row, target)); }
        catch (error) {
            if (error instanceof AppError) throw error;
            // Provider absence/outage is not proof of drift. Preserve the known state.
            results.push({ domain: row.custom_domain, previous_status: row.custom_domain_status,
                status: null, changed: false, reason: 'PROVIDER_UNAVAILABLE' });
        }
    }
    await saveCursor(c, cursorKey, batch.at(-1)?.id || '');

    return c.json(success({
        checked: results.length,
        changed: results.filter((result) => result.changed).length,
        batch_limit: limit,
        deferred: rows.length > batch.length,
        results,
    }));
});

export default router;
