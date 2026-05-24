import type { DistributedEventEnvelope, RuntimeCorrelationContext } from './event-envelope-runtime';
import type { EventAppendOptions, EventStoreAppendResult, EventStorePort } from './event-store-runtime';
import { EventStoreRuntime } from './event-store-runtime';

export interface EventPersistenceReceipt {
  eventId: string;
  streamName: string;
  streamPosition: number;
  globalPosition: number;
  persistedAt: string;
  idempotencyKey: string;
  replaySafe: true;
}

export interface EventPersistenceInput<TPayload = Record<string, unknown>> {
  envelope: DistributedEventEnvelope<TPayload>;
  idempotencyKey: string;
  expectedStreamPosition?: number;
  expectedVersion?: number;
  correlation: RuntimeCorrelationContext;
}

export class EventPersistenceRuntime<TPayload = Record<string, unknown>> {
  private readonly eventStore: EventStoreRuntime<TPayload>;

  constructor(store: EventStorePort<TPayload>) {
    this.eventStore = new EventStoreRuntime(store);
  }

  async persist(input: EventPersistenceInput<TPayload>): Promise<EventPersistenceReceipt> {
    const options: EventAppendOptions = {
      idempotencyKey: input.idempotencyKey,
      expectedStreamPosition: input.expectedStreamPosition,
      expectedVersion: input.expectedVersion,
      correlation: input.correlation,
    };
    const result: EventStoreAppendResult<TPayload> = await this.eventStore.append(input.envelope, options);

    return {
      eventId: result.record.envelope.event_id,
      streamName: result.record.envelope.stream_name,
      streamPosition: result.record.streamPosition,
      globalPosition: result.record.globalPosition,
      persistedAt: result.record.persistedAt,
      idempotencyKey: input.idempotencyKey,
      replaySafe: true,
    };
  }
}
