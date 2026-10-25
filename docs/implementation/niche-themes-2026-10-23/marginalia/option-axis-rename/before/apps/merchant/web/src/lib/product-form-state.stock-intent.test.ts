import { planProductMutation } from '@letbuyy/commerce-core'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProductFormFields, normalizeProductSnapshot, readUnsavedProduct, restoreProductEdit, restoreProductInventory, keepCurrentProductInventory, rebaseProductInventoryAfterSave } from './product-form-state'

const first = '22222222-2222-4222-8222-222222222222'
const second = '66666666-6666-4666-8666-666666666666'
const product = (stock = 4) => normalizeProductSnapshot({ name: 'Bound book', price: 590, stock,
    product_options: [{ name: 'Edition', values: ['English', 'Hindi'] }],
    variants: [{ id: first, title: 'English', option1: 'English', price: 590, inventory_qty: stock },
        { id: second, title: 'Hindi', option1: 'Hindi', price: 420, inventory_qty: stock }] })
const owns = (value: object, field: string) => Object.hasOwn(value, field)

test('metadata-only EDIT loaded at four omits stock and preserves server-consumed two', () => {
    const draft = { ...product(), title: 'Later title', price: '690', nicheFacts: '{"books":{"kind":"book"}}' }
    const body = buildProductFormFields(draft, { books: { kind: 'book' } }, true)
    assert.equal(owns(body, 'stock'), false)
    assert.ok(body.variants.every(item => !owns(item, 'stock')))
    const serverStock = owns(body, 'stock') ? body.stock : 2
    assert.equal(serverStock, 2)
})

test('reordered sparse EDIT emits only a changed existing quantity and new rows including zero', () => {
    const draft = product()
    draft.variantMatrix = [{ ...draft.variantMatrix[1], stock: '0' }, draft.variantMatrix[0],
        { ...draft.variantMatrix[0], id: undefined, title: 'New', option1: 'New', stock: '0' }]
    const body = buildProductFormFields(draft, undefined, true)
    assert.equal(owns(body, 'stock'), false)
    assert.deepEqual(body.variants.map(item => [item.id, owns(item, 'stock'), item.stock]), [
        [second, true, 0], [first, false, undefined], [undefined, true, 0],
    ])
    assert.equal(buildProductFormFields({ ...product(), quantity: '0' }, undefined, true).stock, 0)
})

test('tracking-only EDIT preserves quantities, CREATE still supplies all quantities', () => {
    const draft = { ...product(), trackInventory: false }
    const edit = buildProductFormFields(draft, undefined, true)
    assert.equal(edit.track_inventory, false)
    assert.equal(owns(edit, 'stock'), false)
    assert.ok(edit.variants.every(item => !owns(item, 'stock')))
    const create = buildProductFormFields({ ...draft, quantity: '0' }, undefined, false)
    assert.equal(create.stock, 0)
    assert.deepEqual(create.variants.map(item => item.stock), [4, 4])
    assert.ok(create.variants.every(item => !owns(item, 'id')))
})

const retain = (snapshot: ReturnType<typeof product>) => readUnsavedProduct(JSON.stringify({ scope: 'actor:store:product', version: 7, updatedAt: Date.now(), snapshot }), 'actor:store:product').snapshot

test('untouched retained quantities rebase by UUID after purchase without hidden inventory intent', () => {
    const draft = product()
    draft.title = 'Retained catalogue title'
    draft.variantMatrix.reverse()
    const rawFacts = { books: { kind: 'book', language: 'Hindi', format: 'paperback' }, privateSibling: 'KEEP' }
    draft.variantMatrix[0].factsMetadataDraft = structuredClone(rawFacts)
    draft.variantMatrix[0].factsMetadataBaseline = structuredClone(rawFacts)
    const original = structuredClone(draft), current = product(2)
    const recovered = restoreProductInventory(retain(draft), current)
    assert.equal(recovered.quantity, '2')
    assert.deepEqual(recovered.variantMatrix.map(row => [row.id, row.stock, row.stockBaseline]), [[second, '2', '2'], [first, '2', '2']])
    assert.deepEqual(recovered.variantMatrix[0].factsMetadataDraft, draft.variantMatrix[0].factsMetadataDraft)
    assert.equal(recovered.title, draft.title)
    assert.deepEqual(draft, original)
    const body = buildProductFormFields(recovered, undefined, true)
    assert.equal(owns(body, 'stock'), false)
    assert.ok(body.variants.every(row => !owns(row, 'stock')))
})

test('explicit retained zero survives when baseline is current; changed server inventory requires review', () => {
    const draft = { ...product(), quantity: '0' }
    draft.variantMatrix[1].stock = '0'
    const same = restoreProductInventory(retain(draft), product())
    assert.equal(buildProductFormFields(same, undefined, true).stock, 0)
    assert.equal(buildProductFormFields(same, undefined, true).variants[1].stock, 0)
    const stale = restoreProductInventory(retain(draft), product(2))
    assert.equal(stale.quantity, '0'); assert.equal(stale.quantityNeedsReview, true)
    assert.equal(stale.variantMatrix[1].stock, '0'); assert.equal(stale.variantMatrix[1].stockNeedsReview, true)
    assert.throws(() => buildProductFormFields(stale, undefined, true), /Review retained inventory/)
    const reviewed = keepCurrentProductInventory({ ...stale, price: '690' }, product(2))
    assert.equal(reviewed.price, '690')
    assert.equal(owns(buildProductFormFields(reviewed, undefined, true), 'stock'), false)
    assert.ok(buildProductFormFields(reviewed, undefined, true).variants.every(row => !owns(row, 'stock')))
})

