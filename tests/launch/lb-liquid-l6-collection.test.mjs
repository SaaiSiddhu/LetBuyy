// L6 — Collection Experience (Full Liquid V1). Structural guard. Behavioral proof: liquid-l6-collection.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-bundle.ts'), 'utf8');

test('L6: fixture ships a collection template + collection-banner + product list', () => {
  assert.match(bundle, /collection:\s*\{[\s\S]{0,260}'collection-banner-default'/);
  assert.match(bundle, /type:\s*'collection-banner'/);
  assert.match(bundle, /type:\s*'collection-product-list'/);
});

test('L6: collection sections bind real collection.title/description + product loop', () => {
  assert.match(bundle, /\{\{ collection\.title \}\}/);
  assert.match(bundle, /collection\.description/);
  assert.match(bundle, /for item in collection\.products/);
});
