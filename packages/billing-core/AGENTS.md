# Billing Core Package Governance

Purpose: Incubating domain package for subscription plans, usage metering, invoices, entitlements, marketplace billing, and provider-independent billing state.

Boundary: `packages/billing-core`.

Status: Incubating. Extract provider-independent billing rules before adapter code.

Rules:

- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Never trust client-submitted plan or price state.
- Billing mutations must be idempotent.
