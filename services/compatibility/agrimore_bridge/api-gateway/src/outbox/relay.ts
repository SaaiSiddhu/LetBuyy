import type { Env, JsonRecord } from '../runtime/types';

export type OutboxQueueMessage = {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly payload: JsonRecord;
  readonly attempts: number;
};

type OutboxRow = OutboxQueueMessage & {
  readonly status: string;
  readonly next_attempt_at: string;
  readonly created_at: string;
};

type RelayResult = {
  readonly queued: number;
  readonly skippedReason?: string;
};

export async function enqueuePendingOutbox(env: Env, limit = 25): Promise<RelayResult> {
  if (!env.OUTBOX_QUEUE) {
    return { queued: 0, skippedReason: 'OUTBOX_QUEUE binding is not configured.' };
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { queued: 0, skippedReason: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' };
  }

  const events = await outboxRest<OutboxRow[]>(
    env,
    'GET',
    `outbox_events?status=eq.pending&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.asc&limit=${limit}`,
  );
  if (events.length === 0) {
    return { queued: 0 };
  }

  const queued: OutboxQueueMessage[] = [];
  for (const event of events) {
    const locked = await lockEvent(env, event);
    if (locked) {
      queued.push(toMessage(locked));
    }
  }

  if (queued.length === 0) {
    return { queued: 0 };
  }

  try {
    await env.OUTBOX_QUEUE.sendBatch(
      queued.map((body) => ({ body, contentType: 'json' })),
    );
  } catch (error) {
    await Promise.all(queued.map((event) => markFailed(env, event, error, true)));
    throw error;
  }

  return { queued: queued.length };
}

export async function handleOutboxQueue(
  batch: MessageBatch<OutboxQueueMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processOutboxEvent(env, message.body);
      await markProcessed(env, message.body.id);
      message.ack();
    } catch (error) {
      await markFailed(env, message.body, error, message.attempts < 5);
      message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
    }
  }
}

async function processOutboxEvent(env: Env, event: OutboxQueueMessage): Promise<void> {
  const notification = notificationPayload(event);
  if (!notification) {
    return;
  }

  await invokeEdgeFunction(env, 'send-notification', notification);
}

function notificationPayload(event: OutboxQueueMessage): JsonRecord | null {
  const payload = event.payload;
  const userId = stringValue(payload.user_id) ?? stringValue(payload.userId);
  if (!userId) {
    return null;
  }

  return {
    user_id: userId,
    type: stringValue(payload.type) ?? event.event_type,
    title: stringValue(payload.title) ?? titleForEvent(event.event_type),
    body: stringValue(payload.body) ?? 'Agrimore order update',
    data: payload,
  };
}

async function lockEvent(env: Env, event: OutboxRow): Promise<OutboxRow | null> {
  const locked = await outboxRest<OutboxRow[]>(
    env,
    'PATCH',
    `outbox_events?id=eq.${event.id}&status=eq.pending`,
    {
      status: 'processing',
      attempts: event.attempts + 1,
    },
    'return=representation',
  );
  return locked[0] ?? null;
}

async function markProcessed(env: Env, eventId: string): Promise<void> {
  await outboxRest(
    env,
    'PATCH',
    `outbox_events?id=eq.${eventId}`,
    {
      status: 'processed',
      processed_at: new Date().toISOString(),
    },
    'return=minimal',
  );
}

async function markFailed(
  env: Env,
  event: Pick<OutboxQueueMessage, 'id' | 'attempts'>,
  _error: unknown,
  retryable: boolean,
): Promise<void> {
  await outboxRest(
    env,
    'PATCH',
    `outbox_events?id=eq.${event.id}`,
    {
      status: retryable ? 'pending' : 'failed',
      next_attempt_at: new Date(Date.now() + retryDelaySeconds(event.attempts) * 1000).toISOString(),
    },
    'return=minimal',
  );
}

async function invokeEdgeFunction(env: Env, functionName: string, body: JsonRecord): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      'x-user-id': stringValue(body.user_id) ?? '',
      'x-user-role': 'system',
      'x-trace-id': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`outbox.edge.${functionName}.${response.status}`);
  }
}

async function outboxRest<T = unknown>(
  env: Env,
  method: 'GET' | 'PATCH',
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<T> {
  const headers = new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'accept-profile': 'ops',
    'content-profile': 'ops',
  });
  if (prefer) {
    headers.set('prefer', prefer);
  }

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`outbox.rest.${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function toMessage(row: OutboxRow): OutboxQueueMessage {
  return {
    id: row.id,
    aggregate_type: row.aggregate_type,
    aggregate_id: row.aggregate_id,
    event_type: row.event_type,
    payload: row.payload,
    attempts: row.attempts,
  };
}

function retryDelaySeconds(attempts: number): number {
  return Math.min(900, 30 * 2 ** Math.max(0, attempts - 1));
}

function titleForEvent(eventType: string): string {
  if (eventType.includes('assignment')) {
    return 'New delivery offer';
  }
  if (eventType.includes('delivered')) {
    return 'Order delivered';
  }
  return 'Order update';
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
