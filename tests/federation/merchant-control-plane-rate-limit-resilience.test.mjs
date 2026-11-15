import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('merchant control plane bounds session read retries and identifies query-cost refusals', () => {
  const session = read('apps/merchant/web/src/lib/auth/session.ts');
  const retry = read('apps/merchant/web/src/lib/api/read-retry.ts');

  assert.match(session, /import \{ apiErrorStatus, retryMerchantRead \} from '@\/lib\/api\/read-retry'/);
  assert.match(session, /export \{ isQueryCostRateLimited \} from '@\/lib\/api\/read-retry'/);
  assert.match(retry, /QUERY_COST_RATE_LIMITED/);
  assert.match(retry, /MERCHANT_READ_RETRY_DELAYS_MS = \[200\]/);
  assert.match(retry, /export function isQueryCostRateLimited/);
  assert.match(retry, /apiErrorStatus\(error\) === 429 && apiErrorCode\(error\) === QUERY_COST_RATE_LIMITED/);
  assert.match(retry, /async function retryMerchantRead/);
  assert.match(retry, /await wait\(delay\)/);
  assert.match(retry, /Date\.now\(\) - startedAt \+ delay > 1_000/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.auth\.session\(\)\)/);
  assert.match(session, /retryMerchantRead\(\(\) => createMerchantApiClient\(\)\.stores\.getByHandle\(storeName\)\)/);
  // Retry the whole verified discovery, including subsequent pages. A first
  // page alone must never masquerade as the complete store switcher.
  assert.match(session, /const stores = await retryMerchantRead\(async \(\) =>/);
  assert.match(session, /for \(let page = 1; ; page\+\+\)/);
  assert.match(session, /client\.stores\.list\(\{ page, limit: 50 \}, \{ storeId: '' \}\)/);
  assert.match(session, /observedTotal !== undefined && total !== observedTotal/);
  assert.match(session, /ids\.has\(store\.id\)/);
  assert.match(session, /if \(!payload\.has_more\) return rows/);
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
