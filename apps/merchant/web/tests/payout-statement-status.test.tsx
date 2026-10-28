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
const fixtureClaimKey = `payout-settle-${payoutId}-synthetic-fixture-command`
type Transport = (url: string, init?: RequestInit) => Promise<Response>

function statement(status = 'pending', providerMode = 'sandbox') {
    return {
        id: payoutId, site_id: siteId, statement_number: 'PYT-ALPHA', status,
        provider: 'razorpay_route', provider_mode: providerMode, rail: 'razorpay_route', currency: 'INR',
        gross_amount_minor: 10000, platform_fee_minor: 0, tax_minor: 0, net_amount_minor: 10000,
        created_at: '2026-10-16T10:00:00+00:00', updated_at: '2026-10-16T10:00:00+00:00',
        // 294/342 and Gateway readback carry the canonical claim on these
        // states. Original eight case bodies/assertions remain unchanged.
        metadata: status === 'processing' || status === 'released'
            ? { release_idempotency_key: fixtureClaimKey, release_claimed_by: actorId } : {},
    }
}
// Explicit current list fixtures: these cases model a complete one-page read.
// Global aggregate/pagination behavior has separate cases below and owned SQL controls.
function payoutPage(payouts: ReturnType<typeof statement>[]) {
    const totals = { pending_minor: 0, processing_minor: 0, released_minor: 0, failed_minor: 0 }
    for (const row of payouts) {
        if (row.status in { pending: 1, processing: 1, released: 1, failed: 1 }) {
            totals[(row.status + '_minor') as keyof typeof totals] += row.net_amount_minor
        }
    }
    return { data: { payouts, summary: { site_id: payouts[0]?.site_id ?? siteId, currency: 'INR',
        provider_mode: payouts[0]?.provider_mode ?? 'sandbox', scope: 'all_statements_in_environment',
        statement_count: payouts.length, bank_settlement: 'not_observed', next_payout: null, ...totals },
        pagination: { limit: 25, matching_count: payouts.length, has_more: false, next_cursor: null } } }
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
    // A route unmount/remount keeps the same browser window and storage.
    const remount = async () => {
        await act(async () => { root.render(null) })
        await render()
    }
    return { container, render, remount, button, buttons, click, release, approve, dom, close: async () => {
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
    const fixture = await mount(async (url, init) => securityResponse(url, init) ?? Response.json(payoutPage(states.map((status, i) => ({ ...statement(status, url.includes('mode=live') ? 'live' : 'sandbox'), id: `${i+1}1111111-1111-4111-8111-111111111111`, statement_number: `PYT-${status}` })))))
    try {
        assert.doesNotMatch(fixture.container.textContent!, /Unknown:/)
        assert.match(fixture.container.textContent!, /Pending/)
        assert.match(fixture.container.textContent!, /Released/)
        assert.equal(fixture.buttons().filter(item => item.textContent?.trim() === 'Release').length, 1)
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="sandbox"]').length, 5)
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="live"]').length, 0)
        await fixture.click('Live statements')
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="live"]').length, 5)
        assert.equal(fixture.container.querySelectorAll('[data-provider-mode="sandbox"]').length, 0)
        await fixture.click('Release')
        assert.ok(fixture.container.querySelector('[role="dialog"]'), 'release opens existing verification dialog')
        assert.ok(fixture.container.querySelector('input[autocomplete="one-time-code"]'))
    } finally { await fixture.close() }
})

