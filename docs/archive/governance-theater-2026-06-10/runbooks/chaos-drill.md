# Chaos Drill Runbook

Owner: platform SRE.

1. Run chaos in staging first with `node infrastructure/scripts/chaos/run-chaos-experiment.mjs --type=<type> --environment=staging`.
2. Verify blast radius, abort condition, rollback command, and incident commander before production.
3. Supported types: queue outage, provider outage, replay corruption, cache failure, regional outage, workflow recovery, DLQ flood, and telemetry outage.
4. Record experiment state through `POST /v1/operations/runtime/chaos-experiments`.
5. Validate recovery through runtime overview, queue lag, event-store integrity, and error budget telemetry.
6. Mark failed if automated recovery exceeds target RTO/RPO or if guardrails are breached.
