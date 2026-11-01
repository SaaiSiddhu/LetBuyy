import assert from 'node:assert/strict'
import test from 'node:test'
import { createMerchantSessionRead } from '../lib/auth/session-http'

const user = { id: 'synthetic-owner', email: 'owner@example.invalid' }
const upstream = (status: number, payload: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => payload })

test('missing cookie is signed out without an upstream request', async () => {
    const read = createMerchantSessionRead({ getSessionCookie: async () => null, requestSession: async () => { throw new Error('must not run') }, setSessionCookie: async () => { throw new Error('must not run') } })
    const result = await read()
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { authenticated: false })
    assert.equal(result.headers.get('cache-control'), 'private, no-store')
})

test('explicit canonical revocation remains signed out and never rotates a cookie', async () => {
    for (const status of [200, 401, 403]) {
        const read = createMerchantSessionRead({ getSessionCookie: async () => 'synthetic-token', requestSession: async () => upstream(status, { authenticated: false, rotated_session_token: 'must-not-be-used' }), setSessionCookie: async () => { throw new Error('must not run') } })
        assert.deepEqual(await (await read()).json(), { authenticated: false })
    }
})

test('outage, refused internal proof, malformed success and unexpected HTML never masquerade as expiry', async () => {
    const cases = [upstream(500, { error: 'private database detail' }), upstream(401, { error: { code: 'UNAUTHORIZED' } }), upstream(200, null), upstream(200, { authenticated: true, user: { id: '', email: user.email } }), upstream(200, { authenticated: true, user: { id: user.id } })]
    for (const response of cases) {
        const read = createMerchantSessionRead({ getSessionCookie: async () => 'synthetic-token', requestSession: async () => response, setSessionCookie: async () => {} })
        const result = await read()
        assert.equal(result.status, 503)
        const body = await result.json()
        assert.equal(body.error.code, 'SESSION_UNAVAILABLE')
        assert.equal('authenticated' in body, false)
        assert.equal(JSON.stringify(body).includes('private database detail'), false)
    }
    for (const requestSession of [async () => { throw new Error('private transport detail') }, async () => ({ status: 200, ok: true, json: async () => { throw new Error('HTML protection page') } })]) {
        const read = createMerchantSessionRead({ getSessionCookie: async () => 'synthetic-token', requestSession, setSessionCookie: async () => {} })
        assert.equal((await read()).status, 503)
    }
})

test('confirmed identity preserves its expiry and seals rotation before returning a token-free body', async () => {
    const rotated: string[] = []
    const payload = { authenticated: true, user, expires_at: '2030-01-01T00:00:00Z', rotated_session_token: 'synthetic-new-token' }
    const read = createMerchantSessionRead({ getSessionCookie: async () => 'synthetic-old-token', requestSession: async token => { assert.equal(token, 'synthetic-old-token'); return upstream(200, payload) }, setSessionCookie: async token => { rotated.push(token) } })
    const result = await read()
    assert.deepEqual(rotated, ['synthetic-new-token'])
    assert.deepEqual(await result.json(), { authenticated: true, user, expires_at: payload.expires_at })
    assert.equal(payload.rotated_session_token, 'synthetic-new-token')
})

test('failed cookie rotation returns unavailable without granting a successful session', async () => {
    const read = createMerchantSessionRead({ getSessionCookie: async () => 'synthetic-token', requestSession: async () => upstream(200, { authenticated: true, user, rotated_session_token: 'synthetic-rotated' }), setSessionCookie: async () => { throw new Error('private cookie write failure') } })
    assert.equal((await read()).status, 503)
})
