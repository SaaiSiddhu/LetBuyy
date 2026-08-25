// T6/W1 — the `checkout` subdomain (and its staging variant) must never be registrable or
// resolvable as a merchant storefront. checkout.<root> is a hosted, signed-handoff-only origin
// (see services/api-gateway/src/routes/storefront/cart-routes.ts and CHECKOUT_ORIGIN in
// services/api-gateway/wrangler.toml); a merchant-controlled `checkout` subdomain would let a
// merchant sign cart handoffs to a hostname they control.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESERVED_STOREFRONT_LABELS,
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
