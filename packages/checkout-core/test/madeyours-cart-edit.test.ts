import assert from 'node:assert/strict';
import test from 'node:test';
import { StorefrontConfiguredLineEditRequestSchema, StorefrontConfiguredLineEditSchema, configuredLineEditInputs } from '../src/index';

const product = '7b669c70-9000-4000-8000-000000000001', variant = '7b669c70-9100-4000-8000-000000000001';
const draft = { method_id: 'engrave', style_id: 'sans', placement_id: 'front', text: 'Asha', facts_revision: 2, review_fingerprint: 'a'.repeat(64) };
const line = { id: `${product}:${variant}:${'b'.repeat(64)}`, product_id: product, variant_id: variant, quantity: 3, properties: { Cover: 'Moss' }, personalization: draft };
const edit = { operation_key: '7b669c70-9200-4000-8000-000000000001', line_id: line.id, expected_updated_at: '2026-10-24T11:31:00.123456+00:00', replacement: { variant_id: variant, personalization: { ...draft, text: 'Asha-Rae' } } };
test('configured edit accepts actual composite line identity and retains raw microseconds', () => {
  const parsed = StorefrontConfiguredLineEditRequestSchema.parse({ line_edit: edit });
  assert.equal(parsed.line_edit.expected_updated_at, edit.expected_updated_at); assert.equal(parsed.line_edit.line_id, line.id);
  assert.equal(typeof configuredLineEditInputs, 'function', 'actual private checkout-core export is loaded');
});
test('strict command refuses client product, price, quantity, snapshot and extra whole-cart input', () => {
  for (const field of ['product_id', 'unit_price', 'quantity', 'niche_snapshot']) {
    assert.equal(StorefrontConfiguredLineEditSchema.safeParse({ ...edit, replacement: { ...edit.replacement, [field]: 123 } }).success, false);
  }
  assert.equal(StorefrontConfiguredLineEditRequestSchema.safeParse({ line_edit: edit, lines: [] }).success, false);
  assert.equal(StorefrontConfiguredLineEditSchema.safeParse({ ...edit, expected_updated_at: '2026-10-24' }).success, false);
});
test('one replacement preserves the actual product, quantity and unrelated configuration inputs', () => {
  const kabir = { ...line, id: `${product}:${variant}:${'c'.repeat(64)}`, quantity: 1, personalization: { ...draft, text: 'Kabir' } };
  const before = structuredClone([line, kabir]); const result = configuredLineEditInputs(before, StorefrontConfiguredLineEditSchema.parse(edit));
  assert.ok(result); assert.equal(result[0].product_id, product); assert.equal(result[0].quantity, 3); assert.equal(result[0].personalization?.text, 'Asha-Rae');
  assert.deepEqual(result[1], { product_id: kabir.product_id, variant_id: kabir.variant_id, quantity: 1, properties: kabir.properties, personalization: kabir.personalization });
  assert.deepEqual(before, [line, kabir], 'source accepted cart is never mutated');
});
test('missing, ambiguous and unconfigured identities refuse without guessing by product or index', () => {
  assert.equal(configuredLineEditInputs([line], { ...edit, line_id: 'foreign-line' }), null);
  assert.equal(configuredLineEditInputs([line, line], edit), null);
  assert.equal(configuredLineEditInputs([{ ...line, personalization: undefined }], edit), null);
});
