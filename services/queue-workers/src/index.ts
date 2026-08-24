import { insertSupabaseRows, upsertSupabaseRows, type SupabaseServiceEnv } from '@letbuyy/infrastructure/supabase-adapter';
import {
  writeRuntimeTelemetryDataPoint,
  type RuntimeTelemetryDatasetBinding,
} from '@letbuyy/infrastructure/runtime-telemetry-adapter';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { consumePlatformQueuesForCloudflareQueue } from './platform-queue-consumer';
import type { PushProviderEnv } from './push-dispatcher';
import { processComplianceDeliveries, runComplianceAuditExportDryRun } from './compliance';
import { processExecutiveAnalyticsDeliveries, runExecutiveAnalyticsRollup } from './executive-analytics';
import { processIncidentCommandDeliveries, runIncidentPostmortemReminders } from './incident-command';
import { processRiskScoringDeliveries } from './risk-scoring';
import { processReviewCheckDeliveries } from './review-checks';
import { processSupportAutomationDeliveries } from './support-automation';
import { runInventoryReservationSweeper } from './inventory-reservations';
import { runMerchantSessionJtiConsumptionSweeper } from './merchant-session-jti-sweeper';
import { runSloTelemetryEmitter } from './slo-telemetry';
import { runMoneyLedgerReconciliation } from './money-ledger-reconciliation';

type QueuePayload = {
  messageId?: string;
  queueName?: string;
  jobType?: string;
  payload?: Record<string, unknown>;
  siteId?: string | null;
  tenantEnvelope?: {
    siteId?: string;
    issuedAt?: string;
    signature?: string;
  };
  idempotencyKey?: string;
  requestId?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  traceparent?: string | null;
};

type QueueBatchMessage = Message<QueuePayload | Record<string, unknown>>;

interface NormalizedQueueDelivery {
  message: QueueBatchMessage;
  input: Required<QueuePayload>;
  status: 'completed' | 'dead-lettered';
  lagMilliseconds: number;
}

export interface Env extends SupabaseServiceEnv, PushProviderEnv {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  APP_ENV?: string;
  NODE_ENV?: string;
  DEPLOYMENT_ENV?: string;
  TELEMETRY_ENV?: string;
  RUNTIME_NAME?: string;
  PRIMARY_REGION?: string;
  EDGE_SCOPE?: string;
  RUNTIME_TELEMETRY?: RuntimeTelemetryDatasetBinding;
  PLATFORM_QUEUE_CLAIM_LIMIT?: string;
  PLATFORM_QUEUE_DRAIN_BUDGET_PER_BATCH?: string;
  PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD?: string;
  PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS?: string;
  PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT?: string;
  INVENTORY_RESERVATION_SWEEPER_LIMIT?: string;
  MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT?: string;
  API_GATEWAY_SERVICE?: Fetcher;
  INTERNAL_API_SECRET?: string;
  QUEUE_TENANT_ENVELOPE_SECRET?: string;
  CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

class QueueProcessingError extends Error {
  readonly deterministic: boolean;

