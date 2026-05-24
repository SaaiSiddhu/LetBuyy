import {
  assertReplaySafeEventEnvelope,
  eventOrderingKey,
  type DistributedEventEnvelope,
  type RuntimeCorrelationContext,
} from './event-envelope-runtime';

export interface EventStreamHead {
  streamName: string;
  lastStreamPosition: number;
  lastGlobalPosition?: number;
  version: number;
}

export interface EventStoreRecord<TPayload = Record<string, unknown>> {
  envelope: DistributedEventEnvelope<TPayload>;
  streamPosition: number;
  globalPosition: number;
  persistedAt: string;
  appendOnly: true;
}

export interface EventAppendOptions {
  expectedStreamPosition?: number;
  expectedVersion?: number;
  idempotencyKey: string;
  correlation: RuntimeCorrelationContext;
}

export interface EventAppendPlan<TPayload = Record<string, unknown>> {
  envelope: DistributedEventEnvelope<TPayload>;
  streamName: string;
  orderingKey: string;
  expectedStreamPosition?: number;
  idempotencyKey: string;
  appendOnly: true;
}

export interface EventStoreAppendResult<TPayload = Record<string, unknown>> {
  status: 'appended' | 'idempotent-replay';
  record: EventStoreRecord<TPayload>;
}

export interface EventStorePort<TPayload = Record<string, unknown>> {
  loadHead(streamName: string): Promise<EventStreamHead | null>;
  append(plan: EventAppendPlan<TPayload>): Promise<EventStoreAppendResult<TPayload>>;
  readStream(input: EventStreamReadInput): Promise<EventStoreReadResult<TPayload>>;
}

export interface EventStreamReadInput {
  streamName: string;
  afterStreamPosition?: number;
  limit: number;
}

export interface EventStoreReadResult<TPayload = Record<string, unknown>> {
  streamName: string;
  events: Array<EventStoreRecord<TPayload>>;
  nextStreamPosition?: number;
}

export function planEventAppend<TPayload = Record<string, unknown>>(
  envelope: DistributedEventEnvelope<TPayload>,
  options: EventAppendOptions,
): EventAppendPlan<TPayload> {
  assertReplaySafeEventEnvelope(envelope);
  return {
    envelope: {
      ...envelope,
      request_id: envelope.request_id || options.correlation.requestId,
      correlation_id: envelope.correlation_id || options.correlation.correlationId,
      trace_id: envelope.trace_id || options.correlation.traceId || null,
    },
    streamName: envelope.stream_name,
    orderingKey: eventOrderingKey(envelope),
    expectedStreamPosition: options.expectedStreamPosition,
    idempotencyKey: options.idempotencyKey,
    appendOnly: true,
  };
}

export class EventStoreRuntime<TPayload = Record<string, unknown>> {
  constructor(private readonly store: EventStorePort<TPayload>) {}

  async append(
    envelope: DistributedEventEnvelope<TPayload>,
    options: EventAppendOptions,
  ): Promise<EventStoreAppendResult<TPayload>> {
    const plan = planEventAppend(envelope, options);
    const head = await this.store.loadHead(plan.streamName);

    if (
      plan.expectedStreamPosition !== undefined &&
      head &&
      head.lastStreamPosition !== plan.expectedStreamPosition
    ) {
      throw new Error(
        `Event stream conflict for ${plan.streamName}: expected ${plan.expectedStreamPosition}, found ${head.lastStreamPosition}`,
      );
    }

    if (options.expectedVersion !== undefined && head && head.version !== options.expectedVersion) {
      throw new Error(`Event stream version conflict for ${plan.streamName}: expected ${options.expectedVersion}, found ${head.version}`);
    }

    return this.store.append(plan);
  }

  readStream(input: EventStreamReadInput): Promise<EventStoreReadResult<TPayload>> {
    return this.store.readStream({
      ...input,
      limit: Math.min(Math.max(input.limit, 1), 1000),
    });
  }
}
