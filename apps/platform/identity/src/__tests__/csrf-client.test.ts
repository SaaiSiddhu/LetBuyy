import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { getAuthHeaders, getCsrfToken } from '../lib/csrf-client'

describe('expired Accounts CSRF cookie renewal', { concurrency: false }, () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const originalFetch = globalThis.fetch
    const freshToken = 'b'.repeat(64)
    let cookie = ''
    let requests: { url: string; init?: RequestInit }[] = []

    beforeEach(() => {
        cookie = ''
        requests = []
        Object.defineProperty(globalThis, 'document', {
            configurable: true, value: { get cookie() { return cookie } },
        })
        globalThis.fetch = async (input, init) => {
            requests.push({ url: String(input), init })
            cookie = `letbuyy_csrf=${freshToken}`
            return new Response(null, { status: 200 })
        }
    })
    afterEach(() => {
        globalThis.fetch = originalFetch
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    })

    test('a valid existing cookie needs no bootstrap request', async () => {
        cookie = `other=1; letbuyy_csrf=${'a'.repeat(64)}`
        assert.equal((await getAuthHeaders())['X-CSRF-Token'], 'a'.repeat(64))
        assert.equal(requests.length, 0)
    })

    test('staging ignores production CSRF cookies and uses its own value in a mixed jar', async () => {
        const original = process.env.NEXT_PUBLIC_ENV
        process.env.NEXT_PUBLIC_ENV = 'staging'
        try {
            cookie = `letbuyy_csrf=${'p'.repeat(64)}; lb_csrf=${'q'.repeat(64)}`
            assert.equal(getCsrfToken(), '')
            cookie += `; letbuyy_csrf_staging=${freshToken}`
            assert.equal((await getAuthHeaders())['X-CSRF-Token'], freshToken)
            assert.equal(requests.length, 0)
        } finally {
            if (original === undefined) delete process.env.NEXT_PUBLIC_ENV
            else process.env.NEXT_PUBLIC_ENV = original
        }
    })

    test('an expired cookie is renewed before headers are returned, with no credential body', async () => {
        const headers = await getAuthHeaders()
        assert.equal(headers['X-CSRF-Token'], freshToken)
        assert.equal(requests.length, 1)
        const request = requests[0]
        assert.equal(request.url, '/lookup')
        assert.equal(request.init?.method, 'HEAD')
        assert.equal(request.init?.cache, 'no-store')
        assert.equal(request.init?.credentials, 'same-origin')
        assert.equal(request.init?.mode, 'same-origin')
        assert.equal(request.init?.redirect, 'error')
        assert.equal(request.init?.body, undefined)
        assert.ok(request.init?.signal instanceof AbortSignal)
    })

    test('concurrent actions share one renewal and read the resulting cookie', async () => {
        let release!: () => void
        const gate = new Promise<void>(resolve => { release = resolve })
        globalThis.fetch = async (input, init) => {
            requests.push({ url: String(input), init })
            await gate
            cookie = `letbuyy_csrf=${freshToken}`
            return new Response(null, { status: 200 })
        }
        const pending = Promise.all([getAuthHeaders(), getAuthHeaders(), getAuthHeaders()])
        assert.equal(requests.length, 1)
        release()
        for (const headers of await pending) assert.equal(headers['X-CSRF-Token'], freshToken)
    })

    test('a failed renewal returns no mutation headers and a later deliberate attempt can recover', async () => {
        globalThis.fetch = async (input, init) => {
            requests.push({ url: String(input), init })
            return new Response(null, { status: 503 })
        }
        await assert.rejects(getAuthHeaders(), /Security verification expired/)
        assert.equal(requests.length, 1)
        globalThis.fetch = async (input, init) => {
            requests.push({ url: String(input), init })
            cookie = `letbuyy_csrf=${freshToken}`
            return new Response(null, { status: 200 })
        }
        assert.equal((await getAuthHeaders())['X-CSRF-Token'], freshToken)
        assert.equal(requests.length, 2)
    })

    test('a successful HEAD without an actual cookie still fails closed', async () => {
        globalThis.fetch = async () => new Response(null, { status: 200 })
        await assert.rejects(getAuthHeaders(), /Security verification expired/)
        assert.equal(getCsrfToken(), '')
    })

    test('network failure is not retried and never dispatches a credential mutation', async () => {
        globalThis.fetch = async (input, init) => {
            requests.push({ url: String(input), init })
            throw new Error('Synthetic network failure')
        }
        await assert.rejects(getAuthHeaders(), /Synthetic network failure/)
        assert.deepEqual(requests.map(r => [r.url, r.init?.method]), [['/lookup', 'HEAD']])
    })

    test('the existing legacy-cookie compatibility is preserved', async () => {
        cookie = `lb_csrf=${'c'.repeat(32)}`
        assert.equal((await getAuthHeaders())['X-CSRF-Token'], 'c'.repeat(32))
        assert.equal(requests.length, 0)
    })

    test('malformed cookie encoding cannot throw from the synchronous reader', () => {
        cookie = 'letbuyy_csrf=%E0%A4%A'
        assert.equal(getCsrfToken(), '')
    })
})
