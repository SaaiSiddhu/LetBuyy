# Storefront Execution Governance

Status: Phase 2 foundation.

The storefront runtime remains the shopper-facing rendering runtime. Phase 2 establishes boundaries for moving execution logic out of app-local helpers without rebuilding the UI.

## Boundaries

- Rendering runtime: `apps/storefront-runtime`.
- Storefront query contracts: `packages/runtime-composition/storefront-query-layer`.
- Theme composition contracts: `packages/theme-engine/src/execution-runtime.ts`.
- Checkout workflow contracts: `packages/application-services/checkout-application`.
- Tenant resolution workflow contracts: `packages/application-services/tenant-application`.
- Provider calls: `packages/infrastructure`.

## Rules

- Storefront pages render and adapt runtime responses; they should not own durable checkout, payment, tenant, or theme workflows.
- Checkout totals must be server-calculated.
- Theme release hydration must use immutable release snapshots.
- Preview mode requires explicit preview token authority.
- Customer auth stays separate from merchant auth.
