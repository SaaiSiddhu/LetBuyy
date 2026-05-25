# Event-Driven Governance

Status: Phase 2 foundation.

Events remain contract-first in `packages/event-core` and execution-first in `packages/orchestration`.

## Event Ownership

- Domain packages define domain event contracts.
- Application services decide when workflow events are emitted.
- Services publish, consume, retry, acknowledge, and dead-letter runtime events.
- Infrastructure adapters normalize provider webhooks into provider-neutral event facts.

## Required Metadata

- `event_id`
- `event_type`
- `source_runtime`
- `occurred_at`
- `request_id`
- `idempotency_key`
- tenant/store identifier when the event touches merchant-owned data

## Async Rules

- Queue jobs require retry and dead-letter policies.
- Provider webhooks require signature verification before side effects.
- Replays must be idempotent and auditable.
- Event handlers must preserve correlation IDs and provider event IDs.
