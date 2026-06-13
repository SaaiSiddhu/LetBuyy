// L10 — Customer Accounts (Full Liquid V1). Structural guard. Behavioral proof: liquid-l10-account.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundle = readFileSync(resolve(ROOT, 'packages/theme-engine/src/theme-bundle.ts'), 'utf8');

test('L10: fixture ships a customers/account template + auth-gated section', () => {
  assert.match(bundle, /'customers\/account'/);
  assert.match(bundle, /type:\s*'customer-account'/);
  assert.match(bundle, /\{% if customer %\}/);
  assert.match(bundle, /\/api\/customer\/logout/);
});
