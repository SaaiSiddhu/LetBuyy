# Operational Dashboard Governance

Operational dashboards are production control surfaces. They must render real runtime projections and must not invent health, queue, incident, or failover data.

## Rules

- Platform Console operations UI must read from `/v1/operations/runtime/overview` or narrower operations endpoints.
- Grafana dashboards must reference Prometheus/Loki/Tempo or Supabase operational projections.
- Missing API tokens, failed health gates, or absent projections must render as unavailable or empty states, not green success.
- Queue, DLQ, replay, event-store integrity, deployment, incident, SRE, security, and regional panels are mandatory production views.
- Dashboard snapshots are recorded in `operational_dashboard_snapshots` when used as production evidence.
