// L12 — Order Tracking (Full Liquid V1). Structural guard. Behavioral proof: liquid-l12-tracking.test.ts.
// At L12 every customer-facing route has a Liquid template (render-parity reached, pending L14 staging).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-bundle.ts'), 'utf8');

test('L12: order detail renders a status timeline + tracking (blank-safe)', () => {
  assert.match(bundle, /lb-order-detail__timeline/);
  assert.match(bundle, /for step in order\.timeline/);
  assert.match(bundle, /order\.tracking_number != blank/);
});

test('L12: every customer-facing route has a Liquid template', () => {
  for (const key of ['index', 'product', 'collection', 'search', 'cart', 'customers/login', 'customers/register', 'customers/account', 'customers/orders', 'customers/order']) {
    assert.ok(bundle.includes(`'${key}'`) || bundle.includes(`${key}:`), `template for ${key} must exist`);
  }
});
