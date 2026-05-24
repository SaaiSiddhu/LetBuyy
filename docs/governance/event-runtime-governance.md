# Event Runtime Governance

LetBuyy event execution is provider-neutral runtime architecture, not a queue vendor implementation.

## Source Authority

- Event execution primitives live in `packages/orchestration/src/event-runtime.ts`.
- Domain event contracts live in `packages/event-core` and `packages/orchestration`.
- Service runtimes may dispatch, subscribe, acknowledge, and dead-letter events for their deployment boundary.
- Apps may propagate correlation metadata and render event-derived state, but they do not own durable event processing.

## Runtime Rules

- Every dispatched event requires an event id, event type, version, occurred timestamp, correlation id, and source runtime.
- Event handlers must be registered through `EventRouter`-style provider-neutral subscription contracts.
- Durable event persistence is a port. Concrete queues, outbox storage, or provider SDKs must be wired by service runtimes through infrastructure adapters.
- Event handlers must be idempotent. Mutation handlers require an idempotency key or an event id that can be used as the idempotency key.
- Correlation metadata must be copied into child events and workflow follow-up commands.

## Replay Rules

- Replayable events must carry a stable event id, version, source runtime, and tenant id when tenant-scoped.
- Replay handlers must not call non-idempotent providers unless protected by an idempotency runtime port.
- Replay mode must be explicit in runtime metadata and must not be inferred from queue name or transport.

## Failure Rules

- Retry policy is defined by orchestration contracts, not hardcoded in apps or route handlers.
- Exhausted events move through the dead-letter runtime port with failure reason, attempt count, and correlation metadata.
- Dead-letter replay requires operator intent, documented scope, and idempotency protection.

## Forbidden Patterns

- Provider SDK imports in event contracts.
- App-owned queue consumers or event processors.
- Service route handlers that define durable business workflows instead of invoking application-services.
- Events without correlation ids or tenant scope when the event mutates merchant-owned state.
