# Enterprise Engineering Model

LetBuyy uses a governed SDLC instead of direct global deployment. Runtime changes must move through local isolation, development integration, staging rehearsal, and credential-gated production execution.

## Lifecycle Order

1. Local: Docker Compose stack with Postgres, Redis, queue emulator, event store, replay runtime, feature flags, provider mocks, email/SMS sandboxes, OpenTelemetry, Prometheus, Grafana, Loki, and Tempo.
2. Development: unstable integration environment for replay, queue, orchestration, and telemetry validation.
3. Staging: production topology mirror with isolated traffic, data, secrets, queues, providers, and telemetry.
4. Production: live customer environment. Production can only be certified after execute-mode provider runs produce fresh evidence.

## Engineering Rules

- Every environment has separate secrets, queues, databases, telemetry, feature flags, and provider accounts.
- Staging must rehearse migrations, rollback, failover, chaos, replay, queue recovery, load, and observability before production promotion.
- Production rollout must use canary, blue/green, shadow traffic, health gates, rollback automation, and operational evidence.
- Plan-mode outputs are workflow evidence only. They are not live certifications.

## Source Authority

- Environment lifecycle: `config/runtime/environment-lifecycle.json`.
- Rollout lifecycle: `config/runtime/rollout-lifecycle.json`.
- Certification policy: `config/runtime/operational-certification-policy.json`.
- Validator: `scripts/validators/operational-lifecycle-validator.mjs`.
