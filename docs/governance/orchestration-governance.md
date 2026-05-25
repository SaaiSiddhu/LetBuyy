# Orchestration Governance

Status: Phase 2.5 event execution foundation.

Orchestration primitives live in `packages/orchestration`.

## Owned Concepts

- Correlation context.
- Correlated commands.
- Event bus publish contracts.
- Workflow definitions.
- Command pipeline middleware.
- Async execution policy.
- Saga definitions.
- Retry and dead-letter policies.
- Event contract metadata.
- Event router and subscription contracts.
- Event dispatcher execution contracts.
- Outbox processing contracts.
- Execution trace and audit contracts.

## Rules

- Every async workflow must carry `requestId`, `correlationId`, and idempotency key.
- Replayable events must declare replay safety and owner package.
- Dead-letter policies must include target, retention, and alert threshold.
- Sagas crossing provider boundaries must define compensation requirements.
- Service queues execute provider-neutral orchestration contracts; application services own workflow sequencing.
- Runtime event execution must use provider-neutral ports before concrete queue, persistence, dead-letter, or telemetry adapters are wired.
