// Phase-3 completion (G7) — Razorpay refund webhooks must not corrupt order state when delivered
// out of order (refund.created before payment.captured). Source-contract test (lb* style).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const webhook = readFileSync(resolve(ROOT, 'services/webhook-service/src/index.ts'), 'utf8');

test('G7: markOrderRefunded refuses to refund an order that was never captured (no state corruption)', () => {
  const fn = webhook.slice(
    webhook.indexOf('async function markOrderRefunded'),
    webhook.indexOf('async function getRazorpayOrderNotes'),
  );
  assert.match(fn, /if \(order\.payment_status !== "paid"\)/);
  assert.match(fn, /refund_webhook_skipped_order_not_captured/);
  // the guard precedes the ledger write — the canonical path still runs for the captured (paid) case
  assert.ok(
    fn.indexOf('payment_status !== "paid"') < fn.indexOf('recordGatewayOrderPaymentFailure'),
    'the out-of-order guard must precede the canonical failure-ledger write',
  );
});

test('G7: the refund guard mirrors the existing markOrderFailed paid-guard', () => {
  const failed = webhook.slice(
    webhook.indexOf('async function markOrderFailed'),
    webhook.indexOf('async function markOrderRefunded'),
  );
  assert.match(failed, /if \(order\.payment_status === "paid"\) return;/);
});
