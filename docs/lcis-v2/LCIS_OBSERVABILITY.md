# LCIS Observability — Production Instrumentation Reference

**LCIS V2** · `tools/central-intelligence/` · Port `:3334`
**LCIS V1** (intelligence graph, Atlas) · Port `:3333`

---

## 1. Overview

LetBuyy is a multi-tenant India-first commerce platform where a single production incident can simultaneously affect every merchant's checkout, payment, and order flow. A product or framework bug that causes 5 % of Razorpay callbacks to be dropped is silent without structured observability — there is no log line that aggregates across the 8 independently-deployed runtimes, no per-tenant signal that isolates whether the failure is one merchant or all of them, and no automatic alert that fires before the support queue fills up. Structured telemetry at the `letbuyy.*` metric namespace — applied uniformly across the API gateway, queue workers, webhook service, mobile BFF, identity platform, merchant control plane, storefront runtime, and marketing site — is the mechanism that closes that gap.

The LCIS telemetry SDK (`tools/central-intelligence/observability/`) provides a complete, production-ready instrumentation layer. It handles trace export, metric recording, distributed context propagation, incident detection, statistical anomaly detection, and aggregate health checking. The SDK is designed to be graceful: if the telemetry packages are not installed, every call degrades to a no-op and the host process never throws. This makes it safe to wire into any runtime even before the observability backend is reachable.

The critical gap as of 2026-06-19 is that the infrastructure and the SDK both exist, but the SDK has not yet been imported by any of the 8 runtimes. Four Grafana dashboards (`infrastructure/observability/grafana-*.json`), Prometheus alerting rules (`infrastructure/observability/prometheus-rules.yaml`), and an OTel Collector configuration (`infrastructure/observability/otel-collector.yaml`) are ready for data — but there is no data flowing because the runtimes have not called `TelemetryService.init()`. Wiring the SDK is the next concrete step to activate the full observability stack.

---

## 2. Gap Analysis

### What Exists

| Artifact | Path | Purpose |
|---|---|---|
| OTel Collector config (Tempo/Loki) | `infrastructure/observability/otel-collector.yaml` | OTLP receiver (gRPC :4317, HTTP :4318), batch, PII redaction, Prometheus exporter (:9464), Tempo forwarder, Loki forwarder |
| OTel Collector config (observability backend) | `tools/central-intelligence/observability/otel-collector-signoz.yml` | OTLP receiver, memory limiter, full PII redaction, ClickHouse trace/log/metrics storage, Prometheus exporter (:9464) |
| Grafana deployment dashboard | `infrastructure/observability/grafana-deployment-dashboard.json` | Deployment health and gate status |
| Grafana incident dashboard | `infrastructure/observability/grafana-incident-dashboard.json` | Active incidents, severity distribution |
| Grafana queue dashboard | `infrastructure/observability/grafana-queue-dashboard.json` | Queue depth, processing rate, dead-letter growth |
| Grafana runtime dashboard | `infrastructure/observability/grafana-runtime-dashboard.json` | HTTP error rate, p95 latency, worker health |
| Prometheus alerting rules | `infrastructure/observability/prometheus-rules.yaml` | 3 rules: API gateway error rate >1 %, queue dead-letter growth, deployment gate failure |
| LCIS telemetry SDK | `tools/central-intelligence/observability/*.mjs` | Six services: TelemetryService, MetricsService, TracingService, IncidentDetectionService, AnomalyDetectionService, HealthService |
| Cloudflare Worker wrapper | `tools/central-intelligence/observability/instrument-api-gateway.mjs` | `instrument()` function for the Hono api-gateway; exists but not yet imported |
| Local observability stack | `tools/central-intelligence/docker-compose.yml` | ClickHouse, OTel Collector, query service, and observability frontend |

### What Is NOT Yet Wired

**None of the 8 runtimes import or call any part of the LCIS telemetry SDK.** Specifically:

- `services/api-gateway/src/index.ts` does **not** import `instrument()` from `instrument-api-gateway.mjs`. The file itself documents this explicitly:

  > *"This module is NOT imported by `services/api-gateway/src/index.ts` yet. Follow-up task: in `services/api-gateway/src/index.ts`, import `{ instrument }` from `'tools/central-intelligence/observability/instrument-api-gateway.mjs'` and wrap the default Hono export."*

- `services/queue-workers`, `services/webhook-service`, `services/mobile-bff`, `apps/identity-platform`, `apps/merchant-control-plane`, `apps/storefront-runtime`, and `apps/marketing-site` do not call `TelemetryService.init()`.

- The Grafana dashboards, Prometheus rules, and LCIS health endpoint (`GET /intelligence/observability/health`) all have zero live data flowing through them until the wiring step is completed.

---

## 3. Architecture

