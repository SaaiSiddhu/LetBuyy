# Execution Context Governance

Execution context is the stable metadata envelope used across APIs, workers, queues, webhooks, replay, workflows, and runtime composition.

## Required Context

- `requestId`: request boundary identity.
- `correlationId`: distributed trace identity.
- `causationId`: parent workflow, event, or replay identity when applicable.
- `siteId`: tenant scope when tenant data is read or mutated.
- `actorId`: actor scope when an authenticated or system actor initiates work.
- `idempotencyKey`: required for mutation, provider, queue, outbox, replay, and webhook side effects.

## Propagation Rules

- Apps propagate request and correlation metadata through runtime transport and headers.
- Services propagate context through execution adapters, database RPCs, outbox rows, queue jobs, webhook headers, and audit events.
- Application-services declare whether a workflow requires tenant scope, idempotency, emitted events, and coordinated domains.
- Orchestration runtimes add replay and recovery metadata without overwriting original causation.

## Observability

`packages/orchestration/src/observability-runtime.ts` owns trace context contracts, runtime span contracts, audit contracts, and execution metadata helpers. Vendor telemetry integrations must remain behind infrastructure adapters.
