import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import React, { act } from 'react'
import type { Root } from 'react-dom/client'

// Reuse the UI package's declared, lockfile-pinned DOM test dependency.
const uiRequire = createRequire(new URL('../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = uiRequire('jsdom') as { JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close: () => void } } }
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

const payoutId = '11111111-1111-4111-8111-111111111111'
const siteId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
type Transport = (url: string, init?: RequestInit) => Promise<Response>

function statement(status = 'pending', providerMode = 'sandbox') {
    return {
        id: payoutId, site_id: siteId, statement_number: 'PYT-ALPHA', status,
        provider: 'razorpay_route', provider_mode: providerMode, rail: 'razorpay_route', currency: 'INR',
        gross_amount_minor: 10000, platform_fee_minor: 0, tax_minor: 0, net_amount_minor: 10000,
        created_at: '2026-10-16T10:00:00+00:00', updated_at: '2026-10-16T10:00:00+00:00',
    }
}
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => { resolve = done })
    return { promise, resolve }
}

async function mount(transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/payouts' })
    const previous = Object.fromEntries(['window', 'document', 'navigator', 'sessionStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
    for (const key of ['window', 'document', 'navigator', 'sessionStorage']) {
        const value = key === 'window' ? dom.window : dom.window[key as 'document' | 'navigator' | 'sessionStorage']
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    }
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => transport(String(input), init)) as typeof fetch
    const { createRoot } = await import('react-dom/client')
    const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const { ToastProvider } = await import('@letbuyy/ui')
    const { MerchantSecurityContext } = await import('../src/components/security/MerchantSecurityContext')
    const { default: PayoutsPage } = await import('../src/app/[store]/payouts/page')
    const container = dom.window.document.getElementById('root')!
    const root: Root = createRoot(container)
    const render = async (store = 'alpha', actor = actorId) => {
        await act(async () => { root.render(
            <PathParamsContext.Provider value={{ store }}>
                <MerchantSecurityContext.Provider value={{ actorId: actor, store }}>
                    <ToastProvider duration={0}><PayoutsPage /></ToastProvider>
                </MerchantSecurityContext.Provider>
            </PathParamsContext.Provider>,
        ) })
    }
    await render()
    const buttons = () => [...container.querySelectorAll('button')]
    const button = (label: string) => {
        const found = buttons().find(item => item.textContent?.trim() === label)
        assert.ok(found, `Expected button ${label}: ${container.textContent}`)
        return found
    }
    const click = async (label: string) => { await act(async () => button(label).click()) }
    const release = () => click(buttons().some(item => item.textContent?.trim() === 'Retry release') ? 'Retry release' : 'Release')
    const approve = async () => {
        const input = container.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')
        assert.ok(input, 'real step-up dialog must require the current authenticator code')
        await act(async () => {
            const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!
            set.call(input, '123456')
            input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
        })
        await click('Release Payout')
    }
    return { container, render, button, buttons, click, release, approve, dom, close: async () => {
        await act(async () => root.unmount())
        dom.window.close()
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor)
            else Reflect.deleteProperty(globalThis, key)
        }
    } }
}

function securityResponse(url: string, init?: RequestInit) {
    if (url.endsWith('/security/two-factor')) return Response.json({ data: { factors: [{ id: 'factor-alpha', factor_type: 'totp', status: 'active' }] } })
    if (url.endsWith('/security/step-up')) {
        const body = JSON.parse(String(init?.body))
        assert.equal(body.action, 'payout.release')
        assert.equal(body.factor_id, 'factor-alpha')
        assert.equal(body.code, '123456')
        assert.equal(new Headers(init?.headers).get('X-LetBuyy-Merchant-Context'), actorId)
        return Response.json({ data: { step_up_token: 'synthetic-proof', verified_at: '2026-10-16T10:00:00.000Z' } })
    }
    return null
}

