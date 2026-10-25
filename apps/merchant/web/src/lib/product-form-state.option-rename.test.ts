import assert from 'node:assert/strict'
import test from 'node:test'
import { renameVariantOptionValue, type VariantOption, type VariantRow } from './product-form-state'

const options: VariantOption[] = [{ name: 'Edition', values: ['English hardback', 'हिन्दी paperback'] }, { name: 'Cover', values: ['Blue', 'Green'] }]
const first: VariantRow = { id: '11111111-1111-4111-8111-111111111111', option1: 'English hardback', option2: 'Blue', option3: null, title: 'English hardback / Blue', price: '590', comparePrice: '700', sku: 'SAME-SKU', stock: '3', factsMetadataBaseline: { books: { language: 'English' }, food: { netQuantity: { value: 250, unit: 'g' } } }, factsMetadataDraft: { books: { language: 'Marathi' }, food: { netQuantity: { value: 250, unit: 'g' } } }, factsMetadataEdited: true }
const second: VariantRow = { ...first, id: '22222222-2222-4222-8222-222222222222', option1: 'हिन्दी paperback', option2: 'Green', title: 'हिन्दी paperback / Green', price: '420', stock: '4', factsMetadataEdited: false }

test('explicit rename preserves sparse row identities, raw facts, other axes and commercial fields', () => {
    const rows = [second, first]
    const original = JSON.stringify({ options, rows })
    const result = renameVariantOptionValue(options, 0, 0, '  मराठी  spiral edition  ', rows)
    assert.equal(result.rows.length, 2, 'no missing Cartesian combinations are created')
    assert.equal(result.rows[0], second)
    assert.deepEqual(result.rows[1], { ...first, option1: 'मराठी  spiral edition', title: 'मराठी  spiral edition / Blue' })
    assert.equal(result.rows[1].factsMetadataBaseline, first.factsMetadataBaseline)
    assert.equal(result.rows[1].factsMetadataDraft, first.factsMetadataDraft)
    assert.equal(result.options[1], options[1])
    assert.deepEqual(result.options[0].values, ['मराठी  spiral edition', 'हिन्दी paperback'])
    assert.equal(JSON.stringify({ options, rows }), original, 'inputs never mutate')
})

test('renaming a second axis updates every affected row without borrowing UUIDs or facts', () => {
    const rows = [first, { ...second, option2: 'Blue', title: 'हिन्दी paperback / Blue' }]
    const result = renameVariantOptionValue(options, 1, 0, 'Azure', rows)
    assert.deepEqual(result.rows, rows.map(row => ({ ...row, option2: 'Azure', title: `${row.option1} / Azure` })))
    assert.deepEqual(result.rows.map(row => row.id), rows.map(row => row.id))
    assert.equal(result.options[0], options[0])
})

test('unchanged normalized value is a true no-op and new rows remain unbound', () => {
    const rows = [first]
    const same = renameVariantOptionValue(options, 0, 0, ' English hardback ', rows)
    assert.equal(same.options, options); assert.equal(same.rows, rows)
    const unbound = { ...second }; delete unbound.id
    const renamed = renameVariantOptionValue(options, 0, 1, 'New paperback', [first, unbound])
    assert.equal(Object.hasOwn(renamed.rows[1], 'id'), false)
    assert.equal(renamed.rows[1].factsMetadataDraft, unbound.factsMetadataDraft)
})

test('blank, oversized, duplicate and stale selections refuse atomically', () => {
    const rows = [first, second], original = JSON.stringify({ options, rows })
    for (const value of ['', '  ', 'x'.repeat(101), ' हिन्दी paperback ']) assert.throws(() => renameVariantOptionValue(options, 0, 0, value, rows))
    for (const [axis, index] of [[-1, 0], [0, -1], [3, 0], [0, 2], [0.5, 0], [0, 0.5]]) assert.throws(() => renameVariantOptionValue(options, axis, index, 'New', rows))
    assert.equal(JSON.stringify({ options, rows }), original)
})

test('ambiguous axes, missing source rows, duplicate IDs and colliding tuples never merge rows', () => {
    const variants: { axes: VariantOption[]; rows: VariantRow[] }[] = [
        { axes: [{ name: 'Edition', values: [] }, ...options], rows: [first] },
        { axes: [options[0], { ...options[1], name: 'Edition' }], rows: [first] },
        { axes: [{ ...options[0], values: ['English hardback', 'English hardback'] }, options[1]], rows: [first] },
        { axes: options, rows: [second] },
        { axes: options, rows: [first, { ...second, id: first.id }] },
        { axes: options, rows: [first, { ...first, id: second.id }] },
        { axes: options, rows: [{ ...first, option2: null }] },
        { axes: [options[0]], rows: [first] },
    ]
    for (const { axes, rows } of variants) {
        const before = JSON.stringify({ axes, rows })
        assert.throws(() => renameVariantOptionValue(axes, 0, 0, 'New', rows), /Variant combinations are kept|This option value has changed/)
        assert.equal(JSON.stringify({ axes, rows }), before)
    }
})

test('canonical combined-label limit refuses an unsaveable rename without changing either row', () => {
    const axes = [{ name: 'Edition', values: ['A'] }, { name: 'Cover', values: ['x'.repeat(100)] }]
    const rows = [{ ...first, option1: 'A', option2: 'x'.repeat(100), title: `A / ${'x'.repeat(100)}` }]
    const original = JSON.stringify({ axes, rows })
    assert.throws(() => renameVariantOptionValue(axes, 0, 0, 'y'.repeat(100), rows), /combined variant label/)
    assert.equal(JSON.stringify({ axes, rows }), original)
    assert.equal(renameVariantOptionValue(axes, 0, 0, 'y'.repeat(97), rows).rows[0].title.length, 200)
})