```mermaid
graph TD
    subgraph Runtimes["8 Runtimes"]
        GW["api-gateway\n(CF Worker / Hono)"]
        QW["queue-workers\n(CF Worker)"]
        WH["webhook-service\n(CF Worker)"]
        MB["mobile-bff\n(Node)"]
        IP["identity-platform\n(Next.js)"]
        MC["merchant-control-plane\n(Next.js)"]
        SR["storefront-runtime\n(Next.js / Proxy)"]
        MS["marketing-site\n(Next.js)"]
    end

    subgraph SDK["LCIS Telemetry SDK\n(tools/central-intelligence/observability/)"]
        TS["TelemetryService\n(NodeSDK lifecycle)"]
        MX["MetricsService\n(letbuyy.* counters / histograms)"]
        TR["TracingService\n(span lifecycle / W3C propagation)"]
        GW2["instrument-api-gateway.mjs\n(@microlabs/otel-cf-workers)"]
    end

    subgraph Collector["OTel Collector\n(:4317 gRPC / :4318 HTTP)"]
        RCV["OTLP Receiver"]
        PROC["Processors\n(memory_limiter → attributes/redaction → batch)"]
        EXP["Exporters"]
    end

    subgraph Storage["Storage"]
        CH["ClickHouse\n(signoz_index_v3 / signoz_logs / signoz_metrics)\nTTL 90 days"]
        PROM["Prometheus\nScrape target :9464\nnamespace: letbuyy"]
    end

    subgraph Frontend["Observability Frontend"]
        SF["Observability UI\n(:3301)"]
        GF["Grafana Dashboards\n(deployment / incident / queue / runtime)"]
    end

    GW -->|instrument()| GW2
    QW & WH & MB & IP & MC & SR & MS -->|TelemetryService.init()| TS
    TS --> MX
    TS --> TR
    GW2 -->|OTLP HTTP /v1/traces| Collector
    TS -->|OTLP HTTP /v1/traces\nOTEL_EXPORTER_OTLP_ENDPOINT| Collector

    RCV --> PROC --> EXP
    EXP --> CH
    EXP --> PROM
    CH --> SF
    PROM --> GF

    subgraph LCIS["LCIS V2 Intelligence Layer\n(:3334)"]
        IDS["IncidentDetectionService"]
        ADS["AnomalyDetectionService"]
        HS["HealthService"]
        API["GET /intelligence/observability/*"]
    end

    MX --> IDS
    IDS -->|graphify-out/incidents.jsonl| API
    ADS --> API
    HS --> API
```

---

## 4. Instrumentation Plan

| Runtime | Source Path | Service Name | Instrumentation Method | Status |
|---|---|---|---|---|
| api-gateway | `services/api-gateway/src/index.ts` | `api-gateway` | Wrap Hono app with `instrument()` from `instrument-api-gateway.mjs`; uses `@microlabs/otel-cf-workers` | **NOT WIRED** |
| queue-workers | `services/queue-workers/` | `queue-workers` | `TelemetryService.init('queue-workers')` + `MetricsService.init(meter)` on worker startup; `recordWorkerExecution` per job | **NOT WIRED** |
| webhook-service | `services/webhook-service/` | `webhook-service` | `TelemetryService.init('webhook-service')` + `recordHttpRequest` per inbound webhook; `TracingService.withSpan` for HMAC verification | **NOT WIRED** |
| mobile-bff | `services/mobile-bff/` | `mobile-bff` | `TelemetryService.init('mobile-bff')` + `recordHttpRequest` + `propagateContext` on outbound gateway calls | **NOT WIRED** |
| identity-platform | `apps/identity-platform/src/` | `identity-platform` | `TelemetryService.init('identity-platform')` in instrumentation file or `layout.tsx` server init; `recordHttpRequest` for auth routes | **NOT WIRED** |
| merchant-control-plane | `apps/merchant-control-plane/src/` | `merchant-control-plane` | `TelemetryService.init('merchant-control-plane')` + `recordMerchantAction` for dashboard actions | **NOT WIRED** |
| storefront-runtime | `apps/storefront-runtime/src/` | `storefront-runtime` | `TelemetryService.init('storefront-runtime')` + `recordHttpRequest` per storefront render/proxy hit | **NOT WIRED** |
| marketing-site | `apps/marketing-site/src/` | `marketing-site` | `TelemetryService.init('marketing-site')` + `recordHttpRequest` for page views | **NOT WIRED** |

**api-gateway wiring (Cloudflare Worker — differs from Node runtimes):**

```ts
// services/api-gateway/src/index.ts
import { instrument } from 'tools/central-intelligence/observability/instrument-api-gateway.mjs'

// ... existing Hono app definition ...

export default instrument(app, {
  serviceName: 'api-gateway',
  serviceVersion: '0.0.0',
  // endpoint resolved from env.OTEL_EXPORTER_OTLP_ENDPOINT at runtime
})
```

**Node runtime wiring (queue-workers example):**

```ts
import telemetry from 'tools/central-intelligence/observability/TelemetryService.mjs'
import metrics from 'tools/central-intelligence/observability/MetricsService.mjs'

await telemetry.init('queue-workers', '0.0.0')
metrics.init(telemetry.getMeter('queue-workers'))
```

---

## 5. Services Reference

### 5.1 TelemetryService

**File:** `tools/central-intelligence/observability/TelemetryService.mjs`

Manages the SDK lifecycle. Singleton — `export default new TelemetryService()`. Graceful: if telemetry packages are absent, `init()` logs `NOT AVAILABLE` and all subsequent calls are no-ops. Never throws.

| Method | Signature | Behaviour |
|---|---|---|
| `init` | `async init(serviceName: string, serviceVersion?: string): Promise<void>` | Idempotent. Starts the Node SDK with OTLP HTTP trace exporter pointing to `OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces`. Attaches resource attributes: `service.name`, `service.version`, `deployment.environment` (`OTEL_ENVIRONMENT`), `letbuyy.runtime: 'node'`. Disables `@opentelemetry/instrumentation-fs`. Logs `CONNECTED` or `NOT AVAILABLE`. |
| `shutdown` | `async shutdown(): Promise<void>` | Flushes pending spans and shuts down the SDK cleanly. Resets `#initialized` to false. |
| `getTracer` | `getTracer(name: string): Tracer` | Returns an OTel Tracer scoped to `name`. Returns noop tracer if not initialized. |
| `getMeter` | `getMeter(name: string): Meter` | Returns an OTel Meter scoped to `name`. Returns noop meter if not initialized. |
| `getLogger` | `getLogger(name: string): Logger` | Returns a Logger via `@opentelemetry/api-logs` if present; otherwise returns a noop logger. |
| `isInitialized` | `isInitialized(): boolean` | Returns `true` only after a successful `init()` call. |

### 5.2 MetricsService

**File:** `tools/central-intelligence/observability/MetricsService.mjs`

