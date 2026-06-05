import { insertSupabaseRows, upsertSupabaseRows, type SupabaseServiceEnv } from '@letbuyy/infrastructure/supabase-adapter';
import { consumePlatformQueuesForCloudflareQueue } from './platform-queue-consumer';

type QueuePayload = {
  messageId?: string;
  queueName?: string;
  jobType?: string;
  payload?: Record<string, unknown>;
  siteId?: string | null;
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

export interface Env extends SupabaseServiceEnv {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  APP_ENV?: string;
  NODE_ENV?: string;
  DEPLOYMENT_ENV?: string;
  TELEMETRY_ENV?: string;
  RUNTIME_NAME?: string;
  PRIMARY_REGION?: string;
  FAILOVER_REGION?: string;
  PLATFORM_QUEUE_CLAIM_LIMIT?: string;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function queueNameFromBatch(batch: MessageBatch<QueuePayload | Record<string, unknown>>, body: QueuePayload): string {
  return stringValue(body.queueName, batch.queue);
}

function normalizePayload(message: QueueBatchMessage, batch: MessageBatch<QueuePayload | Record<string, unknown>>): Required<QueuePayload> {
  const body = message.body as QueuePayload;
  const queueName = queueNameFromBatch(batch, body);
  const messageId = stringValue(body.messageId, message.id);
  const jobType = stringValue(body.jobType, 'runtime.queue.delivery');
  const idempotencyKey = stringValue(body.idempotencyKey, `${queueName}:${messageId}`);
  const requestId = stringValue(body.requestId, messageId);
  const correlationId = stringValue(body.correlationId, requestId);

  return {
    messageId,
    queueName,
    jobType,
    payload: typeof body.payload === 'object' && body.payload !== null ? body.payload : { raw: body },
    siteId: typeof body.siteId === 'string' ? body.siteId : null,
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

  await insertSupabaseRows(env, 'runtime_telemetry_metrics', {
    metric_name: 'cloudflare.queue.delivery.batch',
    metric_value: deliveries.length,
    unit: 'count',
    runtime_name: env.RUNTIME_NAME || 'Queue Workers',
    site_id: null,
    dimensions: {
      cloudflare_queue_name: batch.queue,
      queue_names: [...new Set(deliveries.map((delivery) => delivery.input.queueName))],
      job_types: [...new Set(deliveries.map((delivery) => delivery.input.jobType))],
      completed,
      dead_lettered: deadLettered,
      lag_p95_ms: percentile(lagValues, 95),
      lag_max_ms: Math.max(...lagValues),
      provider: 'cloudflare-queues',
      region: env.PRIMARY_REGION || 'global-edge',
      deployment_env: env.DEPLOYMENT_ENV || env.ENVIRONMENT,
      telemetry_env: env.TELEMETRY_ENV || env.ENVIRONMENT,
    },
    request_id: deliveries[0]?.input.requestId,
    correlation_id: deliveries[0]?.input.correlationId,
    trace_id: deliveries[0]?.input.traceId,
  });
}

function normalizeDelivery(batch: MessageBatch<QueuePayload | Record<string, unknown>>, message: QueueBatchMessage): NormalizedQueueDelivery {
  const normalized = normalizePayload(message, batch);
  const status = batch.queue.includes('dead-letters') ? 'dead-lettered' : 'completed';
  return {
    message,
    input: normalized,
    status,
    lagMilliseconds: Math.max(0, Date.now() - message.timestamp.getTime()),
  };
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

export default {
  async queue(batch, env) {
    const deliveries = batch.messages.map((message) => normalizeDelivery(batch, message));

    try {
      await persistQueueBatch(env, deliveries);
      await recordQueueBatchMetric(env, batch, deliveries);
      const platformQueueResult = await consumePlatformQueuesForCloudflareQueue(env, {
        cloudflareQueueName: batch.queue,
        bodyQueueName: sharedBodyQueueName(deliveries),
        workerId: `cloudflare:${batch.queue}:batch:${deliveries[0]?.input.messageId || crypto.randomUUID()}:${deliveries.length}`,
      });

      for (const delivery of deliveries) delivery.message.ack();
      writeQueueLog('info', {
        queue_name: batch.queue,
        message_count: deliveries.length,
        status: 'acked',
        platform_queue_result: platformQueueResult,
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
} satisfies ExportedHandler<Env, QueuePayload | Record<string, unknown>>;
