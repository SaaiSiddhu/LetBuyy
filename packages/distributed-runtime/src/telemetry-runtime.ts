import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';

export interface TracePropagationContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  traceparent: string;
  baggage: Record<string, string>;
}

export interface RuntimeSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  kind: 'server' | 'client' | 'consumer' | 'producer' | 'internal';
  startedAt: string;
  endedAt?: string | null;
  status: 'unset' | 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

export interface RuntimeMetric {
  name: string;
  value: number;
  unit: 'count' | 'milliseconds' | 'bytes' | 'ratio';
  attributes: Record<string, string | number | boolean>;
  recordedAt: string;
}

export interface StructuredLogRecord {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  runtime: string;
  correlation: RuntimeCorrelationContext;
  tenant?: RuntimeTenantScope | null;
  attributes?: Record<string, unknown>;
  recordedAt: string;
}

export interface TelemetryExporterPort {
  exportSpan(span: RuntimeSpan): Promise<void>;
  exportMetric(metric: RuntimeMetric): Promise<void>;
  exportLog(record: StructuredLogRecord): Promise<void>;
}

export function createTracePropagationContext(
  correlation: RuntimeCorrelationContext,
  spanId: string,
  parentSpanId?: string | null,
): TracePropagationContext {
  const traceId = correlation.traceId || correlation.correlationId;
  const traceparent = `00-${traceId.replace(/-/g, '').slice(0, 32).padEnd(32, '0')}-${spanId.replace(/-/g, '').slice(0, 16).padEnd(16, '0')}-01`;
  return {
    traceId,
    spanId,
    parentSpanId: parentSpanId || null,
    traceparent,
    baggage: {
      requestId: correlation.requestId,
      correlationId: correlation.correlationId,
      ...(correlation.siteId ? { siteId: correlation.siteId } : {}),
      ...(correlation.actorId ? { actorId: correlation.actorId } : {}),
    },
  };
}

export function startRuntimeSpan(input: {
  name: string;
  kind: RuntimeSpan['kind'];
  trace: TracePropagationContext;
  attributes?: RuntimeSpan['attributes'];
}): RuntimeSpan {
  return {
    traceId: input.trace.traceId,
    spanId: input.trace.spanId,
    parentSpanId: input.trace.parentSpanId || null,
    name: input.name,
    kind: input.kind,
    startedAt: new Date().toISOString(),
    status: 'unset',
    attributes: input.attributes || {},
  };
}

export function closeRuntimeSpan(
  span: RuntimeSpan,
  status: RuntimeSpan['status'],
  attributes?: RuntimeSpan['attributes'],
): RuntimeSpan {
  return {
    ...span,
    status,
    endedAt: new Date().toISOString(),
    attributes: {
      ...span.attributes,
      ...(attributes || {}),
    },
  };
}
