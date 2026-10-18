// L11 — Orders (Full Liquid V1). Structural guard. Behavioral proof: liquid-l11-orders.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const bundle = read('packages/theme-engine/src/theme-bundle.ts');
const renderer = read('packages/theme-engine/src/theme-renderer.ts');

test('L11: fixture ships order-history + order-detail templates', () => {
  assert.match(bundle, /'customers\/orders'/);
  assert.match(bundle, /'customers\/order'/);
  assert.match(bundle, /for order in buyer\.orders/);
  assert.doesNotMatch(bundle, /for order in customer\.orders/,
    'private order history uses verified buyer-order links, not a store-customer email relationship');
  assert.match(bundle,/buyer_unavailable[\s\S]*role="alert"/);
  assert.match(bundle, /for item in order\.line_items/);
});

test('L11: an order drop is plumbed into scope (read-only display)', () => {
  assert.match(renderer, /order:\s*toLiquidDrop\(context\?\.order\)/);
  assert.match(renderer, /order:\s*commerceDrops\.order/);
});
