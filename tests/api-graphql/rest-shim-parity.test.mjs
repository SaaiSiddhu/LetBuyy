import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const restShimPath = path.join(repoRoot, 'services/api-gateway/src/graphql/rest-shim.ts');
const adminGraphQLPath = path.join(repoRoot, 'services/api-gateway/src/graphql/admin.ts');
const storefrontGraphQLPath = path.join(repoRoot, 'services/api-gateway/src/graphql/storefront.ts');
const productsRoutePath = path.join(repoRoot, 'services/api-gateway/src/routes/products.ts');
const ordersRoutePath = path.join(repoRoot, 'services/api-gateway/src/routes/orders.ts');
const pagesRoutePath = path.join(repoRoot, 'services/api-gateway/src/routes/pages.ts');

const restShimSource = readFileSync(restShimPath, 'utf8');
const adminGraphQLSource = readFileSync(adminGraphQLPath, 'utf8');
const storefrontGraphQLSource = readFileSync(storefrontGraphQLPath, 'utf8');
const productsRouteSource = readFileSync(productsRoutePath, 'utf8');
const ordersRouteSource = readFileSync(ordersRoutePath, 'utf8');
const pagesRouteSource = readFileSync(pagesRoutePath, 'utf8');
const storefrontRouteSource = readStorefrontRouteSource();

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('WS12 G6 publishes the migrated REST shim parity endpoint contract', () => {
  assertIncludesAll(restShimSource, [
    'WS12_REST_SHIM_PARITY_ENDPOINTS',
    "field: 'products'",
    "restPath: '/products'",
    "field: 'product'",
    "restPath: '/products/:id'",
    "field: 'orders'",
    "restPath: '/orders'",
    "field: 'order'",
    "restPath: '/orders/:id'",
    "field: 'pages'",
    "restPath: '/pages'",
    "field: 'store'",
    "restPath: '/storefront/:subdomain'",
    "restPath: '/storefront/:subdomain/products'",
    "restPath: '/storefront/:subdomain/pages'",
    "field: 'customerOrders'",
    "restPath: '/storefront/customer/orders'",
    "parity: 'rest-envelope-data-preserved'",
  ], 'REST shim parity endpoint contract');
});

test('WS12 G6 Admin and Storefront GraphQL use the shared REST shim request/envelope adapter', () => {
  for (const [source, context] of [
    [adminGraphQLSource, 'Admin GraphQL REST shim'],
    [storefrontGraphQLSource, 'Storefront GraphQL REST shim'],
  ]) {
    assertIncludesAll(source, [
      "createRestShimRequest",
      "readRestShimEnvelope",
      "type RestShimEnvelope",
      "createRestShimRequest(c, path, params",
      "readRestShimEnvelope(response, fieldName",
    ], context);
  }

  assertIncludesAll(restShimSource, [
    "url.pathname = `/v1${path.startsWith('/') ? path : `/${path}`}`",
    "method: 'GET'",
    "data: record && 'data' in record ? record.data : payload",
    "meta: recordValue(record?.meta) || undefined",
  ], 'REST shim byte-preserving adapter');
});

test('WS12 G6 migrated REST endpoints remain the external source of truth for parity reads', () => {
  assertIncludesAll(productsRouteSource, [
    "router.get('/', validate('query', ListProductsQuery)",
    "return c.json(cursorPaginated(responseRows, {",
    "router.get('/:id'",
  ], 'products REST parity routes');

  assertIncludesAll(ordersRouteSource, [
    "router.get('/', validate('query', ListOrdersQuery)",
    "return c.json(cursorPaginated(rows, {",
    "router.get('/:id'",
    "return c.json(success(normalizeOrderRecord(rows[0] as unknown as OrderSourceRow)))",
  ], 'orders REST parity routes');

  assertIncludesAll(pagesRouteSource, [
    "router.get('/', validate('query', ListPagesQuery)",
    "router.get('/policies'",
  ], 'pages REST parity routes');

  assertIncludesAll(storefrontRouteSource, [
    "router.get('/:subdomain/products'",
    "body: paginated(data || [], count || 0, page, limit)",
    "router.get('/:subdomain/products/:slug'",
    "body: success(product)",
    "router.get('/:subdomain/pages'",
    "body: success(pages)",
    "router.get('/customer/orders'",
    "return c.json(success({ orders }))",
  ], 'storefront REST parity routes');

  assertIncludesAll(adminGraphQLSource, [
    "fieldName: 'products', restPath: '/products'",
    "fieldName: 'orders', restPath: '/orders'",
    "fieldName: 'pages', restPath: '/pages'",
    'Promise.all(ADMIN_CONNECTION_FIELDS.map',
    "restGet(c, delegate, `/products/${id}`",
    "restGet(c, delegate, `/orders/${id}`",
  ], 'Admin GraphQL parity delegation paths');

  assertIncludesAll(storefrontGraphQLSource, [
    "`/storefront/${encodeURIComponent(handle)}`",
    "`/storefront/${encodeURIComponent(handle)}/products`",
    "`/storefront/${encodeURIComponent(handle)}/products/${encodeURIComponent(identifier)}`",
    "`/storefront/${encodeURIComponent(handle)}/pages`",
    "'/storefront/customer/orders'",
  ], 'Storefront GraphQL parity delegation paths');
});
