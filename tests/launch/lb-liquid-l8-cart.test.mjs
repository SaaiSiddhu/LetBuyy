// L8 — Cart Migration (Full Liquid V1). Structural guard. Behavioral proof: liquid-l8-cart.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-bundle.ts'), 'utf8');

test('L8: fixture ships a cart template + cart-summary section', () => {
  assert.match(bundle, /cart:\s*\{[\s\S]{0,160}'cart-summary-default'/);
  assert.match(bundle, /type:\s*'cart-summary'/);
});

test('L8: cart binds server total + signed checkout handoff (no client totals)', () => {
  assert.match(bundle, /for item in cart\.items/);
  assert.match(bundle, /cart\.total_price \| money_with_currency/);
  assert.match(bundle, /href="\{\{ cart\.checkout_url \}\}"/);
});
