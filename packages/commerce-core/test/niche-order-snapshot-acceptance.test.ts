import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareProductFactSnapshot, readProductFactSnapshot, personalizationReviewFingerprint,
  PRODUCT_NICHE_FACT_SCHEMAS, ProductVariantMetadataSchema, PersonalizationReviewContextSchema,
  type ProductFactSnapshot, type ProductFactSnapshotSource,
} from '../src/index';

const namespaces = ['toys', 'electronics', 'food', 'furniture', 'gifts', 'personalization', 'beauty', 'sports', 'books'] as const;
type Namespace = typeof namespaces[number];
const identity = (name: Namespace, prefix = '4b') => `${prefix}000000-0000-4000-8000-${String(namespaces.indexOf(name) + 1).padStart(12, '0')}`;
function source(name: Namespace, facts: unknown, variant?: { facts: unknown; options: Record<string, string> }): ProductFactSnapshotSource {
  const productId = identity(name);
  return {
    product_id: productId, product_version: 7,
    product_metadata: { [name]: PRODUCT_NICHE_FACT_SCHEMAS[name].parse(facts), privateSupplier: { token: 'NEVER_IN_ORDER_FACTS' } },
    has_variants: Boolean(variant),
    ...(variant ? { selected_variant: { id: identity(name, '5b'), product_id: productId, metadata: ProductVariantMetadataSchema.parse(variant.facts), options: { ...variant.options } } } : {}),
  };
}
async function accepted(input: unknown) {
  const result = await prepareProductFactSnapshot(input);
  if (!result.ok) assert.fail(`Expected a valid canonical fixture, got ${result.error.code}: ${result.error.message}`);
  return result;
}
function read(value: unknown): ProductFactSnapshot {
  const result = readProductFactSnapshot(value);
  assert.ok(result, 'The saved canonical snapshot must remain readable.');
  return result;
}
function assertDeepFrozen(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Reflect.set(value, 'forged_after_acceptance', true), false);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}
function metadata(input: ProductFactSnapshotSource): Record<string, unknown> {
  assert.ok(input.product_metadata && typeof input.product_metadata === 'object' && !Array.isArray(input.product_metadata));
  return input.product_metadata as Record<string, unknown>;
}
function eraseMutableCatalogData(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), false, 'Accepting an order must not freeze the mutable catalog row.');
  for (const child of Object.values(value)) eraseMutableCatalogData(child);
  if (Array.isArray(value)) value.splice(0, value.length);
  else for (const key of Object.keys(value)) assert.equal(Reflect.deleteProperty(value, key), true);
}

const personalizationFacts = {
  version: 1, revision: 4,
  methods: [{ id: 'deboss', label: 'Name debossing', min_graphemes: 1, max_graphemes: 18, character_set: 'unicode-letters',
    styles: [{ id: 'serif', label: 'Serif' }, { id: 'sans', label: 'Sans' }], placements: [{ id: 'front', label: 'Front cover' }] }],
};
async function reviewedSource(text = 'आशा José'): Promise<ProductFactSnapshotSource> {
  const input = source('personalization', personalizationFacts, { facts: {}, options: { Cover: 'Moss' } });
  const fingerprint = await personalizationReviewFingerprint({ product_id: input.product_id, variant_id: input.selected_variant?.id ?? null, product_version: input.product_version, facts: metadata(input).personalization });
  assert.ok(fingerprint);
  input.personalization = { facts_revision: 4, method_id: 'deboss', style_id: 'serif', placement_id: 'front', text, review_fingerprint: fingerprint };
  return input;
}
const beautyFacts = {
  routineStage: 'colour', format: 'Tint', netQuantity: { value: 30, unit: 'ml' }, shadeOptionName: 'Shade',
  shades: [{ value: 'Rosewater', color: '#B46B63', ingredients: 'Rosewater formula' }, { value: 'Pink Clay', color: '#B46B63', ingredients: 'Pink Clay formula' }],
};

