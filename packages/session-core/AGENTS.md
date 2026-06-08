# Session Core Package

Purpose: Session, refresh-token, revocation, cookie-policy, and device-trust contracts for the dormant Identity Platform foundation.

Canonical source boundary: `packages/session-core`.

## Ownership Rules

- Interfaces and DTOs only until a feature-flagged runtime implementation consumes them.
- Existing `sessions` behavior remains authoritative.
- No imports from apps, services, provider SDKs, infrastructure, or runtime env.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Session contracts must not duplicate runtime cookie setters or existing live session readers.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own live cookies, session middleware, Redis bindings, or environment files.
- Existing `lb_session`, `lb_customer_session`, and `lb_console_session` flows remain runtime-owned until future cutover approval.

## Migration Notes

- This package is additive and dormant. New session engines must default off and preserve legacy session behavior with flags disabled.
- Refresh-token rotation and revocation implementations must be tested in isolation before any live read path consumes them.