test('overview uses the complete server population, pages both ways, and resets safely when selecting live statements', async () => {
    const queries: string[] = []
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init)
        if (security) return security
        queries.push(url)
        const query = new URL(url, 'https://merchant.example.test').searchParams
        if (query.get('mode') === 'live') return Response.json({ data: { ...payoutPage([]).data,
            summary: { ...payoutPage([]).data.summary, provider_mode: 'live' } } })
        const second = query.has('cursor')
        const row = { ...statement(), statement_number: second ? 'PYT-PAGE-2' : 'PYT-PAGE-1' }
        const packet = payoutPage([row])
        return Response.json({ data: { ...packet.data,
            summary: { ...packet.data.summary, statement_count: 125, pending_minor: 3100000000 },
            pagination: { limit: 25, matching_count: 125, has_more: !second, next_cursor: second ? null : 'synthetic-page-two' } } })
    })
    try {
        assert.match(fixture.container.textContent!, /125 statements/)
        const pending = [...fixture.container.querySelectorAll('dl > div')].find(row => row.querySelector('dt')?.textContent === 'Pending statements')
        assert.equal(pending?.querySelector('dd')?.textContent, '₹3,10,00,000.00', 'the first displayed row cannot become the global total')
        assert.match(fixture.container.textContent!, /Bank settlement: not confirmed/)
        assert.match(fixture.container.textContent!, /Page 1 of 5/)
        await fixture.click('Next')
        assert.match(queries.at(-1)!, /cursor=synthetic-page-two/)
        assert.match(fixture.container.textContent!, /PYT-PAGE-2/)
        assert.match(fixture.container.textContent!, /Page 2 of 5/)
        await fixture.click('Previous')
        assert.doesNotMatch(queries.at(-1)!, /cursor=/)
        assert.match(fixture.container.textContent!, /PYT-PAGE-1/)
        await fixture.click('Live statements')
        assert.match(queries.at(-1)!, /mode=live/)
        assert.doesNotMatch(queries.at(-1)!, /cursor=/)
        assert.match(fixture.container.textContent!, /Page 1 of 1/)
        assert.doesNotMatch(fixture.container.textContent!, /Page 1 of 0|PYT-PAGE|3,10,00,000/)
        assert.equal(fixture.buttons().some(button => button.textContent?.trim() === 'Release'), false)
    } finally { await fixture.close() }
})

