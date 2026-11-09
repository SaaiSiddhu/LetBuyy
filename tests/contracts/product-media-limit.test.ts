import assert from 'node:assert/strict';
import test from 'node:test';
import {CreateProductSchema, UpdateProductSchema, PRODUCT_IMAGE_LIMIT} from '@letbuyy/commerce-core';

const images = (count: number) => Array.from({length: count}, (_, i) => `https://synthetic.invalid/product-${i}.png`);

test('canonical product creation accepts20images and rejects21 before execution', () => {
    const input = {store_id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic media contract', price: 100};
    assert.equal(PRODUCT_IMAGE_LIMIT, 20);
    assert.equal(CreateProductSchema.safeParse({...input, images: images(20)}).success, true);
    assert.equal(CreateProductSchema.safeParse({...input, images: images(21)}).success, false);
});

test('canonical product updates accept deliberate reduction to20 and reject21', () => {
    const command = {version: 1, idempotency_key: '22222222-2222-4222-8222-222222222222'};
    assert.equal(UpdateProductSchema.safeParse({...command, images: images(20)}).success, true);
    assert.equal(UpdateProductSchema.safeParse({...command, images: images(21)}).success, false);
});
