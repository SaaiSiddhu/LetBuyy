import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateShippingRateSchema, UpdateShippingZoneSchema, UpdateShippingRateSchema, UpdateTaxRateSchema,
  planShippingServiceability, planTaxRateCreate, serializeMerchantTaxRate, shippingRateRangeError, parseShippingHandlingFeeMinor } from '../src/index.ts';

test('handling charges preserve exact paise and refuse blank, rounded or out-of-range input', () => {
  for (const [input, minor] of [['0',0],['0.1',10],['1.01',101],['19.90',1990],['1000000',100000000]] as const) {
    assert.equal(parseShippingHandlingFeeMinor(input),minor);
  }
  for (const input of ['', ' ', '1.005', '-1', '1e3', '01', '1000000.01', 'NaN', 'Infinity']) {
    assert.equal(parseShippingHandlingFeeMinor(input),null);
  }
});

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

test('rate ranges reject reversed values while preserving valid zero-day delivery and partial edits', () => {
  const base = { zone_id: '97e27542-391a-4333-ae03-e234f330eb25', name: 'Synthetic delivery', type: 'weight_based', price: 20 };
  for (const bounds of [
    { min_weight_grams: 500, max_weight_grams: 100 },
    { min_order_amount: 100, max_order_amount: 50 },
    { estimated_days_min: 3, estimated_days_max: 0 },
  ]) {
    assert.equal(CreateShippingRateSchema.safeParse({ ...base, ...bounds }).success, false);
    assert.equal(UpdateShippingRateSchema.safeParse(bounds).success, false);
  }
  assert.equal(CreateShippingRateSchema.safeParse({ ...base, estimated_days_min: 0, estimated_days_max: 0 }).success, true);
  assert.ok(shippingRateRangeError({ min_order_amount: 500, max_order_amount: 300 }), 'merged saved values are checked too');
  assert.equal(shippingRateRangeError({ min_order_amount: null, max_order_amount: 0 }), null);
});

test('merchant percentage contract persists once and serviceability preserves same-day ETA', () => {
  const plan = planTaxRateCreate({ store_id: '97e27542-391a-4333-ae03-e234f330eb25', name: 'Synthetic GST', rate: 18,
    country: 'IN', applies_to: 'products', is_compound: false, is_shipping: false, priority: 0, is_active: true });
  assert.equal(plan.taxRateInsert.rate, 0.18);
  assert.equal(serializeMerchantTaxRate(plan.taxRateInsert).rate, 18);
  const result = planShippingServiceability({ store_id: '97e27542-391a-4333-ae03-e234f330eb25', pincode: '560001', cod: false,
    order_amount_minor: 1000, weight_grams: 500 }, [{ provider: 'shiprocket', pincode: '560001', serviceable: true,
      cod_available: true, estimated_days_min: 0, estimated_days_max: 0 }]);
  assert.equal(result.estimated_days_min, 0); assert.equal(result.estimated_days_max, 0);
});
