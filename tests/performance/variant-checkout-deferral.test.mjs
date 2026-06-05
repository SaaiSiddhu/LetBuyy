import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('product variant updates use diffing and a single inventory batch rpc', () => {
  const adapter = read('services/api-gateway/src/execution/product-execution.adapter.ts');
  const activeBlock = adapter.slice(
    adapter.indexOf('private async replaceProductVariants('),
    adapter.indexOf('private async replaceProductVariantsLegacy('),
  );
  const legacyBlock = adapter.slice(adapter.indexOf('private async replaceProductVariantsLegacy('));

  assert.match(adapter, /isProductVariantDiffEnabled/);
  assert.match(activeBlock, /loadExistingProductVariants/);
  assert.match(activeBlock, /variantWriteChanged/);
  assert.match(activeBlock, /rowsToUpdate/);
  assert.match(activeBlock, /setInventoryAvailableBatch\(inventoryLevels,\s*actorId\)/);
  assert.doesNotMatch(activeBlock, /for \(const variant of data \|\| \[\]\)\s*{\s*await this\.setInventoryAvailable/);
  assert.match(adapter, /variantDiffEnabled === false/);
  assert.match(legacyBlock, /\.from\('product_variants'\)\.delete\(\)\.eq\('product_id', productId\)/);
});

test('batch inventory migration wraps the existing inventory semantics', () => {
  const migration = read('database/supabase/migrations/088_inventory_available_batch.sql');

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.set_inventory_levels_available_batch/);
  assert.match(migration, /jsonb_array_length\(p_levels\) > 1000/);
  assert.match(migration, /public\.set_inventory_level_available/);
  assert.match(migration, /079-083 are Phase 5 partition migrations/);
  assert.match(migration, /085-086 are Phase 5 reconciliation migrations/);
  assert.match(migration, /087 remains reserved/);
});

test('runtime flags expose variant diff and checkout post-commit rollback switches', () => {
  const env = read('services/api-gateway/src/index.ts');
  const wrangler = read('services/api-gateway/wrangler.toml');
  const products = read('services/api-gateway/src/routes/products.ts');
  const exportRoute = read('services/api-gateway/src/routes/export.ts');

  assert.match(env, /PRODUCT_VARIANT_DIFF\?: string/);
  assert.match(env, /CHECKOUT_POSTCOMMIT_DEFERRAL\?: string/);
  assert.equal((wrangler.match(/PRODUCT_VARIANT_DIFF = "on"/g) || []).length, 3);
  assert.equal((wrangler.match(/CHECKOUT_POSTCOMMIT_DEFERRAL = "on"/g) || []).length, 3);
  assert.match(products, /isProductVariantDiffEnabled\(env\)/);
  assert.match(exportRoute, /isProductVariantDiffEnabled\(c\.env\)/);
});

test('storefront checkout defers post-commit usage and GST work', () => {
  const orderAdapter = read('services/api-gateway/src/execution/order-execution.adapter.ts');
  const storefront = read('services/api-gateway/src/routes/storefront.ts');
  const adminOrders = read('services/api-gateway/src/routes/orders.ts');

  assert.match(orderAdapter, /interface CreateOrderOptions/);
  assert.match(orderAdapter, /async createOrder\(input: CreateCheckoutOrderCommand,\s*tenant: TenantContext,\s*options: CreateOrderOptions = {}\)/);
  assert.match(orderAdapter, /if \(options\.deferPostCommit\) return data/);
  assert.match(orderAdapter, /async completeOrderPostCommitWork/);
  assert.match(storefront, /isCheckoutPostCommitDeferralEnabled\(c\.env\)/);
  assert.match(storefront, /const orderCommand: CreateCheckoutOrderCommand/);
  assert.match(storefront, /service\.createOrder\(orderCommand,\s*tenant,\s*\{ deferPostCommit \}\)/);
  assert.match(storefront, /c\.executionCtx\.waitUntil\(\s*service\.completeOrderPostCommitWork\(orderCommand,\s*tenant,\s*order\)/);
  assert.doesNotMatch(adminOrders, /deferPostCommit/);
});
