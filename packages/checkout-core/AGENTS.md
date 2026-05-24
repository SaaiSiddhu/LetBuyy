# Checkout Core Package Governance

Purpose: Incubating domain package for cart totals, discounts, taxes, shipping, inventory reservation contracts, payment state, and checkout idempotency primitives.

Boundary: `packages/checkout-core`.

Status: Incubating. Extract checkout rules only after server-side total calculation tests exist.

Rules:

- No provider secrets or client-submitted total trust.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Keep provider-specific behavior behind typed adapters.
## Dependency Rules

- Dependencies must follow repository package layering and be validated before runtime adoption.
- Shared packages may depend only on approved package contracts, never on app or service source.

## Forbidden Imports

- No imports from apps/*, services/*, legacy/*, infrastructure/*, generated output, or runtime-local environment files.

## Runtime Authority

- This package does not deploy independently and must not own runtime routes, worker bindings, app environment files, or generated artifacts.
- Runtime manifests define which apps or services may consume this package.

## Migration Notes

- Keep this package as an ownership boundary until extracted logic has stable public exports and tests.
- Promote reusable business logic here only with dependency graph validation and updated repository intelligence.
