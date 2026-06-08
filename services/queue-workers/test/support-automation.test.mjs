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

test('support automation worker handles SLA recompute and CSAT dispatch jobs', () => {
  const supportSource = source('src/support-automation.ts');
  const indexSource = source('src/index.ts');

  assert.match(supportSource, /export function isSupportAutomationJob/);
  assert.match(supportSource, /support\.sla\.recompute/);
  assert.match(supportSource, /support\.csat\.dispatch/);
  assert.match(supportSource, /ticket_sla_clocks/);
  assert.match(supportSource, /ticket_csat/);
  assert.match(supportSource, /patchSupabaseRows/);
  assert.match(supportSource, /support\.sla\.recompute/);
  assert.match(supportSource, /support\.csat\.dispatch/);
  assert.match(indexSource, /processSupportAutomationDeliveries/);
  assert.match(indexSource, /support_automation_result/);
});
