# SEV1 Incident Runbook

Owner: platform SRE.

Entry condition: customer-impacting checkout, storefront, auth, payment, queue, database, or provider outage.

1. Create the incident through `POST /v1/operations/runtime/incidents`.
2. Assign one incident commander and one communications owner.
3. Freeze deployments by recording a failed or blocked readiness gate with `POST /v1/operations/runtime/readiness-gates`.
4. Inspect runtime health, queue state, deployment gates, active alerts, security enforcement, incidents, and certification evidence through `/v1/operations/runtime/overview`.
5. Apply the smallest recovery action: rollback Worker version, pause provider, redrive DLQ, or invalidate affected cache entries.
6. Record every material timeline event through `PATCH /v1/operations/runtime/incidents/:incidentId/status`.
7. Close only after impact is mitigated, telemetry is stable for two observation windows, and postmortem metadata is linked.
