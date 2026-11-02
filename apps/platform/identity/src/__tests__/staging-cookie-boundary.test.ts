import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from '../proxy'
import { validateCsrf } from '../lib/auth/csrf'

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
