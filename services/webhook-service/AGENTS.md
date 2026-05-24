# Webhook Service Governance

Purpose: Provider callback and reconciliation runtime for payment, commerce, app, marketplace, and operational event providers.

Runtime boundary: `services/webhook-service`.

Allowed dependencies:

- Provider SDKs and verification helpers scoped to webhook handling.
- Shared TypeScript types from `packages/typescript/*`.
- Database access only through server-side environment bindings.

Forbidden dependencies:

- No imports from `apps/*`.
- No imports from `legacy/*`.
- No unauthenticated provider side effects before signature verification.

Safety rules:

- Verify signatures before parsing business side effects.
- Persist provider event ids or idempotency keys before mutation.
- Reconcile state through append-safe ledgers where available.
