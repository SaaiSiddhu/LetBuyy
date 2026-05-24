import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { ValidationError } from '../lib/errors';
import { getRequestId } from '../lib/tenant-context';
import { requireSuperAdmin } from '../middleware/rbac';
import { OutboxService } from '../services/outbox.service';
import {
    ConsumeQueueJobsSchema,
    CreateWebhookSubscriptionSchema,
    DispatchOutboxSchema,
    DispatchWebhookDeliveriesSchema,
    OperationsListQuerySchema,
    RecordUsageSchema,
    UpdateWebhookSubscriptionSchema,
    type DispatchOutboxInput,
    type DispatchWebhookDeliveriesInput,
    type OperationsListQuery,
} from '../schemas/operations.schema';
import { SaasService } from '../services/saas.service';
import { QueueService } from '../services/queue.service';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

router.use('*', requireSuperAdmin);

function dispatcherId(prefix: string): string {
    return `${prefix}:${crypto.randomUUID()}`;
}

async function readOptionalJson<T>(c: AppContext, fallback: T): Promise<T> {
    const contentType = c.req.header('content-type');
    if (!contentType?.includes('application/json')) return fallback;

    try {
        return (await c.req.json()) as T;
    } catch {
        return fallback;
    }
}

function parseListQuery(c: AppContext): OperationsListQuery {
    const parsed = OperationsListQuerySchema.safeParse({
        status: c.req.query('status') || undefined,
        site_id: c.req.query('site_id') || undefined,
        queue_name: c.req.query('queue_name') || undefined,
        limit: c.req.query('limit') || undefined,
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid operations list query', parsed.error.flatten());
    }

    return parsed.data;
}

router.post('/outbox/dispatch', async (c) => {
    const body = await readOptionalJson<DispatchOutboxInput>(c, {});
    const parsed = DispatchOutboxSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid outbox dispatch request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const service = new OutboxService(db);
    const result = await service.dispatchBatch({
        dispatcherId: dispatcherId('manual-outbox'),
        outboxLimit: parsed.data.limit,
        webhookLimit: parsed.data.webhook_limit,
    });

    return c.json(success(result));
});

router.post('/webhook-deliveries/dispatch', async (c) => {
    const body = await readOptionalJson<DispatchWebhookDeliveriesInput>(c, {});
    const parsed = DispatchWebhookDeliveriesSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid webhook delivery dispatch request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const service = new OutboxService(db);
    const result = await service.dispatchWebhookDeliveries(
        dispatcherId('manual-webhooks'),
        parsed.data.limit || 25
    );

    return c.json(success(result));
});

router.get('/outbox', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('outbox_events')
        .select(
            'id, site_id, store_id, event_id, aggregate_type, aggregate_id, event_type, status, attempts, max_attempts, available_at, next_attempt_at, locked_by, processed_at, dead_lettered_at, error_message, request_id, trace_id, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error } = await request;
    if (error) throw new Error(`Outbox list failed: ${error.message}`);

    return c.json(success({ events: data || [] }));
});

router.get('/outbox/dead-letters', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('outbox_dead_letters')
        .select(
            'id, site_id, outbox_event_id, event_id, event_type, aggregate_type, aggregate_id, failure_reason, attempts, request_id, trace_id, replayed_at, created_at'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error } = await request;
    if (error) throw new Error(`Dead-letter list failed: ${error.message}`);

    return c.json(success({ dead_letters: data || [] }));
});

router.post('/outbox/dead-letters/:id/replay', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('replay_outbox_dead_letter', {
        p_dead_letter_id: c.req.param('id'),
        p_request_id: getRequestId(c),
    });

    if (error) throw new Error(`Dead-letter replay failed: ${error.message}`);

    return c.json(success({ event: data }));
});

router.get('/jobs', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('platform_queue_jobs')
        .select(
            'id, site_id, event_id, queue_name, job_type, status, attempts, max_attempts, available_at, locked_by, completed_at, failed_at, error_message, request_id, trace_id, created_at'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);
    if (query.queue_name) request = request.eq('queue_name', query.queue_name);

    const { data, error } = await request;
    if (error) throw new Error(`Queue job list failed: ${error.message}`);

    return c.json(success({ jobs: data || [] }));
});

router.post('/jobs/consume', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = ConsumeQueueJobsSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid queue consume request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const service = new QueueService(db);
    const workerId = dispatcherId('manual-queue');
    const result = parsed.data.queue_name
        ? [await service.consumeQueue(workerId, parsed.data.queue_name, parsed.data.limit || 25)]
        : await service.consumeQueues(workerId, ['analytics-events', 'search-indexing'], parsed.data.limit || 25);

    return c.json(success({ worker_id: workerId, queues: result }));
});

