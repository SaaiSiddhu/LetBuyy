// Pre-launch wave — checkout/COD/refund hardening (Streams C/E/F). Source-contract tests asserting the
// fixes are wired: COD cancellations release inventory + restore gift cards; the canonical refund path
// restores gift cards; and shippingRateId flows storefront -> proxy -> api-client -> gateway resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const orderRisk = read('services/api-gateway/src/routes/order-risk.ts');
const orders = read('services/api-gateway/src/routes/orders.ts');
const proxy = read('apps/storefront-runtime/src/app/api/orders/route.ts');
const apiClient = read('packages/typescript/api-client/src/index.ts');
const gatewayCheckout = read('services/api-gateway/src/routes/storefront/checkout-payment-routes.ts');

test('F1/F2: COD cancellation releases inventory + restores gift card (helper + both call sites)', () => {
  assert.match(orderRisk, /async function releaseCancelledCodOrderResources/);
  assert.match(orderRisk, /release_order_inventory_with_ledger/);
  assert.match(orderRisk, /restore_gift_card_on_refund/);
  const calls = orderRisk.match(/releaseCancelledCodOrderResources\(db, orderId, tenant\)/g) || [];
  assert.ok(calls.length >= 2, 'helper must be called on both COD reject and COD timeout');
  assert.match(orderRisk, /if \(!confirmed\) \{\s*await releaseCancelledCodOrderResources/);
});

test('E1: the canonical refund/complete path restores gift-card balance', () => {
  const handler = orders.slice(
    orders.indexOf("router.post('/:id/refund/complete'"),
    orders.indexOf("router.post('/:id/refund'"),
  );
  assert.match(handler, /restore_gift_card_on_refund/);
});

test('I-1: shippingRateId flows storefront proxy -> api-client type -> gateway resolver', () => {
  assert.match(proxy, /shippingRateId: body\.shippingRateId \|\| body\.shipping_rate_id \|\| null/);
  assert.match(apiClient, /shippingRateId\?: string \| null;/);
  assert.match(gatewayCheckout, /resolveShippingRate\(db, store\.id, body\.shippingRateId/);
});

test('hardening uses canonical db.rpc (no direct money-table writes introduced)', () => {
  // The COD helper + refund restore must go through SECURITY DEFINER RPCs, never .from(money_table).update
  assert.doesNotMatch(orderRisk, /\.from\(['"](payment_transactions|refunds|payouts|gift_card_ledger_entries)['"]\)\.(insert|update)/);
});
