import assert from 'node:assert/strict'
import test from 'node:test'
import { planProductMutation } from '@letbuyy/commerce-core'
import { buildProductFormFields, defaultProductSnapshot, normalizeProductSnapshot, renameVariantOptionName, renameVariantOptionValue, type VariantOption, type VariantRow } from './product-form-state'

const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222'
const axes: VariantOption[] = [{ name: 'Shade name', values: ['Rose', 'Coral'] }, { name: 'पैक', values: ['एक', 'दो'] }]
const a: VariantRow = { id: first, title: 'Rose / एक', option1: 'Rose', option2: 'एक', option3: null, price: '560', comparePrice: '600', sku: 'SAME', stock: '2', stockBaseline: '2', factsMetadataBaseline: { toys: { finish: 'Raw baseline' } }, factsMetadataDraft: { toys: { warnings: [{ text: '' }] } }, factsMetadataEdited: true }
const z: VariantRow = { ...a, id: second, title: 'Coral / दो', option1: 'Coral', option2: 'दो', stock: '4', stockBaseline: '4', stockNeedsReview: true }

test('axis name helper preserves sparse reordered row objects, raw facts, stock intent and all values', () => {
    const rows = [z, a], before = JSON.stringify({ axes, rows })
    const renamed = renameVariantOptionName(axes, 0, '  Renamed shade option  ', rows)
    assert.deepEqual(renamed, [{ name: 'Renamed shade option', values: axes[0].values }, axes[1]])
    assert.equal(renamed[0].values, axes[0].values); assert.equal(renamed[1], axes[1])
    assert.equal(rows[0], z); assert.equal(rows[1], a)
    assert.equal(JSON.stringify({ axes, rows }), before)
    assert.equal(rows[0].factsMetadataDraft, z.factsMetadataDraft)
    assert.equal(rows[0].stockNeedsReview, true)
})

test('axis name helper keeps Unicode and three physical option slots, and unchanged names are no-ops', () => {
    const options = [...axes, { name: 'आवरण', values: ['नीला'] }]
    const rows = [{ ...a, option3: 'नीला', title: 'Rose / एक / नीला' }]
    const renamed = renameVariantOptionName(options, 2, 'रंग विकल्प', rows)
    assert.equal(renamed[0], options[0]); assert.equal(renamed[1], options[1])
    assert.equal(renamed[2].name, 'रंग विकल्प'); assert.equal(rows[0].option3, 'नीला')
    assert.equal(renameVariantOptionName(options, 2, ' आवरण ', rows), options)
})

test('axis name helper refuses blank, oversized, duplicate, stale or ambiguous input atomically', () => {
    const rows = [a, z], before = JSON.stringify({ axes, rows })
    for (const name of ['', '  ', 'x'.repeat(101), ' पैक ']) assert.throws(() => renameVariantOptionName(axes, 0, name, rows))
    for (const index of [-1, 2, .5]) assert.throws(() => renameVariantOptionName(axes, index, 'Next', rows), /changed/)
    assert.throws(() => renameVariantOptionName([{ name: 'Size', values: ['A'] }, { name: 'Cover', values: ['B'] }], 0, ' cOvEr ', [{ ...a, option1: 'A', option2: 'B' }]), /distinct/)
    for (const invalid of [[a, { ...z, id: a.id }], [a, { ...a, id: z.id }], [{ ...a, option2: null }], [{ ...a, id: 'not-a-uuid' }]]) assert.throws(() => renameVariantOptionName(axes, 0, 'Next', invalid), /combinations are kept/)
    assert.throws(() => renameVariantOptionName([axes[0], { ...axes[1], name: 'SHADE NAME' }], 0, 'Next', rows), /combinations are kept/)
    assert.equal(JSON.stringify({ axes, rows }), before)
})

test('axis name helper supports an empty trailing option and CREATE rows without generating identities', () => {
    const empty = [{ name: 'Size', values: ['M'] }, { name: 'Finish', values: [] }]
    const row = { ...a, id: undefined, title: 'M', option1: 'M', option2: null }
    const renamed = renameVariantOptionName(empty, 1, 'Surface', [row])
    assert.deepEqual(renamed, [empty[0], { name: 'Surface', values: [] }])
    assert.equal(row.id, undefined); assert.equal(row.option2, null)
    assert.deepEqual(renameVariantOptionName([{ name: 'Option', values: [] }], 0, 'Edition', []), [{ name: 'Edition', values: [] }])
})