const fixtures: Array<{ name: Namespace; make(): ProductFactSnapshotSource | Promise<ProductFactSnapshotSource>; verify(snapshot: ProductFactSnapshot): void }> = [
  {
    name: 'toys',
    make: () => source('toys', { ageBands: ['6-8'], ageStatement: 'Printed common edition age', contents: [{ label: 'Blocks', quantity: 12 }], contentsComplete: true, dimensions: { length: 24, width: 16, unit: 'cm' }, materials: 'Wood' }, { facts: { toys: { ageBands: [], contents: [], dimensions: null } }, options: { Edition: 'Travel' } }),
    verify: snapshot => {
      const toy = snapshot.facts.toys!;
      assert.equal(toy.materials, 'Wood'); assert.deepEqual(toy.ageBands, []); assert.equal(toy.ageStatement, undefined);
      assert.deepEqual(toy.contents, []); assert.equal(toy.contentsComplete, false); assert.equal(toy.dimensions, null);
    },
  },
  {
    name: 'electronics',
    make: () => source('electronics', { kind: 'hub', model: 'Synthetic H1', connectors: [{ kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'usb-a', role: 'data', count: 1 }], power_input_w: 65, power_output_w: 45, pass_through_output_w: 60, box_contents: [{ label: 'Hub', quantity: 1 }] }),
    verify: snapshot => {
      const device = snapshot.facts.electronics!;
      assert.equal(device.power_input_w, 65); assert.equal(device.power_output_w, 45); assert.equal(device.pass_through_output_w, 60);
      assert.deepEqual(device.connectors.filter(row => row.kind === 'usb-c').map(row => [row.role, row.count]), [['power-input', 1], ['power-output', 2]]);
    },
  },
  {
    name: 'food',
    make: () => source('food', { ingredients: 'Roasted chickpeas', netQuantity: { value: 1000, unit: 'g' }, storage: 'Keep dry.' }, { facts: { food: { netQuantity: { value: 250, unit: 'g' } } }, options: { 'Pack size': '250 g' } }),
    verify: snapshot => { assert.deepEqual(snapshot.facts.food?.netQuantity, { value: 250, unit: 'g' }); assert.equal(snapshot.facts.food?.ingredients, 'Roasted chickpeas'); },
  },
  {
    name: 'furniture',
    make: () => source('furniture', { assembled: { unit: 'cm', width: 120, depth: 60, height: 75 }, package: { unit: 'cm', width: 130, depth: 65, height: 20 }, materials: ['Wood'] }, { facts: { furniture: { assembled: { unit: 'in', width: 48 }, package: { unit: 'in', width: 50, depth: 25 } } }, options: { Width: '48 in' } }),
    verify: snapshot => {
      assert.deepEqual(snapshot.facts.furniture?.assembled, { unit: 'in', width: 48 });
      assert.deepEqual(snapshot.facts.furniture?.package, { unit: 'in', width: 50, depth: 25 });
      assert.deepEqual(snapshot.facts.furniture?.materials, ['Wood']);
    },
  },
  {
    name: 'gifts',
    make: () => source('gifts', { contents: [{ label: 'Mug', quantity: 1, detail: '300 ml', care: 'Hand wash.' }, { label: 'Notebook', quantity: 1 }, { label: 'Pen', quantity: 1 }], mediaRoles: { openBox: 0, closedBox: 1 } }, { facts: {}, options: { Packaging: 'Blush gift box' } }),
    verify: snapshot => {
      const gift = snapshot.facts.gifts!;
      assert.equal(gift.contents!.reduce((sum, item) => sum + item.quantity, 0), 3);
      assert.deepEqual(gift.contents!.map(item => item.label), ['Mug', 'Notebook', 'Pen']);
      assert.equal(gift.contents![0].care, 'Hand wash.'); assert.deepEqual(gift.mediaRoles, { openBox: 0, closedBox: 1 });
    },
  },
  {
    name: 'personalization', make: () => reviewedSource(),
    verify: snapshot => {
      assert.equal(snapshot.personalization?.text, 'आशा José'); assert.equal(snapshot.personalization?.facts_revision, 4);
      assert.deepEqual(snapshot.personalization?.method, { id: 'deboss', label: 'Name debossing' });
      assert.deepEqual(snapshot.personalization?.style, { id: 'serif', label: 'Serif' });
      assert.deepEqual(snapshot.personalization?.placement, { id: 'front', label: 'Front cover' });
    },
  },
  {
    name: 'beauty',
    make: () => source('beauty', beautyFacts, { facts: {}, options: { Size: ' 30 ml ', Shade: 'Pink Clay', Finish: 'साटन' } }),
    verify: snapshot => {
      assert.deepEqual(snapshot.facts.beauty?.shades.map(shade => [shade.value, shade.color]), [['Rosewater', '#B46B63'], ['Pink Clay', '#B46B63']]);
      assert.deepEqual(snapshot.selected_options, [{ name: 'Finish', value: 'साटन' }, { name: 'Shade', value: 'Pink Clay' }, { name: 'Size', value: ' 30 ml ' }]);
    },
  },
  {
    name: 'sports',
    make: () => source('sports', { activity: 'Badminton', equipmentType: 'racket', length: { value: 67.5, unit: 'cm' }, dimensions: { length: 67.5, width: 26, height: 2, unit: 'cm' }, weight: { value: 85, unit: 'g' } }, { facts: { sports: { length: { value: 26.5, unit: 'in' }, dimensions: { length: 26.5, width: 10, unit: 'in' }, weight: { value: 80, unit: 'g' } } }, options: { Length: '26.5 in' } }),
    verify: snapshot => {
      assert.equal(snapshot.facts.sports?.activity, 'Badminton'); assert.deepEqual(snapshot.facts.sports?.length, { value: 26.5, unit: 'in' });
      assert.deepEqual(snapshot.facts.sports?.dimensions, { length: 26.5, width: 10, unit: 'in' }); assert.deepEqual(snapshot.facts.sports?.weight, { value: 80, unit: 'g' });
    },
  },
  {
    name: 'books',
    make: () => source('books', { kind: 'book', authors: ['सिंथेटिक लेखक'], language: 'Hindi', format: 'paperback', edition: 'First printing', pages: 160, isbn: '9780306406157' }, { facts: { books: { kind: 'book', language: 'English', format: 'hardback', edition: 'Illustrated second printing', pages: 192, dimensions_mm: { width: 156, height: 234 }, isbn: '9781861972712' } }, options: { Edition: 'English hardback' } }),
    verify: snapshot => {
      const book = snapshot.facts.books!; assert.equal(book.kind, 'book'); if (book.kind !== 'book') assert.fail('Expected the selected book edition.');
      assert.deepEqual(book.authors, ['सिंथेटिक लेखक']); assert.equal(book.language, 'English'); assert.equal(book.format, 'hardback');
      assert.equal(book.edition, 'Illustrated second printing'); assert.equal(book.pages, 192); assert.equal(book.isbn, '9781861972712'); assert.deepEqual(book.dimensions_mm, { width: 156, height: 234 });
    },
  },
];

