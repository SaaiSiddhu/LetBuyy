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

export interface ExecutionTraceContext {
  trace: ExecutionTrace;
  currentSpan?: ExecutionTraceSpan;
  baggage: Record<string, string>;
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

export function createExecutionTraceContext(
  context: CorrelationContext,
  runtime: string,
  workflow?: string,
  metadata?: Record<string, unknown>,
): ExecutionTraceContext {
  return {
    trace: {
      ...traceFromCorrelation(context, runtime, workflow),
      metadata,
    },
    baggage: {
      requestId: context.requestId,
      correlationId: context.correlationId,
      ...(context.causationId ? { causationId: context.causationId } : {}),
      ...(context.siteId ? { siteId: context.siteId } : {}),
      ...(context.actorId ? { actorId: context.actorId } : {}),
    },
  };
}

export function createRuntimeSpan(
  trace: ExecutionTrace,
  name: string,
  parentSpanId?: string,
  metadata?: Record<string, unknown>,
): ExecutionTraceSpan {
  return {
    traceId: trace.traceId,
    spanId: `${name}:${Date.now()}`,
    parentSpanId,
    name,
    startedAt: new Date().toISOString(),
    status: 'ok',
    metadata,
  };
}

export function closeRuntimeSpan(
  span: ExecutionTraceSpan,
  status: ExecutionTraceSpan['status'],
  metadata?: Record<string, unknown>,
): ExecutionTraceSpan {
  return {
    ...span,
    status,
    endedAt: new Date().toISOString(),
    metadata: {
      ...(span.metadata || {}),
      ...(metadata || {}),
    },
  };
}
