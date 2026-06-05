# Hot Table Partitioning and Retention Governance

LetBuyy hot-table partitioning uses an expand-first migration model.

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

Physical cleanup of detached partitions is an operations action, not an automatic replayable migration action. This keeps fresh database replay safe and avoids irreversible data loss from normal migration application.
