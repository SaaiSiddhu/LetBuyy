# SRE Governance

Production readiness requires SLOs, error budgets, health scoring, escalation policy, and repeatable recovery procedures.

## SLO Sources

- Catalog: `infrastructure/monitoring/slo-catalog.yaml`
- Persistence: `runtime_slo_definitions` and `sre_error_budget_snapshots`
- Alerts: `runtime_alert_evaluations`

## Standards

- `sev1` and `sev2` incidents require postmortems.
- Error budget below 25 percent freezes risky deployments for the affected runtime.
- Checkout, auth, API gateway, storefront, queue workers, and webhooks are critical SLO surfaces.
- Health scoring must combine request success, latency, queue lag, provider health, replay lag, and dependency health.
- Deployment health gates and readiness gate runs are SRE evidence and must be persisted before production promotion.
- Phase 4 ultimate validation is the production readiness gate for provider contracts, Supabase operational verification, observability rollout, security gates, load validation, and runtime health checks.
- Live validation must persist readiness, deployment health, dashboard, and security evidence before a production deployment can be considered operationally proven.
- Operational lifecycle validation must pass before SRE certification.
- Stale certification evidence is a hard failure, not a warning.
