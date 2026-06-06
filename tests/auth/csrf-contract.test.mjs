import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const identityCookiesSource = readFileSync('apps/identity-platform/src/lib/auth/cookies.ts', 'utf8');
const identityProxySource = readFileSync('apps/identity-platform/src/proxy.ts', 'utf8');
const identityCsrfSource = readFileSync('apps/identity-platform/src/lib/auth/csrf.ts', 'utf8');
const identityCsrfClientSource = readFileSync('apps/identity-platform/src/lib/csrf-client.ts', 'utf8');
const mobileStoreAuthSource = readFileSync('apps/mobile/merchant-app/lib/services/store_auth_service.dart', 'utf8');
const gatewaySecuritySource = readFileSync('services/api-gateway/src/middleware/security.ts', 'utf8');
const storefrontRouteSource = readStorefrontRouteSource();

test('identity and mobile write the canonical letbuyy_csrf cookie name', () => {
  assert.match(identityCookiesSource, /csrf: 'letbuyy_csrf'/);
  assert.match(identityProxySource, /response\.cookies\.set\('letbuyy_csrf'/);
  assert.match(mobileStoreAuthSource, /_csrfCookieName = 'letbuyy_csrf'/);

  assert.doesNotMatch(identityCookiesSource, /csrf: 'lb_csrf'/);
  assert.doesNotMatch(identityProxySource, /response\.cookies\.set\('lb_csrf'/);
  assert.doesNotMatch(mobileStoreAuthSource, /_csrfCookieName = 'lb_csrf'/);
});

test('CSRF readers prefer letbuyy_csrf with one-release lb_csrf fallback', () => {
  assert.match(identityCsrfSource, /request\.cookies\.get\('letbuyy_csrf'\)/);
  assert.match(identityCsrfSource, /request\.cookies\.get\('lb_csrf'\)/);
  assert.match(identityCsrfClientSource, /letbuyy_csrf=\(\[\^;\]\*\)/);
  assert.match(identityCsrfClientSource, /lb_csrf=\(\[\^;\]\*\)/);
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
