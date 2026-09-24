# Runtime Governance

## Runtime Classes

LetBuyy has three runtime classes:

- App runtimes: user-facing Next or Flutter applications under `apps/`.
- Service runtimes: independently deployable Workers and asynchronous processors under `services/`.
- Infrastructure runtimes: provider-managed systems configured under `infrastructure/` and `database/`.

## Runtime Rules

- Apps adapt UI workflows and may call service APIs; they must not own canonical business logic.
- Services own API protocols, domain orchestration, auth enforcement, tenant context, idempotency, events, and provider integrations.
- Database migrations own schema, RLS, indexes, functions, triggers, and seed/verification logic.
- Each runtime must have an `AGENTS.md` describing ownership, actor, dependencies, deployment path, and forbidden imports.
- Each canonical app and service runtime must have `runtime.manifest.json` describing actor type, category, classification, ownership, allowed dependencies, deployment authority, environment authority, and observability authority.
- Runtime names must describe operational responsibility, not implementation detail.
- Only canonical app roots may exist under `apps/`; alias roots and placeholder app roots are governance failures.
- Storefront source authority belongs under `apps/commerce/web/src`; nested storefront runtimes are forbidden.

## Control Plane And Data Plane

- Control plane: identity, merchant dashboard, platform console, operations portal, marketplaces, admin APIs, billing configuration, platform policy.
- Data plane: storefront rendering, checkout execution, payment and webhook reconciliation, inventory mutation, event delivery, media, search, analytics projections.
- Control-plane runtimes may initiate data-plane operations only through versioned service contracts.
- Data-plane services must not depend on UI apps or operator-only code.

## Runtime Validation

Architecture validation must fail when:

- An app imports another app.
- A shared package imports an app or service runtime.
- An active runtime imports `docs/archive/firebase-legacy`.
- A runtime references deprecated pre-normalization roots outside archived historical documentation.
- A deprecated app alias, duplicate operator runtime, nested storefront runtime, debug log, or raw trace file exists in active topology.
- A service runtime lacks package metadata, deployment metadata, or ownership documentation.
- A canonical runtime lacks `runtime.manifest.json`.
- A runtime manifest references missing governance docs or the wrong environment schema.
- Ignored runtime-local artifacts such as `node_modules`, `.next`, `.dart_tool`, `build`, `dist`, or `.wrangler` remain under app/service/package roots during governance validation.
