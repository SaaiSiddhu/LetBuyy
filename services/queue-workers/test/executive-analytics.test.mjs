import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = join(testDir, '..');

function source(path) {
  return readFileSync(join(serviceRoot, path), 'utf8');
}

test('executive analytics worker computes rollups from governed source tables', () => {
  const workerSource = source('src/executive-analytics.ts');
  const indexSource = source('src/index.ts');

  assert.match(workerSource, /export function isExecutiveAnalyticsJob/);
  assert.match(workerSource, /executive\.analytics\.rollup/);
  assert.match(workerSource, /subscriptions/);
  assert.match(workerSource, /app_billing_charges/);
  assert.match(workerSource, /theme_purchases/);
  assert.match(workerSource, /partner_payout_ledger_entries/);
  assert.match(workerSource, /funnel_steps/);
  assert.match(workerSource, /cohort_snapshots/);
  assert.match(workerSource, /metric_rollups/);
  assert.match(workerSource, /mrr_arr_rollups/);
  assert.match(workerSource, /support_tickets/);
  assert.match(workerSource, /risk_scores/);
  assert.match(workerSource, /ts_cases/);
  assert.match(workerSource, /production_incidents/);
  assert.match(workerSource, /executive_analytics\.rollup/);
  assert.match(indexSource, /processExecutiveAnalyticsDeliveries/);
  assert.match(indexSource, /runExecutiveAnalyticsRollup/);
  assert.match(indexSource, /executive_analytics_result/);
  assert.match(indexSource, /scheduled\.executive_analytics_rollup/);
});