  constructor(message: string, options: { deterministic: boolean; cause?: unknown }) {
    super(message);
    this.name = 'QueueProcessingError';
    this.deterministic = options.deterministic;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function isDeterministicQueueError(error: unknown): boolean {
  return error instanceof QueueProcessingError && error.deterministic;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactedRawPayload(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return {
      keys: Object.keys(value).slice(0, 25),
      rejected_type: 'object',
    };
  }

  return {
    rejected_type: value === null ? 'null' : typeof value,
  };
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function tenantEnvelopeSecret(env: Pick<Env, 'QUEUE_TENANT_ENVELOPE_SECRET' | 'INTERNAL_API_SECRET'>): string | null {
  const secret = env.QUEUE_TENANT_ENVELOPE_SECRET || env.INTERNAL_API_SECRET;
  if (!secret || secret.includes('SKIP_NEEDS_HUMAN_') || secret.includes('replace-with')) return null;
  return secret;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function payloadHasTenantScope(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(payloadHasTenantScope);
  if (!isRecord(value)) return false;
  if (
    typeof value.site_id === 'string'
    || typeof value.store_id === 'string'
    || typeof value.siteId === 'string'
    || typeof value.storeId === 'string'
  ) {
    return true;
  }
  return Object.values(value).some(payloadHasTenantScope);
}

async function verifiedTenantSiteId(
  env: Env,
  body: QueuePayload,
  normalized: Pick<Required<QueuePayload>, 'messageId' | 'idempotencyKey' | 'payload'>,
): Promise<string | null> {
  const candidateSiteId = typeof body.siteId === 'string'
    ? body.siteId
    : typeof body.tenantEnvelope?.siteId === 'string'
      ? body.tenantEnvelope.siteId
      : null;
  const hasTenantScope = Boolean(candidateSiteId) || payloadHasTenantScope(normalized.payload);
  if (!hasTenantScope) return null;

  const envelope = body.tenantEnvelope;
  const secret = tenantEnvelopeSecret(env);
  if (!secret || !candidateSiteId || !envelope?.issuedAt || !envelope.signature) {
    throw new QueueProcessingError('Tenant-scoped queue message requires signed tenant envelope', { deterministic: true });
  }
  if (envelope.siteId !== candidateSiteId) {
    throw new QueueProcessingError('Tenant envelope siteId does not match queue message siteId', { deterministic: true });
  }

  const issuedAtMs = Date.parse(envelope.issuedAt);
  if (!Number.isFinite(issuedAtMs) || Math.abs(Date.now() - issuedAtMs) > 15 * 60_000) {
    throw new QueueProcessingError('Tenant envelope is expired or malformed', { deterministic: true });
  }

  const expected = await hmacSha256Hex(
    secret,
    `${candidateSiteId}.${normalized.messageId}.${normalized.idempotencyKey}.${envelope.issuedAt}`,
  );
  if (!constantTimeEqual(expected, envelope.signature)) {
    throw new QueueProcessingError('Tenant envelope signature is invalid', { deterministic: true });
  }

  return candidateSiteId;
}

function queueNameFromBatch(batch: MessageBatch<QueuePayload | Record<string, unknown>>, body: QueuePayload): string {
  return stringValue(body.queueName, batch.queue);
}

async function normalizePayload(env: Env, message: QueueBatchMessage, batch: MessageBatch<QueuePayload | Record<string, unknown>>): Promise<Required<QueuePayload>> {
  if (!isRecord(message.body)) {
    throw new QueueProcessingError('Queue message body must be a JSON object', { deterministic: true });
  }

  const body = message.body as QueuePayload;
  const queueName = queueNameFromBatch(batch, body);
  const messageId = stringValue(body.messageId, message.id);
  const jobType = stringValue(body.jobType, 'runtime.queue.delivery');
  const idempotencyKey = stringValue(body.idempotencyKey, `${queueName}:${messageId}`);
  const requestId = stringValue(body.requestId, messageId);
  const correlationId = stringValue(body.correlationId, requestId);
  const payload = isRecord(body.payload) ? body.payload : { raw: redactedRawPayload(body.payload ?? body) };
  const partial = {
    messageId,
    idempotencyKey,
    payload,
  };
  const siteId = await verifiedTenantSiteId(env, body, partial);

  return {
    messageId,
    queueName,
    jobType,
    payload,
    siteId,
    tenantEnvelope: body.tenantEnvelope || {},
    idempotencyKey,
    requestId,
    correlationId,
    traceId: typeof body.traceId === 'string' ? body.traceId : null,
    traceparent: typeof body.traceparent === 'string' ? body.traceparent : null,
  };
}

function queueMessageRow(env: Env, input: Required<QueuePayload>, status: 'completed' | 'dead-lettered'): Record<string, unknown> {
  return {
    message_id: input.messageId,
    queue_name: input.queueName,
    partition_key: input.siteId || input.queueName,
    site_id: input.siteId,
    job_type: input.jobType,
    payload: input.payload,
    status,
    attempts: 1,
    max_attempts: status === 'dead-lettered' ? 1 : 10,
    idempotency_key: input.idempotencyKey,
    request_id: input.requestId,
    correlation_id: input.correlationId,
    trace_id: input.traceId,
    traceparent: input.traceparent,
    result: {
      provider: 'cloudflare-queues',
      environment: env.ENVIRONMENT,
      region: env.PRIMARY_REGION || 'global-edge',
    },
  };
}

async function persistQueueBatch(env: Env, deliveries: NormalizedQueueDelivery[]): Promise<void> {
  if (deliveries.length === 0) return;
  await upsertSupabaseRows(env, 'distributed_queue_messages', deliveries.map((delivery) => (
    queueMessageRow(env, delivery.input, delivery.status)
  )), { onConflict: 'message_id', prefer: 'resolution=merge-duplicates,return=minimal' });
}

function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1));
  return sorted[index];
}

async function recordQueueBatchMetric(env: Env, batch: MessageBatch<QueuePayload | Record<string, unknown>>, deliveries: NormalizedQueueDelivery[]): Promise<void> {
  if (deliveries.length === 0) return;
  const completed = deliveries.filter((delivery) => delivery.status === 'completed').length;
  const deadLettered = deliveries.length - completed;
  const lagValues = deliveries.map((delivery) => delivery.lagMilliseconds);
  const lagP95Ms = percentile(lagValues, 95);
  const lagMaxMs = Math.max(...lagValues);
  const runtimeName = env.RUNTIME_NAME || 'Queue Workers';
  const deploymentEnv = env.DEPLOYMENT_ENV || env.ENVIRONMENT;
  const telemetryEnv = env.TELEMETRY_ENV || env.ENVIRONMENT;
  const queueNames = [...new Set(deliveries.map((delivery) => delivery.input.queueName))];
  const jobTypes = [...new Set(deliveries.map((delivery) => delivery.input.jobType))];
  const firstDelivery = deliveries[0]?.input;

  const sharedDimensions = {
    cloudflare_queue_name: batch.queue,
    queue_names: queueNames,
    job_types: jobTypes,
    completed,
    dead_lettered: deadLettered,
    lag_p95_ms: lagP95Ms,
    lag_max_ms: lagMaxMs,
    provider: 'cloudflare-queues',
    region: env.PRIMARY_REGION || 'global-edge',
    deployment_env: deploymentEnv,
    telemetry_env: telemetryEnv,
  };

  await insertSupabaseRows(env, 'runtime_telemetry_metrics', [
    {
      metric_name: 'letbuyy.queue.delivery.batch',
      metric_value: deliveries.length,
      unit: 'count',
      runtime_name: runtimeName,
      site_id: null,
      dimensions: sharedDimensions,
      request_id: firstDelivery?.requestId,
      correlation_id: firstDelivery?.correlationId,
      trace_id: firstDelivery?.traceId,
    },
    {
      metric_name: 'letbuyy.queue.dead_letter.total',
      metric_value: deadLettered,
      unit: 'count',
      runtime_name: runtimeName,
      site_id: null,
      dimensions: sharedDimensions,
      request_id: firstDelivery?.requestId,
      correlation_id: firstDelivery?.correlationId,
      trace_id: firstDelivery?.traceId,
    },
  ]);

  writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY, {
    metricName: 'letbuyy.queue.delivery.batch',
    runtimeName,
    environment: env.ENVIRONMENT,
    deploymentEnv,
    telemetryEnv,
    requestId: firstDelivery?.requestId,
    traceId: firstDelivery?.traceId,
    index: batch.queue,
    blobs: [
      batch.queue,
      queueNames.join(','),
      jobTypes.join(','),
      env.PRIMARY_REGION || 'global-edge',
    ],
    doubles: [
      deliveries.length,
      completed,
      deadLettered,
      lagP95Ms,
      lagMaxMs,
    ],
  });

  writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY, {
    metricName: 'letbuyy.queue.dead_letter.total',
    runtimeName,
    environment: env.ENVIRONMENT,
    deploymentEnv,
    telemetryEnv,
    requestId: firstDelivery?.requestId,
    traceId: firstDelivery?.traceId,
    index: batch.queue,
    blobs: [
      batch.queue,
      queueNames.join(','),
      jobTypes.join(','),
      env.PRIMARY_REGION || 'global-edge',
    ],
    doubles: [
      deadLettered,
      deliveries.length,
    ],
  });
}

async function normalizeDelivery(env: Env, batch: MessageBatch<QueuePayload | Record<string, unknown>>, message: QueueBatchMessage): Promise<NormalizedQueueDelivery> {
  const normalized = await normalizePayload(env, message, batch);
  const status = batch.queue.includes('dead-letters') ? 'dead-lettered' : 'completed';
  return {
    message,
    input: normalized,
    status,
    lagMilliseconds: Math.max(0, Date.now() - message.timestamp.getTime()),
  };
}

function quarantinedDelivery(
  batch: MessageBatch<QueuePayload | Record<string, unknown>>,
  message: QueueBatchMessage,
  error: unknown,
): NormalizedQueueDelivery {
  const messageId = message.id;
  const queueName = batch.queue;
  const requestId = messageId;
  const errorMessage = error instanceof Error ? error.message : 'Queue message failed deterministic validation';

  return {
    message,
    status: 'dead-lettered',
    lagMilliseconds: Math.max(0, Date.now() - message.timestamp.getTime()),
    input: {
      messageId,
      queueName,
      jobType: 'runtime.queue.delivery.invalid',
      payload: {
        quarantine_reason: errorMessage,
        raw: redactedRawPayload(message.body),
      },
      siteId: null,
      tenantEnvelope: {},
      idempotencyKey: `${queueName}:${messageId}:quarantined`,
      requestId,
      correlationId: requestId,
      traceId: null,
      traceparent: null,
    },
  };
}

