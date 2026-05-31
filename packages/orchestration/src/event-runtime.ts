import type { RuntimeEventEnvelope } from '@letbuyy/event-core';
import type { CorrelationContext, DeadLetterPolicy, RetryPolicy } from './index';

export interface EventExecutionMetadata {
  correlation: CorrelationContext;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  replay: boolean;
}

export const RUNTIME_QUEUE_NAMES = [
  'payment-events',
  'inventory-jobs',
  'webhook-deliveries',
  'analytics-events',
  'search-indexing',
  'fulfillment-jobs',
  'bulk-admin-jobs',
] as const;

export type RuntimeQueueName = (typeof RUNTIME_QUEUE_NAMES)[number];

export interface EventSubscription<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  eventTypes: string[];
  handler: EventHandler<TPayload>;
  retryPolicy: RetryPolicy;
  deadLetterPolicy: DeadLetterPolicy;
}

export type EventHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (
  event: RuntimeEventEnvelope<TPayload>,
  metadata: EventExecutionMetadata,
) => Promise<EventHandlerResult>;

export interface EventHandlerResult {
  status: 'processed' | 'skipped' | 'retry' | 'dead-letter';
  reason?: string;
  output?: Record<string, unknown>;
}

export interface EventPersistencePort {
  markProcessing(eventId: string, metadata: EventExecutionMetadata): Promise<void>;
  markProcessed(eventId: string, result: EventHandlerResult): Promise<void>;
  markFailed(eventId: string, result: EventHandlerResult): Promise<void>;
}

export interface DeadLetterRuntimePort {
  send(event: RuntimeEventEnvelope, metadata: EventExecutionMetadata, reason: string): Promise<void>;
}

export interface IdempotencyRuntimePort {
  claim(key: string, context: CorrelationContext): Promise<'claimed' | 'replay'>;
  complete(key: string, result: EventHandlerResult): Promise<void>;
  fail(key: string, reason: string): Promise<void>;
}

export interface DomainEventEnvelopeInput {
  event_id: string;
  event_type: string;
  site_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  created_at: string;
  request_id: string | null;
  trace_id: string | null;
  idempotency_key: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export interface EventExecutionContext<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  event: RuntimeEventEnvelope<TPayload>;
  subscription: EventSubscription<TPayload>;
  metadata: EventExecutionMetadata;
  correlation: CorrelationContext;
  startedAt: string;
}

export class EventRouter {
  private readonly subscriptions: EventSubscription[] = [];

  subscribe(subscription: EventSubscription): void {
    this.subscriptions.push(subscription);
  }

  matching(eventType: string): EventSubscription[] {
    return this.subscriptions.filter((subscription) =>
      subscription.eventTypes.some((candidate) => eventMatchesSubscription(eventType, [candidate])),
    );
  }
}

export class EventSubscriptionRegistry extends EventRouter {}

export class EventDispatcher {
  constructor(
    private readonly router: EventRouter,
    private readonly persistence?: EventPersistencePort,
    private readonly deadLetter?: DeadLetterRuntimePort,
    private readonly idempotency?: IdempotencyRuntimePort,
  ) {}

  async dispatch<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    event: RuntimeEventEnvelope<TPayload>,
    context: CorrelationContext,
  ): Promise<EventHandlerResult[]> {
    const subscriptions = this.router.matching(event.event_type);
    const results: EventHandlerResult[] = [];

    for (const subscription of subscriptions) {
      const metadata = createEventExecutionMetadata(event, context, subscription.retryPolicy.maxAttempts);
      const claim = this.idempotency
        ? await this.idempotency.claim(metadata.idempotencyKey, context)
        : 'claimed';

      if (claim === 'replay') {
        results.push({ status: 'skipped', reason: 'idempotent replay' });
        continue;
      }

      await this.persistence?.markProcessing(event.event_id, metadata);
      const result = await subscription.handler(event, metadata);

      if (result.status === 'processed' || result.status === 'skipped') {
        await this.persistence?.markProcessed(event.event_id, result);
        await this.idempotency?.complete(metadata.idempotencyKey, result);
      } else if (result.status === 'dead-letter') {
        await this.deadLetter?.send(event, metadata, result.reason || 'dead-letter requested');
        await this.persistence?.markFailed(event.event_id, result);
        await this.idempotency?.fail(metadata.idempotencyKey, result.reason || 'dead-letter requested');
      } else {
        await this.persistence?.markFailed(event.event_id, result);
        await this.idempotency?.fail(metadata.idempotencyKey, result.reason || 'retry requested');
      }

      results.push(result);
    }

    return results;
  }
}

export function createEventExecutionMetadata(
  event: RuntimeEventEnvelope,
  context: CorrelationContext,
  maxAttempts: number,
): EventExecutionMetadata {
  return {
    correlation: {
      ...context,
      requestId: event.request_id || context.requestId,
      correlationId: context.correlationId || event.event_id,
      siteId: event.site_id || context.siteId,
    },
    idempotencyKey: event.idempotency_key || `${event.event_type}:${event.event_id}`,
    attempt: 1,
    maxAttempts,
    replay: false,
  };
}

export function eventRetryDelaySeconds(attempt: number, baseSeconds = 30): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 8));
  return Math.min(3600, baseSeconds * 2 ** exponent);
}

export function eventMatchesSubscription(eventType: string, eventTypes: string[]): boolean {
  return eventTypes.some((candidate) => {
    if (candidate === '*') return true;
    if (candidate === eventType) return true;
    if (!candidate.endsWith('.*')) return false;
    return eventType.startsWith(candidate.slice(0, -1));
  });
}

export function queueNamesForEvent(eventType: string): RuntimeQueueName[] {
  const queues = new Set<RuntimeQueueName>();

  if (eventType.startsWith('payment.') || eventType.startsWith('refund.')) queues.add('payment-events');
  if (eventType.startsWith('inventory.') || eventType.startsWith('po.') || eventType.startsWith('transfer.')) queues.add('inventory-jobs');
  if (eventType.startsWith('fulfillment.') || eventType.startsWith('shipment.') || eventType.startsWith('return.') || eventType.includes('.fulfillment.')) queues.add('fulfillment-jobs');
  if (eventType.startsWith('product.') || eventType.startsWith('collection.') || eventType.startsWith('category.') || eventType.startsWith('customer.') || eventType.startsWith('order.') || eventType.startsWith('theme.')) queues.add('search-indexing');

  queues.add('analytics-events');
  return [...queues];
}

export function buildDomainEventEnvelope(event: DomainEventEnvelopeInput): Record<string, unknown> {
  return {
    id: event.event_id,
    type: event.event_type,
    site_id: event.site_id,
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id,
    },
    occurred_at: event.created_at,
    request_id: event.request_id,
    trace_id: event.trace_id,
    idempotency_key: event.idempotency_key,
    schema_version: event.schema_version,
    payload: event.payload,
  };
}
