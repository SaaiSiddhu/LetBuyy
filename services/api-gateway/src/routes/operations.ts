import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, shouldReturnEmptyForMissingLocalSchema, success } from '../lib/supabase';
import { AppError, ValidationError } from '../lib/errors';
import { getRequestId } from '../lib/tenant-context';
import {
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../middleware/rbac';
import { OutboxExecutionAdapter } from '../execution/outbox-execution.adapter';
import {
    ConsumeQueueJobsSchema,
    CreateWebhookSubscriptionSchema,
    DispatchOutboxSchema,
    DispatchWebhookDeliveriesSchema,
    OperationsListQuerySchema,
    RecordDeploymentHealthGateSchema,
    RecordDeploymentPromotionSchema,
    RecordOperationalDashboardSnapshotSchema,
    RecordProductionIncidentSchema,
    RecordProductionReadinessGateSchema,
    RecordOperationalCertificationReportSchema,
    RecordSecurityEnforcementEventSchema,
    RecordUsageSchema,
    RuntimeDeadLetterRedriveSchema,
    RuntimeQueueRecoverySchema,
    SubmitRuntimeControlCommandSchema,
    UpdateProductionIncidentStatusSchema,
    UpdateWebhookSubscriptionSchema,
    type DispatchOutboxInput,
    type DispatchWebhookDeliveriesInput,
    type OperationsListQuery,
} from '../schemas/operations.schema';
import { SaasExecutionAdapter } from '../execution/saas-execution.adapter';
import { QueueExecutionAdapter } from '../execution/queue-execution.adapter';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type OperationsDb = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

function dispatcherId(prefix: string): string {
    return `${prefix}:${crypto.randomUUID()}`;
}

function actorId(c: AppContext): string {
    const auth = c.get('auth');
    return auth.user.id;
}

function actorEmail(c: AppContext): string | null {
    const auth = c.get('auth');
    return auth.user.email || null;
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

async function writeOperationsAudit(
    db: OperationsDb,
    input: {
        actorId: string;
        actorEmail: string | null;
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason: string;
        metadata?: JsonRecord;
    },
) {
    await db.from('audit_logs').insert({
        actor_id: input.actorId,
        actor_type: 'employee',
        actor_email: input.actorEmail,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason,
        },
    });
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

    if (!c.env.WEBHOOK_SERVICE || !c.env.INTERNAL_API_SECRET) {
        return c.json({
            error: {
                code: 'WEBHOOK_SERVICE_UNAVAILABLE',
                message: 'Webhook delivery dispatch is owned by services/webhook-service and is not bound in this environment',
            },
        }, 503);
    }

    const response = await c.env.WEBHOOK_SERVICE.fetch('https://webhook-service/webhook-deliveries/dispatch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-LetBuyy-Internal-Secret': c.env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
            dispatcher_id: dispatcherId('manual-webhooks'),
            limit: parsed.data.limit || 25,
        }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
        return c.json(result || {
            error: {
                code: 'WEBHOOK_SERVICE_ERROR',
                message: 'Webhook delivery dispatch failed',
            },
        }, 502);
    }

    return c.json(result);
});

