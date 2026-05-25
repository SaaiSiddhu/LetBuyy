# Observability Governance

This document defines observability standards only. It does not implement telemetry systems.

## Correlation

- Every request should carry `X-Request-ID`.
- Runtime logs must preserve request ID, runtime name, tenant/site where applicable, actor type, and sanitized error code.
- Cross-runtime calls must pass correlation IDs through API headers or provider metadata where safe.

## Structured Logging

- Production logs must be structured and redacted.
- Never log credentials, tokens, service-role keys, payment secrets, raw provider signatures, customer payment data, or full PII payloads.
- UI runtimes may log operational events server-side only when sanitized and correlated.

## Audit Logging

- Merchant mutations require tenant-scoped audit records.
- Platform console actions require privileged immutable audit records.
- Platform operations portal actions require employee role, target resource, and workflow state.
- Webhook side effects require provider event ID, signature verification result, idempotency key, and reconciliation status.

## Metrics Ownership

- Apps own user-facing performance and route health metrics.
- Services own latency, error code, provider integration, idempotency, queue, webhook, and mutation metrics.
- Infrastructure owns DNS, WAF, deployment, certificate, worker, and edge health metrics.

## Event Observability

- Domain events must include event ID, producer, tenant/site scope when applicable, entity reference, event version, and timestamp.
- Event payloads must be minimal and must not carry secrets.
- Consumers must record retry and dead-letter state before production reliance.

## Runtime Boundaries

- Observability code must not import runtime internals across app/service boundaries.
- Shared telemetry contracts may live in packages only after two or more runtimes need them.
- Generated logs and local traces are not source authority and must not be committed.

## Local and Staging Evidence

- Local observability is implemented by `infrastructure/local/docker-compose.yml` with OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo.
- Staging must emit queue, replay, deployment, feature-flag exposure, shadow traffic, and SLO evidence before production promotion.
- Production observability certification requires execute-mode evidence in `operational_dashboard_snapshots` and `sre_error_budget_snapshots`.