test('incomplete or failed totals clear old financial facts instead of displaying fabricated zero balances', async () => {
    let reads = 0
    const fixture = await mount(async (url, init) => securityResponse(url, init) ?? (++reads === 1
        ? Response.json(payoutPage([statement()]))
        : Response.json({ data: { payouts: [] } })))
    try {
        assert.equal(fixture.container.querySelectorAll('dl > div').length, 4)
        await fixture.click('Refresh')
        assert.equal(fixture.container.querySelectorAll('dl > div').length, 0)
        assert.match(fixture.container.textContent!, /Statement totals are unavailable/)
        assert.match(fixture.container.textContent!, /incomplete data/)
        assert.equal(fixture.buttons().some(button => button.textContent?.trim() === 'Release'), false)
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
        return Response.json(payoutPage([current]))
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
        const fixture = await mount(async (url, init) => securityResponse(url, init) ?? (init?.method === 'POST' ? Response.json({ data: response }) : Response.json(payoutPage([statement('processing')]))))
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
            return Response.json(payoutPage([statement('processing')]))
        }
        return Response.json(payoutPage([{ ...statement('released'), statement_number: 'PYT-BETA' }]))
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
            return reads === 1 ? old.promise : Response.json(payoutPage([{ ...statement('released'), statement_number: 'PYT-CURRENT-ACTOR' }]))
        })
        try {
            await fixture.render(store, '44444444-4444-4444-8444-444444444444')
            assert.match(fixture.container.textContent!, /PYT-CURRENT-ACTOR/)
            await act(async () => old.resolve(Response.json(payoutPage([statement()]))))
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
        return Response.json(payoutPage([statement('processing')]))
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
                return Response.json(payoutPage([current]))
            })
            try {
                await fixture.release(); await fixture.approve()
                assert.equal(fixture.container.querySelectorAll('[data-provider-mode="sandbox"]').length, 2, 'statement and complete overview both label their environment')
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

// HTTP-seam regressions: all four were red on the unrepaired production page.
// The fake claim boundary models only 294's processing-key equality rule. It
// does not execute Gateway, current-session verification, SQL or a provider.
for (const initialOutcome of ['processing-response', 'committed-response-loss'] as const) {
    for (const lifecycle of ['route-remount', 'fresh-page'] as const) {
        test(`payout recovery retains the original command after ${initialOutcome} and ${lifecycle}`, async t => {
            let current: ReturnType<typeof statement> = statement()
            let durableKey = '', proofs = 0, retryStatus = 0, claimRejections = 0
            const requests: RequestInit[] = []
            const acceptedKeys = new Set<string>()
            const transport: Transport = async (url, init) => {
                const security = securityResponse(url, init)
                if (security && url.endsWith('/security/step-up')) {
                    proofs += 1
                    return Response.json({ data: { step_up_token: `synthetic-recovery-proof-${proofs}`, verified_at: '2026-10-16T10:00:00.000Z' } })
                }
                if (security) return security
                if (init?.method !== 'POST') return Response.json(payoutPage([current]))
                requests.push(init)
                const body = JSON.parse(String(init.body))
                assert.equal(new Headers(init.headers).get('X-Idempotency-Key'), body.idempotency_key)
                assert.equal(new Headers(init.headers).get('X-LetBuyy-Merchant-Context'), actorId)
                if (!durableKey) {
                    durableKey = body.idempotency_key
                    acceptedKeys.add(durableKey)
                    // Canonical readback already exposes the claim inside metadata.
                    current = { ...statement('processing'), metadata: { release_idempotency_key: durableKey, release_claimed_by: actorId } }
                    if (initialOutcome === 'committed-response-loss') throw new Error('Synthetic committed response lost')
                    return Response.json({ data: current })
                }
                if (body.idempotency_key !== durableKey) {
                    claimRejections += 1; retryStatus = 409
                    return Response.json({ error: { code: 'PAYOUT_RELEASE_REJECTED', message: 'Payout release could not be claimed.' } }, { status: retryStatus })
                }
                retryStatus = 200; acceptedKeys.add(body.idempotency_key)
                return Response.json({ data: current })
            }
            let fixture: Awaited<ReturnType<typeof mount>> | undefined = await mount(transport)
            try {
                await fixture.release(); await fixture.approve()
                assert.equal(requests.length, 1)
                assert.doesNotMatch(fixture.container.textContent!, /Payout released|Release recorded/)
                if (initialOutcome === 'processing-response') assert.match(fixture.container.textContent!, /Payout processing/)
                else assert.match(fixture.container.textContent!, /Unable to release payout/)
                if (lifecycle === 'route-remount') await fixture.remount()
                else {
                    await fixture.close(); fixture = undefined
                    fixture = await mount(transport)
                }
                assert.match(fixture.container.textContent!, /Processing/)
                await fixture.release(); await fixture.approve()
                const [original, retry] = requests.map(request => JSON.parse(String(request.body)))
                assert.equal(requests.length, 2)
                assert.equal(proofs, 2, 'a new dialog must still obtain current proof')
                assert.notEqual(original.step_up_token, retry.step_up_token)
                assert.equal(acceptedKeys.size, 1, 'the modeled claim never accepts a second logical command')
                assert.doesNotMatch(fixture.container.textContent!, /Payout released|Release recorded/)
                if (retryStatus === 409) assert.match(fixture.container.textContent!, /Payout release could not be claimed/)
                t.diagnostic('N7_PAYOUT_RECOVERY ' + JSON.stringify({ initialOutcome, lifecycle, sameCommandKey: original.idempotency_key === retry.idempotency_key, retryStatus, claimRejections, freshProofs: proofs, acceptedLogicalKeys: acceptedKeys.size, boundary: 'fake HTTP; no SQL/provider execution' }))
                assert.equal(retry.idempotency_key, original.idempotency_key, 'processing payout recovery must reuse its original command key across page lifetime')
                assert.equal(retryStatus, 200)
            } finally { await fixture?.close() }
        })
    }
}

test('processing claims with missing, malformed or foreign evidence never submit a new release command', async () => {
    const claims: Record<string, unknown>[] = [
        {}, { release_idempotency_key: fixtureClaimKey },
        { release_idempotency_key: fixtureClaimKey, release_claimed_by: '44444444-4444-4444-8444-444444444444' },
        { release_idempotency_key: fixtureClaimKey, release_claimed_by: { id: actorId } },
        ...[null, 42, 'short', ' ' + fixtureClaimKey, fixtureClaimKey + ' ', 'a'.repeat(161), 'valid\ncommand', 'valid-command\x7f'].map(key => ({ release_idempotency_key: key, release_claimed_by: actorId })),
    ]
    for (const metadata of claims) {
        let commands = 0
        const fixture = await mount(async (url, init) => {
            const security = securityResponse(url, init)
            if (security) return security
            if (init?.method === 'POST') { commands += 1; throw new Error('unresolved claim must not submit') }
            return Response.json(payoutPage([{ ...statement('processing'), metadata }]))
        })
        try {
            await fixture.release(); await fixture.approve()
            assert.equal(commands, 0)
            assert.match(fixture.container.textContent!, /cannot be safely resumed/)
            assert.doesNotMatch(fixture.container.textContent!, /Release recorded|Payout released/)
        } finally { await fixture.close() }
    }
})

test('processing recovery accepts both existing route key-length boundaries without requiring a UI-generated prefix', async () => {
    for (const key of ['12345678', 'a'.repeat(160)]) {
        const current = { ...statement('processing'), metadata: { release_idempotency_key: key, release_claimed_by: actorId } }
        const keys: string[] = []
        const fixture = await mount(async (url, init) => securityResponse(url, init) ?? (init?.method === 'POST'
            ? (keys.push(JSON.parse(String(init.body)).idempotency_key), Response.json({ data: current }))
            : Response.json(payoutPage([current]))))
        try {
            await fixture.release(); await fixture.approve()
            assert.deepEqual(keys, [key])
            assert.match(fixture.container.textContent!, /Payout processing/)
        } finally { await fixture.close() }
    }
})

test('missing canonical processing evidence refuses even when an old component command remains cached', async () => {
    let current = statement(), commands = 0
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init); if (security) return security
        if (init?.method === 'POST') {
            commands += 1; current = { ...statement('processing'), metadata: {} }
            throw new Error('Synthetic reply lost; canonical claim readback incomplete')
        }
        return Response.json(payoutPage([current]))
    })
    try {
        await fixture.release(); await fixture.approve(); await fixture.click('Refresh')
        await fixture.release(); await fixture.approve()
        assert.equal(commands, 1, 'cached key must not substitute for a missing current processing claim')
        assert.match(fixture.container.textContent!, /cannot be safely resumed/)
    } finally { await fixture.close() }
})

