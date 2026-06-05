import { getDomainEventContract, parseDomainEventPayload, type DomainEventType, type RuntimeEventEnvelope } from '@letbuyy/event-core';
import { eventRetryDelaySeconds } from '@letbuyy/orchestration';
import {
  normalizeQueueEnvelope,
  planAnalyticsEventStreamRecord,
  planOrderItemAnalyticsRollupIncrements,
  planAnalyticsRollupIncrements,
  planDeletedSearchProjectionDocument,
  planOrderSearchProjectionDocument,
  planProductSearchProjectionDocument,
} from '@letbuyy/runtime-composition';
import { planInAppNotificationForEvent } from '@letbuyy/notification-core';
import {
  createSupabaseServiceClient,
  type SupabaseClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import { emitGatewayDomainEvent, type GatewayServiceBinding } from './gateway-events';

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
  billing_mode?: 'recurring' | 'usage';
  amount?: {
    amount_minor?: number;
    currency?: 'INR';
  };
  payout_rail?: 'razorpay_route' | 'razorpayx' | 'upi' | 'manual';
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

export interface PlatformQueueConsumerEnv extends SupabaseServiceEnv {
  API_GATEWAY_SERVICE?: GatewayServiceBinding;
  INTERNAL_API_SECRET?: string;
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

function payoutRail(value: unknown): 'razorpay_route' | 'razorpayx' | 'upi' | 'manual' {
  switch (value) {
    case 'razorpay_route':
    case 'razorpayx':
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

    const planned = planInAppNotificationForEvent(event);
    if (!planned) return;

    const userId = await this.resolveNotificationUserId(event.site_id || null, event.payload);
    if (!userId) return;

    const { error } = await this.db.from('notifications').insert({
      user_id: userId,
      type: planned.type,
      title: planned.title,
      message: planned.message,
      data: {
        ...planned.data,
        queue_job_id: job.id,
        idempotency_key: event.idempotency_key || job.idempotency_key,
        consumer_runtime: 'services/queue-workers',
      },
      action_url: planned.action_url || null,
    });

    if (error) throw new Error(`Notification dispatch write failed: ${error.message}`);
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

    const revenueShareBps = clampBps(payload.revenue_share_bps, 8000);
    const partnerAmountMinor = Math.floor((amountMinor * revenueShareBps) / 10000);
    const platformFeeMinor = amountMinor - partnerAmountMinor;
    const partnerGstBps = clampBps(payload.partner_gst_bps, 1800);
    const partnerGstMinor = typeof payload.partner_gst_minor === 'number'
      ? Math.max(0, Math.trunc(payload.partner_gst_minor))
      : Math.round((partnerAmountMinor * partnerGstBps) / 10000);
    const rail = payoutRail(payload.payout_rail);

    const { data: entries, error: entryError } = await this.db
      .from('partner_payout_ledger_entries')
      .upsert(
        {
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
          metadata: {
            source_event_type: eventType,
            queue_job_id: job.id,
            partner_gst_bps: partnerGstBps,
            partner_gst_minor: partnerGstMinor,
            payout_provider_mode: 'test',
            consumer_runtime: 'services/queue-workers',
          },
        },
        { onConflict: 'source_event_id' },
      )
      .select('id, partner_id, partner_amount_minor');

    if (entryError) throw new Error(`Payout ledger write failed: ${entryError.message}`);

    const entry = Array.isArray(entries) ? entries[0] as PayoutLedgerEntry | undefined : undefined;
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
