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

export interface RuntimeTelemetryPipelineOptions {
  runtime: string;
  exporter: TelemetryExporterPort;
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

export function metricFromDuration(input: {
  name: string;
  startedAt: string;
  endedAt: string;
  attributes?: RuntimeMetric['attributes'];
}): RuntimeMetric {
  return {
    name: input.name,
    value: Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()),
    unit: 'milliseconds',
    attributes: input.attributes || {},
    recordedAt: input.endedAt,
  };
}

export class RuntimeTelemetryPipeline {
  constructor(private readonly options: RuntimeTelemetryPipelineOptions) {}

  async withSpan<T>(input: {
    name: string;
    kind: RuntimeSpan['kind'];
    trace: TracePropagationContext;
    attributes?: RuntimeSpan['attributes'];
    execute: (span: RuntimeSpan) => Promise<T>;
  }): Promise<T> {
    const started = startRuntimeSpan(input);
    try {
      const value = await input.execute(started);
      const closed = closeRuntimeSpan(started, 'ok');
      await this.options.exporter.exportSpan(closed);
      await this.options.exporter.exportMetric(metricFromDuration({
        name: `${input.name}.duration`,
        startedAt: closed.startedAt,
        endedAt: closed.endedAt || new Date().toISOString(),
        attributes: input.attributes,
      }));
      return value;
    } catch (error) {
      const closed = closeRuntimeSpan(started, 'error', {
        error: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      await this.options.exporter.exportSpan(closed);
      await this.log({
        level: 'error',
        message: error instanceof Error ? error.message : 'runtime span failed',
        correlation: {
          requestId: input.trace.baggage.requestId || input.trace.traceId,
          correlationId: input.trace.baggage.correlationId || input.trace.traceId,
          traceId: input.trace.traceId,
          siteId: input.trace.baggage.siteId,
          actorId: input.trace.baggage.actorId,
        },
        attributes: input.attributes,
      });
      throw error;
    }
  }

  metric(metric: Omit<RuntimeMetric, 'recordedAt'>): Promise<void> {
    return this.options.exporter.exportMetric({
      ...metric,
      recordedAt: new Date().toISOString(),
    });
  }

  log(record: Omit<StructuredLogRecord, 'runtime' | 'recordedAt'>): Promise<void> {
    return this.options.exporter.exportLog({
      ...record,
      runtime: this.options.runtime,
      recordedAt: new Date().toISOString(),
    });
  }
}