for (const fixture of fixtures) test(`${fixture.name}: immutable accepted facts survive source catalog mutation and deletion`, async () => {
  const input = await fixture.make(), original = JSON.stringify(input);
  const prepared = await accepted(input);
  assert.equal(JSON.stringify(input), original, 'Acceptance must not mutate the authoritative input rows.');
  assert.deepEqual(Object.keys(prepared.snapshot.facts), [fixture.name]);
  assert.equal(prepared.variant_id, input.selected_variant?.id ?? null);
  fixture.verify(prepared.snapshot);
  const saved = JSON.stringify(prepared.snapshot);
  assertDeepFrozen(prepared.snapshot);
  assert.doesNotMatch(saved, /NEVER_IN_ORDER_FACTS|privateSupplier/);

  eraseMutableCatalogData(metadata(input)[fixture.name]);
  delete metadata(input)[fixture.name];
  input.product_metadata = { privateSupplier: 'Catalog replaced after purchase' };
  input.product_version = 99;
  if (input.selected_variant) {
    eraseMutableCatalogData(input.selected_variant.metadata);
    eraseMutableCatalogData(input.selected_variant.options);
    input.selected_variant.metadata = {};
    input.selected_variant.options = { Changed: 'Deleted original option rows' };
    input.selected_variant.id = identity(fixture.name, '6b');
  }
  eraseMutableCatalogData(input.personalization);
  input.personalization = undefined;
  const historical = read(JSON.parse(saved) as unknown);
  assert.equal(JSON.stringify(historical), saved);
  fixture.verify(historical);
  assertDeepFrozen(historical);
});

