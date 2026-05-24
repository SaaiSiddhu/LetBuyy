# Orchestration Governance

Status: Phase 2 foundation.

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

## Rules

- Every async workflow must carry `requestId`, `correlationId`, and idempotency key.
- Replayable events must declare replay safety and owner package.
- Dead-letter policies must include target, retention, and alert threshold.
- Sagas crossing provider boundaries must define compensation requirements.
- Service queues execute orchestration; application services own workflow sequencing.
