import assert from 'node:assert/strict'
import test from 'node:test'
import { ApparelFactsSchema, PRODUCT_NICHE_FACT_SCHEMAS } from '@letbuyy/commerce-core'
import { composeProductMetadata, captureProductFacts, readProductFactsDraft, updateProductFactsDraft, resolveProductGiftImages } from './product-facts-draft'
import { defaultProductSnapshot, createFormSignature, readUnsavedProduct, normalizeProductSnapshot, restoreProductEdit, retainProductMediaReferences } from './product-form-state'

test('facts save preserves private siblings and other namespaces while deliberate clear removes the namespace', () => {
    const base = { privateSupplier: { reference: 'MERCHANT_ONLY' }, food: { ingredients: 'Lentils' }, books: { kind: 'book', language: 'Hindi' } }
    const initial = JSON.stringify(captureProductFacts(base))
    const next = updateProductFactsDraft(initial, base, 'food', null)
    const result = composeProductMetadata(base, '{}', next)
    assert.equal(result.food, undefined)
    assert.deepEqual(result.privateSupplier, base.privateSupplier)
    assert.equal((result.books as Record<string, unknown>).language, 'Hindi')
    assert.equal(base.food.ingredients, 'Lentils')
})

test('invalid draft remains editable but cannot become a validated mutation or inject unsupported namespaces', () => {
    const draft = updateProductFactsDraft('', {}, 'personalization', { version: 1, revision: '', methods: [] })
    assert.deepEqual(readProductFactsDraft(draft).personalization, { version: 1, revision: '', methods: [] })
    assert.throws(() => composeProductMetadata({}, '{}', draft), /Check product facts/)
    assert.throws(() => updateProductFactsDraft(draft, {}, 'privateSupplier', 'tampered'), /Unsupported/)
    assert.throws(() => composeProductMetadata({}, '{}', '{"privateSupplier":"tampered"}'), /unsupported fields/)
    assert.throws(() => composeProductMetadata({}, '{}', '[]'), /unsupported fields/)
})

test('retained drafts and exact pending commands preserve new raw facts and upgrade old snapshots without clearing server facts', () => {
    const metadata = { sports: { activity: 'badminton', equipmentType: 'racket' }, privateSupplier: 'KEEP' }
    const loaded = normalizeProductSnapshot({ metadata })
    assert.equal(JSON.parse(loaded.nicheFacts).sports.activity, 'badminton')
    const raw = { ...defaultProductSnapshot, nicheFacts: '{"personalization":{"revision":""}}' }
    assert.notEqual(createFormSignature(raw), createFormSignature(defaultProductSnapshot))
    const recovered = readUnsavedProduct(JSON.stringify({ scope: 'actor:store:product', version: 2, updatedAt: Date.now(), snapshot: raw }), 'actor:store:product')
    assert.equal(recovered.snapshot.nicheFacts, raw.nicheFacts)
    const old = { ...defaultProductSnapshot } as Partial<typeof defaultProductSnapshot>
    delete old.nicheFacts
    const legacy = readUnsavedProduct(JSON.stringify({ scope: 'actor:store:product', version: 2, updatedAt: Date.now(), snapshot: old }), 'actor:store:product')
    assert.equal(legacy.snapshot.nicheFacts, '')
    assert.equal((composeProductMetadata(metadata, '{}', legacy.snapshot.nicheFacts).sports as Record<string, unknown>).activity, 'badminton')
    const payload = JSON.stringify({ version: 2, idempotency_key: '11111111-1111-4111-8111-111111111111', metadata })
    const restored = restoreProductEdit(JSON.stringify({ scope: 'actor:store:product', key: '11111111-1111-4111-8111-111111111111', version: 2, payload, signature: JSON.stringify(old), variantSignature: '[]', hasNewVariants: false }), 'actor:store:product')
    assert.equal(restored.intent.payload, payload)
    assert.equal(restored.draft.nicheFacts, '')
})

