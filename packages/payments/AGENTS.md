# Payments AGENTS.md

Purpose: Provider-neutral payment orchestration contracts, India-first money handling, idempotency keys, verification/capture/refund/webhook interfaces, and payment provider adapter contracts.

Canonical source boundary: `packages/payments`.

## Ownership Rules

- Own payment provider interface contracts and payment-domain utility rules that are shared by services and runtime-composition.
- Keep all monetary mutation inputs in INR minor units unless an explicit conversion helper is used.
- Make idempotency keys mandatory for side-effecting payment operations.
- Keep provider SDK clients, secrets, HTTP calls, database clients, and worker bindings outside this package.
- Public exports must be intentional and documented through `src/index.ts`.

## Dependency Rules

- May depend on `@letbuyy/shared-types` for canonical provider names, payment status names, and currency primitives.
- Must not depend on provider SDKs, runtime packages, app code, service code, or infrastructure code.
- Provider implementations may consume this package, but this package must not import those implementations.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, repository-level `infrastructure/*`, generated output directories, or provider SDK packages.
- No Supabase, Razorpay, Stripe, PayPal, Cashfree, PhonePe, Redis, queue, webhook runtime, or environment imports.

## Runtime Authority

This package does not deploy independently and must not own routes, webhooks, secrets, worker bindings, database mutation code, or provider SDK bootstrapping.

## Migration Notes

- Phase 2 moves every charge path behind this provider contract through `services/api-gateway`.
- Existing Razorpay, Stripe, and PayPal execution code should be ported into adapters that implement `PaymentProvider`.
- Cashfree, PhonePe, UPI, and COD adapters must compile against this interface before they are enabled with live credentials.