test('selected durable variant, not a matching option label, determines frozen dimensions and fingerprint', async () => {
  const first = fixtures.find(fixture => fixture.name === 'furniture')!.make();
  const selected = await first;
  const a = await accepted(selected);
  const other = structuredClone(selected);
  assert.ok(other.selected_variant);
  other.selected_variant.id = identity('furniture', '6b');
  other.selected_variant.metadata = { furniture: { assembled: { unit: 'in', width: 36 } } };
  const b = await accepted(other);
  assert.deepEqual(a.snapshot.selected_options, b.snapshot.selected_options, 'Same labels are not a variant identity.');
  assert.notEqual(a.variant_id, b.variant_id); assert.notEqual(a.snapshot_fingerprint, b.snapshot_fingerprint);
  assert.deepEqual(a.snapshot.facts.furniture?.assembled, { unit: 'in', width: 48 });
  assert.deepEqual(b.snapshot.facts.furniture?.assembled, { unit: 'in', width: 36 });
  other.selected_variant.product_id = identity('books');
  const forged = await prepareProductFactSnapshot(other);
  assert.equal(forged.ok, false); if (forged.ok) assert.fail('Foreign variant must be rejected.');
  assert.equal(forged.error.code, 'VARIANT_MISMATCH');
});

test('per-pack food quantity stays unknown without a selected override and absent gift contents are never manufactured', async () => {
  for (const override of [{}, { food: null }, { food: { netQuantity: null } }]) {
    const prepared = await accepted(source('food', { ingredients: 'Tea leaves', netQuantity: { value: 1000, unit: 'g' } }, { facts: override, options: { Pack: 'Quantity not supplied' } }));
    assert.equal(prepared.snapshot.facts.food?.netQuantity, null); assert.equal(prepared.snapshot.facts.food?.ingredients, 'Tea leaves');
  }
  const gift = await accepted(source('gifts', { suitabilityNote: 'For a quiet morning.' }));
  assert.equal(gift.snapshot.facts.gifts?.contents, undefined); assert.equal(gift.snapshot.facts.gifts?.mediaRoles, undefined);
  const incomplete = source('gifts', { suitabilityNote: 'Supplied note.' });
  incomplete.product_metadata = { gifts: { contents: [{ label: 'Mug', quantity: '' }] } };
  const failed = await prepareProductFactSnapshot(incomplete);
  assert.equal(failed.ok, false); if (failed.ok) assert.fail('Incomplete declared contents must be rejected.');
  assert.equal(failed.error.code, 'INVALID_FACTS');
});

test('an explicit toy clear may remove the namespace and cannot retain an inherited completeness promise', async () => {
  const clear = await accepted(source('toys', { ageBands: ['6-8'], contents: [{ label: 'Tiles', quantity: 12 }], contentsComplete: true, dimensions: { length: 20, unit: 'cm' } }, { facts: { toys: { ageBands: [], contents: [], dimensions: null } }, options: { Edition: 'Contents unavailable' } }));
  assert.equal(clear.snapshot.facts.toys, undefined);
  assert.deepEqual(clear.snapshot.selected_options, [{ name: 'Edition', value: 'Contents unavailable' }]);
});

