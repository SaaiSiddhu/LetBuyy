# Engineering Principles

## Source First

Read source before changing architecture. Generated reports and docs help orientation but cannot overrule live code.

## Tenant First

Every data path must answer: which tenant owns this, how is ownership proven, and what prevents cross-tenant access?

## Contract First

New external behavior needs an explicit contract:

- Route path and version.
- Request schema.
- Response envelope.
- Auth and tenant context.
- Error semantics.
- Idempotency behavior.
- Event/audit side effects.

## Service Ownership

Handlers adapt protocols. Services own business workflows. UI owns interaction and rendering, not authority.

## Conservative Abstraction

Add abstraction only when it reduces real duplication, enforces a boundary, or matches an existing pattern. Do not introduce fake microservices or broad rewrites to satisfy imagined future needs.

## Operability

Production-ready work includes logs, request IDs, audit events where appropriate, bounded queries, retries for async side effects, and rollback paths.

## Documentation

Document decisions where future agents will need them: domain ownership, migration assumptions, tenant paths, event contracts, and provider-specific behavior.
