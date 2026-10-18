import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateProductSchema, UpdateProductSchema } from '../src/index.ts';

const STORE_ID = '22222222-2222-4222-8222-222222222222';

test('product create and update contracts trim country of origin and preserve its 100-character bound', () => {
  const created = CreateProductSchema.parse({
    store_id: STORE_ID,
    name: 'Imported goods',
    price: 499,
    country_of_origin: '  Japan  ',
  });
  assert.equal(created.country_of_origin, 'Japan');

  const updated = UpdateProductSchema.parse({ country_of_origin: '  India  ' });
  assert.equal(updated.country_of_origin, 'India');

  assert.equal(CreateProductSchema.safeParse({
    store_id: STORE_ID,
    name: 'Imported goods',
    price: 499,
    country_of_origin: 'x'.repeat(101),
  }).success, false);
  assert.equal(UpdateProductSchema.safeParse({ country_of_origin: 'x'.repeat(101) }).success, false);
});
