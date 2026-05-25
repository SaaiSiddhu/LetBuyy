import { insertSupabaseRows, upsertSupabaseRows, type SupabaseServiceEnv } from '@letbuyy/infrastructure/supabase-adapter';

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

export interface Env extends SupabaseServiceEnv {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  RUNTIME_NAME?: string;
  PRIMARY_REGION?: string;
  FAILOVER_REGION?: string;
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

async function persistQueueMessage(env: Env, input: Required<QueuePayload>, status: 'completed' | 'dead-lettered'): Promise<void> {
  await upsertSupabaseRows(env, 'distributed_queue_messages', {
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
  }, { onConflict: 'message_id', prefer: 'resolution=merge-duplicates,return=minimal' });
}

async function recordQueueMetric(env: Env, input: Required<QueuePayload>, status: 'completed' | 'dead-lettered'): Promise<void> {
  await insertSupabaseRows(env, 'runtime_telemetry_metrics', {
    metric_name: status === 'completed' ? 'cloudflare.queue.delivery.completed' : 'cloudflare.queue.delivery.dead_lettered',
    metric_value: 1,
    unit: 'count',
    runtime_name: env.RUNTIME_NAME || 'Queue Workers',
    site_id: input.siteId,
    dimensions: {
      queue_name: input.queueName,
      job_type: input.jobType,
      provider: 'cloudflare-queues',
      region: env.PRIMARY_REGION || 'global-edge',
    },
    request_id: input.requestId,
    correlation_id: input.correlationId,
    trace_id: input.traceId,
  });
}

async function handleMessage(env: Env, batch: MessageBatch<QueuePayload | Record<string, unknown>>, message: QueueBatchMessage): Promise<void> {
  const normalized = normalizePayload(message, batch);
  const status = batch.queue === 'letbuyy-dead-letters' ? 'dead-lettered' : 'completed';

  await persistQueueMessage(env, normalized, status);
  await recordQueueMetric(env, normalized, status);
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
    for (const message of batch.messages) {
      try {
        await handleMessage(env, batch, message);
        message.ack();
        writeQueueLog('info', {
          queue_name: batch.queue,
          message_id: message.id,
          status: 'acked',
        });
      } catch (error) {
        message.retry();
        writeQueueLog('error', {
          queue_name: batch.queue,
          message_id: message.id,
          status: 'retry',
          error: error instanceof Error ? error.message : 'queue message failed',
        });
      }
    }
  },
} satisfies ExportedHandler<Env, QueuePayload | Record<string, unknown>>;
