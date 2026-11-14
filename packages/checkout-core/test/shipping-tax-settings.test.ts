import assert from 'node:assert/strict';
import test from 'node:test';
import { UpdateShippingZoneSchema, UpdateShippingRateSchema, UpdateTaxRateSchema } from '../src/index.ts';

test('partial settings patches preserve omission, explicit clearing and false/zero values', () => {
  assert.deepEqual(UpdateShippingRateSchema.parse({ price: 0 }), { price: 0 });
  assert.deepEqual(UpdateTaxRateSchema.parse({ state: null }), { state: null });
  assert.deepEqual(UpdateShippingRateSchema.parse({ estimated_days_min: 0, is_active: false }), { estimated_days_min: 0, is_active: false });
  assert.deepEqual(UpdateShippingZoneSchema.parse({ zip_codes: [] }), { zip_codes: [] });
  for (const schema of [UpdateShippingRateSchema, UpdateTaxRateSchema, UpdateShippingZoneSchema]) {
    assert.equal(schema.safeParse({}).success, false);
    assert.equal(schema.safeParse({ store_id: 'cannot-move-tenant' }).success, false);
  }
  assert.equal(UpdateShippingRateSchema.safeParse({ price: -1 }).success, false);
  assert.equal(UpdateShippingRateSchema.safeParse({ min_weight_grams: '100' }).success, false);
  assert.equal(UpdateTaxRateSchema.safeParse({ rate: -1 }).success, false);
});
