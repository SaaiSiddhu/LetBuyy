import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('hot gateway list routes do not run exact counts by default', () => {
  for (const path of [
    'services/api-gateway/src/routes/products.ts',
    'services/api-gateway/src/routes/orders.ts',
    'services/api-gateway/src/routes/media.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /\.select\('\*',\s*\{\s*count:\s*'exact'\s*\}\)/, path);
    assert.match(source, /withCount \? \{ count: 'exact' \} : undefined/, path);
    assert.match(source, /cursorPaginated/, path);
    assert.match(source, /encodeListCursor/, path);
    assert.match(source, /decodeListCursor/, path);
  }
});

test('orders list does not expand order_items relation by default', () => {
  const source = read('services/api-gateway/src/routes/orders.ts');
  const listBlock = source.slice(source.indexOf("// GET /orders"), source.indexOf("// GET /orders/:id"));
  const detailBlock = source.slice(source.indexOf("// GET /orders/:id"));

  assert.ok(listBlock.length > 0, 'orders list route block should be present');
  assert.doesNotMatch(listBlock, /order_items\(\*\)/);
  assert.doesNotMatch(detailBlock, /order_items\(\*\)/);
  assert.match(source, /hydrateOrderItems/);
  assert.match(source, /\.from\('order_items'\)/);
});

test('shared pagination contracts expose cursor and count opt-in fields', () => {
  const sharedTypes = read('packages/shared-types/src/index.ts');
  const apiClient = read('packages/typescript/api-client/src/index.ts');
  const commerceCore = read('packages/commerce-core/src/index.ts');
  const checkoutCore = read('packages/checkout-core/src/index.ts');

  assert.match(sharedTypes, /cursor: z\.string\(\)\.max\(512\)\.optional\(\)/);
  assert.match(sharedTypes, /withCount: QueryBooleanSchema/);
  assert.match(apiClient, /next_cursor\?: string \| null/);
  assert.match(apiClient, /withCount\?: boolean/);
  assert.match(commerceCore, /withCount: QueryBooleanSchema/);
  assert.match(checkoutCore, /withCount: QueryBooleanSchema/);
});
