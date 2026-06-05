import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storefrontRouteSource = readFileSync('services/api-gateway/src/routes/storefront.ts', 'utf8');
const productAdapterSource = readFileSync('services/api-gateway/src/execution/product-execution.adapter.ts', 'utf8');
const gatewayIndexSource = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const wranglerSource = readFileSync('services/api-gateway/wrangler.toml', 'utf8');

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('product detail cache misses emit sampled analytics events instead of hot-row updates', () => {
  assertIncludesAll(storefrontRouteSource, [
    'DEFAULT_STOREFRONT_VIEW_SAMPLE_RATE = 0.1',
    'function storefrontViewSampleRate',
    'function shouldSampleStorefrontView',
    'crypto.getRandomValues(random)',
    'function emitProductViewedEvent',
    'c.env.ANALYTICS_QUEUE',
    "queueName: 'analytics-events'",
    "jobType: 'product.viewed'",
    "type: 'product.viewed'",
    "type: 'product'",
    'sample_rate: sampleRate',
    'sample_weight: sampleWeight',
    'c.executionCtx.waitUntil(queue.send',
    'emitProductViewedEvent(c, {',
  ], 'storefront product-view event path');
  assert.ok(!storefrontRouteSource.includes('recordStorefrontView'));
});

test('product execution adapter no longer performs view_count read-modify-write', () => {
  assert.ok(!productAdapterSource.includes('recordStorefrontView'));
  assert.ok(!productAdapterSource.includes('view_count'));
  assert.ok(!productAdapterSource.includes('Product view counter update failed'));
});

test('storefront view sampling is an explicit rollbackable worker setting', () => {
  assert.match(gatewayIndexSource, /STOREFRONT_VIEW_SAMPLE_RATE\?: string/);
  assert.equal((wranglerSource.match(/STOREFRONT_VIEW_SAMPLE_RATE = "0.1"/g) || []).length, 3);
});
