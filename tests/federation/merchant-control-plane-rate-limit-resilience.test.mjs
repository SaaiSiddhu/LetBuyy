import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('merchant control plane bounds session read retries and identifies query-cost refusals', () => {
  const session = read('apps/merchant/web/src/lib/auth/session.ts');

  assert.match(session, /QUERY_COST_RATE_LIMITED/);
  assert.match(session, /MERCHANT_READ_RETRY_DELAYS_MS = \[200\]/);
  assert.match(session, /export function isQueryCostRateLimited/);
  assert.match(session, /apiErrorStatus\(error\) === 429 && apiErrorCode\(error\) === QUERY_COST_RATE_LIMITED/);
  assert.match(session, /async function retryMerchantRead/);
  assert.match(session, /await wait\(delay\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.auth\.session\(\)\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.stores\.getByHandle\(storeName\)\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.stores\.list\(\{ limit: 50 \}\)\)/);
});

test('merchant store layout degrades optional store switcher list on query-cost limits', () => {
  const layout = read('apps/merchant/web/src/app/[store]/layout.tsx');

  assert.match(layout, /const currentStorePromise = getStoreForUser\(store\)/);
  assert.match(layout, /Promise\.all\(\[userPromise, currentStorePromise\]\)/);
  assert.match(layout, /stores => \(\{ stores, unavailable: false \}\)/);
  assert.match(layout, /\(\) => \(\{ stores: \[\], unavailable: true \}\)/);
  assert.match(layout, /if \(!storeData\) \{\s*notFound\(\)/);
  assert.match(layout, /userStoresPromise=\{userStoresPromise\}/);
  assert.match(layout, /id: storeData\.id/);
  assert.match(layout, /subdomain: storeData\.subdomain/);
  assert.match(layout, /status: storeData\.status/);
});
