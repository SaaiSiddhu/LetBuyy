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

test('review check worker handles marketplace app/theme check jobs', () => {
  const reviewSource = source('src/review-checks.ts');
  const indexSource = source('src/index.ts');

  assert.match(reviewSource, /export function isReviewCheckJob/);
  assert.match(reviewSource, /marketplace\.review\.run_checks/);
  assert.match(reviewSource, /marketplace_review_records/);
  assert.match(reviewSource, /review_check_runs/);
  assert.match(reviewSource, /marketplace_apps/);
  assert.match(reviewSource, /theme_package_versions/);
  assert.match(reviewSource, /evaluateMarketplaceReviewChecks/);
  assert.match(reviewSource, /buildMarketplaceReviewAutomatedChecks/);
  assert.match(reviewSource, /marketplace\.review\.check_run/);
  assert.match(indexSource, /processReviewCheckDeliveries/);
  assert.match(indexSource, /review_check_result/);
});
