import {
  eventRetryDelaySeconds,
  getDomainEventContract,
  parseDomainEventPayload,
  type DomainEventType,
  type RuntimeEventEnvelope,
} from '@letbuyy/event-core';
import {
  normalizeQueueEnvelope,
  planAnalyticsEventStreamRecord,
  planOrderItemAnalyticsRollupIncrements,
  planAnalyticsRollupIncrements,
  planDeletedSearchProjectionDocument,
  planOrderSearchProjectionDocument,
  planProductSearchProjectionDocument,
} from './queue-projection-plans';
import {
  planInAppNotificationForEvent,
  planWhatsAppNotificationForEvent,
  type PlannedInAppNotification,
  type PlannedWhatsAppNotification,
} from '@letbuyy/notification-core';
import {
  DEFAULT_APP_REVENUE_SHARE_BPS,
  planSandboxAppPayoutTransfer,
} from '@letbuyy/billing-core';
import {
  createSupabaseServiceClient,
  type SupabaseClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import { emitGatewayDomainEvent, type GatewayServiceBinding } from '@letbuyy/infrastructure/gateway-events-adapter';
import {
  createWhatsAppCommerceAdapter,
  type WhatsAppSendResult,
} from '@letbuyy/infrastructure/whatsapp-commerce-adapter';
import {
  dispatchPushNotificationToDevices,
  type PushNotificationDispatchResult,
  type PushProviderEnv,
} from './push-dispatcher';

type JsonObject = Record<string, unknown>;
export type PlatformQueueName = 'analytics-events' | 'search-indexing' | 'payment-events';

interface PlatformQueueJob {
  id: string;
  site_id: string | null;
  outbox_event_id: string | null;
  event_id: string;
  queue_name: PlatformQueueName;
  job_type: string;
  payload: JsonObject;
  attempts: number;
  max_attempts: number;
  request_id: string | null;
  trace_id: string | null;
  idempotency_key: string;
  schema_version: number;
}

interface EventEnvelope {
  id?: string;
  type?: string;
  site_id?: string | null;
  aggregate?: {
    type?: string;
    id?: string;
  };
  occurred_at?: string;
  request_id?: string | null;
  trace_id?: string | null;
  idempotency_key?: string;
  schema_version?: number;
  payload?: JsonObject;
}

interface ProductSearchRow {
  id: string;
  store_id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  category?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  status?: string | null;
  is_active?: boolean | null;
  price?: number | string | null;
  deleted_at?: string | null;
}

interface OrderSearchRow {
  id: string;
  store_id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  total?: number | string | null;
  deleted_at?: string | null;
}

interface OrderWhatsAppRow {
  id: string;
  store_id?: string | null;
  site_id?: string | null;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  total?: number | string | null;
  currency?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  cod_expires_at?: string | null;
}

interface WaOptInRow {
  consent_status?: string | null;
  revoked_at?: string | null;
}

interface CodConfirmationRequestRow {
  id: string;
  site_id: string;
  order_id: string;
  expires_at?: string | null;
  idempotency_key?: string | null;
}

interface OrderItemAnalyticsRow {
  product_id?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  total?: number | string | null;
}

interface SiteNotificationOwner {
  custom_user_id?: string | null;
  user_id?: string | null;
}

interface AppChargeEventPayload {
  site_id?: string;
  app_id?: string;
  installation_id?: string;
  charge_id?: string;
  billing_mode?: 'recurring' | 'one_time' | 'usage';
  amount?: {
    amount_minor?: number;
    currency?: 'INR';
  };
  payout_rail?: 'razorpay_route' | 'upi' | 'manual';
  provider_reference?: string;
  provider_mode?: 'sandbox' | 'live';
  revenue_share_bps?: number;
  partner_gst_bps?: number;
  partner_gst_minor?: number;
}

interface MarketplaceAppPayoutContext {
  id: string;
  developer_id: string;
}

interface PayoutLedgerEntry {
  id: string;
  partner_id: string;
  partner_amount_minor: number;
  status?: string;
  metadata?: JsonObject | null;
}

export interface PlatformQueueConsumeResult {
  worker_id: string;
  queue_name: PlatformQueueName;
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  deterministic_failed?: number;
  transient_failed?: number;
  circuit_open?: boolean;
  skipped_reason?: 'budget_exhausted' | 'circuit_open' | 'queue_drain_failed';
  error?: string;
}

export interface PlatformQueueConsumerEnv extends SupabaseServiceEnv, PushProviderEnv {
  API_GATEWAY_SERVICE?: GatewayServiceBinding;
  INTERNAL_API_SECRET?: string;
  WHATSAPP_PROVIDER_MODE?: string;
  WHATSAPP_PROVIDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  WHATSAPP_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
  APP_ENV?: string;
  NODE_ENV?: string;
  PLATFORM_QUEUE_CLAIM_LIMIT?: string;
  PLATFORM_QUEUE_DRAIN_BUDGET_PER_BATCH?: string;
  PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD?: string;
  PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS?: string;
  PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT?: string;
}

export interface PlatformQueueConsumeInput {
  cloudflareQueueName: string;
  bodyQueueName?: string | null;
  workerId?: string;
  limit?: number;
}

interface QueueCircuitState {
  failures: number;
  openedUntil: number;
}

class DeterministicQueueJobError extends Error {
  readonly deterministic = true;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DeterministicQueueJobError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const queueCircuitBreakers = new Map<PlatformQueueName, QueueCircuitState>();

function clampBps(value: unknown, fallback: number): number {
  const numberValue = Math.trunc(Number(value));
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(10000, numberValue));
}

function payoutRail(value: unknown): 'razorpay_route' | 'upi' | 'manual' {
  switch (value) {
    case 'razorpay_route':
    case 'upi':
    case 'manual':
      return value;
    default:
      return 'razorpay_route';
  }
}

function claimLimit(env: PlatformQueueConsumerEnv, requested?: number): number {
  const configured = requested ?? Number(env.PLATFORM_QUEUE_CLAIM_LIMIT || 25);
  if (!Number.isFinite(configured)) return 25;
  return Math.min(Math.max(Math.trunc(configured), 1), 100);
}

function drainBudget(env: PlatformQueueConsumerEnv, requested?: number): number {
  const configured = requested ?? Number(env.PLATFORM_QUEUE_DRAIN_BUDGET_PER_BATCH || env.PLATFORM_QUEUE_CLAIM_LIMIT || 25);
  if (!Number.isFinite(configured)) return 25;
  return Math.min(Math.max(Math.trunc(configured), 1), 100);
}

function circuitFailureThreshold(env: PlatformQueueConsumerEnv): number {
  const configured = Number(env.PLATFORM_QUEUE_CIRCUIT_FAILURE_THRESHOLD || 3);
  if (!Number.isFinite(configured)) return 3;
  return Math.min(Math.max(Math.trunc(configured), 1), 25);
}

function circuitOpenMilliseconds(env: PlatformQueueConsumerEnv): number {
  const configured = Number(env.PLATFORM_QUEUE_CIRCUIT_OPEN_SECONDS || 60);
  if (!Number.isFinite(configured)) return 60_000;
  return Math.min(Math.max(Math.trunc(configured), 5), 3600) * 1000;
}

function genericFanoutEnabled(env: PlatformQueueConsumerEnv): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(env.PLATFORM_QUEUE_DRAIN_GENERIC_FANOUT || '').trim().toLowerCase());
}

