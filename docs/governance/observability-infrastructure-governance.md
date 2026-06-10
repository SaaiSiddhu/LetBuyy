# Observability Infrastructure Governance

LetBuyy runtime observability is emitted first from Workers into Cloudflare Workers Analytics Engine and the Supabase `runtime_telemetry_metrics`/request-log tables. OpenTelemetry, Prometheus, Tempo, Loki, and Grafana are the rollout stack that must be health-checked before live certification.

## Required Signals

- `X-Request-ID` and `traceparent` must propagate across API, worker, queue, workflow, and provider boundaries.
- Logs must be structured JSON and must not include secrets, cookies, authorization headers, provider tokens, or raw customer payment data.
- API request, queue dead-letter, and deployment health telemetry must have runtime producers before dashboards claim them. Workflow, provider, cache, tenant, and deployment health must either emit metrics or stay represented only as evidence-table projections.

## Infrastructure

- Collector config: `infrastructure/observability/otel-collector.yaml`
- Alert rules: `infrastructure/observability/prometheus-rules.yaml` (rollout target; live alerting requires the collector/exporter health gate)
- Dashboards: `infrastructure/observability/grafana-*.json`
- Runtime operational tables: `runtime_telemetry_spans`, `runtime_telemetry_metrics`, `runtime_structured_logs`, and `runtime_health_projections`
- Operational evidence tables: `operational_dashboard_snapshots`, `deployment_health_gate_results`, and `security_enforcement_events`
