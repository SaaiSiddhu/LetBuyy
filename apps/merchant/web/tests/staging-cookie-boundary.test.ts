import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

test('staging Merchant routing ignores production sessions and selects staging from a mixed cookie jar', () => {
    const prior = process.env.NEXT_PUBLIC_ENV
    process.env.NEXT_PUBLIC_ENV = 'staging'
    try {
        const url = 'https://admin-staging.letbuyy.com/synthetic/products'
        const productionOnly = proxy(new NextRequest(url, { headers: { Cookie: `lb_session=${'p'.repeat(32)}` } }))
        assert.equal(productionOnly.status, 307)
        const mixed = proxy(new NextRequest(url, { headers: { Cookie: `lb_session=${'p'.repeat(32)}; lb_session_staging=${'s'.repeat(32)}` } }))
        assert.equal(mixed.headers.get('x-middleware-next'), '1')
        assert.equal(mixed.headers.get('location'), null)
    } finally {
        if (prior === undefined) delete process.env.NEXT_PUBLIC_ENV
        else process.env.NEXT_PUBLIC_ENV = prior
    }
})
