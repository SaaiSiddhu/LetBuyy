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

export interface EventStreamSnapshot<TSnapshot = Record<string, unknown>> {
  streamName: string;
  snapshotVersion: number;
  streamPosition: number;
  globalPosition?: number;
  state: TSnapshot;
  createdAt: string;
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
  expectedVersion?: number;
  idempotencyKey: string;
  appendOnly: true;
}

export interface EventAppendBatchPlan<TPayload = Record<string, unknown>> {
  streamName: string;
  orderingKey: string;
  events: Array<EventAppendPlan<TPayload>>;
  expectedStreamPosition?: number;
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

export interface EventStoreSnapshotPort<TSnapshot = Record<string, unknown>> {
  loadLatestSnapshot(streamName: string): Promise<EventStreamSnapshot<TSnapshot> | null>;
  persistSnapshot(snapshot: EventStreamSnapshot<TSnapshot>): Promise<void>;
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

export class EventStreamConcurrencyError extends Error {
  constructor(
    readonly streamName: string,
    readonly expectedStreamPosition: number | undefined,
    readonly actualStreamPosition: number,
  ) {
    super(`Event stream conflict for ${streamName}: expected ${expectedStreamPosition ?? 'new stream'}, found ${actualStreamPosition}`);
    this.name = 'EventStreamConcurrencyError';
  }
}

export class EventStreamVersionError extends Error {
  constructor(
    readonly streamName: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(`Event stream version conflict for ${streamName}: expected ${expectedVersion}, found ${actualVersion}`);
    this.name = 'EventStreamVersionError';
  }
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
    expectedVersion: options.expectedVersion,
    idempotencyKey: options.idempotencyKey,
    appendOnly: true,
  };
}

export function assertEventStreamConsistency(
  streamName: string,
  head: EventStreamHead | null,
  expectedStreamPosition?: number,
  expectedVersion?: number,
): void {
  const actualPosition = head?.lastStreamPosition ?? 0;
  const actualVersion = head?.version ?? 0;

  if (expectedStreamPosition !== undefined && actualPosition !== expectedStreamPosition) {
    throw new EventStreamConcurrencyError(streamName, expectedStreamPosition, actualPosition);
  }

  if (expectedVersion !== undefined && actualVersion !== expectedVersion) {
    throw new EventStreamVersionError(streamName, expectedVersion, actualVersion);
  }
}

export function planEventAppendBatch<TPayload = Record<string, unknown>>(
  envelopes: Array<DistributedEventEnvelope<TPayload>>,
  options: EventAppendOptions,
): EventAppendBatchPlan<TPayload> {
  if (envelopes.length === 0) {
    throw new Error('Event append batch requires at least one event');
  }

  const events = envelopes.map((envelope, index) => planEventAppend(envelope, {
    ...options,
    expectedStreamPosition: index === 0 ? options.expectedStreamPosition : undefined,
    idempotencyKey: index === 0 ? options.idempotencyKey : `${options.idempotencyKey}:${index}`,
  }));
  const streamName = events[0].streamName;

  if (!events.every((event) => event.streamName === streamName)) {
    throw new Error('Event append batch cannot span multiple streams');
  }

  return {
    streamName,
    orderingKey: events[0].orderingKey,
    events,
    expectedStreamPosition: options.expectedStreamPosition,
    appendOnly: true,
  };
}

export class EventStoreRuntime<TPayload = Record<string, unknown>, TSnapshot = Record<string, unknown>> {
  constructor(
    private readonly store: EventStorePort<TPayload>,
    private readonly snapshots?: EventStoreSnapshotPort<TSnapshot>,
  ) {}

  async append(
    envelope: DistributedEventEnvelope<TPayload>,
    options: EventAppendOptions,
  ): Promise<EventStoreAppendResult<TPayload>> {
    const plan = planEventAppend(envelope, options);
    const head = await this.store.loadHead(plan.streamName);

    assertEventStreamConsistency(plan.streamName, head, plan.expectedStreamPosition, plan.expectedVersion);

    return this.store.append(plan);
  }

  async appendBatch(
    envelopes: Array<DistributedEventEnvelope<TPayload>>,
    options: EventAppendOptions,
  ): Promise<Array<EventStoreAppendResult<TPayload>>> {
    const batch = planEventAppendBatch(envelopes, options);
    const head = await this.store.loadHead(batch.streamName);
    assertEventStreamConsistency(batch.streamName, head, batch.expectedStreamPosition, options.expectedVersion);

    const results: Array<EventStoreAppendResult<TPayload>> = [];
    for (const plan of batch.events) {
      results.push(await this.store.append(plan));
    }
    return results;
  }

  readStream(input: EventStreamReadInput): Promise<EventStoreReadResult<TPayload>> {
    return this.store.readStream({
      ...input,
      limit: Math.min(Math.max(input.limit, 1), 1000),
    });
  }

  loadLatestSnapshot(streamName: string): Promise<EventStreamSnapshot<TSnapshot> | null> {
    if (!this.snapshots) return Promise.resolve(null);
    return this.snapshots.loadLatestSnapshot(streamName);
  }

  async persistSnapshot(snapshot: EventStreamSnapshot<TSnapshot>): Promise<void> {
    if (!this.snapshots) throw new Error('Event snapshot persistence port is not configured');
    if (snapshot.streamPosition < 1) throw new Error('Event stream snapshot requires a persisted stream position');
    await this.snapshots.persistSnapshot(snapshot);
  }
}
