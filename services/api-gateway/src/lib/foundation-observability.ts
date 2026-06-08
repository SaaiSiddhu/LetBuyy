import { redactReplayableSecrets } from './replayable-secret-redaction';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

export interface FoundationTraceInput {
    requestId: string;
    traceId?: string | null;
    siteId?: string | null;
    channel?: 'web' | 'whatsapp' | 'instagram' | 'pos' | 'api' | null;
    actorId?: string | null;
}

export interface FoundationTraceContext {
    request_id: string;
    trace_id: string;
    site_id: string | null;
    channel: 'web' | 'whatsapp' | 'instagram' | 'pos' | 'api';
    actor_id: string | null;
}

export interface FoundationAuditInput {
    trace: FoundationTraceContext;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: JsonRecord;
}

export interface FoundationMetric {
    name: string;
    value: number;
    unit: 'count' | 'ms' | 'bytes';
    dimensions: Record<string, string>;
}

export function createFoundationTraceContext(input: FoundationTraceInput): FoundationTraceContext {
    return {
        request_id: input.requestId,
        trace_id: input.traceId || input.requestId,
        site_id: input.siteId || null,
        channel: input.channel || 'web',
        actor_id: input.actorId || null,
    };
}

export function redactFoundationLogFields(fields: JsonRecord): JsonRecord {
    return redactReplayableSecrets(fields) as JsonRecord;
}

export function foundationStructuredLog(fields: JsonRecord & Partial<FoundationTraceContext>): JsonRecord {
    return redactFoundationLogFields({
        service: 'letbuyy-api',
        ...fields,
    });
}

export function appendAuditRelayEnvelope(input: FoundationAuditInput): Record<string, unknown> {
    return {
        store_id: input.trace.site_id,
        actor_id: input.trace.actor_id,
        actor_type: input.trace.actor_id ? 'user' : 'system',
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        request_id: input.trace.request_id,
        before_state: null,
        after_state: null,
        metadata: redactFoundationLogFields({
            ...(input.metadata || {}),
            trace_id: input.trace.trace_id,
            channel: input.trace.channel,
        }),
    };
}

export function createMetricsRegistry() {
    const metrics = new Map<string, FoundationMetric>();

    return {
        increment(name: string, dimensions: Record<string, string> = {}, amount = 1): void {
            const key = JSON.stringify({ name, dimensions, unit: 'count' });
            const existing = metrics.get(key);
            metrics.set(key, {
                name,
                value: (existing?.value || 0) + amount,
                unit: 'count',
                dimensions,
            });
        },
        observe(name: string, value: number, unit: 'ms' | 'bytes', dimensions: Record<string, string> = {}): void {
            const key = JSON.stringify({ name, dimensions, unit });
            metrics.set(key, { name, value, unit, dimensions });
        },
        snapshot(): FoundationMetric[] {
            return [...metrics.values()];
        },
    };
}
