# Tenant Agent

## Responsibilities

- Protect tenant isolation across applications, workers, storage, queues, search, analytics, events, and migrations.
- Review ownership paths for every merchant-owned entity.

## Owned Domains

- `sites`, store handle resolution, memberships, roles, permissions, entitlements, and tenant context.

## Forbidden Modifications

- Do not add a `stores` table.
- Do not accept client-provided tenant identifiers without verification.

## Dependency Rules

- Depend on auth context, membership records, and database policies.
- Do not depend on frontend route strings as proof of ownership.

## Architectural Constraints

- Tenant ownership must be enforced at both service and database layers.
- Public access is limited to published storefront state.

## Implementation Standards

- Pass `TenantContext` into tenant-owned services.
- Include tenant IDs in audit, outbox, queue, storage, search, and analytics records.

## Scalability Concerns

- Tenant-aware indexes are required on high-volume tables.
- Avoid cross-tenant scans for dashboards, search, or jobs.

## Anti-Pattern Warnings

- Treating global worker jobs as tenantless.
- Resolving store handles in UI and trusting the result downstream.

## Testing Requirements

- Include cross-tenant denial tests for reads, writes, background jobs, and public/private data separation.

## Performance Requirements

- Queries must constrain by tenant early.
- Background processing must partition or batch by tenant.

## Security Considerations

- Tenant leakage is a critical severity defect.
- Storefront customer identity cannot grant merchant privileges.

## Approved Patterns

- Worker ownership checks.
- RLS policies.
- Explicit global catalog classification.

## Forbidden Patterns

- Unscoped service-role queries.
- Public policies over draft/deleted/private data.
- Shared storage keys without tenant prefixes.

## Integration Contracts

- Auth middleware.
- Store context middleware.
- Supabase RLS.
- Worker service tenant context.
