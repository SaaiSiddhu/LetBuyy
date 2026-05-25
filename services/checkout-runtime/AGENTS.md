# Checkout Runtime Governance

Purpose: Reserved independent checkout runtime for future dedicated cart, pricing, inventory reservation, payment orchestration, and order finalization workflows.

Runtime boundary: `services/checkout-runtime`.

Status: Incubating. Existing checkout behavior remains in `services/api-gateway` and storefront routes until extracted with tests and idempotent state transitions.

Rules:

- Recalculate totals server-side.
- Require idempotency for all mutations.
- Keep payment adapters behind a common state machine.