function normalizeWhatsAppPhone(value: unknown): string {
  return String(value || '')
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .trim();
}

function textValue(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
  return text || null;
}

function isMissingOptionalWhatsAppTable(error: { message?: string } | null | undefined): boolean {
  const text = error?.message?.toLowerCase() || '';
  return text.includes('schema cache') || text.includes('does not exist') || text.includes('could not find');
}

function formatOrderTotal(total: number | string | null | undefined, currency: string | null | undefined): string {
  const amount = Number(total);
  const displayCurrency = currency || 'INR';
  if (!Number.isFinite(amount)) return displayCurrency;
  return `${displayCurrency} ${amount.toFixed(2)}`;
}

function payloadText(payload: JsonObject, key: string): string | null {
  return textValue(payload[key]);
}

function isCircuitOpen(queueName: PlatformQueueName): boolean {
  const state = queueCircuitBreakers.get(queueName);
  if (!state) return false;
  if (state.openedUntil > Date.now()) return true;

  if (state.openedUntil > 0) {
    queueCircuitBreakers.delete(queueName);
  }

  return false;
}

function recordQueueDrainSuccess(queueName: PlatformQueueName): void {
  queueCircuitBreakers.delete(queueName);
}

function recordQueueDrainFailure(env: PlatformQueueConsumerEnv, queueName: PlatformQueueName): void {
  const current = queueCircuitBreakers.get(queueName) || { failures: 0, openedUntil: 0 };
  const failures = current.failures + 1;
  const openedUntil = failures >= circuitFailureThreshold(env)
    ? Date.now() + circuitOpenMilliseconds(env)
    : current.openedUntil;

  queueCircuitBreakers.set(queueName, { failures, openedUntil });
}

function deterministicQueueJobError(message: string, cause?: unknown): DeterministicQueueJobError {
  return new DeterministicQueueJobError(message, { cause });
}

