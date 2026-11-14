import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { proxy as routeRequest } from '../../apps/marketing/web/src/proxy'

// Resolve the runtime from the app's declared dependency, not a test-local copy.
const { NextRequest } = createRequire(new URL('../../apps/marketing/web/package.json', import.meta.url))('next/server')
const origin = 'https://www.letbuyy.com'

function run(path: string, headers: Record<string, string> = {}) {
    return routeRequest(new NextRequest(new URL(path, origin), { headers }))
}

test('explicit locale query wins while preserving path, query and intentional cookie policy', () => {
    const response = run('/pricing?country=in&lang=ta&ref=local-test', {
        Cookie: 'letbuyy_locale=in', 'Accept-Language': 'hi-IN',
    })
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), `${origin}/in-ta/pricing?country=in&lang=ta&ref=local-test`)
    assert.match(response.headers.get('set-cookie') ?? '', /letbuyy_locale=in-ta/)
    assert.match(response.headers.get('set-cookie') ?? '', /Path=\/;.*SameSite=lax/)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('saved locale wins over language detection, without guessing a new preference cookie', () => {
    const response = run('/resources?q=gst', { Cookie: 'letbuyy_locale=in-hi', 'Accept-Language': 'ta-IN' })
    assert.equal(response.headers.get('location'), `${origin}/in-hi/resources?q=gst`)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('vary'), 'Accept-Language, Cookie')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('language detection and default fallback retain locale-free route semantics', () => {
    assert.equal(run('/pricing', { 'Accept-Language': 'ta-IN, en;q=0.5' }).headers.get('location'), `${origin}/in-ta/pricing`)
    assert.equal(run('/pricing', { Cookie: 'letbuyy_locale=not-a-locale', 'Accept-Language': 'fr-FR' }).headers.get('location'), `${origin}/in/pricing`)
    assert.equal(run('/').headers.get('location'), `${origin}/in`)
})

test('localized paths remain authoritative over cookies and replace a forged language header', () => {
    const response = run('/in-hi/resources', { Cookie: 'letbuyy_locale=in-ta', 'x-letbuyy-locale': 'in-ta' })
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('x-middleware-request-x-letbuyy-locale'), 'in-hi')
    assert.equal(response.headers.get('set-cookie'), null)
})

test('explicit language changes on localized routes preserve the rest of the URL', () => {
    const response = run('/in/pricing?country=in&lang=hi&ref=local-test')
    assert.equal(response.headers.get('location'), `${origin}/in-hi/pricing?country=in&lang=hi&ref=local-test`)
    assert.match(response.headers.get('set-cookie') ?? '', /letbuyy_locale=in-hi/)
})

test('API, discovery and asset paths pass through without locale redirects or cookies', () => {
    for (const path of ['/api/founding-pricing', '/robots.txt', '/sitemap.xml', '/icons/logo.svg', '/_next/static/a.js']) {
        const response = run(path, { 'Accept-Language': 'ta-IN', 'x-letbuyy-locale': 'in-ta' })
        assert.equal(response.headers.get('location'), null, path)
        assert.equal(response.headers.get('set-cookie'), null, path)
        assert.equal(response.headers.get('x-middleware-request-x-letbuyy-locale'), 'in', path)
    }
})
