import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { CorrelationContext } from '@letbuyy/shared-types';
import { defineRuntimeBridge } from '@letbuyy/shared-types';

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

export interface RuntimeTelemetryMetricInput {
    metricName: string;
    metricValue?: number;
    unit?: string;
    runtimeName?: string | null;
    dimensions?: Metadata;
    siteId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
    traceId?: string | null;
}

function isMissingOptionalOperationalTable(error: { message?: string } | null | undefined, tableName: string): boolean {
    return Boolean(error?.message?.includes(tableName) && error.message.includes('schema cache'));
}

function requestLogRow(input: WorkerRequestLogInput) {
    return {
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
    };
}

export class ObservabilityExecutionAdapter {
    static readonly correlationContract: Array<keyof CorrelationContext> = ['requestId', 'correlationId'];
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'observability-execution.adapter',
        workflowAuthority: 'notification-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) {}

    async recordRequestLog(input: WorkerRequestLogInput): Promise<void> {
        const { error } = await this.db
            .from('worker_request_logs')
            .insert(requestLogRow(input));

        if (error && !isMissingOptionalOperationalTable(error, 'worker_request_logs')) {
            throw new Error(`Request log insert failed: ${error.message}`);
        }
    }

    async recordRequestLogs(inputs: WorkerRequestLogInput[]): Promise<void> {
        if (!inputs.length) return;

        const { error } = await this.db
            .from('worker_request_logs')
            .insert(inputs.map(requestLogRow));

        if (error && !isMissingOptionalOperationalTable(error, 'worker_request_logs')) {
            throw new Error(`Request log batch insert failed: ${error.message}`);
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

    async recordRuntimeMetric(input: RuntimeTelemetryMetricInput): Promise<void> {
        const { error } = await this.db
            .from('runtime_telemetry_metrics')
            .insert({
                metric_name: input.metricName,
                metric_value: input.metricValue ?? 1,
                unit: input.unit || 'count',
                runtime_name: input.runtimeName || null,
                site_id: input.siteId || null,
                dimensions: input.dimensions || {},
                request_id: input.requestId || null,
                correlation_id: input.correlationId || null,
                trace_id: input.traceId || null,
            });

        if (error && !isMissingOptionalOperationalTable(error, 'runtime_telemetry_metrics')) {
            throw new Error(`Runtime metric insert failed: ${error.message}`);
        }
    }
}
