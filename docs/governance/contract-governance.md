# Contract Governance

Contracts are machine-readable or type-readable boundaries between runtimes and domains. They include TypeScript interfaces, Zod schemas, event envelopes, runtime manifests, and package public exports.

## Canonical Contract Locations

- Common primitives: `packages/shared-types`
- Commerce contracts: `packages/commerce-core`
- Checkout contracts: `packages/checkout-core`
- Auth contracts: `packages/auth-core`
- Tenant contracts: `packages/tenant-core`
- CMS contracts: `packages/cms-core`
- Theme contracts: `packages/theme-engine`
- Event contracts: `packages/event-core`
- Notification contracts: `packages/notification-core`
- Search contracts: `packages/search-core`
- Billing contracts: `packages/billing-core`

## Rules

- Package public exports are the only reusable source authority.
- Runtime-local facades may re-export package contracts to preserve import compatibility.
- Contracts must be runtime-safe: no provider SDKs, secrets, database clients, app routes, or generated artifact dependencies.
- Contract changes that affect API payloads require governance docs and repository intelligence refresh.

## Enforcement

The domain boundary validator checks package manifests, public export boundaries, critical exported contracts, and facade purity.
