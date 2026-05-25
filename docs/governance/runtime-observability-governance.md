# Runtime Observability Governance

Production observability is owned by `infrastructure/observability`, runtime telemetry tables, and the operations API.

## Rules

- All runtime telemetry must carry request, correlation, trace, runtime, region, and tenant context when available.
- Queue workers must emit delivery count and lag telemetry for each Cloudflare Queue message.
- Replay, deployment, security, SRE, and regional operations must persist evidence in Supabase operational tables before dashboards claim success.
- Grafana dashboards must use Prometheus, Loki, Tempo, or Supabase operational projections. Static screenshots and mock panels are forbidden.
- Alert annotations must link to runbooks or governance docs.
