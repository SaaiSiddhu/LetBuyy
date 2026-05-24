# Migration Rules

## Core Rules

- Migrations live under `backend/supabase/migrations`.
- Use sequential, unique migration prefixes.
- Avoid duplicate/non-standard prefixes like the current historical `022` conflict.
- New entity tables require `id`, `created_at`, `updated_at`, `deleted_at`, audit columns where meaningful, indexes, and RLS policies.
- Use `update_updated_at()` only. Do not introduce `update_updated_at_column()` or `update_modified_at()`.
- Do not create a `stores` table.

## Tenant And RLS Rules

- Merchant-owned tables require `site_id` or a documented ownership path through parent tables.
- Enable RLS on new tables unless the table is explicitly global reference/catalog state.
- Add policies for authenticated ownership, service operations, and public published reads where applicable.
- Public policies must not expose draft, deleted, internal, private, or cross-tenant state.

## Reversibility And Safety

- Prefer additive migrations for live systems.
- Backfills must be bounded, resumable, and safe to rerun.
- Destructive changes require documented rollback and data-retention strategy.
- Payment, order, inventory, customer, and audit tables require extra review before deletion or type narrowing.

## Verification

- Check table names, indexes, functions, triggers, RLS enablement, and policy coverage.
- Verify generated types if the repository uses Supabase type generation.
- Run the affected migration/test path before marking database work complete.
