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
    assert.match(routeSource, /requestBody:\s*\{ \.\.\.body,\s*resolvedStoreId:\s*store\.id \}/);
    assert.match(routeSource, /const order = await service\.createOrder\(orderCommand,\s*tenant,/);
    assert.doesNotMatch(routeSource, /store_id:\s*body\./);
});

test('merchant order line-item edits recalculate totals server-side', () => {
    const routeSource = source('routes/orders.ts');

    assert.match(routeSource, /router\.patch\('\/:id\/line-items'/);
    assert.match(routeSource, /UpdateOrderLineItemsSchema/);
    assert.match(routeSource, /resolveTenantContextForOrder\(c,\s*orderId\)/);
    assert.match(routeSource, /scope:\s*`orders\.line_items:\$\{orderId\}`/);
    assert.match(routeSource, /\.from\('order_items'\)[\s\S]+\.select\('total'\)/);
    assert.match(routeSource, /subtotal\s*=\s*\(\(activeLines \|\| \[\]\)/);
    assert.doesNotMatch(routeSource, /client_total|body\.total|body\.subtotal/);
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
