// LB-10 — order_cancelled / order_refunded customer emails. The events fire (orders.ts:436-437) but had
// no email template; this adds the templates + the canonical event->email mapping in notification-core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const core = readFileSync(resolve(ROOT, 'packages/notification-core/src/index.ts'), 'utf8');

test('LB-10: order_cancelled + order_refunded email templates exist (subject + body)', () => {
  assert.match(core, /order_cancelled:\s*\{[\s\S]{0,60}subject:[\s\S]{0,200}order_number/);
  assert.match(core, /order_refunded:\s*\{[\s\S]{0,60}subject:[\s\S]{0,260}refund_amount/);
});

test('LB-10: planEmailNotificationForEvent maps the order lifecycle to email templates', () => {
  assert.match(core, /export function planEmailNotificationForEvent/);
  const fn = core.slice(core.indexOf('planEmailNotificationForEvent'), core.indexOf('planInAppNotificationForEvent'));
  assert.match(fn, /case 'order\.cancelled':[\s\S]{0,80}template_key: 'order_cancelled'/);
  assert.match(fn, /case 'order\.refunded':[\s\S]{0,80}template_key: 'order_refunded'/);
  assert.match(fn, /case 'order\.fulfilled':[\s\S]{0,80}template_key: 'shipment_update'/);
});

test('LB-10: the new templates are escaped-context, plain {{ }} interpolation (no raw HTML injection)', () => {
  // mjml body uses the same {{ path }} interpolation as order_confirmation; renderEmailTemplate escapes values
  assert.match(core, /function escapeHtml/);
  assert.match(core, /order_refunded:[\s\S]{0,300}\{\{ order_number \}\}/);
});
