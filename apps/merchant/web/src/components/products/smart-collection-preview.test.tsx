// CLIENT SEAM ONLY: mount the actual page/Next contexts/shared UI with explicit
// synthetic HTTP inputs. These tests do not prove PostgreSQL, auth, or real API
// success; the separate owned and normal-Identity browser fixtures do that.
import assert from 'node:assert/strict'
import test from 'node:test'
import {createRequire} from 'node:module'
import React, {act} from 'react'

const requireUI = createRequire(new URL('../../../../../../packages/typescript/ui/package.json', import.meta.url))
const {JSDOM} = requireUI('jsdom')
Object.assign(globalThis, {React, IS_REACT_ACT_ENVIRONMENT: true})
const id = '11111111-1111-4111-8111-111111111111'
const stored = {id, store_id: '22222222-2222-4222-8222-222222222222', name: 'Synthetic saved collection', slug: 'synthetic-saved',
    description: null, conditions: [{field: 'title', op: 'contains', value: 'Synthetic'}], match_type: 'all', version: 7, created_at: '2026-10-18T00:00:00Z'}
const result = (count = 1, evaluated = 2) => ({collection_id: id, match_type: 'all', condition_count: 1, count,
    sample_product_ids: count ? ['33333333-3333-4333-8333-333333333333'] : [], evaluated_of: evaluated, capped_at: 500})
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? {data} : {error: {code: 'SYNTHETIC_READ_FAILURE', message: 'Synthetic read failed'}}),
    {status, headers: {'Content-Type': 'application/json'}})
type Transport = (url: string, init?: RequestInit) => Promise<Response>

async function mount(transport: Transport) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {url: 'https://merchant.example.test/alpha/products/smart-collections', pretendToBeVisual: true})
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.filter(name => name !== 'fetch')) {
        const value = name === 'window' || name === 'self' ? dom.window : dom.window[name]
        Object.defineProperty(globalThis, name, {configurable: true, writable: true,
            value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(name) ? value.bind(dom.window) : value})
    }
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => transport(String(input), init)) as typeof fetch
    const {createRoot} = await import('react-dom/client')
    const {PathParamsContext} = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js')
    const {AppRouterContext} = await import('next/dist/shared/lib/app-router-context.shared-runtime.js')
    const {ToastProvider} = await import('@letbuyy/ui')
    const {default: SmartCollectionsPage} = await import('../../app/[store]/products/smart-collections/page')
    const root = createRoot(dom.window.document.getElementById('root')!)
    const router = { bfcacheId: 'synthetic-router',back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {}}
    await act(async () => {root.render(<AppRouterContext.Provider value={router}><PathParamsContext.Provider value={{store: 'alpha'}}>
        <ToastProvider duration={0}><SmartCollectionsPage /></ToastProvider>
    </PathParamsContext.Provider></AppRouterContext.Provider>)})
    const body = () => dom.window.document.body
    const text = () => body().textContent ?? ''
    const button = (pattern: RegExp) => {
        const element = [...body().querySelectorAll('button')].find((item: any) => pattern.test(item.textContent ?? '')) as HTMLButtonElement | undefined
        assert.ok(element, 'Missing real page button ' + pattern + ': ' + text())
        return element
    }
    const click = async (pattern: RegExp) => {await act(async () => {button(pattern).click()})}
    const close = async () => {
        await act(async () => {root.unmount()}); dom.window.close()
        for (const name of names) {if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name)}
    }
    return {body, text, button, click, close}
}
const previewButton = /Preview (?:matching products|saved rules)$/

test('the real saved-collection page renders a supplied preview from a GET without creating or editing rules', async () => {
    const calls: {url: string; method: string; body: unknown}[] = []
    const h = await mount(async (url, init) => {calls.push({url, method: init?.method ?? 'GET', body: init?.body}); return response(url.endsWith('/preview') ? result() : [stored])})
    try {
        await h.click(/Edit$/); await h.click(previewButton)
        assert.match(h.text(), /1 product match/); assert.match(h.text(), /evaluated 2 active products/)
        assert.equal(calls.length, 2); assert.ok(calls[1].url.endsWith('/smart-collections/' + id + '/preview'))
        assert.ok(calls.every(call => call.method === 'GET' && call.body === undefined))
        assert.equal((h.body().querySelector('input') as HTMLInputElement).value, stored.name)
    } finally {await h.close()}
})

test('a supplied preview HTTP failure stays visible until an explicit read retry succeeds', async () => {
    let attempts = 0
    const calls: string[] = []
    const h = await mount(async (url, init) => {
        calls.push(init?.method ?? 'GET')
        if (!url.endsWith('/preview')) return response([stored])
        attempts += 1
        return attempts === 1 ? response(null, 503) : response(result())
    })
    try {
        await h.click(/Edit$/); await h.click(previewButton)
        assert.match(h.text(), /Unable to load preview/); assert.doesNotMatch(h.text(), /0 products? match/)
        assert.equal(attempts, 1); await h.click(previewButton)
        assert.equal(attempts, 2); assert.match(h.text(), /1 product match/)
        assert.doesNotMatch(h.text(), /Unable to load preview/)
        assert.ok(calls.every(method => method === 'GET'))
    } finally {await h.close()}
})

test('a supplied capped preview reports its evaluated subset and retains the saved form unchanged', async () => {
    const h = await mount(async url => response(url.endsWith('/preview') ? result(500, 500) : [stored]))
    try {
        await h.click(/Edit$/); await h.click(previewButton)
        assert.match(h.text(), /500 products match/); assert.match(h.text(), /evaluated 500 active products/)
        assert.match(h.text(), /(?:top|first|limit|capp|evaluated)[^.]*(?:500)/i)
        assert.equal((h.body().querySelector('input') as HTMLInputElement).value, stored.name)
    } finally {await h.close()}
})
