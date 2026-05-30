import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

test('products are isolated by owned store for read, update, and delete paths', () => {
    const routeSource = source('routes/products.ts');
    const adapterSource = source('execution/product-execution.adapter.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('products'\)\s*[\s\S]*\.eq\('id',\s*productId\)/);
    assert.match(routeSource, /verifyStoreOwnership\(db,\s*data\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /service\.updateProduct\(productId,\s*customUser\.id,\s*body as Record<string, unknown>,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /service\.softDelete\(productId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(adapterSource, /private async getOwnedProduct/);
    assert.match(adapterSource, /await this\.assertStoreOwnership\(ownedProduct\.store_id,\s*userId,\s*sessionStoreId/);
});

test('orders are isolated by owned store before listing, reading, and mutating', () => {
    const routeSource = source('routes/orders.ts');
    const tenantSource = source('lib/tenant-context.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('orders'\)\s*[\s\S]*\.eq\('id',\s*orderId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*order\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /const tenant = await resolveTenantContextForOrder\(c,\s*orderId\)/);
    assert.match(routeSource, /const tenant = await resolveTenantContextForOwnedSite\(c,\s*body\.store_id\)/);
    assert.match(tenantSource, /export async function resolveTenantContextForOrder/);
    assert.match(tenantSource, /\.from\('orders'\)\s*[\s\S]*\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*orderId\)/);
    assert.match(tenantSource, /return resolveTenantContextForOwnedSite\(c,\s*order\.store_id as string\)/);
    assert.match(tenantSource, /verifySiteOwnership\(db,\s*siteId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('customers require owned store scope before exposing profiles, orders, or addresses', () => {
    const routeSource = source('routes/customers.ts');

    assert.match(routeSource, /async function verifyStoreOwnership/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*authUser\.storeId\)/);
    assert.match(routeSource, /if \(!\(await verifyStoreOwnership\(db,\s*storeId,\s*auth\.user\)\)\)/);
    assert.match(routeSource, /\.from\('orders'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('customer_addresses'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /\.from\('customer_addresses'\)\s*[\s\S]*\.select\('store_id'\)\s*[\s\S]*\.eq\('id',\s*addressId\)\s*[\s\S]*\.eq\('customer_email',\s*email\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedAddress\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('coupons are isolated by owned store for CRUD while checkout validation stays store scoped', () => {
    const routeSource = source('routes/coupons.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*query\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('coupons'\)\s*[\s\S]*\.select\('\*'\)\s*[\s\S]*\.eq\('id',\s*couponId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*data\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*couponId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedCoupon\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('coupons'\)\s*[\s\S]*\.eq\('store_id',\s*body\.store_id\)\s*[\s\S]*\.eq\('code',\s*body\.code\.toUpperCase\(\)\)/);
    assert.match(routeSource, /pricing_authority:\s*'checkout'/);
});

test('categories are isolated by owned store for tree reads and mutations', () => {
    const routeSource = source('routes/categories.ts');

    assert.match(routeSource, /\.in\('store_id',\s*ownedStoreIds\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('product_categories'\)\s*[\s\S]*\.eq\('id',\s*categoryId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*data\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.select\('id, store_id'\)\s*[\s\S]*\.eq\('id',\s*categoryId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedCategory\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('media metadata reads, updates, and deletes require owned store access', () => {
    const routeSource = source('routes/media.ts');

    assert.match(routeSource, /if \(!storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.eq\('store_id',\s*storeId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*body\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.select\('store_id'\)\s*[\s\S]*\.eq\('id',\s*mediaId\)/);
    assert.match(routeSource, /\.from\('media'\)\s*[\s\S]*\.select\('store_id, url'\)\s*[\s\S]*\.eq\('id',\s*mediaId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedMedia\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('pages, policies, and navigation require owned store checks before content changes', () => {
    const routeSource = source('routes/pages.ts');

    assert.match(routeSource, /async function requireOwnedStore/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*storeId,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /const ownership = await requireOwnedStore\(c,\s*query\.store_id\)/);
    assert.match(routeSource, /const ownership = await requireOwnedStore\(c,\s*body\.store_id\)/);
    assert.match(routeSource, /\.from\('storefront_pages'\)\s*[\s\S]*\.eq\('id',\s*pageId\)\s*[\s\S]*\.is\('deleted_at',\s*null\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedPage\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /\.from\('navigation_menu_items'\)\s*[\s\S]*\.eq\('store_id',\s*ownedPage\.store_id\)\s*[\s\S]*\.eq\('target_resource_id',\s*pageId\)/);
    assert.match(routeSource, /\.from\('storefront_policies'\)\s*[\s\S]*\.select\('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at'\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*policy\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
});

test('theme editor instances, drafts, releases, and installs are isolated by owned store', () => {
    const routeSource = source('routes/themes.ts');
    const adapterSource = source('execution/theme-execution.adapter.ts');

    assert.match(routeSource, /service\.verifyStoreOwner\(queryResult\.data\.store_id,\s*customUser\.id\)/);
    assert.match(routeSource, /service\.loadEditor\(slug,\s*parsed\.data\.store_id,\s*customUser\.id\)/);
    assert.match(routeSource, /service\.saveDraft\(slug,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(routeSource, /service\.deleteDraft\(slug,\s*parsed\.data\.store_id,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(routeSource, /service\.publish\(slug,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(routeSource, /service\.rollbackRelease\(slug,\s*releaseId,\s*body,\s*customUser\.id,\s*getRequestId\(c\)\)/);
    assert.match(adapterSource, /async verifyStoreOwner\(storeId: string,\s*userId: string\)/);
    assert.match(adapterSource, /\.from\('sites'\)\s*[\s\S]*\.eq\('id',\s*storeId\)\s*[\s\S]*\.or\(`custom_user_id\.eq\.\$\{userId\},user_id\.eq\.\$\{userId\}`\)/);
    assert.match(adapterSource, /throw new ForbiddenError\('Store not found or not owned by this user'\)/);
    assert.match(adapterSource, /await this\.verifyStoreOwner\(input\.store_id,\s*userId\)/);
    assert.match(adapterSource, /await this\.verifyStoreOwner\(storeId,\s*userId\)/);
    assert.match(adapterSource, /\.from\('theme_releases'\)\s*[\s\S]*\.eq\('id',\s*releaseId\)\s*[\s\S]*\.eq\('store_id',\s*input\.store_id\)/);
});