test('legacy drafts retain their fields and require review instead of inferring stock intent', () => {
    const legacy = product()
    delete legacy.quantityBaseline
    for (const row of legacy.variantMatrix) delete row.stockBaseline
    const retained = retain(legacy), restored = restoreProductInventory(retained, product(2))
    assert.equal(restored.quantity, '4'); assert.equal(restored.quantityNeedsReview, true)
    assert.equal(restored.variantMatrix[0].stock, '4'); assert.equal(restored.variantMatrix[0].stockNeedsReview, true)
    assert.throws(() => buildProductFormFields(restored, undefined, true), /Review retained inventory/)
    const key = '55555555-5555-4555-8555-555555555555', signature = JSON.stringify(legacy)
    const intent = { scope: 'actor:store:product', key, version: 7, payload: JSON.stringify({ stock: 4, version: 7, idempotency_key: key }), signature, variantSignature: JSON.stringify(legacy.variantMatrix), hasNewVariants: false }
    const recovered = restoreProductEdit(JSON.stringify({ ...intent, draftSignature: signature }), intent.scope)
    assert.deepEqual(recovered.intent, intent)
    assert.equal(recovered.draft.quantityNeedsReview, true)
    assert.throws(() => buildProductFormFields(recovered.draft, undefined, true), /Review retained inventory/)
    const acknowledged = rebaseProductInventoryAfterSave(recovered.draft, legacy, product(4))
    assert.equal(owns(buildProductFormFields(acknowledged, undefined, true), 'stock'), false)
})

test('unreadable inventory evidence is refused and missing UUIDs cannot inherit another row baseline', () => {
    const wrong = { ...product(), quantityBaseline: 4 }
    assert.throws(() => retain(wrong as unknown as ReturnType<typeof product>), /unreadable/)
    const rows = product(); rows.variantMatrix[0].stockNeedsReview = 'false' as unknown as boolean
    assert.throws(() => retain(rows), /unreadable/)
    const draft = product(); const current = product(2); current.variantMatrix.shift()
    const restored = restoreProductInventory(draft, current)
    assert.equal(restored.variantMatrix[0].id, first)
    assert.equal(restored.variantMatrix[0].stockNeedsReview, true)
    assert.equal(keepCurrentProductInventory(restored, current).variantMatrix[0].stockNeedsReview, true)
    assert.throws(() => buildProductFormFields(restored, undefined, true), /Review retained inventory/)
})

test('acknowledgement clears only sent stock intent and retains newer zero or reverted quantities by UUID', () => {
    const sent = { ...product(), quantity: '0' }
    sent.variantMatrix[0].stock = '0'
    const acknowledged = product(0)
    acknowledged.variantMatrix[1].stock = '2'; acknowledged.variantMatrix[1].stockBaseline = '2'
    const metadataOnly = rebaseProductInventoryAfterSave({ ...sent, title: 'Newer title' }, sent, acknowledged)
    const omitted = buildProductFormFields(metadataOnly, undefined, true)
    assert.equal(owns(omitted, 'stock'), false); assert.ok(omitted.variants.every(row => !owns(row, 'stock')))
    const newer = { ...sent, quantity: '4', variantMatrix: [{ ...sent.variantMatrix[1], stock: '0' }, { ...sent.variantMatrix[0], stock: '4' }, { ...sent.variantMatrix[0], id: undefined, stock: '0' }] }
    const rebased = rebaseProductInventoryAfterSave(newer, sent, acknowledged)
    const body = buildProductFormFields(rebased, undefined, true)
    assert.equal(body.stock, 4)
    assert.deepEqual(body.variants.map(row => [row.id, row.stock]), [[second, 0], [first, 4], [undefined, 0]])
    assert.equal(rebased.variantMatrix[2].id, undefined, 'new UUIDs are not guessed from tuple or index')
})

test('an omitted pending command rebases old untouched quantities to acknowledgement, preserving newer facts', () => {
    const sent = product(), draft = { ...sent, title: 'Newer metadata' }, acknowledged = product(2)
    const rebased = rebaseProductInventoryAfterSave(draft, sent, acknowledged)
    assert.equal(rebased.quantity, '2'); assert.equal(rebased.title, 'Newer metadata')
    const body = buildProductFormFields(rebased, undefined, true)
    assert.equal(owns(body, 'stock'), false); assert.ok(body.variants.every(row => !owns(row, 'stock')))
    const ambiguous = { ...draft, quantity: '0', quantityBaseline: undefined, quantityNeedsReview: true }
    assert.throws(() => buildProductFormFields(rebaseProductInventoryAfterSave(ambiguous, sent, acknowledged), undefined, true), /Review retained inventory/)
})

test('the canonical edit schema and planner retain omitted stock, explicit zero and idless new stock', () => {
    const draft = product()
    draft.variantMatrix.push({ ...draft.variantMatrix[0], id: undefined, title: 'New', option1: 'New', stock: '0' })
    const fields = buildProductFormFields(draft, undefined, true)
    const plan = planProductMutation({ ...fields, version: 7, idempotency_key: '55555555-5555-4555-8555-555555555555' })
    assert.equal(owns(plan.mutation, 'stock'), false)
    assert.ok(plan.mutation.variants!.slice(0, 2).every(row => !owns(row, 'stock')))
    assert.equal(plan.mutation.variants![2].stock, 0)
    const zero = planProductMutation({ ...buildProductFormFields({ ...draft, quantity: '0' }, undefined, true), version: 7, idempotency_key: '55555555-5555-4555-8555-555555555555' })
    assert.equal(zero.mutation.stock, 0)
    assert.doesNotMatch(JSON.stringify(plan.mutation), /stockBaseline|stockNeedsReview|quantityBaseline|quantityNeedsReview/)
})
