# Identity Core Package

Purpose: Principal, realm, account-link, and subject-claim contracts for the dormant Identity Platform foundation.

Canonical source boundary: `packages/identity-core`.

## Ownership Rules

- Interfaces and pure type contracts only.
- Reuse `@letbuyy/auth-core` actor/session primitives.
- Do not import apps, services, provider SDKs, runtime env, or database clients.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Public exports must remain additive and backward-compatible.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own routes, cookies, session validation, worker bindings, or environment files.
- Runtime manifests define where these contracts may be consumed.

## Migration Notes

- This package is additive foundation work. Legacy auth remains authoritative until a future approved cutover wave.
- New principal or realm contracts must stay dormant behind default-off feature flags until live migration evidence exists.
