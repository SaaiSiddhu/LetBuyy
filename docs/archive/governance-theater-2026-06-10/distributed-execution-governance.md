# Distributed Execution Governance

Distributed execution in LetBuyy is package-owned and runtime-executed.

## Authority

- `packages/application-services` owns workflow sequencing, retry policy selection, transaction intent, and cross-domain coordination.
- `packages/orchestration` owns event dispatch, replay, async execution, outbox contracts, retry math, dead-letter contracts, workflow recovery, and execution context propagation.
- Services own execution containers only: APIs, workers, queue consumers, schedulers, webhooks, and execution adapters.
- Apps own rendering, routing, runtime hooks, presentation adapters, and transport only.

## Rules

- Runtime adapters must declare a `runtimeBridge` contract and consume application-service execution pipelines.
- Runtimes may execute a workflow but may not define the workflow.
- Distributed execution must carry request ID, correlation ID, idempotency key, site scope when present, and actor scope when present.
- Provider calls must flow through `packages/infrastructure` adapters or service APIs that use those adapters.
- Any new queue, webhook, replay, or scheduler must document its owner in the runtime manifest before source is added.

## CI Enforcement

`scripts/validators/execution-layer-validator.mjs`, `runtime-manifest-validator.mjs`, `provider-isolation-validator.mjs`, and `dependency-graph-validator.mjs` must hard fail on execution leakage, provider leakage, invalid runtime authority, and dependency backflow.
