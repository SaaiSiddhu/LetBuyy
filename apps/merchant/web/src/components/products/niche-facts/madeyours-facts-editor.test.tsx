import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { PersonalizationFactsSchema } from '@letbuyy/commerce-core'

const requireUI = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = requireUI('jsdom') as { JSDOM: new (source: string, options?: { url: string }) => { window: Window & typeof globalThis } }
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
const facts = { version: 1, revision: 1, methods: [{ id: 'engraving', label: 'Front engraving', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front-center', label: 'Centered on the front' }] }] }

async function mount(initial: unknown = undefined, initiallyDisabled = false) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/products/synthetic' })
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'] as const
  const prior = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : dom.window[name] })
  const { createRoot } = await import('react-dom/client')
  const { MadeYoursFactsEditor } = await import('./madeyours-facts-editor')
  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  let value = initial, disabled = initiallyDisabled
  const writes: unknown[] = []
  const render = () => root.render(<MadeYoursFactsEditor value={value} disabled={disabled} onChange={next => { value = next; writes.push(next); render() }} />)
  await act(async () => render())
  const field = (label: string, index = 0): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
    const found = Array.from(container.querySelectorAll<HTMLLabelElement>('label')).filter(node => node.textContent === label)[index]
    assert.ok(found, `Missing label ${label}`)
    const input = dom.window.document.getElementById(found.htmlFor) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    assert.ok(input, `Missing associated input for ${label}`)
    return input
  }
  const set = async (label: string, next: string, index = 0) => { await act(async () => {
    const input = field(label, index)
    const proto = input.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, next)
    input.dispatchEvent(new dom.window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }) }
  const button = (label: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent === label)
    assert.ok(found, `Missing action ${label}`); return found
  }
  const click = async (label: string) => { await act(async () => button(label).click()) }
  const replace = async (next: unknown, nextDisabled = disabled) => { value = next; disabled = nextDisabled; await act(async () => render()) }
  const close = async () => {
    await act(async () => root.unmount()); dom.window.close()
    for (const name of names) { if (prior[name]) Object.defineProperty(globalThis, name, prior[name]!); else Reflect.deleteProperty(globalThis, name) }
  }
  return { dom, container, field, set, button, click, replace, close, writes, value: () => value }
}

test('absent facts stay absent until the merchant explicitly starts a blank draft', async () => {
  const h = await mount()
  try {
    assert.equal(h.value(), undefined); assert.deepEqual(h.writes, [])
    assert.match(h.container.textContent!, /No personalization facts supplied/)
    assert.equal(h.container.querySelector('input'), null)
    await h.click('Add personalization facts')
    assert.deepEqual(h.value(), { version: 1, revision: '', methods: [] })
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    assert.equal(h.field('Personalization revision').value, '')
    assert.match(h.container.textContent!, /before saving the product/)
  } finally { await h.close() }
})

test('real field and array edits emit the complete canonical personalization payload', async () => {
  const h = await mount()
  try {
    await h.click('Add personalization facts'); await h.set('Personalization revision', '2')
    await h.click('Add personalization method')
    await h.set('Method ID', 'engraving'); await h.set('Method label', 'Front engraving')
    await h.set('Minimum characters', '1'); await h.set('Maximum characters', '18')
    await h.set('Allowed characters', 'latin-name')
    await h.click('Add style to method 1'); await h.set('Style ID', 'sans'); await h.set('Style label', 'Sans')
    await h.click('Add placement to method 1'); await h.set('Placement ID', 'front-center'); await h.set('Placement label', 'Centered on the front')
    await h.set('Production note (optional)', 'Dispatch information has not been supplied.')
    assert.deepEqual(PersonalizationFactsSchema.parse(h.value()), { ...facts, revision: 2, production_note: 'Dispatch information has not been supplied.' })
    assert.equal(h.container.querySelector('[aria-invalid="true"]'), null)
    assert.equal(h.container.querySelector('[role="status"]'), null)
    assert.ok(h.writes.length > 10)
    assert.equal(h.container.querySelector('form'), null)
    assert.ok(Array.from(h.container.querySelectorAll('button')).every(button => button.type === 'button'))
  } finally { await h.close() }
})

test('invalid bounds and incomplete values stay editable with canonical linked field errors', async () => {
  const h = await mount(facts)
  try {
    await h.set('Minimum characters', '20')
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    const max = h.field('Maximum characters')
    assert.equal(max.getAttribute('aria-invalid'), 'true')
    const errorId = max.getAttribute('aria-describedby')!
    assert.match(h.dom.window.document.getElementById(errorId)!.textContent!, /Maximum length must be at least/)
    assert.equal(h.field('Minimum characters').value, '20')
    await h.set('Minimum characters', '1'); await h.set('Maximum characters', '')
    assert.equal(h.field('Maximum characters').value, '')
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    await h.set('Maximum characters', '12')
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, true)
  } finally { await h.close() }
})

