import assert from 'node:assert/strict'
import test from 'node:test'
import { appendVariantOptionAxis, appendVariantOptionValue, buildVariantMatrix, renameVariantOptionValue, type VariantOption, type VariantRow } from './product-form-state'
import { variantFactsCommand } from './variant-facts-draft'

const first: VariantRow = { id: '11111111-1111-4111-8111-111111111111', option1: '48 in', option2: null, option3: null, title: '48 in', price: '8900', comparePrice: '9900', sku: 'KEEP-A', stock: '4', factsMetadataBaseline: { furniture: { assembled: { unit: 'in', width: 48 } } }, factsMetadataDraft: { furniture: { assembled: { unit: 'in', width: 48, depth: 30 } } }, factsMetadataEdited: true }
const second: VariantRow = { ...first, id: '22222222-2222-4222-8222-222222222222', option1: 'Common size', title: 'Common size', sku: 'KEEP-C', stock: '3', factsMetadataBaseline: { furniture: {} }, factsMetadataDraft: { furniture: {} }, factsMetadataEdited: false }

test('first value of a new trailing axis preserves both bound Width rows one-to-one', () => {
    const options = [{ name: 'Width', values: ['48 in', 'Common size'] }, { name: 'Finish', values: [] }]
    const rows = [first, second], before = JSON.stringify({ options, rows })
    const result = appendVariantOptionValue(options, 1, 'Natural', '100', rows)
    assert.deepEqual(result, rows.map(row => ({ ...row, option2: 'Natural', title: `${row.option1} / Natural` })))
    result.forEach((row, index) => {
        assert.equal(row.factsMetadataBaseline, rows[index].factsMetadataBaseline)
        assert.equal(row.factsMetadataDraft, rows[index].factsMetadataDraft)
    })
    assert.equal(JSON.stringify({ options, rows }), before)
})

test('adding an empty axis preserves sparse and reordered rows without completing a Cartesian matrix', () => {
    const axes = [{ name: 'Width', values: ['48 in', 'Common size', '130 cm'] }], rows = [second, first]
    const before = JSON.stringify({ axes, rows })
    const next = appendVariantOptionAxis(axes, 'Finish', rows)
    assert.equal(next[0], axes[0]); assert.deepEqual(next[1], { name: 'Finish', values: [] })
    const added = appendVariantOptionValue(next, 1, 'Natural', '100', rows)
    assert.deepEqual(added.map(row => row.id), [second.id, first.id])
    assert.equal(added.length, 2, 'missing 130 cm is not fabricated')
    assert.equal(JSON.stringify({ axes, rows }), before)
})

test('a third axis extends only existing sparse combinations and retains mixed bound/new drafts', () => {
    const axes = [{ name: 'Width', values: ['48 in', 'Common size'] }, { name: 'Finish', values: ['Natural', 'Black'] }]
    const unbound = { ...second, id: undefined, option2: 'Black', title: 'Common size / Black' }
    const rows = [{ ...first, option2: 'Natural', title: '48 in / Natural' }, unbound]
    const added = appendVariantOptionValue(appendVariantOptionAxis(axes, 'Pack', rows), 2, 'Single', '100', rows)
    assert.equal(added.length, 2)
    added.forEach((row, index) => {
        assert.deepEqual(row, { ...rows[index], option3: 'Single', title: `${rows[index].title} / Single` })
        assert.equal(row.factsMetadataDraft, rows[index].factsMetadataDraft)
    })
})

test('first explicit axis can extend a single default bound row without inventing identity', () => {
    const row = { ...first, option1: null, title: 'Default' }
    const added = appendVariantOptionValue(appendVariantOptionAxis([], 'Edition', [row]), 0, 'English', '100', [row])
    assert.deepEqual(added, [{ ...row, option1: 'English', title: 'English' }])
})

test('later values retain old objects while new combinations receive no UUID, facts, SKU or stock', () => {
    const axes = [{ name: 'Width', values: ['48 in', 'Common size'] }, { name: 'Finish', values: ['Natural'] }]
    const rows = appendVariantOptionValue([{ ...axes[0] }, { name: 'Finish', values: [] }], 1, 'Natural', '100', [second, first])
    const added = appendVariantOptionValue(axes, 1, 'Black', '200', rows)
    assert.equal(added[0], rows[0]); assert.equal(added[1], rows[1])
    assert.deepEqual(added.slice(2).map(row => [row.option1, row.option2]), [['48 in', 'Black'], ['Common size', 'Black']])
    added.slice(2).forEach(row => {
        assert.equal(Object.hasOwn(row, 'id'), false)
        assert.deepEqual(row.factsMetadataDraft, {}); assert.deepEqual(row.factsMetadataBaseline, {})
        assert.equal(row.price, '200'); assert.equal(row.stock, '0'); assert.equal(row.sku, ''); assert.equal(row.comparePrice, '')
    })
})

