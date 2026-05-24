# Application Services Governance

Status: Phase 2 foundation.

Application services live in `packages/application-services` and own execution workflows without owning transport or provider integrations.

## Responsibilities

- Use-case orchestration.
- Workflow sequencing.
- Cross-domain coordination.
- Execution policy contracts.
- Transaction and idempotency boundary definitions.
- Ports for repositories, providers, event publication, and audit emission.

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

New business sequencing must be added to the owning application service before being called by an app or service runtime. Service handlers should validate, build context, call application services, and format responses.
