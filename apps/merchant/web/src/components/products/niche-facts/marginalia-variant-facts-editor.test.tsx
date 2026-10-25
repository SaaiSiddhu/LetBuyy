import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { BooksVariantFactsSchema, mergeBooksVariantFacts } from '@letbuyy/commerce-core'

const uiRequire = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = uiRequire('jsdom') as { JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close: () => void } } }
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

async function mount(initial: unknown = null, commonFacts: unknown = undefined, initiallyDisabled = false, copies = 1) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/sample/products/new' })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'MutationObserver']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : Reflect.get(dom.window, name) })
    const { createRoot } = await import('react-dom/client')
    const { MarginaliaVariantFactsEditor } = await import('./marginalia-variant-facts-editor')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let current: unknown = initial
    let currentCommon: unknown = commonFacts
    let submissions = 0
    const changes: unknown[] = []
    let replace!: (next: unknown) => void
    let setCommon!: (next: unknown) => void
    let setDisabled!: (next: boolean) => void
    function Harness() {
        const [value, setValue] = React.useState<unknown>(() => initial)
        const [common, changeCommon] = React.useState<unknown>(() => commonFacts)
        React.useLayoutEffect(() => { currentCommon = common; setCommon = next => changeCommon(() => next) }, [common])
        const [disabled, changeDisabled] = React.useState(initiallyDisabled)
        React.useLayoutEffect(() => { current = value; replace = next => setValue(() => next); setDisabled = changeDisabled }, [value])
        return <form onSubmit={event => { event.preventDefault(); submissions += 1 }}>
            {Array.from({ length: copies }, (_, index) => <MarginaliaVariantFactsEditor key={index} value={value} commonFacts={common} disabled={disabled} onChange={next => { changes.push(next); setValue(() => next) }} />)}
        </form>
    }
    await act(async () => root.render(<Harness />))
    const field = (label: string) => {
        const match = Array.from(container.querySelectorAll('label')).find(item => item.textContent?.trim() === label)
        assert.ok(match, `Missing field label ${label}`)
        const element = dom.window.document.getElementById(match.htmlFor)
        assert.ok(element instanceof dom.window.HTMLInputElement || element instanceof dom.window.HTMLTextAreaElement || element instanceof dom.window.HTMLSelectElement, label)
        return element
    }
    const set = async (label: string, value: string) => {
        const element = field(label)
        const proto = element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
        await act(async () => {
            Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value)
            element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
        })
    }
    const button = (label: string) => {
        const found = Array.from(container.querySelectorAll('button')).find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label)
        assert.ok(found, `Missing button ${label}`); return found
    }
    const click = async (label: string) => { await act(async () => button(label).click()) }
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    return { container, dom, changes, current: () => current, common: () => currentCommon, submissions: () => submissions, field, set, button, click, close,
        replace: async (next: unknown) => { await act(async () => replace(next)) },
        setCommon: async (next: unknown) => { await act(async () => setCommon(next)) },
        disable: async (next: boolean) => { await act(async () => setDisabled(next)) } }
}

const commonBook = { kind: 'book' as const, authors: ['Mira Sen'], language: 'English', format: 'paperback' as const, pages: 208, dimensions_mm: { width: 140, height: 216 }, isbn: '9780306406157' }
const selectedBook = { kind: 'book' as const, language: 'Hindi', format: 'hardback' as const }

