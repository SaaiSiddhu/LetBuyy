# Workflow Governance

Application-services are the authoritative home for LetBuyy workflow orchestration.

## Source Authority

- Workflow descriptors live in `packages/application-services/src/workflow-descriptor.ts`.
- Domain-specific workflow ownership lives under `packages/application-services/*-application`.
- Services are execution containers that invoke workflows through ports and adapters.
- Apps are runtime composition surfaces that call service APIs or query layers.

## Ownership Rules

- Auth workflows belong to `auth-application`.
- Billing and subscription workflows belong to `billing-application`.
- Checkout, order, payment, shipping, coupon, and refund workflows belong to `checkout-application`.
- Catalog, inventory, collection, and pricing workflows belong to `commerce-application`.
- Tenant resolution, binding, ownership, and runtime config workflows belong to `tenant-application`.
- CMS page, policy, navigation, and content route workflows belong to `cms-application`.
- Theme loading, release publishing, schema hydration, and storefront composition workflows belong to `theme-application`.
- Notification routing and event-to-notification workflows belong to `notification-application`.
- Search query and indexing workflows belong to `search-application`.

## Runtime Rules

- Workflow descriptors must declare owner, version, tenant scope, idempotency requirement, event emission, and coordinated domains.
- Workflows must accept explicit tenant, actor, correlation, and idempotency context where required.
- Cross-domain sequencing belongs in application-services, not API routes, page components, queue consumers, or provider adapters.
- Transaction boundaries are declared by application services and executed by service runtimes through adapter ports.

## Forbidden Patterns

- `services/*/src/services/*.service.ts` as business orchestration authority.
- Route handlers that coordinate multiple domains without invoking an application-service contract.
- Apps that own checkout, payment, auth, tenant, catalog, or CMS workflow sequencing.
- Provider adapters that decide business state transitions.
