import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
  const storefront = read('services/api-gateway/src/routes/storefront.ts');

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

test('storefront product and order routes avoid JSONB reads when relational flags are on', () => {
  const storefront = read('services/api-gateway/src/routes/storefront.ts');
  const productDetailBlock = storefront.slice(
    storefront.indexOf("router.get('/:subdomain/products/:slug'"),
    storefront.indexOf("// GET /storefront/:subdomain/coupons/validate"),
  );
  const customerOrdersBlock = storefront.slice(
    storefront.indexOf("router.get('/customer/orders'"),
    storefront.indexOf("// GET /storefront/:subdomain/orders/contact"),
  );

  assert.doesNotMatch(productDetailBlock, /product_variants\(\*\)/);
  assert.match(productDetailBlock, /hydratePublicProductVariants/);
  assert.match(customerOrdersBlock, /orderItemsRelationalReadsEnabled\(c\.env\) \? 'id, order_number, status, total, created_at' : 'id, order_number, status, total, created_at, items'/);
  assert.match(customerOrdersBlock, /hydrateStorefrontOrderItems/);
});

test('dual-model migrations are additive and keep rollback columns', () => {
  const combined = `${orderMigration}\n${productMigration}`;
  assert.doesNotMatch(combined, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(combined, /\bTRUNCATE\b/i);
  assert.doesNotMatch(combined, /\bRENAME\s+TO\b/i);
  assert.match(combined, /orders\.items/);
  assert.match(combined, /products\.variants/);
});
