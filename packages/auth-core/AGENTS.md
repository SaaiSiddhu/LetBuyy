# Auth Core Package Governance

Purpose: Incubating domain package for identity contracts, session claims, actor roles, tenant membership, customer auth separation, and permission primitives.

Boundary: `packages/auth-core`.

Status: Incubating. Authentication UI remains in `apps/identity-platform`; server enforcement remains in service runtimes until extracted.

Rules:

- Never expose tokens to client storage.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Keep shopper, merchant, partner, and operator claims explicitly separated.
