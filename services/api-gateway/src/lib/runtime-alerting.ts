import { createCloudflareQueueProducer, type CloudflareQueueBinding } from '@letbuyy/infrastructure/queue-adapter';
import type { RuntimeTelemetryMetricInput } from '../execution/observability-execution.adapter';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

export const RUNTIME_ALERT_JOB_TYPE = 'incident.page.dry_run';
export const RUNTIME_ALERT_METRIC_NAME = 'letbuyy.alert.runtime.error';
export const RUNTIME_ALERT_TARGET_TEAM = 'runtime-ops';
export const RUNTIME_ALERT_REASON = 'CAP-C10 automated runtime alert dry-run from API gateway observability.';
export const REDACTED_ALERT_SECRET = '[REDACTED_ALERT_SECRET]';

const ALERT_SECRET_KEY_PATTERN = /(^|_)(authorization|cookie|password|secret|token|api_key|private_key|jwk|dsn)($|_)/i;
const MAX_ALERT_STRING_LENGTH = 500;

export interface RuntimeAlertPlanInput {
    runtimeName: string;
    environment?: string | null;
    deploymentEnv?: string | null;
    telemetryEnv?: string | null;
    runtimeQueueName: string;
    siteId?: string | null;
    requestId: string;
    traceId: string;
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    errorCode?: string | null;
    userId?: string | null;
    authSource?: string | null;
    country?: string | null;
    colo?: string | null;
    metadata?: JsonRecord;
}

export interface RuntimeAlertPlan {
    metric: RuntimeTelemetryMetricInput;
    queueMessage: {
        id: string;
        queueName: string;
        jobType: typeof RUNTIME_ALERT_JOB_TYPE;
        payload: JsonRecord;
        attempts: number;
        correlationId: string;
    };
}

export interface RuntimeAlertMetricRecorder {
    recordRuntimeMetric(input: RuntimeTelemetryMetricInput): Promise<void>;
}

export interface RuntimeAlertEnqueueInput extends RuntimeAlertPlanInput {
    runtimeQueue?: CloudflareQueueBinding<Record<string, unknown>> | null;
    metricRecorder: RuntimeAlertMetricRecorder;
}

export interface RuntimeAlertEnqueueResult {
    queued: boolean;
    reason?: 'not-alertable' | 'missing-runtime-queue-binding';
    plan?: RuntimeAlertPlan;
}

function safeString(value: string | null | undefined, fallback = ''): string {
    const normalized = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
    return normalized.length > MAX_ALERT_STRING_LENGTH ? normalized.slice(0, MAX_ALERT_STRING_LENGTH) : normalized;
}

function alertSafeRoute(route: string): string {
    return safeString(route.split('?')[0], '/');
}

function redactAlertValue(value: JsonValue, key = ''): JsonValue {
    if (ALERT_SECRET_KEY_PATTERN.test(key)) return REDACTED_ALERT_SECRET;
    if (typeof value === 'string') {
        return safeString(value.replace(/SKIP_NEEDS_HUMAN_[A-Z0-9_]+/g, 'configuration unavailable'));
    }
    if (Array.isArray(value)) return value.map((item) => redactAlertValue(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
        Object.entries(value).map(([nestedKey, nestedValue]) => [
            nestedKey,
            redactAlertValue(nestedValue, nestedKey),
        ]),
    );
}

export function redactRuntimeAlertPayload(value: JsonRecord): JsonRecord {
    return redactAlertValue(value) as JsonRecord;
}

function alertSeverity(input: RuntimeAlertPlanInput): 'sev2' | 'sev3' {
    const route = input.route.toLowerCase();
    if (
        input.statusCode >= 503
        || route.includes('/payments')
        || route.includes('/checkout')
        || route.includes('/payouts')
        || route.includes('/settlements')
        || route.includes('/auth')
    ) {
        return 'sev2';
    }
    return 'sev3';
}

function alertable(input: RuntimeAlertPlanInput): boolean {
    return input.statusCode >= 500;
}

function alertDedupeKey(input: RuntimeAlertPlanInput): string {
    const route = alertSafeRoute(input.route).replace(/[^a-zA-Z0-9/_-]+/g, '-');
    return `runtime-alert:${input.environment || 'unknown'}:${input.requestId}:${input.statusCode}:${route}`;
}

export function planRuntimeAlert(input: RuntimeAlertPlanInput): RuntimeAlertPlan | null {
    if (!alertable(input)) return null;

    const route = alertSafeRoute(input.route);
    const severity = alertSeverity(input);
    const dedupeKey = alertDedupeKey(input);
    const deploymentEnv = input.deploymentEnv || input.environment || 'unknown';
    const telemetryEnv = input.telemetryEnv || input.environment || 'unknown';
    const summary = `${input.runtimeName} ${input.statusCode} ${input.method.toUpperCase()} ${route}`;
    const commonDimensions = redactRuntimeAlertPayload({
        source: 'api-gateway.observability',
        route,
        method: input.method.toUpperCase(),
        status_code: input.statusCode,
        severity,
        error_code: input.errorCode || null,
        auth_source: input.authSource || null,
        country: input.country || null,
        colo: input.colo || null,
        deployment_env: deploymentEnv,
        telemetry_env: telemetryEnv,
        ...(input.metadata || {}),
    });

    return {
        metric: {
            metricName: RUNTIME_ALERT_METRIC_NAME,
            metricValue: 1,
            unit: 'count',
            runtimeName: input.runtimeName,
            siteId: input.siteId || null,
            requestId: input.requestId,
            correlationId: input.requestId,
            traceId: input.traceId,
            dimensions: commonDimensions,
        },
        queueMessage: {
            id: dedupeKey,
            queueName: input.runtimeQueueName,
            jobType: RUNTIME_ALERT_JOB_TYPE,
            attempts: 0,
            correlationId: input.requestId,
            payload: redactRuntimeAlertPayload({
                incident_id: null,
                target_team: RUNTIME_ALERT_TARGET_TEAM,
                severity,
                summary,
                reason: RUNTIME_ALERT_REASON,
                request_id: input.requestId,
                trace_id: input.traceId,
                site_id: input.siteId || null,
                runtime_name: input.runtimeName,
                environment: input.environment || null,
                deployment_env: deploymentEnv,
                telemetry_env: telemetryEnv,
                alert_dedupe_key: dedupeKey,
                metadata: commonDimensions,
            }),
        },
    };
}

export async function enqueueRuntimeAlert(input: RuntimeAlertEnqueueInput): Promise<RuntimeAlertEnqueueResult> {
    const plan = planRuntimeAlert(input);
    if (!plan) return { queued: false, reason: 'not-alertable' };

    await input.metricRecorder.recordRuntimeMetric(plan.metric);

    if (!input.runtimeQueue) {
        return { queued: false, reason: 'missing-runtime-queue-binding', plan };
    }

    await createCloudflareQueueProducer(input.runtimeQueue).enqueue(plan.queueMessage);
    return { queued: true, plan };
}
