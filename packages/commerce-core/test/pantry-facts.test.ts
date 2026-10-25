import assert from 'node:assert/strict';
import test from 'node:test';
import { FoodFactsSchema, FoodVariantFactsSchema, FoodNetQuantitySchema, readFoodFacts, deriveFoodUnitPrice, foodPackSummary } from '../src/pantry-facts';

test('food facts keep absent ingredients/allergens explicitly unknown and exclude unrelated metadata', () => {
  assert.deepEqual(FoodFactsSchema.parse({}), { ingredients: null, allergens: { status: 'not_supplied' }, storage: null, preparation: null, nutritionText: null, netQuantity: null });
  assert.equal(readFoodFacts({ internalSupplier: 'PRIVATE' }), null);
  assert.equal(readFoodFacts(null), null);
  assert.equal(readFoodFacts([]), null);
  assert.equal(readFoodFacts(Object.create({ food: {} })), null);
  assert.deepEqual(readFoodFacts({ food: { ingredients: ' Lentils (100%). ' }, internalSupplier: 'PRIVATE' })?.ingredients, 'Lentils (100%).');
  assert.doesNotMatch(JSON.stringify(readFoodFacts({ food: {}, cost: 99, private: 'PRIVATE' })), /PRIVATE|cost/);
});
test('allergen supplied statement needs bounded source and never infers an allergen-free claim', () => {
  const facts = { allergens: { status: 'supplied', statement: 'Contains sesame.', source: 'Merchant package label.' } };
  assert.equal(FoodFactsSchema.parse(facts).allergens.status, 'supplied');
  for (const allergens of [{ status: 'supplied', statement: 'Contains soy.' }, { status: 'not_supplied', statement: 'Free from everything' }, { status: 'allergen_free' }, { status: 'supplied', statement: '', source: 'Label' }]) assert.equal(FoodFactsSchema.safeParse({ allergens }).success, false);
});
test('unknown keys, oversized facts and invalid net contents fail closed', () => {
  for (const value of [{ ingredients: 'x'.repeat(6001) }, { ingredients: '' }, { isOrganic: true }, { unitPrice: 72 }, { netQuantity: { value: 0, unit: 'g' } }, { netQuantity: { value: 0.25, unit: 'kg' } }]) assert.equal(FoodFactsSchema.safeParse(value).success, false);
  assert.equal(readFoodFacts({ food: { supplierSecret: 'PRIVATE' } }), null);
  assert.equal(FoodNetQuantitySchema.safeParse({ value: 250, unit: 'g', shippingWeight: 1 }).success, false);
});
test('inline variant quantity can be validated before a durable variant UUID is allocated', () => {
  assert.deepEqual(FoodVariantFactsSchema.parse({ netQuantity: { value: 250, unit: 'g' } }), { netQuantity: { value: 250, unit: 'g' } });
  assert.equal(FoodVariantFactsSchema.safeParse({ variantId: 'unborn', netQuantity: { value: 250, unit: 'g' } }).success, false);
});
test('authoritative paise and explicit contents derive comparable unit value with integer rounding', () => {
  assert.deepEqual(deriveFoodUnitPrice(18000, { value: 250, unit: 'g' }), { amountMinor: 7200, basisQuantity: 100, unit: 'g' });
  assert.deepEqual(deriveFoodUnitPrice(22000, { value: 1000, unit: 'g' }), { amountMinor: 2200, basisQuantity: 100, unit: 'g' });
  assert.deepEqual(deriveFoodUnitPrice(1, { value: 200, unit: 'ml' }), { amountMinor: 1, basisQuantity: 100, unit: 'ml' });
  assert.equal(deriveFoodUnitPrice(180.5, { value: 250, unit: 'g' }), null);
  assert.equal(deriveFoodUnitPrice(18000, null), null);
  assert.equal(deriveFoodUnitPrice(-1, { value: 250, unit: 'g' }), null);
  assert.equal(deriveFoodUnitPrice(Number.MAX_SAFE_INTEGER, { value: 1, unit: 'g' }), null);
});
test('two 250g sellable packs retain count and 500g contents without mixing mass and volume', () => {
  assert.deepEqual(foodPackSummary(2, { value: 250, unit: 'g' }), { packCount: 2, totalNetQuantity: { value: 500, unit: 'g' } });
  assert.deepEqual(foodPackSummary(2, { value: 250, unit: 'ml' })?.totalNetQuantity, { value: 500, unit: 'ml' });
  assert.equal(foodPackSummary(0, { value: 250, unit: 'g' }), null);
  assert.equal(foodPackSummary(2, { value: 250, unit: 'shipping-kg' }), null);
});
