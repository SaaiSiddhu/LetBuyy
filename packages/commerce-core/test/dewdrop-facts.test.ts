import assert from 'node:assert/strict';
import test from 'node:test';
import { BeautyFactsSchema, readBeautyFacts } from '../src/dewdrop-facts';
const facts = { routineStage: 'colour', format: 'Lip tint', netQuantity: { value: 6, unit: 'ml' }, ingredients: 'Merchant ingredient list', directions: 'Apply a small amount.', shades: [{ value: 'Rosewater', code: 'RW01', color: '#a36a65' }, { value: 'Pink Clay', code: 'PC02', color: '#a36a65' }] };
test('beauty facts preserve same-colour named options without inventing variant identities', () => {
    const parsed = BeautyFactsSchema.parse(facts);
    assert.deepEqual(parsed.shades.map(s => s.value), ['Rosewater', 'Pink Clay']);
    assert.equal(parsed.shades[0].color, parsed.shades[1].color);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.shadeOptionName, 'Shade');
    assert.equal('variantId' in parsed.shades[0], false);
});
test('missing and explicitly absent ingredients remain missing', () => {
    const empty = BeautyFactsSchema.parse({});
    assert.equal(empty.ingredients, undefined);
    assert.equal(empty.routineStage, undefined);
    assert.deepEqual(empty.shades, []);
    assert.equal(BeautyFactsSchema.parse({ ingredients: null }).ingredients, null);
    assert.equal(BeautyFactsSchema.parse({ ingredients: '   ' }).ingredients, '');
});
test('beauty input rejects unknown fields, invalid samples, unbounded values and duplicate shades', () => {
    for (const value of [
        { ...facts, certification: 'invented' }, { ...facts, skinDiagnosis: 'inferred' },
        { netQuantity: { value: 0, unit: 'ml' } }, { netQuantity: { value: Infinity, unit: 'g' } },
        { netQuantity: { value: 20, unit: 'litres' } }, { format: 'x'.repeat(81) },
        { ingredients: 'x'.repeat(6001) }, { directions: 'x'.repeat(4001) }, { schemaVersion: 2 },
        { shades: [{ value: 'Rosewater', color: 'red;position:fixed' }] },
        { shades: [{ value: 'Rosewater', variantId: 'client-minted' }] },
        { shades: [{ value: 'Rosewater' }, { value: ' Rosewater ' }] },
        { shades: Array.from({ length: 101 }, (_, i) => ({ value: String(i) })) },
    ])
        assert.equal(BeautyFactsSchema.safeParse(value).success, false, JSON.stringify(value));
});
test('namespace reader never returns private metadata or inherited/getter input', () => {
    assert.deepEqual(readBeautyFacts({ beauty: facts, privateSupplier: 'NEVER_PUBLIC' }), BeautyFactsSchema.parse(facts));
    for (const metadata of [null, [], 'beauty', { apparel: facts }, { beauty: { unknown: true } }, Object.create({ beauty: facts })])
        assert.equal(readBeautyFacts(metadata), null);
    assert.equal(readBeautyFacts(Object.defineProperty({}, 'beauty', { get() { throw new Error('untrusted'); } })), null);
});
test('Unicode and supplied text survive without an invented safety classification', () => {
    const parsed = BeautyFactsSchema.parse({ ingredients: 'जोजोबा तेल · café', directions: '<script>alert(1)</script>', warnings: null });
    assert.equal(parsed.ingredients, 'जोजोबा तेल · café');
    assert.equal(parsed.directions, '<script>alert(1)</script>'); // Escaping belongs to the output boundary.
    assert.equal('safetyScore' in parsed, false);
});
