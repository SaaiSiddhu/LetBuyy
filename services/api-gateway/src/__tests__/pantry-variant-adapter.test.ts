import assert from 'node:assert/strict';
import test from 'node:test';
import { executeProductCreate, executeProductMutation } from '../execution/product-mutation.adapter';
import { AppError, ValidationError } from '../lib/errors';

const store = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';

test('product create refuses malformed inline facts before attempting a transaction', async () => {
  await assert.rejects(executeProductCreate(undefined, { store_id: store, name: 'Synthetic lentils', price: 180,
    variants: [{ title: 'Invalid pack', metadata: { food: { netQuantity: { value: 0, unit: 'g' } } } }] }, actor),
    error => error instanceof ValidationError && error.statusCode === 400);
});

test('valid create and edit fail closed when a real tenant SQL transaction is unavailable', async () => {
  const food = { netQuantity: { value: 250, unit: 'g' as const } };
  const unavailable = (error: unknown) => error instanceof AppError && error.statusCode === 503 && error.code === 'PRODUCT_EDIT_UNAVAILABLE';
  await assert.rejects(executeProductCreate(undefined, { store_id: store, name: 'Synthetic lentils', price: 180, variants: [{ title: '250 g', metadata: { food } }] }, actor), unavailable);
  await assert.rejects(executeProductMutation(undefined, store, crypto.randomUUID(), actor, {
    version: 7, idempotency_key: crypto.randomUUID(), variants: [{ title: '250 g', metadata: { food } }],
  }, 'synthetic-request'), unavailable);
});
