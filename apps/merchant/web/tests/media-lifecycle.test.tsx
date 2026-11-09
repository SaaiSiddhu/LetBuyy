import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js'
import { ToastProvider } from '@letbuyy/ui'
import { MerchantSecurityContext } from '../src/components/security/MerchantSecurityContext'
import { MediaRecoveryProvider } from '../src/components/media/MediaRecoveryProvider'
import { createMediaCommandRecovery } from '../src/lib/media/media-command-recovery'
import GalleryPage from '../src/app/[store]/gallery/page'

const requireUI = createRequire(new URL('../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom')
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const owner = id(1), site = id(2)
const row = { id: id(3), store_id: site, filename: 'Synthetic image', mime_type: 'image/png', url: 'https://cdn.synthetic.invalid/image.png', size_bytes: 3, created_at: '2026-11-07T00:00:00Z' }
async function mount(removing: boolean) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://merchant.synthetic.invalid' })
    const previous = new Map<string, PropertyDescriptor | undefined>()
    const set = (name: string, value: unknown) => { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }) }
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'MutationObserver']) set(name, name === 'window' ? dom.window : dom.window[name])
    set('React', React); set('IS_REACT_ACT_ENVIRONMENT', true)
    const tails = new Map<string, Promise<unknown>>()
    const locks = { request<T>(key: string, work: () => Promise<T> | T) { const task = (tails.get(key) ?? Promise.resolve()).then(work); tails.set(key, task.catch(() => undefined)); return task } }
    Object.defineProperty(dom.window.navigator, 'locks', { value: locks })
    let actor = owner, lost = true, mismatch = false, deleted = false
    let hold: (() => Promise<void>) | null = null
    const writes: { key: string | null; body: unknown; method: string }[] = []
    const transport: typeof fetch = async (url, init) => {
        if ((init?.method ?? 'GET') === 'GET') return Response.json({ data: deleted ? [] : [row], meta: { has_next: false } })
        writes.push({ key: new Headers(init?.headers).get('X-Idempotency-Key'), body: init?.body, method: init!.method! })
        if (removing) deleted = true
        if (hold) await hold()
        if (lost) throw new Error('Synthetic lost server acknowledgement')
        return Response.json({ data: removing ? { deleted: true } : { ...row, id: mismatch ? id(99) : row.id, alt_text: 'Retained label' } })
    }
    set('fetch', transport); dom.window.fetch = transport
    const engine = (a = owner) => createMediaCommandRecovery({ scope: { actorId: a, siteId: site }, store: 'synthetic', storage: dom.window.localStorage, locks, check: () => {}, fetch: transport })
    await assert.rejects(() => engine().change(row.id, removing ? undefined : { alt_text: 'Retained label' }))
    lost = false
    const root = createRoot(dom.window.document.getElementById('root')!)
    const settle = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 0)) }) }
    const render = async () => {
        await act(async () => root.render(<PathParamsContext.Provider value={{ store: 'synthetic' }}><ToastProvider duration={0}>
            <MerchantSecurityContext.Provider value={{ actorId: actor, store: 'synthetic', siteId: site }}>
                <MediaRecoveryProvider key={actor} store="synthetic"><GalleryPage /></MediaRecoveryProvider>
            </MerchantSecurityContext.Provider>
        </ToastProvider></PathParamsContext.Provider>)); await settle()
    }
    const retry = async () => {
        const button = [...dom.window.document.querySelectorAll('button')].find(e => e.textContent === 'Confirm saved media request') as HTMLButtonElement
        assert(button); assert.equal(button.disabled, false)
        await act(async () => button.click()); await settle()
    }
    return { dom, writes, engine, render, retry, settle, mismatch: (value: boolean) => { mismatch = value },
        hold: (work: () => Promise<void>) => { hold = work }, actor: (value: string) => { actor = value },
        close: async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key) } } }
}
test('mounted Gallery recovers deletion even though the row has disappeared', async () => {
    const h = await mount(true)
    try {
        await h.render(); assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /Synthetic image/)
        assert.match(h.dom.window.document.body.textContent ?? '', /Media recovery/)
        await h.retry(); assert.deepEqual(h.writes[1], h.writes[0]); assert.equal(await h.engine().read(), null)
        assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /Confirm saved media request/)
    } finally { await h.close() }
})
test('mounted Gallery retains a wrong metadata acknowledgement and confirms only the original retry', async () => {
    const h = await mount(false)
    try {
        await h.render(); h.mismatch(true); await h.retry(); assert(await h.engine().read())
        assert.match(h.dom.window.document.body.textContent ?? '', /acknowledgement context changed/)
        h.mismatch(false); await h.retry(); assert.equal(await h.engine().read(), null)
        assert.deepEqual(h.writes[2], h.writes[0])
    } finally { await h.close() }
})
test('mounted Gallery retires a delayed recovery success when the account changes', async () => {
    const h = await mount(false); let release!: () => void
    try {
        await h.render(); h.hold(() => new Promise(resolve => { release = resolve }))
        await h.retry(); h.actor(id(8)); await h.render(); release(); await h.settle()
        assert(await h.engine().read()); assert.equal(await h.engine(id(8)).read(), null)
        assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /Confirm saved media request|Retained label/)
    } finally { await h.close() }
})
