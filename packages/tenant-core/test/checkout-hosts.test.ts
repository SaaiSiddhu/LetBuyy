import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoreCheckoutHostname, platformCheckoutStoreHandle } from '../src/index';

test('derives the requested checkout host from the persisted store handle and exact base', () => {
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'letbuyy.store' }), 'checkout.snaz.letbuyy.store');
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'letbuyy.store', connectedHost: 'example.com' }), 'checkout.snaz.example.com');
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'letbuyy.store', connectedHost: 'shop.example.co.in' }), 'checkout.snaz.shop.example.co.in');
  assert.equal(platformCheckoutStoreHandle('checkout.snaz.letbuyy.store', 'letbuyy.store'), 'snaz');
});

test('cannot turn malformed hosts, reserved handles or suffix tricks into checkout authority', () => {
  for (const handle of ['checkout', 'api', 'admin', 'Snaz', 'snaz.other', '-snaz', 'snaz-', 'snaz/other', 'snaz@other']) {
    assert.equal(buildStoreCheckoutHostname({ subdomain: handle, storeRootDomain: 'letbuyy.store' }), null, handle);
  }
  for (const base of ['https://example.com', 'example.com:443', 'example.com/path', 'example.com@evil.invalid', '127.0.0.1', 'localhost', 'example.com.', 'example..com', 'EXAMPLE.com', 'example.com?x=1']) {
    assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'letbuyy.store', connectedHost: base }), null, base);
  }
  for (const host of ['checkout.snaz.letbuyy.store.evil.invalid', 'checkout.other.snaz.letbuyy.store', 'snaz.letbuyy.store', 'checkout.letbuyy.store']) {
    assert.equal(platformCheckoutStoreHandle(host, 'letbuyy.store'), null, host);
  }
  assert.equal(buildStoreCheckoutHostname({ subdomain: 'snaz', storeRootDomain: 'letbuyy.store', connectedHost: Array(5).fill('x'.repeat(60)).join('.') }), null);
});
