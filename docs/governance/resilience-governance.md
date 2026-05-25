# Resilience Governance

Status: Phase 3 resilience engineering foundation.

## Authority

- Provider-neutral resilience contracts live in `packages/distributed-runtime/src/resilience-runtime.ts`.
- Provider adapter resilience metadata, timeouts, retry governance, fallback policy, health checks, rate-limit behavior, and telemetry hooks live in `packages/infrastructure/provider-resilience-adapter`.
- Services wire resilience policy to runtime calls. Apps never own provider resilience.

## Rules

- Provider calls must have timeout governance, retry classification, fallback mode, and telemetry.
- Circuit breakers must expose state, failure counts, success counts, and last failure reason.
- Degraded mode must be explicit: read-only, cached response, queue-for-later, alternate provider, or maintenance error.
- Provider health snapshots persist operational status without exposing secrets.

## Forbidden

- Direct provider SDK imports outside `packages/infrastructure`.
- Provider URL calls outside infrastructure adapters.
- Silent fallback without audit metadata.
