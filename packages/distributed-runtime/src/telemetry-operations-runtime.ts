import type { RuntimeCorrelationContext, RuntimeTenantScope } from './event-envelope-runtime';
import type { RuntimeMetric, RuntimeSpan, StructuredLogRecord, TelemetryExporterPort } from './telemetry-runtime';

export interface TelemetrySamplingPolicy {
  runtimeName: string;
  sampleRate: number;
  alwaysSampleErrors: boolean;
  tenantOverrides?: Record<string, number>;
}

export interface RuntimeTraceDiagnostic {
  traceId: string;
  spanCount: number;
  errorCount: number;
  rootSpanName?: string | null;
  durationMs: number;
  status: 'ok' | 'error' | 'incomplete';
}

export interface RuntimeMetricAggregate {
  metricName: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  average: number;
  windowStartedAt: string;
  windowEndedAt: string;
}

export interface TelemetryOperationsPort extends TelemetryExporterPort {
  loadTrace(traceId: string): Promise<RuntimeSpan[]>;
  aggregateMetric(metricName: string, windowSeconds: number): Promise<RuntimeMetricAggregate>;
  queryLogs(input: {
    runtimeName?: string;
    tenant?: RuntimeTenantScope | null;
    level?: StructuredLogRecord['level'];
    limit: number;
  }): Promise<StructuredLogRecord[]>;
}

export function shouldSampleTelemetry(input: {
  policy: TelemetrySamplingPolicy;
  correlation: RuntimeCorrelationContext;
  tenant?: RuntimeTenantScope | null;
  error?: boolean;
}): boolean {
  if (input.error && input.policy.alwaysSampleErrors) return true;
  const tenantRate = input.tenant?.siteId ? input.policy.tenantOverrides?.[input.tenant.siteId] : undefined;
  const rate = Math.max(0, Math.min(tenantRate ?? input.policy.sampleRate, 1));
  const basis = input.correlation.traceId || input.correlation.correlationId;
  const hash = [...basis].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1000;
  return hash / 1000 <= rate;
}

export function diagnoseTrace(spans: RuntimeSpan[]): RuntimeTraceDiagnostic {
  const sorted = [...spans].sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());
  const first = sorted[0];
  const last = sorted
    .filter((span) => span.endedAt)
    .sort((left, right) => new Date(right.endedAt || right.startedAt).getTime() - new Date(left.endedAt || left.startedAt).getTime())[0];
  const errorCount = sorted.filter((span) => span.status === 'error').length;
  const incomplete = sorted.some((span) => !span.endedAt);
  return {
    traceId: first?.traceId || 'unknown',
    spanCount: sorted.length,
    errorCount,
    rootSpanName: sorted.find((span) => !span.parentSpanId)?.name || null,
    durationMs: first && last ? Math.max(0, new Date(last.endedAt || last.startedAt).getTime() - new Date(first.startedAt).getTime()) : 0,
    status: incomplete ? 'incomplete' : errorCount > 0 ? 'error' : 'ok',
  };
}

export class TelemetryOperationsRuntime {
  constructor(private readonly telemetry: TelemetryOperationsPort) {}

  recordSpan(span: RuntimeSpan): Promise<void> {
    return this.telemetry.exportSpan(span);
  }

  recordMetric(metric: RuntimeMetric): Promise<void> {
    return this.telemetry.exportMetric(metric);
  }

  recordLog(record: StructuredLogRecord): Promise<void> {
    return this.telemetry.exportLog(record);
  }

  async diagnoseTrace(traceId: string): Promise<RuntimeTraceDiagnostic> {
    return diagnoseTrace(await this.telemetry.loadTrace(traceId));
  }

  aggregateMetric(metricName: string, windowSeconds: number): Promise<RuntimeMetricAggregate> {
    return this.telemetry.aggregateMetric(metricName, Math.min(Math.max(windowSeconds, 60), 86_400));
  }
}
