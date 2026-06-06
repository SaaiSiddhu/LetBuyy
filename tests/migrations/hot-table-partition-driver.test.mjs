import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const driver = readFileSync('scripts/migration/run-hot-table-partition-maintenance.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/hot-table-partition-maintenance.yml', 'utf8');
const migration = readFileSync('database/supabase/migrations/079_partition_worker_request_logs.sql', 'utf8');
const archivedRootConfig = readFileSync('docs/archive/supabase-root-config/2026-06-06-supabase-config.toml', 'utf8');

test('hot-table partition maintenance driver calls the governed lifecycle functions through psql', () => {
  assert.match(driver, /ensure_next_hot_table_partitions\(\$\{monthsAhead\}\)/);
  assert.match(driver, /detach_expired_hot_table_partitions\(\)/);
  assert.match(driver, /spawnSync\(\s*"psql"/);
  assert.match(driver, /PGPASSWORD/);
  assert.match(driver, /PGSSLMODE/);
  assert.match(driver, /SUPABASE_DB_URL/);
  assert.match(driver, /PRODUCTION_DB_CONNECTION_STRING/);
  assert.doesNotMatch(driver, /console\.log\([^)]*databaseUrl/);
});

test('hot-table partition maintenance workflow runs on a monthly schedule and protected environment', () => {
  assert.match(workflow, /cron: "15 2 1 \* \*"/);
  assert.match(workflow, /environment: \$\{\{ \(inputs\.environment \|\| 'production'\) == 'staging' && 'staging' \|\| 'production-migrations' \}\}/);
  assert.match(workflow, /secrets\.STAGING_DB_CONNECTION_STRING/);
  assert.match(workflow, /secrets\.PRODUCTION_DB_CONNECTION_STRING/);
  assert.match(workflow, /run-hot-table-partition-maintenance\.mjs/);
  assert.match(workflow, /--months-ahead=3/);
  assert.match(workflow, /github\.event_name == 'schedule' \|\| inputs\.execute == true/);
});

test('canonical Supabase migration root is database/supabase and root config is archived', () => {
  assert.equal(existsSync('database/supabase/config.toml'), true);
  assert.equal(existsSync('database/supabase/migrations/000_baseline.sql'), true);
  assert.equal(existsSync('supabase/config.toml'), false);
  assert.match(archivedRootConfig, /major_version = 15/);
});

test('migration 079 exposes the functions the driver schedules', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ensure_next_hot_table_partitions/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.detach_expired_hot_table_partitions/);
  assert.match(migration, /configure the external scheduler to call public\.ensure_next_hot_table_partitions and public\.detach_expired_hot_table_partitions/);
});
