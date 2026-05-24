import type { RuntimeEventEnvelope } from '@letbuyy/event-core';
import type { CorrelationContext, DeadLetterPolicy, RetryPolicy } from './index';

export interface EventExecutionMetadata {
  correlation: CorrelationContext;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  replay: boolean;
}

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

export class EventRouter {
  private readonly subscriptions: EventSubscription[] = [];

  subscribe(subscription: EventSubscription): void {
    this.subscriptions.push(subscription);
  }

  matching(eventType: string): EventSubscription[] {
    return this.subscriptions.filter((subscription) =>
      subscription.eventTypes.includes('*') || subscription.eventTypes.includes(eventType),
    );
  }
}

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
