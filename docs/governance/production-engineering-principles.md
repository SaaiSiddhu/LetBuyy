# Production Engineering Principles

Production safety is based on isolation, gradual validation, observability, automated recovery, and hard evidence.

## Principles

- Safe isolation: lower environments cannot share production secrets, queues, telemetry, data, or provider accounts.
- Gradual rollout: production begins with a 1 percent canary unless an approved emergency rollback path is being executed.
- Blue/green promotion: runtime-compatible deployments must support traffic switchback.
- Shadow validation: provider, event-store, queue, replay, and infrastructure migrations should prove consistency without side effects before promotion.
- Observability first: traces, metrics, logs, request IDs, queue lag, replay integrity, and SLO burn rates are deployment gates.
- Automated recovery: rollback and failover must be executable, audited, and tied to incident runbooks.
- Evidence over claims: live success requires fresh operational records under the operations API and certification report store.

## Certification Boundary

`credential-gated-plan-ready` means workflows and contracts exist. `live-certified` requires execute-mode provider operations, recorded evidence, and non-expired certification.
