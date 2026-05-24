# DTO Governance

DTOs define transport and persistence-facing shapes. They must not be duplicated independently across apps, services, and packages.

## Rules

- DTOs shared across runtimes live in domain packages.
- App DTOs are allowed only for local view models that are not reused as API/domain authority.
- Service DTOs are allowed only for provider adapter internals or database row mapping.
- Zod schemas for inbound shared payloads live in domain packages and may be re-exported through service facades.
- Route-local schemas are allowed only when they are private to a single provider adapter and not reusable domain input.
- Mobile model DTOs shared across Flutter screens live in `packages/dart/models`; app-local model files must be package facades.
- `@letbuyy/api-types` remains an aggregate compatibility package, not a place for new source DTOs.

## Naming

- Use `Input` for validated inbound payloads inferred from Zod.
- Use `Dto` for transport-shaped output contracts.
- Use `Contract` for stable cross-runtime capability boundaries.
- Use database table names exactly when modeling persistence rows; database uses `sites`, while UI may say store.

## Enforcement

Duplicate critical DTO authority is prevented by `domain-boundary-validator`, import validation, and package dependency graph validation.
