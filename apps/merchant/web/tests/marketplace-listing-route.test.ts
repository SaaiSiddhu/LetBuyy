import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import { createMarketplaceListingHandlers } from '../src/app/api/stores/[store]/marketplace-listings/[productId]/handler'

const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const LISTING = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LISTING_ROW = { id: LISTING, product_id: PRODUCT, status: 'rejected', rejection_reason: 'Add the missing origin disclosure.' }

type Dependencies = NonNullable<Parameters<typeof createMarketplaceListingHandlers>[0]>

function fixture(options: {
    storeError?: NextResponse<{ error: string }>
    listing?: typeof LISTING_ROW | null
    mutationStatus?: number
} = {}) {
    const apiCalls: Array<{ path: string; init: RequestInit & { requireSession?: boolean } }> = []
    const resolvedStores: string[] = []
    const dependencies: Dependencies = {
        resolveOwnedStoreId: async (store) => {
            resolvedStores.push(store)
            return options.storeError ? { error: options.storeError } : { storeId: STORE }
        },
        merchantApiFetch: async (path, init = {}) => {
            apiCalls.push({ path, init })
            const isListingRead = path.startsWith('/channel-listings?')
            if (isListingRead) return new Response(JSON.stringify({ data: options.listing === undefined ? [LISTING_ROW] : options.listing ? [options.listing] : [] }), { status: 200 })
            const status = options.mutationStatus ?? 200
            const body = status >= 400
                ? { error: { code: 'CONFLICT', message: 'Listing changed before resubmission.' } }
                : { data: { listing_id: LISTING, to_status: 'pending_review', replayed: false } }
            return new Response(JSON.stringify(body), { status })
        },
        readMerchantApiJson: async (response) => {
            const payload = await response.json()
            if (!response.ok) throw Object.assign(new Error('Gateway request failed'), { status: response.status, payload })
            return payload
        },
        merchantApiErrorResponse: (error) => {
            const failure = error as { status?: number; payload?: unknown }
            return NextResponse.json(failure.payload ?? { error: { code: 'INTERNAL_ERROR' } }, { status: failure.status ?? 500 })
        },
    }
    return { handlers: createMarketplaceListingHandlers(dependencies), apiCalls, resolvedStores }
}

function request(method: 'GET' | 'POST', body?: unknown) {
    return new NextRequest(`https://merchant.example/api/stores/store-a/marketplace-listings/${PRODUCT}`, {
        method,
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })
}

const params = { params: Promise.resolve({ store: 'store-a', productId: PRODUCT }) }

test('status lookup scopes the listing read to the verified store and product', async () => {
    const f = fixture()
    const response = await f.handlers.GET(request('GET'), params)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { data: LISTING_ROW })
    assert.deepEqual(f.resolvedStores, ['store-a'])
    assert.equal(f.apiCalls.length, 1)
    const [path, query] = f.apiCalls[0].path.split('?')
    assert.equal(path, '/channel-listings')
    assert.deepEqual(Object.fromEntries(new URLSearchParams(query)), {
        store_id: STORE,
        channel: 'marketplace',
        product_id: PRODUCT,
        limit: '1',
    })
    assert.equal(f.apiCalls[0].init.requireSession, true)
})

test('resubmission forwards only the verified store, correction note and idempotency key', async () => {
    const f = fixture()
    const response = await f.handlers.POST(request('POST', { reason: '  Added country of origin.  ', idempotency_key: '  correction-42  ', store_id: 'forged' }), params)
    assert.equal(response.status, 200)
    assert.equal(f.apiCalls.length, 2)
    assert.deepEqual(f.apiCalls[1], {
        path: `/channel-listings/${LISTING}/resubmit`,
        init: {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({ store_id: STORE, reason: 'Added country of origin.', idempotency_key: 'correction-42' }),
        },
    })
})

test('invalid product IDs and correction inputs stop before any API call', async () => {
    const f = fixture()
    const badId = await f.handlers.POST(request('POST', { reason: 'A valid correction', idempotency_key: 'k' }), {
        params: Promise.resolve({ store: 'store-a', productId: 'not-a-uuid' }),
    })
    assert.equal(badId.status, 400)
    for (const body of [
        { reason: 'short', idempotency_key: 'k' },
        { reason: 'valid correction', idempotency_key: '' },
        { reason: 'x'.repeat(501), idempotency_key: 'k' },
        null,
    ]) {
        const response = await f.handlers.POST(request('POST', body), params)
        assert.equal(response.status, 400)
    }
    assert.deepEqual(f.apiCalls, [])
})

test('store ownership denial returns without looking up or resubmitting another applicant listing', async () => {
    const forbidden = NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const f = fixture({ storeError: forbidden })
    const response = await f.handlers.POST(request('POST', { reason: 'Corrected the product origin.', idempotency_key: 'key-1' }), params)
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' })
    assert.deepEqual(f.resolvedStores, ['store-a'])
    assert.deepEqual(f.apiCalls, [])
})

test('store ownership denial hides another applicant listing during status lookup', async () => {
    const forbidden = NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const f = fixture({ storeError: forbidden })
    const response = await f.handlers.GET(request('GET'), params)
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' })
    assert.deepEqual(f.resolvedStores, ['store-a'])
    assert.deepEqual(f.apiCalls, [])
})

test('missing store-scoped listing is 404 and does not call the resubmission writer', async () => {
    const f = fixture({ listing: null })
    const response = await f.handlers.POST(request('POST', { reason: 'Corrected the product origin.', idempotency_key: 'key-1' }), params)
    assert.equal(response.status, 404)
    assert.equal(f.apiCalls.length, 1)
})

test('Gateway conflict status and payload survive the merchant correction route', async () => {
    const f = fixture({ mutationStatus: 409 })
    const response = await f.handlers.POST(request('POST', { reason: 'Corrected the product origin.', idempotency_key: 'key-1' }), params)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: { code: 'CONFLICT', message: 'Listing changed before resubmission.' } })
})
