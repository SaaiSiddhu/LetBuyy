import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ProductFactSnapshotSchema, PersonalizationCartDraftSchema, prepareProductFactSnapshot, personalizationReviewFingerprint, validatePersonalizationRevisionTransition, readProductFactSnapshot, type ProductFactSnapshotSource } from '../src/product-fact-snapshot';
import { readProductNicheFacts } from '../src/niche-product-facts';
import { buildProductFactPresentation } from '../src/product-fact-presentation';

const productId = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const facts = { version: 1, revision: 1, methods: [{ id: 'engraving', label: 'Front engraving', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }], placements: [{ id: 'front', label: 'Centered on the front' }] }] };
const draft = { facts_revision: 1, method_id: 'engraving', style_id: 'sans', placement_id: 'front', text: 'Asha' };
const base: ProductFactSnapshotSource = { product_id: productId, product_version: 7, product_metadata: {}, has_variants: false };
const configured = (text = 'Asha'): ProductFactSnapshotSource => ({ ...base, product_metadata: { personalization: facts }, personalization: { ...draft, text } });
const selected = (productMetadata: unknown, metadata: unknown): ProductFactSnapshotSource => ({ ...base, has_variants: true, product_metadata: productMetadata, selected_variant: { id: variantId, product_id: productId, metadata } });
// A fresh server-rendered review digest is supplied unless the test explicitly retains an older one.
async function prepareReviewed(input: unknown) {
  const source = input as ProductFactSnapshotSource;
  const draftValue = source.personalization && typeof source.personalization === 'object' ? source.personalization as Record<string, unknown> : null;
  const metadata = source.product_metadata && typeof source.product_metadata === 'object' ? source.product_metadata as Record<string, unknown> : {};
  if (draftValue && !Object.hasOwn(draftValue, 'review_fingerprint')) {
    const fingerprint = await personalizationReviewFingerprint({ product_id: source.product_id, variant_id: source.selected_variant?.id ?? null, product_version: source.product_version, facts: metadata.personalization });
    if (fingerprint) return prepareProductFactSnapshot({ ...source, personalization: { ...draftValue, review_fingerprint: fingerprint } });
  }
  return prepareProductFactSnapshot(input);
}


