import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act, useState } from 'react'
import type { EditorSectionInsertionTarget, ExtendedSectionSchema } from '@letbuyy/theme-engine'
import type { EditorState } from '../src/components/theme-editor/editor-view-state'

const requireApp = createRequire(new URL('../package.json', import.meta.url))
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom')
const row = (id: string, type: string, order: number) => ({ id, type, order, visible: true, settings: {}, blocks: [] })
const schemas = Object.fromEntries(['announcement-bar', 'header', 'hero-banner', 'product-grid', 'footer', 'newsletter-signup'].map(type => [type, {
    type, name: type.replace(/\b\w/g, letter => letter.toUpperCase()).replaceAll('-', ' '), description: '', defaults: {}, settings_schema: {},
}])) as Record<string, ExtendedSectionSchema>

test('mounted tree opens exact before/after and shared-group catalogs, including an empty group', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names.slice(0, 4)) Object.defineProperty(globalThis, name, { configurable: true, value: Reflect.get(dom.window, name) })
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
    const oldCss = requireApp.extensions['.css']
    requireApp.extensions['.css'] = module => { module.exports = { default: new Proxy({}, { get: (_, key) => String(key) }) } }
    const { default: SectionTreePanel } = await import('../src/components/theme-editor/SectionTreePanel')
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root')!)
    const state: EditorState = { themeSettings: {}, sections: {
        header: [row('announcement', 'announcement-bar', 10), row('header', 'header', 20)],
        template: [row('hero', 'hero-banner', 10), row('products', 'product-grid', 20)],
        footer: [],
    } }
    const opened: EditorSectionInsertionTarget[] = [], chosen: string[] = []
    function Harness() {
        const [target, setTarget] = useState<EditorSectionInsertionTarget | null>(null)
        return <SectionTreePanel state={state} sectionSchemas={schemas} selection={{ kind: 'section', sectionId: 'hero' }}
            templateKey="index" catalogTarget={target} sectionCandidates={[{ type: 'hero-banner', name: 'Hero Banner', description: 'Hero preset', category: 'Sections', presetName: 'Hero', available: true }]}
            onSelect={() => {}} onOpenCatalog={next => { opened.push(next); setTarget(next) }} onCloseCatalog={() => setTarget(null)}
            onInsertSection={type => chosen.push(type)} onMoveSection={() => {}} onToggleSection={() => {}} onRemoveSection={() => {}} />
    }
    const button = (label: string) => {
        const found = [...dom.window.document.querySelectorAll('button')].find(entry => entry.getAttribute('aria-label') === label || entry.textContent?.trim() === label)
        assert.ok(found, `Missing ${label}`)
        return found
    }
    try {
        await act(async () => root.render(<Harness />))
        await act(async () => button('Add section before Hero Banner').click())
        assert.deepEqual(opened.at(-1), { group: 'template', templateKey: 'index', position: 'before', adjacentSectionId: 'hero' })
        assert.match(dom.window.document.body.textContent || '', /before selected template section/)
        await act(async () => button('Add section after Announcement Bar').click())
        assert.deepEqual(opened.at(-1), { group: 'header', templateKey: 'index', position: 'after', adjacentSectionId: 'announcement' })
        await act(async () => button('Add section to Footer').click())
        assert.deepEqual(opened.at(-1), { group: 'footer', templateKey: 'index', position: 'end' })
        assert.match(dom.window.document.body.textContent || '', /End of footer/)
        await act(async () => button('Close section catalog').click())
        await act(async () => button('Add section to Template').click())
        const catalogButton = [...dom.window.document.querySelectorAll('button')].find(entry => entry.textContent?.includes('Hero preset'))
        assert.ok(catalogButton)
        await act(async () => catalogButton.click())
        assert.deepEqual(chosen, ['hero-banner'])
    } finally {
        await act(async () => root.unmount())
        if (oldCss) requireApp.extensions['.css'] = oldCss; else delete requireApp.extensions['.css']
        for (const [name, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else Reflect.deleteProperty(globalThis, name)
        }
        dom.window.close()
    }
})