Records domain-scoped metrics in the `letbuyy.*` namespace. Singleton — `export default new MetricsService()`. All methods are no-ops if `init()` has not been called. PII policy: no email, phone, or name in any label; `site_id` is the only tenant identifier.

| Method | Signature | Instruments Created |
|---|---|---|
| `init` | `init(meter: Meter): void` | Call after `TelemetryService.init()`. Registers all 12 instruments. |
| `recordHttpRequest` | `recordHttpRequest(method, route, statusCode, durationMs): void` | `letbuyy.http.request.duration_ms` (histogram), `letbuyy.http.request.total` (counter). Attrs: `http.method`, `http.route`, `http.status_code`, `letbuyy.runtime`, `letbuyy.environment`. |
| `recordQueueMessage` | `recordQueueMessage(queueName, status, durationMs): void` | `letbuyy.queue.message.duration_ms`, `letbuyy.queue.message.total`. Status values: `'success'`, `'failure'`, `'retry'`. |
| `recordPaymentAttempt` | `recordPaymentAttempt(provider, status, amount): void` | `letbuyy.payment.attempt.total` (counter), `letbuyy.payment.amount_inr_minor` (histogram, paise). Provider: `'razorpay'` or `'cod'`. Status: `'initiated'`, `'success'`, `'failure'`, `'refunded'`. Amount is numeric only — no customer identity. |
| `recordOrderCreated` | `recordOrderCreated(status): void` | `letbuyy.order.created.total`. Status: `'confirmed'`, `'cod_pending'`, `'failed'`. |
| `recordWorkerExecution` | `recordWorkerExecution(workerName, success, durationMs): void` | `letbuyy.worker.execution.duration_ms`, `letbuyy.worker.execution.total`. |
| `recordMerchantAction` | `recordMerchantAction(siteId, action): void` | `letbuyy.merchant.action.total`. `siteId` is the only tenant identifier; action is a string like `'product_created'`. |
| `recordDatabaseQuery` | `recordDatabaseQuery(operation, table, durationMs, success): void` | `letbuyy.db.query.duration_ms`, `letbuyy.db.query.total`. Operations: `'select'`, `'insert'`, `'update'`, `'delete'`, `'rpc'`. |

### 5.3 TracingService

**File:** `tools/central-intelligence/observability/TracingService.mjs`

Distributed tracing helpers — span lifecycle, W3C context propagation, and merchant context tagging. Singleton — `export default new TracingService()`. PII policy: never set email, phone, or name as span attributes; `site_id` only.

| Method | Signature | Behaviour |
|---|---|---|
| `startSpan` | `startSpan(name: string, attributes?: Record<string,string\|number\|boolean>, options?: SpanOptions): Span` | Returns a live Span with the given attributes set. Returns a noop span if OTel is unavailable. Caller must call `endSpan()`. |
| `endSpan` | `endSpan(span: Span, status?: 'OK'\|'ERROR'\|'UNSET', error?: Error): void` | Records the exception and sets `SpanStatusCode.ERROR` if `error` is provided. Sets `SpanStatusCode.OK` if `status === 'OK'`. Always calls `span.end()`. |
| `withSpan` | `async withSpan(name: string, fn: (span: Span) => Promise<T>, attributes?: object): Promise<T>` | Starts an active span, runs `fn`, ends the span with OK or ERROR status. If OTel is unavailable, executes `fn` with a noop span. |
| `addEvent` | `addEvent(span: Span, name: string, attributes?: object): void` | Calls `span.addEvent(name, attributes)`. No-op if span is null or OTel unavailable. |
| `setMerchantContext` | `setMerchantContext(span: Span, siteId: string): void` | Sets `letbuyy.site_id = siteId` and `letbuyy.tenant = 'merchant'`. |
| `setRouteContext` | `setRouteContext(span: Span, route: string, method: string): void` | Sets `http.route` and `http.method` (uppercased). |
| `propagateContext` | `propagateContext(headers: Record<string,string>): Record<string,string>` | Injects W3C `traceparent` header into the headers map via `propagation.inject()`. Returns the mutated headers. No-op if OTel unavailable. |
| `getCurrentSpan` | `getCurrentSpan(): Span` | Returns the currently active span from OTel context, or a noop span. |

### 5.4 IncidentDetectionService

**File:** `tools/central-intelligence/observability/IncidentDetectionService.mjs`

Rule-based incident detection from aggregated metric snapshots. Incidents are appended to `graphify-out/incidents.jsonl` (fail-safe — never crashes the process) and logged to stdout with a `[INCIDENT:CRITICAL|HIGH|MEDIUM]` tag. Singleton — `export default new IncidentDetectionService()`.

Thresholds are configurable via environment variables: `INCIDENT_ERROR_RATE_THRESHOLD` (default `0.05`) and `INCIDENT_SLOW_QUERY_MS` (default `5000`).

| Method | Signature | Behaviour |
|---|---|---|
| `analyze` | `analyze(metrics: MetricsSnapshot): Incident[]` | Runs all 5 detectors. Calls `emit()` on each incident found. Returns the full array of detected incidents. |
| `detectHighErrorRate` | `detectHighErrorRate(httpMetrics, threshold?): Incident[]` | Rate = `errorRequests / totalRequests`. Fires at ≥ threshold (default 5 %). Severity: CRITICAL ≥ 25 %, HIGH ≥ 10 %, MEDIUM ≥ 5 %. Type: `HIGH_ERROR_RATE`, domain: `http`. |
| `detectSlowQueries` | `detectSlowQueries(dbMetrics, thresholdMs?): Incident[]` | Fires when `avgDurationMs >= thresholdMs` (default 5 000 ms). Severity: HIGH if ≥ 3× threshold, MEDIUM otherwise. Type: `SLOW_DB_QUERY`, domain: `database`. |
| `detectQueueBacklog` | `detectQueueBacklog(queueMetrics, threshold?): Incident[]` | Fires when `depth >= threshold` (default 1 000 messages). Severity: CRITICAL ≥ 5× threshold, HIGH ≥ 2× threshold, MEDIUM ≥ threshold. Type: `QUEUE_BACKLOG`, domain: `queue`. |
| `detectPaymentFailures` | `detectPaymentFailures(paymentMetrics, threshold?): Incident[]` | Rate = `failures / total`. Fires at ≥ threshold (default 10 %). Severity: CRITICAL ≥ 30 %, HIGH ≥ 15 %, MEDIUM ≥ 10 %. Type: `PAYMENT_FAILURE_SPIKE`, domain: `payments`. |
| `detectWorkerCrash` | `detectWorkerCrash(workerMetrics): Incident[]` | Stale threshold: `now - lastHeartbeatMs >= 120 000 ms` (2 min). Severity: CRITICAL if `crashCount > 0 && stale`, HIGH if `crashCount > 0`, MEDIUM if only stale. Type: `WORKER_CRASH`, domain: `workers`. |
| `emit` | `emit(incident: Incident): void` | Logs to stdout with severity tag. Appends JSON line to `graphify-out/incidents.jsonl`. Never throws. |