test('missing facts stay absent; private/accessor/inherited metadata never becomes an order fact', async () => {
  let accessed = false;
  const privateMetadata = { private_supplier_token: 'secret', unrelated: { customer: 'not public' } };
  const result = await prepareReviewed({ ...base, product_metadata: privateMetadata });
  assert.equal(result.ok, true);
  if (result.ok) { assert.deepEqual(result.snapshot, { version: 1, facts: {} }); assert.equal(result.configuration_fingerprint, null); }
  const inherited = await prepareReviewed({ ...base, product_metadata: Object.create({ personalization: facts }) });
  assert.equal(inherited.ok, true);
  if (inherited.ok) assert.deepEqual(inherited.snapshot.facts, {});
  const accessor = {}; Object.defineProperty(accessor, 'personalization', { get() { accessed = true; return facts; } });
  const rejected = await prepareReviewed({ ...base, product_metadata: accessor });
  assert.equal(rejected.ok, false); assert.equal(accessed, false);
});
test('canonical UUID/version and selected variant parent are mandatory server context', async () => {
  for (const malformed of [null, undefined, [], 'not a catalog row']) assert.equal((await prepareProductFactSnapshot(malformed)).ok, false);
  for (const source of [{ ...base, product_id: 'sku-name' }, { ...base, product_version: 0 }, { ...base, price: 0 }, { ...base, accepted_proof: true }]) assert.equal((await prepareReviewed(source)).ok, false);
  const missing = await prepareReviewed({ ...base, has_variants: true });
  assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.error.code, 'VARIANT_REQUIRED');
  for (const source of [selected({}, {}), { ...base, selected_variant: { id: variantId, product_id: productId, metadata: {} } }]) {
    const bad = source.has_variants ? { ...source, selected_variant: { id: variantId, product_id: otherId, metadata: {} } } : source;
    const result = await prepareReviewed(bad); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, 'VARIANT_MISMATCH');
  }
});
test('malformed declared facts and unknown variant namespaces fail rather than losing fulfillment details', async () => {
  for (const metadata of [{ personalization: { ...facts, upload: true } }, { food: { netQuantity: { value: 0, unit: 'kg' } } }, { personalization: null }]) {
    const result = await prepareReviewed({ ...base, product_metadata: metadata }); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, 'INVALID_FACTS');
  }
  assert.equal((await prepareReviewed(selected({}, { supplier_private: 'secret' }))).ok, false);
});
test('food freezes the selected sellable pack quantity and never inherits an unselected parent pack', async () => {
  const common = { food: { ingredients: 'Tea leaves', netQuantity: { value: 1000, unit: 'g' } } };
  for (const metadata of [{}, { food: null }, { food: { netQuantity: null } }]) {
    const result = await prepareReviewed(selected(common, metadata)); assert.equal(result.ok, true);
    if (result.ok) { assert.equal(result.snapshot.facts.food?.netQuantity, null); assert.equal(result.snapshot.facts.food?.ingredients, 'Tea leaves'); }
  }
  const pack = await prepareReviewed(selected(common, { food: { netQuantity: { value: 250, unit: 'g' } } }));
  assert.equal(pack.ok, true); if (pack.ok) assert.deepEqual(pack.snapshot.facts.food?.netQuantity, { value: 250, unit: 'g' });
  const unvarianted = await prepareReviewed({ ...base, product_metadata: common });
  if (unvarianted.ok) assert.deepEqual(unvarianted.snapshot.facts.food?.netQuantity, { value: 1000, unit: 'g' });
});
test('furniture and sports preserve whole measurement/unit groups without mixing parent dimensions', async () => {
  const result = await prepareReviewed(selected({ furniture: { assembled: { unit: 'cm', width: 100, height: 80 } }, sports: { activity: 'Badminton', equipmentType: 'racket', length: { value: 67, unit: 'cm' }, dimensions: { length: 67, width: 25, height: 2, unit: 'cm' } } }, { furniture: { assembled: { unit: 'in', width: 24 } }, sports: { length: { value: 26.5, unit: 'in' }, dimensions: { length: 26.5, width: 10, unit: 'in' } } }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.snapshot.facts.furniture?.assembled, { unit: 'in', width: 24 });
    assert.deepEqual(result.snapshot.facts.sports?.length, { value: 26.5, unit: 'in' });
    assert.deepEqual(result.snapshot.facts.sports?.dimensions, { length: 26.5, width: 10, unit: 'in' });
  }
  const incomplete = await prepareReviewed(selected({}, { sports: { length: { value: 67, unit: 'cm' } } }));
  assert.equal(incomplete.ok, false); if (!incomplete.ok) assert.equal(incomplete.error.code, 'FACTS_CONFLICT');
});
test('book kinds cannot be mixed and toy edition clears retain the canonical clear/completeness semantics', async () => {
  const conflict = await prepareReviewed(selected({ books: { kind: 'book', language: 'Hindi', format: 'paperback' } }, { books: { kind: 'stationery', ruling: 'lined' } }));
  assert.equal(conflict.ok, false); if (!conflict.ok) assert.equal(conflict.error.code, 'FACTS_CONFLICT');
  const edition = await prepareReviewed(selected({ books: { kind: 'book', authors: ['A. Writer'], language: 'Hindi', format: 'paperback' } }, { books: { kind: 'book', language: 'English', format: 'hardback' } }));
  assert.equal(edition.ok, true); if (edition.ok) assert.deepEqual(edition.snapshot.facts.books, { kind: 'book', authors: ['A. Writer'], language: 'English', format: 'hardback' });
  const toy = await prepareReviewed(selected({ toys: { contents: [{ label: 'Blocks', quantity: 6 }], contentsComplete: true, ageBands: ['3-5'], ageStatement: 'Printed common label', dimensions: { length: 10, unit: 'cm' }, materials: 'Wood' } }, { toys: { contents: [], dimensions: null, ageBands: [] } }));
  assert.equal(toy.ok, true); if (toy.ok) { const value = toy.snapshot.facts.toys!; assert.deepEqual(value.contents, []); assert.equal(value.contentsComplete, false); assert.equal(value.dimensions, null); assert.deepEqual(value.ageBands, []); assert.equal(value.ageStatement, undefined); assert.equal(value.materials, 'Wood'); }
});
test('required, stale, missing and forged personalization never produce an accepted snapshot or client-authoritative hash', async () => {
  const required = await prepareReviewed({ ...configured(), personalization: undefined });
  assert.equal(required.ok, false); if (!required.ok) assert.equal(required.error.code, 'PERSONALIZATION_REQUIRED');
  const unavailable = await prepareReviewed({ ...base, personalization: draft });
  assert.equal(unavailable.ok, false); if (!unavailable.ok) assert.equal(unavailable.error.code, 'PERSONALIZATION_UNAVAILABLE');
  const stale = await prepareReviewed({ ...configured(), personalization: { ...draft, facts_revision: 2 } });
  assert.equal(stale.ok, false); if (!stale.ok) assert.equal(stale.error.code, 'PERSONALIZATION_STALE');
  for (const extra of [{ configuration_fingerprint: 'client-hash' }, { accepted: true }, { price: 0 }, { method_label: 'Forged' }]) {
    const result = await prepareReviewed({ ...configured(), personalization: { ...draft, ...extra } }); assert.equal(result.ok, false);
  }
  assert.equal(PersonalizationCartDraftSchema.safeParse({ ...draft, facts_revision: undefined }).success, false);
});
test('NFC requires explicit reviewed text; unsupported Unicode/control characters are rejected', async () => {
  const source = { ...configured(), product_metadata: { personalization: { ...facts, methods: [{ ...facts.methods[0], character_set: 'unicode-letters' }] } } };
  const decomposed = await prepareReviewed({ ...source, personalization: { ...draft, text: 'Jose\u0301' } });
  assert.equal(decomposed.ok, false);
  if (!decomposed.ok) assert.equal(decomposed.error.issues?.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text, 'José');
  const normalized = await prepareReviewed({ ...source, personalization: { ...draft, text: 'José' } });
  assert.equal(normalized.ok, true); if (normalized.ok) assert.equal(normalized.snapshot.personalization?.text, 'José');
  for (const text of ['Asha ✦', 'Asha\n', 'Asha\u200b', '\u202eAsha', '---', '<script>', 'A'.repeat(19)]) assert.equal((await prepareReviewed(configured(text))).ok, false);
});
test('SHA256 identity is deterministic, UUID-canonical, quantity-independent and distinguishes same-SKU configurations', async () => {
  const a = await prepareReviewed(configured()); assert.equal(a.ok, true); if (!a.ok) return;
  const expected = createHash('sha256').update(JSON.stringify(['letbuyy-personalization-v1', productId, null, '[1,1,"engraving","sans","front","Asha"]'])).digest('hex');
  assert.equal(a.configuration_fingerprint, expected); assert.match(a.snapshot_fingerprint, /^[0-9a-f]{64}$/);
  const repeated = await prepareReviewed(configured()); assert.equal(repeated.ok, true);
  if (repeated.ok) assert.equal(repeated.configuration_fingerprint, a.configuration_fingerprint);
  const candidates = [configured('Kabir'), configured(' Asha '), configured('ASHA'), { ...configured(), personalization: { ...draft, style_id: 'serif' } }, { ...configured(), product_id: otherId }, { ...configured(), has_variants: true, selected_variant: { id: variantId, product_id: productId, metadata: {} } }, { ...configured(), product_metadata: { personalization: { ...facts, revision: 2 } }, personalization: { ...draft, facts_revision: 2 } }];
  const fingerprints = await Promise.all(candidates.map(async source => { const value = await prepareReviewed(source); assert.equal(value.ok, true); return value.ok ? value.configuration_fingerprint : null; }));
  assert.equal(new Set([a.configuration_fingerprint, ...fingerprints]).size, candidates.length + 1);
  const lettered = 'abababab-abab-4bab-8bab-abababababab';
  const lower = await prepareReviewed({ ...configured(), product_id: lettered });
  const upper = await prepareReviewed({ ...configured(), product_id: lettered.toUpperCase() });
  assert.ok(lower.ok && upper.ok);
  if (lower.ok && upper.ok) { assert.equal(lower.configuration_fingerprint, upper.configuration_fingerprint); assert.equal(upper.product_id, lettered); }
  // The existing cart will group by the server-derived identity; quantities are outside this contract.
  const lines = [{ quantity: 1, text: 'Asha' }, { quantity: 2, text: 'Asha' }, { quantity: 1, text: 'Kabir' }];
  const groups = new Map<string, number>();
  for (const line of lines) { const value = await prepareReviewed(configured(line.text)); assert.equal(value.ok, true); if (value.ok) groups.set(value.configuration_fingerprint!, (groups.get(value.configuration_fingerprint!) ?? 0) + line.quantity); }
  assert.equal(groups.size, 2); assert.equal(groups.get(a.configuration_fingerprint!), 3);
});
test('a product-version or frozen-facts change invalidates the snapshot binding without inventing a new config', async () => {
  const original = await prepareReviewed(configured());
  const revised = await prepareReviewed({ ...configured(), product_version: 8 });
  const relabelled = await prepareReviewed({ ...configured(), product_metadata: { personalization: { ...facts, methods: [{ ...facts.methods[0], label: 'Updated front label' }] } } });
  assert.ok(original.ok && revised.ok && relabelled.ok);
  if (original.ok && revised.ok && relabelled.ok) {
    assert.equal(original.configuration_fingerprint, revised.configuration_fingerprint);
    assert.notEqual(original.snapshot_fingerprint, revised.snapshot_fingerprint);
    assert.notEqual(original.snapshot_fingerprint, relabelled.snapshot_fingerprint);
    assert.equal(revised.product_version, 8); // RPC must compare this with its locked row.
  }
});
test('accepted order data is cloned/frozen and cannot leak through anonymous product fact presentation', async () => {
  const source = configured(); const before = JSON.stringify(source);
  const result = await prepareReviewed(source); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(JSON.stringify(source), before); assert.ok(Object.isFrozen(result.snapshot)); assert.ok(Object.isFrozen(result.snapshot.facts.personalization!.methods));
  assert.throws(() => { result.snapshot.personalization!.text = 'Changed after acceptance'; }, TypeError);
  assert.equal(JSON.stringify(result.snapshot).includes('Asha'), true);
  assert.deepEqual(readProductNicheFacts({ niche: result.snapshot, private_token: 'secret' }), {});
  assert.deepEqual(buildProductFactPresentation({ facts: result.snapshot }), {});
  assert.equal(JSON.stringify(result).includes('private_token'), false);
});
test('historical order readback validates frozen facts/labels and never falls back to current catalog facts', async () => {
  assert.equal(readProductFactSnapshot(undefined), null); assert.equal(readProductFactSnapshot({ version: 1, facts: {}, private_token: 'secret' }), null);
  const result = await prepareReviewed(configured()); assert.equal(result.ok, true); if (!result.ok) return;
  const historical = JSON.parse(JSON.stringify(result.snapshot));
  assert.deepEqual(readProductFactSnapshot(historical), result.snapshot);
  historical.personalization.style.label = 'Forged style'; assert.equal(readProductFactSnapshot(historical), null);
  assert.equal(ProductFactSnapshotSchema.safeParse({ version: 1, facts: { personalization: facts } }).success, false);
  assert.equal(ProductFactSnapshotSchema.safeParse({ version: 1, facts: { private_notes: 'secret' } }).success, false);
});
test('revision transition permits no-effect resaves and requires advances for capability meaning changes', () => {
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, structuredClone(facts)), { ok: true, changed: false, invalidatesReview: false });
  assert.deepEqual(validatePersonalizationRevisionTransition({ ...facts, revision: 2 }, facts), { ok: false, code: 'REVISION_DECREASED' });
  const changed = { ...facts, methods: [{ ...facts.methods[0], placements: [{ id: 'front', label: 'On the back' }] }] };
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, changed), { ok: false, code: 'REVISION_NOT_ADVANCED' });
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, { ...changed, revision: 2 }), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, undefined), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(undefined, facts), { ok: true, changed: true, invalidatesReview: true });
  assert.deepEqual(validatePersonalizationRevisionTransition(facts, { ...facts, revision: 0 }), { ok: false, code: 'INVALID_PERSONALIZATION_FACTS' });
});
test('echoed server review digest rejects same-revision meaning changes, simulated races and removal/re-addition', async () => {
  const reviewFingerprint = await personalizationReviewFingerprint({ product_id: productId, variant_id: null, product_version: 7, facts });
  assert.ok(reviewFingerprint);
  const observedDraft = { ...draft, review_fingerprint: reviewFingerprint };
  const unchanged = await prepareProductFactSnapshot({ ...configured(), personalization: observedDraft });
  assert.equal(unchanged.ok, true);
  // Version/context changed after the buyer obtained their review. No current facts are accepted on their behalf.
  const raced = await prepareProductFactSnapshot({ ...configured(), product_version: 8, personalization: observedDraft });
  assert.equal(raced.ok, false); if (!raced.ok) assert.equal(raced.error.code, 'PERSONALIZATION_STALE');
  const meaningChanged = { ...facts, methods: [{ ...facts.methods[0], label: 'Different production meaning' }] };
  const staleMeaning = await prepareProductFactSnapshot({ ...configured(), product_metadata: { personalization: meaningChanged }, personalization: observedDraft });
  assert.equal(staleMeaning.ok, false); if (!staleMeaning.ok) assert.equal(staleMeaning.error.code, 'PERSONALIZATION_STALE');
  const removed = await prepareProductFactSnapshot({ ...base, product_version: 8, personalization: observedDraft });
  assert.equal(removed.ok, false); if (!removed.ok) assert.equal(removed.error.code, 'PERSONALIZATION_UNAVAILABLE');
  const readded = await prepareProductFactSnapshot({ ...configured(), product_version: 9, personalization: observedDraft });
  assert.equal(readded.ok, false); if (!readded.ok) assert.equal(readded.error.code, 'PERSONALIZATION_STALE');
  const forged = await prepareProductFactSnapshot({ ...configured(), personalization: { ...draft, review_fingerprint: '0'.repeat(64) } });
  assert.equal(forged.ok, false); if (!forged.ok) assert.equal(forged.error.code, 'PERSONALIZATION_STALE');
  const revisionOnly = await prepareProductFactSnapshot(configured());
  assert.equal(revisionOnly.ok, false); if (!revisionOnly.ok) assert.equal(revisionOnly.error.code, 'PERSONALIZATION_INVALID');
  assert.equal(await personalizationReviewFingerprint({ product_id: productId, variant_id: null, product_version: 0, facts }), null);
});

