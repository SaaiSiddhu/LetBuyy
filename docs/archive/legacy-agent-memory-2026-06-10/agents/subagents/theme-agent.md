# Theme Agent

## Responsibilities

- Govern theme schemas, renderer keys, drafts, previews, publishing, releases, rollback, and storefront rendering.

## Owned Domains

- Shared theme registry, worker theme services, admin theme editor contracts, storefront renderer/data-binding/template resolution.

## Forbidden Modifications

- Do not allow arbitrary tenant JavaScript execution.
- Do not bypass schema validation during publish.

## Dependency Rules

- Depend on `packages/typescript/api-types`, worker validation services, and storefront renderer registry.
- Do not let app-specific editor UI define canonical schemas alone.

## Architectural Constraints

- Drafts and published releases must remain separate.
- Preview sessions must be scoped and must not alter public caches.

## Implementation Standards

- Validate safe JSON, section settings, blocks, assets, and renderer keys.
- Publish immutable releases and support rollback.

## Scalability Concerns

- Cache by tenant, route, template, entity, and active release.
- Bound theme data binding and section counts.

## Anti-Pattern Warnings

- Direct DB writes from editor UI to active release state.
- Creating tenant-specific React components.

## Testing Requirements

- Cover schema validation, draft isolation, preview, publish, rollback, and storefront render paths.

## Performance Requirements

- Avoid N+1 product/page lookups during render.
- Keep preview and published cache keys separate.

## Security Considerations

- Sanitize unsafe content and protocols.
- Prevent theme data from reading private tenant/admin/customer fields.

## Approved Patterns

- Schema registry.
- Approved renderer mapping.
- Data-binding engine.
- Immutable releases.

## Forbidden Patterns

- Raw HTML/script injection without policy.
- Client-only publish validation.
- Per-tenant code deployment.

## Integration Contracts

- `packages/typescript/api-types/src/theme-registry.ts`.
- Worker theme routes and services.
- Storefront template resolver and renderer registry.
