import { DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types';
// T6/W1 — the `checkout` subdomain (and its staging variant) must never be registrable or
// resolvable as a merchant storefront. checkout.<root> is a hosted, signed-handoff-only origin
// (see services/api-gateway/src/routes/storefront/cart-routes.ts and CHECKOUT_ORIGIN in
// services/api-gateway/wrangler.toml); a merchant-controlled `checkout` subdomain would let a
// merchant sign cart handoffs to a hostname they control.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESERVED_STOREFRONT_LABELS,
  normalizeStoreRootDomain,
  buildTenantStorefrontUrl,
  isHostedCheckoutHost,
  RESERVED_SUBDOMAINS,
  SubdomainSchema,
  isReservedStorefrontLabel,
  isReservedSubdomain,
  resolveStorefrontHost,
  validateSubdomainFormat,
} from '../src/index';

test('T6/W1: checkout and checkout-staging are reserved storefront labels', () => {
  assert.ok(RESERVED_STOREFRONT_LABELS.includes('checkout'));
  assert.ok(RESERVED_STOREFRONT_LABELS.includes('checkout-staging'));
  assert.ok(RESERVED_SUBDOMAINS.includes('checkout'));
  assert.ok(RESERVED_SUBDOMAINS.includes('checkout-staging'));
  assert.equal(isReservedStorefrontLabel('checkout'), true);
  assert.equal(isReservedStorefrontLabel('CHECKOUT'), true);
  assert.equal(isReservedSubdomain('checkout'), true);
  assert.equal(isReservedSubdomain('checkout-staging'), true);
});

test('T6/W1: checkout.<root> resolves as reserved host, not a storefront subdomain', () => {
  const resolution = resolveStorefrontHost('checkout.letbuyy.com', 'letbuyy.com');
  assert.equal(resolution.kind, 'reserved');
});

test('T6/W1: checkout-staging.<root> resolves as reserved host too', () => {
  const resolution = resolveStorefrontHost('checkout-staging.letbuyy.com', 'letbuyy.com');
  assert.equal(resolution.kind, 'reserved');
});

test('T6/W1: a real merchant subdomain still resolves normally (no over-reservation)', () => {
  const resolution = resolveStorefrontHost('snaz.letbuyy.com', 'letbuyy.com');
  assert.equal(resolution.kind, 'subdomain');
  assert.equal((resolution as { subdomain: string }).subdomain, 'snaz');
});

test('T6/W1: CreateStoreSchema-equivalent SubdomainSchema rejects "checkout"', () => {
  const result = SubdomainSchema.safeParse('checkout');
  assert.equal(result.success, false);
});

test('T6/W1: SubdomainSchema rejects "checkout-staging"', () => {
  const result = SubdomainSchema.safeParse('checkout-staging');
  assert.equal(result.success, false);
});

test('T6/W1: validateSubdomainFormat reports "checkout" as reserved, not merely invalid', () => {
  const result = validateSubdomainFormat('checkout');
  assert.equal(result.valid, false);
  assert.equal((result as { reason: string }).reason, 'reserved');
});

test('platform checkout and default tenant roots are independent', () => {
  assert.equal(normalizeStoreRootDomain(undefined), DEFAULT_STOREFRONT_DOMAIN);
  assert.equal(buildTenantStorefrontUrl('native-shop'), `https://native-shop.${DEFAULT_STOREFRONT_DOMAIN}`);
  assert.equal(resolveStorefrontHost(`native-shop.${DEFAULT_STOREFRONT_DOMAIN}`, undefined).kind, 'subdomain');
  assert.equal(resolveStorefrontHost(`accounts.${DEFAULT_STOREFRONT_DOMAIN}`, undefined).kind, 'reserved');
  assert.equal(isHostedCheckoutHost('checkout.letbuyy.com'), true);
  assert.equal(isHostedCheckoutHost(`checkout.${DEFAULT_STOREFRONT_DOMAIN}`), false);
  assert.equal(isHostedCheckoutHost('evilcheckout.letbuyy.com'), false);
  assert.equal(isHostedCheckoutHost('checkout.letbuyy.com.evil.test'), false);
});
test('explicit checkout and loopback host contracts fail closed', () => {
  const local={checkoutOrigin:'https://checkout.localhost:4443'};
  assert.equal(isHostedCheckoutHost('checkout.localhost:4443',local),true);
  assert.equal(isHostedCheckoutHost('checkout.letbuyy.com',local),false);
  assert.equal(isHostedCheckoutHost('checkout.localhost',{storeRootDomain:'localhost'}),true);
  assert.equal(isHostedCheckoutHost('checkout.localhost'),false);
  for(const origin of ['not a URL','https://user:pass@checkout.localhost','https://checkout.localhost/path','https://checkout.localhost?next=bad','http://checkout.example.test'])assert.equal(isHostedCheckoutHost('checkout.localhost',{checkoutOrigin:origin}),false);
});
test('canonical tenant URLs preserve TLS apex ports and scoped local path origins', () => {
  assert.equal(buildTenantStorefrontUrl('native-shop',{baseUrl:`https://${DEFAULT_STOREFRONT_DOMAIN}:4443`}),`https://native-shop.${DEFAULT_STOREFRONT_DOMAIN}:4443`);
  assert.equal(buildTenantStorefrontUrl('native-shop',{baseUrl:'http://localhost:3003'}),'http://localhost:3003/store/native-shop');
  assert.equal(buildTenantStorefrontUrl('native-shop',{rootDomain:'stores.example.test'}),'https://native-shop.stores.example.test');
  for(const slug of ['accounts','one/two','a.b','../escape'])assert.throws(()=>buildTenantStorefrontUrl(slug));
  for(const url of ['javascript:alert(1)','https://user:pass@localhost','https://localhost?token=bad'])assert.throws(()=>buildTenantStorefrontUrl('native-shop',{baseUrl:url}));
});

test('account inbox is a reserved merchant route',()=>assert.ok(RESERVED_SUBDOMAINS.includes('inbox')));