const open = 'https://cdn.example.test/open.webp', closed = 'https://cdn.example.test/closed.webp'
test('gift image identity rebases a changed order while preserving malformed content and sibling facts', () => {
    const raw = { gifts: { contents: [{ label: 'Mug', quantity: '' }], mediaRoles: { openBox: 0, closedBox: 1 } }, books: { kind: 'book', language: 'Hindi' } }
    const value = JSON.stringify(raw), before = structuredClone(raw)
    const resolved = resolveProductGiftImages(value, {}, JSON.stringify([open, closed]), [closed, open])
    assert.equal(resolved.issue, undefined)
    assert.deepEqual(JSON.parse(resolved.value).gifts, { contents: [{ label: 'Mug', quantity: '' }], mediaRoles: { openBox: 1, closedBox: 0 } })
    assert.deepEqual(JSON.parse(resolved.value).books, raw.books)
    assert.deepEqual(raw, before)
    assert.throws(() => composeProductMetadata({ privateSupplier: 'KEEP' }, '{}', resolved.value), /Check product facts/)
    const corrected = JSON.parse(resolved.value); corrected.gifts.contents[0].quantity = 1
    assert.equal(composeProductMetadata({ privateSupplier: 'KEEP' }, '{}', JSON.stringify(corrected)).privateSupplier, 'KEEP')
})

test('removed and ambiguous gift views clear without guessing or manufacturing empty facts', () => {
    const value = JSON.stringify({ gifts: { mediaRoles: { openBox: 0, closedBox: 1 } } })
    const duplicate = resolveProductGiftImages(value, {}, JSON.stringify([open, closed]), [open, open, closed])
    assert.deepEqual(JSON.parse(duplicate.value).gifts.mediaRoles, { closedBox: 2 })
    const removed = resolveProductGiftImages(value, {}, JSON.stringify([open, closed]), ['https://cdn.example.test/new.webp'])
    assert.equal('gifts' in JSON.parse(removed.value), false)
    const malformed = JSON.stringify({ gifts: { contents: [{ label: '', quantity: '' }], mediaRoles: { openBox: 'unfinished', closedBox: 1 }, unsupported: 'kept for explicit repair' } })
    const preserved = JSON.parse(resolveProductGiftImages(malformed, {}, JSON.stringify([open, closed]), [closed, open]).value)
    assert.deepEqual(preserved.gifts.contents, [{ label: '', quantity: '' }])
    assert.deepEqual(preserved.gifts.mediaRoles, { openBox: 'unfinished', closedBox: 0 })
    assert.equal(preserved.gifts.unsupported, 'kept for explicit repair')
})

test('retention removes bearer image URLs without shifting closed-view identity or losing invalid input', () => {
    const bearer = 'https://cdn.example.test/private.webp?token=NEVER_RETAIN'
    const snapshot = { ...defaultProductSnapshot, images: [bearer, closed], giftMediaImageOrder: JSON.stringify([bearer, closed]), nicheFacts: JSON.stringify({ gifts: { contents: [{ label: 'Mug', quantity: '' }], mediaRoles: { openBox: 0, closedBox: 1 } } }) }
    const retained = retainProductMediaReferences(snapshot)
    assert.deepEqual(retained.images, [closed])
    assert.deepEqual(JSON.parse(retained.giftMediaImageOrder), [closed])
    assert.deepEqual(JSON.parse(retained.nicheFacts).gifts.mediaRoles, { closedBox: 0 })
    assert.equal(JSON.parse(retained.nicheFacts).gifts.contents[0].quantity, '')
    assert.doesNotMatch(JSON.stringify(retained), /NEVER_RETAIN|private\.webp/)
    assert.equal(snapshot.images[0], bearer)
})

