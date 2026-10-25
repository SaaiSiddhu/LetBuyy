import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { FoodVariantFactsSchema } from '@letbuyy/commerce-core'
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types'

const { JSDOM } = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))('jsdom') as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
}
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

async function mount(initial: unknown = null, options: { disabled?: boolean; instances?: number; resources?: NicheVariantFactsEditorProps['resources']; commonFacts?: unknown } = {}) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/synthetic' })
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Node']
    const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true, writable: true,
        value: name === 'window' || name === 'self' ? dom.window : Reflect.get(dom.window, name),
    })
    const { createRoot } = await import('react-dom/client')
    const { PantryVariantFactsEditor } = await import('./pantry-variant-facts-editor')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let current = initial, submissions = 0
    let resources: NicheVariantFactsEditorProps['resources'] = options.resources ?? { images: [], variantOptions: [] }
    const changes: unknown[] = []
    const render = () => root.render(<form onSubmit={event => { event.preventDefault(); submissions++ }}>
        {Array.from({ length: options.instances ?? 1 }, (_, index) => <PantryVariantFactsEditor key={index} value={current} commonFacts={options.commonFacts} resources={resources} disabled={options.disabled} onChange={next => {
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
        replace: async (next: unknown) => { current = next; await act(async () => render()) },
        resources: async (next: NicheVariantFactsEditorProps['resources']) => { resources = next; await act(async () => render()) },
        close,
    }
}



test('unknown variant contents remain absent and never inherit common product quantity or option labels', async () => {
    for (const initial of [undefined, null, {}, { netQuantity: null }]) {
        const h = await mount(initial, { commonFacts: { netQuantity: { value: 999, unit: 'ml' } }, resources: { images: [], variantOptions: [{ name: 'Pack', values: ['500 g'] }] } })
        try {
            assert.deepEqual(h.changes, [])
            assert.equal(h.field('Variant net quantity').value, '')
            assert.equal(h.field('Variant net quantity unit').value, '')
            assert.match(h.container.textContent!, /Product-level net quantity does not apply/)
            assert.doesNotMatch(h.container.textContent!, /999|500 g/)
            assert.equal(h.container.querySelectorAll('form').length, 1)
        } finally { await h.close() }
    }
})

test('actual controls emit one canonical inline pack fact without identity, pricing or a second save', async () => {
    const h = await mount()
    try {
        await h.change('Variant net quantity unit', 'g')
        assert.deepEqual(h.current(), { netQuantity: { unit: 'g' } })
        assert.equal(FoodVariantFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Variant net quantity').getAttribute('aria-invalid'), 'true')
        const errorId = h.field('Variant net quantity').getAttribute('aria-describedby')!
        assert.ok(h.container.ownerDocument.getElementById(errorId))
        await h.change('Variant net quantity', '250')
        assert.deepEqual(h.current(), { netQuantity: { value: 250, unit: 'g' } })
        assert.deepEqual(FoodVariantFactsSchema.parse(h.current()), { netQuantity: { value: 250, unit: 'g' } })
        assert.equal(h.container.querySelectorAll('input').length, 1)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('partial and invalid quantities remain editable with canonical variant errors until corrected', async () => {
    const h = await mount()
    try {
        await h.change('Variant net quantity', '250')
        assert.equal(FoodVariantFactsSchema.safeParse(h.current()).success, false, 'No inferred unit')
        assert.equal(h.field('Variant net quantity unit').getAttribute('aria-invalid'), 'true')
        await h.change('Variant net quantity unit', 'ml')
        for (const value of ['0', '-1', '0.25', '1000000001']) {
            await h.change('Variant net quantity', value)
            assert.equal(h.field('Variant net quantity').value, value)
            assert.equal(FoodVariantFactsSchema.safeParse(h.current()).success, false)
            assert.equal(h.field('Variant net quantity').getAttribute('aria-invalid'), 'true')
        }
        await h.change('Variant net quantity', '')
        assert.deepEqual(h.current(), { netQuantity: { value: '', unit: 'ml' } })
        assert.equal(FoodVariantFactsSchema.safeParse(h.current()).success, false)
        await h.change('Variant net quantity', '500')
        assert.deepEqual(FoodVariantFactsSchema.parse(h.current()), { netQuantity: { value: 500, unit: 'ml' } })
        await h.change('Variant net quantity unit', '')
        assert.equal(h.field('Variant net quantity').value, '500')
        assert.equal(FoodVariantFactsSchema.safeParse(h.current()).success, false)
        await h.change('Variant net quantity unit', 'g')
        assert.deepEqual(FoodVariantFactsSchema.parse(h.current()), { netQuantity: { value: 500, unit: 'g' } })
    } finally { await h.close() }
})

test('clear removes the variant namespace and switching parent drafts never carries a previous pack forward', async () => {
    const h = await mount({ netQuantity: { value: 250, unit: 'g' } }, { commonFacts: { netQuantity: { value: 999, unit: 'ml' } } })
    try {
        await h.click('Clear variant net contents')
        assert.equal(h.current(), null)
        assert.equal(h.field('Variant net quantity').value, '')
        assert.equal(h.field('Variant net quantity unit').value, '')
        assert.equal(h.button('Clear variant net contents').disabled, true)
        await h.replace({ netQuantity: { value: 500, unit: 'ml' } })
        assert.equal(h.field('Variant net quantity').value, '500')
        assert.equal(h.field('Variant net quantity unit').value, 'ml')
        await h.replace({ netQuantity: null })
        assert.equal(h.field('Variant net quantity').value, '')
        assert.equal(h.field('Variant net quantity unit').value, '')
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('disabled controls emit nothing, labels are unique across variants and buttons cannot submit the parent form', async () => {
    const h = await mount({ netQuantity: { value: 250, unit: 'g' } }, { disabled: true, instances: 2 })
    try {
        const controls = [...h.container.querySelectorAll('input,select')]
        const ids = controls.map(control => control.id)
        assert.equal(new Set(ids).size, ids.length)
        for (const control of controls) {
            assert.ok([...h.container.querySelectorAll('label')].some(label => label.htmlFor === control.id))
            assert.equal((control as HTMLInputElement).disabled, true)
        }
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button')
        await h.change('Variant net quantity', '1000')
        await h.change('Variant net quantity unit', 'ml')
        await h.click('Clear variant net contents')
        assert.deepEqual(h.changes, [])
        assert.deepEqual(h.current(), { netQuantity: { value: 250, unit: 'g' } })
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('variant-only schema rejects product facts and hostile historical input stays escaped and recoverable', async () => {
    const hostile = '<img src=x onerror="attack()"><script>attack()</script>'
    const initial = { ingredients: hostile, [hostile]: true, netQuantity: { value: -1, unit: hostile } }
    const h = await mount(initial)
    try {
        assert.equal(FoodVariantFactsSchema.safeParse(initial).success, false)
        assert.match(h.container.textContent!, /Unrecognized key/)
        assert.equal(h.container.querySelector('img,script,[onerror]'), null)
        assert.equal(h.field('Variant net quantity unit').getAttribute('aria-invalid'), 'true')
        await h.click('Clear variant net contents')
        assert.equal(h.current(), null)
        await h.change('Variant net quantity', '250')
        await h.change('Variant net quantity unit', 'g')
        assert.deepEqual(FoodVariantFactsSchema.parse(h.current()), { netQuantity: { value: 250, unit: 'g' } })
        assert.equal(h.container.querySelector('img,script,[onerror]'), null)
    } finally { await h.close() }
})
