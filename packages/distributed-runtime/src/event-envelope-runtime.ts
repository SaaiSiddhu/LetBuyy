import type { RuntimeEventEnvelope } from '@letbuyy/event-core';

export type RuntimeIsoTimestamp = string;

export interface RuntimeCorrelationContext {
  requestId: string;
  correlationId: string;
  causationId?: string | null;
  traceId?: string | null;
  actorId?: string | null;
  siteId?: string | null;
}

export interface RuntimeTenantScope {
  siteId: string;
  tenantPartitionKey: string;
  region?: string | null;
}

export interface EventStreamPartition {
  streamName: string;
  partitionKey: string;
  tenantScoped: boolean;
  region?: string | null;
}

export interface DistributedEventEnvelope<TPayload = Record<string, unknown>>
  extends RuntimeEventEnvelope<TPayload> {
  stream_name: string;
  stream_position?: number;
  global_position?: number;
  partition_key: string;
  causation_id?: string | null;
  correlation_id: string;
  trace_id?: string | null;
  schema_version: number;
  producer: string;
  immutable: true;
  replayable: boolean;
  retention_class: EventRetentionClass;
  metadata: Record<string, unknown>;
}

export type EventRetentionClass = 'hot' | 'warm' | 'archive' | 'legal-hold';

export interface DistributedEventInput<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  sourceRuntime: string;
  producer: string;
  payload: TPayload;
  occurredAt: RuntimeIsoTimestamp;
  aggregateType?: string;
  aggregateId?: string;
  tenant?: RuntimeTenantScope | null;
  idempotencyKey?: string;
  schemaVersion: number;
  correlation: RuntimeCorrelationContext;
  replayable?: boolean;
  retentionClass?: EventRetentionClass;
  metadata?: Record<string, unknown>;
}

export function canonicalizeReplayValue(value: unknown, path = 'payload'): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Replay payload is not deterministic at ${path}: number must be finite`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalizeReplayValue(item, `${path}[${index}]`));
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      throw new Error(`Replay payload is not deterministic at ${path}: Date objects must be serialized before event creation`);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Replay payload is not deterministic at ${path}: only plain JSON objects are allowed`);
    }

    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child === undefined) {
        throw new Error(`Replay payload is not deterministic at ${path}.${key}: undefined is not JSON-serializable`);
      }
      sorted[key] = canonicalizeReplayValue(child, `${path}.${key}`);
    }
    return sorted;
  }

  throw new Error(`Replay payload is not deterministic at ${path}: ${typeof value} is not JSON-serializable`);
}

export function stableReplaySerialize(value: unknown): string {
  return JSON.stringify(canonicalizeReplayValue(value));
}

export function replayPayloadChecksum(value: unknown): string {
  const serialized = stableReplaySerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildEventStreamName(input: {
  aggregateType?: string | null;
  aggregateId?: string | null;
  eventType: string;
  siteId?: string | null;
}): string {
  if (input.aggregateType && input.aggregateId) {
    return [input.siteId || 'global', input.aggregateType, input.aggregateId].join(':');
  }

  const eventNamespace = input.eventType.split('.')[0] || 'event';
  return [input.siteId || 'global', eventNamespace].join(':');
}

export function buildEventPartition(input: {
  streamName: string;
  eventType: string;
  aggregateId?: string | null;
  tenant?: RuntimeTenantScope | null;
}): EventStreamPartition {
  const partitionKey = input.tenant?.tenantPartitionKey || input.aggregateId || input.streamName;
  return {
    streamName: input.streamName,
    partitionKey,
    tenantScoped: Boolean(input.tenant?.siteId),
    region: input.tenant?.region || null,
  };
}

export function createDistributedEventEnvelope<TPayload = Record<string, unknown>>(
  input: DistributedEventInput<TPayload>,
): DistributedEventEnvelope<TPayload> {
  if (!input.occurredAt) {
    throw new Error('Distributed event envelope requires producer-supplied occurredAt for deterministic replay');
  }

  const siteId = input.tenant?.siteId || input.correlation.siteId || undefined;
  const streamName = buildEventStreamName({
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    siteId,
  });
  const partition = buildEventPartition({
    streamName,
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    tenant: input.tenant,
  });

  return {
    event_id: input.eventId,
    event_type: input.eventType,
    source_runtime: input.sourceRuntime,
    site_id: siteId,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    occurred_at: input.occurredAt,
    payload: input.payload,
    request_id: input.correlation.requestId,
    idempotency_key: input.idempotencyKey,
    stream_name: streamName,
    partition_key: partition.partitionKey,
    causation_id: input.correlation.causationId || null,
    correlation_id: input.correlation.correlationId,
    trace_id: input.correlation.traceId || null,
    schema_version: input.schemaVersion,
    producer: input.producer,
    immutable: true,
    replayable: input.replayable ?? true,
    retention_class: input.retentionClass || 'hot',
    metadata: {
      ...(input.metadata || {}),
      tenant_scoped: partition.tenantScoped,
      region: partition.region || null,
    },
  };
}

export function assertReplaySafeEventEnvelope<TPayload>(event: DistributedEventEnvelope<TPayload>): void {
  const missing = [
    ['event_id', event.event_id],
    ['event_type', event.event_type],
    ['source_runtime', event.source_runtime],
    ['occurred_at', event.occurred_at],
    ['stream_name', event.stream_name],
    ['partition_key', event.partition_key],
    ['correlation_id', event.correlation_id],
    ['schema_version', event.schema_version],
    ['producer', event.producer],
  ].filter(([, value]) => value === undefined || value === null || value === '');

  if (missing.length > 0) {
    throw new Error(`Distributed event envelope is not replay-safe; missing ${missing.map(([key]) => key).join(', ')}`);
  }

  if (event.immutable !== true) {
    throw new Error('Distributed event envelope must be immutable');
  }

  if (!Number.isInteger(event.schema_version) || event.schema_version < 1) {
    throw new Error('Distributed event envelope requires a positive integer schema_version');
  }

  if (Number.isNaN(Date.parse(event.occurred_at))) {
    throw new Error('Distributed event envelope requires an ISO-compatible occurred_at timestamp');
  }

  if (typeof event.replayable !== 'boolean') {
    throw new Error('Distributed event envelope requires an explicit replayable flag');
  }

  if (event.stream_position !== undefined && (!Number.isInteger(event.stream_position) || event.stream_position < 1)) {
    throw new Error('Distributed event envelope stream_position must be a positive integer when present');
  }

  if (event.global_position !== undefined && (!Number.isInteger(event.global_position) || event.global_position < 1)) {
    throw new Error('Distributed event envelope global_position must be a positive integer when present');
  }

  stableReplaySerialize(event.payload);
  stableReplaySerialize(event.metadata);
}

export function eventOrderingKey<TPayload>(event: DistributedEventEnvelope<TPayload>): string {
  return event.aggregate_id ? `${event.stream_name}:${event.aggregate_id}` : event.partition_key;
}