**Incident shape:**

```ts
{
  id: string          // UUID v4
  type: string        // 'HIGH_ERROR_RATE' | 'SLOW_DB_QUERY' | 'QUEUE_BACKLOG' | 'PAYMENT_FAILURE_SPIKE' | 'WORKER_CRASH'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  domain: string      // 'http' | 'database' | 'queue' | 'payments' | 'workers'
  detectedAt: string  // ISO-8601
  metrics: Record<string, unknown>  // domain-specific metric snapshot
  description: string // human-readable summary
}
```

### 5.5 AnomalyDetectionService

**File:** `tools/central-intelligence/observability/AnomalyDetectionService.mjs`

Pure-statistics anomaly detection using z-score over a rolling window. No ML dependencies. Singleton — `export default new AnomalyDetectionService()`. PII policy: metric names and numeric values only.

| Method | Signature | Behaviour |
|---|---|---|
| `addSample` | `addSample(metricName: string, value: number, timestamp?: number): void` | Appends to the rolling window for `metricName`. Trims the window to the last 1 000 samples. Ignores non-finite values. |
| `detectAnomalies` | `detectAnomalies(metricName: string): AnomalyEvent[]` | Computes z-score for each sample in the window. Returns events where `|z| >= SIGMA_THRESHOLD`. Returns `[]` if window < 10 samples or `stddev === 0`. Deduplicates by `(metricName, timestamp)` before appending to the in-memory log. |
| `getBaseline` | `getBaseline(metricName: string): Baseline` | Returns `{mean, stddev, p50, p95, p99, windowSize}` over the current window. Uses population standard deviation (no Bessel correction). Percentiles use nearest-rank method. |
| `isAnomaly` | `isAnomaly(metricName: string, value: number, sigmaThreshold?: number): boolean` | Point-in-time check. Returns `false` if window < 10 samples or `stddev === 0`. |
| `getAllAnomalies` | `getAllAnomalies(): AnomalyEvent[]` | Returns a shallow copy of all recorded `AnomalyEvent` objects across all metrics. |
| `clearOldSamples` | `clearOldSamples(maxAgeMs: number): void` | Evicts samples older than `maxAgeMs` from all windows. Also prunes the anomaly log to the same cutoff. |

**AnomalyEvent shape:**

```ts
{
  metricName: string
  value: number
  timestamp: number         // epoch ms
  zScore: number
  baseline: {
    mean: number, stddev: number,
    p50: number, p95: number, p99: number,
    windowSize: number
  }
  detectedAt: string        // ISO-8601
}
```

### 5.6 HealthService

**File:** `tools/central-intelligence/observability/HealthService.mjs`

Aggregate health checking across 6 LCIS subsystems. Each checker is isolated via a `#safe()` wrapper — one failure never crashes the aggregate. Singleton — `export default new HealthService()`. Checks against LCIS V1 at `LCIS_V1_URL` (default `http://localhost:3333`). Timeout per check: 5 000 ms.

| Method | Signature | Behaviour |
|---|---|---|
| `getHealth` | `async getHealth(): Promise<AggregateHealth>` | Runs all 6 subsystem checks concurrently. Returns `{overall, subsystems, timestamp}`. `overall` is `DOWN` if any subsystem is DOWN, `DEGRADED` if any is DEGRADED, otherwise `HEALTHY`. |
| `getSubsystemHealth` | `async getSubsystemHealth(subsystem: string): Promise<SubsystemHealth>` | Runs a single named subsystem check. Returns `DOWN` with an error detail if the subsystem name is unknown. |
| `getProductionHealth` | `async getProductionHealth(): Promise<AggregateHealth & {structural: boolean, otelConnected: boolean}>` | Checks only IntelligenceAPI and Observability subsystems. Returns `structural: true` if the V1 LCIS API is reachable, `otelConnected: true` if the telemetry backend is reachable. Never fabricates live values — marks `NOT CONNECTED` where telemetry is absent. |
| `runHealthChecks` | `async runHealthChecks(): Promise<SubsystemHealth[]>` | Runs all 6 checkers concurrently. Calls `emitHealthMetric` for each result. |
| `emitHealthMetric` | `emitHealthMetric(subsystem: string, status: HealthStatus): void` | Emits a JSON line to stdout: `{type:'health_metric', subsystem, status, statusCode, timestamp}`. Status codes: HEALTHY=1, DEGRADED=0.5, DOWN=0. |

**Subsystem checkers:**

