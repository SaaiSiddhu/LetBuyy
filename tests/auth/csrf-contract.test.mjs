import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const identityCookiesSource = readFileSync('apps/platform/identity/src/lib/auth/cookies.ts', 'utf8');
const identityProxySource = readFileSync('apps/platform/identity/src/proxy.ts', 'utf8');
const identityCsrfSource = readFileSync('apps/platform/identity/src/lib/auth/csrf.ts', 'utf8');
const identityCsrfClientSource = readFileSync('apps/platform/identity/src/lib/csrf-client.ts', 'utf8');
const mobileStoreAuthSource = readFileSync('apps/merchant/mobile/lib/services/store_auth_service.dart', 'utf8');
const gatewaySecuritySource = readFileSync('services/api-gateway/src/middleware/security.ts', 'utf8');
const storefrontRouteSource = readStorefrontRouteSource();

test('identity and mobile write the canonical letbuyy_csrf cookie name', () => {
  assert.match(identityCookiesSource, /const COOKIE_NAMES = resolveLetbuyyPlatformCookieNames/);
  assert.match(identityProxySource, /response\.cookies\.set\(names\.csrf/);
  assert.match(mobileStoreAuthSource, /String csrfCookieName = 'letbuyy_csrf'/);

  assert.doesNotMatch(identityCookiesSource, /csrf: 'lb_csrf'/);
  assert.doesNotMatch(identityProxySource, /response\.cookies\.set\('lb_csrf'/);
  assert.doesNotMatch(mobileStoreAuthSource, /String csrfCookieName = 'lb_csrf'/);
});

test('CSRF readers prefer letbuyy_csrf with one-release lb_csrf fallback', () => {
  assert.match(identityCsrfSource, /request\.cookies\.get\(names\.csrf\)/);
  assert.match(identityCsrfSource, /request\.cookies\.get\(names\.legacyCsrf\)/);
  assert.match(identityCsrfClientSource, /\[names\.csrf, names\.legacyCsrf\]/);
  assert.match(identityCsrfClientSource, /resolveLetbuyyPlatformCookieNames\(process\.env\.NEXT_PUBLIC_ENV\)/);
  assert.match(gatewaySecuritySource, /parseCookie\(c\.req\.header\('cookie'\), 'letbuyy_csrf'\)/);
  assert.match(gatewaySecuritySource, /parseCookie\(c\.req\.header\('cookie'\), 'lb_csrf'\)/);
});

test('public storefront browser mutations use CSRF middleware', () => {
  for (const route of [
    '/reviews',
    '/:subdomain/contact',
    '/customer/wishlist',
    '/customer/activity',
    '/customer/profile',
    '/customer/addresses',
  ]) {
    assert.match(storefrontRouteSource, new RegExp(`router\\.use\\('${route.replace(/\//g, '\\/')}', csrfProtection\\)`));
  }
});
