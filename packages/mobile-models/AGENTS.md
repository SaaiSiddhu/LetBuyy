# Mobile Models Package Governance

Purpose: Incubating Dart package boundary for mobile commerce, seller, order, cart, analytics, return, and notification models.

Boundary: `packages/mobile-models`.

Status: Incubating. Existing Dart models remain at `packages/dart/models` until migration.

Rules:

- Models must preserve tenant and actor boundaries.
- Keep serialization explicit and backward compatible.
