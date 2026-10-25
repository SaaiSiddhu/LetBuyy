import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { FoodFactsSchema } from '@letbuyy/commerce-core'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

const { JSDOM } = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))('jsdom') as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
}
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

async function mount(initial: unknown = null, options: { disabled?: boolean; instances?: number; resources?: NicheFactsEditorProps['resources'] } = {}) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/alpha/products/synthetic' })
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Node']
    const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true, writable: true,
        value: name === 'window' || name === 'self' ? dom.window : Reflect.get(dom.window, name),
    })
    const { createRoot } = await import('react-dom/client')
    const { PantryFactsEditor } = await import('./pantry-facts-editor')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let current = initial, submissions = 0
    let resources: NicheFactsEditorProps['resources'] = options.resources ?? { images: [], variantOptions: [] }
    const changes: unknown[] = []
    const render = () => root.render(<form onSubmit={event => { event.preventDefault(); submissions++ }}>
        {Array.from({ length: options.instances ?? 1 }, (_, index) => <PantryFactsEditor key={index} value={current} resources={resources} disabled={options.disabled} onChange={next => {
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


test('unknown food remains absent until edited and clearing the last optional fact removes the namespace', async () => {
    const h = await mount()
    try {
        assert.deepEqual(h.changes, [])
        assert.equal(h.current(), null)
        assert.equal(h.field('Ingredients (optional)').value, '')
        assert.equal(h.field('Net quantity').value, '')
        assert.equal(h.field('Net quantity unit').value, '')
        assert.match(h.container.textContent!, /does not mean allergen-free/)
        assert.equal(h.button('Clear all food facts').disabled, true)
        assert.equal(h.container.querySelectorAll('form').length, 1)
        await h.change('Ingredients (optional)', 'Split red lentils (100%).')
        assert.deepEqual(h.current(), { ingredients: 'Split red lentils (100%).' })
        assert.equal(FoodFactsSchema.parse(h.current()).allergens.status, 'not_supplied')
        await h.change('Ingredients (optional)', '')
        assert.equal(h.current(), null)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('allergen statement and source stay editable while incomplete, then form a canonical supplied statement', async () => {
    const h = await mount({ ingredients: 'Sesame seeds.' })
    try {
        await h.change('Allergen information status', 'supplied')
        assert.equal(FoodFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Allergen statement').getAttribute('aria-invalid'), 'true')
        const errorId = h.field('Allergen statement').getAttribute('aria-describedby')!
        assert.ok(h.container.ownerDocument.getElementById(errorId))
        await h.change('Allergen statement', 'Contains sesame.')
        await h.change('Allergen statement source', 'Merchant package label, October 2026.')
        assert.deepEqual(FoodFactsSchema.parse(h.current()).allergens, { status: 'supplied', statement: 'Contains sesame.', source: 'Merchant package label, October 2026.' })
        await h.change('Allergen information status', 'not_supplied')
        assert.deepEqual(h.current(), { ingredients: 'Sesame seeds.' })
        assert.equal(h.container.querySelector('input[id*="allergen-source"]'), null)
        assert.equal(FoodFactsSchema.parse(h.current()).allergens.status, 'not_supplied')
    } finally { await h.close() }
})

test('net contents require an explicit unit and positive whole quantity, without changing pack count or price', async () => {
    const h = await mount({ storage: 'Keep dry.' })
    try {
        await h.change('Net quantity', '0.25')
        assert.equal(FoodFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Net quantity').value, '0.25')
        assert.equal(h.field('Net quantity').getAttribute('aria-invalid'), 'true')
        await h.change('Net quantity', '250')
        assert.equal(FoodFactsSchema.safeParse(h.current()).success, false, 'No inferred mass unit')
        await h.change('Net quantity unit', 'g')
        await h.change('Preparation instructions (optional)', 'Rinse before cooking.')
        await h.change('Nutrition statement (optional)', 'Nutrition information as printed on the package.')
        const facts = FoodFactsSchema.parse(h.current())
        assert.deepEqual(facts.netQuantity, { value: 250, unit: 'g' })
        assert.equal(facts.storage, 'Keep dry.')
        assert.equal(facts.preparation, 'Rinse before cooking.')
        assert.equal('price' in facts, false)
        assert.equal('packCount' in facts, false)
        await h.click('Clear net quantity')
        assert.equal(FoodFactsSchema.parse(h.current()).netQuantity, null)
        assert.equal(Object.prototype.hasOwnProperty.call(h.current(), 'netQuantity'), false)
        await h.click('Clear all food facts')
        assert.equal(h.current(), null)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('products with options route pack quantities to durable variant facts and permit deliberate common-fact removal', async () => {
    const h = await mount({ netQuantity: { value: 250, unit: 'g' }, ingredients: 'Lentils.' }, { resources: { images: [], variantOptions: [{ name: 'Pack', values: ['250 g', '500 g'] }] } })
    try {
        assert.equal(h.container.querySelector('input[id*="net-value"]'), null)
        assert.match(h.container.textContent!, /each sellable variant/)
        assert.deepEqual(h.changes, [])
        await h.click('Clear net quantity')
        assert.deepEqual(h.current(), { ingredients: 'Lentils.' })
    } finally { await h.close() }
})

test('disabled drafts emit nothing; every control remains labelled and every button avoids submitting the product form', async () => {
    const h = await mount({ ingredients: 'Lentils.', allergens: { status: 'supplied', statement: '', source: '' } }, { disabled: true, instances: 2 })
    try {
        const controls = [...h.container.querySelectorAll('input,select,textarea')]
        const ids = controls.map(control => control.id)
        assert.equal(new Set(ids).size, ids.length)
        for (const control of controls) {
            assert.ok([...h.container.querySelectorAll('label')].some(label => label.htmlFor === control.id))
            assert.equal((control as HTMLInputElement).disabled, true)
        }
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.type, 'button')
        await h.change('Ingredients (optional)', 'Attempted edit')
        await h.click('Clear all food facts')
        assert.deepEqual(h.changes, [])
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})

test('hostile merchant text is retained as plain field text and canonical overlength errors remain visible', async () => {
    const hostile = '<img src=x onerror="attack()"><script>attack()</script>'
    const h = await mount()
    try {
        await h.change('Ingredients (optional)', hostile)
        assert.equal(FoodFactsSchema.parse(h.current()).ingredients, hostile)
        assert.equal(h.field('Ingredients (optional)').value, hostile)
        assert.equal(h.container.querySelector('img,script,[onerror]'), null)
        await h.change('Storage instructions (optional)', 'x'.repeat(2001))
        assert.equal(FoodFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Storage instructions (optional)').getAttribute('aria-invalid'), 'true')
        assert.equal(h.field('Ingredients (optional)').value, hostile)
    } finally { await h.close() }
})
