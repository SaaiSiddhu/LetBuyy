import assert from 'node:assert/strict';
import test from 'node:test';
import { getWishlistIdentityMode } from './wishlist-identity';

test('canonical buyer identity takes precedence when the legacy store session also exists', () => {
    assert.equal(getWishlistIdentityMode(true, true), 'buyer');
});

test('legacy store-customer identity remains available without a buyer session', () => {
    assert.equal(getWishlistIdentityMode(false, true), 'store_customer');
});

test('signed-out visitors use only the guest wishlist', () => {
    assert.equal(getWishlistIdentityMode(false, false), 'guest');
});
