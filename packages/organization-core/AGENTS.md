# Organization Core Package

Purpose: Organization, team, membership, delegation, invitation, and ownership-transfer contracts above `packages/tenant-core`.

Canonical source boundary: `packages/organization-core`.

## Ownership Rules

- Reuse `tenant-core` for site/store resolution and never introduce a `stores` table.
- Interfaces and DTOs only until org model flags are enabled in a later wave.
- Do not import apps, services, infrastructure, provider SDKs, runtime env, or database clients.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Organization contracts must build above `public.sites` and existing site membership authority.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own live org routes, tenant middleware, database writes, or environment files.
- Runtime manifests define where org contracts may be consumed; live tenant isolation remains enforced by existing runtimes.

## Migration Notes

- The org graph is additive foundation work above existing `site_memberships`, `site_roles`, and `site_role_permissions`.
- New `store_*` contract names are UI aliases only; database FKs must continue to reference `public.sites`.