test('axis name serialization maps the new option key without stock writes or UUID/fact/price changes', () => {
    const draft = normalizeProductSnapshot({ name: 'Bound product', stock: 8, price: 560, product_options: axes,
        variants: [{ id: first, title: 'Rose / एक', option1: 'Rose', option2: 'एक', price: 560, compare_price: 600, sku: 'SAME', inventory_qty: 2, metadata: { privateInline: 'KEEP' } },
            { id: second, title: 'Coral / दो', option1: 'Coral', option2: 'दो', price: 620, inventory_qty: 4, metadata: { food: { netQuantity: { value: 250, unit: 'g' } } } }] })
    const original = structuredClone(draft.variantMatrix)
    draft.variantOptions = renameVariantOptionName(draft.variantOptions, 0, 'Renamed shade option', draft.variantMatrix)
    const body = buildProductFormFields(draft, undefined, true)
    assert.deepEqual(body.variants.map(item => item.options), [{ 'Renamed shade option': 'Rose', 'पैक': 'एक' }, { 'Renamed shade option': 'Coral', 'पैक': 'दो' }])
    assert.equal(Object.hasOwn(body, 'stock'), false)
    assert.ok(body.variants.every(item => !Object.hasOwn(item, 'stock') && !Object.hasOwn(item, 'metadata')))
    assert.deepEqual(draft.variantMatrix, original)
    draft.variantMatrix[0] = { ...draft.variantMatrix[0], stock: '0' }
    assert.equal(buildProductFormFields(draft, undefined, true).variants[0].stock, 0)
    assert.equal(Object.hasOwn(buildProductFormFields(draft, undefined, true).variants[1], 'stock'), false)
})

test('axis name leaves fact bindings explicit; canonical writer rejects stale shades until deliberate rebinding', () => {
    // eslint-disable-next-line @letbuyy/ui/no-hardcoded-hex -- Merchant-supplied shade facts are persisted data, not UI styling tokens.
    const metadata = { beauty: { schemaVersion: 1, shadeOptionName: 'Shade name', shades: [{ value: 'Rose', color: '#CC8877' }] }, books: { kind: 'book', subjects: ['Keep'] }, privateSupplier: 'KEEP' }
    const snapshot = { ...defaultProductSnapshot, title: 'Bound beauty', price: '560', quantityBaseline: '10', variantOptions: axes, variantMatrix: [{ ...a, factsMetadataBaseline: {}, factsMetadataDraft: {}, factsMetadataEdited: false }] }
    snapshot.variantOptions = renameVariantOptionName(axes, 0, 'Renamed shade option', snapshot.variantMatrix)
    const before = JSON.stringify(metadata)
    const request = (facts: typeof metadata) => ({ ...buildProductFormFields(snapshot, facts, true), version: 7, idempotency_key: '55555555-5555-4555-8555-555555555555' })
    assert.throws(() => planProductMutation(request(metadata)), /Each shade must belong/)
    assert.equal(JSON.stringify(metadata), before)
    const rebound = { ...metadata, beauty: { ...metadata.beauty, shadeOptionName: 'Renamed shade option' } }
    const plan = planProductMutation(request(rebound))
    assert.deepEqual(plan.mutation.fields.metadata, rebound)
    assert.deepEqual(plan.mutation.variants![0].options, { 'Renamed shade option': 'Rose', 'पैक': 'एक' })
})

test('axis name and existing value rename compose without moving row identities or raw facts', () => {
    const named = renameVariantOptionName(axes, 0, 'Edition', [a, z])
    const renamed = renameVariantOptionValue(named, 0, 0, 'Rose revised', [a, z])
    assert.equal(renamed.options[0].name, 'Edition'); assert.equal(renamed.rows[0].id, first)
    assert.equal(renamed.rows[0].option1, 'Rose revised'); assert.equal(renamed.rows[1], z)
    assert.equal(renamed.rows[0].factsMetadataDraft, a.factsMetadataDraft)
    assert.equal(renamed.rows[0].stockBaseline, '2'); assert.equal(renamed.rows[1].stockNeedsReview, true)
})

test('axis name refuses the reserved object setter key instead of silently losing variant options', () => {
    const before = JSON.stringify({ axes, a })
    assert.throws(() => renameVariantOptionName(axes, 0, '__proto__', [a]), /saved safely/)
    assert.equal(JSON.stringify({ axes, a }), before)
})
