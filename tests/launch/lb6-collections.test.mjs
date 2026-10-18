import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { classifyAppApiRoute, listAppApiRoutes } from '../../scripts/validators/app-api-route-inventory.mjs';

// LB-6: collections end-to-end structural tests

const repoRoot = process.cwd();

const gatewayProducts = path.join(repoRoot, 'services/api-gateway/src/routes/products.ts');
const storefrontPublicRoutes = path.join(repoRoot, 'services/api-gateway/src/routes/storefront/public-routes.ts');
const mcpCollectionsPage = path.join(repoRoot, 'apps/merchant/web/src/app/[store]/products/collections/page.tsx');
const mcpProxyRoute = path.join(repoRoot, 'apps/merchant/web/src/app/api/stores/[store]/collections/[collectionId]/products/route.ts');
const storefrontCollectionPage = path.join(repoRoot, 'apps/commerce/web/src/app/store/[subdomain]/collections/[slug]/page.tsx');
const categoryGrid = path.join(repoRoot, 'apps/commerce/web/src/components/sections/category-grid.tsx');
const apiClient = path.join(repoRoot, 'packages/typescript/api-client/src/index.ts');

function read(p) { return readFileSync(p, 'utf8'); }

test('(a) gateway has GET collection products route reading collection_products', () => {
    const content = read(gatewayProducts);
    assert.match(content, /router\.get\(['"`]\/collections\/:id\/products['"`]/,
        'GET /products/collections/:id/products route must exist');
    assert.match(content, /collection_products/,
        'Route must query collection_products table');
});

test('(a) gateway has PUT collection products route writing collection_products', () => {
    const content = read(gatewayProducts);
    assert.match(content, /router\.put\(['"`]\/collections\/:id\/products['"`]/,
        'PUT /products/collections/:id/products route must exist');
    assert.match(content, /collection_products.*delete|delete.*collection_products/s,
        'PUT route must delete old assignments from collection_products');
    assert.match(content, /collection_products.*upsert|upsert.*collection_products/s,
        'PUT route must upsert new assignments into collection_products');
    assert.match(content, /eq\('store_id', collection\.store_id/,
        'PUT route must validate products belong to the same store');
});

test('(b) public storefront collection-by-slug endpoint exists in public-routes', () => {
    const content = read(storefrontPublicRoutes);
    assert.match(content, /\/:subdomain\/collections\/:slug/,
        'GET /storefront/:subdomain/collections/:slug route must exist');
    assert.match(content, /collections.*eq\('id', identifier\)|eq\('id', identifier\)/,
        'Collection lookup must query by id (slug = id fallback)');
    assert.match(content, /collection_products/,
        'Public route must load collection_products assignments');
    assert.match(content, /queryPublicProducts/,
        'Public route must use queryPublicProducts for product shape/cache');
    assert.match(content, /storefrontCacheTags/,
        'Public route must tag cache entries');
});

test('(b) api-client exposes getCollectionWithProducts on storefront object', () => {
    const content = read(apiClient);
    assert.match(content, /getCollectionWithProducts/,
        'api-client storefront must expose getCollectionWithProducts');
    assert.match(content, /StorefrontCollectionPayload/,
        'api-client must export StorefrontCollectionPayload type');
});

test('(c) MCP collections page contains manage-products wiring', () => {
    const content = read(mcpCollectionsPage);
    assert.match(content, /openManageProducts/,
        'Collections page must have openManageProducts handler');
    assert.match(content, /saveManageProducts/,
        'Collections page must have saveManageProducts handler');
    assert.match(content, /Manage products/,
        'Collections page must show "Manage products" action');
    assert.match(content, /toggleProductAssignment/,
        'Collections page must support toggling individual product assignments');
});

test('(c) MCP proxy route exists and forwards GET and PUT', () => {
    assert.ok(existsSync(mcpProxyRoute), `MCP proxy route file must exist: ${mcpProxyRoute}`);
    const content = read(mcpProxyRoute);
    assert.match(content, /export async function GET/,
        'Proxy route must export GET handler');
    assert.match(content, /export async function PUT/,
        'Proxy route must export PUT handler');
    assert.match(content, /createMerchantApiClient/,
        'Proxy route must use createMerchantApiClient (no direct DB)');
    assert.match(content, /resolveOwnedStoreId/,
        'Proxy route must resolve store ownership');
    assert.match(content, /listProducts|replaceProducts/,
        'Proxy route must call listProducts or replaceProducts on the api client');
    assert.doesNotMatch(content, /getSupabase|supabaseAdmin|\.from\(/,
        'Proxy route must not access DB directly');
});

test('(d) storefront collections/[slug]/page.tsx exists with notFound and metadata', () => {
    assert.ok(existsSync(storefrontCollectionPage), 'Storefront collection page must exist');
    const content = read(storefrontCollectionPage);
    assert.match(content, /notFound\(\)/,
        'Collection page must call notFound() when collection is missing');
    assert.match(content, /generateMetadata/,
        'Collection page must export generateMetadata');
    assert.match(content, /buildStoreMetadata/,
        'Collection page must use buildStoreMetadata');
    assert.match(content, /getCollectionWithProducts/,
        'Collection page must fetch via getCollectionWithProducts');
    assert.match(content, /StorefrontCompositionEngine/,
        'Collection page must render via StorefrontCompositionEngine');
});

test('(e) categoryGrid links to /collections/ not /shop?category=', () => {
    const content = read(categoryGrid);
    assert.match(content, /basePath.*\/collections\//,
        'categoryGrid must link to /collections/[slug]');
    assert.doesNotMatch(content, /\/shop\?category=/,
        'categoryGrid must not link to /shop?category= for collection cards');
});

// P4-4 classifies every app-local API route. The count is the validator's ratchet
// (scripts/validators/app-api-route-inventory.mjs); this test owns the collection-products proxy:
// inventoried, and a plain gateway proxy to /v1/products/collections/:id/products.
test('(P4-4) the collection-products proxy is inventoried as gateway-proxy', () => {
    const route = 'apps/merchant/web/src/app/api/stores/[store]/collections/[collectionId]/products/route.ts';
    assert.ok(listAppApiRoutes().includes(route), `${route} must be in the app-local API route inventory`);
    assert.equal(classifyAppApiRoute(route), 'gateway-proxy');
});

test('(P4-4) governance doc records the new proxy route', () => {
    const doc = readFileSync(path.join(repoRoot, 'docs/governance/app-api-route-ownership.md'), 'utf8');
    assert.match(doc, /V1-LAUNCH-LB6/,
        'governance doc must include V1-LAUNCH-LB6 inventory change entry');
    assert.match(doc, /collections\/\[collectionId\]\/products/,
        'governance doc must name the new proxy route');
});
