import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateProductSchema, UpdateProductSchema, planProductCreate, planProductMutation, ProductVariantMetadataSchema } from '../src/index';

const site = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const food = { netQuantity: { value: 250, unit: 'g' } };

test('canonical create command and plan retain validated inline variant metadata before server UUID allocation', () => {
  const input = { store_id: site, name: 'Synthetic lentils', price: 180,
    variants: [{ title: '250 g', options: { Pack: '250 g' }, metadata: { food } }] };
  const parsed = CreateProductSchema.parse(input);
  assert.deepEqual(parsed.variants[0].metadata, { food });
  assert.deepEqual(planProductCreate(input).productVariants[0].metadata, { food });
  assert.equal('id' in parsed.variants[0], false);
  assert.throws(() => planProductCreate({ ...input, variants: [{ title: 'bad', metadata: { food: { netQuantity: { value: -1, unit: 'g' } } } }] }));
});

test('edit intent attaches facts to durable UUID across editable SKU and option changes', () => {
  const plan = planProductMutation({ version: 9, idempotency_key: key,
    variants: [{ id, title: 'New pack name', sku: 'NEW-EDITABLE-SKU', options: { Pack: 'Changed label' }, metadata: { food } }] });
  assert.deepEqual(plan.mutation.variants, [{ id, title: 'New pack name', sku: 'NEW-EDITABLE-SKU', options: { Pack: 'Changed label' }, metadata: { food } }]);
  assert.equal(plan.expectedVersion, 9);
  assert.equal(plan.idempotencyKey, key);
  assert.equal('stock' in plan.mutation.variants![0], false);
});

test('omitted variant envelope preserves intent; empty envelope and explicit namespace null are distinct valid clears', () => {
  const edit = (metadata?: unknown) => UpdateProductSchema.parse({ version: 9, idempotency_key: key,
    variants: [{ id, title: 'Pack', ...(metadata !== undefined ? { metadata } : {}) }] }).variants![0];
  assert.equal('metadata' in edit(), false);
  assert.deepEqual(edit({}).metadata, {});
  assert.deepEqual(edit({ food: null }).metadata, { food: null });
  for (const metadata of [null, [], { food: { netQuantity: { value: 0, unit: 'g' } } }, { food: { variantId: id } }, { privateSupplier: 'PRIVATE' }, { beauty: {} }]) {
    assert.equal(ProductVariantMetadataSchema.safeParse(metadata).success, false, JSON.stringify(metadata));
  }
});

test('supplied gift roles refer to actual supplied images and beauty shades to their named option', () => {
  const base = { store_id: site, name: 'Synthetic gift', price: 100, images: ['https://example.invalid/open.webp'] };
  assert.equal(CreateProductSchema.safeParse({ ...base, metadata: { gifts: { mediaRoles: { openBox: 0 } } } }).success, true);
  assert.equal(CreateProductSchema.safeParse({ ...base, metadata: { gifts: { mediaRoles: { openBox: 1 } } } }).success, false);
  assert.equal(UpdateProductSchema.safeParse({ version: 9, idempotency_key: key, images: [], metadata: { gifts: { mediaRoles: { openBox: 0 } } } }).success, false);
  const beauty = { shadeOptionName: 'Shade', shades: [{ value: 'Clay', color: '#8c6050' }] };
  assert.equal(CreateProductSchema.safeParse({ ...base, metadata: { beauty }, product_options: [{ name: 'Shade', values: ['Clay'] }] }).success, true);
  for (const product_options of [[], [{ name: 'Colour', values: ['Clay'] }], [{ name: 'Shade', values: ['Sand'] }]]) {
    assert.equal(CreateProductSchema.safeParse({ ...base, metadata: { beauty }, product_options }).success, false);
  }
  // Metadata-only / image-only edits need the locked effective state in the SQL
  // writer. The stateless command must not invent an existing image or option.
  assert.equal(UpdateProductSchema.safeParse({ version: 9, idempotency_key: key, metadata: { gifts: { mediaRoles: { openBox: 0 } } } }).success, true);
});
