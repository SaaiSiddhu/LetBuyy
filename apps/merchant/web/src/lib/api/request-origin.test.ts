import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { validateMerchantMutationRequest } from './request-origin'
import { validateStaffMutationRequest } from '../staff/request-origin'

const admin = 'http://admin.threadline-9cd50e893016.localhost:57225'
const stableKey = 'origin-regression-01'

function configured<T>(value: string | undefined, run: () => T): T {
    const previous = process.env.NEXT_PUBLIC_ADMIN_URL
    if (value === undefined) delete process.env.NEXT_PUBLIC_ADMIN_URL
    else process.env.NEXT_PUBLIC_ADMIN_URL = value
    try { return run() } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_ADMIN_URL
        else process.env.NEXT_PUBLIC_ADMIN_URL = previous
    }
}

function request(url: string, origin: string | null = new URL(url).origin, host: string | null = new URL(url).host, extra: Record<string, string> = {}) {
    return new NextRequest(`${url}/api/stores/synthetic/products`, {
        method: 'PATCH',
        headers: { ...(origin === null ? {} : { origin }), ...(host === null ? {} : { host }), 'X-Idempotency-Key': stableKey, ...extra },
    })
}

function forbidden(input: NextRequest) {
    assert.equal(validateMerchantMutationRequest(input)?.status, 403)
}

test('actual NextRequest preserves the supplied run URL; normalized server URL is a separate reproduction', () => {
    configured(admin, () => {
        const direct = request(admin)
        assert.equal(direct.nextUrl.origin, admin)
        assert.equal(validateMerchantMutationRequest(direct), null)
        const normalized = request('http://localhost:57225', admin, new URL(admin).host)
        assert.equal(normalized.nextUrl.origin, 'http://localhost:57225')
        assert.equal(normalized.headers.get('origin'), admin)
        assert.equal(normalized.headers.get('host'), new URL(admin).host)
        assert.equal(validateMerchantMutationRequest(normalized), null)
    })
})

test('configured admin origin admits normalized URL only with exact Host, protocol and port', () => {
    configured(admin, () => {
        assert.equal(validateMerchantMutationRequest(request('http://localhost:57225', admin, new URL(admin).host)), null)
        forbidden(request('http://localhost:57225', admin, 'localhost:57225'))
        forbidden(request('http://localhost:57225', admin, 'admin.other-run.localhost:57225'))
        forbidden(request('http://localhost:57225', admin, 'admin.threadline-9cd50e893016.localhost:57226'))
        forbidden(request('http://localhost:57226', admin, new URL(admin).host))
        forbidden(request('https://localhost:57225', admin, new URL(admin).host))
        forbidden(request('http://other.internal:57225', admin, new URL(admin).host))
    })
})

test('configured origin rejects unknown alias even when supplied URL, Host and Origin agree', () => {
    configured(admin, () => {
        forbidden(request('http://admin.other-run.localhost:57225'))
        forbidden(request('http://admin.threadline-9cd50e893016.localhost.evil.invalid:57225'))
        forbidden(request('http://localhost:57225'))
        forbidden(request('http://127.0.0.1:57225'))
    })
})

test('foreign, null, missing, wrong-port and wrong-protocol browser origins fail closed', () => {
    configured(admin, () => {
        for (const origin of [null, 'null', 'https://foreign.example.invalid', 'http://admin.other-run.localhost:57225', 'http://admin.threadline-9cd50e893016.localhost:57226', 'https://admin.threadline-9cd50e893016.localhost:57225', `${admin}/`, `${admin}, https://foreign.example.invalid`]) {
            forbidden(request('http://localhost:57225', origin, new URL(admin).host))
        }
    })
})

