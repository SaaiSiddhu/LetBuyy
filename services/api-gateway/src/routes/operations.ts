import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { ValidationError } from '../lib/errors';
import { getRequestId } from '../lib/tenant-context';
import { requireRoleCategory, requireSuperAdmin } from '../middleware/rbac';
import { OutboxExecutionAdapter } from '../execution/outbox-execution.adapter';
import {
    ConsumeQueueJobsSchema,
    CreateWebhookSubscriptionSchema,
    DispatchOutboxSchema,
    DispatchWebhookDeliveriesSchema,
    OperationsListQuerySchema,
    AuthorizeRuntimeReplaySchema,
    RecordChaosExperimentSchema,
    RecordDeploymentHealthGateSchema,
    RecordDeploymentPromotionSchema,
    RecordFailoverDrillSchema,
    RecordLoadTestRunSchema,
    RecordOperationalDashboardSnapshotSchema,
    RecordProductionIncidentSchema,
    RecordProductionReadinessGateSchema,
    RecordRegionalRoutingOverrideSchema,
    RecordOperationalCertificationReportSchema,
    RecordSecurityEnforcementEventSchema,
    RecordSreErrorBudgetSnapshotSchema,
    RecordUsageSchema,
    RuntimeDeadLetterRedriveSchema,
    RuntimeQueueRecoverySchema,
    ScheduleRuntimeReplaySchema,
    SubmitRuntimeControlCommandSchema,
    UpdateProductionIncidentStatusSchema,
    UpdateWebhookSubscriptionSchema,
    ValidateEventStoreIntegritySchema,
    ArchiveDistributedEventsSchema,
    type DispatchOutboxInput,
    type DispatchWebhookDeliveriesInput,
    type OperationsListQuery,
} from '../schemas/operations.schema';
import { SaasExecutionAdapter } from '../execution/saas-execution.adapter';
import { QueueExecutionAdapter } from '../execution/queue-execution.adapter';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

function dispatcherId(prefix: string): string {
    return `${prefix}:${crypto.randomUUID()}`;
}

