import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const root = new URL('../..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

// doc 06 §5 — store_id must be derived from the merchant session and
// ownership-verified server-side; a client-supplied store the caller does not
// own must be rejected (never trusted from the request body).
test('gateway install derives store_id from the session and verifies ownership', () => {
  const src = readAppStoreRouteSource();
  const start = src.indexOf("router.post('/apps/:id/install'");
  assert.ok(start >= 0, 'install POST handler must exist');
  const handler = src.slice(start, src.indexOf('router.', start + 1));

  // Falls back to the session-owned site when no store_id is supplied...
  assert.match(handler, /findFirstOwnedSiteId\(db, customUser\.id\)/);
  // ...and ownership of the resolved store is verified before any write.
  assert.match(handler, /verifySiteOwnership\(db, storeId, customUser\.id/);
  assert.match(handler, /Not authorized/);
});

test('gateway uninstall verifies store ownership server-side', () => {
  const src = readAppStoreRouteSource();
  const start = src.indexOf("router.delete('/apps/:id/install'");
  assert.ok(start >= 0, 'uninstall DELETE handler must exist');
  const handler = src.slice(start, src.indexOf('router.', start + 1));

  assert.match(handler, /findFirstOwnedSiteId\(db, customUser\.id\)/);
  assert.match(handler, /verifySiteOwnership\(db, resolvedStoreId, customUser\.id/);
});
