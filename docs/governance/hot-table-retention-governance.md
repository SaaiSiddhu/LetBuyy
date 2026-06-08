# Hot Table Partitioning and Retention Governance

LetBuyy hot-table partitioning uses an expand-first migration model.

Issue #50 decision: keep and finish the partition shadows rather than dropping
them. `database/supabase/migrations/131_hot_table_partition_shadow_mirror.sql`
activates live-to-shadow mirroring from each hot table into its
`*_partitioned` parent, so the shadows are no longer inert while the final
rename-swap remains a human-approved maintenance-window action.

The active Phase 5 partition migrations create partitioned shadow tables for:

- `worker_request_logs`
- `runtime_telemetry_metrics`
- `outbox_events`
- `platform_queue_jobs`
- `webhook_deliveries`

Replayable migrations may create the partitioned shadows, current and next month partitions, default partitions, retention policy metadata, lifecycle helpers, bounded backfill helpers, and verification helpers. They must not perform the live rename-swap, destructive cleanup, or production data removal.

Live cutover requires a human-approved maintenance window with:

- staging-clone dry run on representative volume
- queue drain proof for `outbox_events` and `platform_queue_jobs`
- row-count parity from `verify_hot_table_partition_shadow`
- claim-query and created-at query `EXPLAIN` evidence
- backup or restore point recorded before cutover
- original live table retained as `*_legacy` for one full retention cycle

Retention lifecycle automation should call:

- `public.ensure_next_hot_table_partitions(3)`
- `public.detach_expired_hot_table_partitions()`

The executable driver is `scripts/migration/run-hot-table-partition-maintenance.mjs`, scheduled by `.github/workflows/hot-table-partition-maintenance.yml` on the first day of each month at 02:15 UTC. Production execution requires the protected `production-migrations` environment and `PRODUCTION_DB_CONNECTION_STRING`; staging execution requires the staging environment and `STAGING_DB_CONNECTION_STRING`.

Physical cleanup of detached partitions is an operations action, not an automatic replayable migration action. This keeps fresh database replay safe and avoids irreversible data loss from normal migration application.

The mirror triggers can be disabled or re-enabled during an approved incident or
maintenance window with:

- `SELECT public.set_hot_table_partition_shadow_mirror_enabled(false);`
- `SELECT public.set_hot_table_partition_shadow_mirror_enabled(true);`

Production cutover is still human-gated: run bounded backfills until
`verify_hot_table_partition_shadow` reports row-count parity, confirm queue-drain
and query-plan evidence, take a backup/restore point, then perform the approved
rename-swap while retaining each `*_legacy` table for one full retention cycle.
