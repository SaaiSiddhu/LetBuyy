import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrations = {
  worker_request_logs: readFileSync(
    new URL('../../database/supabase/migrations/079_partition_worker_request_logs.sql', import.meta.url),
    'utf8',
  ),
  runtime_telemetry_metrics: readFileSync(
    new URL('../../database/supabase/migrations/080_partition_runtime_telemetry_metrics.sql', import.meta.url),
    'utf8',
  ),
  outbox_events: readFileSync(
    new URL('../../database/supabase/migrations/081_partition_outbox_events.sql', import.meta.url),
    'utf8',
  ),
  platform_queue_jobs: readFileSync(
    new URL('../../database/supabase/migrations/082_partition_platform_queue_jobs.sql', import.meta.url),
    'utf8',
  ),
  webhook_deliveries: readFileSync(
    new URL('../../database/supabase/migrations/083_partition_webhook_deliveries.sql', import.meta.url),
    'utf8',
  ),
};

const combined = Object.values(migrations).join('\n');
const mirrorMigration = readFileSync(
  new URL('../../database/supabase/migrations/131_hot_table_partition_shadow_mirror.sql', import.meta.url),
  'utf8',
);

test('partition migrations create shadow range-partitioned parents for every hot table', () => {
  for (const [table, migration] of Object.entries(migrations)) {
    assert.match(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}_partitioned[\\s\\S]*PARTITION BY RANGE \\(created_at\\);`),
      `${table} partitioned parent`,
    );
    assert.match(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}_partitioned_default\\s+PARTITION OF public\\.${table}_partitioned DEFAULT;`),
      `${table} default partition`,
    );
    assert.match(
      migration,
      new RegExp(`SELECT public\\.ensure_monthly_hot_table_partition\\('${table}', DATE '2026-06-01'\\);`),
      `${table} current-month partition seed`,
    );
    assert.match(
      migration,
      new RegExp(`SELECT public\\.ensure_monthly_hot_table_partition\\('${table}', DATE '2026-07-01'\\);`),
      `${table} next-month partition seed`,
    );
  }
});

test('retention lifecycle metadata and helpers are governed by the first partition migration', () => {
  const workerMigration = migrations.worker_request_logs;

  for (const fragment of [
    'CREATE TABLE IF NOT EXISTS public.retention_policies',
    'CREATE TABLE IF NOT EXISTS public.partition_lifecycle_partitions',
    'CREATE OR REPLACE FUNCTION public.ensure_monthly_hot_table_partition',
    'CREATE OR REPLACE FUNCTION public.ensure_next_hot_table_partitions',
    'CREATE OR REPLACE FUNCTION public.detach_expired_hot_table_partitions',
    'CREATE OR REPLACE FUNCTION public.backfill_hot_table_partition_shadow',
    'CREATE OR REPLACE FUNCTION public.verify_hot_table_partition_shadow',
    'CREATE OR REPLACE FUNCTION public.configure_hot_table_partition_cron',
    'ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY',
    'CREATE POLICY retention_policies_service_all',
  ]) {
    assert.match(workerMigration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('partition shadows preserve existing hot-table query indexes without duplicating live indexes', () => {
  const expectedIndexes = [
    ['worker_request_logs', 'idx_worker_request_logs_partitioned_route_status'],
    ['worker_request_logs', 'idx_worker_request_logs_partitioned_site_created'],
    ['runtime_telemetry_metrics', 'idx_runtime_telemetry_metrics_partitioned_created'],
    ['runtime_telemetry_metrics', 'idx_runtime_telemetry_metrics_partitioned_name'],
    ['outbox_events', 'idx_outbox_events_partitioned_dispatch_claim'],
    ['outbox_events', 'idx_outbox_events_partitioned_status_available'],
    ['platform_queue_jobs', 'idx_platform_queue_jobs_partitioned_claim'],
    ['platform_queue_jobs', 'idx_platform_queue_jobs_partitioned_site_created'],
    ['webhook_deliveries', 'idx_webhook_deliveries_partitioned_claim'],
    ['webhook_deliveries', 'idx_webhook_deliveries_partitioned_site_created'],
  ];

  for (const [table, indexName] of expectedIndexes) {
    assert.match(migrations[table], new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}`), indexName);
  }

  for (const table of Object.keys(migrations)) {
    assert.doesNotMatch(
      migrations[table],
      new RegExp(`CREATE INDEX IF NOT EXISTS idx_${table}_[a-z_]+\\s+ON public\\.${table}\\b`),
      `${table} must not add duplicate live-table indexes`,
    );
  }
});

test('partition retention policies document terminal-state retention for operational queues', () => {
  assert.match(migrations.outbox_events, /ARRAY\['processed'::text, 'dead'::text\]/);
  assert.match(migrations.platform_queue_jobs, /ARRAY\['succeeded'::text, 'dead'::text, 'cancelled'::text\]/);
  assert.match(migrations.webhook_deliveries, /ARRAY\['succeeded'::text, 'dead'::text, 'cancelled'::text\]/);
});

test('partition migrations remain additive until the approved maintenance-window swap', () => {
  assert.doesNotMatch(combined, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(combined, /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+TO\b/i);
  assert.doesNotMatch(combined, /\bTRUNCATE\b/i);
  assert.match(combined, /worker_request_logs_legacy/);
  assert.match(combined, /outbox_events_legacy/);
});

test('partition shadows are actively mirrored before human-approved cutover', () => {
  assert.match(mirrorMigration, /CREATE OR REPLACE FUNCTION public\.mirror_hot_table_partition_shadow/);
  assert.match(mirrorMigration, /CREATE OR REPLACE FUNCTION public\.set_hot_table_partition_shadow_mirror_enabled/);
  assert.match(mirrorMigration, /INSERT INTO public\.%I SELECT \(\$1\)\.\* ON CONFLICT DO NOTHING/);
  assert.match(mirrorMigration, /Issue #50: partition shadow mirror trigger is active/);

  for (const table of Object.keys(migrations)) {
    assert.match(
      mirrorMigration,
      new RegExp(`CREATE TRIGGER mirror_${table}_partition_shadow\\s+AFTER INSERT OR UPDATE OR DELETE ON public\\.${table}`),
      `${table} mirror trigger`,
    );
  }

  assert.doesNotMatch(mirrorMigration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(mirrorMigration, /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\s+TO\b/i);
  assert.doesNotMatch(mirrorMigration, /\bTRUNCATE\b/i);
});