test('book variant requires its own language and format without copying common facts or inventing identity', async () => {
    const h = await mount(null, commonBook)
    try {
        assert.equal(h.current(), null); assert.equal(h.changes.length, 0)
        assert.match(h.container.querySelector('aside')!.textContent!, /English/)
        await h.set('Variant facts type', 'book'); assert.deepEqual(h.current(), { kind: 'book' })
        assert.equal(h.field('Variant language (required)').value, '')
        assert.equal(h.field('Variant print format (required)').value, '')
        assert.equal(h.field('Variant language (required)').required, true)
        assert.equal(h.field('Variant print format (required)').required, true)
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        await h.set('Variant language (required)', 'Hindi'); assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        await h.set('Variant print format (required)', 'hardback'); await h.set('Edition (optional)', 'Translated edition')
        assert.deepEqual(BooksVariantFactsSchema.parse(h.current()), { ...selectedBook, edition: 'Translated edition' })
        for (const key of ['variant_id', 'id', 'sku', 'price', 'pages', 'isbn']) assert.equal(Object.hasOwn(h.current() as object, key), false)
        assert.deepEqual(h.common(), commonBook); assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})
test('omitted optional overrides inherit through the canonical merger; clear emits null and leaves common facts intact', async () => {
    const h = await mount({ ...selectedBook, pages: 240, dimensions_mm: { width: 156, height: 234 }, isbn: '9780306406157' }, commonBook)
    try {
        await h.set('Printed pages (optional)', ''); await h.set('Width (mm, optional)', ''); await h.set('Height (mm, optional)', ''); await h.set('ISBN (optional)', '')
        assert.deepEqual(h.current(), selectedBook)
        const resolved = mergeBooksVariantFacts(commonBook, h.current())
        assert.equal(resolved?.kind === 'book' && resolved.pages, 208)
        assert.deepEqual(resolved?.dimensions_mm, { width: 140, height: 216 })
        assert.equal(resolved?.kind === 'book' && resolved.isbn, '9780306406157')
        assert.equal(h.field('Printed pages (optional)').value, '')
        await h.set('Variant print format (required)', '')
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Variant print format (required)').getAttribute('aria-invalid'), 'true')
        await h.click('Remove variant facts override'); assert.equal(h.current(), null)
        assert.deepEqual(h.common(), commonBook)
        assert.equal(h.dom.window.document.activeElement, h.container.querySelector('summary'))
    } finally { await h.close() }
})
test('partial print dimensions/pages and invalid ISBN stay editable with canonical variant errors', async () => {
    const h = await mount(selectedBook, commonBook)
    try {
        await h.set('Printed pages (optional)', '1.'); assert.equal(h.field('Printed pages (optional)').value, '1.')
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        await h.set('Printed pages (optional)', '240'); await h.set('Width (mm, optional)', '156')
        assert.equal(h.field('Height (mm, optional)').getAttribute('aria-invalid'), 'true')
        await h.set('Height (mm, optional)', '234'); assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, true)
        await h.set('ISBN (optional)', '9780306406158')
        const field = h.field('ISBN (optional)'); assert.equal(field.value, '9780306406158')
        assert.equal(field.getAttribute('aria-invalid'), 'true')
        assert.match(h.dom.window.document.getElementById(field.getAttribute('aria-describedby')!)!.textContent!, /valid ISBN-10 or ISBN-13/)
        await h.set('ISBN (optional)', '978-0-306-40615-7')
        const parsed = BooksVariantFactsSchema.parse(h.current()); assert.equal(parsed.kind === 'book' && parsed.isbn, '9780306406157')
        assert.equal(h.field('ISBN (optional)').value, '978-0-306-40615-7')
    } finally { await h.close() }
})
test('stationery edits keep gsm, ruling, pages/sheets and contents distinct without book-only controls', async () => {
    const h = await mount(null, { kind: 'stationery', binding: 'Thread sewn' })
    try {
        const kind = h.field('Variant facts type') as HTMLSelectElement
        assert.equal(Array.from(kind.options).find(option => option.value === 'book')!.disabled, true)
        await h.set('Variant facts type', 'book'); assert.equal(h.changes.length, 0)
        await h.set('Variant facts type', 'stationery')
        assert.deepEqual(h.current(), { kind: 'stationery' })
        assert.doesNotMatch(h.container.textContent!, /ISBN|Excerpt|Variant language|Variant print format/)
        await h.set('Paper weight (gsm, optional)', '100'); await h.set('Ruling (optional)', 'lined')
        await h.set('Page count (optional)', '96'); await h.set('Sheet count (optional)', '96')
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Page count (optional)').getAttribute('aria-invalid'), 'true')
        await h.set('Sheet count (optional)', '48'); await h.click('Add included item'); await h.set('Included item 1', 'One notebook')
        assert.deepEqual(BooksVariantFactsSchema.parse(h.current()), { kind: 'stationery', paper_gsm: 100, ruling: 'lined', page_count: 96, sheet_count: 48, included: ['One notebook'] })
        await h.click('Remove included item 1'); assert.equal(Object.hasOwn(h.current() as object, 'included'), false)
        assert.equal(h.dom.window.document.activeElement, h.button('Add included item'))
        assert.equal(h.field('Binding (optional)').value, '')
    } finally { await h.close() }
})
test('canonical merger detects an override that conflicts with an inherited sheet count without rewriting the draft', async () => {
    const common = { kind: 'stationery' as const, page_count: 96, sheet_count: 48 }
    const h = await mount({ kind: 'stationery', page_count: 100 }, common)
    try {
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, true)
        assert.equal(mergeBooksVariantFacts(common, h.current()), null)
        assert.match(h.container.textContent!, /do not form valid combined facts/)
        assert.deepEqual(h.current(), { kind: 'stationery', page_count: 100 }); assert.equal(h.changes.length, 0)
        await h.set('Sheet count (optional)', '50')
        assert.equal(mergeBooksVariantFacts(common, h.current())?.kind, 'stationery')
        assert.doesNotMatch(h.container.textContent!, /do not form valid combined facts/)
    } finally { await h.close() }
})
test('common kind constrains selection while an existing mismatched or incomplete draft is preserved for correction', async () => {
    const mismatched = { kind: 'stationery', paper_gsm: 120 }
    const h = await mount(mismatched, commonBook)
    try {
        assert.deepEqual(h.current(), mismatched); assert.equal(h.changes.length, 0)
        assert.equal(h.field('Variant facts type').getAttribute('aria-invalid'), 'true')
        assert.match(h.container.textContent!, /must match the product’s printed book/)
        await h.set('Variant facts type', 'book'); assert.deepEqual(h.current(), { kind: 'book' })
        await h.setCommon({ kind: 'book', pages: -1 })
        assert.match(h.container.querySelector('aside')!.textContent!, /incomplete or invalid/)
        assert.doesNotMatch(h.container.querySelector('aside')!.textContent!, /-1/)
        await h.set('Variant facts type', 'stationery'); assert.deepEqual(h.current(), { kind: 'book' })
    } finally { await h.close() }
})
test('disabled variant edits emit nothing and external value/common changes remain controlled', async () => {
    const h = await mount(selectedBook, commonBook, true)
    try {
        for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(element.matches(':disabled'), true)
        await h.set('Variant language (required)', 'Blocked'); await h.click('Remove variant facts override')
        assert.deepEqual(h.current(), selectedBook); assert.equal(h.changes.length, 0)
        await h.disable(false); await h.set('Edition (optional)', 'Allowed edition'); assert.equal(h.changes.length, 1)
        await h.replace({ kind: 'stationery', paper_gsm: 120 }); assert.equal(h.field('Paper weight (gsm, optional)').value, '120')
        await h.setCommon({ kind: 'stationery' }); assert.notEqual(h.field('Variant facts type').getAttribute('aria-invalid'), 'true')
        assert.equal(h.changes.length, 1)
    } finally { await h.close() }
})
test('two editors keep labels unique, hostile text inert and all actions outside submission', async () => {
    const hostile = '<script>alert(1)</script><img src=x onerror="alert(1)">'
    const h = await mount({ ...selectedBook, authors: [hostile] }, { kind: 'book', authors: [hostile] }, false, 2)
    try {
        const ids = Array.from(h.container.querySelectorAll('[id]'), element => element.id)
        assert.equal(ids.length, new Set(ids).size)
        for (const label of h.container.querySelectorAll('label')) assert.ok(h.dom.window.document.getElementById(label.htmlFor))
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.getAttribute('type'), 'button')
        assert.equal(h.container.querySelectorAll('form').length, 1)
        assert.equal(h.container.querySelectorAll('script,[onerror],img').length, 0)
        assert.equal(h.field('Author 1').value, hostile)
        assert.ok(h.container.querySelector('aside')!.textContent!.includes(hostile))
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, true)
        await h.click('Remove author 1'); assert.deepEqual(h.current(), selectedBook); assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})
test('unsupported nested IDs, SKU and excerpt are canonical errors, never fields or silently accepted data', async () => {
    const initial = { ...selectedBook, variant_id: 'fabricated-id', sku: 'mutable-label', excerpt: { text: 'Not supported here' } }
    const h = await mount(initial)
    try {
        assert.equal(BooksVariantFactsSchema.safeParse(h.current()).success, false)
        assert.match(h.container.textContent!, /Unrecognized key|unrecognized key/)
        assert.equal(h.container.querySelectorAll('input[type="hidden"]').length, 0)
        assert.doesNotMatch(h.container.textContent!, /Excerpt permission|Variant ID|SKU/)
        assert.equal(h.changes.length, 0)
        await h.click('Remove variant facts override'); assert.equal(h.current(), null)
    } finally { await h.close() }
})
