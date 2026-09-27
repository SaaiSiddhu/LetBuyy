import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('product creation validates input, verifies store ownership, and returns 201', () => {
    const routeSource = source('routes/products.ts');
    const adapterSource = source('execution/product-execution.adapter.ts');

    assert.match(routeSource, /router\.post\('\/',\s*validate\('json',\s*CreateProductSchema\)/);
    assert.match(routeSource, /createProductExecutionAdapter\(db,\s*c\.env\)/);
    assert.match(routeSource, /isProductVariantDiffEnabled\(env\)/);
    assert.match(routeSource, /service\.createProduct\(body,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /c\.json\(success\(data\),\s*201\)/);
    assert.match(adapterSource, /await this\.assertStoreOwnership\(input\.store_id,\s*userId,\s*sessionStoreId/);
    assert.match(adapterSource, /\.from\('products'\)\s*[\s\S]*\.insert\(/);
    assert.match(adapterSource, /\.select\(\)\s*[\s\S]*\.single\(\)/);
});

test('product reads are scoped to owned sites and cross-site access is hidden', () => {
    const routeSource = source('routes/products.ts');

    assert.match(routeSource, /router\.get\('\/:id'/);
    assert.match(routeSource, /\.from\('products'\)\s*[\s\S]*\.eq\('id',\s*productId\)/);
    // Phase 2 / F2.5: owner passes via verifyStoreOwnership on the product's OWN store_id (never
    // client-supplied); a non-owner falls through to assertStaffPermission on that same store_id --
    // an active staff member holding products:read/products:write can read it, anyone else (a
    // stranger, or staff at a DIFFERENT store) gets the identical NOT_FOUND, never a 500.
    assert.match(routeSource, /const storeId = String\(product\.store_id\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /assertStaffPermission\(c,\s*storeId,\s*customUser\.id,\s*'products:read'\)/);
    assert.match(routeSource, /code:\s*'NOT_FOUND',\s*message:\s*'Product not found'/);
    assert.match(routeSource, /query\.status === 'active'[\s\S]*dbQuery = dbQuery\.eq\('is_active',\s*true\)/);
    assert.match(routeSource, /query\.status === 'inactive'[\s\S]*dbQuery = dbQuery\.eq\('is_active',\s*false\)/);
});

test('barcode lookup resolves product and variant barcodes inside owned stores only', () => {
    const routeSource = source('routes/products.ts');

    assert.match(routeSource, /router\.get\('\/barcode\/lookup',\s*validate\('query',\s*ProductBarcodeLookupQuery\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /loadProductByBarcode\(db,\s*c\.env,\s*query\.store_id,\s*barcode\)/);
    assert.match(routeSource, /loadVariantProductByBarcode\(db,\s*c\.env,\s*query\.store_id,\s*barcode\)/);
    assert.match(routeSource, /matched_field:\s*'product\.barcode'/);
    assert.match(routeSource, /matched_field:\s*'variant\.barcode'/);
    assert.match(routeSource, /code:\s*'NOT_FOUND',\s*message:\s*'Product not found'/);
});

test('product updates and deletes use owned-product lookup before mutation', () => {
    const routeSource = source('routes/products.ts');
    const adapterSource = source('execution/product-execution.adapter.ts');

    assert.match(routeSource, /router\.patch\('\/:id',\s*validate\('json',\s*UpdateProductSchema\)/);
    assert.match(routeSource, /service\.updateProduct\(productId,\s*customUser\.id,\s*body as Record<string, unknown>,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /router\.delete\('\/:id'/);
    assert.match(routeSource, /service\.softDelete\(productId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(adapterSource, /private async getOwnedProduct/);
    // APPID-FIX2: getOwnedProduct used to look the row up by `.eq('id', productId)` alone, then check
    // ownership on the row it got back -- a shape the tenant query guard refuses outright ("products
    // requires a tenant/owner predicate before execution"), which 500'd PATCH/DELETE even after the
    // staff check had already cleared the product's real store. Ownership is now asked in the query
    // itself, the same scoped shape ownedProductStoreId already used.
    assert.match(adapterSource, /resolveOwnedStoreIds\(userId,\s*sessionStoreId\)/);
    assert.match(adapterSource, /\.eq\('id',\s*productId\)\s*\.in\('store_id',\s*storeIds\)\s*[\s\S]*\.is\('deleted_at',\s*null\)/);
    // The write and refresh-select that follow getOwnedProduct repeat the same id-only shape unless
    // each one also carries the store predicate the guard requires.
    assert.match(adapterSource, /\.update\(updatePlan\.safeUpdates\)\s*\.eq\('id',\s*productId\)\s*\.eq\('store_id',\s*ownedProduct\.store_id\)/);
    assert.match(adapterSource, /\.eq\('id',\s*productId\)\s*\.eq\('store_id',\s*ownedProduct\.store_id\)\s*\.single\(\)/);
    assert.match(adapterSource, /deleted_at:\s*new Date\(\)\.toISOString\(\),\s*\}\)\s*\.eq\('id',\s*productId\)\s*\.eq\('store_id',\s*ownedProduct\.store_id\)/);
});

test('collection updates and deletes verify collection ownership before mutation', () => {
    const routeSource = source('routes/products.ts');

    assert.match(routeSource, /router\.patch\('\/collections\/:id',\s*validate\('json',\s*UpdateCollectionSchema\)/);
    assert.match(routeSource, /\.from\('collections'\)\s*[\s\S]*\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*collectionId\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*collection\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('collections'\)\s*[\s\S]*\.update\(payload\)\s*[\s\S]*\.eq\('id',\s*collectionId\)/);
    assert.match(routeSource, /router\.delete\('\/collections\/:id'/);
    assert.match(routeSource, /deleted_at:\s*new Date\(\)\.toISOString\(\)/);
    assert.match(routeSource, /\.from\('collections'\)\s*[\s\S]*\.delete\(\)\s*[\s\S]*\.eq\('id',\s*collectionId\)/);
});

test('merchant product proxies resolve the URL store to sites.id before worker calls', () => {
    const listRoute = repositorySource('apps/merchant/web/src/app/api/stores/[store]/products/route.ts');
    const itemRoute = repositorySource('apps/merchant/web/src/app/api/stores/[store]/products/[productId]/route.ts');

    assert.match(listRoute, /resolveOwnedStoreId\(decodeURIComponent\(store\)\)/);
    assert.match(listRoute, /store_id:\s*resolved\.storeId/);
    assert.match(listRoute, /createMerchantApiClient\(\)\.products\.list\(query\)/);
    assert.match(listRoute, /createMerchantApiClient\(\)\.products\.create\(\{\s*[\s\S]*\.\.\.body,\s*[\s\S]*store_id:\s*resolved\.storeId/);
    assert.match(itemRoute, /product\.store_id !== resolved\.storeId/);
    assert.match(itemRoute, /return NextResponse\.json\(\{ error:\s*'Product not found' \},\s*\{ status:\s*404 \}\)/);
});

test('uploads fail closed in production and use an inline local fallback without R2', () => {
    const routeSource = source('routes/upload.ts');

    assert.match(routeSource, /if \(!c\.env\.R2_BUCKET\)/);
    assert.match(routeSource, /isProductionEnv\(c\.env\)/);
    assert.match(routeSource, /ASSET_PUBLIC_BASE_URL/);
    assert.match(routeSource, /code:\s*'STORAGE_UNAVAILABLE'/);
    assert.match(routeSource, /data:\$\{file\.type \|\| 'application\/octet-stream'\};base64,\$\{base64\}/);
    assert.match(routeSource, /storage:\s*'local-dev-inline'/);
});