async function normalizeDeliveries(env: Env, batch: MessageBatch<QueuePayload | Record<string, unknown>>): Promise<NormalizedQueueDelivery[]> {
  return Promise.all(batch.messages.map(async (message) => {
    try {
      return await normalizeDelivery(env, batch, message);
    } catch (error) {
      if (isDeterministicQueueError(error)) {
        return quarantinedDelivery(batch, message, error);
      }

      throw error;
    }
  }));
}

function sharedBodyQueueName(deliveries: NormalizedQueueDelivery[]): string | null {
  const names = new Set(deliveries.map((delivery) => delivery.input.queueName));
  return names.size === 1 ? deliveries[0]?.input.queueName || null : null;
}

function writeQueueLog(level: 'info' | 'error', fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    service: 'letbuyy-queue-workers',
    ...fields,
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.info(line);
}

function emailPayload(value: Record<string, unknown>): {
  to: string;
  subject: string;
  text: string;
  html?: string;
  orderId?: string;
  inviteId?: string;
  contactSubmissionId?: string;
  storeId?: string;
} | null {
  const to = typeof value.to === 'string' ? value.to : '';
  const subject = typeof value.subject === 'string' ? value.subject : '';
  const text = typeof value.text === 'string' ? value.text : '';
  if (!to || !subject || !text) return null;

  return {
    to,
    subject,
    text,
    html: typeof value.html === 'string' ? value.html : undefined,
    orderId: typeof value.order_id === 'string' ? value.order_id : undefined,
    inviteId: typeof value.invite_id === 'string' ? value.invite_id : undefined,
    contactSubmissionId: typeof value.contact_submission_id === 'string' ? value.contact_submission_id : undefined,
    storeId: typeof value.store_id === 'string' ? value.store_id : undefined,
  };
}

function isTransactionalEmailJob(jobType: string): boolean {
  return jobType === 'email.order_confirmation'
    || jobType === 'email.order_cancelled'
    || jobType === 'email.order_refunded'
    || jobType === 'email.gift_card_issued'
    || jobType === 'email.employee_invite'
    || jobType === 'email.contact_owner_notification';
}

function resendConfigured(env: Env): boolean {
  const key = env.RESEND_API_KEY;
  return Boolean(key && !key.toLowerCase().includes('placeholder') && !key.toLowerCase().includes('skip_needs_human'));
}