test('raw invalid fact drafts survive the axis edit and still block canonical save instead of being reset', () => {
    const draft = { furniture: { assembled: { width: 48 } } }, row = { ...first, factsMetadataDraft: draft, factsMetadataEdited: true }
    const axes = [{ name: 'Width', values: ['48 in', 'Common size'] }, { name: 'Finish', values: [] }]
    const [added] = appendVariantOptionValue(axes, 1, 'Natural', '100', [row])
    assert.equal(added.factsMetadataDraft, draft); assert.equal(added.factsMetadataBaseline, first.factsMetadataBaseline)
    assert.equal(added.factsMetadataEdited, true)
    assert.throws(() => variantFactsCommand(added), /Check variant facts/)
})

test('ambiguous axes, duplicate IDs/tuples, occupied new slots and stale indices refuse atomically', () => {
    const width = { name: 'Width', values: ['48 in', 'Common size'] }, empty = { name: 'Finish', values: [] }
    const cases: { axes: VariantOption[]; rows: VariantRow[]; index: number; value?: string }[] = [
        { axes: [width, { ...empty, name: 'width' }], rows: [first], index: 1 },
        { axes: [width, { ...empty, name: ' Finish ' }], rows: [first], index: 1 },
        { axes: [empty, width], rows: [first], index: 0 },
        { axes: [width, empty, { name: 'Pack', values: [] }], rows: [first], index: 2 },
        { axes: [width, empty], rows: [first, { ...second, id: first.id }], index: 1 },
        { axes: [width, empty], rows: [first, { ...first, id: second.id }], index: 1 },
        { axes: [width, empty], rows: [{ ...first, id: 'not-a-uuid' }], index: 1 },
        { axes: [width, empty], rows: [{ ...first, option2: 'Occupied' }], index: 1 },
        { axes: [width, empty], rows: [{ ...first, option1: 'Missing' }], index: 1 },
        { axes: [{ ...width, values: ['48 in', '48 in'] }, empty], rows: [first], index: 1 },
        { axes: [width, empty], rows: [first], index: 1.5 },
        { axes: [width, empty], rows: [first], index: -1 },
        { axes: [width, empty], rows: [first], index: 1, value: '  ' },
        { axes: [width, empty], rows: [first], index: 1, value: ' Natural ' },
        { axes: [width, empty], rows: [first], index: 1, value: 'x'.repeat(101) },
    ]
    for (const item of cases) {
        const before = JSON.stringify(item)
        assert.throws(() => appendVariantOptionValue(item.axes, item.index, item.value ?? 'Natural', '100', item.rows))
        assert.equal(JSON.stringify(item), before)
    }
    assert.throws(() => appendVariantOptionAxis([width], 'WIDTH', [first]))
    assert.throws(() => appendVariantOptionAxis([width, empty], 'Pack', [first]))
})

test('canonical axis, value, row-count and combined-label limits are enforced before producing an edit', () => {
    const axes = [{ name: 'One', values: ['A'] }, { name: 'Two', values: ['B'] }, { name: 'Three', values: ['C'] }]
    const row = { ...first, option1: 'A', option2: 'B', option3: 'C', title: 'A / B / C' }
    assert.throws(() => appendVariantOptionAxis(axes, 'Fourth', [row]))
    assert.throws(() => appendVariantOptionValue([...axes, { name: 'Fourth', values: [] }], 3, 'D', '1', [row]))
    const wide = { name: 'Width', values: Array.from({ length: 100 }, (_, index) => String(index)) }
    const sparse = [{ ...first, option1: '0', option2: 'Natural', title: '0 / Natural' }]
    assert.throws(() => appendVariantOptionValue([wide, { name: 'Finish', values: ['Natural'] }], 1, 'Black', '1', sparse), /100 variant combinations/)
    assert.throws(() => appendVariantOptionValue([wide], 0, '101', '1', []), /value limits/)
    const long = { ...first, option1: 'a'.repeat(100) }, option = { name: 'Width', values: [long.option1] }
    assert.throws(() => appendVariantOptionValue([option, { name: 'Finish', values: [] }], 1, 'b'.repeat(100), '1', [long]), /combined variant label/)
    const boundary = { ...long, option1: 'a'.repeat(97) }
    assert.equal(appendVariantOptionValue([{ ...option, values: [boundary.option1] }, { name: 'Finish', values: [] }], 1, 'b'.repeat(100), '1', [boundary])[0].title.length, 200)
})

test('new-product Cartesian creation and explicit existing-axis append/rename remain supported; generic deletion stays guarded', () => {
    const axes = [{ name: 'Width', values: ['48 in', 'Common size'] }]
    const created = appendVariantOptionValue(appendVariantOptionAxis(axes, 'Finish', []), 1, 'Natural', '100', [])
    assert.equal(created.length, 2); created.forEach(row => assert.equal(row.id, undefined))
    const renamed = renameVariantOptionValue(axes, 0, 0, '48 inch', [first, second])
    assert.equal(renamed.rows[0].id, first.id)
    const appended = appendVariantOptionValue(axes, 0, '130 cm', '100', [second, first])
    assert.equal(appended[0], second); assert.equal(appended[1], first); assert.equal(appended[2].id, undefined)
    assert.throws(() => buildVariantMatrix([], '100', [first, second]), /combinations are kept/)
    assert.throws(() => buildVariantMatrix([{ name: 'Width', values: ['Common size', '48 in'] }], '100', [first, second]), /combinations are kept/)
})
