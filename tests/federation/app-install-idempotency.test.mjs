import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const root = new URL('../..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

// H9 — install/uninstall must support Idempotency-Key to dedupe double-submits.

test('gateway install/uninstall claim an Idempotency-Key and replay completed results (H9)', () => {
  const src = readAppStoreRouteSource();
  assert.match(src, /import \{ IdempotencyExecutionAdapter \}/);
  assert.match(src, /c\.req\.header\('X-Idempotency-Key'\)/);
  assert.match(src, /scope: 'app-store\.install'/);
  assert.match(src, /scope: 'app-store\.uninstall'/);
  assert.match(src, /claim\.kind === 'replay'/);
  assert.match(src, /idempotency\.complete\(/);
  // Non-success exits must release the key for immediate retry.
  assert.match(src, /idempotency\.fail\(/);
});

test('marketplace install route forwards the Idempotency-Key to the gateway (H9)', () => {
  const route = read('apps/frozen/app-store/src/app/api/apps/[id]/install/route.ts');
  assert.match(route, /headers\.get\('idempotency-key'\)/);
  assert.match(route, /idempotencyKey \? \{ idempotencyKey \} : undefined/);
});