| Subsystem | What It Checks | DOWN Condition |
|---|---|---|
| `Memory` | `process.memoryUsage()` heap ratio | heapUsed/heapTotal > 95 % |
| `Graph` | `GET http://localhost:3333/api/atlas` | Fetch fails or HTTP 5xx |
| `Knowledge` | `GET http://localhost:3333/api/domains` | Fetch fails or HTTP 5xx |
| `Browser` | Presence of `tools/central-intelligence/browser-intelligence/` directory | Directory not found → DEGRADED |
| `Observability` | `GET <OTEL_EXPORTER_OTLP_ENDPOINT>/` base URL | Fetch fails → DOWN; HTTP 5xx → DEGRADED |
| `IntelligenceAPI` | `GET http://localhost:3333/api/stats` | Fetch fails or HTTP 5xx |

---

## 6. Metrics Catalog

All metrics use the `letbuyy` Prometheus namespace (set in the collector config). The Prometheus scrape target is `:9464`.

| Metric Name | Type | Unit | Key Attributes | Description |
|---|---|---|---|---|
| `letbuyy.http.request.duration_ms` | Histogram | ms | `http.method`, `http.route`, `http.status_code`, `letbuyy.runtime`, `letbuyy.environment` | HTTP request duration across all runtimes |
| `letbuyy.http.request.total` | Counter | — | `http.method`, `http.route`, `http.status_code`, `letbuyy.runtime`, `letbuyy.environment` | Total HTTP request count by method, route, and status |
| `letbuyy.queue.message.duration_ms` | Histogram | ms | `letbuyy.queue.name`, `letbuyy.queue.status`, `letbuyy.runtime`, `letbuyy.environment` | Queue message processing duration |
| `letbuyy.queue.message.total` | Counter | — | `letbuyy.queue.name`, `letbuyy.queue.status`, `letbuyy.runtime`, `letbuyy.environment` | Total queue messages processed; status: `success`, `failure`, `retry` |
| `letbuyy.payment.attempt.total` | Counter | — | `letbuyy.payment.provider`, `letbuyy.payment.status`, `letbuyy.runtime`, `letbuyy.environment` | Payment attempts by provider (`razorpay`, `cod`) and status (`initiated`, `success`, `failure`, `refunded`) |
| `letbuyy.payment.amount_inr_minor` | Histogram | paise | `letbuyy.payment.provider`, `letbuyy.payment.status`, `letbuyy.runtime`, `letbuyy.environment` | Payment amounts in INR minor units (paise). Numeric only — no customer identity in labels. |
| `letbuyy.order.created.total` | Counter | — | `letbuyy.order.status`, `letbuyy.runtime`, `letbuyy.environment` | Orders created; status: `confirmed`, `cod_pending`, `failed` |
| `letbuyy.worker.execution.duration_ms` | Histogram | ms | `letbuyy.worker.name`, `letbuyy.worker.success`, `letbuyy.runtime`, `letbuyy.environment` | Queue worker job execution duration |
| `letbuyy.worker.execution.total` | Counter | — | `letbuyy.worker.name`, `letbuyy.worker.success`, `letbuyy.runtime`, `letbuyy.environment` | Total worker executions; `letbuyy.worker.success` is string `'true'` or `'false'` |
| `letbuyy.merchant.action.total` | Counter | — | `letbuyy.site_id`, `letbuyy.merchant.action`, `letbuyy.runtime`, `letbuyy.environment` | Merchant actions per store; `site_id` is the only tenant label |
| `letbuyy.db.query.duration_ms` | Histogram | ms | `letbuyy.db.operation`, `letbuyy.db.table`, `letbuyy.db.success`, `letbuyy.runtime`, `letbuyy.environment` | Database query duration; operations: `select`, `insert`, `update`, `delete`, `rpc` |
| `letbuyy.db.query.total` | Counter | — | `letbuyy.db.operation`, `letbuyy.db.table`, `letbuyy.db.success`, `letbuyy.runtime`, `letbuyy.environment` | Total database queries by operation, table, and outcome |

---

## 7. Trace Schema

Spans produced by the LCIS telemetry SDK carry a consistent set of resource attributes and span attributes.

### Resource Attributes (set at SDK init, apply to all spans from a service)

| Attribute | Value Source | Example |
|---|---|---|
| `service.name` | `serviceName` argument to `TelemetryService.init()` | `api-gateway` |
| `service.version` | `serviceVersion` argument (default `0.0.0`) | `1.2.3` |
| `deployment.environment` | `OTEL_ENVIRONMENT` env var (default `development`) | `production` |
| `letbuyy.runtime` | Hard-coded `'node'` for Node runtimes; `serviceName` in CF Worker fallback | `node` |

### Span Attributes

| Attribute Key | Type | Set By | Description |
|---|---|---|---|
| `letbuyy.site_id` | string | `TracingService.setMerchantContext()`, `instrument-api-gateway.mjs` `extractSiteId()` | Tenant store identifier. The **only** allowed tenant identifier in spans. |
| `letbuyy.tenant` | string | `TracingService.setMerchantContext()` | Always `'merchant'` when set. |
| `letbuyy.runtime` | string | MetricsService (from `OTEL_SERVICE_NAME` env) | Runtime service name |
| `letbuyy.environment` | string | MetricsService (from `OTEL_ENVIRONMENT` env) | `development` / `staging` / `production` |
| `http.route` | string | `TracingService.setRouteContext()`, `TracingService.recordHttpRequest()` | Parameterised route, e.g. `/v1/orders/:id` |
| `http.method` | string | `TracingService.setRouteContext()`, `recordHttpRequest()` | Uppercased HTTP verb |
| `http.status_code` | string | `MetricsService.recordHttpRequest()`, `instrument-api-gateway.mjs` | HTTP response status as a string |
| `letbuyy.db.table` | string | `MetricsService.recordDatabaseQuery()` | Supabase table name |
| `letbuyy.db.operation` | string | `MetricsService.recordDatabaseQuery()` | `select`, `insert`, `update`, `delete`, or `rpc` |
| `letbuyy.db.success` | string | `MetricsService.recordDatabaseQuery()` | `'true'` or `'false'` |
| `letbuyy.queue.name` | string | `MetricsService.recordQueueMessage()` | Cloudflare Queue name |
| `letbuyy.queue.status` | string | `MetricsService.recordQueueMessage()` | `success`, `failure`, or `retry` |
| `letbuyy.payment.provider` | string | `MetricsService.recordPaymentAttempt()` | `razorpay` or `cod` |
| `letbuyy.payment.status` | string | `MetricsService.recordPaymentAttempt()` | `initiated`, `success`, `failure`, or `refunded` |
| `letbuyy.worker.name` | string | `MetricsService.recordWorkerExecution()` | Worker identifier |
| `letbuyy.worker.success` | string | `MetricsService.recordWorkerExecution()` | `'true'` or `'false'` |
| `letbuyy.merchant.action` | string | `MetricsService.recordMerchantAction()` | Action identifier, e.g. `product_created`, `order_refunded` |

