import assert from 'node:assert/strict';
import test from 'node:test';
import { ApparelFactsSchema, prepareProductFactSnapshot, readProductFactSnapshot, summarizeProductFacts, personalizationReviewFingerprint, ProductVariantMetadataSchema, type ProductFactSnapshotSource } from '../src/index';

const garment = { fit: 'Relaxed', fabric: '100% linen', care: 'Gentle cold wash', unit: 'cm' as const, measurements: [{ size: 'M', chest: 102, shoulder: 40, length: 69 }] };
function source(metadata: unknown = { apparel: structuredClone(garment) }): ProductFactSnapshotSource {
    return { product_id: '11111111-1111-4111-8111-111111111111', product_version: 7, product_metadata: metadata, has_variants: true,
        selected_variant: { id: '22222222-2222-4222-8222-222222222222', product_id: '11111111-1111-4111-8111-111111111111', metadata: {}, options: { Color: 'Oat', Size: 'M' } } };
}
async function accepted(metadata?: unknown) {
    const result = await prepareProductFactSnapshot(source(metadata));
    if (!result.ok) assert.fail(result.error.code);
    return result;
}
test('canonical apparel schema produces an immutable garment and exact selected options', async () => {
    const metadata = { apparel: structuredClone(garment), private_supplier_token: 'PRIVATE', unknown_app: { secret: 'PRIVATE' } };
    const result = await accepted(metadata);
    assert.deepEqual(result.snapshot.facts.apparel, ApparelFactsSchema.parse(garment));
    assert.deepEqual(result.snapshot.selected_options, [{ name: 'Color', value: 'Oat' }, { name: 'Size', value: 'M' }]);
    const before = JSON.stringify(result.snapshot);
    metadata.apparel.fabric = 'Changed today'; metadata.apparel.measurements[0].chest = 999;
    assert.equal(JSON.stringify(result.snapshot), before); assert.equal(Object.isFrozen(result.snapshot.facts.apparel), true);
    assert.doesNotMatch(before, /PRIVATE|unknown_app|Changed today/);
    assert.match(result.snapshot_fingerprint, /^[a-f0-9]{64}$/);
});
test('all nine existing namespaces coexist with apparel without changing normalization or review binding', async () => {
    const personalization = { version: 1, revision: 1, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 18, character_set: 'unicode-letters', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front', label: 'Front' }] }] };
    const metadata = { apparel: garment, toys: { ageBands: ['6-8'] }, electronics: { kind: 'hub', model: 'H1' }, food: { ingredients: 'Saved ingredients' }, furniture: { materials: ['Wood'] }, gifts: { contents: [{ label: 'Mug', quantity: 1 }] },
        beauty: { format: 'Tint' }, sports: { activity: 'Hiking', equipmentType: 'storage' }, books: { kind: 'book', language: 'Hindi', format: 'paperback' }, personalization };
    const input = source(metadata);
    const review_fingerprint = await personalizationReviewFingerprint({ product_id: input.product_id, variant_id: input.selected_variant!.id, product_version: input.product_version, facts: personalization });
    input.personalization = { facts_revision: 1, review_fingerprint, method_id: 'engrave', style_id: 'sans', placement_id: 'front', text: 'Asha' };
    const oldOnly = structuredClone(input); Reflect.deleteProperty(oldOnly.product_metadata as object, 'apparel');
    const without = await prepareProductFactSnapshot(oldOnly), withApparel = await prepareProductFactSnapshot(input);
    if (!without.ok || !withApparel.ok) assert.fail(JSON.stringify({ without, withApparel }));
    const normalized = { ...withApparel.snapshot.facts }; delete normalized.apparel;
    assert.deepEqual(normalized, without.snapshot.facts);
    assert.deepEqual(withApparel.snapshot.selected_options, without.snapshot.selected_options);
});
test('invalid apparel refuses acceptance instead of silently losing declared fulfillment facts', async () => {
    for (const apparel of [null, [], { ...garment, unit: 'm' }, { ...garment, private: 'x' },
        { ...garment, measurements: [{ size: 'M', chest: 0 }] }, { ...garment, measurements: [{ size: 'M', chest: -1 }] },
        { ...garment, measurements: [{ size: 'M', chest: Infinity }] }, { ...garment, measurements: [{ size: 'M', chest: 1001 }] },
        { ...garment, measurements: [{ size: 'M' }, { size: 'm' }] }, { ...garment, measurements: Array.from({ length: 31 }, (_, i) => ({ size: String(i) })) },
        { ...garment, fabric: 'x'.repeat(2001) }]) {
        const result = await prepareProductFactSnapshot(source({ apparel }));
        assert.equal(result.ok, false, JSON.stringify(apparel));
        if (!result.ok) assert.equal(result.error.code, 'INVALID_FACTS');
    }
});
test('apparel stays product-level and does not widen variant or unknown snapshot metadata', async () => {
    assert.equal(ProductVariantMetadataSchema.safeParse({ apparel: garment }).success, false);
    const input = source(); input.selected_variant!.metadata = { apparel: garment };
    const result = await prepareProductFactSnapshot(input); assert.equal(result.ok, false);
    assert.equal(readProductFactSnapshot({ version: 1, facts: { apparel: garment, app: {} } }), null);
    const foreign = source(); foreign.selected_variant!.product_id = '33333333-3333-4333-8333-333333333333';
    const denied = await prepareProductFactSnapshot(foreign); assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.error.code, 'VARIANT_MISMATCH');
});
test('declared top-level getters are refused without evaluation and private getters stay unobserved', async () => {
    let reads = 0;
    const declared = Object.defineProperty({}, 'apparel', { get() { reads++; throw new Error('must not evaluate'); } });
    const result = await prepareProductFactSnapshot(source(declared)); assert.equal(result.ok, false); assert.equal(reads, 0);
    const privateSibling = Object.defineProperty({ apparel: garment }, 'private', { get() { reads++; throw new Error('private'); } });
    assert.ok((await accepted(privateSibling)).snapshot.facts.apparel); assert.equal(reads, 0);
});
test('cm and in remain exact supplied garment units with no inferred size conversion', async () => {
    for (const [unit, chest] of [['cm', 102], ['in', 40.5]] as const) {
        const result = await accepted({ apparel: { ...garment, unit, measurements: [{ size: 'M', chest }] } });
        const rows = summarizeProductFacts(result.snapshot.facts).find(section => section.id === 'apparel')!.rows;
        assert.equal(rows.find(row => row.label === 'Size M')?.value, `Chest ${chest} ${unit}`);
    }
});
test('missing historical facts remain absent and malformed snapshots cannot use present catalog values', () => {
    const legacy = { version: 1, facts: {}, selected_options: [{ name: 'Size', value: 'M' }] };
    const saved = readProductFactSnapshot(legacy); assert.ok(saved); assert.equal(saved.facts.apparel, undefined);
    assert.equal(readProductFactSnapshot({ ...legacy, facts: { apparel: { fabric: 1 } } }), null);
    assert.equal(readProductFactSnapshot({ ...legacy, selected_options: [{ name: 'Size', value: 'M' }, { name: 'Size', value: 'L' }] }), null);
    assert.equal(JSON.stringify(legacy), '{"version":1,"facts":{},"selected_options":[{"name":"Size","value":"M"}]}');
});