test('legacy or corrupt image associations require review and never silently adopt filtered indices', () => {
    const snapshot = { ...defaultProductSnapshot, images: [closed, open], nicheFacts: JSON.stringify({ gifts: { mediaRoles: { openBox: 0, closedBox: 1 } } }) } as Partial<typeof defaultProductSnapshot>
    delete snapshot.giftMediaImageOrder
    const recovered = readUnsavedProduct(JSON.stringify({ scope: 'scope', version: 2, updatedAt: Date.now(), snapshot }), 'scope').snapshot
    assert.equal(recovered.giftMediaImageOrder, '')
    const unknown = resolveProductGiftImages(recovered.nicheFacts, {}, recovered.giftMediaImageOrder, recovered.images)
    assert.match(unknown.issue!, /Review the gift image views/)
    assert.equal(unknown.value, recovered.nicheFacts)
    const reviewed = resolveProductGiftImages(unknown.value, {}, JSON.stringify(recovered.images), recovered.images)
    assert.equal(reviewed.issue, undefined)
    assert.deepEqual(JSON.parse(reviewed.value).gifts.mediaRoles, { openBox: 0, closedBox: 1 })
    const safe = retainProductMediaReferences({ ...recovered, giftMediaImageOrder: 'https://cdn.example.test/private?token=NEVER_RETAIN' })
    assert.equal(safe.giftMediaImageOrder, '')
    assert.doesNotMatch(JSON.stringify(safe), /NEVER_RETAIN/)
})

test('legacy pending command identity remains byte-exact while only its presentation snapshot upgrades', () => {
    const snapshot = { ...defaultProductSnapshot, images: [open, closed], nicheFacts: JSON.stringify({ gifts: { mediaRoles: { openBox: 0 } } }) } as Partial<typeof defaultProductSnapshot>
    delete snapshot.giftMediaImageOrder
    const signature = JSON.stringify(snapshot), key = '11111111-1111-4111-8111-111111111111'
    const payload = JSON.stringify({ images: [open, closed], metadata: { gifts: { mediaRoles: { openBox: 0 } } }, version: 2, idempotency_key: key })
    const restored = restoreProductEdit(JSON.stringify({ scope: 'scope', key, version: 2, payload, signature, variantSignature: '[]', hasNewVariants: false }), 'scope')
    assert.equal(restored.intent.payload, payload)
    assert.equal(restored.intent.signature, signature)
    assert.equal(restored.intent.key, key)
    assert.equal(restored.draft.giftMediaImageOrder, '')
    assert.match(resolveProductGiftImages(restored.draft.nicheFacts, {}, restored.draft.giftMediaImageOrder, restored.draft.images).issue!, /Review the gift image views/)
})

test('untouched empty garment draft preserves absent apparel on the actual beauty-shaped save', () => {
    const metadata = { privateSupplier: { reference: 'KEEP' }, beauty: { schemaVersion: 1, routineStage: 'cleanse', ingredients: 'Aqua', directions: 'Supplied directions', netQuantity: { unit: 'ml', value: 150 }, shades: [], shadeOptionName: 'Shade' } }
    const snapshot = normalizeProductSnapshot({ metadata })
    assert.equal(snapshot.apparelFacts, '{}')
    const saved = composeProductMetadata(metadata, snapshot.apparelFacts, snapshot.nicheFacts)
    assert.equal(Object.hasOwn(saved, 'apparel'), false, 'an untouched optional garment editor must not create apparel facts')
    assert.deepEqual(saved, metadata)
})

const absentApparelNiches = {
    toys: { materials: 'Wood' },
    electronics: { model: 'Synthetic H1' },
    food: { ingredients: 'Lentils' },
    furniture: { care: 'Wipe dry' },
    gifts: { contents: [{ label: 'Mug', quantity: 1 }] },
    personalization: { version: 1, revision: 1, methods: [{ id: 'name', label: 'Printed name', min_graphemes: 1, max_graphemes: 20, character_set: 'unicode-letters', styles: [{ id: 'plain', label: 'Plain' }], placements: [{ id: 'front', label: 'Front' }] }] },
    beauty: { routineStage: 'cleanse', ingredients: 'Aqua' },
    sports: { activity: 'badminton', equipmentType: 'racket' },
    books: { kind: 'book', subjects: ['Essays'] },
} satisfies Record<keyof typeof PRODUCT_NICHE_FACT_SCHEMAS, unknown>

