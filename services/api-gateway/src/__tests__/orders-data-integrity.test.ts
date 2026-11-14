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

test('storefront order creation derives the tenant from the resolved published store', () => {
    const routeSource = source('routes/storefront/checkout-payment-routes.ts');

    assert.match(routeSource, /const store = await loadPublishedStore\(c,\s*subdomain\)/);
    assert.match(routeSource, /const tenant = await createPublicStorefrontTenantContext\(c,\s*store\.id\)/);
    assert.match(routeSource, /requestBody:\s*\{ \.\.\.body,\s*resolvedStoreId:\s*store\.id,\s*buyerAccountId:\s*buyerSession\?\.buyerAccountId\s*\?\?\s*null \}/);
    assert.match(routeSource, /const order = await service\.createOrder\(orderCommand,\s*tenant,/);
    assert.doesNotMatch(routeSource, /store_id:\s*body\./);
});

test('placed order line-item changes remain forbidden after tenant and staff authorization', () => {
    const routeSource = source('routes/orders.ts');
    const start = routeSource.indexOf("router.patch('/:id/line-items'");
    const end = routeSource.indexOf("router.patch('/:id'", start + 1);
    assert.ok(start >= 0 && end > start, 'the immutable placed-order boundary must exist');
    const handler = routeSource.slice(start, end);

    assert.match(handler, /validate\('json', UpdateOrderLineItemsSchema\)/);
    assert.match(handler, /resolveTenantContextForOrder\(c,\s*c\.req\.param\('id'\)\)/);
    assert.match(handler, /assertStaffPermission\(c,\s*tenant\.siteId,\s*tenant\.userId,\s*'orders:write'\)/);
    assert.match(handler, /if \(staffBlock\) return staffBlock/);
    assert.match(handler, /throw new AppError\([\s\S]*409,\s*'ORDER_SNAPSHOT_IMMUTABLE'/);
    assert.ok(handler.indexOf('resolveTenantContextForOrder') < handler.indexOf('assertStaffPermission'));
    assert.ok(handler.indexOf('assertStaffPermission') < handler.indexOf('throw new AppError'));
    assert.doesNotMatch(handler, /\.from\(|\.(?:insert|update|upsert|delete)\(|client_total|body\.total|body\.subtotal/);
});

test('merchant packing slips render from owned order data', () => {
    const routeSource = source('routes/orders.ts');

    assert.match(routeSource, /router\.get\('\/:id\/packing-slip'/);
    assert.match(routeSource, /resolveTenantContextForOrder\(c,\s*orderId\)/);
    assert.match(routeSource, /hydrateOrderItems\(db,\s*\[order as unknown as Record<string, unknown>\]\)/);
    assert.match(routeSource, /createSimplePdfBytes/);
    assert.match(routeSource, /pdf_base64:\s*bytesToBase64\(pdfBytes\)/);
    assert.match(routeSource, /filename:\s*`packing-slip-\$\{orderNumber\}\.pdf`/);
    assert.doesNotMatch(routeSource, /Print coming soon|Packing slip coming soon/);
});

test('merchant draft orders save intent and convert through canonical order creation', () => {
    const routeSource = source('routes/orders.ts');
    const draftIndex = routeSource.indexOf("router.post('/drafts'");
    const orderGetIndex = routeSource.indexOf("router.get('/:id'");

    assert.ok(draftIndex > -1);
    assert.ok(orderGetIndex > -1);
    assert.ok(draftIndex < orderGetIndex);
    assert.match(routeSource, /router\.get\('\/drafts'/);
    assert.match(routeSource, /router\.post\('\/drafts'/);
    assert.match(routeSource, /router\.post\('\/drafts\/:id\/convert'/);
    assert.match(routeSource, /draftProductsBelongToSite\(db,\s*tenant\.siteId,\s*body\.items\)/);
    assert.match(routeSource, /scope:\s*'orders\.drafts\.create'/);
    assert.match(routeSource, /scope:\s*`orders\.drafts\.convert:\$\{draftId\}`/);
    assert.match(routeSource, /service\.createOrder\(/);
    assert.doesNotMatch(routeSource, /body\.total|body\.subtotal|body\.line_items/);
});
