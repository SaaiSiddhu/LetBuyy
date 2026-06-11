import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productsRouteSource = readFileSync(new URL('../routes/products.ts', import.meta.url), 'utf8');
const tsClientSource = readFileSync(new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url), 'utf8');
const dartClientSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url), 'utf8');
const productServiceSource = readFileSync(new URL('../../../../apps/mobile/merchant-app/lib/services/product_service.dart', import.meta.url), 'utf8');
const productsScreenSource = readFileSync(new URL('../../../../apps/mobile/merchant-app/lib/screens/products/products_screen.dart', import.meta.url), 'utf8');

const sampleRouteStart = productsRouteSource.indexOf("router.post('/sample'");
const productDetailRouteStart = productsRouteSource.indexOf("router.get('/:id'");
const sampleRouteSource = productsRouteSource.slice(sampleRouteStart, productDetailRouteStart);

test('sample product route is before product detail and gated to owned empty stores', () => {
    assert.ok(sampleRouteStart > -1, 'sample route must be registered');
    assert.ok(productDetailRouteStart > -1, 'product detail route must be registered');
    assert.ok(sampleRouteStart < productDetailRouteStart, 'sample route must not be captured by /:id');
    assert.match(sampleRouteSource, /validate\('json', StoreScopedQuerySchema\)/);
    assert.match(sampleRouteSource, /verifyStoreOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(sampleRouteSource, /countStoreProducts\(db,\s*body\.store_id\)/);
    assert.match(sampleRouteSource, /PRODUCT_CATALOG_NOT_EMPTY/);
});

test('sample product is clearly labeled and not active storefront inventory', () => {
    assert.match(productsRouteSource, /Sample Product - Cotton Tote/);
    assert.match(productsRouteSource, /inactive draft/);
    assert.match(productsRouteSource, /LETBUYY-SAMPLE-PRODUCT/);
    assert.match(productsRouteSource, /'sample', 'not-for-sale', 'edit-before-publication'/);
    assert.match(productsRouteSource, /is_active: false/);
    assert.match(productsRouteSource, /sampleProductInput\(body\.store_id\)/);
    assert.doesNotMatch(sampleRouteSource, /order_|orders|analytics|revenue|sales/i);
});

test('shared clients and mobile screen expose real sample seeding without fake metrics', () => {
    assert.match(tsClientSource, /sample: \(input: Pick<StoreScopedQuery, 'store_id'>/);
    assert.match(tsClientSource, /'\/products\/sample'/);
    assert.match(dartClientSource, /Future<JsonMap> sample\(JsonMap input/);
    assert.match(dartClientSource, /'\/products\/sample'/);
    assert.match(productServiceSource, /seedSampleProduct\(String storeId\)/);
    assert.match(productServiceSource, /_api\.products\.sample\(\{'store_id': storeId\}\)/);
    assert.match(productsScreenSource, /Add sample product/);
    assert.match(productsScreenSource, /Sample product added as an inactive draft/);
    assert.doesNotMatch(productsScreenSource, /fake metrics|demo revenue|sample sales/i);
});
