# Task 004 - Payment
Status: done
DependsOn: [001]
Covers: merchant-owned PSP and payment adapters
Conforms-to: V1 sections 3, 8, Appendix C row 004

## Goal

Build provider-agnostic merchant-owned payment sessions and replay-safe webhooks without custody.

## Scope

In: Razorpay/Cashfree/UPI/COD payment sessions, mock/sandbox/live-shaped provider modes, merchant-owned encrypted credentials, payment tokens, capture/void/refund recording, existing replay-safe webhook-service. Out: self-custodied payouts.

## Reuse

`services/api-gateway/src/routes/payments.ts`, `packages/payments`, Cashfree/Razorpay adapters, migration `107`.

## Files

Modify payment package/routes/tests, gateway schema facade, runtime manifest, and provider mode contracts.

## Database

Migration `142_executable_payment_sessions.sql` creates `payments`, `payment_credentials`, `payment_tokens`; extends `payment_attempts`/`payment_transactions`; adds missing unique indexes, encrypted credential metadata, tenant-GUC RLS/FORCE, and rollback.

## APIs

`POST /payments/sessions`, `/payments/:id/capture`, `/void`, `/refund`. Provider webhooks remain centralized in `services/webhook-service` with replay-safe tests; no duplicate gateway webhook topology was added.

## Events

`payment.authorized.v1`, `payment.pending.v1`, `payment.captured.v1`, `payment.failed.v1`, `payment.refunded.v1`.

## Acceptance

Replay-safe webhook; generic mock-first session machine; live credential path guarded with `[HUMAN-REQUIRED]`; forged verify rejected by order+payment+signature binding; provider payment id uniqueness preserved.

## Tests

`packages/payments` tests/typecheck; `services/api-gateway` typecheck and gateway unit 171/171; `tests/executable/payment-postgres.test.mjs` real local Postgres migration/RLS/rollback proof.

## Rollback

Disable new providers, keep mock path, rollback DB additions.

## [HUMAN-REQUIRED]

`HR-MERCHANT-PSP-LIVE`, `HR-PA-SPLIT-LIVE`.