async function dispatchEmailDeliveries(env: Env, deliveries: NormalizedQueueDelivery[]): Promise<void> {
  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isTransactionalEmailJob(delivery.input.jobType)) continue;
    const payload = emailPayload(delivery.input.payload);
    if (!payload) {
      throw new QueueProcessingError(`${delivery.input.jobType} payload is invalid`, { deterministic: true });
    }

    if (!resendConfigured(env)) {
      writeQueueLog('error', {
        job_type: delivery.input.jobType,
        status: 'missing-resend-secret',
        order_id: payload.orderId || null,
        invite_id: payload.inviteId || null,
        contact_submission_id: payload.contactSubmissionId || null,
        store_id: payload.storeId || delivery.input.siteId,
        request_id: delivery.input.requestId,
      });
      continue;
    }

    const result = await sendResendEmail({
      apiKey: env.RESEND_API_KEY!,
      from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    if (!result.success) {
      throw new QueueProcessingError(result.error || 'Resend order confirmation failed', { deterministic: false });
    }

    writeQueueLog('info', {
      job_type: delivery.input.jobType,
      status: 'sent',
      order_id: payload.orderId || null,
      invite_id: payload.inviteId || null,
      contact_submission_id: payload.contactSubmissionId || null,
      store_id: payload.storeId || delivery.input.siteId,
      request_id: delivery.input.requestId,
    });
  }
}

