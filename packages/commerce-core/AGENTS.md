# Commerce Core Package Governance

Purpose: Incubating domain package for catalog, products, inventory ownership, orders, returns, fulfillment, customer commerce state, and tenant-safe commerce invariants.

Boundary: `packages/commerce-core`.

Status: Incubating. Extract only business logic with tests and stable public exports.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Public exports must be declared through `src/index.ts` when source is introduced.
- Every merchant-owned data shape must preserve `site_id` semantics.
