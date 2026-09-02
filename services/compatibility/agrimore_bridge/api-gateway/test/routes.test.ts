import assert from 'node:assert/strict';
import test from 'node:test';

import { findRoutePolicy, routePolicies } from '../src/routes';

test('findRoutePolicy matches dynamic command routes', () => {
  const match = findRoutePolicy('POST', '/v1/orders/2d3/cancel');

  assert.equal(match?.policy.path, '/v1/orders/:id/cancel');
  assert.equal(match?.params.id, '2d3');
  assert.equal(match?.policy.requiresIdempotency, true);
  assert.equal(match?.policy.cache.mode, 'none');
});

test('public catalog route is cacheable and anonymous', () => {
  const match = findRoutePolicy('GET', '/v1/catalog/categories');

  assert.equal(match?.policy.auth, 'none');
  assert.equal(match?.policy.cache.mode, 'public');
});

test('operations dispatch command is admin scoped and idempotent', () => {
  const match = findRoutePolicy('POST', '/v1/ops/dispatch/control');

  assert.equal(match?.policy.owner, 'admin');
  assert.equal(match?.policy.auth, 'admin');
  assert.equal(match?.policy.requiresIdempotency, true);
  assert.equal(match?.policy.cache.mode, 'none');
});

test('seller portal reads are private seller-owned routes', () => {
  const profile = findRoutePolicy('GET', '/v1/seller/profile');
  const products = findRoutePolicy('GET', '/v1/seller/catalog/products');

  assert.equal(profile?.policy.owner, 'seller');
  assert.equal(profile?.policy.auth, 'user');
  assert.equal(profile?.policy.cache.mode, 'private');
  assert.equal(products?.policy.owner, 'seller');
});

test('seller catalog commands and admin approvals are idempotent', () => {
  const createProduct = findRoutePolicy('POST', '/v1/seller/catalog/products');
  const updateProduct = findRoutePolicy('PATCH', '/v1/seller/catalog/products/product-1');
  const approveSeller = findRoutePolicy('POST', '/v1/admin/sellers/seller-1/approve');

  assert.equal(createProduct?.policy.owner, 'seller');
  assert.equal(createProduct?.policy.requiresIdempotency, true);
  assert.equal(updateProduct?.policy.owner, 'seller');
  assert.equal(updateProduct?.policy.requiresIdempotency, true);
  assert.equal(approveSeller?.policy.owner, 'admin');
  assert.equal(approveSeller?.policy.auth, 'admin');
  assert.equal(approveSeller?.policy.requiresIdempotency, true);
});

test('store queue route is private and never public cached', () => {
  const match = findRoutePolicy('GET', '/v1/store/queue');

  assert.equal(match?.policy.owner, 'store_ops');
  assert.equal(match?.policy.auth, 'user');
  assert.equal(match?.policy.cache.mode, 'private');
});

test('all mutating cart routes require idempotency', () => {
  const deleteItem = findRoutePolicy('DELETE', '/v1/cart/items/product-1');
  const clearCart = findRoutePolicy('DELETE', '/v1/cart');

  assert.equal(deleteItem?.policy.requiresIdempotency, true);
  assert.equal(clearCart?.policy.requiresIdempotency, true);
});

test('all non-webhook mutating routes require idempotency', () => {
  const mutating = routePolicies.filter((policy) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(policy.method) && policy.auth !== 'webhook'
  );

  assert.equal(mutating.length > 0, true);
  for (const policy of mutating) {
    assert.equal(policy.requiresIdempotency, true, `${policy.method} ${policy.path}`);
  }
});
