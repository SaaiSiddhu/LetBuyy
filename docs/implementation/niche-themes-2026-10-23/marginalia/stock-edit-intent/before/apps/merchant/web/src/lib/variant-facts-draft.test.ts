import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductVariantMetadataSchema, VARIANT_NICHE_FACT_SCHEMAS } from '@letbuyy/commerce-core';
import { isVariantFactsNamespace, readVariantFactsDraft, updateVariantFactsDraft, validateVariantFactsDraft, VARIANT_FACT_NAMESPACES } from './variant-facts-draft';
import { editVariantFacts, hydrateVariantFacts, rebaseVariantFacts, variantFactsBaselineKnown, variantFactsCommand, variantFactsValue } from './variant-facts-draft';
import { appendVariantOptionValue, buildProductFormFields, buildVariantMatrix, defaultProductSnapshot, normalizeApiVariants, readUnsavedProduct, restoreProductEdit, type VariantRow } from './product-form-state';

test('raw variant drafts keep partial invalid fields and contain no product defaults', () => {
  const input = { food: { netQuantity: { value: '', unit: 'g' } }, toys: { finish: 'Blue' } };
  const baseline = structuredClone(input), read = readVariantFactsDraft(input);
  assert.deepEqual(read, input);
  assert.notEqual(read, input);
  assert.equal(validateVariantFactsDraft(read).success, false);
  const corrected = updateVariantFactsDraft(read, 'food', { netQuantity: { value: 250, unit: 'g' } });
  const accepted = validateVariantFactsDraft(corrected);
  assert.equal(accepted.success, true);
  if (!accepted.success) return;
  assert.deepEqual(accepted.data, { food: { netQuantity: { value: 250, unit: 'g' } }, toys: { finish: 'Blue' } });
  assert.deepEqual(input, baseline);
  assert.deepEqual(readVariantFactsDraft(undefined), {});
});

test('clearing one namespace preserves the rest and final removal remains explicit empty metadata', () => {
  const input = { food: { netQuantity: { value: 250, unit: 'g' } }, toys: { materials: 'Wood' } };
  const onlyToys = updateVariantFactsDraft(input, 'food', null);
  assert.deepEqual(onlyToys, { toys: { materials: 'Wood' } });
  const cleared = updateVariantFactsDraft(onlyToys, 'toys', null);
  assert.deepEqual(cleared, {});
  assert.equal(JSON.stringify({ metadata: cleared }), '{"metadata":{}}');
  assert.deepEqual(ProductVariantMetadataSchema.parse(cleared), {});
  assert.deepEqual(input.food, { netQuantity: { value: 250, unit: 'g' } });
});

test('explicit inherit/clear markers remain exact through updates and canonical variant validation', () => {
  const markers = { ageBands: [], contents: [], contentsComplete: false, dimensions: null, additionalDimensions: [], materials: '', warnings: [] };
  const input = { toys: markers, food: null };
  const next = updateVariantFactsDraft(input, 'books', { kind: 'book', language: 'Hindi', format: 'paperback' });
  assert.deepEqual(next.toys, markers);
  assert.equal(next.food, null);
  const accepted = validateVariantFactsDraft(next);
  assert.equal(accepted.success, true);
  if (!accepted.success) return;
  assert.deepEqual(accepted.data.toys, markers);
  assert.equal(accepted.data.food, null);
  const omitted = updateVariantFactsDraft(next, 'toys', null);
  assert.equal(Object.hasOwn(omitted, 'toys'), false);
  assert.deepEqual(omitted.books, { kind: 'book', language: 'Hindi', format: 'paperback' });
});

test('unsupported raw fields and identities remain invalid rather than being silently discarded', () => {
  const raw = { toys: { variant_id: 'not-a-fact', finish: 'Kept' }, privateSupplier: 'Unrecognized metadata' };
  const changed = updateVariantFactsDraft(raw, 'food', { netQuantity: { value: 250, unit: 'g' } });
  assert.equal(changed.privateSupplier, 'Unrecognized metadata');
  assert.deepEqual(changed.toys, raw.toys);
  const result = validateVariantFactsDraft(changed);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error.issues.some(issue => issue.path[0] === 'toys'));
  assert.throws(() => updateVariantFactsDraft(raw, 'privateSupplier', null), /Unsupported variant facts category/);
  assert.throws(() => updateVariantFactsDraft(raw, '__proto__', {}), /Unsupported variant facts category/);
});