router.get('/webhook-deliveries', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('webhook_deliveries')
        .select(
            'id, site_id, subscription_id, event_id, event_type, target_url, status, attempts, max_attempts, next_attempt_at, delivered_at, failed_at, response_status, error_message, request_id, trace_id, created_at'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error } = await request;
    if (error) throw new Error(`Webhook delivery list failed: ${error.message}`);

    return c.json(success({ deliveries: data || [] }));
});

router.get('/webhook-subscriptions', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('webhook_subscriptions')
        .select(
            'id, site_id, name, target_url, event_types, status, failure_count, last_success_at, last_failure_at, metadata, created_at, updated_at'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.status) request = request.eq('status', query.status);
    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error } = await request;
    if (error) throw new Error(`Webhook subscription list failed: ${error.message}`);

    return c.json(success({ subscriptions: data || [] }));
});

router.post('/webhook-subscriptions', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = CreateWebhookSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid webhook subscription request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const { data, error } = await db
        .from('webhook_subscriptions')
        .insert({
            site_id: parsed.data.site_id,
            name: parsed.data.name,
            target_url: parsed.data.target_url,
            event_types: parsed.data.event_types,
            signing_secret: parsed.data.signing_secret,
            metadata: parsed.data.metadata || {},
            created_by: auth.user.id,
            updated_by: auth.user.id,
        })
        .select('id, site_id, name, target_url, event_types, status, metadata, created_at')
        .single();

    if (error) throw new Error(`Webhook subscription creation failed: ${error.message}`);

    return c.json(success({ subscription: data }), 201);
});

router.patch('/webhook-subscriptions/:id', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = UpdateWebhookSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid webhook subscription update request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const updateData = {
        ...parsed.data,
        updated_by: auth.user.id,
    };

    const { data, error } = await db
        .from('webhook_subscriptions')
        .update(updateData)
        .eq('id', c.req.param('id'))
        .is('deleted_at', null)
        .select('id, site_id, name, target_url, event_types, status, metadata, updated_at')
        .single();

    if (error) throw new Error(`Webhook subscription update failed: ${error.message}`);

    return c.json(success({ subscription: data }));
});

router.get('/request-logs', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('worker_request_logs')
        .select(
            'id, site_id, request_id, trace_id, method, path, status_code, latency_ms, user_id, auth_source, error_code, created_at'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (query.status) {
        const status = Number(query.status);
        if (!Number.isInteger(status)) throw new ValidationError('status must be an integer status code');
        request = request.eq('status_code', status);
    }

    if (query.site_id) request = request.eq('site_id', query.site_id);

    const { data, error } = await request;
    if (error) throw new Error(`Request log list failed: ${error.message}`);

    return c.json(success({ request_logs: data || [] }));
});

router.get('/entitlements/:siteId', async (c) => {
    const db = getSupabaseAdmin(c);
    const service = new SaasService(db);
    const entitlements = await service.resolveEntitlements(c.req.param('siteId'));

    return c.json(success({ entitlements }));
});

router.get('/usage', async (c) => {
    const query = parseListQuery(c);
    const db = getSupabaseAdmin(c);

    let request = db
        .from('site_usage_meters')
        .select('id, site_id, meter_name, period_start, period_end, quantity, limit_quantity, status, metadata, updated_at')
        .is('deleted_at', null)
        .order('period_start', { ascending: false })
        .limit(query.limit);

    if (query.site_id) request = request.eq('site_id', query.site_id);
    if (query.status) request = request.eq('status', query.status);

    const { data, error } = await request;
    if (error) throw new Error(`Usage meter list failed: ${error.message}`);

    return c.json(success({ usage_meters: data || [] }));
});

router.post('/usage/record', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordUsageSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid usage metering request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const meter = await new SaasService(db).recordUsage({
        siteId: parsed.data.site_id,
        meterName: parsed.data.meter_name,
        amount: parsed.data.amount,
        idempotencyKey: parsed.data.idempotency_key,
        source: parsed.data.source || 'operations-api',
        resourceType: parsed.data.resource_type || null,
        resourceId: parsed.data.resource_id || null,
        requestId: getRequestId(c),
        traceId: c.req.header('X-Trace-ID') || getRequestId(c),
        metadata: parsed.data.metadata || {},
    });

    return c.json(success({ meter }));
});

export default router;
