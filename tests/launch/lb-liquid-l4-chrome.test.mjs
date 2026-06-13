// L4 — Liquid Chrome (Full Liquid V1). Structural guard. Behavioral proof: liquid-l4-chrome.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const renderer = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-renderer.ts'), 'utf8');

test('L4: renderer renders header/footer templates as Liquid chrome', () => {
  assert.match(renderer, /renderLiquidTemplateSections/);
  assert.match(renderer, /bundle\.templates\.header/);
  assert.match(renderer, /bundle\.templates\.footer/);
  assert.match(renderer, /header\?: string;/);
  assert.match(renderer, /footer\?: string;/);
});

test('L4: chrome goes through the same sanitized section pipeline as the body', () => {
  // the helper sanitizes each section; chrome reuses it (no separate un-sanitized path)
  assert.match(renderer, /Shared by the page body and by the[\s\S]{0,80}header\/footer chrome/);
});