test('unreadable top-level drafts are never replaced by an empty object during read/update/validation', () => {
  for (const value of [null, [], 3, 'not-json', '{"toys":{}}', new Date('2026-10-23')]) {
    assert.throws(() => readVariantFactsDraft(value), /Variant facts could not be read/);
    assert.throws(() => updateVariantFactsDraft(value, 'toys', {}), /Variant facts could not be read/);
    assert.throws(() => validateVariantFactsDraft(value), /Variant facts could not be read/);
  }
});

test('own data reading does not invoke accessor fields or grant prototype keys namespace authority', () => {
  let invoked = false;
  const accessor = Object.defineProperty({}, 'toys', { get() { invoked = true; return {}; } });
  assert.throws(() => readVariantFactsDraft(accessor), /unreadable fields/);
  assert.equal(invoked, false);
  assert.throws(() => validateVariantFactsDraft(accessor), /unreadable fields/);
  assert.equal(invoked, false);
  assert.equal(isVariantFactsNamespace('constructor'), false);
  const hostile = JSON.parse('{"__proto__":{"polluted":true},"toys":{"finish":"<script>literal</script>"}}');
  const read = readVariantFactsDraft(hostile);
  assert.equal(Object.getPrototypeOf(read), Object.prototype);
  assert.equal(Object.hasOwn(read, '__proto__'), true);
  assert.equal(validateVariantFactsDraft(read).success, false);
  assert.deepEqual(read.toys, { finish: '<script>literal</script>' });
});

test('the category list derives from the public variant registry and cannot introduce other product namespaces', () => {
  assert.deepEqual([...VARIANT_FACT_NAMESPACES].sort(), Object.keys(VARIANT_NICHE_FACT_SCHEMAS).sort());
  assert.deepEqual([...VARIANT_FACT_NAMESPACES].sort(), ['books', 'food', 'furniture', 'sports', 'toys']);
  assert.equal(isVariantFactsNamespace('electronics'), false);
  assert.equal(isVariantFactsNamespace('toys'), true);
});

const rowId = '22222222-2222-4222-8222-222222222222';
const row = (): VariantRow => ({ id: rowId, title: 'M', option1: 'M', option2: null, option3: null, price: '100', comparePrice: '', sku: 'SAME', stock: '5' });

test('row intent omits unchanged and reverted facts, validates edits, and emits the final empty clear', () => {
  const baseline = { toys: { finish: 'Red' }, food: { netQuantity: { value: 250, unit: 'g' } } };
  const original = hydrateVariantFacts(row(), baseline);
  assert.deepEqual(variantFactsCommand({ ...original, sku: 'CHANGED' }), {});
  const changed = editVariantFacts(original, { toys: { finish: '' }, food: baseline.food });
  assert.equal(changed.factsMetadataEdited, true);
  assert.deepEqual(variantFactsCommand(changed), { metadata: { toys: { finish: '' }, food: baseline.food } });
  assert.deepEqual(variantFactsCommand(editVariantFacts(changed, { food: baseline.food, toys: baseline.toys })), {});
  assert.deepEqual(variantFactsCommand(editVariantFacts(original, {})), { metadata: {} });
  assert.throws(() => variantFactsCommand(editVariantFacts(original, { toys: { warnings: [{ text: 'Missing source' }] } })), /Check variant facts/);
  assert.deepEqual(original.factsMetadataBaseline, baseline);
  const invalid = hydrateVariantFacts(row(), { toys: { productType: '' } });
  assert.deepEqual(variantFactsCommand(invalid), {}, 'unmodified invalid server metadata is not rewritten');
});

test('old persisted rows keep an unknown baseline and cannot manufacture an empty override', () => {
  const old = row();
  assert.equal(variantFactsBaselineKnown(old), false);
  assert.equal(variantFactsValue(old), undefined);
  assert.deepEqual(variantFactsCommand(old), {});
  assert.throws(() => editVariantFacts(old, {}), /Review the latest product/);
  assert.throws(() => variantFactsCommand({ ...old, factsMetadataDraft: {} }), /Review the latest product/);
  assert.equal(variantFactsBaselineKnown(hydrateVariantFacts({ ...row(), id: 'label-not-uuid' }, {})), false);
  const newRow = { ...row(), id: undefined };
  assert.deepEqual(variantFactsCommand(editVariantFacts(newRow, { toys: { contents: [], dimensions: null } })), { metadata: { toys: { contents: [], dimensions: null } } });
});

test('authoritative API rows hydrate known empty or raw malformed metadata without sibling loss', () => {
  const rows = normalizeApiVariants([{ ...row(), metadata: { toys: { finish: 'Blue' } } }, { ...row(), id: '33333333-3333-4333-8333-333333333333' }, { ...row(), metadata: null }]);
  assert.deepEqual(rows[0].factsMetadataDraft, { toys: { finish: 'Blue' } });
  assert.deepEqual(rows[1].factsMetadataBaseline, {});
  assert.equal(rows[2].factsMetadataDraft, null);
  assert.deepEqual(variantFactsCommand(rows[2]), {});
  assert.deepEqual(variantFactsCommand(editVariantFacts(rows[2], {})), { metadata: {} });
});