function isDeterministicQueueJobError(error: unknown): boolean {
  return error instanceof DeterministicQueueJobError;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function queueResult(input: {
  workerId: string;
  queueName: PlatformQueueName;
  skippedReason?: PlatformQueueConsumeResult['skipped_reason'];
  circuitOpen?: boolean;
  error?: unknown;
}): PlatformQueueConsumeResult {
  return {
    worker_id: input.workerId,
    queue_name: input.queueName,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    circuit_open: input.circuitOpen,
    skipped_reason: input.skippedReason,
    error: input.error instanceof Error ? input.error.message : typeof input.error === 'string' ? input.error : undefined,
  };
}

export function platformQueueNamesForCloudflareQueue(
  cloudflareQueueName: string,
  bodyQueueName?: string | null,
  options: { allowGenericFanout?: boolean } = {},
): PlatformQueueName[] {
  const queueName = `${cloudflareQueueName} ${bodyQueueName || ''}`.toLowerCase();
  if (queueName.includes('dead-letter')) return [];
  if (queueName.includes('search')) return ['search-indexing'];
  if (queueName.includes('payment')) return ['payment-events'];
  if (queueName.includes('analytics') || queueName.includes('notification')) return ['analytics-events'];
  return options.allowGenericFanout ? ['analytics-events', 'search-indexing', 'payment-events'] : [];
}

export async function consumePlatformQueuesForCloudflareQueue(
  env: PlatformQueueConsumerEnv,
  input: PlatformQueueConsumeInput,
): Promise<PlatformQueueConsumeResult[]> {
  const queueNames = platformQueueNamesForCloudflareQueue(input.cloudflareQueueName, input.bodyQueueName, {
    allowGenericFanout: genericFanoutEnabled(env),
  });
  if (queueNames.length === 0) return [];

  const db = createSupabaseServiceClient(env);
  const consumer = new PlatformQueueConsumer(db, env);
  const workerId = input.workerId || `queue-workers:${input.cloudflareQueueName}:${crypto.randomUUID()}`;
  return consumer.consumeQueues(workerId, queueNames, drainBudget(env, input.limit));
}

class PlatformQueueConsumer {
  constructor(
    private db: SupabaseClient,
    private env: PlatformQueueConsumerEnv,
  ) {}

  async consumeQueues(
    workerId: string,
    queueNames: PlatformQueueName[],
    totalBudget: number,
  ): Promise<PlatformQueueConsumeResult[]> {
    const results: PlatformQueueConsumeResult[] = [];
    let remainingBudget = totalBudget;

    for (const queueName of queueNames) {
      if (remainingBudget <= 0) {
        results.push(queueResult({ workerId, queueName, skippedReason: 'budget_exhausted' }));
        continue;
      }

      if (isCircuitOpen(queueName)) {
        results.push(queueResult({
          workerId,
          queueName,
          circuitOpen: true,
          skippedReason: 'circuit_open',
          error: `Circuit open for ${queueName}`,
        }));
        continue;
      }

      try {
        const result = await this.consumeQueue(workerId, queueName, Math.min(remainingBudget, claimLimit(this.env)));
        remainingBudget -= result.claimed;
        recordQueueDrainSuccess(queueName);
        results.push(result);
      } catch (error) {
        recordQueueDrainFailure(this.env, queueName);
        results.push(queueResult({ workerId, queueName, skippedReason: 'queue_drain_failed', error }));
      }
    }

    return results;
  }

  private async consumeQueue(workerId: string, queueName: PlatformQueueName, limit: number): Promise<PlatformQueueConsumeResult> {
    const jobs = await this.claimJobs(workerId, queueName, limit);
    const result: PlatformQueueConsumeResult = {
      worker_id: workerId,
      queue_name: queueName,
      claimed: jobs.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      deterministic_failed: 0,
      transient_failed: 0,
    };

    for (const job of jobs) {
      try {
        const processed = queueName === 'analytics-events'
          ? await this.processAnalyticsJob(job)
          : queueName === 'search-indexing'
            ? await this.processSearchJob(job)
            : await this.processPaymentJob(job);

        await this.completeJob(workerId, job.id, { processed, consumer_runtime: 'services/queue-workers' });
        if (processed) {
          result.succeeded += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        if (isDeterministicQueueJobError(error)) {
          result.deterministic_failed = (result.deterministic_failed || 0) + 1;
          await this.quarantineJob(workerId, job, error);
        } else {
          result.transient_failed = (result.transient_failed || 0) + 1;
          await this.failJob(workerId, job, error);
        }
      }
    }

    return result;
  }

  private async claimJobs(workerId: string, queueName: PlatformQueueName, limit: number): Promise<PlatformQueueJob[]> {
    const { data, error } = await this.db.rpc('claim_platform_queue_jobs', {
      p_queue_name: queueName,
      p_worker_id: workerId,
      p_limit: limit,
      p_lock_seconds: 120,
    });

    if (error) {
      throw new Error(`Queue claim failed for ${queueName}: ${error.message}`);
    }

    return Array.isArray(data) ? data as PlatformQueueJob[] : [];
  }

  private toRuntimeEventEnvelope(
    job: PlatformQueueJob,
    envelope: EventEnvelope,
    input: {
      eventType: string;
      eventId: string;
      siteId?: string | null;
      aggregateType?: string | null;
      aggregateId?: string | null;
      occurredAt?: string;
    },
  ): RuntimeEventEnvelope<JsonObject> {
    return {
      event_id: input.eventId,
      event_type: input.eventType,
      source_runtime: 'services/queue-workers',
      site_id: input.siteId || undefined,
      aggregate_type: input.aggregateType || undefined,
      aggregate_id: input.aggregateId || undefined,
      occurred_at: input.occurredAt || new Date().toISOString(),
      payload: envelope.payload || {},
      request_id: envelope.request_id || job.request_id || undefined,
      idempotency_key: envelope.idempotency_key || job.idempotency_key,
    };
  }

  private async processAnalyticsJob(job: PlatformQueueJob): Promise<boolean> {
    if (!isJsonObject(job.payload)) {
      throw deterministicQueueJobError(`Queue job ${job.id} payload must be a JSON object`);
    }

    const envelope = normalizeQueueEnvelope<EventEnvelope>(job.payload);
    const siteId = job.site_id || envelope.site_id;
    if (!siteId) return false;

    const eventType = envelope.type || job.job_type;
    const aggregateType = envelope.aggregate?.type || null;
    const aggregateId = envelope.aggregate?.id || null;
    const occurredAt = envelope.occurred_at || new Date().toISOString();
    const eventId = envelope.id || job.event_id;

    const { error } = await this.db
      .from('analytics_event_stream')
      .upsert(
        planAnalyticsEventStreamRecord({
          siteId,
          eventId,
          eventType,
          aggregateType,
          aggregateId,
          occurredAt,
          requestId: envelope.request_id || job.request_id,
          traceId: envelope.trace_id || job.trace_id,
          idempotencyKey: envelope.idempotency_key || job.idempotency_key,
          schemaVersion: envelope.schema_version || job.schema_version,
          properties: envelope.payload || {},
        }),
        { onConflict: 'event_id' },
      );

    if (error) throw new Error(`Analytics event stream write failed: ${error.message}`);

    for (const rollup of planAnalyticsRollupIncrements({
      siteId,
      eventType,
      occurredAt,
      aggregateType,
      aggregateId,
      payload: envelope.payload || {},
    })) {
      await this.incrementRollup(rollup);
    }

    if (eventType === 'order.created') {
      await this.incrementOrderItemRollups(siteId, eventId, occurredAt);
    }

    await this.processNotificationSideEffect(job, this.toRuntimeEventEnvelope(job, envelope, {
      eventType,
      eventId,
      siteId,
      aggregateType,
      aggregateId,
      occurredAt,
    }));

    return true;
  }

  private async incrementOrderItemRollups(siteId: string, orderId: string, occurredAt: string): Promise<void> {
    const { data, error } = await this.db
      .from('order_items')
      .select('product_id, name, sku, quantity, total')
      .eq('order_id', orderId)
      .is('deleted_at', null);

    if (error) throw new Error(`Order item analytics rollup source lookup failed: ${error.message}`);

    const items = Array.isArray(data) ? data as OrderItemAnalyticsRow[] : [];
    for (const rollup of planOrderItemAnalyticsRollupIncrements({
      siteId,
      occurredAt,
      items: items.map((item) => ({
        productId: item.product_id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        total: item.total,
      })),
    })) {
      await this.incrementRollup(rollup);
    }
  }

  private async processNotificationSideEffect(job: PlatformQueueJob, event: RuntimeEventEnvelope<JsonObject>): Promise<void> {
    const contract = getDomainEventContract(event.event_type);
    if (!contract?.consumers.includes('notifications')) return;

    if (event.site_id) {
      await this.expireDueCodConfirmations(job, event.site_id);
    }

    const plannedInApp = planInAppNotificationForEvent(event);
    if (plannedInApp) {
      await this.processInAppNotificationSideEffect(job, event, plannedInApp);
    }

    const plannedWhatsApp = planWhatsAppNotificationForEvent(event);
    if (plannedWhatsApp) {
      await this.processWhatsAppSideEffect(job, event, plannedWhatsApp);
    }
  }

  private async processInAppNotificationSideEffect(
    job: PlatformQueueJob,
    event: RuntimeEventEnvelope<JsonObject>,
    planned: PlannedInAppNotification,
  ): Promise<void> {
    const userId = await this.resolveNotificationUserId(event.site_id || null, event.payload);
    if (!userId) return;
    const openOrderBadgeCount = planned.type === 'order_placed' && event.site_id
      ? await this.resolveOpenOrderBadgeCount(event.site_id)
      : null;
    const notificationData = {
      ...planned.data,
      ...(openOrderBadgeCount !== null
        ? {
          open_order_count: openOrderBadgeCount,
          badge_count: openOrderBadgeCount,
        }
        : {}),
    };

    const { error } = await this.db.from('notifications').insert({
      user_id: userId,
      type: planned.type,
      title: planned.title,
      message: planned.message,
      data: {
        ...notificationData,
        queue_job_id: job.id,
        idempotency_key: event.idempotency_key || job.idempotency_key,
        consumer_runtime: 'services/queue-workers',
      },
      action_url: planned.action_url || null,
    });

    if (error) throw new Error(`Notification dispatch write failed: ${error.message}`);

    const pushResult = await dispatchPushNotificationToDevices(this.db, this.env, {
      userId,
      title: planned.title,
      message: planned.message,
      data: {
        ...notificationData,
        notification_type: planned.type,
      },
      actionUrl: planned.action_url || null,
    });

    await this.recordPushDispatchFailureLog(job, event, planned, userId, pushResult);
  }

  private async processWhatsAppSideEffect(
    job: PlatformQueueJob,
    event: RuntimeEventEnvelope<JsonObject>,
    planned: PlannedWhatsAppNotification,
  ): Promise<void> {
    const siteId = event.site_id || job.site_id;
    const orderId = event.aggregate_id || payloadText(event.payload, 'order_id');
    if (!siteId || !orderId) return;

    const order = await this.loadOrderForWhatsApp(siteId, orderId);
    if (!order) return;

    const customerEmail = textValue(order.customer_email) || payloadText(event.payload, 'customer_email');
    const customerPhone = normalizeWhatsAppPhone(order.customer_phone || event.payload.customer_phone);
    const baseIdempotencyKey = event.idempotency_key || job.idempotency_key || event.event_id || job.id;
    const idempotencyKey = `wa.${planned.category}:${siteId}:${order.id}:${planned.template_key}:${baseIdempotencyKey}`;

    if (!customerPhone) {
      await this.recordWhatsAppDispatchLog(job, event, planned, {
        siteId,
        orderId: order.id,
        customerEmail,
        customerPhone: '',
        status: 'failed',
        provider: 'letbuyy_sandbox',
        errorMessage: 'CUSTOMER_PHONE_REQUIRED',
        idempotencyKey,
      });
      return;
    }

    const consent = await this.hasActiveWhatsAppConsent(siteId, customerPhone, customerEmail);
    if (!consent.optedIn) {
      await this.recordWhatsAppDispatchLog(job, event, planned, {
        siteId,
        orderId: order.id,
        customerEmail,
        customerPhone,
        status: 'suppressed',
        provider: 'letbuyy_sandbox',
        errorMessage: 'WA_CONSENT_REQUIRED',
        idempotencyKey,
        metadata: {
          consent_required: planned.consent_required,
          fail_closed_without_consent: planned.fail_closed_without_consent,
          blocked_by: consent.reason,
        },
      });
      return;
    }

    const adapter = createWhatsAppCommerceAdapter({
      mode: this.env.WHATSAPP_PROVIDER_MODE,
      provider: this.env.WHATSAPP_PROVIDER,
      accountSid: this.env.TWILIO_ACCOUNT_SID,
      authToken: this.env.TWILIO_AUTH_TOKEN,
      from: this.env.TWILIO_WHATSAPP_FROM,
      webhookSecret: this.env.WHATSAPP_WEBHOOK_SECRET,
      environment: this.env.ENVIRONMENT,
      appEnv: this.env.APP_ENV,
      nodeEnv: this.env.NODE_ENV,
    });

    if (!adapter.available) {
      await this.recordWhatsAppDispatchLog(job, event, planned, {
        siteId,
        orderId: order.id,
        customerEmail,
        customerPhone,
        status: 'failed',
        provider: adapter.provider,
        errorMessage: adapter.unavailableReason || 'WHATSAPP_UNAVAILABLE',
        idempotencyKey,
        metadata: {
          provider_mode: adapter.mode,
          sandbox_send: adapter.provider === 'letbuyy_sandbox',
        },
      });
      return;
    }

    let result: WhatsAppSendResult;
    try {
      result = await adapter.sendTemplate({
        storeId: siteId,
        customerEmail,
        toPhone: customerPhone,
        template: planned.template_key,
        variables: this.whatsAppVariablesForOrder(order, planned),
        idempotencyKey,
      });
    } catch (error) {
      await this.recordWhatsAppDispatchLog(job, event, planned, {
        siteId,
        orderId: order.id,
        customerEmail,
        customerPhone,
        status: 'failed',
        provider: adapter.provider,
        errorMessage: error instanceof Error ? error.message : 'WHATSAPP_SEND_FAILED',
        idempotencyKey,
        metadata: {
          provider_mode: adapter.mode,
          sandbox_send: adapter.provider === 'letbuyy_sandbox',
        },
      });
      return;
    }

    const logStatus = result.status === 'failed' ? 'failed' : result.status === 'sent' ? 'sent' : 'queued';
    const metadata = {
      ...result.metadata,
      provider_mode: result.providerMode,
      sandbox_send: result.sandbox,
      queue_job_id: job.id,
      event_id: event.event_id,
      consent_ledger: 'wa_optins',
      bsp_template_approval: result.sandbox ? 'skipped_human' : 'provider_managed',
    };

    await this.writeWhatsAppMessageMirrors({
      siteId,
      customerEmail,
      customerPhone,
      orderId: order.id,
      eventType: event.event_type,
      templateKey: planned.template_key,
      body: result.body,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      status: result.status,
      idempotencyKey,
      metadata,
    });

    await this.upsertWhatsAppSession({
      siteId,
      customerPhone,
      orderId: order.id,
      sessionType: planned.session_type,
      idempotencyKey: `wa.session:${planned.session_type}:${siteId}:${order.id}:${planned.template_key}`,
      expiresAt: planned.session_type === 'cod_confirmation'
        ? order.cod_expires_at || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata,
    });

    await this.recordWhatsAppDispatchLog(job, event, planned, {
      siteId,
      orderId: order.id,
      customerEmail,
      customerPhone,
      status: logStatus,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      body: result.body,
      idempotencyKey,
      metadata,
    });
  }

  private async loadOrderForWhatsApp(siteId: string, orderId: string): Promise<OrderWhatsAppRow | null> {
    const { data, error } = await this.db
      .from('orders')
      .select('id, store_id, site_id, order_number, customer_name, customer_email, customer_phone, status, total, currency, carrier, tracking_number, cod_expires_at')
      .eq('id', orderId)
      .or(`store_id.eq.${siteId},site_id.eq.${siteId}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`WhatsApp order lookup failed: ${error.message}`);
    return data as OrderWhatsAppRow | null;
  }

  private async hasActiveWhatsAppConsent(
    siteId: string,
    customerPhone: string,
    customerEmail: string | null,
  ): Promise<{ optedIn: boolean; reason: 'active' | 'missing_ledger' | 'missing_opt_in' | 'withdrawn_or_not_opted_in' }> {
    const phoneResult = await this.db
      .from('wa_optins')
      .select('id, consent_status, revoked_at')
      .eq('site_id', siteId)
      .eq('customer_phone', customerPhone)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (phoneResult.error) {
      if (isMissingOptionalWhatsAppTable(phoneResult.error)) return { optedIn: false, reason: 'missing_ledger' };
      throw new Error(`WhatsApp consent lookup failed: ${phoneResult.error.message}`);
    }

    const phoneRow = phoneResult.data as WaOptInRow | null;
    if (phoneRow) {
      const optedIn = phoneRow.consent_status === 'opted_in' && !phoneRow.revoked_at;
      return {
        optedIn,
        reason: optedIn ? 'active' : 'withdrawn_or_not_opted_in',
      };
    }

    if (!customerEmail) return { optedIn: false, reason: 'missing_opt_in' };

    const emailResult = await this.db
      .from('wa_optins')
      .select('id, consent_status, revoked_at')
      .eq('site_id', siteId)
      .eq('customer_email', customerEmail)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emailResult.error) {
      if (isMissingOptionalWhatsAppTable(emailResult.error)) return { optedIn: false, reason: 'missing_ledger' };
      throw new Error(`WhatsApp consent email lookup failed: ${emailResult.error.message}`);
    }

    const emailRow = emailResult.data as WaOptInRow | null;
    if (!emailRow) return { optedIn: false, reason: 'missing_opt_in' };

    const optedIn = emailRow?.consent_status === 'opted_in' && !emailRow.revoked_at;
    return {
      optedIn,
      reason: optedIn ? 'active' : 'withdrawn_or_not_opted_in',
    };
  }

  private whatsAppVariablesForOrder(
    order: OrderWhatsAppRow,
    planned: PlannedWhatsAppNotification,
  ): Record<string, string | number | boolean | null> {
    return {
      customer_name: order.customer_name || order.customer_email || 'customer',
      order_number: order.order_number || order.id,
      status: planned.event_status === 'cod_confirmation_requested' ? 'pending COD confirmation' : planned.event_status,
      total: formatOrderTotal(order.total, order.currency),
      carrier: order.carrier || 'your carrier',
      tracking_number: order.tracking_number || 'pending',
    };
  }

  private async writeWhatsAppMessageMirrors(input: {
    siteId: string;
    customerEmail: string | null;
    customerPhone: string;
    orderId: string;
    eventType: string;
    templateKey: string;
    body: string;
    provider: string;
    providerMessageId: string;
    status: string;
    idempotencyKey: string;
    metadata: JsonObject;
  }): Promise<void> {
    const customerWrite = await this.db
      .from('customer_whatsapp_messages')
      .upsert(
        {
          store_id: input.siteId,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          direction: 'outbound',
          template: input.templateKey,
          message: input.body,
          provider: input.provider,
          provider_message_id: input.providerMessageId,
          status: input.status,
          idempotency_key: input.idempotencyKey,
          metadata: input.metadata,
        },
        { onConflict: 'store_id,idempotency_key' },
      );

    if (customerWrite.error && !isMissingOptionalWhatsAppTable(customerWrite.error)) {
      throw new Error(`WhatsApp customer message write failed: ${customerWrite.error.message}`);
    }

    const mirrorWrite = await this.db
      .from('whatsapp_messages')
      .upsert(
        {
          site_id: input.siteId,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
          direction: 'outbound',
          template_key: input.templateKey,
          body: input.body,
          provider: input.provider,
          provider_message_id: input.providerMessageId,
          status: input.status,
          order_id: input.orderId,
          event_type: input.eventType,
          idempotency_key: input.idempotencyKey,
          metadata: input.metadata,
        },
        { onConflict: 'site_id,idempotency_key' },
      );

    if (mirrorWrite.error && !isMissingOptionalWhatsAppTable(mirrorWrite.error)) {
      throw new Error(`WhatsApp message mirror write failed: ${mirrorWrite.error.message}`);
    }
  }

  private async upsertWhatsAppSession(input: {
    siteId: string;
    customerPhone: string;
    orderId: string;
    sessionType: 'lifecycle' | 'cod_confirmation';
    idempotencyKey: string;
    expiresAt: string;
    metadata: JsonObject;
  }): Promise<void> {
    const { error } = await this.db
      .from('wa_sessions')
      .upsert(
        {
          site_id: input.siteId,
          customer_phone: input.customerPhone,
          order_id: input.orderId,
          session_type: input.sessionType,
          status: 'open',
          last_message_at: new Date().toISOString(),
          expires_at: input.expiresAt,
          idempotency_key: input.idempotencyKey,
          metadata: input.metadata,
        },
        { onConflict: 'site_id,idempotency_key' },
      );

    if (error && !isMissingOptionalWhatsAppTable(error)) {
      throw new Error(`WhatsApp session write failed: ${error.message}`);
    }
  }

  private async recordWhatsAppDispatchLog(
    job: PlatformQueueJob,
    event: RuntimeEventEnvelope<JsonObject>,
    planned: PlannedWhatsAppNotification,
    input: {
      siteId: string;
      orderId: string;
      customerEmail: string | null;
      customerPhone: string;
      status: 'queued' | 'sent' | 'failed' | 'suppressed';
      provider: string;
      providerMessageId?: string | null;
      body?: string | null;
      errorMessage?: string | null;
      idempotencyKey: string;
      metadata?: JsonObject;
    },
  ): Promise<void> {
    const { error } = await this.db
      .from('notification_logs')
      .upsert(
        {
          site_id: input.siteId,
          channel: 'whatsapp',
          category: planned.category,
          template_key: planned.template_key,
          event_type: event.event_type,
          recipient: {
            order_id: input.orderId,
            customer_email: input.customerEmail,
            customer_phone: input.customerPhone || null,
          },
          body: input.body || null,
          status: input.status,
          provider: input.provider,
          provider_message_id: input.providerMessageId || null,
          error_message: input.errorMessage || null,
          request_id: event.request_id || job.request_id,
          trace_id: job.trace_id,
          idempotency_key: `notification:${input.idempotencyKey}`,
          metadata: {
            queue_job_id: job.id,
            event_id: event.event_id,
            aggregate_type: event.aggregate_type || null,
            aggregate_id: event.aggregate_id || null,
            consent_required: planned.consent_required,
            fail_closed_without_consent: planned.fail_closed_without_consent,
            ...(input.metadata || {}),
          },
        },
        { onConflict: 'site_id,idempotency_key' },
      );

    if (error) throw new Error(`WhatsApp notification log write failed: ${error.message}`);
  }

  private async expireDueCodConfirmations(job: PlatformQueueJob, siteId: string): Promise<void> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('cod_confirmation_requests')
      .select('id, site_id, order_id, expires_at, idempotency_key')
      .eq('site_id', siteId)
      .eq('status', 'requested')
      .lte('expires_at', now)
      .is('deleted_at', null)
      .limit(25);

    if (error) {
      if (isMissingOptionalWhatsAppTable(error)) return;
      throw new Error(`COD confirmation expiry lookup failed: ${error.message}`);
    }

    const requests = Array.isArray(data) ? data as CodConfirmationRequestRow[] : [];
    for (const request of requests) {
      await this.expireCodConfirmationRequest(job, request, now);
    }
  }

  private async expireCodConfirmationRequest(
    job: PlatformQueueJob,
    request: CodConfirmationRequestRow,
    now: string,
  ): Promise<void> {
    const responsePayload = {
      reason: 'no_whatsapp_confirmation',
      queue_job_id: job.id,
      expired_at: now,
      fail_closed: true,
    };

    const requestUpdate = await this.db
      .from('cod_confirmation_requests')
      .update({
        status: 'expired',
        response_payload: responsePayload,
        updated_at: now,
      })
      .eq('id', request.id)
      .eq('site_id', request.site_id)
      .eq('status', 'requested');

    if (requestUpdate.error) throw new Error(`COD confirmation expiry update failed: ${requestUpdate.error.message}`);

    const orderUpdate = await this.db
      .from('orders')
      .update({
        status: 'cancelled',
        cod_confirmation_status: 'expired',
        fulfillment_state: 'cancelled',
        rto_status: 'at_risk',
        updated_at: now,
      })
      .eq('id', request.order_id)
      .eq('store_id', request.site_id)
      .in('status', ['pending_cod', 'pending']);

    if (orderUpdate.error) throw new Error(`COD confirmation order expiry update failed: ${orderUpdate.error.message}`);

    await this.recordCodExpiryLog(job, request, now);
  }

  private async recordCodExpiryLog(
    job: PlatformQueueJob,
    request: CodConfirmationRequestRow,
    now: string,
  ): Promise<void> {
    const { error } = await this.db
      .from('notification_logs')
      .upsert(
        {
          site_id: request.site_id,
          channel: 'whatsapp',
          category: 'cod_confirmation',
          template_key: 'cod_confirmation',
          event_type: 'cod.confirmation_expired',
          recipient: { order_id: request.order_id },
          status: 'failed',
          provider: 'letbuyy_sandbox',
          error_message: 'COD confirmation expired without customer reply',
          idempotency_key: `wa.cod.expired:${request.site_id}:${request.order_id}:${request.id}`,
          metadata: {
            queue_job_id: job.id,
            expired_at: now,
            source_request_id: request.id,
            source_idempotency_key: request.idempotency_key || null,
            fail_closed: true,
            auto_cancelled: true,
          },
        },
        { onConflict: 'site_id,idempotency_key' },
      );

    if (error) throw new Error(`COD confirmation expiry log write failed: ${error.message}`);
  }

  private async recordPushDispatchFailureLog(
    job: PlatformQueueJob,
    event: RuntimeEventEnvelope<JsonObject>,
    planned: PlannedInAppNotification,
    userId: string,
    pushResult: PushNotificationDispatchResult,
  ): Promise<void> {
    if (pushResult.failed <= 0) return;

    const siteId = event.site_id || job.site_id;
    if (!siteId) return;

    const baseIdempotencyKey = event.idempotency_key || job.idempotency_key || event.event_id || job.id;
    const failureMessage = `Push dispatch failed for ${pushResult.failed} of ${pushResult.attempted} attempted device(s).`;
    const { error } = await this.db
      .from('notification_logs')
      .upsert(
        {
          site_id: siteId,
          user_id: userId,
          channel: 'push',
          category: planned.type,
          template_key: `mobile_push.${planned.type}`,
          event_type: event.event_type,
          recipient: { user_id: userId },
          subject: planned.title,
          body: planned.message,
          status: 'failed',
          provider: pushResult.providers.join(',') || null,
          attempt_count: pushResult.attempted,
          error_message: failureMessage,
          request_id: event.request_id || job.request_id,
          trace_id: job.trace_id,
          idempotency_key: `push.failure:${baseIdempotencyKey}:${planned.type}`,
          metadata: {
            queue_job_id: job.id,
            event_id: event.event_id,
            aggregate_type: event.aggregate_type || null,
            aggregate_id: event.aggregate_id || null,
            sent: pushResult.sent,
            failed: pushResult.failed,
            skipped: pushResult.skipped,
            attempted: pushResult.attempted,
            providers: pushResult.providers,
            dry_run: pushResult.dryRun,
            failure_details: pushResult.failureDetails,
          },
        },
        { onConflict: 'site_id,idempotency_key' },
      );

    if (error) throw new Error(`Push dispatch failure log write failed: ${error.message}`);
  }

  private async resolveOpenOrderBadgeCount(siteId: string): Promise<number | null> {
    const { count, error } = await this.db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .not('status', 'in', '(delivered,cancelled,refunded)');

    if (error) return null;
    return typeof count === 'number' ? count : null;
  }

  private async resolveNotificationUserId(siteId: string | null, payload: JsonObject): Promise<string | null> {
    if (typeof payload.owner_user_id === 'string') return payload.owner_user_id;

    if (typeof payload.partner_id === 'string') {
      const { data, error } = await this.db
        .from('app_developers')
        .select('user_id')
        .eq('id', payload.partner_id)
        .maybeSingle();

      if (error) throw new Error(`Notification partner lookup failed: ${error.message}`);
      if (typeof data?.user_id === 'string') return data.user_id;
    }

    if (!siteId) return null;

    const { data, error } = await this.db
      .from('sites')
      .select('custom_user_id, user_id')
      .eq('id', siteId)
      .maybeSingle();

    if (error) throw new Error(`Notification site owner lookup failed: ${error.message}`);

    const owner = data as SiteNotificationOwner | null;
    return owner?.custom_user_id || owner?.user_id || null;
  }

  private async processSearchJob(job: PlatformQueueJob): Promise<boolean> {
    if (!isJsonObject(job.payload)) {
      throw deterministicQueueJobError(`Queue job ${job.id} payload must be a JSON object`);
    }

    const envelope = normalizeQueueEnvelope<EventEnvelope>(job.payload);
    const aggregateType = envelope.aggregate?.type || '';
    const aggregateId = envelope.aggregate?.id || '';

    if (!aggregateId) return false;

    if (aggregateType === 'product' || job.job_type.startsWith('product.')) {
      return this.applyProductSearchIndex(job, aggregateId);
    }

    if (aggregateType === 'order' || job.job_type.startsWith('order.')) {
      return this.applyOrderSearchIndex(job, aggregateId);
    }

    return false;
  }

  private async processPaymentJob(job: PlatformQueueJob): Promise<boolean> {
    if (!isJsonObject(job.payload)) {
      throw deterministicQueueJobError(`Queue job ${job.id} payload must be a JSON object`);
    }

    const envelope = normalizeQueueEnvelope<EventEnvelope>(job.payload);
    const eventType = envelope.type || job.job_type;

    if (eventType === 'app.charge.activated') {
      return this.processAppChargePayout(job, envelope, eventType);
    }

    return false;
  }

  private async processAppChargePayout(job: PlatformQueueJob, envelope: EventEnvelope, eventType: string): Promise<boolean> {
    const payload = (envelope.payload || {}) as AppChargeEventPayload;
    const siteId = payload.site_id || job.site_id;
    const appId = payload.app_id;
    const installationId = payload.installation_id;
    const chargeId = payload.charge_id;
    const billingMode = payload.billing_mode;
    const amountMinor = payload.amount?.amount_minor;
    const eventId = envelope.id || job.event_id;

    if (!siteId || !appId || !installationId || !chargeId || !billingMode || typeof amountMinor !== 'number') {
      return false;
    }

    const { data: app, error: appError } = await this.db
      .from('marketplace_apps')
      .select('id, developer_id')
      .eq('id', appId)
      .maybeSingle();

    if (appError) throw new Error(`Payout app lookup failed: ${appError.message}`);
    const payoutContext = app as MarketplaceAppPayoutContext | null;
    if (!payoutContext?.developer_id) return false;

    const revenueShareBps = clampBps(payload.revenue_share_bps, DEFAULT_APP_REVENUE_SHARE_BPS);
    const partnerAmountMinor = Math.floor((amountMinor * revenueShareBps) / 10000);
    const platformFeeMinor = amountMinor - partnerAmountMinor;
    const partnerGstBps = clampBps(payload.partner_gst_bps, 1800);
    const partnerGstMinor = typeof payload.partner_gst_minor === 'number'
      ? Math.max(0, Math.trunc(payload.partner_gst_minor))
      : Math.round((partnerAmountMinor * partnerGstBps) / 10000);
    const rail = payoutRail(payload.payout_rail);
    const providerMode = payload.provider_mode === 'live' ? 'live' : 'sandbox';
    const ledgerMetadata = {
      source_event_type: eventType,
      queue_job_id: job.id,
      partner_gst_bps: partnerGstBps,
      partner_gst_minor: partnerGstMinor,
      provider_reference: payload.provider_reference || null,
      payout_provider_mode: providerMode,
      consumer_runtime: 'services/queue-workers',
    };

    const { data: existingEntry, error: existingEntryError } = await this.db
      .from('partner_payout_ledger_entries')
      .select('id, partner_id, partner_amount_minor, status, metadata')
      .eq('source_event_id', eventId)
      .maybeSingle();

    if (existingEntryError) throw new Error(`Payout ledger lookup failed: ${existingEntryError.message}`);

    let entry = existingEntry as PayoutLedgerEntry | null;
    if (!entry) {
      const { data: createdEntry, error: entryError } = await this.db
        .from('partner_payout_ledger_entries')
        .insert({
          partner_id: payoutContext.developer_id,
          site_id: siteId,
          app_id: appId,
          installation_id: installationId,
          charge_id: chargeId,
          source_event_id: eventId,
          billing_mode: billingMode,
          amount_minor: amountMinor,
          currency: 'INR',
          revenue_share_bps: revenueShareBps,
          partner_amount_minor: partnerAmountMinor,
          platform_fee_minor: platformFeeMinor,
          status: 'pending',
          rail,
          metadata: ledgerMetadata,
        })
        .select('id, partner_id, partner_amount_minor, status, metadata')
        .single();

      if (entryError) throw new Error(`Payout ledger write failed: ${entryError.message}`);
      entry = createdEntry as PayoutLedgerEntry;
    }

    if (!entry) return false;

    await this.emitDomainEvent({
      storeId: siteId,
      aggregateType: 'payout',
      aggregateId: entry.id,
      eventType: 'payout.ledger_entry.created',
      payload: {
        partner_id: entry.partner_id,
        payout_id: entry.id,
        ledger_entry_id: entry.id,
        amount: {
          amount_minor: entry.partner_amount_minor,
          currency: 'INR',
        },
        rail,
      },
      idempotencyKey: `payout.ledger_entry.created:${eventId}`,
      requestId: envelope.request_id || job.request_id,
      actorId: null,
    });

    if (!['released', 'failed'].includes(String(entry.status || 'pending'))) {
      const processingMetadata = {
        ...(entry.metadata || {}),
        ...ledgerMetadata,
        payout_settlement_started_at: new Date().toISOString(),
      };
      const { error: processingError } = await this.db
        .from('partner_payout_ledger_entries')
        .update({
          status: 'processing',
          metadata: processingMetadata,
        })
        .eq('id', entry.id)
        .in('status', ['pending', 'processing']);

      if (processingError) throw new Error(`Payout processing transition failed: ${processingError.message}`);

      const settlement = planSandboxAppPayoutTransfer({
        ledgerEntryId: entry.id,
        partnerId: entry.partner_id,
        amountMinor: entry.partner_amount_minor,
        currency: 'INR',
        rail,
        providerMode,
        idempotencyKey: `payout.transfer:${eventId}`,
      });
      const settledMetadata = {
        ...processingMetadata,
        payout_statement: settlement.statement,
        payout_failure_reason: settlement.failure_reason || null,
        live_transfer_required: settlement.status === 'processing' && providerMode === 'live',
      };
      const { error: settlementError } = await this.db
        .from('partner_payout_ledger_entries')
        .update({
          status: settlement.status,
          metadata: settledMetadata,
        })
        .eq('id', entry.id);

      if (settlementError) throw new Error(`Payout settlement transition failed: ${settlementError.message}`);

      if (settlement.status === 'released') {
        await this.emitDomainEvent({
          storeId: siteId,
          aggregateType: 'payout',
          aggregateId: entry.id,
          eventType: 'payout.released',
          payload: {
            partner_id: entry.partner_id,
            payout_id: entry.id,
            ledger_entry_id: entry.id,
            amount: {
              amount_minor: entry.partner_amount_minor,
              currency: 'INR',
            },
            rail,
          },
          idempotencyKey: `payout.released:${eventId}`,
          requestId: envelope.request_id || job.request_id,
          actorId: null,
        });
      }
    }

    return true;
  }

  private async emitDomainEvent(input: {
    storeId?: string | null;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload?: JsonObject;
    idempotencyKey: string;
    requestId?: string | null;
    actorId?: string | null;
  }): Promise<void> {
    const contract = getDomainEventContract(input.eventType);
    if (contract && input.aggregateType !== contract.aggregateType) {
      throw deterministicQueueJobError(`Event ${input.eventType} must use aggregate type ${contract.aggregateType}`);
    }

    let payload: JsonObject;

    try {
      payload = contract
        ? parseDomainEventPayload(contract.eventType as DomainEventType, input.payload || {})
        : input.payload || {};
    } catch (error) {
      throw deterministicQueueJobError(`Invalid payload for event ${input.eventType}`, error);
    }

    await emitGatewayDomainEvent(this.env, {
      storeId: input.storeId || null,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId || null,
      actorId: input.actorId || null,
    });
  }

  private async applyProductSearchIndex(job: PlatformQueueJob, productId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('products')
      .select('id, store_id, name, description, sku, category, product_type, vendor, tags, status, is_active, price, deleted_at')
      .eq('id', productId)
      .maybeSingle();

    if (error) throw new Error(`Product search source lookup failed: ${error.message}`);
    if (!data) return this.applyDeletedSearchIndex(job, 'product', productId);

    const { error: upsertError } = await this.db
      .from('search_documents')
      .upsert(
        planProductSearchProjectionDocument(data as ProductSearchRow, job.event_id),
        { onConflict: 'site_id,object_type,object_id' },
      );

    if (upsertError) throw new Error(`Product search index update failed: ${upsertError.message}`);
    return true;
  }

  private async applyOrderSearchIndex(job: PlatformQueueJob, orderId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('orders')
      .select('id, store_id, order_number, customer_name, customer_email, status, total, deleted_at')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw new Error(`Order search source lookup failed: ${error.message}`);
    if (!data) return this.applyDeletedSearchIndex(job, 'order', orderId);

    const { error: upsertError } = await this.db
      .from('search_documents')
      .upsert(
        planOrderSearchProjectionDocument(data as OrderSearchRow, job.event_id),
        { onConflict: 'site_id,object_type,object_id' },
      );

    if (upsertError) throw new Error(`Order search index update failed: ${upsertError.message}`);
    return true;
  }

  private async applyDeletedSearchIndex(
    job: PlatformQueueJob,
    objectType: 'product' | 'order',
    objectId: string,
  ): Promise<boolean> {
    if (!job.site_id) return false;

    const { error } = await this.db
      .from('search_documents')
      .upsert(
        planDeletedSearchProjectionDocument(job.site_id, objectType, objectId, job.event_id),
        { onConflict: 'site_id,object_type,object_id' },
      );

    if (error) throw new Error(`Search deletion index update failed: ${error.message}`);
    return true;
  }

  private async incrementRollup(plan: { siteId: string; metricName: string; date: string; dimensions: JsonObject; increment: number }): Promise<void> {
    const { error } = await this.db.rpc('increment_analytics_rollup', {
      p_site_id: plan.siteId,
      p_metric_name: plan.metricName,
      p_rollup_date: plan.date,
      p_dimensions: plan.dimensions,
      p_increment: plan.increment,
    });

    if (error) throw new Error(`Analytics rollup increment failed: ${error.message}`);
  }

  private async completeJob(workerId: string, jobId: string, result: JsonObject): Promise<void> {
    const { error } = await this.db.rpc('complete_platform_queue_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_result: result,
    });

    if (error) throw new Error(`Queue job completion failed: ${error.message}`);
  }

  private async failJob(workerId: string, job: PlatformQueueJob, error: unknown): Promise<void> {
    const { error: failError } = await this.db.rpc('fail_platform_queue_job', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_message: error instanceof Error ? error.message : 'Queue job failed',
      p_retry_seconds: eventRetryDelaySeconds(job.attempts, 60),
      p_result: { consumer_runtime: 'services/queue-workers' },
    });

    if (failError) throw new Error(`Queue job failure recording failed: ${failError.message}`);
  }

  private async quarantineJob(workerId: string, job: PlatformQueueJob, error: unknown): Promise<void> {
    const { error: quarantineError } = await this.db.rpc('quarantine_platform_queue_job', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_message: error instanceof Error ? error.message : 'Queue job failed deterministic validation',
      p_result: {
        consumer_runtime: 'services/queue-workers',
        deterministic_failure: true,
      },
    });

    if (quarantineError) throw new Error(`Queue job quarantine failed: ${quarantineError.message}`);
  }
}
