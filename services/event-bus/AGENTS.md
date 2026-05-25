# Event Bus Governance

Purpose: Reserved service runtime for platform domain events, outbox dispatch, subscriptions, and cross-runtime event contracts.

Runtime boundary: `services/event-bus`.

Status: Incubating. Events must be versioned, idempotent, observable, and tenant-scoped.
