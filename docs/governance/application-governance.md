# Application Governance

Applications are runtime composition layers. They own routes, rendering, runtime adapters, runtime-specific UI, and transport orchestration. They do not own canonical domain contracts or reusable business rules.

## Allowed App Ownership

- Next routing, layouts, loading/error boundaries, middleware, and runtime-specific route handlers.
- UI state, view composition, skeleton/empty/error states, and runtime adapters.
- API client calls to services or shared package contracts.
- Storefront section rendering and customer interaction surfaces until the theme engine extraction is complete.

## Forbidden App Ownership

- Canonical DTOs, Zod schemas, shared business validations, pricing rules, auth/RBAC rules, tenant isolation rules, or payment state machines.
- Importing another app.
- Importing service runtime source.
- Recreating domain package contracts in `src/types` as a second authority.

## Current Purification

- `apps/commerce/web/src/types/store.ts` is a compatibility facade over `@letbuyy/tenant-core`, `@letbuyy/commerce-core`, `@letbuyy/checkout-core`, `@letbuyy/auth-core`, `@letbuyy/cms-core`, and `@letbuyy/theme-engine`.
- Future app-local contract additions must first check whether the contract belongs in a domain package.

## Enforcement

Application purification is enforced by import, dependency graph, and domain boundary validators through `node scripts/validate-governance.mjs`.