---

## 8. PII Policy

The PII policy is enforced at two layers: the SDK (developer contract) and the collector (pipeline enforcement).

### SDK Layer (source of truth)

- **Never** set a span attribute containing a customer email, phone number, or name.
- **Never** use a customer email, phone number, or name as a metric label dimension.
- `letbuyy.site_id` is the **only** allowed tenant identifier in spans and metric labels. It identifies the store, not any individual person.
- Payment amounts (`letbuyy.payment.amount_inr_minor`) are recorded as numeric values. No customer identity is included in the payment metric labels. This is documented explicitly in `MetricsService.mjs`: *"PII: amount is fine (a number); no customer identity."*
- `TracingService.setMerchantContext()` sets only `letbuyy.site_id` and `letbuyy.tenant`. The merchant's own email or business name is never attached.
- `instrument-api-gateway.mjs` extracts `site_id` from the URL path pattern `/stores/<site_id>/` via `extractSiteId()`, which returns `'unknown'` if absent. It never reads request body, query parameters, or auth headers for span attributes.

### Collector Layer (pipeline enforcement)

Both collector configurations apply an `attributes/redaction` processor that **deletes** the following keys before any export:

| Deleted Key | Reason |
|---|---|
| `authorization` | Bearer tokens, API keys |
| `cookie` | Session cookies |
| `set-cookie` | Set-Cookie response headers |
| `x-api-key` | Service API keys |
| `enduser.id` | OTel semantic: end user identifier |
| `enduser.email` | OTel semantic: end user email |
| `user.email` | Custom user email attribute |
| `user.name` | Custom user name attribute |

The redaction is applied in `tools/central-intelligence/observability/otel-collector-signoz.yml` (full set, 8 keys) and in `infrastructure/observability/otel-collector.yaml` (3 keys: `authorization`, `cookie`, `set-cookie`). The SigNoz collector config is the more complete enforcement layer.

---

## 9. Collector Configuration

Two OTel Collector configurations exist with different backends. Both share the same receiver configuration (OTLP gRPC :4317, OTLP HTTP :4318) and the same batch settings.

### 9.1 Tempo/Loki Stack — `infrastructure/observability/otel-collector.yaml`

This configuration is designed for the Kubernetes observability namespace (`letbuyy-observability.svc.cluster.local`).

| Pipeline | Receivers | Processors | Exporters |
|---|---|---|---|
| traces | otlp | memory_limiter → attributes/redaction → batch | `otlp/tempo` → `tempo.letbuyy-observability.svc.cluster.local:4317` (TLS insecure) |
| metrics | otlp | memory_limiter → batch | `prometheus` → `:9464` |
| logs | otlp | memory_limiter → attributes/redaction → batch | `loki` → `http://loki.letbuyy-observability.svc.cluster.local:3100/loki/api/v1/push` |

PII redaction strips `authorization`, `cookie`, and `set-cookie`. No health_check extension is declared in this config.

### 9.2 Observability Backend Stack — `tools/central-intelligence/observability/otel-collector-signoz.yml`

This is the LCIS V2 local development and production observability config. Used by the `docker-compose.yml` local stack.

| Pipeline | Receivers | Processors | Exporters |
|---|---|---|---|
| traces | otlp | memory_limiter → attributes/redaction → batch | `clickhouse` (signoz_index_v3), `debug` |
| metrics | otlp | memory_limiter → batch | `prometheus` → `:9464` (namespace: `letbuyy`), `debug` |
| logs | otlp | memory_limiter → attributes/redaction → batch | `clickhouse` (signoz_logs), `debug` |

**Key differences from the Tempo/Loki config:**

| Feature | Tempo/Loki (`otel-collector.yaml`) | Observability Backend (`otel-collector-signoz.yml`) |
|---|---|---|
| Trace storage | Tempo (remote Kubernetes) | ClickHouse `signoz_index_v3` (local or managed) |
| Log storage | Loki (remote Kubernetes) | ClickHouse `signoz_logs` |
| Metrics | Prometheus `:9464` | Prometheus `:9464` + ClickHouse `signoz_metrics` |
| PII redaction | 3 keys | 8 keys (full set including `enduser.id`, `enduser.email`, `user.email`, `user.name`) |
| Health check | Not configured | `health_check` extension on `:13133/health` |
| pprof | Not configured | `:1777` |
| zpages | Not configured | `:55679` |
| TTL | Not configured | ClickHouse TTL 90 days (2 160 hours) |
| Debug exporter | Not present | Present (basic verbosity, sampling 5/200) |
| ClickHouse connection | — | `tcp://clickhouse:9000`, database: `signoz_traces`, traces table: `signoz_index_v3` |

**ClickHouse table mapping:**

| Data Type | ClickHouse Table |
|---|---|
| Traces | `signoz_index_v3` |
| Logs | `signoz_logs` |
| Metrics | `signoz_metrics` |

---

## 10. Cloudflare Worker Instrumentation

The Hono-based `api-gateway` runs in the Cloudflare Workers runtime, which has no access to Node.js APIs (`process`, `require`, `__dirname`) at module load time. The standard Node SDK used by the other runtimes cannot be used here.

