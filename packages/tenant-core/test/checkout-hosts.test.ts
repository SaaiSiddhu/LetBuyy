import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoreCheckoutHostname, platformCheckoutStoreHandle } from '../src/index';

test('derives the requested checkout host from the persisted store handle and exact base', () => {
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'shops.example.invalid' }), 'checkout.snaz.shops.example.invalid');
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'shops.example.invalid', connectedHost: 'example.com' }), 'checkout.example.com');
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'shops.example.invalid', connectedHost: 'shop.example.co.in' }), 'checkout.shop.example.co.in');
  assert.equal(platformCheckoutStoreHandle('checkout.snaz.shops.example.invalid', 'shops.example.invalid'), 'snaz');
});

test('cannot turn malformed hosts, reserved handles or suffix tricks into checkout authority', () => {
  for (const handle of ['checkout', 'api', 'admin', 'Snaz', 'snaz.other', '-snaz', 'snaz-', 'snaz/other', 'snaz@other']) {
    assert.equal(buildStoreCheckoutHostname({ subdomain: handle, storeRootDomain: 'shops.example.invalid' }), null, handle);
  }
  for (const base of ['https://example.com', 'example.com:443', 'example.com/path', 'example.com@evil.invalid', '127.0.0.1', 'localhost', 'example.com.', 'example..com', 'EXAMPLE.com', 'example.com?x=1']) {
    assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'shops.example.invalid', connectedHost: base }), null, base);
  }
  for (const host of ['checkout.snaz.shops.example.invalid.evil.invalid', 'checkout.other.snaz.shops.example.invalid', 'snaz.shops.example.invalid', 'checkout.shops.example.invalid']) {
    assert.equal(platformCheckoutStoreHandle(host, 'shops.example.invalid'), null, host);
  }
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'shops.example.invalid', connectedHost: Array(5).fill('x'.repeat(60)).join('.') }), null);
});
