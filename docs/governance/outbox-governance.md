# Outbox Governance

The outbox is LetBuyy's durable event handoff boundary between application workflows and async execution.

## Source Authority

- Outbox execution contracts live in `packages/orchestration/src/outbox-runtime.ts`.
- Application services decide when a workflow emits events.
- Services process outbox records as execution containers.
- Infrastructure adapters own concrete persistence, queue, retry, and dead-letter provider integrations.

## Record Rules

- Outbox records require id, event envelope, status, attempt count, max attempts, next attempt timestamp, and timestamps.
- Records that mutate tenant data require tenant id in event metadata.
- Event ids must be stable across retry attempts.
- Provider event ids, queue ids, and delivery ids are adapter metadata and must not replace domain event ids.

## Processing Rules

- Outbox processors claim pending records, invoke a provider-neutral handler, mark success, or schedule retry.
- Processing must preserve correlation id, causation id, trace id, and idempotency key.
- Retry delays are calculated by retry policy. Route handlers must not hardcode retry sequencing.
- Exhausted records are marked failed and routed to a dead-letter boundary before operator replay.

## Delivery Guarantees

- The foundation targets at-least-once delivery with idempotent handlers.
- Exactly-once semantics must not be promised at runtime boundaries.
- Application services and provider adapters must tolerate duplicate event delivery.

## Forbidden Patterns

- Direct queue provider SDK use inside apps or service route modules.
- Outbox tables or queue clients owned by UI runtimes.
- Event publication without an outbox or equivalent durable handoff for mutating workflows.
- Replay without explicit correlation and idempotency metadata.
