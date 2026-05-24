# Tenant Core Package Governance

Purpose: Incubating domain package for `site_id`, store URL identity, custom domains, tenant context, and ownership checks.

Boundary: `packages/tenant-core`.

Status: Incubating. Tenant extraction must preserve RLS and service ownership checks.

Rules:

- Database identity remains `sites`; UI and URLs may use `store`.
- No imports from `apps/*`, `services/*`, or `legacy/*`.
- Domain mapping must include takeover prevention and verification state.
