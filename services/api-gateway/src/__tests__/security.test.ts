import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import type { Env } from '../index'
import { csrfProtection } from '../middleware/security'

type ErrorPayload = {
    error: {
        code: string
    }
}

function createCsrfTestApp() {
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', csrfProtection)
    app.all('/mutate', (c) => c.json({ ok: true }))
    return app
}

test('CSRF middleware rejects browser mutation without cookie token', async () => {
    const response = await createCsrfTestApp().request('/mutate', { method: 'POST' })

    assert.equal(response.status, 403)
    const payload = await response.json<ErrorPayload>()
    assert.equal(payload.error.code, 'CSRF_TOKEN_INVALID')
})

test('CSRF middleware allows bearer-token API mutation', async () => {
    const response = await createCsrfTestApp().request('/mutate', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
    })

    assert.equal(response.status, 200)
})

test('CSRF middleware allows internally signed service mutation', async () => {
    const response = await createCsrfTestApp().request('/mutate', {
        method: 'POST',
        headers: { 'X-LetBuyy-Internal-Signature': 'test-signature' },
    })

    assert.equal(response.status, 200)
})

test('CSRF middleware allows mutation with matching double-submit token', async () => {
    const response = await createCsrfTestApp().request('/mutate', {
        method: 'POST',
        headers: {
            Cookie: 'letbuyy_csrf=test-token',
            'X-CSRF-Token': 'test-token',
        },
    })

    assert.equal(response.status, 200)
})

test('CSRF middleware accepts legacy lb_csrf cookie during coordinated rename', async () => {
    const response = await createCsrfTestApp().request('/mutate', {
        method: 'POST',
        headers: {
            Cookie: 'lb_csrf=test-token',
            'X-CSRF-Token': 'test-token',
        },
    })

    assert.equal(response.status, 200)
})

test('CSRF middleware still allows safe methods and preflight', async () => {
    const app = createCsrfTestApp()
    assert.equal((await app.request('/mutate', { method: 'GET' })).status, 200)
    assert.equal((await app.request('/mutate', { method: 'HEAD' })).status, 200)
    assert.equal((await app.request('/mutate', { method: 'OPTIONS' })).status, 200)
})
