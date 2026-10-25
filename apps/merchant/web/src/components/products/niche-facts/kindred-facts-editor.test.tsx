import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { GiftFactsSchema, validateGiftMediaRoles } from '@letbuyy/commerce-core'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

const { JSDOM } = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))('jsdom') as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
}
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

async function mount(initial: unknown = null, options: { disabled?: boolean; instances?: number } = {}) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/synthetic' })
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Node']
    const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true, writable: true,
        value: name === 'window' || name === 'self' ? dom.window : Reflect.get(dom.window, name),
    })
    const { createRoot } = await import('react-dom/client')
    const { KindredFactsEditor } = await import('./kindred-facts-editor')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let current = initial, submissions = 0
    let resources: NicheFactsEditorProps['resources'] = { images: ['https://cdn.example.test/open.webp', 'https://cdn.example.test/closed.webp'], variantOptions: [] }
    const changes: unknown[] = []
    const render = () => root.render(<form onSubmit={event => { event.preventDefault(); submissions++ }}>
        {Array.from({ length: options.instances ?? 1 }, (_, index) => <KindredFactsEditor key={index} value={current} resources={resources} disabled={options.disabled} onChange={next => {
            current = next; changes.push(structuredClone(next)); render()
        }} />)}
    </form>)
    await act(async () => render())
    const field = (label: string) => {
        const element = [...container.querySelectorAll('label')].find(item => item.textContent === label)
        assert.ok(element, `Missing field ${label}`)
        const control = dom.window.document.getElementById(element.htmlFor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
        assert.ok(control, `Label ${label} must name a control`)
        return control
    }
    const button = (label: string) => {
        const element = [...container.querySelectorAll('button')].find(item => item.textContent === label)
        assert.ok(element, `Missing button ${label}`)
        return element
    }
    const click = async (label: string) => { await act(async () => button(label).click()) }
    const change = async (label: string, value: string) => {
        await act(async () => {
            const control = field(label)
            const prototype = control.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value)
            control.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
            control.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
        })
    }
    const close = async () => {
        await act(async () => root.unmount())
        dom.window.close()
        for (const name of names) {
            const descriptor = previous.get(name)
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else Reflect.deleteProperty(globalThis, name)
        }
    }
    return {
        container, field, button, click, change, changes, current: () => current, submissions: () => submissions,
        resources: async (next: NicheFactsEditorProps['resources']) => { resources = next; await act(async () => render()) },
        close,
    }
}

