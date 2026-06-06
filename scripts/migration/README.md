# Migration Scripts

One-time or repeatable migration tooling belongs here when it is safe, documented, and intentionally reusable.

Disposable migration scratch files must stay out of the repository or live under `.tmp/`, `.analysis/`, `.codex/`, or `temp/` until deleted.

## Hot-table partition maintenance

`run-hot-table-partition-maintenance.mjs` is the scheduled driver for the partition lifecycle helpers introduced in `database/supabase/migrations/079_partition_worker_request_logs.sql`.

- Plan: `node scripts/migration/run-hot-table-partition-maintenance.mjs --environment=staging`
- Execute: `SUPABASE_DB_URL=... node scripts/migration/run-hot-table-partition-maintenance.mjs --environment=production --execute`

The script calls `public.ensure_next_hot_table_partitions(3)` and `public.detach_expired_hot_table_partitions()` through `psql`. It must not print database URLs or credentials.
