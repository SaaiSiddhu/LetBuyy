# Event Bus Reserved Root

Runtime boundary: `services/event-bus`.

Status: reserved-not-implemented, manifest-only.

The active event pattern is the transactional outbox inside the canonical monolith and queue worker. This directory is a reserved seam only.

Rules:

- MUST remain manifest-only.
- MUST NOT add source, tests, package.json, wrangler.toml, or deployment config.
- MUST NOT introduce an event bus, event store, CQRS, saga, projection, or replay runtime.
- Any change from reserved status requires a human ARB amendment and the canonical topology update before source exists.
