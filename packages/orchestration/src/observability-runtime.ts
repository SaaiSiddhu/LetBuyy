import type { CorrelationContext } from './index';

export interface ExecutionTrace {
  traceId: string;
  requestId: string;
  workflow?: string;
  runtime?: string;
  siteId?: string | null;
  actorId?: string | null;
  startedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionTraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  status: 'ok' | 'error';
  metadata?: Record<string, unknown>;
}

export interface ExecutionTelemetryPort {
  startTrace(trace: ExecutionTrace): Promise<void>;
  recordSpan(span: ExecutionTraceSpan): Promise<void>;
  recordAudit(input: ExecutionAuditRecord): Promise<void>;
}

export interface ExecutionAuditRecord {
  traceId: string;
  requestId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  actorId?: string | null;
  siteId?: string | null;
  metadata?: Record<string, unknown>;
}

export function traceFromCorrelation(context: CorrelationContext, runtime?: string, workflow?: string): ExecutionTrace {
  return {
    traceId: context.correlationId,
    requestId: context.requestId,
    runtime,
    workflow,
    siteId: context.siteId,
    actorId: context.actorId,
    startedAt: new Date().toISOString(),
  };
}