test('mounted statement page recognizes each statement state and provider mode, with protected pending controls', async () => {
    const states = ['pending', 'processing', 'released', 'failed']
    const fixture = await mount(async (url, init) => securityResponse(url, init) ?? Response.json({ data: { payouts: states.map((status, i) => ({ ...statement(status, i % 2 ? 'live' : 'sandbox'), id: `${i+1}1111111-1111-4111-8111-111111111111`, statement_number: `PYT-${status}` })) } }))
    try {
        assert.doesNotMatch(fixture.container.textContent!, /Unknown:/)
        assert.match(fixture.container.textContent!, /Pending/)
        assert.match(fixture.container.textContent!, /Released/)
        assert.equal(fixture.buttons().filter(item => item.textContent?.trim() === 'Release').length, 1)
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="sandbox"]').length, 2)
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="live"]').length, 2)
        await fixture.click('Release')
        assert.ok(fixture.container.querySelector('[role="dialog"]'), 'release opens existing verification dialog')
        assert.ok(fixture.container.querySelector('input[autocomplete="one-time-code"]'))
    } finally { await fixture.close() }
})

test('processing is truthful and a response-loss retry preserves the same intent, proof and actor context', async () => {
    let current = statement('processing')
    let attempts = 0
    const requests: RequestInit[] = []
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init)
        if (security) return security
        if (init?.method === 'POST') {
            requests.push(init); attempts += 1
            if (attempts === 1) throw new Error('Synthetic response loss')
            current = statement(attempts === 2 ? 'processing' : 'released')
            return Response.json({ data: current })
        }
        return Response.json({ data: { payouts: [current] } })
    })
    try {
        for (let i = 0; i < 3; i++) {
            await fixture.release(); await fixture.approve()
            if (i === 0) assert.match(fixture.container.textContent!, /Unable to release payout/)
            if (i === 1) {
                assert.match(fixture.container.textContent!, /Payout processing/)
                assert.doesNotMatch(fixture.container.textContent!, /Payout released|Release recorded/)
            }
        }
        assert.equal(requests.length, 3)
        const bodies = requests.map(request => JSON.parse(String(request.body)))
        assert.equal(new Set(bodies.map(body => body.idempotency_key)).size, 1)
        for (let i = 0; i < requests.length; i++) {
            assert.equal(bodies[i].step_up_token, 'synthetic-proof')
            assert.equal(bodies[i].step_up_verified_at, '2026-10-16T10:00:00.000Z')
            assert.equal(new Headers(requests[i].headers).get('X-LetBuyy-Merchant-Context'), actorId)
            assert.equal(new Headers(requests[i].headers).get('X-Idempotency-Key'), bodies[i].idempotency_key)
        }
        assert.match(fixture.container.textContent!, /Release recorded/)
        assert.equal(fixture.container.querySelectorAll('[role="dialog"]').length, 0)
    } finally { await fixture.close() }
})

test('an HTTP success containing failed or foreign statement data never announces release', async () => {
    for (const response of [{ ...statement('failed'), failure_reason: 'Synthetic provider denial' }, { ...statement('released'), id: '99999999-9999-4999-8999-999999999999' }]) {
        const fixture = await mount(async (url, init) => securityResponse(url, init) ?? (init?.method === 'POST' ? Response.json({ data: response }) : Response.json({ data: { payouts: [statement('processing')] } })))
        try {
            await fixture.release(); await fixture.approve()
            assert.doesNotMatch(fixture.container.textContent!, /Payout released|Release recorded/)
            assert.match(fixture.container.textContent!, /Action failed/)
        } finally { await fixture.close() }
    }
})

test('store/account switch fences delayed settle completion and clears the old dialog', async () => {
    const settle = deferred<Response>()
    let alphaCalls = 0
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init)
        if (security) return security
        if (init?.method === 'POST') return settle.promise
        if (url.includes('/alpha/')) {
            alphaCalls += 1
            return Response.json({ data: { payouts: [statement('processing')] } })
        }
        return Response.json({ data: { payouts: [{ ...statement('released'), statement_number: 'PYT-BETA' }] } })
    })
    try {
        await fixture.release(); await fixture.approve()
        await fixture.render('beta', '44444444-4444-4444-8444-444444444444')
        assert.doesNotMatch(fixture.container.textContent!, /PYT-ALPHA/)
        assert.equal(fixture.container.querySelectorAll('[role="dialog"]').length, 0)
        await act(async () => settle.resolve(Response.json({ data: statement('released') })))
        assert.equal(alphaCalls, 1, 'a late settlement must not reload the obsolete store')
        assert.match(fixture.container.textContent!, /PYT-BETA/)
        assert.doesNotMatch(fixture.container.textContent!, /PYT-ALPHA|Payout released|Release recorded/)
    } finally { await fixture.close() }
})

