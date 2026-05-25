# Event Replay Governance

Event replay is an orchestration runtime concern. Replay never belongs in apps, page routes, or ad hoc service helpers.

## Replay Lifecycle

1. Plan replay with event types, tenant scope, cursor, batch size, reason, requester, and replay ID.
2. Mark replay running before loading events.
3. Dispatch events through replay-aware event dispatcher contracts.
4. Persist every event outcome.
5. Complete replay with processed, skipped, failed, and next cursor counts.

## Rules

- Replay must be idempotent and must use the event ID or producer idempotency key.
- Replay must preserve original event metadata while adding replay causation metadata.
- Replay must be tenant-scoped when event ownership is tenant-scoped.
- Retry exhaustion must move to workflow recovery or dead-letter ownership, never silent failure.
- Replay jobs must be resumable by cursor and must not depend on generated artifacts.

## Source Authority

- Contracts and runtime helpers: `packages/orchestration/src/replay-runtime.ts`.
- Outbox publish guarantees: `packages/orchestration/src/outbox-runtime.ts`.
- Runtime execution containers: service queue/webhook/scheduler adapters only.
