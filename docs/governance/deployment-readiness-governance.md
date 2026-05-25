# Deployment Readiness Governance

Deployment readiness is a certification input, not a marketing status.

Rules:

- Production promotion requires governance validation, type integrity, deployment health gates, rollback readiness, and live certification report generation.
- Canary, blue/green, rollback, migration, Worker, queue, and app deployment evidence must be visible in operations projections.
- Readiness gates must include version, environment, runtime root, status, and evidence metadata.
- Stale readiness evidence blocks live certification until a new report is generated.
- Operator workflows must preserve plan mode for no-credential environments and execute mode for authenticated rollout.
