# Migration Governance

## Migration Phases

1. Repository topology governance.
2. Apps restructuring.
3. Service extraction.
4. Database extraction.
5. Docs consolidation.
6. Package normalization.
7. Dependency governance.
8. Architecture enforcement.
9. CI/CD governance.
10. Final repository purification.

## Safety Criteria

Before each phase:

- Inspect current source and generated memory.
- Confirm worktree state.
- Identify runtime, package, and deployment files affected.
- Avoid mixing unrelated behavior changes with path migrations.

After each phase:

- Validate manifests and imports.
- Run architecture validation.
- Run targeted typecheck/build where blast radius requires it.
- Commit atomically with a rollback-safe message.

Replayable Supabase migrations must not use `DROP TABLE`, `DROP SCHEMA`, `DROP COLUMN`, `TRUNCATE`, physical table renames, physical column renames, physical `sites`/`stores` rename cycles, or `CREATE TABLE stores`. `stores` is compatibility/API language only; canonical tenant storage remains `sites`.

## Fresh Replay Baseline

As of 2026-06-02, active Supabase replay authority is the verified baseline at
`database/supabase/migrations/000_baseline.sql`.

- Historical migrations `001_initial_schema.sql` through
  `072_marketplace_review_records.sql` are archived under
  `docs/archive/migrations-history/` for auditability only.
- New forward migrations must start at `073_*.sql` and remain additive,
  replay-safe, and compatible with the baseline.
- The baseline was generated from a throwaway clean replay of the historical
  chain and proved equivalent by comparing schema-only `public` dumps from the
  clean-chain database and the baseline-only database.
- Applying `000_baseline.sql` to an already-provisioned staging or production
  database is human-gated and out of scope for automated local agents.

## Move Rules

- Prefer `git mv` for tracked runtime moves.
- Preserve internal relative imports during moves.
- Update workspace manifests, deployment config, generated intelligence scripts, docs, and CI in the same phase as path changes.
- Do not delete legacy code until it is isolated under `legacy/` and no active runtime imports it.

## Validation

Migration safety is enforced by `scripts/validators/migration-safety-validator.mjs` and is part of `pnpm run validate:governance`. Unsafe historical migrations must be retired as no-op migration-number memory or replaced by additive compatibility objects. Production migration orchestration must keep staging dry-run, PITR checkpoint, rollback manifest, event-store integrity, and production readiness gates in `infrastructure/deployment/migration-orchestration.yaml`.
