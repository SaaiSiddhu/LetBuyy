import assert from 'node:assert/strict'
import test from 'node:test'
import nextConfig from '../../apps/marketing/web/next.config'
import { createContentSecurityPolicy } from '../../config/security/next-security-headers'

const originVariables = [
    'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_ACCOUNTS_URL', 'NEXT_PUBLIC_ADMIN_URL',
    'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_STOREFRONT_URL',
    'NEXT_PUBLIC_THEME_MARKETPLACE_URL', 'NEXT_PUBLIC_APP_MARKETPLACE_URL',
    'NEXT_PUBLIC_DEVELOPER_PORTAL_URL', 'CORS_CREDENTIAL_ORIGINS',
] as const

async function withOrigins(run: () => Promise<void>) {
    const saved = Object.fromEntries(originVariables.map(key => [key, process.env[key]]))
    try {
        for (const key of originVariables) delete process.env[key]
        await run()
    } finally {
        for (const key of originVariables) {
            if (saved[key] === undefined) delete process.env[key]
            else process.env[key] = saved[key]
        }
    }
}

async function directives() {
    assert.equal(typeof nextConfig.headers, 'function')
    const entries = await nextConfig.headers!()
    const policy = entries.flatMap(entry => entry.headers)
        .find(header => header.key === 'Content-Security-Policy')?.value
    assert.ok(policy)
    return new Map(policy.split(';').map(part => {
        const [name, ...sources] = part.trim().split(/\s+/)
        return [name, sources]
    }))
}

test('marketing permits its canonical browser API fallback when no URL env is configured', async () => withOrigins(async () => {
    const policy = await directives()
    assert.ok(policy.get('connect-src')?.includes('https://api.letbuyy.com'))
    assert.ok(!policy.get('script-src')?.includes('https://api.letbuyy.com'))
    assert.ok(!policy.get('frame-src')?.includes('https://api.letbuyy.com'))
    assert.ok(!policy.get('connect-src')?.includes('*'))
    assert.ok(!policy.get('connect-src')?.includes('https://*.letbuyy.com'))
}))

test('marketing allows the configured local API origin across versioned request paths', async () => withOrigins(async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:9010/v1'
    const policy = await directives()
    assert.ok(policy.get('connect-src')?.includes('http://127.0.0.1:9010'))
    assert.ok(!policy.get('connect-src')?.includes('http://127.0.0.1:9010/v1'))
    assert.ok(!policy.get('connect-src')?.includes('https://unrelated.example.invalid'))
    assert.deepEqual(policy.get('object-src'), ["'none'"])
    assert.deepEqual(policy.get('form-action'), ["'self'"])
}))

test('additional API access cannot introduce wildcard, credentialed or non-HTTP sources', () => {
    for (const origin of ['*', 'https:', 'https://*.example.invalid', 'data:text/plain,no', 'https://user:secret@example.invalid']) {
        assert.throws(() => createContentSecurityPolicy({ connectOrigins: [origin] }))
    }
    assert.match(createContentSecurityPolicy({ connectOrigins: ['https://gateway.example.invalid/v1'] }), /connect-src[^;]*https:\/\/gateway\.example\.invalid(?: |;)/)
})
