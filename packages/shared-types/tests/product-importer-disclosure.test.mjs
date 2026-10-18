import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductSchema } from '../src/index.ts';

const PRODUCT = {
  id: '11111111-1111-4111-8111-111111111111',
  store_id: '22222222-2222-4222-8222-222222222222',
  name: 'Imported Goods',
  slug: 'imported-goods',
  price: 499,
  created_at: '2026-10-04T00:00:00.000Z',
  updated_at: '2026-10-04T00:00:00.000Z',
};

test('canonical product projection preserves an optional, trimmed importer disclosure', () => {
  const parsed = ProductSchema.parse({
    ...PRODUCT,
    country_of_origin: '  Japan  ',
    importer_details: ' Example Imports, Mumbai ',
  });

  assert.equal(parsed.country_of_origin, 'Japan');
  assert.equal(parsed.importer_details, 'Example Imports, Mumbai');
  assert.equal(ProductSchema.parse({ ...PRODUCT, importer_details: null }).importer_details, null);
  assert.equal('importer_details' in ProductSchema.parse(PRODUCT), false);
});

test('canonical product projection enforces the shared 1,000-character disclosure bound', () => {
  assert.equal(ProductSchema.safeParse({ ...PRODUCT, importer_details: 'x'.repeat(1000) }).success, true);
  assert.equal(ProductSchema.safeParse({ ...PRODUCT, importer_details: 'x'.repeat(1001) }).success, false);
});
