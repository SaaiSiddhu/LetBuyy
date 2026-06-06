import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const root = new URL('../..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

// Reviews integrity — POST /app-store/apps/:id/reviews must require an active
// installation for the reviewing user/store before accepting a review.
test('app review submission requires an active installation', () => {
  const src = readAppStoreRouteSource();
  const start = src.indexOf("router.post('/apps/:id/reviews'");
  assert.ok(start >= 0, 'reviews POST handler must exist');
  // Scope the assertions to the reviews handler body.
  const handler = src.slice(start, src.indexOf("router.", start + 1));

  assert.match(handler, /\.eq\('status', 'active'\)/, 'must filter installations by active status');
  assert.match(handler, /must have an active installation/, 'must reject when no active installation');
  assert.match(handler, /\}, 403\)/, 'must return 403 for non-installers');
});
