# Migration Replayability Governance

Status: active for merchant-mobile V2 and later forward migrations.

Applied migration history is immutable. Legacy migrations that predate this rule are documented here instead of edited in place:

- `database/supabase/migrations/076_app_extension_registry.sql`
- `database/supabase/migrations/093_app_pricing_plans.sql`
- `database/supabase/migrations/095_app_usage_metering.sql`
- `database/supabase/migrations/096_app_spend_controls.sql`
- `database/supabase/migrations/097_app_uninstall_feedback.sql`
- `database/supabase/migrations/098_app_versions.sql`

Forward migrations owned by the merchant-mobile V2 mission must be replayable:

- Use `CREATE TABLE IF NOT EXISTS`.
- Use `CREATE INDEX IF NOT EXISTS` and `CREATE UNIQUE INDEX IF NOT EXISTS`.
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Drop policies with `DROP POLICY IF EXISTS` before recreating them.
- Drop triggers with `DROP TRIGGER IF EXISTS` before recreating them.
- Keep destructive changes out of migrations; use forward fixes and operator runbooks.

Verification:

- `node --test tests/migrations/v2-migration-replayability.test.mjs`
- `node scripts/validators/migration-safety-validator.mjs`

Production apply remains human-owned. Operators must run staging dry-run, backup/PITR checkpoint, and the migration orchestration gate before any live database apply.
