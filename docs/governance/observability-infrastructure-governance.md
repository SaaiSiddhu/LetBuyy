# Observability Infrastructure Governance

LetBuyy production observability is OpenTelemetry first, with Prometheus metrics, Tempo traces, Loki logs, and Grafana dashboards.

## Required Signals

- `X-Request-ID` and `traceparent` must propagate across API, worker, queue, replay, workflow, and provider boundaries.
- Logs must be structured JSON and must not include secrets, cookies, authorization headers, provider tokens, or raw customer payment data.
- Queue, replay, workflow, provider, cache, tenant, regional, and deployment health must emit metrics.

## Infrastructure

- Collector config: `infrastructure/observability/otel-collector.yaml`
- Alert rules: `infrastructure/observability/prometheus-rules.yaml`
- Dashboards: `infrastructure/observability/grafana-*.json`
- Runtime operational tables: `runtime_telemetry_spans`, `runtime_telemetry_metrics`, `runtime_structured_logs`, and `runtime_health_projections`
- Operational evidence tables: `operational_dashboard_snapshots`, `deployment_health_gate_results`, `event_store_integrity_checks`, `sre_error_budget_snapshots`, and `security_enforcement_events`