test('same-RGB beauty names remain exact server-selected options with deterministic ordering', async () => {
  const rose = source('beauty', beautyFacts, { facts: {}, options: { Size: ' 30 ml ', Shade: 'Rosewater', Finish: 'साटन' } });
  const clay = structuredClone(rose); assert.ok(clay.selected_variant);
  clay.selected_variant.id = identity('beauty', '6b'); clay.selected_variant.options = { Finish: 'साटन', Shade: 'Pink Clay', Size: ' 30 ml ' };
  const a = await accepted(rose), b = await accepted(clay);
  assert.deepEqual(a.snapshot.selected_options, [{ name: 'Finish', value: 'साटन' }, { name: 'Shade', value: 'Rosewater' }, { name: 'Size', value: ' 30 ml ' }]);
  assert.deepEqual(b.snapshot.selected_options, [{ name: 'Finish', value: 'साटन' }, { name: 'Shade', value: 'Pink Clay' }, { name: 'Size', value: ' 30 ml ' }]);
  assert.notEqual(a.snapshot_fingerprint, b.snapshot_fingerprint);
  const reordered = structuredClone(rose); assert.ok(reordered.selected_variant);
  reordered.selected_variant.options = { Finish: 'साटन', Shade: 'Rosewater', Size: ' 30 ml ' };
  const c = await accepted(reordered);
  assert.deepEqual(c.snapshot.selected_options, a.snapshot.selected_options); assert.equal(c.snapshot_fingerprint, a.snapshot_fingerprint);
});

test('historical option selection cannot contain two values for the same named relational option', async () => {
  const positive = await accepted(source('beauty', beautyFacts, { facts: {}, options: { Shade: 'Rosewater' } }));
  assert.ok(readProductFactSnapshot(positive.snapshot));
  const ambiguous = { ...structuredClone(positive.snapshot), selected_options: [{ name: 'Shade', value: 'Rosewater' }, { name: 'Shade', value: 'Pink Clay' }] };
  assert.equal(readProductFactSnapshot(ambiguous), null, 'A canonical options record cannot produce duplicate option names.');
});

test('saved option names stay exact across case and Hindi and remain within the canonical ten-option bound', async () => {
  const exact = source('beauty', beautyFacts, { facts: {}, options: { 'अवसर': 'जन्मदिन', shade: 'Pink Clay', Size: ' 30 ml ', Shade: 'Rosewater' } });
  const prepared = await accepted(exact);
  assert.deepEqual(prepared.snapshot.selected_options, [{ name: 'Shade', value: 'Rosewater' }, { name: 'Size', value: ' 30 ml ' }, { name: 'shade', value: 'Pink Clay' }, { name: 'अवसर', value: 'जन्मदिन' }]);
  const tooMany = structuredClone(exact); assert.ok(tooMany.selected_variant);
  tooMany.selected_variant.options = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`Option ${index}`, `Value ${index}`]));
  const failed = await prepareProductFactSnapshot(tooMany);
  assert.equal(failed.ok, false); if (failed.ok) assert.fail('An oversized relational option set must not be accepted.');
  assert.equal(failed.error.code, 'INVALID_CATALOG_CONTEXT');
  assert.equal(readProductFactSnapshot({ ...prepared.snapshot, selected_options: Object.entries(tooMany.selected_variant.options).map(([name, value]) => ({ name, value })) }), null);
  assert.equal(readProductFactSnapshot({ ...prepared.snapshot, selected_options: [{ name: 'Shade', value: 'Rosewater', privateSupplier: 'NEVER_IN_ORDER_FACTS' }] }), null);
});