function actorId(c: AppContext): string {
    const auth = c.get('auth');
    return auth.user.id;
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

function parseLimit(c: AppContext, fallback = 50): number {
    const parsed = OperationsListQuerySchema.safeParse({
        limit: c.req.query('limit') || String(fallback),
    });

    if (!parsed.success) {
        throw new ValidationError('Invalid limit query', parsed.error.flatten());
    }

    return parsed.data.limit;
}

router.post('/outbox/dispatch', async (c) => {
    const body = await readOptionalJson<DispatchOutboxInput>(c, {});
    const parsed = DispatchOutboxSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid outbox dispatch request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const service = new OutboxExecutionAdapter(db);
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
    const service = new OutboxExecutionAdapter(db);
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
    const service = new QueueExecutionAdapter(db);
    const workerId = dispatcherId('manual-queue');
    const result = parsed.data.queue_name
        ? [await service.consumeQueue(workerId, parsed.data.queue_name, parsed.data.limit || 25)]
        : await service.consumeQueues(workerId, ['analytics-events', 'search-indexing', 'payment-events'], parsed.data.limit || 25);

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
    const service = new SaasExecutionAdapter(db);
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
    const meter = await new SaasExecutionAdapter(db).recordUsage({
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

router.get('/runtime/overview', async (c) => {
    const db = getSupabaseAdmin(c);

    const [
        health,
        queues,
        alerts,
        incidents,
        deployments,
        deploymentHealth,
        failover,
        chaos,
        load,
        slo,
        readiness,
        eventIntegrity,
        dashboards,
        errorBudgets,
        security,
        regionalOverrides,
        certificationReports,
    ] = await Promise.all([
        db.from('runtime_health_projections')
            .select('runtime_name, status, region, dependencies, checked_at, metadata')
            .is('deleted_at', null)
            .order('checked_at', { ascending: false })
            .limit(30),
        db.from('queue_operation_snapshots')
            .select('queue_name, partition_key, site_id, depth, leased, retrying, dead_lettered, oldest_available_at, sampled_at, metadata')
            .is('deleted_at', null)
            .order('sampled_at', { ascending: false })
            .limit(30),
        db.from('runtime_alert_evaluations')
            .select('alert_name, runtime_name, severity, firing, observed_value, reason, runbook, evaluated_at, metadata')
            .is('deleted_at', null)
            .order('evaluated_at', { ascending: false })
            .limit(30),
        db.from('production_incidents')
            .select('incident_id, title, severity, status, affected_runtimes, affected_regions, customer_impact, started_at, mitigated_at, resolved_at, metadata')
            .is('deleted_at', null)
            .neq('status', 'closed')
            .order('started_at', { ascending: false })
            .limit(20),
        db.from('deployment_promotion_runs')
            .select('promotion_id, runtime_name, runtime_root, environment, strategy, version, status, health_gates, started_at, finished_at, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('deployment_health_gate_results')
            .select('gate_id, promotion_id, runtime_root, environment, gate_name, status, observed_value, threshold, evidence_url, evaluated_at')
            .is('deleted_at', null)
            .order('evaluated_at', { ascending: false })
            .limit(20),
        db.from('failover_drill_runs')
            .select('drill_id, drill_type, source_region, target_region, affected_runtimes, status, rto_seconds, rpo_seconds, result, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('chaos_experiment_runs')
            .select('experiment_id, experiment_type, environment, blast_radius, status, guardrails, result, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('load_test_runs')
            .select('run_id, test_type, environment, status, tool, target_rps, p95_latency_ms, error_rate, report_url, result, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('runtime_slo_definitions')
            .select('slo_id, runtime_name, sli_name, target_percent, window, error_budget_policy, alert_policy, active')
            .is('deleted_at', null)
            .eq('active', true)
            .order('runtime_name', { ascending: true })
            .limit(50),
        db.from('production_readiness_gate_runs')
            .select('gate_run_id, environment, version, status, gates, failure_summary, started_at, finished_at, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('event_store_integrity_checks')
            .select('check_id, stream_name, environment, status, checked_events, gap_count, duplicate_count, checked_at')
            .is('deleted_at', null)
            .order('checked_at', { ascending: false })
            .limit(20),
        db.from('operational_dashboard_snapshots')
            .select('snapshot_id, dashboard_name, environment, status, source_api, source_projection, sampled_at')
            .is('deleted_at', null)
            .order('sampled_at', { ascending: false })
            .limit(20),
        db.from('sre_error_budget_snapshots')
            .select('budget_id, runtime_name, slo_id, environment, window, target_percent, observed_percent, remaining_budget_percent, burn_rate, status, sampled_at')
            .is('deleted_at', null)
            .order('sampled_at', { ascending: false })
            .limit(20),
        db.from('security_enforcement_events')
            .select('enforcement_id, environment, control_name, runtime_root, status, severity, recorded_at')
            .is('deleted_at', null)
            .order('recorded_at', { ascending: false })
            .limit(20),
        db.from('regional_routing_overrides')
            .select('override_id, environment, tenant_site_id, runtime_root, source_region, target_region, status, expires_at, activated_at, restored_at, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('operational_certification_reports')
            .select('certification_id, environment, certification_mode, status, repository_maturity_score, live_maturity_score, evidence_summary, missing_capabilities, generated_at, expires_at')
            .is('deleted_at', null)
            .order('generated_at', { ascending: false })
            .limit(20),
    ]);

    for (const result of [health, queues, alerts, incidents, deployments, deploymentHealth, failover, chaos, load, slo, readiness, eventIntegrity, dashboards, errorBudgets, security, regionalOverrides, certificationReports]) {
        if (result.error) throw new Error(`Runtime overview query failed: ${result.error.message}`);
    }

    return c.json(success({
        health: health.data || [],
        queues: queues.data || [],
        alerts: alerts.data || [],
        incidents: incidents.data || [],
        deployments: deployments.data || [],
        deployment_health_gates: deploymentHealth.data || [],
        failover_drills: failover.data || [],
        chaos_experiments: chaos.data || [],
        load_tests: load.data || [],
        slos: slo.data || [],
        readiness_gates: readiness.data || [],
        event_store_integrity: eventIntegrity.data || [],
        dashboards: dashboards.data || [],
        error_budgets: errorBudgets.data || [],
        security_events: security.data || [],
        regional_routing_overrides: regionalOverrides.data || [],
        certification_reports: certificationReports.data || [],
    }));
});

router.get('/runtime/queues/:queueName', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('inspect_distributed_queue', {
        p_queue_name: c.req.param('queueName'),
        p_limit: parseLimit(c, 100),
    });

    if (error) throw new Error(`Distributed queue inspection failed: ${error.message}`);

    return c.json(success({ messages: data || [] }));
});

router.post('/runtime/queues/:queueName/recover-leases', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RuntimeQueueRecoverySchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid queue lease recovery request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const operationId = dispatcherId('queue-recovery');
    const { data, error } = await db.rpc('recover_stuck_distributed_queue_leases', {
        p_queue_name: c.req.param('queueName'),
        p_recovery_operation_id: operationId,
        p_reason: parsed.data.reason,
        p_limit: parsed.data.limit || 100,
    });

    if (error) throw new Error(`Distributed queue lease recovery failed: ${error.message}`);

    return c.json(success({ operation_id: operationId, recovered_count: data }));
});

router.post('/runtime/queues/:queueName/redrive-dead-letters', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RuntimeDeadLetterRedriveSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid dead-letter redrive request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const operationId = dispatcherId('dead-letter-redrive');
    const { data, error } = await db.rpc('redrive_distributed_dead_letters', {
        p_queue_name: c.req.param('queueName'),
        p_message_ids: parsed.data.message_ids,
        p_recovery_operation_id: operationId,
        p_reason: parsed.data.reason,
    });

    if (error) throw new Error(`Distributed dead-letter redrive failed: ${error.message}`);

    return c.json(success({ operation_id: operationId, redriven_count: data }));
});

router.get('/runtime/replays', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('replay_operation_schedules')
        .select('replay_id, owner_runtime, site_id, event_types, cursor, batch_size, dry_run, impact, rollback_plan, requested_by, approved_by, authorization_expires_at, status, request_id, correlation_id, trace_id, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) throw new Error(`Runtime replay list failed: ${error.message}`);

    return c.json(success({ replays: data || [] }));
});

router.post('/runtime/replays', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = ScheduleRuntimeReplaySchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid runtime replay schedule request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const requestId = getRequestId(c);
    const { data, error } = await db.rpc('schedule_runtime_replay_operation', {
        p_replay_id: parsed.data.replay_id,
        p_owner_runtime: parsed.data.owner_runtime,
        p_site_id: parsed.data.site_id || null,
        p_event_types: parsed.data.event_types,
        p_cursor: parsed.data.cursor,
        p_batch_size: parsed.data.batch_size,
        p_dry_run: parsed.data.dry_run,
        p_requested_by: actorId(c),
        p_reason: parsed.data.reason,
        p_request_id: requestId,
        p_correlation_id: requestId,
        p_trace_id: c.req.header('X-Trace-ID') || null,
    });

    if (error) throw new Error(`Runtime replay scheduling failed: ${error.message}`);

    return c.json(success({ replay: data }), 201);
});

router.post('/runtime/replays/:replayId/authorize', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = AuthorizeRuntimeReplaySchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid runtime replay authorization request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('authorize_runtime_replay_operation', {
        p_replay_id: c.req.param('replayId'),
        p_approved_by: actorId(c),
        p_expires_at: parsed.data.expires_at,
    });

    if (error) throw new Error(`Runtime replay authorization failed: ${error.message}`);

    return c.json(success({ replay: data }));
});

router.get('/runtime/control-commands', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('runtime_control_commands')
        .select('command_id, operation, target_type, target_id, requested_by, reason, status, result, request_id, correlation_id, trace_id, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) throw new Error(`Runtime control command list failed: ${error.message}`);

    return c.json(success({ commands: data || [] }));
});

router.post('/runtime/control-commands', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = SubmitRuntimeControlCommandSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid runtime control command request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const requestId = getRequestId(c);
    const authUserId = actorId(c);
    const { data, error } = await db
        .from('runtime_control_commands')
        .insert({
            command_id: parsed.data.command_id,
            operation: parsed.data.operation,
            target_type: parsed.data.target_type,
            target_id: parsed.data.target_id,
            requested_by: authUserId,
            reason: parsed.data.reason,
            request_id: requestId,
            correlation_id: requestId,
            trace_id: c.req.header('X-Trace-ID') || null,
            created_by: authUserId,
            updated_by: authUserId,
        })
        .select('command_id, operation, target_type, target_id, status, created_at')
        .single();

    if (error) throw new Error(`Runtime control command submission failed: ${error.message}`);

    return c.json(success({ command: data }), 201);
});

router.get('/runtime/incidents', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('production_incidents')
        .select('incident_id, title, severity, status, affected_runtimes, affected_regions, customer_impact, commander_id, started_at, mitigated_at, resolved_at, postmortem_url, metadata, created_at, updated_at')
        .is('deleted_at', null)
        .order('started_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) throw new Error(`Production incident list failed: ${error.message}`);

    return c.json(success({ incidents: data || [] }));
});

router.post('/runtime/incidents', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordProductionIncidentSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid production incident request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_production_incident', {
        p_incident_id: parsed.data.incident_id,
        p_title: parsed.data.title,
        p_severity: parsed.data.severity,
        p_affected_runtimes: parsed.data.affected_runtimes,
        p_affected_regions: parsed.data.affected_regions,
        p_customer_impact: parsed.data.customer_impact,
        p_commander_id: actorId(c),
        p_metadata: parsed.data.metadata,
    });

    if (error) throw new Error(`Production incident creation failed: ${error.message}`);

    return c.json(success({ incident: data }), 201);
});

router.patch('/runtime/incidents/:incidentId/status', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = UpdateProductionIncidentStatusSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid production incident status request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('update_production_incident_status', {
        p_incident_id: c.req.param('incidentId'),
        p_status: parsed.data.status,
        p_actor_id: actorId(c),
        p_summary: parsed.data.summary,
        p_details: parsed.data.details,
    });

    if (error) throw new Error(`Production incident status update failed: ${error.message}`);

    return c.json(success({ incident: data }));
});

router.post('/runtime/failover-drills', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordFailoverDrillSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid failover drill request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_failover_drill_run', {
        p_drill_id: parsed.data.drill_id,
        p_drill_type: parsed.data.drill_type,
        p_source_region: parsed.data.source_region || null,
        p_target_region: parsed.data.target_region || null,
        p_affected_runtimes: parsed.data.affected_runtimes,
        p_status: parsed.data.status,
        p_rto_seconds: parsed.data.rto_seconds ?? null,
        p_rpo_seconds: parsed.data.rpo_seconds ?? null,
        p_result: parsed.data.result,
    });

    if (error) throw new Error(`Failover drill recording failed: ${error.message}`);

    return c.json(success({ drill: data }), 201);
});

