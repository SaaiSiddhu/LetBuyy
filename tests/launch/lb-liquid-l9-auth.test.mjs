// L9 — Customer Registration (engine templates; live register BLOCKED on LB-12). Structural guard.
// Behavioral proof of the templates: liquid-l9-auth.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const bundle = read('packages/theme-engine/src/theme-bundle.ts');
const hr = read('EXECUTABLE_HUMAN_REQUIRED.md');

test('L9: bundle ships customers/login + customers/register templates', () => {
  assert.match(bundle, /'customers\/login'/);
  assert.match(bundle, /'customers\/register'/);
  assert.match(bundle, /action="\/api\/customer\/login"/);
  const registerSection = bundle.slice(bundle.indexOf("'customer-register': createLiquidSectionFile"),bundle.indexOf("'customer-settings': createLiquidSectionFile"));
  assert.match(registerSection,/\/api\/buyer-auth\/start\?return_to=\{\{ routes\.account_url \}\}/);
  assert.doesNotMatch(registerSection,/action="\/api\/customer\/register"|name="password"/,
    'new accounts use canonical Identity; the compatibility login stays available for linking');
});

test('L9: the LB-12 register-backend blocker is recorded with the HS256 issuer constraint', () => {
  assert.match(hr, /HR-LB12-REGISTER/);
  assert.match(hr, /CUSTOMER_SESSION_SECRET/);
  assert.match(hr, /no `identity-platform`\/ES256 touch/);
});
