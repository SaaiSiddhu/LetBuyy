import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWishlistProductState } from './wishlist-state';

test('confirmed wishlist additions preserve other concurrent product updates and avoid duplicates', () => {
    assert.deepEqual(applyWishlistProductState(['a', 'b'], 'c', true), ['a', 'b', 'c']);
    assert.deepEqual(applyWishlistProductState(['a', 'b'], 'b', true), ['a', 'b']);
});

test('confirmed wishlist removals affect only the requested product', () => {
    assert.deepEqual(applyWishlistProductState(['a', 'b', 'c'], 'b', false), ['a', 'c']);
    assert.deepEqual(applyWishlistProductState(['a', 'c'], 'b', false), ['a', 'c']);
});
