import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPublicPricing } from '../../apps/marketing/web/src/lib/pricing'

// Synthetic transport fixture: no network, allocation or payment takes place.
const pricing = {
    plans: [{ slug: 'launch', name: 'Launch', status: 'available', purchasable: true,
        regular_inr: 299, founding_inr: 199, savings_inr: 100, features: [] }],
    founding_program: { available: true, total_slots: 100, used_slots: 7,
        remaining_slots: 93, active: true, paused: false },
}

test('SSR and browser retry use one fresh canonical pricing/availability response', async t => {
    const requests: string[] = []
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        requests.push(String(input))
        assert.equal(init?.cache, 'no-store')
        assert.ok(init?.signal)
        return Response.json({ success: true, data: pricing })
    })
    const result = await loadPublicPricing()
    assert.deepEqual(result?.pricing, pricing)
    assert.deepEqual(result?.remaining, { total_slots: 100, used_slots: 7,
        remaining_slots: 93, active: true, paused: false })
    assert.equal(requests.length, 1)
    assert.equal(new URL(requests[0]).pathname, '/v1/pricing')
})

test('missing program data never fabricates a slot count or a second request', async t => {
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => {
        requests++
        return Response.json({ success: true, data: { ...pricing, founding_program: { available: false } } })
    })
    const result = await loadPublicPricing()
    assert.deepEqual(result?.pricing.plans, pricing.plans)
    assert.equal(result?.remaining, null)
    assert.equal(requests, 1)
})

test('invalid plan amounts and unavailable upstreams keep the existing error path', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true,
        data: { ...pricing, plans: [{ ...pricing.plans[0], founding_inr: '199' }] } }))
    assert.equal(await loadPublicPricing(), null)
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic unavailable upstream') })
    assert.equal(await loadPublicPricing(), null)
})

test('Flight can share repeated comparison data without changing plans or distinct matrices', async t => {
    const comparison = [{ category: 'Store', items: [{ label: 'Products', launch: '100' }] }]
    const distinct = [{ category: 'Store', items: [{ label: 'Products', launch: '500' }] }]
    const response = { ...pricing, plans: [
        { ...pricing.plans[0], compare_features: comparison },
        { ...pricing.plans[0], slug: 'growth', compare_features: structuredClone(comparison) },
        { ...pricing.plans[0], slug: 'scale', status: 'coming_soon', purchasable: false, compare_features: distinct },
    ] }
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: response }))
    const result = await loadPublicPricing()
    assert.ok(result)
    assert.deepEqual(result.pricing, response)
    assert.equal(JSON.stringify(result.pricing), JSON.stringify(response))
    const plans = result.pricing.plans as Array<typeof pricing.plans[number] & { compare_features: unknown[] }>
    assert.equal(plans[0].compare_features, plans[1].compare_features)
    assert.notEqual(plans[0].compare_features, plans[2].compare_features)
    assert.equal(plans[2].purchasable, false)
})