router.get('/outbox', async (c) => {
    const query = parseListQuery(c);
    // This is a bounded platform-operator read behind this router's ops + super-admin gate.
    const db = getSupabaseAdminForOperatorRead(c);

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
    // Keep platform-wide dead-letter visibility inside the same super-admin-only boundary.
    const db = getSupabaseAdminForOperatorRead(c);

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

router.get('/runtime/overview', requirePermission('incident:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    // Cross-site diagnostics are a bounded platform-operator read, never a tenant query.
    const queueReadDb = getSupabaseAdminForOperatorRead(c);

    const [
        health,
        queues,
        alerts,
        incidents,
        deployments,
        deploymentHealth,
        readiness,
        dashboards,
        security,
        certificationReports,
    ] = await Promise.all([
        db.from('runtime_health_projections')
            .select('runtime_name, status, region, dependencies, checked_at, metadata')
            .is('deleted_at', null)
            .order('checked_at', { ascending: false })
            .limit(30),
        queueReadDb.from('queue_operation_snapshots')
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
        db.from('production_readiness_gate_runs')
            .select('gate_run_id, environment, version, status, gates, failure_summary, started_at, finished_at, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
        db.from('operational_dashboard_snapshots')
            .select('snapshot_id, dashboard_name, environment, status, source_api, source_projection, sampled_at')
            .is('deleted_at', null)
            .order('sampled_at', { ascending: false })
            .limit(20),
        db.from('security_enforcement_events')
            .select('enforcement_id, environment, control_name, runtime_root, status, severity, recorded_at')
            .is('deleted_at', null)
            .order('recorded_at', { ascending: false })
            .limit(20),
        db.from('operational_certification_reports')
            .select('certification_id, environment, certification_mode, status, repository_maturity_score, live_maturity_score, evidence_summary, missing_capabilities, generated_at, expires_at')
            .is('deleted_at', null)
            .order('generated_at', { ascending: false })
            .limit(20),
    ]);

    for (const result of [health, queues, alerts, incidents, deployments, deploymentHealth, readiness, dashboards, security, certificationReports]) {
        if (result.error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, result.error)) {
                return c.json(success({
                    health: [],
                    queues: [],
                    alerts: [],
                    incidents: [],
                    deployments: [],
                    deployment_health_gates: [],
                    readiness_gates: [],
                    dashboards: [],
                    security_events: [],
                    certification_reports: [],
                }));
            }
            throw new Error(`Runtime overview query failed: ${result.error.message}`);
        }
    }

    return c.json(success({
        health: health.data || [],
        queues: queues.data || [],
        alerts: alerts.data || [],
        incidents: incidents.data || [],
        deployments: deployments.data || [],
        deployment_health_gates: deploymentHealth.data || [],
        readiness_gates: readiness.data || [],
        dashboards: dashboards.data || [],
        security_events: security.data || [],
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

router.get('/runtime/control-commands', requirePermission('incident:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('runtime_control_commands')
        .select('command_id, operation, target_type, target_id, requested_by, reason, status, result, request_id, correlation_id, trace_id, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(parseLimit(c));

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(success({ commands: [] }));
        }
        throw new Error(`Runtime control command list failed: ${error.message}`);
    }

    return c.json(success({ commands: data || [] }));
});

router.post('/runtime/control-commands', requirePermission('incident:command'), async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = SubmitRuntimeControlCommandSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid runtime control command request', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    // This legacy intake has no wired operational consumer or independent
    // session-bound command protocol. A typed actor ID is not consent, and
    // persisting "accepted" would fabricate both approval and execution readiness.
    // Keep the accepted V1 operational obligation open; canonical queue/outbox
    // recovery remains in its existing owners, and frozen workflow machinery
    // must never be activated by this generic command envelope.
    throw new AppError('Runtime commands are unavailable until independent consent and the canonical execution owner are integrated. No command was accepted.',
        503, 'RUNTIME_CONTROL_UNAVAILABLE');
});

router.get('/runtime/incidents', requirePermission('incident:view'), async (c) => {
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

router.post('/runtime/incidents', requirePermission('incident:command'), async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = RecordProductionIncidentSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid production incident request', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.reason || parsed.data.customer_impact);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
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
        p_metadata: {
            ...parsed.data.metadata,
            reason,
        },
    });

    if (error) throw new Error(`Production incident creation failed: ${error.message}`);

    await writeOperationsAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'incident.create',
        resourceType: 'production_incident',
        reason,
        metadata: {
            incident_id: parsed.data.incident_id,
            severity: parsed.data.severity,
            affected_runtimes: parsed.data.affected_runtimes,
            affected_regions: parsed.data.affected_regions,
        },
    });

    return c.json(success({ incident: data }), 201);
});

router.patch('/runtime/incidents/:incidentId/status', requirePermission('incident:command'), async (c) => {
    const body = await readOptionalJson<unknown>(c, {});
    const parsed = UpdateProductionIncidentStatusSchema.safeParse(body);

    if (!parsed.success) {
        throw new ValidationError('Invalid production incident status request', parsed.error.flatten());
    }

    const reason = validateSensitiveReason(parsed.data.summary);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A status change summary of at least 8 characters is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const incidentId = c.req.param('incidentId');
    if (parsed.data.status === 'closed') {
        const { data: incident, error: incidentError } = await db
            .from('production_incidents')
            .select('severity')
            .eq('incident_id', incidentId)
            .is('deleted_at', null)
            .maybeSingle();

        if (incidentError) throw new Error(`Production incident lookup failed: ${incidentError.message}`);
        if (!incident) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }, 404);
        }

        if (incident.severity === 'sev1' || incident.severity === 'sev2') {
            const { data: postmortem, error: postmortemError } = await db
                .from('incident_postmortems')
                .select('id, status')
                .eq('incident_id', incidentId)
                .in('status', ['accepted', 'closed'])
                .is('deleted_at', null)
                .maybeSingle();

            if (postmortemError) throw new Error(`Incident postmortem close-gate lookup failed: ${postmortemError.message}`);
            if (!postmortem) {
                return c.json({
                    error: {
                        code: 'POSTMORTEM_REQUIRED',
                        message: 'SEV-1 and SEV-2 incidents require an accepted postmortem before closure.',
                    },
                }, 409);
            }
        }
    }

    const { data, error } = await db.rpc('update_production_incident_status', {
        p_incident_id: incidentId,
        p_status: parsed.data.status,
        p_actor_id: actorId(c),
        p_summary: reason,
        p_details: parsed.data.details,
    });

    if (error) throw new Error(`Production incident status update failed: ${error.message}`);

    await writeOperationsAudit(db, {
        actorId: actorId(c),
        actorEmail: actorEmail(c),
        action: 'incident.status.update',
        resourceType: 'production_incident',
        reason,
        metadata: {
            incident_id: incidentId,
            status: parsed.data.status,
            details: parsed.data.details,
        },
    });

    return c.json(success({ incident: data }));
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
