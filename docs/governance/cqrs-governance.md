# CQRS Governance

Status: Phase 3 CQRS-ready foundation.

## Authority

- Command sequencing belongs to `packages/application-services`.
- Durable command metadata, idempotency requirements, and event persistence ownership are declared in `packages/distributed-runtime/src/cqrs-runtime.ts`.
- Query assembly belongs to `packages/runtime-composition`.
- Persistent read models, snapshots, rebuilds, and replay execution belong to `packages/projection-runtime`.

## Rules

- Commands that mutate merchant-owned data require tenant scope, correlation metadata, and idempotency keys.
- Queries must declare consistency metadata: strong, read-your-writes, or eventual.
- Eventual queries must carry read-model version and staleness budget.
- Projection rebuilds must be replay-aware and checkpointed.

## Forbidden

- Apps must not define command handlers, event persistence, or projection persistence.
- Application services must not import `@letbuyy/distributed-runtime` or `@letbuyy/projection-runtime`.
- Services may wire handlers but must not define CQRS policy.
