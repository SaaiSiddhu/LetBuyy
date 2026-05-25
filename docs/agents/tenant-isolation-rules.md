# Tenant Isolation Rules

## Required Tenant Proof

Every merchant-owned read or write must have one of:

- Direct `site_id` on the record.
- Parent ownership path to a `site_id`.
- Published public storefront state scoped by store handle/domain.
- Internal platform operation with audited RBAC and explicit target tenant.

## Forbidden Tenant Shortcuts

- Trusting client-provided `site_id`, `store_id`, `store`, `subdomain`, product ID, order ID, customer ID, or theme ID without ownership verification.
- Reusing merchant sessions for storefront customer privileges.
- Treating global search, analytics, export, queue, webhook, or media records as tenantless when they contain tenant-owned data.
- Adding public policies that expose draft, deleted, unpublished, private, or internal data.

## Implementation Standard

- Resolve store handles through worker ownership or published public lookup.
- Pass `TenantContext` into services that operate on merchant-owned data.
- Include tenant identity in logs, audit events, outbox events, queue jobs, search documents, analytics projections, and storage keys.
- Keep RLS enabled and policy-covered for tenant tables.

## Review Checklist

- Does every query filter by tenant or parent ownership?
- Does the mutation verify the authenticated actor can access the tenant?
- Does background work carry tenant context?
- Does public storefront access only published/public state?
- Does the test plan include cross-tenant denial?
