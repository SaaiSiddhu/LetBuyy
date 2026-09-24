import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const FEDERATED_PROXY_FILES = [
  'apps/frozen/app-store/src/proxy.ts',
  'apps/frozen/theme-store/src/proxy.ts',
  'apps/internal/console/src/proxy.ts',
  'apps/frozen/operations-portal/src/proxy.ts',
];

test('federated app proxies accept the shared merchant session verifier', () => {
  for (const file of FEDERATED_PROXY_FILES) {
    assert.equal(existsSync(file), true, `${file} must exist`);
    const source = readFileSync(file, 'utf8');

    assert.match(source, /@letbuyy\/auth-core/, `${file} must import auth-core`);
    assert.match(source, /LETBUYY_MERCHANT_SESSION_COOKIE/, `${file} must read lb_session`);
    assert.match(source, /verifyLetbuyySessionCookieValue\(\s*['"]merchant['"]/, `${file} must verify merchant sessions`);
  }
});

test('federated apps redirect unauthenticated browser traffic to accounts lookup with return_to', () => {
  for (const file of FEDERATED_PROXY_FILES) {
    const source = readFileSync(file, 'utf8');
    const resolverFile = file === 'apps/frozen/app-store/src/proxy.ts'
      ? 'apps/frozen/app-store/src/lib/site-url.ts'
      : file === 'apps/frozen/theme-store/src/proxy.ts'
        ? 'apps/frozen/theme-store/src/lib/public-urls.ts'
        : null;
    const centralResolver =
      Boolean(resolverFile) &&
      /getAccountsUrl\(\)/.test(source) &&
      /NEXT_PUBLIC_ACCOUNTS_URL/.test(readFileSync(resolverFile, 'utf8'));

    assert.ok(
      /NEXT_PUBLIC_ACCOUNTS_URL/.test(source) || centralResolver,
      `${file} must allow the accounts origin to be configured`,
    );
    assert.match(source, /new URL\(['"]\/lookup['"]/, `${file} must redirect through the identity lookup flow`);
    assert.match(source, /searchParams\.set\(['"]return_to['"],\s*request\.url\)/, `${file} must preserve the caller URL`);
    assert.doesNotMatch(source, /searchParams\.set\(['"]redirect['"],\s*request\.url\)/, `${file} must not use the legacy login redirect contract`);
    assert.doesNotMatch(source, /new URL\(['"][^'"]*accounts\.letbuyy\.store\/login['"]/, `${file} must not redirect directly to accounts login`);
  }
});

test('theme marketplace protects account checkout and install routes at the edge', () => {
  const source = readFileSync('apps/frozen/theme-store/src/proxy.ts', 'utf8');

  assert.match(source, /const PROTECTED_ROUTES = \['\/checkout', '\/dashboard', '\/install'\]/);
  assert.match(source, /'\/checkout\/:path\*'/);
  assert.match(source, /'\/dashboard\/:path\*'/);
  assert.match(source, /'\/install\/:path\*'/);
});

test('identity lookup is the shared return_to entry point for federated SSO', () => {
  const lookupSource = readFileSync('apps/platform/identity/src/app/lookup/page.tsx', 'utf8');
  const themeNavbarSource = readFileSync('apps/frozen/theme-store/src/components/layout/navbar.tsx', 'utf8');

  assert.match(lookupSource, /searchParams\.get\('return_to'\)/);
  assert.match(themeNavbarSource, /\?return_to=/);
  assert.match(themeNavbarSource, /\$\{ACCOUNTS_URL\}\/lookup/);
});
