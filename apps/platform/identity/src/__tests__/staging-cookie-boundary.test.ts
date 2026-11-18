import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'
import { validateCsrf } from '../lib/auth/csrf'
import { accountsCookieBaseOptions } from '../lib/auth/cookies'
import { isProductionIdentityRuntime, canUseIdentityDevAuthBypass } from '../lib/dev-auth-bypass'

test('staging Accounts routing and CSRF use only staging cookies', () => {
    const prior = process.env.NEXT_PUBLIC_ENV
    process.env.NEXT_PUBLIC_ENV = 'staging'
    try {
        const origin = 'https://accounts-staging.letbuyy.com'
        const production = `lb_session=${'p'.repeat(32)}; letbuyy_csrf=${'p'.repeat(64)}`
        assert.equal(new URL(proxy(new NextRequest(origin, { headers: { Cookie: production } })).headers.get('location')!).pathname, '/lookup')
        const mixed = `${production}; lb_session_staging=${'s'.repeat(32)}; letbuyy_csrf_staging=${'s'.repeat(64)}`
        assert.equal(new URL(proxy(new NextRequest(origin, { headers: { Cookie: mixed } })).headers.get('location')!).pathname, '/select')
        const fresh = proxy(new NextRequest(`${origin}/lookup`, { headers: { Cookie: production } }))
        assert.equal(fresh.cookies.get('letbuyy_csrf'), undefined)
        assert.ok(fresh.cookies.get('letbuyy_csrf_staging')?.value)
        assert.equal(validateCsrf(new NextRequest(`${origin}/api/auth/login`, { headers: { Cookie: production, 'X-CSRF-Token': 'p'.repeat(64) } })), false)
        assert.equal(validateCsrf(new NextRequest(`${origin}/api/auth/login`, { headers: { Cookie: mixed, 'X-CSRF-Token': 's'.repeat(64) } })), true)
        assert.equal(validateCsrf(new NextRequest(`${origin}/api/auth/login`, { headers: { Cookie: mixed, 'X-CSRF-Token': 'p'.repeat(64) } })), false)
    } finally {
        if (prior === undefined) delete process.env.NEXT_PUBLIC_ENV
        else process.env.NEXT_PUBLIC_ENV = prior
    }
})

test('only the explicit development loopback Accounts origin receives HTTP CSRF cookies', () => {
    const keys = ['NODE_ENV', 'NEXT_PUBLIC_ENV', 'NEXT_PUBLIC_ACCOUNTS_URL'] as const
    const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]))
    try {
        Object.assign(process.env, { NODE_ENV: 'production' })
        const cases = [
            ['development', 'http://localhost:54351', 'http://localhost:54351', false],
            ['development', 'http://127.0.0.1:54351', 'http://127.0.0.1:54351', false],
            ['development', 'http://[::1]:54351', 'http://[::1]:54351', false],
            ['development', 'http://localhost:54351', 'http://localhost:54352', true],
            ['development', 'http://localhost:54351', 'https://accounts.letbuyy.com', true],
            ['development', 'http://outside.example:54351', 'http://outside.example:54351', true],
            ['development', 'http://localhost:54351/other', 'http://localhost:54351', true],
            ['development', 'http://localhost:54351/?secret=ignored', 'http://localhost:54351', true],
            ['staging', 'http://localhost:54351', 'http://localhost:54351', true],
            ['production', 'http://localhost:54351', 'http://localhost:54351', true],
            ['staging', 'https://accounts-staging.letbuyy.com', 'https://accounts-staging.letbuyy.com', true],
            ['production', 'https://accounts.letbuyy.com', 'https://accounts.letbuyy.com', true],
        ] as const
        for (const [environment, configured, requestOrigin, secure] of cases) {
            process.env.NEXT_PUBLIC_ENV = environment
            process.env.NEXT_PUBLIC_ACCOUNTS_URL = configured
            const response = proxy(new NextRequest(`${requestOrigin}/mobile/authorize`))
            const cookie = response.headers.get('set-cookie') || ''
            assert.equal(/;\s*Secure(?:;|$)/i.test(cookie), secure)
            assert.equal(/;\s*SameSite=strict(?:;|$)/i.test(cookie), true)
            assert.equal(/;\s*Domain=/i.test(cookie), false)
            assert.equal(response.headers.get('cache-control'), 'private, no-store')
            assert.equal(validateCsrf(new NextRequest(`${requestOrigin}/api/auth/mobile/bind`)), false)
        }
    } finally {
        for (const key of keys) {
            if (prior[key] === undefined) delete process.env[key]
            else Object.assign(process.env, { [key]: prior[key] })
        }
    }
})

test('local session cookie transport does not relax signing-key or auth-bypass gates', () => {
    const keys = ['NODE_ENV', 'NEXT_PUBLIC_ENV', 'NEXT_PUBLIC_ACCOUNTS_URL', 'COOKIE_DOMAIN', 'LETBUYY_ENABLE_DEV_AUTH_BYPASS'] as const
    const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]))
    try {
        Object.assign(process.env, { NODE_ENV: 'production', COOKIE_DOMAIN: '.letbuyy.com', LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true' })
        for (const [environment, configured, secure] of [
            ['development', 'http://localhost:54351', false],
            ['development', 'http://127.0.0.1:54351', false],
            ['development', 'http://[::1]:54351', false],
            ['staging', 'http://localhost:54351', true],
            ['production', 'http://localhost:54351', true],
            ['development', 'https://accounts.letbuyy.com', true],
            ['development', 'https://accounts-staging.letbuyy.com', true],
            ['development', 'http://outside.example:54351', true],
            ['development', 'http://localhost:54351/other', true],
            ['development', 'invalid-url', true],
        ] as const) {
            process.env.NEXT_PUBLIC_ENV = environment
            process.env.NEXT_PUBLIC_ACCOUNTS_URL = configured
            const options = accountsCookieBaseOptions()
            assert.equal(options.secure, secure)
            assert.equal(options.httpOnly, true)
            assert.equal(options.path, '/')
            assert.equal(options.domain, secure ? '.letbuyy.com' : undefined)
            assert.equal(isProductionIdentityRuntime(process.env), true)
            assert.equal(canUseIdentityDevAuthBypass(process.env), false)
        }
    } finally {
        for (const key of keys) {
            if (prior[key] === undefined) delete process.env[key]
            else Object.assign(process.env, { [key]: prior[key] })
        }
    }
})
