import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../routes/export.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const tsClientSource = readFileSync(
    new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url),
    'utf8',
);
const dartClientSource = readFileSync(
    new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url),
    'utf8',
);
const orderServiceSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/services/order_service.dart', import.meta.url),
    'utf8',
);
const customerServiceSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/services/customer_service.dart', import.meta.url),
    'utf8',
);
const ordersScreenSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/screens/orders/orders_screen.dart', import.meta.url),
    'utf8',
);
const customersScreenSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/screens/customers/customers_screen.dart', import.meta.url),
    'utf8',
);

test('mobile export route supports products, orders, and customers through owned scope', () => {
    assert.match(bffSource, /'\/v1\/export'/);
    assert.match(routeSource, /type ExportJobType = 'products' \| 'orders' \| 'customers' \| 'product_import'/);
    assert.match(routeSource, /router\.get\('\/orders'/);
    assert.match(routeSource, /router\.get\('\/customers'/);
    assert.match(routeSource, /processCustomersExport/);
    assert.match(routeSource, /\.from\('store_customers'\)/);
    assert.match(routeSource, /resolveExportScope\(c,\s*c\.req\.query\('store_id'\)\)/);
    assert.match(routeSource, /filename: `customers-\$\{dateStamp\(\)\}\.csv`/);
});

test('TS and Dart clients expose customer export jobs', () => {
    assert.match(tsClientSource, /type: 'products' \| 'orders' \| 'customers' \| 'product_import'/);
    assert.match(tsClientSource, /customers:\s*\(query: Pick<StoreScopedQuery, 'store_id'>/);
    assert.match(tsClientSource, /\/export\/customers/);
    assert.match(dartClientSource, /Future<JsonMap> customers\(\{/);
    assert.match(dartClientSource, /\/export\/customers/);
});

test('mobile order and customer screens share real CSV exports without placeholder copy', () => {
    assert.match(orderServiceSource, /exportOrders/);
    assert.match(orderServiceSource, /_api\.exports\.orders/);
    assert.match(customerServiceSource, /exportCustomers/);
    assert.match(customerServiceSource, /_api\.exports\.customers/);
    assert.match(ordersScreenSource, /Order CSV export ready to share/);
    assert.match(customersScreenSource, /Customer CSV export ready to share/);
    assert.match(ordersScreenSource, /shareMerchantExport/);
    assert.match(customersScreenSource, /shareMerchantExport/);
    assert.doesNotMatch(ordersScreenSource, /Export to \$format coming soon/);
    assert.doesNotMatch(customersScreenSource, /coming soon/i);
});
