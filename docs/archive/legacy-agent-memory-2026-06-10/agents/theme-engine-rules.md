# Theme Engine Rules

## Canonical Contracts

- Shared schemas live in `packages/typescript/api-types/src/theme-registry.ts`.
- Worker runtime schema resolution and validation live in theme services.
- Storefront rendering uses approved renderer keys, template resolver, data-binding engine, and renderer registry.
- Admin/editor may create drafts but cannot bypass schema validation.

## Approved Theme Flow

1. Define or update schema in shared contract.
2. Validate settings, sections, blocks, safe JSON, and asset references in worker services.
3. Store drafts separately from active releases.
4. Use scoped preview sessions for unpublished work.
5. Publish immutable releases.
6. Render active release through approved React renderers.

## Forbidden Patterns

- Arbitrary tenant JavaScript execution.
- Raw HTML injection without sanitization and a documented rendering policy.
- Client-only validation for publish workflows.
- Theme changes that require storefront code deployment per tenant.
- Direct database writes from admin UI to theme release tables.

## Performance Rules

- Cache by tenant, route, template, product/page entity, and theme release where possible.
- Do not let preview mode poison published storefront caches.
- Keep renderer components predictable and bounded in data needs.

## Testing Requirements

- Schema validation tests.
- Draft/publish/rollback tests.
- Preview isolation tests.
- Storefront render tests for template resolution and data binding.
