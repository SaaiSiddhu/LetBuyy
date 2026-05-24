import type { SupabaseClient } from '@supabase/supabase-js';

type Metadata = Record<string, unknown>;

export interface WorkerRequestLogInput {
    siteId?: string | null;
    requestId: string;
    traceId?: string | null;
    method: string;
    path: string;
    route?: string | null;
    statusCode: number;
    latencyMs: number;
    userId?: string | null;
    authSource?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    errorCode?: string | null;
    metadata?: Metadata;
}

export interface OperationMetricInput {
    metricName: string;
    dimensions?: Metadata;
    metricValue?: number;
    unit?: string;
    siteId?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    metadata?: Metadata;
}

function isMissingOptionalOperationalTable(error: { message?: string } | null | undefined, tableName: string): boolean {
    return Boolean(error?.message?.includes(tableName) && error.message.includes('schema cache'));
}

export class ObservabilityService {
    constructor(private db: SupabaseClient) {}

    async recordRequestLog(input: WorkerRequestLogInput): Promise<void> {
        const { error } = await this.db
            .from('worker_request_logs')
            .insert({
                site_id: input.siteId || null,
                request_id: input.requestId,
                trace_id: input.traceId || null,
                method: input.method,
                path: input.path,
                route: input.route || null,
                status_code: input.statusCode,
                latency_ms: input.latencyMs,
                user_id: input.userId || null,
                auth_source: input.authSource || null,
                ip_address: input.ipAddress || null,
                user_agent: input.userAgent || null,
                error_code: input.errorCode || null,
                metadata: input.metadata || {},
                created_by: input.userId || null,
                updated_by: input.userId || null,
            });

        if (error && !isMissingOptionalOperationalTable(error, 'worker_request_logs')) {
            throw new Error(`Request log insert failed: ${error.message}`);
        }
    }

    async recordMetric(input: OperationMetricInput): Promise<void> {
        const { error } = await this.db
            .from('operation_metrics')
            .insert({
                metric_name: input.metricName,
                dimensions: input.dimensions || {},
                metric_value: input.metricValue ?? 1,
                unit: input.unit || 'count',
                site_id: input.siteId || null,
                request_id: input.requestId || null,
                trace_id: input.traceId || null,
                metadata: input.metadata || {},
            });

        if (error && !isMissingOptionalOperationalTable(error, 'operation_metrics')) {
            throw new Error(`Metric insert failed: ${error.message}`);
        }
    }
}
