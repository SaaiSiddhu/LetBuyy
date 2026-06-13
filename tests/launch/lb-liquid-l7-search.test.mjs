// L7 — Search Experience (Full Liquid V1). Structural guard. Behavioral proof: liquid-l7-search.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const bundle = read('packages/theme-engine/src/theme-bundle.ts');
const renderer = read('packages/theme-engine/src/theme-renderer.ts');

test('L7: fixture ships a search template + search-box (lb-search island)', () => {
  assert.match(bundle, /search:\s*\{[\s\S]{0,200}'search-box-default'/);
  assert.match(bundle, /data-lb-island="search"/);
});

test('L7: a search drop is plumbed through buildLiquidCommerceDrops into scope', () => {
  assert.match(renderer, /search:\s*toLiquidDrop\(context\?\.search\)/);
  assert.match(renderer, /search:\s*commerceDrops\.search/);
});
