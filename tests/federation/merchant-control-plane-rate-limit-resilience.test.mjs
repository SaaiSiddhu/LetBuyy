import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('merchant control plane retries query-cost limited session reads', () => {
  const session = read('apps/merchant-control-plane/src/lib/auth/session.ts');

  assert.match(session, /QUERY_COST_RATE_LIMITED/);
  assert.match(session, /QUERY_COST_RETRY_DELAYS_MS/);
  assert.match(session, /export function isQueryCostRateLimited/);
  assert.match(session, /apiErrorStatus\(error\) === 429 && apiErrorCode\(error\) === QUERY_COST_RATE_LIMITED/);
  assert.match(session, /async function retryMerchantRead/);
  assert.match(session, /await wait\(delay\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.auth\.session\(\)\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.stores\.getByHandle\(storeName\)\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.stores\.list\(\{ limit: 50 \}\)\)/);
});

test('merchant store layout degrades optional store switcher list on query-cost limits', () => {
  const layout = read('apps/merchant-control-plane/src/app/[store]/layout.tsx');

  assert.match(layout, /isQueryCostRateLimited/);
  assert.match(layout, /getUserStores\(user\.id\)\.catch/);
  assert.match(layout, /if \(!isQueryCostRateLimited\(error\)\)/);
  assert.match(layout, /throw error/);
  assert.match(layout, /id: storeData\.id/);
  assert.match(layout, /subdomain: storeData\.subdomain/);
  assert.match(layout, /status: storeData\.status/);
});