**File:** `tools/central-intelligence/observability/instrument-api-gateway.mjs`

### The `instrument()` Function

```ts
export function instrument(handler: HonoApp, config: InstrumentConfig): WorkerHandler
```

Wraps a Hono app's `fetch` handler with OTel tracing. Passes `queue` and `scheduled` handlers through unchanged. The endpoint is resolved from `env.OTEL_EXPORTER_OTLP_ENDPOINT` at runtime (the Cloudflare Worker environment bag), not from `process.env`.

**Primary path — `@microlabs/otel-cf-workers`:**

The function lazy-imports `@microlabs/otel-cf-workers` on the first request. If the package is present, it delegates to `instrument()` from that package with the resolved endpoint and service name. The dynamic import is Worker-safe (evaluated at runtime, not at bundle time).

```ts
import('@microlabs/otel-cf-workers').then(mod => {
  // delegate to mod.instrument({ fetch: handler.fetch }, () => ({
  //   exporter: { url: `${resolvedEndpoint}/v1/traces` },
  //   service: { name: serviceName, version: serviceVersion }
  // }))
})
```

**Fallback path — `tracedFetch`:**

If `@microlabs/otel-cf-workers` is absent (package not installed or bundle exclusion), the function falls back to `tracedFetch()`: a lightweight manual tracer that:

1. Generates a W3C `traceparent` header using Web Crypto (`crypto.getRandomValues`) — no Node.js crypto dependency.
2. Clones the inbound request with the `traceparent` header injected.
3. Calls the original handler and captures the response status.
4. Emits a JSON-structured span to `console.log` for OTel Collector log receiver pickup.

Span attributes in the fallback path: `http.method`, `http.route` (URL pathname), `http.status_code`, `letbuyy.runtime` (serviceName), `letbuyy.site_id` (extracted from `/stores/<site_id>/` path segment; returns `'unknown'` if absent).

### Pending Wiring

As documented in the source file itself, `instrument()` is **not yet imported** by `services/api-gateway/src/index.ts`. The wiring requires one change:

```ts
// services/api-gateway/src/index.ts
import { instrument } from 'tools/central-intelligence/observability/instrument-api-gateway.mjs'

// After the Hono app is fully configured:
export default instrument(app, {
  serviceName: 'api-gateway',
  serviceVersion: '0.0.0',
})
```

The Cloudflare Worker environment variable `OTEL_EXPORTER_OTLP_ENDPOINT` must be set in the Worker's `wrangler.toml` or Cloudflare dashboard for the primary OTel path to activate.

---

## 11. Incident Detection Rules

Incident objects are persisted to `graphify-out/incidents.jsonl` (one JSON object per line, appended by `IncidentDetectionService.emit()`). The LCIS V2 API serves the 50 most recent incidents (newest first) at `GET /intelligence/observability/incidents`.

| Rule Type | Domain | Trigger Condition | Severity Scale | Output File |
|---|---|---|---|---|
| `HIGH_ERROR_RATE` | `http` | `errorRequests / totalRequests >= threshold` (default 5 %) | MEDIUM ≥ 5 %, HIGH ≥ 10 %, CRITICAL ≥ 25 % | `graphify-out/incidents.jsonl` |
| `SLOW_DB_QUERY` | `database` | `avgDurationMs >= thresholdMs` (default 5 000 ms) | MEDIUM ≥ 1× threshold, HIGH ≥ 3× threshold | `graphify-out/incidents.jsonl` |
| `QUEUE_BACKLOG` | `queue` | `depth >= threshold` (default 1 000 messages) | MEDIUM ≥ 1× threshold, HIGH ≥ 2× threshold, CRITICAL ≥ 5× threshold | `graphify-out/incidents.jsonl` |
| `PAYMENT_FAILURE_SPIKE` | `payments` | `failures / total >= threshold` (default 10 %) | MEDIUM ≥ 10 %, HIGH ≥ 15 %, CRITICAL ≥ 30 % | `graphify-out/incidents.jsonl` |
| `WORKER_CRASH` | `workers` | `crashCount > 0` OR `now - lastHeartbeatMs >= 120 000 ms` | MEDIUM (stale only), HIGH (crashed), CRITICAL (crashed && stale) | `graphify-out/incidents.jsonl` |

**Configurable thresholds:**

| Rule | Env Var | Default |
|---|---|---|
| HTTP error rate | `INCIDENT_ERROR_RATE_THRESHOLD` | `0.05` |
| Slow query | `INCIDENT_SLOW_QUERY_MS` | `5000` |
| Queue backlog | Hard-coded in `analyze()` call | `1000` messages |
| Payment failure rate | Hard-coded in `analyze()` call | `0.10` |
| Worker stale heartbeat | Hard-coded constant | `120 000 ms` |

---

## 12. Anomaly Detection

**File:** `tools/central-intelligence/observability/AnomalyDetectionService.mjs`

### Algorithm

The service uses **z-score anomaly detection** with a population standard deviation (no Bessel correction). The rolling window holds up to 1 000 samples per metric name, stored in a `Map<string, Sample[]>`.

```
z = (value - mean) / stddev
anomaly if |z| >= SIGMA_THRESHOLD
```

**Population std-dev formula** (exactly as implemented):

```
variance = Σ(v - mean)² / n        // divided by n, not n-1
stddev = sqrt(variance)
```

### Detection Constraints

| Constraint | Value | Reason |
|---|---|---|
| Minimum window for detection | 10 samples | Fewer samples produce unreliable baselines |
| Rolling window size | 1 000 samples per metric | Bounded memory per metric |
| `stddev === 0` | No anomaly possible | Constant signal; division-by-zero guard |
| Default sigma threshold | `3.0` (overridable via `ANOMALY_SIGMA_THRESHOLD`) | 3σ covers ≈ 99.7 % of a normal distribution |

