import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const analyticsRoute = readFileSync('services/api-gateway/src/routes/analytics.ts', 'utf8');
const storefrontRoute = readStorefrontRouteSource();
const queueWorker = readFileSync('services/queue-workers/src/platform-queue-consumer.ts', 'utf8');
const gatewayQueueConsumer = readFileSync('services/api-gateway/src/execution/queue-execution.adapter.ts', 'utf8');
const runtimeComposition = readFileSync('packages/runtime-composition/src/search-projection-runtime.ts', 'utf8');
const wranglerConfig = readFileSync('services/api-gateway/wrangler.toml', 'utf8');

function blockAfter(source, marker, length = 2400) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return source.slice(start, start + length);
}

test('analytics rollup planner emits commerce projection metrics', () => {
  assert.match(runtimeComposition, /metricName: 'orders\.created'/);
  assert.match(runtimeComposition, /metricName: 'orders\.paid'/);
  assert.match(runtimeComposition, /metricName: 'orders\.status'/);
  assert.match(runtimeComposition, /metricName: 'revenue\.paid_minor'/);
  assert.match(runtimeComposition, /metricName: 'product\.units_sold'/);
  assert.match(runtimeComposition, /metricName: 'product\.revenue_minor'/);
  assert.match(runtimeComposition, /export function planOrderItemAnalyticsRollupIncrements/);
});

test('queue consumers maintain analytics/search projections from events', () => {
  for (const source of [queueWorker, gatewayQueueConsumer]) {
    assert.match(source, /planAnalyticsRollupIncrements\(\{[\s\S]*payload: envelope\.payload \|\| \{\}/);
    assert.match(source, /planOrderItemAnalyticsRollupIncrements/);
    assert.match(source, /from\('order_items'\)/);
    assert.match(source, /from\('analytics_event_stream'\)/);
    assert.match(source, /from\('search_documents'\)/);
  }
});

test('analytics routes read rollups before legacy OLTP fallbacks', () => {
  assert.match(analyticsRoute, /function analyticsRollupReadsEnabled/);
  assert.match(analyticsRoute, /from\('analytics_rollups_daily'\)/);
  assert.match(analyticsRoute, /ANALYTICS_PROJECTION_READS/);

  for (const marker of ["router.get('/dashboard'", "router.get('/revenue'", "router.get('/top-products'", "router.get('/orders'"]) {
    const routeBlock = blockAfter(analyticsRoute, marker, 3200);
    assert.match(routeBlock, /analyticsRollupReadsEnabled\(c\.env\)/);
    assert.ok(
      routeBlock.indexOf('analyticsRollupReadsEnabled(c.env)') < routeBlock.indexOf(".from('orders')") ||
      routeBlock.indexOf(".from('orders')") === -1,
      `${marker} must choose projection reads before any raw orders fallback`,
    );
    assert.ok(
      routeBlock.indexOf('analyticsRollupReadsEnabled(c.env)') < routeBlock.indexOf(".from('products')") ||
      routeBlock.indexOf(".from('products')") === -1,
      `${marker} must choose projection reads before any raw products fallback`,
    );
  }
});

test('storefront product search resolves through search_documents before product hydration', () => {
  assert.match(storefrontRoute, /function storefrontSearchIndexReadsEnabled/);
  assert.match(storefrontRoute, /from\('search_documents'\)/);
  assert.match(storefrontRoute, /textSearch\('search_vector', term, \{ config: 'simple', type: 'websearch' \}\)/);
  assert.match(storefrontRoute, /STOREFRONT_SEARCH_PROJECTION/);

  const queryBlock = blockAfter(storefrontRoute, 'async function queryPublicProducts(c', 3600);
  assert.match(queryBlock, /querySearchDocumentProductIds\(c, storeId, options\)/);
  assert.match(queryBlock, /search: undefined/);
  assert.ok(
    queryBlock.indexOf('querySearchDocumentProductIds(c, storeId, options)') < queryBlock.indexOf('queryPublicProductsFromPooledSql'),
    'projection search must run before pooled SQL fallback',
  );
  assert.ok(
    queryBlock.indexOf('querySearchDocumentProductIds(c, storeId, options)') < queryBlock.indexOf("query.ilike('name'"),
    'projection search must run before legacy products.name ilike fallback',
  );
});

test('projection read flags default on with rollback switches', () => {
  assert.match(wranglerConfig, /STOREFRONT_SEARCH_PROJECTION = "on"/);
  assert.match(wranglerConfig, /ANALYTICS_PROJECTION_READS = "on"/);
  assert.match(analyticsRoute, /\|\| 'on'\)\.trim\(\)\.toLowerCase\(\) !== 'off'/);
  assert.match(storefrontRoute, /\|\| 'on'\)\.trim\(\)\.toLowerCase\(\) !== 'off'/);
});