test('current canonical processing claim wins over a conflicting earlier in-memory command', async () => {
    const canonicalKey = 'synthetic-canonical-other-tab-command'
    let current = statement()
    const keys: string[] = []
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init); if (security) return security
        if (init?.method === 'POST') {
            keys.push(JSON.parse(String(init.body)).idempotency_key)
            current = { ...statement('processing'), metadata: { release_idempotency_key: canonicalKey, release_claimed_by: actorId } }
            return keys.length === 1 ? Response.json({ error: { message: 'Another tab claimed this statement. Refresh it.' } }, { status: 409 }) : Response.json({ data: current })
        }
        return Response.json(payoutPage([current]))
    })
    try {
        await fixture.release(); await fixture.approve(); await fixture.click('Refresh')
        await fixture.release(); await fixture.approve()
        assert.equal(keys.length, 2); assert.notEqual(keys[0], canonicalKey); assert.equal(keys[1], canonicalKey)
        assert.match(fixture.container.textContent!, /Payout processing/)
    } finally { await fixture.close() }
})

test('a current readback target change while MFA is pending cannot redirect the approval to a new statement or site', async () => {
    const foreignId = '99999999-9999-4999-8999-999999999999'
    const foreignSite = '88888888-8888-4888-8888-888888888888'
    for (const replacement of [[{ ...statement('processing'), id: foreignId }], [{ ...statement('processing'), site_id: foreignSite }], [statement('processing'), statement('processing')], [statement('released')]]) {
        const proof = deferred<Response>()
        let reads = 0, commands = 0
        const fixture = await mount(async (url, init) => {
            const security = securityResponse(url, init)
            if (security && url.endsWith('/security/step-up')) return proof.promise
            if (security) return security
            if (init?.method === 'POST') { commands += 1; throw new Error('changed target must not submit') }
            reads += 1
            return Response.json(payoutPage(reads === 1 ? [statement('processing')] : replacement))
        })
        try {
            await fixture.release(); await fixture.approve(); await fixture.click('Refresh')
            await act(async () => proof.resolve(Response.json({ data: { step_up_token: 'synthetic-current-proof', verified_at: '2026-10-16T10:00:00.000Z' } })))
            assert.equal(commands, 0)
            assert.match(fixture.container.textContent!, /payout statement changed/)
            assert.doesNotMatch(fixture.container.textContent!, /Release recorded/)
        } finally { await fixture.close() }
    }
})

test('an out-of-order list completion cannot replace the latest canonical processing command', async () => {
    const old = deferred<Response>(), canonicalKey = 'synthetic-current-read-command'
    let reads = 0
    const keys: string[] = []
    const current = { ...statement('processing'), metadata: { release_idempotency_key: canonicalKey, release_claimed_by: actorId } }
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init); if (security) return security
        if (init?.method === 'POST') { keys.push(JSON.parse(String(init.body)).idempotency_key); return Response.json({ data: current }) }
        reads += 1
        return reads === 1 ? old.promise : Response.json(payoutPage([current]))
    })
    try {
        await fixture.click('Refresh')
        await act(async () => old.resolve(Response.json(payoutPage([statement('processing')]))))
        await fixture.release(); await fixture.approve()
        assert.deepEqual(keys, [canonicalKey])
        assert.match(fixture.container.textContent!, /Payout processing/)
    } finally { await fixture.close() }
})

