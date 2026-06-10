import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import type { Env } from '../index'
import {
    KmsHumanRequiredError,
    decryptFieldWithKms,
    encryptFieldWithKms,
    resolveKmsProviderFromEnv,
} from '../lib/crypto'
import { customerAuthRateLimit } from '../middleware/rateLimit'
import { csrfProtection, extractTurnstileToken, inputValidation, verifyTurnstileToken } from '../middleware/security'

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

test('input validation does not consume JSON request bodies before route handlers', async () => {
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', inputValidation)
    app.patch('/stores/:id', async (c) => {
        const body = await c.req.json<{ published?: boolean }>()
        return c.json({ id: c.req.param('id'), published: body.published === true })
    })

    const response = await app.request('/stores/store-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: true }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: 'store-1', published: true })
})

test('Turnstile token extraction accepts canonical and compatibility fields', () => {
    assert.equal(extractTurnstileToken({ turnstile_token: ' canonical ' }), 'canonical')
    assert.equal(extractTurnstileToken({ turnstileToken: 'camel' }), 'camel')
    assert.equal(extractTurnstileToken({ 'cf-turnstile-response': 'cloudflare' }), 'cloudflare')
    assert.equal(extractTurnstileToken({}), null)
})

test('Turnstile verification fails closed without a valid provider response', async () => {
    assert.equal(await verifyTurnstileToken({ ENVIRONMENT: 'production', TURNSTILE_SECRET_KEY: undefined }, 'token'), false)
    assert.equal(await verifyTurnstileToken({ ENVIRONMENT: 'production', TURNSTILE_SECRET_KEY: 'secret' }, 'dev-bypass-token'), false)
    assert.equal(await verifyTurnstileToken({ ENVIRONMENT: 'local', TURNSTILE_SECRET_KEY: undefined }, 'dev-bypass-token'), true)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as typeof fetch
    try {
        assert.equal(await verifyTurnstileToken({ ENVIRONMENT: 'production', TURNSTILE_SECRET_KEY: 'secret' }, 'provider-token'), true)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('customer auth limiter throttles the sixth store-email attempt', async () => {
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', customerAuthRateLimit({
        maxPerIdentity: 5,
        maxPerIp: 30,
        identityGenerator: () => ({
            storeId: 'store-rate-limit-test',
            email: 'buyer-rate-limit-test@example.com',
            operation: 'customer-login-test',
        }),
    }))
    app.post('/login', (c) => c.json({ ok: true }))

    const env = { ENVIRONMENT: 'local' } as Env
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        assert.equal((await app.request('/login', { method: 'POST' }, env)).status, 200)
    }

    const response = await app.request('/login', { method: 'POST' }, env)
    assert.equal(response.status, 429)
    const payload = await response.json<ErrorPayload>()
    assert.equal(payload.error.code, 'CUSTOMER_AUTH_RATE_LIMITED')
})

test('sandbox KMS envelope encrypts PII fields and round-trips without exposing plaintext', async () => {
    const provider = resolveKmsProviderFromEnv({
        LETBUYY_KMS_MODE: 'sandbox',
        LETBUYY_KMS_KEY_ID: 'sandbox-foundation-key',
        LETBUYY_KMS_SANDBOX_SECRET: 'foundation-test-secret',
    })

    const token = await encryptFieldWithKms(provider, 'buyer@example.com')

    assert.match(token, /^kms\./)
    assert.equal(token.includes('buyer@example.com'), false)
    assert.equal(await decryptFieldWithKms(provider, token), 'buyer@example.com')
})

test('live KMS mode is guarded as HUMAN-REQUIRED until credentials are installed', () => {
    assert.throws(
        () => resolveKmsProviderFromEnv({
            LETBUYY_KMS_MODE: 'live',
            LETBUYY_KMS_KEY_ID: 'SKIP_NEEDS_HUMAN_KMS_KEY_ID',
        }),
        KmsHumanRequiredError,
    )
})