test('Forwarded and X-Forwarded-* cannot supply authority or rescue an invalid Host', () => {
    configured(admin, () => {
        const spoof = { 'x-forwarded-host': new URL(admin).host, 'x-forwarded-proto': 'http', forwarded: `host=${new URL(admin).host};proto=http` }
        forbidden(request('http://localhost:57225', admin, 'attacker.invalid:57225', spoof))
        forbidden(request('http://localhost:57225', admin, null, spoof))
        forbidden(request('https://localhost:57225', admin, new URL(admin).host, spoof))
        const harmless = { 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-proto': 'https', forwarded: 'host=attacker.invalid;proto=https' }
        assert.equal(validateMerchantMutationRequest(request('http://localhost:57225', admin, new URL(admin).host, harmless)), null)
    })
})

test('invalid configured admin URL never falls back to an otherwise matching request', () => {
    for (const value of ['', 'not-a-url', '//admin.example.invalid', 'ftp://admin.example.invalid', 'https://user:password@admin.example.invalid', 'https://admin.example.invalid/path', 'https://admin.example.invalid/?mode=x', 'https://admin.example.invalid/#fragment', ' https://admin.example.invalid', 'https://admin.example.invalid ']) {
        configured(value, () => forbidden(request('https://admin.example.invalid')))
    }
})

test('normal production same-origin request remains valid, including configured trailing slash', () => {
    for (const value of ['https://admin.letbuyy.com', 'https://admin.letbuyy.com/']) {
        configured(value, () => {
            assert.equal(validateMerchantMutationRequest(request('https://admin.letbuyy.com')), null)
            forbidden(request('https://admin.letbuyy.com', 'https://admin.letbuyy.com', 'foreign.example.invalid'))
            forbidden(request('https://admin.letbuyy.com:444', 'https://admin.letbuyy.com', 'admin.letbuyy.com'))
        })
    }
})

test('canonical request origin works without config only when Host matches', () => {
    configured(undefined, () => {
        assert.equal(validateMerchantMutationRequest(request('https://admin.letbuyy.com')), null)
        forbidden(request('https://admin.letbuyy.com', 'https://admin.letbuyy.com', 'foreign.example.invalid'))
        forbidden(request('https://admin.letbuyy.com', 'https://admin.letbuyy.com', null))
        forbidden(request('http://localhost:57225', admin, new URL(admin).host))
    })
})

test('legacy literal loopback IPs and localhost retain exact browser origin with installed NextRequest', () => {
    configured(undefined, () => {
        for (const address of ['127.0.0.1', '[::1]', 'localhost']) {
            const origin = `http://${address}:9141`
            const input = request(origin)
            assert.equal(input.nextUrl.hostname, 'localhost')
            assert.equal(validateMerchantMutationRequest(input), null)
            forbidden(request(origin, `http://${address}:9142`))
            if (address !== 'localhost') forbidden(request(origin, 'http://localhost:9141'))
        }
        forbidden(request('http://localhost:9141', 'http://127.0.0.1:9141', 'localhost:9141', { 'x-forwarded-host': '127.0.0.1:9141' }))
        forbidden(request('http://localhost:9141', 'http://127.0.0.1:9142', '127.0.0.1:9142'))
        forbidden(request('http://localhost:9141', 'http://unknown.localhost:9141', 'unknown.localhost:9141'))
    })
})

test('configured exact loopback origins also preserve legacy behavior', () => {
    for (const address of ['127.0.0.1', '[::1]', 'localhost']) {
        const origin = `http://${address}:9141`
        configured(origin, () => assert.equal(validateMerchantMutationRequest(request(origin)), null))
    }
})

test('Host cannot smuggle credentials, paths, fragments, query, multiple hosts or a different port', () => {
    configured(admin, () => {
        for (const host of [null, 'attacker@admin.threadline-9cd50e893016.localhost:57225', 'admin.threadline-9cd50e893016.localhost:57225/path', 'admin.threadline-9cd50e893016.localhost:57225#fragment', 'admin.threadline-9cd50e893016.localhost:57225?x=y', `${new URL(admin).host}, attacker.invalid`, 'admin.threadline-9cd50e893016.localhost:57226']) {
            forbidden(request('http://localhost:57225', admin, host))
        }
    })
})

test('idempotency key is still mandatory with the corrected origin', () => {
    configured(admin, () => {
        for (const key of ['', '1234567', 'x'.repeat(201)]) {
            assert.equal(validateMerchantMutationRequest(request('http://localhost:57225', admin, new URL(admin).host, { 'X-Idempotency-Key': key }))?.status, 400)
        }
        for (const key of ['12345678', 'x'.repeat(200)]) {
            assert.equal(validateMerchantMutationRequest(request('http://localhost:57225', admin, new URL(admin).host, { 'X-Idempotency-Key': key })), null)
        }
        const missing = request('http://localhost:57225', admin, new URL(admin).host)
        missing.headers.delete('X-Idempotency-Key')
        assert.equal(validateMerchantMutationRequest(missing)?.status, 400)
    })
})

test('raw guard values retain trim and control-character key rejection before any consumer mutation', () => {
    configured(admin, () => {
        for (const key of [' bad-key-01', 'bad-key-01 ', 'bad\tkey-01', 'bad\u0000key-01', 'bad\u001fkey-01', 'bad\u007fkey-01']) {
            const input = request('http://localhost:57225', admin, new URL(admin).host)
            const headers = input.headers
            Object.defineProperty(input, 'headers', { value: { get: (name: string) => name.toLowerCase() === 'x-idempotency-key' ? key : headers.get(name) } })
            assert.equal(validateMerchantMutationRequest(input)?.status, 400)
        }
    })
})

test('existing key opt-out never opts out of required same-origin checks', () => {
    configured(admin, () => {
        const input = request('http://localhost:57225', admin, new URL(admin).host, { 'X-Idempotency-Key': '' })
        assert.equal(validateMerchantMutationRequest(input, { requireKey: false }), null)
        input.headers.delete('origin')
        assert.equal(validateMerchantMutationRequest(input, { requireKey: false })?.status, 403)
    })
})

test('staff wrapper preserves custom denial messages and the same strict origin/key contract', async () => {
    const badOrigin = configured(admin, () => validateStaffMutationRequest(request('http://localhost:57225', 'https://foreign.example.invalid', new URL(admin).host)))
    assert.equal(badOrigin?.status, 403)
    assert.equal((await badOrigin?.json()).error.message, 'This staff change must originate from this merchant app.')
    const badKey = configured(admin, () => validateStaffMutationRequest(request('http://localhost:57225', admin, new URL(admin).host, { 'X-Idempotency-Key': '' })))
    assert.equal(badKey?.status, 400)
    assert.equal((await badKey?.json()).error.message, 'A stable staff request key is required.')
})