test('released acknowledgements must match actor, site, statement and command before clearing the retry intent', async () => {
    const corrupt = [
        (row: ReturnType<typeof statement>) => ({ ...row, id: '99999999-9999-4999-8999-999999999999' }),
        (row: ReturnType<typeof statement>) => ({ ...row, site_id: '88888888-8888-4888-8888-888888888888' }),
        (row: ReturnType<typeof statement>) => ({ ...row, metadata: {} }),
        (row: ReturnType<typeof statement>) => ({ ...row, metadata: { ...row.metadata, release_idempotency_key: 'synthetic-foreign-release-command' } }),
        (row: ReturnType<typeof statement>) => ({ ...row, metadata: { ...row.metadata, release_claimed_by: '44444444-4444-4444-8444-444444444444' } }),
    ]
    for (const alter of corrupt) {
        let current = statement()
        const keys: string[] = []
        const fixture = await mount(async (url, init) => {
            const security = securityResponse(url, init); if (security) return security
            if (init?.method === 'POST') {
                const key = JSON.parse(String(init.body)).idempotency_key as string; keys.push(key)
                const released = { ...statement('released'), metadata: { release_idempotency_key: key, release_claimed_by: actorId } }
                if (keys.length === 1) return Response.json({ data: alter(released) })
                current = released; return Response.json({ data: released })
            }
            return Response.json(payoutPage([current]))
        })
        try {
            await fixture.release(); await fixture.approve()
            assert.doesNotMatch(fixture.container.textContent!, /Release recorded|Payout released/)
            assert.match(fixture.container.textContent!, /conflicting statement data/)
            await fixture.release(); await fixture.approve()
            assert.equal(keys.length, 2); assert.equal(keys[0], keys[1], 'a conflicting terminal response must not discard the original intent')
            assert.match(fixture.container.textContent!, /Release recorded/)
        } finally { await fixture.close() }
    }
})

test('late release acknowledgement cannot cross a newer site or command readback', async () => {
    for (const changed of [{ ...statement('processing'), site_id: '88888888-8888-4888-8888-888888888888' }, { ...statement('processing'), metadata: { release_idempotency_key: 'synthetic-newer-claim-command', release_claimed_by: actorId } }]) {
        const completion = deferred<Response>(); let reads = 0
        const fixture = await mount(async (url, init) => {
            const security = securityResponse(url, init); if (security) return security
            if (init?.method === 'POST') return completion.promise
            reads += 1
            return Response.json(payoutPage(reads === 1 ? [statement('processing')] : [changed]))
        })
        try {
            await fixture.release(); await fixture.approve(); await fixture.click('Refresh')
            await act(async () => completion.resolve(Response.json({ data: statement('released') })))
            assert.equal(reads, 2, 'a stale acknowledgement must not initiate another read or clear current intent')
            assert.doesNotMatch(fixture.container.textContent!, /Release recorded|Payout released/)
            assert.match(fixture.container.textContent!, /conflicting statement data/)
        } finally { await fixture.close() }
    }
})

test('actor and store A-to-B-to-A keeps a fresh component claim isolated from the first A completion', async () => {
    const old = deferred<Response>(), returnedKey = 'synthetic-returned-actor-command'
    let alphaReads = 0
    const requests: string[] = []
    const returned = { ...statement('processing'), statement_number: 'PYT-RETURNED-A', metadata: { release_idempotency_key: returnedKey, release_claimed_by: actorId } }
    const fixture = await mount(async (url, init) => {
        const security = securityResponse(url, init); if (security) return security
        if (init?.method === 'POST') {
            requests.push(JSON.parse(String(init.body)).idempotency_key)
            return requests.length === 1 ? old.promise : Response.json({ data: returned })
        }
        if (url.includes('/alpha/')) { alphaReads += 1; return Response.json(payoutPage(alphaReads === 1 ? [statement('processing')] : [returned])) }
        return Response.json(payoutPage([]))
    })
    try {
        await fixture.release(); await fixture.approve()
        await fixture.render('beta', '44444444-4444-4444-8444-444444444444'); await fixture.render('alpha', actorId)
        await act(async () => old.resolve(Response.json({ data: statement('released') })))
        assert.match(fixture.container.textContent!, /PYT-RETURNED-A/)
        assert.doesNotMatch(fixture.container.textContent!, /Release recorded|PYT-ALPHA/)
        await fixture.release(); await fixture.approve()
        assert.deepEqual(requests, [fixtureClaimKey, returnedKey])
        assert.match(fixture.container.textContent!, /Payout processing/)
    } finally { await fixture.close() }
})
