// L5 — Product Experience (Full Liquid V1). Structural guard. Behavioral proof: liquid-l5-product.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-bundle.ts'), 'utf8');

test('L5: fixture ships a product template referencing product-detail', () => {
  assert.match(bundle, /product:\s*\{[\s\S]{0,200}'product-detail-default'/);
  assert.match(bundle, /type:\s*'product-detail'/);
});

test('L5: product-detail section binds product drop + server add-to-cart island', () => {
  assert.match(bundle, /\{\{ product\.title \}\}/);
  assert.match(bundle, /product\.price \| money_with_currency/);
  assert.match(bundle, /lb-add-to-cart/);
});