test('review echoes bind exact variant IDs and require explicit null instead of a product-only fallback', async () => {
  const first = await reviewedSource(); assert.ok(first.selected_variant);
  const a = await accepted(first);
  const context = { product_id: first.product_id, variant_id: first.selected_variant.id,
    facts: metadata(first).personalization, facts_revision: 4,
    review_fingerprint: (first.personalization as Record<string, unknown>).review_fingerprint };
  assert.equal(PersonalizationReviewContextSchema.safeParse(context).success, true);
  const { variant_id: _omitted, ...missingVariantContext } = context;
  assert.equal(PersonalizationReviewContextSchema.safeParse(missingVariantContext).success, false);
  const reviewInput = { product_id: first.product_id, product_version: first.product_version, facts: metadata(first).personalization };
  const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(context.review_fingerprint, await digest(JSON.stringify(['letbuyy-personalization-review-v2', first.product_id, first.selected_variant.id, first.product_version, reviewInput.facts])));
  assert.equal(await personalizationReviewFingerprint(reviewInput), null, 'A product-only review cannot be minted.');
  assert.equal(await personalizationReviewFingerprint({ ...reviewInput, variant_id: undefined }), null);
  assert.equal(await personalizationReviewFingerprint({ ...reviewInput, variant_id: '' }), null);
  const legacyProductOnly = structuredClone(first);
  legacyProductOnly.personalization = { ...(first.personalization as Record<string, unknown>),
    review_fingerprint: await digest(JSON.stringify(['letbuyy-personalization-review-v1', first.product_id, first.product_version, reviewInput.facts])) };
  const legacyFailed = await prepareProductFactSnapshot(legacyProductOnly);
  assert.equal(legacyFailed.ok, false); if (legacyFailed.ok) assert.fail('The old product-only digest must not be a fallback.');
  assert.equal(legacyFailed.error.code, 'PERSONALIZATION_STALE');

  // Same product/version/facts/options/text, different durable variant identity.
  const second = structuredClone(first); assert.ok(second.selected_variant);
  second.selected_variant.id = identity('personalization', '6b');
  assert.deepEqual(second.selected_variant.options, first.selected_variant.options);
  const wrongVariant = await prepareProductFactSnapshot(second);
  assert.equal(wrongVariant.ok, false); if (wrongVariant.ok) assert.fail('Variant A review must not accept variant B.');
  assert.equal(wrongVariant.error.code, 'PERSONALIZATION_STALE');
  const secondReview = await personalizationReviewFingerprint({ ...reviewInput, variant_id: second.selected_variant.id });
  assert.ok(secondReview); assert.notEqual(secondReview, context.review_fingerprint);
  second.personalization = { ...(first.personalization as Record<string, unknown>), review_fingerprint: secondReview };
  const b = await accepted(second);
  assert.equal(b.variant_id, second.selected_variant.id);
  assert.notEqual(b.configuration_fingerprint, a.configuration_fingerprint);
  assert.notEqual(b.snapshot_fingerprint, a.snapshot_fingerprint);

  const noVariantReview = await personalizationReviewFingerprint({ ...reviewInput, variant_id: null });
  assert.ok(noVariantReview); assert.notEqual(noVariantReview, secondReview);
  assert.equal(PersonalizationReviewContextSchema.safeParse({ ...context, variant_id: null, review_fingerprint: noVariantReview }).success, true);
  const wrongNull = structuredClone(first);
  wrongNull.personalization = { ...(first.personalization as Record<string, unknown>), review_fingerprint: noVariantReview };
  const failedNull = await prepareProductFactSnapshot(wrongNull);
  assert.equal(failedNull.ok, false); if (failedNull.ok) assert.fail('An explicit-null review must not accept a selected variant.');
  assert.equal(failedNull.error.code, 'PERSONALIZATION_STALE');
  const unvarianted = structuredClone(wrongNull); unvarianted.has_variants = false; unvarianted.selected_variant = null;
  const plain = await accepted(unvarianted); assert.equal(plain.variant_id, null);
  assert.equal(plain.snapshot.selected_options, undefined);
  assert.equal(plain.snapshot.personalization?.text, 'आशा José');
  assert.equal(a.snapshot.version, 1); assert.deepEqual(read(JSON.parse(JSON.stringify(a.snapshot))), a.snapshot);
});

