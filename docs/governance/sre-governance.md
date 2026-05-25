# SRE Governance

Production readiness requires SLOs, error budgets, health scoring, escalation policy, and repeatable recovery procedures.

## SLO Sources

- Catalog: `infrastructure/monitoring/slo-catalog.yaml`
- Persistence: `runtime_slo_definitions`
- Alerts: `runtime_alert_evaluations`

## Standards

- `sev1` and `sev2` incidents require postmortems.
- Error budget below 25 percent freezes risky deployments for the affected runtime.
- Checkout, auth, API gateway, storefront, queue workers, and webhooks are critical SLO surfaces.
- Health scoring must combine request success, latency, queue lag, provider health, replay lag, and dependency health.