test('late acknowledgement rebases only matching UUID baselines and retains newer raw drafts', () => {
  const a = editVariantFacts(hydrateVariantFacts(row(), { toys: { finish: 'Original' } }), { toys: { finish: '' } });
  const b = hydrateVariantFacts({ ...row(), id: '33333333-3333-4333-8333-333333333333' }, { toys: { finish: 'Sibling' } });
  const fresh = hydrateVariantFacts({ ...row(), id: undefined }, { toys: { finish: 'New row' } });
  const [rebased, sibling, newRow, oldUnknown] = rebaseVariantFacts([a, b, fresh, row()], [{ id: rowId, metadata: { toys: { finish: 'Earlier accepted' } } }, { id: 'unrelated', sku: 'SAME', title: 'M', metadata: {} }]);
  assert.equal(rebased.id, rowId); assert.deepEqual(rebased.factsMetadataDraft, a.factsMetadataDraft);
  assert.deepEqual(rebased.factsMetadataBaseline, { toys: { finish: 'Earlier accepted' } });
  assert.deepEqual(variantFactsCommand(rebased), { metadata: { toys: { finish: '' } } });
  assert.equal(sibling, b); assert.equal(newRow, fresh); assert.equal(variantFactsBaselineKnown(oldUnknown), false);
  assert.deepEqual(variantFactsCommand(editVariantFacts(rebased, { toys: { finish: 'Original' } })), { metadata: { toys: { finish: 'Original' } } });
});

test('combination changes retain the original bound matrix; only a proven value addition keeps row objects', () => {
  const options = [{ name: 'Size', values: ['M'] }], bound = editVariantFacts(hydrateVariantFacts(row(), {}), { toys: { finish: 'Red' } });
  const rows = [bound];
  assert.equal(buildVariantMatrix(options, '100', rows), rows);
  assert.throws(() => buildVariantMatrix([{ name: 'Size', values: ['L'] }], '100', rows), /combinations are kept/);
  assert.throws(() => buildVariantMatrix([], '100', rows), /combinations are kept/);
  const added = appendVariantOptionValue(options, 0, 'L', '100', rows);
  assert.equal(added[0], bound); assert.equal(added[1].id, undefined); assert.deepEqual(added[1].factsMetadataDraft, {});
  assert.throws(() => appendVariantOptionValue(options, 0, 'M', '100', rows), /distinct/);
  assert.throws(() => appendVariantOptionValue([{ name: 'Size', values: ['OTHER'] }], 0, 'L', '100', rows), /Review existing rows/);
  const replacement = buildVariantMatrix([{ name: 'Size', values: ['L'] }], '100', []);
  assert.equal(replacement[0].id, undefined); assert.deepEqual(replacement[0].factsMetadataDraft, {});
});

test('snapshot upgrades keep raw drafts and immutable pending body, key and signatures byte exact', () => {
  const legacy = { ...defaultProductSnapshot, variantMatrix: [row()] };
  const signature = JSON.stringify(legacy), variantSignature = JSON.stringify(legacy.variantMatrix);
  const payload = '{"name":"Bound","version":7,"idempotency_key":"55555555-5555-4555-8555-555555555555"}';
  const intent = { scope: 'scope', key: '55555555-5555-4555-8555-555555555555', version: 7, signature, variantSignature, hasNewVariants: false, payload };
  const draft = { ...legacy, variantMatrix: [editVariantFacts(hydrateVariantFacts(row(), {}), { toys: { warnings: [{ text: '' }] } })] };
  const restored = restoreProductEdit(JSON.stringify({ ...intent, draftSignature: JSON.stringify(draft) }), 'scope');
  assert.deepEqual(restored.intent, intent); assert.deepEqual(restored.draft, draft);
  const old = readUnsavedProduct(JSON.stringify({ scope: 'scope', version: 7, updatedAt: Date.now(), snapshot: legacy }), 'scope');
  assert.equal(Object.hasOwn(old.snapshot.variantMatrix[0], 'factsMetadataBaseline'), false);
  assert.deepEqual(buildProductFormFields(old.snapshot, undefined, true).variants[0].id, rowId);
  assert.equal(Object.hasOwn(buildProductFormFields(old.snapshot, undefined, true).variants[0], 'metadata'), false);
});