test('every configured choice can be added, edited and deliberately removed', async () => {
  const h = await mount(facts)
  try {
    await h.click('Add style to method 1'); await h.set('Style ID', 'serif', 1); await h.set('Style label', 'Serif', 1)
    await h.click('Add placement to method 1'); await h.set('Placement ID', 'back', 1); await h.set('Placement label', 'On the back', 1)
    await h.set('Allowed characters', 'unicode-letters')
    let result = PersonalizationFactsSchema.parse(h.value())
    assert.equal(result.methods[0].styles[1].label, 'Serif'); assert.equal(result.methods[0].placements[1].label, 'On the back')
    assert.equal(result.methods[0].character_set, 'unicode-letters')
    await h.click('Remove style 1 from method 1'); await h.click('Remove placement 1 from method 1')
    result = PersonalizationFactsSchema.parse(h.value())
    assert.deepEqual(result.methods[0].styles, [{ id: 'serif', label: 'Serif' }]); assert.deepEqual(result.methods[0].placements, [{ id: 'back', label: 'On the back' }])
    await h.click('Remove method 1')
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    assert.equal(h.container.querySelector('select'), null)
  } finally { await h.close() }
})

test('duplicate choice IDs are shown as canonical errors without dropping the draft', async () => {
  const h = await mount(facts)
  try {
    await h.click('Add style to method 1'); await h.set('Style ID', 'sans', 1); await h.set('Style label', 'Another style', 1)
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    assert.equal(h.field('Style ID', 1).getAttribute('aria-invalid'), 'true')
    assert.match(h.container.textContent!, /Each identifier must appear once/)
    await h.set('Style ID', 'other', 1)
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, true)
  } finally { await h.close() }
})

test('optional note clearing omits it and explicit whole-facts clearing emits null', async () => {
  const h = await mount({ ...facts, production_note: 'Merchant supplied note' })
  try {
    await h.set('Production note (optional)', '')
    assert.equal(Object.hasOwn(PersonalizationFactsSchema.parse(h.value()), 'production_note'), false)
    await h.click('Clear personalization facts')
    assert.equal(h.value(), null); assert.equal(h.writes.at(-1), null)
    assert.equal(h.container.querySelector('input'), null)
    assert.match(h.container.textContent!, /No personalization facts supplied/)
  } finally { await h.close() }
})

test('disabled and bounded-array states block mutations and all labels have unique associations', async () => {
  const method = facts.methods[0]
  const full = { ...facts, methods: Array.from({ length: 4 }, (_, i) => ({ ...method, id: `method-${i}`, styles: Array.from({ length: 8 }, (_, j) => ({ id: `style-${j}`, label: `Style ${j}` })), placements: Array.from({ length: 8 }, (_, j) => ({ id: `place-${j}`, label: `Place ${j}` })) })) }
  const h = await mount(full)
  try {
    assert.equal(h.button('Add personalization method').disabled, true)
    assert.equal(h.button('Add style to method 1').disabled, true); assert.equal(h.button('Add placement to method 1').disabled, true)
    const ids = Array.from(h.container.querySelectorAll('[id]'), node => node.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(Array.from(h.container.querySelectorAll<HTMLLabelElement>('label')).every(label => Boolean(h.dom.window.document.getElementById(label.htmlFor))))
    await h.replace(facts, true)
    assert.ok(Array.from(h.container.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea')).every(control => control.disabled))
    await h.click('Clear personalization facts'); assert.deepEqual(h.writes, [])
    await h.replace(undefined, true); await h.click('Add personalization facts'); assert.deepEqual(h.writes, [])
  } finally { await h.close() }
})

test('hostile text stays text, external values replace drafts, and unknown fields cannot silently pass', async () => {
  const hostile = '<img src=x onerror=alert(1)>'
  const h = await mount({ ...facts, methods: [{ ...facts.methods[0], label: hostile }], production_note: hostile })
  try {
    assert.equal(h.field('Method label').value, hostile); assert.equal(h.field('Production note (optional)').value, hostile)
    assert.equal(h.container.querySelector('img,[onerror],script'), null)
    await h.set('Method label', 'Edited label')
    assert.equal(PersonalizationFactsSchema.parse(h.value()).methods[0].label, 'Edited label')
    await h.replace({ ...facts, revision: 9 }); assert.equal(h.field('Personalization revision').value, '9')
    await h.replace({ ...facts, file_upload: true }); await h.set('Personalization revision', '10')
    assert.equal(PersonalizationFactsSchema.safeParse(h.value()).success, false)
    assert.match(h.container.textContent!, /Unrecognized key/)
  } finally { await h.close() }
})
