# Application Services Package Governance

Purpose: Application workflow and use-case orchestration contracts for auth, commerce, checkout, tenant, CMS, theme, billing, notification, and search execution.

## Ownership Rules

- Own workflow sequencing, use-case contracts, execution policy inputs, transaction boundaries, and cross-domain coordination contracts.
- Keep transport, UI, rendering, deployment, SDK clients, and provider-specific code out of this package.
- Application services define ports for repositories, providers, and event publication; runtimes wire concrete adapters.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, or runtime-local env modules.
- No direct provider SDK imports. Provider SDKs belong under `packages/infrastructure`.

## Runtime Authority

- This package does not deploy independently.
- Apps and services may consume these contracts, but execution runtimes retain transport and bootstrapping authority.

## Migration Notes

- Move orchestration out of apps and service route handlers into the relevant application service before extending workflows.
- Keep commands tenant-scoped and correlation-aware.
