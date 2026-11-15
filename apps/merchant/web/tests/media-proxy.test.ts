import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server'
import { createLetbuyyApiClient, LetbuyyApiError } from '@letbuyy/api-client'
import * as shared from '@letbuyy/shared-types'
import { validateMerchantMutationRequest } from '../src/lib/api/request-origin'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const site = id(1), actor = id(2), media = id(3), key = id(4), origin = 'https://merchant.synthetic.invalid'
function evaluate<T>(path: string, deps: Record<string, unknown>): T {
    const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
    const exports = {}; new Function('require', 'exports', js)((name: string) => { assert.ok(deps[name], name); return deps[name] }, exports)
    return exports as T
}
for (const operation of ['upload', 'recover', 'register', 'update', 'delete'] as const) {
    for (const fault of ['none', 'origin', 'key', 'session', 'actor', 'owner', 'denied'] as const) test(`${operation}: actual Next/SDK media boundary ${fault}`, async () => {
        const writes: Request[] = []
        const api = createLetbuyyApiClient({ baseUrl: 'https://gateway.synthetic.invalid/v1', storeId: site, fetch: async (input, init) => {
            const request = new Request(input, init), url = new URL(request.url)
            if (url.pathname.endsWith('/auth/custom/session')) return Response.json({ authenticated: fault !== 'session', user: fault === 'session' ? null : { id: actor } })
            writes.push(request.clone()); assert.equal(request.headers.get('X-Store-ID'), site); assert.equal(request.headers.get('X-Idempotency-Key'), key)
            if (fault === 'denied') return Response.json({ error: { code: 'FORBIDDEN', message: 'Synthetic access revoked' } }, { status: 403 })
            if (operation === 'upload') {
                assert.equal(url.search, '', 'The original upload fingerprint must match the canonical recovery contract')
                const form = await request.formData(); assert.equal(form.get('folder'), `${site}/products`); assert.equal(form.get('store_id'), site)
            } else if (operation === 'recover') {
                const body = await request.json(); assert.equal(body.idempotency_key, key); assert.equal(body.store_id, site)
            } else if (operation === 'register') assert.equal((await request.json()).store_id, site)
            else if (operation === 'update') assert.deepEqual(await request.json(), { alt_text: 'Synthetic updated label' })
            const upload = { url: 'https://cdn.synthetic.invalid/public-media/original.png', key: 'public-media/original.png', size: 3, content_type: 'image/png', storage: 'r2', store_id: site }
            return Response.json({ data: operation === 'upload' || operation === 'recover' ? upload : operation === 'delete' ? { deleted: true } : { id: media, store_id: site, filename: 'synthetic.png', url: upload.url, mime_type: 'image/png', size_bytes: 3 } })
        } })
        const client = { createMerchantApiClient: () => api, merchantApiErrorResponse: (error: unknown) => NextResponse.json({ error: { code: error instanceof LetbuyyApiError ? error.code : 'UNAVAILABLE', message: error instanceof Error ? error.message : 'Synthetic error' } }, { status: error instanceof LetbuyyApiError ? error.status : 503 }) }
        const owner = { resolveOwnedStoreId: async () => fault === 'owner' ? { error: NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }) } : { storeId: site } }
        const security = evaluate<Record<string, unknown>>('../src/lib/api/merchant-security-scope.ts', { 'next/server': { NextRequest, NextResponse }, './client': client, './request-origin': { validateMerchantMutationRequest }, '@/lib/stores/resolve-owned-store': owner })
        const path = operation === 'upload' ? 'upload' : operation === 'recover' ? 'upload/recover' : operation === 'register' ? 'media' : 'media/[mediaId]'
        const route = evaluate<Record<string, (r: NextRequest, c: { params: Promise<{ store: string; mediaId: string }> }) => Promise<Response>>>(`../src/app/api/${operation === 'recover' ? 'v1/' : ''}stores/[store]/${path}/route.ts`, {
            'next/server': { NextRequest, NextResponse }, '@letbuyy/shared-types': shared, '@/lib/api/client': client, '@/lib/api/merchant-security-scope': security,
        })
        const headers: Record<string, string> = { host: 'merchant.synthetic.invalid', origin: fault === 'origin' ? 'https://foreign.synthetic.invalid' : origin,
            'X-Idempotency-Key': fault === 'key' ? '' : key, 'X-LetBuyy-Merchant-Context': fault === 'actor' ? id(99) : actor }
        const data = operation === 'recover' ? { store_id: site, idempotency_key: key, filename: 'synthetic.png', folder: `${site}/products`, content_type: 'image/png', byte_size: 3, sha256_hex: 'a'.repeat(64) }
            : operation === 'register' ? { store_id: site, filename: 'synthetic.png', url: 'https://cdn.synthetic.invalid/public-media/original.png', mime_type: 'image/png' }
                : { alt_text: 'Synthetic updated label' }
        let body: BodyInit | undefined = operation === 'delete' ? undefined : JSON.stringify(data)
        if (operation === 'upload') { const form = new FormData(); form.set('file', new File([Uint8Array.of(1, 2, 3)], 'synthetic.png', { type: 'image/png' })); form.set('folder', 'foreign-folder'); form.set('store_id', id(99)); body = form }
        else headers['Content-Type'] = 'application/json'
        const method = operation === 'update' ? 'PATCH' : operation === 'delete' ? 'DELETE' : 'POST'
        const result = await route[method](new NextRequest(origin + (operation === 'recover' ? '/api/v1/stores/synthetic/' : '/api/stores/synthetic/') + path, { method, headers, body }), { params: Promise.resolve({ store: 'synthetic', mediaId: media }) })
        const expected = { none: operation === 'upload' || operation === 'register' ? 201 : 200, origin: 403, key: 400, session: 401, actor: 409, owner: 404, denied: 403 }
        assert.equal(result.status, expected[fault], JSON.stringify(await result.json()))
        assert.match(result.headers.get('Cache-Control') ?? '', /private.*no-store/)
        assert.equal(writes.length, ['none', 'denied'].includes(fault) ? 1 : 0)
    })
}
