import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const orderMigration = read('database/supabase/migrations/085_orders_items_reconcile.sql');
const productMigration = read('database/supabase/migrations/086_products_variants_reconcile.sql');

test('dual-model reconciliation migrations report before converging', () => {
  assert.match(orderMigration, /CREATE TABLE IF NOT EXISTS public\.dual_model_reconciliation_reports/);
  assert.match(orderMigration, /CREATE OR REPLACE FUNCTION public\.report_orders_items_reconciliation/);
  assert.match(orderMigration, /CREATE OR REPLACE FUNCTION public\.backfill_order_items_from_jsonb/);
  assert.match(orderMigration, /CREATE OR REPLACE FUNCTION public\.refresh_orders_items_jsonb_cache/);
  assert.match(orderMigration, /CREATE OR REPLACE FUNCTION public\.reconcile_orders_items_dual_model/);
  assert.match(orderMigration, /SELECT public\.report_orders_items_reconciliation\(25\);/);

  assert.match(productMigration, /CREATE OR REPLACE FUNCTION public\.report_products_variants_reconciliation/);
  assert.match(productMigration, /CREATE OR REPLACE FUNCTION public\.backfill_product_variants_from_jsonb/);
  assert.match(productMigration, /CREATE OR REPLACE FUNCTION public\.refresh_products_variants_jsonb_cache/);
  assert.match(productMigration, /CREATE OR REPLACE FUNCTION public\.reconcile_products_variants_dual_model/);
  assert.match(productMigration, /SELECT public\.report_products_variants_reconciliation\(25\);/);
});

test('product variant writes treat products.variants as a derived cache', () => {
  const commerceCore = read('packages/commerce-core/src/index.ts');
  const adapter = read('services/api-gateway/src/execution/product-execution.adapter.ts');
  const updateFieldsBlock = commerceCore.slice(
    commerceCore.indexOf('export const PRODUCT_UPDATE_FIELDS'),
    commerceCore.indexOf('export type ProductUpdateField'),
  );

  assert.doesNotMatch(updateFieldsBlock, /'variants'/);
  assert.match(commerceCore, /variants: \[\]/);
  assert.match(adapter, /refreshProductVariantJsonbCache/);
  assert.match(adapter, /\.from\('product_variants'\)/);
  assert.match(adapter, /\.from\('products'\)\s*[\s\S]*?\.update\(\{ variants: cache \}\)/);
});

test('gateway readers hydrate orders and products from relational tables behind rollback flags', () => {
  const env = read('services/api-gateway/src/index.ts');
  const wrangler = read('services/api-gateway/wrangler.toml');
  const orders = read('services/api-gateway/src/routes/orders.ts');
  const products = read('services/api-gateway/src/routes/products.ts');
  const storefront = readStorefrontRouteSource();

  assert.match(env, /ORDER_ITEMS_RELATIONAL_READS\?: string/);
  assert.match(env, /PRODUCT_VARIANTS_RELATIONAL_READS\?: string/);
  assert.equal((wrangler.match(/ORDER_ITEMS_RELATIONAL_READS = "on"/g) || []).length, 3);
  assert.equal((wrangler.match(/PRODUCT_VARIANTS_RELATIONAL_READS = "on"/g) || []).length, 3);

  assert.match(orders, /orderItemsRelationalReadsEnabled/);
  assert.match(orders, /hydrateOrderItems/);
  assert.match(orders, /\.from\('order_items'\)/);
  assert.match(products, /productVariantRelationalReadsEnabled/);
  assert.match(products, /hydrateProductVariants/);
  assert.match(products, /\.from\('product_variants'\)/);
  assert.match(storefront, /hydratePublicProductVariants/);
  assert.match(storefront, /hydrateStorefrontOrderItems/);
});

// F-ORDERDETAIL-1 (CAP-C51) widened the customer orders column list so the order-detail page stops
// rendering a zero subtotal and an always-COD payment method; that list is pinned by
// services/api-gateway/src/__tests__/customer-order-detail-fields.test.ts and is not this test's concern.
// What THIS test owns is the flag contract: relational flag on -> the select must not read the JSONB
// `items` column (items come from order_items via hydrateStorefrontOrderItems); flag off -> the same
// columns plus `items`. So the two column lists are compared to each other, not to a literal.
function routeBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  const next = source.indexOf('router.get(', start + marker.length);
  return source.slice(start, next === -1 ? undefined : next);
}

test('storefront product and order routes avoid JSONB reads when relational flags are on', () => {
  const storefront = readStorefrontRouteSource();
  const productDetailBlock = routeBlock(storefront, "router.get('/:subdomain/products/:slug'");
  const customerOrdersBlock = routeBlock(storefront, "router.get('/customer/orders'");

  assert.doesNotMatch(productDetailBlock, /product_variants\(\*\)/);
  assert.match(productDetailBlock, /hydratePublicProductVariants/);

  const select = /orderItemsRelationalReadsEnabled\(c\.env\)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(customerOrdersBlock);
  assert.ok(select, 'customer orders must choose its column list by orderItemsRelationalReadsEnabled(c.env)');
  const columns = (list) => list.split(',').map((column) => column.trim());
  const relational = columns(select[1]);
  const legacy = columns(select[2]);
  assert.equal(relational.includes('items'), false, 'relational reads must not select the JSONB items column');
  assert.equal(legacy.includes('items'), true, 'the rollback path still reads the JSONB items column');
  // The relational path swaps `items` for `store_id`, which the order_items hydration guard needs, and the
  // handler drops it again before responding; nothing else differs between the two column lists.
  assert.deepEqual(
    [...relational].sort(),
    [...legacy.filter((column) => column !== 'items'), 'store_id'].sort(),
    'the two paths differ only by items (legacy) and store_id (relational, for the hydration guard)',
  );
  assert.match(customerOrdersBlock, /hydrateStorefrontOrderItems/);
  assert.match(customerOrdersBlock, /store_id: _storeId, \.\.\.rest/, 'store_id is selected for the hydration guard only and is not sent to the customer');
});

test('dual-model migrations are additive and keep rollback columns', () => {
  const combined = `${orderMigration}\n${productMigration}`;
  assert.doesNotMatch(combined, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(combined, /\bTRUNCATE\b/i);
  assert.doesNotMatch(combined, /\bRENAME\s+TO\b/i);
  assert.match(combined, /orders\.items/);
  assert.match(combined, /products\.variants/);
});
