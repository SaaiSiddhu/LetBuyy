# Incident Response Governance

Incidents are operational records, not chat-only events. Production incidents must be created through the operations control-plane and retained in Supabase.

## Severity

- `sev1`: checkout, auth, storefront, or API outage with broad customer impact.
- `sev2`: degraded checkout, queue backlog, regional failover, or provider outage affecting live commerce.
- `sev3`: isolated runtime degradation or tenant-scoped operational impact.
- `sev4`: low-risk operational issue with no customer-visible impact.

## Required Records

- Incident metadata in `production_incidents`
- Timeline entries in `production_incident_events`
- Alert evidence in `runtime_alert_evaluations`
- Related control commands in `runtime_control_commands`

## Response Flow

1. Open incident with severity, affected runtimes, affected regions, and customer impact.
2. Assign commander and mitigation owner.
3. Execute mitigations through `/v1/operations/runtime/control-commands`.
4. Record mitigation and resolution timestamps.
5. Close only after recovery verification and postmortem link are available for `sev1` and `sev2`.