test('forged, replayed and stale personalization reviews cannot manufacture an accepted configuration', async () => {
  const input = await reviewedSource();
  const positive = await accepted(input), repeat = await accepted(structuredClone(input));
  assert.equal(positive.configuration_fingerprint, repeat.configuration_fingerprint); assert.equal(positive.snapshot_fingerprint, repeat.snapshot_fingerprint);
  const alteredText = await accepted(await reviewedSource('Élodie'));
  assert.notEqual(positive.configuration_fingerprint, alteredText.configuration_fingerprint);
  const advanced = structuredClone(input);
  metadata(advanced).personalization = { ...personalizationFacts, revision: 5 };
  const advancedReview = await personalizationReviewFingerprint({ product_id: advanced.product_id, variant_id: advanced.selected_variant?.id ?? null, product_version: advanced.product_version, facts: metadata(advanced).personalization });
  assert.ok(advancedReview);
  advanced.personalization = { ...(input.personalization as Record<string, unknown>), facts_revision: 5, review_fingerprint: advancedReview };
  const advancedAccepted = await accepted(advanced);
  assert.equal(advancedAccepted.snapshot.personalization?.facts_revision, 5);
  assert.notEqual(advancedAccepted.configuration_fingerprint, positive.configuration_fingerprint);
  assert.equal(read(positive.snapshot).personalization?.facts_revision, 4);
  const staleVersion = structuredClone(input); staleVersion.product_version = 8;
  const otherProduct = structuredClone(input); otherProduct.product_id = identity('personalization', '7b'); assert.ok(otherProduct.selected_variant); otherProduct.selected_variant.product_id = otherProduct.product_id;
  const changedMeaning = structuredClone(input); metadata(changedMeaning).personalization = { ...personalizationFacts, methods: [{ ...personalizationFacts.methods[0], label: 'Different production meaning' }] };
  const forgedDigest = structuredClone(input); forgedDigest.personalization = { ...(input.personalization as Record<string, unknown>), review_fingerprint: '0'.repeat(64) };
  const readded = structuredClone(input); readded.product_version = 9;
  for (const candidate of [staleVersion, otherProduct, changedMeaning, forgedDigest, readded]) {
    const failed = await prepareProductFactSnapshot(candidate);
    assert.equal(failed.ok, false); if (failed.ok) assert.fail('Old or forged review must be rejected.');
    assert.equal(failed.error.code, 'PERSONALIZATION_STALE');
  }
  const removed = structuredClone(input); removed.product_metadata = {};
  const unavailable = await prepareProductFactSnapshot(removed);
  assert.equal(unavailable.ok, false); if (unavailable.ok) assert.fail('Removed capability must not be accepted.');
  assert.equal(unavailable.error.code, 'PERSONALIZATION_UNAVAILABLE');
  const forgedAccepted = { ...structuredClone(positive.snapshot), personalization: { ...positive.snapshot.personalization!, style: { id: 'serif', label: 'Forged paid style' } } };
  assert.equal(readProductFactSnapshot(forgedAccepted), null);
  const unreviewedNfc = await reviewedSource('Jose\u0301');
  const normalization = await prepareProductFactSnapshot(unreviewedNfc);
  assert.equal(normalization.ok, false); if (normalization.ok) assert.fail('Normalization requires a reviewed correction.');
  assert.equal(normalization.error.issues?.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text, 'José');
});

test('missing facts remain absent and private, unsupported or malformed fulfillment fields fail closed', async () => {
  const empty = await accepted({ product_id: identity('gifts'), product_version: 7, product_metadata: { privateSupplier: 'NEVER_IN_ORDER_FACTS' }, has_variants: false });
  assert.deepEqual(empty.snapshot, { version: 1, facts: {} });
  assert.equal(empty.configuration_fingerprint, null);
  const valid = source('electronics', { connectors: [], notes: 'Merchant-supplied note.' });
  const badPower = { ...valid, product_metadata: { electronics: { power_input_w: 45, pass_through_output_w: 65 } } };
  const badBooks = source('books', { kind: 'book', language: 'Hindi' }, { facts: { books: { kind: 'stationery', ruling: 'lined' } }, options: { Edition: 'Paper item' } });
  const badSport = source('sports', { activity: 'Badminton', equipmentType: 'racket' }, { facts: { sports: { length: { value: 67, unit: 'cm' } } }, options: { Length: '67 cm' } });
  badSport.product_metadata = {};
  for (const [candidate, expected] of [[badPower, 'INVALID_FACTS'], [badBooks, 'FACTS_CONFLICT'], [badSport, 'FACTS_CONFLICT'], [{ ...valid, accepted_proof: true }, 'INVALID_CATALOG_CONTEXT']] as const) {
    const failed = await prepareProductFactSnapshot(candidate); assert.equal(failed.ok, false); if (failed.ok) assert.fail('Invalid context must be rejected.');
    assert.equal(failed.error.code, expected);
  }
  assert.equal(readProductFactSnapshot({ ...empty.snapshot, privateSupplier: 'NEVER_IN_ORDER_FACTS' }), null);
  assert.equal(readProductFactSnapshot({ version: 1, facts: { privateSupplier: 'NEVER_IN_ORDER_FACTS' } }), null);
});