test('saved canonical option names and values retain spaces and Hindi without label inference', async () => {
  const source = selected({}, {});
  source.selected_variant = { ...source.selected_variant!, options: { 'Shade name': 'Rose 02', 'पैक आकार': 'दो इकाइयाँ' } };
  const result = await prepareProductFactSnapshot(source);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual(result.snapshot.selected_options, [{ name: 'Shade name', value: 'Rose 02' }, { name: 'पैक आकार', value: 'दो इकाइयाँ' }]);
  const previous = result.snapshot_fingerprint;
  source.selected_variant.options!['Shade name'] = 'Amber 04';
  const changed = await prepareProductFactSnapshot(source);
  assert.equal(changed.ok, true); if (changed.ok) assert.notEqual(changed.snapshot_fingerprint, previous);
  assert.equal(readProductFactSnapshot(result.snapshot)?.selected_options?.[0].value, 'Rose 02');
  assert.ok(Object.isFrozen(result.snapshot.selected_options?.[0]));
  assert.equal((await prepareProductFactSnapshot({ ...source, selected_variant: { ...source.selected_variant, options: { 'Shade name': { private: true } } } })).ok, false);
});

test('review echo requires explicit variant context and cannot move across variants or use the old product-only digest', async () => {
  const a = { ...configured(), has_variants: true, selected_variant: { id: variantId, product_id: productId, metadata: {} } };
  const digest = await personalizationReviewFingerprint({ product_id: productId, variant_id: variantId, product_version: 7, facts });
  assert.ok(digest);
  assert.equal(await personalizationReviewFingerprint({ product_id: productId, product_version: 7, facts }), null);
  const input = { ...a, personalization: { ...draft, review_fingerprint: digest } };
  assert.equal((await prepareProductFactSnapshot(input)).ok, true);
  const wrong = await prepareProductFactSnapshot({ ...input, selected_variant: { ...a.selected_variant, id: otherId } });
  assert.equal(wrong.ok, false); if (!wrong.ok) assert.equal(wrong.error.code, 'PERSONALIZATION_STALE');
  const productOnly = createHash('sha256').update(JSON.stringify(['letbuyy-personalization-review-v1', productId, 7, facts])).digest('hex');
  assert.equal((await prepareProductFactSnapshot({ ...input, personalization: { ...draft, review_fingerprint: productOnly } })).ok, false);
});