test('unknown facts stay absent until edited and clearing the last optional field removes the namespace', async () => {
    const h = await mount()
    try {
        assert.deepEqual(h.changes, [])
        assert.match(h.container.textContent!, /No contents list supplied/)
        assert.equal(h.container.querySelectorAll('form').length, 1)
        assert.equal(h.button('Clear all gift facts').disabled, true)
        await h.change('Suitability note (optional)', 'For a quiet morning.')
        assert.deepEqual(GiftFactsSchema.parse(h.current()), { schemaVersion: 1, suitabilityNote: 'For a quiet morning.' })
        await h.change('Suitability note (optional)', '')
        assert.equal(h.current(), null)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('real row editing preserves incomplete drafts, validates quantities and emits the exact supplied contents', async () => {
    const h = await mount()
    try {
        await h.click('Add included item')
        assert.equal(GiftFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Item 1 quantity').getAttribute('aria-invalid'), 'true')
        const errorId = h.field('Item 1 quantity').getAttribute('aria-describedby')!
        assert.ok(h.container.ownerDocument.getElementById(errorId))
        await h.change('Item 1 name', 'Ceramic mug')
        await h.change('Item 1 quantity', '2')
        await h.change('Item 1 details (optional)', '300 ml')
        await h.change('Item 1 care (optional)', 'Hand wash.')
        assert.deepEqual(GiftFactsSchema.parse(h.current()).contents, [{ label: 'Ceramic mug', quantity: 2, detail: '300 ml', care: 'Hand wash.' }])
        await h.click('Add included item')
        await h.change('Item 2 name', 'Notebook')
        await h.change('Item 2 quantity', '0')
        assert.equal(GiftFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Item 2 quantity').value, '0')
        await h.change('Item 2 quantity', '1')
        await h.change('Item 1 details (optional)', '')
        assert.deepEqual(GiftFactsSchema.parse(h.current()).contents, [{ label: 'Ceramic mug', quantity: 2, care: 'Hand wash.' }, { label: 'Notebook', quantity: 1 }])
        await h.click('Remove included item 1')
        assert.deepEqual(GiftFactsSchema.parse(h.current()).contents, [{ label: 'Notebook', quantity: 1 }])
        await h.click('Clear contents list')
        assert.equal(h.current(), null)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('occasion and recipient keys use canonical validation and deliberate optional removal', async () => {
    const h = await mount({ suitabilityNote: 'Keep this note.' })
    try {
        await h.click('Add occasion key')
        await h.change('Occasion key 1', 'Birthday')
        assert.equal(GiftFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Occasion key 1').value, 'Birthday')
        await h.change('Occasion key 1', 'birthday')
        await h.click('Add occasion key')
        await h.change('Occasion key 2', 'birthday')
        assert.match(h.container.textContent!, /Category keys must be unique/)
        await h.change('Occasion key 2', 'thank-you')
        await h.click('Add recipient key')
        await h.change('Recipient key 1', 'friend')
        assert.deepEqual(GiftFactsSchema.parse(h.current()).occasions, ['birthday', 'thank-you'])
        assert.deepEqual(GiftFactsSchema.parse(h.current()).recipients, ['friend'])
        await h.click('Clear occasion keys')
        await h.click('Remove recipient key 1')
        assert.deepEqual(GiftFactsSchema.parse(h.current()), { schemaVersion: 1, suitabilityNote: 'Keep this note.' })
        await h.click('Clear all gift facts')
        assert.equal(h.current(), null)
    } finally { await h.close() }
})

test('image role choices use actual product resources and retain invalid choices for correction', async () => {
    const h = await mount({ contents: [{ label: 'Mug', quantity: 1 }] })
    try {
        await h.change('Open-box product image', '0')
        await h.change('Closed-box product image', '1')
        const valid = GiftFactsSchema.parse(h.current())
        assert.equal(validateGiftMediaRoles(valid, ['https://cdn.example.test/open.webp', 'https://cdn.example.test/closed.webp']), true)
        assert.deepEqual(valid.mediaRoles, { openBox: 0, closedBox: 1 })
        await h.change('Closed-box product image', '0')
        assert.equal(GiftFactsSchema.safeParse(h.current()).success, false)
        assert.match(h.container.textContent!, /Open and closed box images must be different/)
        await h.change('Closed-box product image', '1')
        await h.resources({ images: ['https://cdn.example.test/open.webp'], variantOptions: [] })
        assert.equal(h.field('Closed-box product image').value, '1')
        assert.match(h.container.textContent!, /Image roles must refer to supplied product images/)
        await h.change('Closed-box product image', '')
        assert.deepEqual(GiftFactsSchema.parse(h.current()).mediaRoles, { openBox: 0 })
        await h.change('Open-box product image', '')
        assert.equal('mediaRoles' in GiftFactsSchema.parse(h.current()), false)
    } finally { await h.close() }
})

test('disabled facts preserve their controlled payload and cannot emit an edit or submit', async () => {
    const initial = { occasions: ['birthday'], contents: [{ label: 'Mug', quantity: 1 }], mediaRoles: { openBox: 0 } }
    const h = await mount(initial, { disabled: true })
    try {
        for (const control of h.container.querySelectorAll('input,textarea,select,button')) assert.equal(control.matches(':disabled'), true)
        await h.click('Clear all gift facts')
        await h.change('Item 1 name', 'Changed by a synthetic event')
        assert.deepEqual(h.current(), initial)
        assert.deepEqual(h.changes, [])
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('repeated editors have unique labelled controls and hostile merchant text stays inert', async () => {
    const hostile = '<script>gift()</script><img src=x onerror=gift()>'
    const h = await mount({ suitabilityNote: hostile, contents: [{ label: hostile, quantity: 1 }] }, { instances: 2 })
    try {
        const controls = [...h.container.querySelectorAll('input,textarea,select')]
        assert.equal(new Set(controls.map(control => control.id)).size, controls.length)
        for (const control of controls) assert.ok([...h.container.querySelectorAll('label')].some(label => label.htmlFor === control.id))
        assert.equal(h.field('Suitability note (optional)').value, hostile)
        assert.equal(h.container.querySelector('script,img,iframe'), null)
        assert.equal(GiftFactsSchema.safeParse(h.current()).success, true)
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button')
    } finally { await h.close() }
})