for (const namespace of Object.keys(absentApparelNiches) as (keyof typeof absentApparelNiches)[]) {
    test(`absent apparel survives ${namespace} hydration and retained-facts roundtrip with private and niche siblings`, () => {
        const facts = PRODUCT_NICHE_FACT_SCHEMAS[namespace].parse(absentApparelNiches[namespace])
        const sibling = namespace === 'food' ? { books: { kind: 'book', subjects: ['Essays'] } } : { food: { ingredients: 'Lentils' } }
        const metadata = { privateSupplier: { reference: 'KEEP', nested: { immutable: true } }, ...sibling, [namespace]: facts }
        const original = structuredClone(metadata), snapshot = normalizeProductSnapshot({ metadata })
        for (const factsJson of [snapshot.nicheFacts, '']) {
            const saved = composeProductMetadata(metadata, snapshot.apparelFacts, factsJson)
            assert.equal(Object.hasOwn(saved, 'apparel'), false)
            assert.deepEqual(saved, metadata)
        }
        assert.deepEqual(metadata, original)
    })
}

test('empty new metadata and stationery facts stay free of invented garment facts', () => {
    for (const baseline of [undefined, {}, { books: { kind: 'stationery', paper_gsm: 100, page_count: 96, sheet_count: 48 } }]) {
        const snapshot = normalizeProductSnapshot({ metadata: baseline })
        const saved = composeProductMetadata(baseline, ' \n { } \t ', snapshot.nicheFacts)
        assert.equal(Object.hasOwn(saved, 'apparel'), false)
        assert.deepEqual(saved, baseline ?? {})
    }
})

test('meaningful existing apparel roundtrips and deliberate garment edit and clear keep their established semantics', () => {
    const apparel = ApparelFactsSchema.parse({ fit: 'Roomy', fabric: 'Cotton', care: 'Wash gently', unit: 'cm', measurements: [{ size: 'M', chest: 98 }] })
    const metadata = { apparel, privateSupplier: 'KEEP', books: { kind: 'book', subjects: ['Essays'] } }
    const snapshot = normalizeProductSnapshot({ metadata })
    assert.deepEqual(composeProductMetadata(metadata, snapshot.apparelFacts, snapshot.nicheFacts), metadata)
    const changed = composeProductMetadata(metadata, JSON.stringify({ ...apparel, fit: 'Tailored' }), snapshot.nicheFacts)
    assert.deepEqual(changed, { ...metadata, apparel: { ...apparel, fit: 'Tailored' } })
    const cleared = composeProductMetadata(metadata, '{}', snapshot.nicheFacts)
    assert.deepEqual(cleared, { ...metadata, apparel: ApparelFactsSchema.parse({}) })
    assert.equal(Object.hasOwn(cleared, 'apparel'), true, 'explicit clear on an existing garment is not mistaken for absence')
    assert.deepEqual(metadata.apparel, apparel)
})

test('explicit new garment facts and intentionally supplied empty fields remain authored values', () => {
    for (const input of [{ fabric: 'Cotton' }, { fit: '' }, { unit: 'in', measurements: [] }]) {
        const metadata = { privateSupplier: 'KEEP', food: { ingredients: 'Lentils' } }
        const saved = composeProductMetadata(metadata, JSON.stringify(input), '')
        assert.deepEqual(saved, { ...metadata, apparel: ApparelFactsSchema.parse(input) })
    }
})

test('absence preservation never bypasses malformed JSON, arrays, unknown garment fields or invalid measurements', () => {
    const invalid = ['{', '[]', 'null', 'true', '0', '""', '{"unknown":"kept"}', '{"measurements":[{"size":"M","chest":0}]}', '{"measurements":[{"size":"M"},{"size":"m"}]}']
    for (const apparel of [undefined, ApparelFactsSchema.parse({ fabric: 'Cotton' })]) {
        const metadata = { privateSupplier: 'KEEP', ...(apparel ? { apparel } : {}), books: { kind: 'book', language: 'Hindi' } }
        const before = structuredClone(metadata)
        for (const raw of invalid) assert.throws(() => composeProductMetadata(metadata, raw, ''), /Check garment details/)
        assert.deepEqual(metadata, before)
    }
})
