# Testing Rules

## Current Reality

The repository is under-tested. Static scan found only 3 test files and they are Flutter default-style widget tests. Treat critical business behavior as unproven until covered.

## Required Test Areas

- Tenant isolation positive and negative cases.
- Merchant auth/session lifecycle.
- Storefront customer auth separation.
- Order creation, pricing, discounts, tax, shipping, inventory reservations, and fulfillment state transitions.
- Payment provider verification, idempotency, webhooks, refunds, and subscription state.
- Theme schema validation, draft, preview, publish, release, and rollback.
- App marketplace install/review/developer ownership checks.
- Admin app-boundary proxy behavior.
- Migration RLS and policy coverage.

## Test Strategy

- Unit test pure services and schema validators.
- Integration test worker routes with realistic tenant/auth context.
- Use database tests or migration validation for RLS and ownership paths.
- Use browser tests for critical storefront checkout and admin workflows.
- Use emulator or widget tests for Flutter client flows.

## Verification Policy

Code changes should run affected typecheck, lint, tests, and user-flow verification. Docs-only changes require file presence and consistency verification.
