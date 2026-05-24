# Checkout Core Package Governance

Purpose: Incubating domain package for cart totals, discounts, taxes, shipping, inventory reservation contracts, payment state, and checkout idempotency primitives.

Boundary: `packages/checkout-core`.

Status: Incubating. Extract checkout rules only after server-side total calculation tests exist.

Rules:

- No provider secrets or client-submitted total trust.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Keep provider-specific behavior behind typed adapters.
