import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'

const requireApp = createRequire(new URL('../../../package.json', import.meta.url))
const { JSDOM } = createRequire(new URL('../../../../../../packages/theme-engine/package.json', import.meta.url))('jsdom')

test('catalog searches installed candidates, announces disabled reasons and restores focus on Escape', async () => {
    const dom = new JSDOM('<!doctype html><button id="previous">Previous</button><div id="root"></div>', { url: 'http://localhost' })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 4)) Object.defineProperty(globalThis, name, { configurable: true, value: Reflect.get(dom.window, name) })
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
    const oldCss = requireApp.extensions['.css']
    requireApp.extensions['.css'] = module => { module.exports = { default: new Proxy({}, { get: (_, key) => String(key) }) } }
    const { default: SectionCatalogPopover } = await import('./SectionCatalogPopover')
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root')!)
    const selected: string[] = [], closed: string[] = []
    const candidates = [
        { type: 'newsletter-signup', name: 'Newsletter Signup', description: 'Collect updates', category: 'Marketing', presetName: 'Newsletter', available: true },
        { type: 'product-grid', name: 'Product Grid', description: 'Product list', category: 'Commerce', presetName: 'Grid', available: false, reason: 'Not enabled in Footer' },
    ]
    try {
        dom.window.document.getElementById('previous')!.focus()
        await act(async () => root.render(<SectionCatalogPopover target={{ group: 'footer', templateKey: 'index', position: 'end' }} candidates={candidates} onChoose={type => selected.push(type)} onClose={() => closed.push('close')} />))
        const search = dom.window.document.querySelector('input[type="search"]') as HTMLInputElement
        assert.equal(dom.window.document.activeElement, search)
        assert.match(dom.window.document.body.textContent || '', /Not enabled in Footer/)
        assert.equal((dom.window.document.querySelector('button[title="Not enabled in Footer"]') as HTMLButtonElement).disabled, true)
        await act(async () => {
            Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, 'newsletter')
            search.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
        })
        assert.ok(dom.window.document.body.textContent?.includes('Newsletter Signup'))
        assert.equal(dom.window.document.body.textContent?.includes('Product Grid'), false)
        const availableButton = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent?.includes('Newsletter Signup'))
        assert.ok(availableButton)
        await act(async () => availableButton.click())
        assert.deepEqual(selected, ['newsletter-signup'])
        await act(async () => search.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
        assert.deepEqual(closed, ['close'])
        await act(async () => root.unmount())
        assert.equal(dom.window.document.activeElement?.id, 'previous')
    } finally {
        if (oldCss) requireApp.extensions['.css'] = oldCss; else delete requireApp.extensions['.css']
        for (const [name, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else Reflect.deleteProperty(globalThis, name)
        }
        dom.window.close()
    }
})
