import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { canonicalCheckoutHandoffPayload } from '../src/index';
const input = { siteId:'11111111-1111-4111-8111-111111111111', cartId:'22222222-2222-4222-8222-222222222222',
  cartToken:'ct_synthetic_checkout_capability', channel:'web', expiresAt:'2026-10-27T18:10:00.000Z',
  couponCodes:[], lines:[], cartContentDigest:'a'.repeat(64) };
const signature = (value:string) => createHmac('sha256','synthetic-owned-origin-test-key').update(value).digest('hex');

test('keeps the existing central-origin version1 wire bytes for finite in-flight drain', () => {
  assert.equal(canonicalCheckoutHandoffPayload(input), JSON.stringify({version:1,site_id:input.siteId,cart_id:input.cartId,
    cart_token:input.cartToken,channel:'web',expires_at:input.expiresAt,cart_content_digest:input.cartContentDigest}));
});

test('a branded handoff signature cannot move to another checkout origin or site', () => {
  const first = canonicalCheckoutHandoffPayload({...input,checkoutOrigin:'https://checkout.snaz.letbuyy.store'});
  assert.equal(JSON.parse(first).version,2);
  assert.equal(JSON.parse(first).checkout_origin,'https://checkout.snaz.letbuyy.store');
  for (const change of [{checkoutOrigin:'https://checkout.other.letbuyy.store'},
    {checkoutOrigin:'https://checkout.snaz.example.com'},
    {checkoutOrigin:'https://checkout.snaz.letbuyy.store',siteId:'33333333-3333-4333-8333-333333333333'}]) {
    assert.notEqual(signature(canonicalCheckoutHandoffPayload({...input,...change})),signature(first));
  }
  assert.notEqual(signature(canonicalCheckoutHandoffPayload(input)),signature(first),'removing origin cannot downgrade its signature');
});

test('rejects noncanonical, insecure and credential/path/query checkout origins', () => {
  for (const checkoutOrigin of ['http://checkout.snaz.letbuyy.store','https://checkout.snaz.letbuyy.store/',
    'https://checkout.snaz.letbuyy.store/path','https://checkout.snaz.letbuyy.store?x=1',
    'https://checkout.snaz.letbuyy.store#x','https://user:password@checkout.snaz.letbuyy.store','https://CHECKOUT.snaz.letbuyy.store']) {
    assert.throws(()=>canonicalCheckoutHandoffPayload({...input,checkoutOrigin}),undefined,checkoutOrigin);
  }
  assert.equal(JSON.parse(canonicalCheckoutHandoffPayload({...input,checkoutOrigin:'http://checkout.localhost:4321'})).version,2);
});
