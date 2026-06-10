# Resilience Operations Governance

Status: Phase 3 operations-final resilience operations foundation.

## Authority

- Circuit breaker execution, adaptive retry, fallback execution, degraded mode, and resilience telemetry live in `packages/distributed-runtime/src/resilience-runtime.ts`.
- Provider health, timeout governance, retry governance, fallback policies, and provider recovery planning live in `packages/infrastructure/provider-resilience-adapter`.

## Rules

- Provider calls must execute behind timeout, retry, circuit breaker, and fallback policies.
- Provider failover must record outage metadata and recovery plans.
- Degraded mode must be explicit and auditable.
- Rate-limit recovery must honor retry-after metadata or configured defaults.

## Enforcement

- Runtime manifests must declare `resilienceOwnership` and `resilienceExecutionOwnership`.
- `provider_health_snapshots`, `provider_outage_events`, and `provider_recovery_plans` are the interim persistence surfaces.
- Validators hard fail provider resilience operations outside `packages/infrastructure` and runtime resilience contracts outside `packages/distributed-runtime`.
