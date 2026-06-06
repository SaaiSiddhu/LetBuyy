# Runtime Observability Governance

Production observability is owned by `infrastructure/observability`, runtime telemetry tables, and the operations API.

## Rules

- All runtime telemetry must carry request, correlation, trace, runtime, region, and tenant context when available.
- API Gateway must emit `letbuyy.runtime.request` for each non-internal-shim request through `RUNTIME_TELEMETRY` and `runtime_telemetry_metrics`.
- Queue workers must emit `letbuyy.queue.delivery.batch` and `letbuyy.queue.dead_letter.total` for each Cloudflare Queue batch.
- API Gateway scheduled dispatch must emit `letbuyy.replay.lag.seconds` from active `replay_operation_schedules`.
- Replay, deployment, security, SRE, and regional operations must persist evidence in Supabase operational tables before dashboards claim success.
- Grafana dashboards must use Prometheus, Loki, Tempo, Workers Analytics Engine projections, or Supabase operational projections. Static screenshots and mock panels are forbidden.
- Alert annotations must link to runbooks or governance docs.
- `infrastructure/scripts/observability/verify-observability-rollout.mjs` must validate collector pipelines, alert rules, and dashboard panel contracts before production rollout.
- Live production execution of observability verification requires Prometheus, Grafana, and OpenTelemetry collector health endpoints.
