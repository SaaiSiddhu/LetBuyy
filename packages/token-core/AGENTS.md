# Token Core Package

Purpose: Token type definitions and signing/verifying interfaces for the dormant Identity Platform foundation.

Canonical source boundary: `packages/token-core`.

## Ownership Rules

- Define provider-neutral token contracts only.
- Use key-service interfaces from `@letbuyy/auth-core`; do not own live keys or secrets.
- Do not import apps, services, infrastructure, provider SDKs, or runtime env.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Token contracts must avoid provider-specific SDK types and live secret material.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own JWKS routes, live signing keys, worker bindings, cookies, or environment files.
- Runtime implementations may consume these interfaces only behind default-off identity feature flags.

## Migration Notes

- Sandbox signing is allowed only for dormant/local runtime implementations gated off by default-off identity feature flags; it must never be described as live identity issuance.
- Live KMS/HSM key provisioning remains human-approved work and must not be inferred from these interfaces.
