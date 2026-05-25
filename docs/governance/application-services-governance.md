# Application Services Governance

Status: Phase 2.5 execution authority.

Application services live in `packages/application-services` and own execution workflows without owning transport or provider integrations.

## Responsibilities

- Use-case orchestration.
- Workflow sequencing.
- Cross-domain coordination.
- Execution policy contracts.
- Transaction and idempotency boundary definitions.
- Ports for repositories, providers, event publication, and audit emission.
- Workflow descriptors with owner, version, tenant scope, idempotency, event emission, and coordinated domains.

## Non-Responsibilities

- HTTP routes, Hono handlers, Next route handlers, UI, rendering, worker bindings, SDK clients, queue SDKs, and deployment configuration.

## Required Domains

The foundation includes:

- `auth-application`
- `commerce-application`
- `checkout-application`
- `tenant-application`
- `cms-application`
- `theme-application`
- `billing-application`
- `notification-application`
- `search-application`

## Rule

New business sequencing must be added to the owning application service before being called by an app or service runtime. Service handlers validate, build context, call application services through execution adapters, and format responses.

## Enforcement

- `scripts/validators/execution-layer-validator.mjs` fails if service-owned `src/services/*.service.ts` orchestration returns.
- Execution adapters must declare their application-service workflow authority or observability contract.
- Workflow descriptors are required for each application-service domain before new cross-domain execution is added.