### Baseline Statistics

`getBaseline()` computes `{mean, stddev, p50, p95, p99, windowSize}` over the current window. Percentiles use the nearest-rank method on a sorted copy of the window values.

### Deduplication

`detectAnomalies()` deduplicates by `(metricName, timestamp)` before appending to the in-memory anomaly log. `clearOldSamples(maxAgeMs)` evicts both window samples and anomaly log entries older than the cutoff.

---

## 13. Environment Variables

| Variable | Default | Service | Purpose |
|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | All runtimes, TelemetryService, instrument-api-gateway, HealthService | OTLP HTTP endpoint for the telemetry pipeline collector. Set to the collector's `:4318` address in each runtime environment. |
| `OTEL_ENVIRONMENT` | `development` | TelemetryService, MetricsService | Value of the `deployment.environment` resource attribute and `letbuyy.environment` metric label. Set to `staging` or `production` in deployed environments. |
| `OTEL_SERVICE_NAME` | `lcis` | MetricsService | Used as the `letbuyy.runtime` metric label fallback. Normally set by the runtime's own `TelemetryService.init()` call. |
| `LCIS_V1_URL` | `http://localhost:3333` | HealthService | Base URL of the LCIS V1 intelligence API. Used by the Graph, Knowledge, and IntelligenceAPI subsystem health checks. |
| `INCIDENT_ERROR_RATE_THRESHOLD` | `0.05` | IncidentDetectionService | Fraction (0–1). HTTP error rate above this value triggers a `HIGH_ERROR_RATE` incident. |
| `INCIDENT_SLOW_QUERY_MS` | `5000` | IncidentDetectionService | Milliseconds. Database queries whose average duration exceeds this threshold trigger a `SLOW_DB_QUERY` incident. |
| `ANOMALY_SIGMA_THRESHOLD` | `3.0` | AnomalyDetectionService | Number of standard deviations above/below the mean required to flag an anomaly. |

---

## 14. API Endpoints

All endpoints are served by the LCIS V2 intelligence API server at `tools/central-intelligence/intelligence-api/server.mjs` on port **:3334**.

| Method | Path | Response | Source Service |
|---|---|---|---|
| `GET` | `/intelligence/observability/health` | `AggregateHealth` object: `{overall, subsystems[], timestamp}` | `HealthService.getHealth()` |
| `GET` | `/intelligence/observability/incidents` | `{incidents: Incident[], count: number}` — last 50 lines of `graphify-out/incidents.jsonl`, newest first | `IncidentDetectionService` (file read) |
| `GET` | `/intelligence/observability/anomalies` | `{anomalies: AnomalyEvent[]}` — in-memory anomaly log | `AnomalyDetectionService.getAllAnomalies()` |

**Health response shape:**

```json
{
  "overall": "HEALTHY" | "DEGRADED" | "DOWN",
  "subsystems": [
    { "name": "Memory", "status": "HEALTHY", "latencyMs": 0, "details": {} },
    { "name": "Graph", "status": "HEALTHY", "latencyMs": 12, "details": {} },
    { "name": "Knowledge", "status": "HEALTHY", "latencyMs": 9, "details": {} },
    { "name": "Browser", "status": "HEALTHY", "latencyMs": 1, "details": {} },
    { "name": "Observability", "status": "DOWN", "latencyMs": 5001, "details": { "error": "NOT CONNECTED — set OTEL_EXPORTER_OTLP_ENDPOINT" } },
    { "name": "IntelligenceAPI", "status": "HEALTHY", "latencyMs": 7, "details": {} }
  ],
  "timestamp": "2026-06-19T00:00:00.000Z"
}
```

---

## 15. Local Observability Stack (Docker Compose)

**File:** `tools/central-intelligence/docker-compose.yml`

The Docker Compose file provides a self-contained local observability stack for LCIS V2 development and integration testing. Start it with:

```bash
# Minimal (vector store only):
docker compose -f tools/central-intelligence/docker-compose.yml up -d qdrant

# Full observability stack:
docker compose -f tools/central-intelligence/docker-compose.yml up -d
```

### Services

| Service | Container | Image | Ports | Purpose |
|---|---|---|---|---|
| `qdrant` | `lcis-qdrant` | `qdrant/qdrant:latest` | `6333` (REST + dashboard), `6334` (gRPC) | Vector store backing the LCIS Memory Engine |
| `signoz-clickhouse` | `lcis-clickhouse` | `clickhouse/clickhouse-server:24.1.2-alpine` | `9000` (native), `8123` (HTTP) | Trace, log, and metrics storage. Default DB: `signoz_traces`. TTL: 90 days. |
| `signoz-otel-collector` | `lcis-otel-collector` | `signoz/signoz-otel-collector:0.88.11` | `4317` (gRPC), `4318` (HTTP) | Receives OTLP from all 8 runtimes; applies PII redaction; forwards to ClickHouse and Prometheus |
| `signoz-query-service` | `lcis-signoz-query` | `signoz/query-service:0.43.0` | `8080` | Query API for the observability frontend; backed by `tcp://signoz-clickhouse:9000` |
| `signoz-frontend` | `lcis-signoz-frontend` | `signoz/frontend:0.43.0` | `3301` | Observability UI at `http://localhost:3301` |

### Health Checks

- ClickHouse: `clickhouse-client --query "SELECT 1"` (10 s interval, 10 retries, 30 s start period)
- OTel Collector: `curl -sf http://localhost:13133/health` (15 s interval, 5 retries, 20 s start period)
- Query service: `wget -qO- http://localhost:8080/api/v1/health` (15 s interval, 10 retries, 45 s start period)

The OTel Collector mounts the config from `tools/central-intelligence/observability/otel-collector-signoz.yml` as a read-only volume. All services share the `letbuyy-intelligence` bridge network.

**Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in each runtime's local `.env` to route traces into this stack.**
