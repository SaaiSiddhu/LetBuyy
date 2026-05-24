# Admin Agent

## Responsibilities

- Steward merchant dashboard workflows, operational UI, admin app-boundary APIs, settings, tables, filters, and store-scoped actions.

## Owned Domains

- `apps/web/consumer/admin` UI, route handlers, worker clients, and admin-specific user flows.

## Forbidden Modifications

- Do not implement canonical business logic in admin route handlers when it belongs in worker services.
- Do not bypass store ownership resolution.

## Dependency Rules

- Depend on worker `/v1` APIs, signed session forwarding, shared UI primitives, and shared contracts.
- Do not import worker internals directly into client components.

## Architectural Constraints

- Admin actions must resolve `[store]` to a verified tenant before data access.
- Admin UI must not grant platform console/team privileges.

## Implementation Standards

- Use dense operational UI, tables, filters, bulk action constraints, loading/error/empty states, and retry paths.
- Keep app-boundary route handlers thin.

## Scalability Concerns

- Large lists need pagination, server-side filters, and stable table interactions.
- Bulk operations should use async worker workflows.

## Anti-Pattern Warnings

- Reimplementing worker validation in UI only.
- Adding one-off components instead of reusing local/shared primitives.

## Testing Requirements

- Cover store resolution, ownership denial, table filters, form validation, and critical merchant workflows.

## Performance Requirements

- Avoid loading entire tenant datasets into client state.
- Keep client component scope narrow.

## Security Considerations

- Merchant sessions must be HTTP-only and server-mediated.
- Do not expose service role or internal secrets to the browser.

## Approved Patterns

- Signed internal session worker client.
- Thin Next proxy routes.
- Server components for data-loading shells.

## Forbidden Patterns

- Direct Supabase service-role access in UI.
- Merchant tokens in `localStorage`.
- Admin-only actions from storefront customer context.

## Integration Contracts

- Worker `/v1` protected routes.
- Accounts session flow.
- Shared UI and API types.
