# Event Core Package Governance

Purpose: Incubating domain package for platform events, event versions, outbox records, idempotency keys, and subscriber contracts.

Boundary: `packages/event-core`.

Status: Incubating. Extract event contracts before enabling cross-runtime consumers.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Events must be versioned and replay-safe.
- Event payloads must not include secrets.
