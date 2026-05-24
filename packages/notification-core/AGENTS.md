# Notification Core Package Governance

Purpose: Incubating domain package for notification templates, preference contracts, delivery states, channels, and event-to-message mapping.

Boundary: `packages/notification-core`.

Status: Incubating. Extract shared contracts before delivery runtime work.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Respect unsubscribe and notification preference semantics.
- Do not include provider secrets in package code.
