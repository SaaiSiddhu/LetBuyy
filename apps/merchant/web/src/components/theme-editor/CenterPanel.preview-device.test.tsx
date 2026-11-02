import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { EDITOR_READY_MESSAGE, EDITOR_VIEWPORT_MESSAGE, EDITOR_SECTION_SELECT_MESSAGE } from '@letbuyy/theme-engine/editor-bridge-protocol'

const { JSDOM } = createRequire(new URL('../../../../../../packages/theme-engine/package.json', import.meta.url))('jsdom')

test('device-only changes retain iframe and send scoped viewport messages even while inspector is off', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:9001' })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 4)) Object.defineProperty(globalThis, name, { configurable: true, value: Reflect.get(dom.window, name) })
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class { observe() {} disconnect() {} } })
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
    const beforeUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL
    process.env.NEXT_PUBLIC_STOREFRONT_URL = 'http://localhost:3003'
    const { default: CenterPanel } = await import('./CenterPanel')
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root')!)
    const context = { sessionId: '12345678-1234-4234-8234-123456789012', revision: 3, templateKey: 'index' }
    const selected: string[] = []
    const props = { storeName: 'synthetic-store', viewport: 'desktop' as const, previewToken: 'synthetic-token', previewError: null,
        isPreviewRefreshing: false, selectedSectionId: null, selectedBlockId: null, previewContext: context,
        identities: { hero: { type: 'hero-banner', blocks: {} } }, onRetryPreview: () => {}, onSelectSection: (id: string) => selected.push(id) }
    try {
        await act(async () => root.render(<CenterPanel {...props} />))
        const frame = dom.window.document.querySelector('iframe')!
        const initialSrc = frame.src
        const sent: Array<{ message: Record<string, unknown>; origin: string }> = []
        frame.contentWindow!.postMessage = (message: Record<string, unknown>, origin: string) => { sent.push({ message, origin }) }
        await act(async () => frame.dispatchEvent(new dom.window.Event('load')))
        await act(async () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { origin: 'http://localhost:3003', source: frame.contentWindow, data: { type: EDITOR_READY_MESSAGE, context } })))
        const inspect = [...dom.window.document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Inspect preview')!
        await act(async () => inspect.click())
        await act(async () => root.render(<CenterPanel {...props} viewport="tablet" />))
        assert.equal(dom.window.document.querySelector('iframe'), frame)
        assert.equal(frame.src, initialSrc)
        assert.ok(sent.some(row => row.message.type === EDITOR_VIEWPORT_MESSAGE && row.message.viewport === 'tablet' && row.origin === 'http://localhost:3003'))
        await act(async () => root.render(<CenterPanel {...props} viewport="mobile" />))
        assert.equal(dom.window.document.querySelector('iframe'), frame)
        assert.ok(sent.some(row => row.message.type === EDITOR_VIEWPORT_MESSAGE && row.message.viewport === 'mobile'))
        await act(async () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { origin: 'http://forged.invalid', source: frame.contentWindow, data: { type: EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero', context } })))
        assert.deepEqual(selected, [])
        await act(async () => root.render(<CenterPanel {...props} viewport="mobile" previewToken="new-synthetic-token" />))
        assert.notEqual(dom.window.document.querySelector('iframe'), frame, 'a new signed token navigates to a new iframe')
    } finally {
        await act(async () => root.unmount())
        if (beforeUrl === undefined) delete process.env.NEXT_PUBLIC_STOREFRONT_URL; else process.env.NEXT_PUBLIC_STOREFRONT_URL = beforeUrl
        for (const [name, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else Reflect.deleteProperty(globalThis, name)
        }
        dom.window.close()
    }
})
