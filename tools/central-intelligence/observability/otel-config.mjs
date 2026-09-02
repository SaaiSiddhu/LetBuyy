/**
 * LCIS Observability Engine — otel-config
 * Shared constants, metric names, span attribute keys, and resource/exporter factories.
 * NO side effects at module load — no init(), no SDK start, no network calls.
 * PII policy: constants reference site_id only; no email/phone/name keys.
 */

import process from 'node:process';
import { createRequire } from 'node:module';

// ── Environment ────────────────────────────────────────────────────────────

export const OTEL_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

export const OTEL_ENVIRONMENT =
  process.env.OTEL_ENVIRONMENT ?? 'development';

// ── Service names (match Cloudflare Worker / Next.js / Hono runtimes) ─────

export const SERVICE_NAMES = /** @type {const} */ ({
  API_GATEWAY: 'api-gateway',
  QUEUE_WORKERS: 'queue-workers',
  WEBHOOK_SERVICE: 'webhook-service',
  MOBILE_BFF: 'mobile-bff',
  IDENTITY_PLATFORM: 'identity-platform',
  MERCHANT_CONTROL_PLANE: 'merchant-web',
  STOREFRONT_RUNTIME: 'customer-web',
  MARKETING_SITE: 'marketing-site',
});

// ── Metric names (letbuyy.* namespace) ────────────────────────────────────

export const METRIC_NAMES = /** @type {const} */ ({
  // HTTP
  HTTP_REQUEST_DURATION_MS: 'letbuyy.http.request.duration_ms',
  HTTP_REQUEST_TOTAL: 'letbuyy.http.request.total',

  // Queue
  QUEUE_MESSAGE_DURATION_MS: 'letbuyy.queue.message.duration_ms',
  QUEUE_MESSAGE_TOTAL: 'letbuyy.queue.message.total',

  // Payments
  PAYMENT_ATTEMPT_TOTAL: 'letbuyy.payment.attempt.total',
  PAYMENT_AMOUNT_INR_MINOR: 'letbuyy.payment.amount_inr_minor',

  // Orders
  ORDER_CREATED_TOTAL: 'letbuyy.order.created.total',

  // Workers
  WORKER_EXECUTION_DURATION_MS: 'letbuyy.worker.execution.duration_ms',
  WORKER_EXECUTION_TOTAL: 'letbuyy.worker.execution.total',

  // Merchant (tenant-scoped, site_id label only)
  MERCHANT_ACTION_TOTAL: 'letbuyy.merchant.action.total',

  // Database
  DB_QUERY_DURATION_MS: 'letbuyy.db.query.duration_ms',
  DB_QUERY_TOTAL: 'letbuyy.db.query.total',
});

// ── Span attribute key constants ───────────────────────────────────────────

export const SPAN_ATTRIBUTES = /** @type {const} */ ({
  // Tenant (PII-safe)
  SITE_ID: 'letbuyy.site_id',
  TENANT: 'letbuyy.tenant',

  // Runtime / environment
  RUNTIME: 'letbuyy.runtime',
  ENVIRONMENT: 'letbuyy.environment',

  // HTTP
  HTTP_ROUTE: 'http.route',
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',

  // Database
  DB_TABLE: 'letbuyy.db.table',
  DB_OPERATION: 'letbuyy.db.operation',
  DB_SUCCESS: 'letbuyy.db.success',

  // Queue
  QUEUE_NAME: 'letbuyy.queue.name',
  QUEUE_STATUS: 'letbuyy.queue.status',

  // Payments
  PAYMENT_PROVIDER: 'letbuyy.payment.provider',
  PAYMENT_STATUS: 'letbuyy.payment.status',

  // Workers
  WORKER_NAME: 'letbuyy.worker.name',
  WORKER_SUCCESS: 'letbuyy.worker.success',

  // Merchant actions
  MERCHANT_ACTION: 'letbuyy.merchant.action',
});

// ── Resource attribute key constants ──────────────────────────────────────

export const RESOURCE_ATTRIBUTES = /** @type {const} */ ({
  SERVICE_NAME: 'service.name',
  SERVICE_VERSION: 'service.version',
  DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  LETBUYY_RUNTIME: 'letbuyy.runtime',
});

// ── Factory: Resource ──────────────────────────────────────────────────────

/**
 * Create an OTel Resource for a given service.
 * Lazy-requires @opentelemetry/resources — returns a plain object if not installed.
 * @param {string} serviceName
 * @param {string} [version]
 * @returns {import('@opentelemetry/resources').Resource | Record<string,string>}
 */
export function createResource(serviceName, version = '0.0.0') {
  const require = createRequire(import.meta.url);
  try {
    const { Resource } = require('@opentelemetry/resources');
    const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } =
      require('@opentelemetry/semantic-conventions');
    return new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: version,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
      [RESOURCE_ATTRIBUTES.LETBUYY_RUNTIME]: 'node',
    });
  } catch {
    // Fallback to plain object when SDK not installed
    return {
      [RESOURCE_ATTRIBUTES.SERVICE_NAME]: serviceName,
      [RESOURCE_ATTRIBUTES.SERVICE_VERSION]: version,
      [RESOURCE_ATTRIBUTES.DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
      [RESOURCE_ATTRIBUTES.LETBUYY_RUNTIME]: 'node',
    };
  }
}

// ── Factory: OTLP Trace Exporter ───────────────────────────────────────────

/**
 * Create an OTLP HTTP trace exporter.
 * Lazy-requires @opentelemetry/exporter-trace-otlp-http.
 * @param {string} [endpoint]  defaults to OTEL_ENDPOINT env
 * @returns {import('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter | null}
 */
export function createExporter(endpoint = OTEL_ENDPOINT) {
  const require = createRequire(import.meta.url);
  try {
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    return new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  } catch (err) {
    console.warn(`[otel-config] OTLPTraceExporter NOT AVAILABLE — ${err.message}`);
    return null;
  }
}
