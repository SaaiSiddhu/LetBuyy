# Storefront Execution Governance

Status: Phase 2 foundation.

The storefront runtime remains the shopper-facing rendering runtime. Phase 2 establishes boundaries for keeping durable execution logic in the API gateway and domain packages without rebuilding the UI.

## Boundaries

- Rendering runtime: `apps/commerce/web`.
- Storefront query contracts: versioned `/v1/storefront/*` API gateway responses and `@letbuyy/shared-types` DTOs.
- Theme composition contracts: `packages/theme-engine/src/execution-runtime.ts`.
- Checkout workflow contracts: `packages/checkout-core` plus API gateway checkout execution adapters.
- Tenant resolution workflow contracts: `packages/tenant-core` plus storefront tenant adapters.
- Provider calls: `packages/infrastructure`.

## Rules

- Storefront pages render and adapt runtime responses; they should not own durable checkout, payment, tenant, or theme workflows.
- Checkout totals must be server-calculated.
- Theme release hydration must use immutable release snapshots.
- Preview mode requires explicit preview token authority.
- Customer auth stays separate from merchant auth.