async function triggerCustomDomainReconciler(env: Env, cron: string): Promise<void> {
  if (!env.API_GATEWAY_SERVICE || !env.INTERNAL_API_SECRET) {
    writeQueueLog('error', {
      route: 'scheduled.custom_domain_reconciler',
      status: 'missing-binding-or-secret',
    });
    return;
  }

  const url = new URL('https://queue-workers.internal/v1/internal/custom-domain-reconcile/run');
  if (env.CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT) {
    url.searchParams.set('limit', env.CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT);
  }

  const response = await env.API_GATEWAY_SERVICE.fetch(new Request(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-API-Secret': env.INTERNAL_API_SECRET,
      'X-Request-ID': `custom-domain-reconcile:${cron}:${Date.now()}`,
    },
  }));

  const body = await response.json().catch(() => null) as unknown;
  writeQueueLog(response.ok ? 'info' : 'error', {
    route: 'scheduled.custom_domain_reconciler',
    status: response.ok ? 'completed' : 'failed',
    response_status: response.status,
    result: body,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', runtime: env.RUNTIME_NAME || 'queue-workers' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
  async queue(batch, env) {
    const deliveries = await normalizeDeliveries(env, batch);

    try {
      await persistQueueBatch(env, deliveries);
      await recordQueueBatchMetric(env, batch, deliveries);
      let platformQueueResult: unknown = [];

      try {
        platformQueueResult = await consumePlatformQueuesForCloudflareQueue(env, {
          cloudflareQueueName: batch.queue,
          bodyQueueName: sharedBodyQueueName(deliveries),
          workerId: `cloudflare:${batch.queue}:batch:${deliveries[0]?.input.messageId || crypto.randomUUID()}:${deliveries.length}`,
        });
      } catch (error) {
        platformQueueResult = {
          status: 'drain_failed',
          error: error instanceof Error ? error.message : 'platform queue drain failed',
        };
        writeQueueLog('error', {
          queue_name: batch.queue,
          message_count: deliveries.length,
          status: 'platform-drain-failed',
          error: platformQueueResult,
        });
      }

      await dispatchEmailDeliveries(env, deliveries);
      const riskScoringResult = await processRiskScoringDeliveries(env, deliveries);
      const reviewCheckResult = await processReviewCheckDeliveries(env, deliveries);
      const supportAutomationResult = await processSupportAutomationDeliveries(env, deliveries);
      const complianceResult = await processComplianceDeliveries(env, deliveries);
      const executiveAnalyticsResult = await processExecutiveAnalyticsDeliveries(env, deliveries);
      const incidentCommandResult = await processIncidentCommandDeliveries(env, deliveries);

      for (const delivery of deliveries) delivery.message.ack();
      writeQueueLog('info', {
        queue_name: batch.queue,
        message_count: deliveries.length,
        status: 'acked',
        quarantined: deliveries.filter((delivery) => delivery.status === 'dead-lettered').length,
        platform_queue_result: platformQueueResult,
        risk_scoring_result: riskScoringResult,
        review_check_result: reviewCheckResult,
        support_automation_result: supportAutomationResult,
        compliance_result: complianceResult,
        executive_analytics_result: executiveAnalyticsResult,
        incident_command_result: incidentCommandResult,
      });
    } catch (error) {
      for (const delivery of deliveries) delivery.message.retry();
      writeQueueLog('error', {
        queue_name: batch.queue,
        message_count: deliveries.length,
        status: 'retry',
        error: error instanceof Error ? error.message : 'queue batch failed',
      });
    }
  },
  async scheduled(controller, env, ctx) {
    const cron = controller.cron || 'manual';
    ctx.waitUntil(triggerCustomDomainReconciler(env, cron));
    ctx.waitUntil(
      runInventoryReservationSweeper(env, {
        requestId: `scheduled:inventory-reservation-sweeper:${cron}:${Date.now()}`,
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.inventory_reservation_sweeper',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.inventory_reservation_sweeper',
          status: 'failed',
          error: error instanceof Error ? error.message : 'inventory reservation sweeper failed',
        })),
    );
    ctx.waitUntil(
      runMerchantSessionJtiConsumptionSweeper(env, {
        requestId: `scheduled:merchant-session-jti-sweeper:${cron}:${Date.now()}`,
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.merchant_session_jti_sweeper',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.merchant_session_jti_sweeper',
          status: 'failed',
          error: error instanceof Error ? error.message : 'merchant session jti sweeper failed',
        })),
    );
    ctx.waitUntil(
      runSloTelemetryEmitter(env, {
        requestId: `scheduled:slo-telemetry-emitter:${cron}:${Date.now()}`,
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.slo_telemetry_emitter',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.slo_telemetry_emitter',
          status: 'failed',
          error: error instanceof Error ? error.message : 'SLO telemetry emitter failed',
        })),
    );
    ctx.waitUntil(
      runMoneyLedgerReconciliation(env, {
        requestId: `scheduled:money-ledger-reconciliation:${cron}:${Date.now()}`,
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.money_ledger_reconciliation',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.money_ledger_reconciliation',
          status: 'failed',
          error: error instanceof Error ? error.message : 'money ledger reconciliation failed',
        })),
    );
    ctx.waitUntil(
      runExecutiveAnalyticsRollup(env, {
        requestId: `scheduled:executive-analytics:${cron}:${Date.now()}`,
        reason: 'Nightly executive analytics rollup from queue-worker scheduled trigger.',
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.executive_analytics_rollup',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.executive_analytics_rollup',
          status: 'failed',
          error: error instanceof Error ? error.message : 'executive analytics rollup failed',
        })),
    );
    ctx.waitUntil(
      runIncidentPostmortemReminders(env, {
        requestId: `scheduled:incident-postmortem-reminder:${cron}:${Date.now()}`,
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.incident_postmortem_reminder',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.incident_postmortem_reminder',
          status: 'failed',
          error: error instanceof Error ? error.message : 'incident postmortem reminder failed',
        })),
    );
    ctx.waitUntil(
      runComplianceAuditExportDryRun(env, {
        requestId: `scheduled:compliance-audit-export:${cron}:${Date.now()}`,
        reason: 'Scheduled local dry-run audit export cursor advance.',
      })
        .then((result) => writeQueueLog('info', {
          route: 'scheduled.compliance_audit_export',
          status: 'completed',
          result,
        }))
        .catch((error) => writeQueueLog('error', {
          route: 'scheduled.compliance_audit_export',
          status: 'failed',
          error: error instanceof Error ? error.message : 'compliance audit export failed',
        })),
    );
  },
} satisfies ExportedHandler<Env, QueuePayload | Record<string, unknown>>;
