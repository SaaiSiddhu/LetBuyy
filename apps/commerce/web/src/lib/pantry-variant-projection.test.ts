import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPublicProductVariants } from './product-variants';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const food = { netQuantity: { value: 250, unit: 'g' } };

test('public variant adapter retains durable IDs and validates food while dropping private metadata', () => {
  const result = mapPublicProductVariants({ product_options: [{ name: 'Finish', position: 1, values: ['Plain'] }, { name: 'Pack', position: 0, values: ['250 g'] }] },
    [{ id: first, title: '250 g / Plain', option1: '250 g', option2: 'Plain', metadata: { food, supplierSecret: 'PRIVATE' } }]);
  assert.equal(result.variants![0].id, first);
  assert.deepEqual(result.variants![0].options, { Pack: '250 g', Finish: 'Plain' });
  assert.deepEqual(result.variants![0].food, food);
  assert.deepEqual(result.variants![0].metadata, { food });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|supplierSecret/);
});

test('missing or malformed variant facts remain absent and do not borrow another variant quantity', () => {
  const result = mapPublicProductVariants({}, [
    { id: first, title: 'Known pack', option1: '250 g', metadata: { food } },
    { id: second, title: 'Unknown pack', option1: 'Not supplied', metadata: { food: { netQuantity: { value: 0, unit: 'g' } } } },
  ]);
  assert.deepEqual(result.variants![0].food, food);
  assert.equal(result.variants![1].food, undefined);
  assert.equal(result.variants![1].metadata, undefined);
  assert.deepEqual(result.variantOptions, [{ name: 'Option 1', values: ['250 g', 'Not supplied'] }]);
});