router.post('/runtime/chaos-experiments', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordChaosExperimentSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid chaos experiment request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_chaos_experiment_run', {
        p_experiment_id: parsed.data.experiment_id,
        p_experiment_type: parsed.data.experiment_type,
        p_environment: parsed.data.environment,
        p_blast_radius: parsed.data.blast_radius,
        p_status: parsed.data.status,
        p_guardrails: parsed.data.guardrails,
        p_result: parsed.data.result,
    });

    if (error) throw new Error(`Chaos experiment recording failed: ${error.message}`);

    return c.json(success({ experiment: data }), 201);
});

router.post('/runtime/load-tests', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordLoadTestRunSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid load test run request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_load_test_run', {
        p_run_id: parsed.data.run_id,
        p_test_type: parsed.data.test_type,
        p_environment: parsed.data.environment,
        p_status: parsed.data.status,
        p_tool: parsed.data.tool,
        p_target_rps: parsed.data.target_rps ?? null,
        p_p95_latency_ms: parsed.data.p95_latency_ms ?? null,
        p_error_rate: parsed.data.error_rate ?? null,
        p_report_url: parsed.data.report_url || null,
        p_result: parsed.data.result,
    });

    if (error) throw new Error(`Load test run recording failed: ${error.message}`);

    return c.json(success({ run: data }), 201);
});

