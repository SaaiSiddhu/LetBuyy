import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const SPECS = [
  ['J1 Identity SSO', 'tests/e2e/federation/identity-sso.spec.ts'],
  ['J2 App Store lifecycle', 'tests/e2e/federation/app-lifecycle.spec.ts'],
  ['J3 Theme Store lifecycle', 'tests/e2e/federation/theme-lifecycle.spec.ts'],
  ['J4 Commerce and event spine', 'tests/e2e/federation/commerce-events.spec.ts'],
  ['J5 Customer SSO', 'tests/e2e/federation/customer-sso.spec.ts'],
];

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

test('F8 Playwright suite contains every required cross-app journey', () => {
  for (const [label, path] of SPECS) {
    const source = read(path);
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(source, /requireRealStack\(request\)/, `${path} must require the real staging stack`);
    assert.match(source, /federationUrls\.gateway/, `${path} must call the real gateway`);
  }
});

test('F8 suite has no browser request interception or alternate gateway stand-ins', () => {
  for (const [, path] of SPECS) {
    const source = read(path);
    assert.doesNotMatch(source, /page\.route|context\.route|route\.fulfill|browserContext\.route/i, `${path} must not intercept browser or API traffic`);
    assert.doesNotMatch(source, /MSW|wiremock|nock|stubServer|fakeGateway|mockGateway/i, `${path} must not use an alternate API server`);
  }
});

test('F8 real-stack helper defaults to staging gateway/app URLs and records screenshot evidence', () => {
  const helper = read('tests/e2e/federation/real-stack.ts');

  assert.match(helper, /api\.staging\.letbuyy\.store/);
  assert.match(helper, /accounts\.staging\.letbuyy\.store/);
  assert.match(helper, /operations\.staging\.letbuyy\.store/);
  assert.match(helper, /\/v1\/storefront\/\$\{demo\.storeSubdomain\}\/products\?limit=1/);
  assert.match(helper, /recordJourneyEvidence/);
  assert.match(helper, /testInfo\.attach/);
  assert.match(helper, /createLetbuyyInternalIdentityHeaders/);
  assert.match(helper, /createCustomerSessionToken/);
});