test('late list readback cannot cross a store switch or a same-store actor switch', async () => {
    for (const store of ['beta', 'alpha']) {
        const old = deferred<Response>()
        let reads = 0
        const fixture = await mount(async () => {
            reads += 1
            return reads === 1 ? old.promise : Response.json({ data: { payouts: [{ ...statement('released'), statement_number: 'PYT-CURRENT-ACTOR' }] } })
        })
        try {
            await fixture.render(store, '44444444-4444-4444-8444-444444444444')
            assert.match(fixture.container.textContent!, /PYT-CURRENT-ACTOR/)
            await act(async () => old.resolve(Response.json({ data: { payouts: [statement()] } })))
            assert.match(fixture.container.textContent!, /PYT-CURRENT-ACTOR/)
            assert.doesNotMatch(fixture.container.textContent!, /PYT-ALPHA/)
        } finally { await fixture.close() }
    }
})

test('denied approval retries with fresh proof and the same action key; an in-flight release cannot submit twice', async () => {
    const completion = deferred<Response>()
    const requests: RequestInit[] = []
    let proofs = 0
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init)
        if (security && url.endsWith('/step-up')) {
            proofs += 1
            return Response.json({ data: { step_up_token: `synthetic-proof-${proofs}`, verified_at: '2026-10-16T10:00:00.000Z' } })
        }
        if (security) return security
        if (init?.method === 'POST') {
            requests.push(init)
            return requests.length === 1 ? Response.json({ error: { message: 'Fresh verification required.' } }, { status: 428 }) : completion.promise
        }
        return Response.json({ data: { payouts: [statement('processing')] } })
    })
    try {
        await fixture.release(); await fixture.approve()
        assert.match(fixture.container.textContent!, /Fresh verification required/)
        assert.doesNotMatch(fixture.container.textContent!, /Payout released|Release recorded/)
        await fixture.release(); await fixture.approve()
        assert.equal(requests.length, 2)
        const retry = fixture.button('Retry release')
        assert.equal(retry.disabled, true)
        await act(async () => retry.click())
        assert.equal(requests.length, 2)
        const [first, second] = requests.map(request => JSON.parse(String(request.body)))
        assert.equal(first.idempotency_key, second.idempotency_key)
        assert.notEqual(first.step_up_token, second.step_up_token)
        await act(async () => completion.resolve(Response.json({ data: statement('processing') })))
        assert.match(fixture.container.textContent!, /Payout processing/)
        assert.equal(fixture.button('Retry release').disabled, false)
    } finally { await fixture.close() }
})

test('missing or foreign status list data is an actionable error instead of an empty or released statement', async () => {
    for (const payload of [{}, { data: { payouts: [statement('paid')] } }]) {
        const fixture = await mount(async () => Response.json(payload))
        try {
            assert.match(fixture.container.textContent!, /incomplete data/)
            assert.ok(fixture.button('Retry'))
            assert.doesNotMatch(fixture.container.textContent!, /No payout statements yet|PYT-ALPHA/)
        } finally { await fixture.close() }
    }
})

test('manual and provider-classified statements describe recorded outcomes without inventing provenance', async () => {
    for (const rail of ['manual', 'razorpay_route']) {
        for (const outcome of ['processing', 'released', 'failed']) {
            let current = { ...statement('processing'), provider: rail, rail }
            const fixture = await mount(async (url, init) => {
                const security = securityResponse(url, init)
                if (security) return security
                if (init?.method === 'POST') {
                    current = { ...current, status: outcome }
                    return Response.json({ data: current })
                }
                return Response.json({ data: { payouts: [current] } })
            })
            try {
                await fixture.release(); await fixture.approve()
                assert.equal(fixture.container.querySelectorAll('[data-provider-mode="sandbox"]').length, 1)
                assert.doesNotMatch(fixture.container.textContent!, /provider reports|provider has not confirmed|provider reported|settled to.*bank/i)
                if (outcome === 'released') {
                    assert.match(fixture.container.textContent!, /The statement records this payout as released\./)
                    assert.ok(fixture.container.querySelector('[aria-label="Release recorded in the statement"]'))
                } else if (outcome === 'processing') {
                    assert.match(fixture.container.textContent!, /Release remains unconfirmed\. Retry uses the same request\./)
                    assert.ok(fixture.container.querySelector('[aria-label="Release remains unconfirmed"]'))
                } else {
                    assert.match(fixture.container.textContent!, /The statement records a failed release\./)
                }
            } finally { await fixture.close() }
        }
    }
})