router.post('/runtime/deployments', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordDeploymentPromotionSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid deployment promotion request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_deployment_promotion_run', {
        p_promotion_id: parsed.data.promotion_id,
        p_runtime_name: parsed.data.runtime_name,
        p_runtime_root: parsed.data.runtime_root,
        p_environment: parsed.data.environment,
        p_strategy: parsed.data.strategy,
        p_version: parsed.data.version,
        p_status: parsed.data.status,
        p_health_gates: parsed.data.health_gates,
    });

    if (error) throw new Error(`Deployment promotion recording failed: ${error.message}`);

    return c.json(success({ deployment: data }), 201);
});

router.post('/runtime/readiness-gates', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordProductionReadinessGateSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid production readiness gate request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_production_readiness_gate_run', {
        p_gate_run_id: parsed.data.gate_run_id,
        p_environment: parsed.data.environment,
        p_version: parsed.data.version,
        p_status: parsed.data.status,
        p_gates: parsed.data.gates,
        p_failure_summary: parsed.data.failure_summary || null,
    });

    if (error) throw new Error(`Production readiness gate recording failed: ${error.message}`);

    return c.json(success({ gate_run: data }), 201);
});

router.post('/runtime/deployment-health-gates', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordDeploymentHealthGateSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid deployment health gate request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_deployment_health_gate_result', {
        p_gate_id: parsed.data.gate_id,
        p_promotion_id: parsed.data.promotion_id || null,
        p_runtime_root: parsed.data.runtime_root,
        p_environment: parsed.data.environment,
        p_gate_name: parsed.data.gate_name,
        p_status: parsed.data.status,
        p_observed_value: parsed.data.observed_value,
        p_threshold: parsed.data.threshold,
        p_evidence_url: parsed.data.evidence_url || null,
    });

    if (error) throw new Error(`Deployment health gate recording failed: ${error.message}`);

    return c.json(success({ gate: data }), 201);
});

router.get('/runtime/event-store/integrity', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('event_store_integrity_checks')
        .select('check_id, stream_name, environment, status, checked_events, min_stream_position, max_stream_position, gap_count, duplicate_count, retention_class, result, checked_at')
        .is('deleted_at', null)
        .order('checked_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) throw new Error(`Event store integrity list failed: ${error.message}`);

    return c.json(success({ checks: data || [] }));
});

router.post('/runtime/event-store/integrity', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = ValidateEventStoreIntegritySchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid event-store integrity request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('validate_event_stream_consistency', {
        p_stream_name: parsed.data.stream_name,
        p_environment: parsed.data.environment,
        p_limit: parsed.data.limit,
    });

    if (error) throw new Error(`Event stream consistency validation failed: ${error.message}`);

    return c.json(success({ check: data }), 201);
});

router.post('/runtime/event-store/archive', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = ArchiveDistributedEventsSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid event archival request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('archive_distributed_events', {
        p_before: parsed.data.before,
        p_limit: parsed.data.limit,
    });

    if (error) throw new Error(`Event archival failed: ${error.message}`);

    return c.json(success({ archived_count: data }));
});

router.post('/runtime/dashboards', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordOperationalDashboardSnapshotSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid operational dashboard snapshot request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_operational_dashboard_snapshot', {
        p_snapshot_id: parsed.data.snapshot_id,
        p_dashboard_name: parsed.data.dashboard_name,
        p_environment: parsed.data.environment,
        p_status: parsed.data.status,
        p_source_api: parsed.data.source_api,
        p_source_projection: parsed.data.source_projection,
        p_panels: parsed.data.panels,
    });

    if (error) throw new Error(`Operational dashboard snapshot recording failed: ${error.message}`);

    return c.json(success({ snapshot: data }), 201);
});

router.post('/runtime/sre/error-budgets', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordSreErrorBudgetSnapshotSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid SRE error budget snapshot request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_sre_error_budget_snapshot', {
        p_budget_id: parsed.data.budget_id,
        p_runtime_name: parsed.data.runtime_name,
        p_slo_id: parsed.data.slo_id,
        p_environment: parsed.data.environment,
        p_window: parsed.data.window,
        p_target_percent: parsed.data.target_percent,
        p_observed_percent: parsed.data.observed_percent,
        p_remaining_budget_percent: parsed.data.remaining_budget_percent,
        p_burn_rate: parsed.data.burn_rate,
        p_status: parsed.data.status,
    });

    if (error) throw new Error(`SRE error budget snapshot recording failed: ${error.message}`);

    return c.json(success({ budget: data }), 201);
});

router.post('/runtime/security/enforcement-events', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordSecurityEnforcementEventSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid security enforcement event request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_security_enforcement_event', {
        p_enforcement_id: parsed.data.enforcement_id,
        p_environment: parsed.data.environment,
        p_control_name: parsed.data.control_name,
        p_runtime_root: parsed.data.runtime_root,
        p_status: parsed.data.status,
        p_severity: parsed.data.severity,
        p_evidence: parsed.data.evidence,
    });

    if (error) throw new Error(`Security enforcement event recording failed: ${error.message}`);

    return c.json(success({ event: data }), 201);
});

router.post('/runtime/regional-routing-overrides', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordRegionalRoutingOverrideSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid regional routing override request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_regional_routing_override', {
        p_override_id: parsed.data.override_id,
        p_environment: parsed.data.environment,
        p_tenant_site_id: parsed.data.tenant_site_id || null,
        p_runtime_root: parsed.data.runtime_root,
        p_source_region: parsed.data.source_region,
        p_target_region: parsed.data.target_region,
        p_reason: parsed.data.reason,
        p_status: parsed.data.status,
        p_expires_at: parsed.data.expires_at || null,
        p_metadata: parsed.data.metadata,
    });

    if (error) throw new Error(`Regional routing override recording failed: ${error.message}`);

    return c.json(success({ override: data }), 201);
});

router.get('/runtime/certification-reports', async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('operational_certification_reports')
        .select('certification_id, environment, certification_mode, status, repository_maturity_score, live_maturity_score, evidence_summary, missing_capabilities, generated_at, expires_at, report')
        .is('deleted_at', null)
        .order('generated_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) throw new Error(`Operational certification report list failed: ${error.message}`);

    return c.json(success({ reports: data || [] }));
});

router.post('/runtime/certification-reports', async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordOperationalCertificationReportSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid operational certification report request', parsed.error.flatten());
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('record_operational_certification_report', {
        p_certification_id: parsed.data.certification_id,
        p_environment: parsed.data.environment,
        p_certification_mode: parsed.data.certification_mode,
        p_status: parsed.data.status,
        p_repository_maturity_score: parsed.data.repository_maturity_score,
        p_live_maturity_score: parsed.data.live_maturity_score,
        p_evidence_summary: parsed.data.evidence_summary,
        p_missing_capabilities: parsed.data.missing_capabilities,
        p_expires_at: parsed.data.expires_at || null,
        p_report: parsed.data.report,
        p_actor_id: actorId(c),
    });

    if (error) throw new Error(`Operational certification report recording failed: ${error.message}`);

    return c.json(success({ report: data }), 201);
});

export default router;
