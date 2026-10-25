import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import React, { act } from 'react'
import { BooksFactsSchema } from '@letbuyy/commerce-core'

const uiRequire = createRequire(new URL('../../../../../../../packages/typescript/ui/package.json', import.meta.url))
const { JSDOM } = uiRequire('jsdom') as { JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close: () => void } } }
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

async function mount(initial: unknown = null, initiallyDisabled = false, copies = 1) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://merchant.example.test/sample/products/new' })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'MutationObserver']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : Reflect.get(dom.window, name) })
    const { createRoot } = await import('react-dom/client')
    const { MarginaliaFactsEditor } = await import('./marginalia-facts-editor')
    const container = dom.window.document.getElementById('root')!
    const root = createRoot(container)
    let current: unknown = initial
    let submissions = 0
    const changes: unknown[] = []
    let replace!: (next: unknown) => void
    let setDisabled!: (next: boolean) => void
    function Harness() {
        const [value, setValue] = React.useState<unknown>(() => initial)
        const [disabled, changeDisabled] = React.useState(initiallyDisabled)
        React.useLayoutEffect(() => { current = value; replace = next => setValue(() => next); setDisabled = changeDisabled }, [value])
        return <form onSubmit={event => { event.preventDefault(); submissions += 1 }}>
            {Array.from({ length: copies }, (_, index) => <MarginaliaFactsEditor key={index} value={value} disabled={disabled} onChange={next => { changes.push(next); setValue(() => next) }} />)}
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
    return { container, dom, changes, current: () => current, submissions: () => submissions, field, set, button, click, close,
        replace: async (next: unknown) => { await act(async () => replace(next)) },
        disable: async (next: boolean) => { await act(async () => setDisabled(next)) } }
}

test('unknown stays absent until deliberate type choice; actual bibliography edits produce canonical payload', async () => {
    const h = await mount()
    try {
        assert.equal(h.current(), null); assert.equal(h.changes.length, 0)
        assert.equal(h.field('Product facts type').value, '')
        await h.set('Product facts type', 'book'); assert.deepEqual(h.current(), { kind: 'book' })
        await h.click('Add author'); assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Author 1').getAttribute('aria-invalid'), 'true')
        await h.set('Author 1', 'Mira Sen'); await h.click('Add subject'); await h.set('Subject 1', 'Essays')
        await h.set('Language (optional)', 'Hindi'); await h.set('Print format (optional)', 'paperback'); await h.set('Edition (optional)', 'First edition')
        assert.deepEqual(BooksFactsSchema.parse(h.current()), { kind: 'book', authors: ['Mira Sen'], subjects: ['Essays'], language: 'Hindi', format: 'paperback', edition: 'First edition' })
        assert.equal('isbn' in (h.current() as object), false); assert.equal('pages' in (h.current() as object), false)
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})
test('invalid ISBN is retained with the canonical associated error, then corrected or deliberately omitted', async () => {
    const h = await mount({ kind: 'book' })
    try {
        await h.set('ISBN (optional)', '9780306406158')
        assert.equal(h.field('ISBN (optional)').value, '9780306406158')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        const isbn = h.field('ISBN (optional)'); assert.equal(isbn.getAttribute('aria-invalid'), 'true')
        assert.match(h.dom.window.document.getElementById(isbn.getAttribute('aria-describedby')!)!.textContent!, /valid ISBN-10 or ISBN-13/)
        await h.set('ISBN (optional)', '978-0-306-40615-7')
        const parsed = BooksFactsSchema.parse(h.current()); assert.equal(parsed.kind === 'book' && parsed.isbn, '9780306406157')
        assert.equal(h.field('ISBN (optional)').value, '978-0-306-40615-7')
        await h.set('ISBN (optional)', ''); assert.deepEqual(h.current(), { kind: 'book' })
    } finally { await h.close() }
})
test('partial numeric and dimension drafts remain editable; clearing both dimensions removes the optional object', async () => {
    const h = await mount({ kind: 'book' })
    try {
        await h.set('Printed pages (optional)', '1.')
        assert.equal(h.field('Printed pages (optional)').value, '1.')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        await h.set('Printed pages (optional)', '208'); await h.set('Width (mm, optional)', '140')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Height (mm, optional)').getAttribute('aria-invalid'), 'true')
        await h.set('Height (mm, optional)', '216'); assert.equal(BooksFactsSchema.safeParse(h.current()).success, true)
        await h.set('Width (mm, optional)', ''); assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        await h.set('Height (mm, optional)', ''); assert.deepEqual(h.current(), { kind: 'book', pages: 208 })
        await h.set('Printed pages (optional)', '-1'); assert.equal(h.field('Printed pages (optional)').value, '-1')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
    } finally { await h.close() }
})
test('stationery keeps pages and sheets distinct and type changes remove book-only facts', async () => {
    const h = await mount({ kind: 'book', authors: ['Mira Sen'], isbn: '9780306406157' })
    try {
        await h.set('Product facts type', 'stationery'); assert.deepEqual(h.current(), { kind: 'stationery' })
        assert.doesNotMatch(h.container.textContent!, /ISBN|Excerpt permission|Author 1/)
        await h.set('Paper weight (gsm, optional)', '100'); await h.set('Page count (optional)', '96'); await h.set('Sheet count (optional)', '96')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        assert.equal(h.field('Page count (optional)').getAttribute('aria-invalid'), 'true')
        await h.set('Sheet count (optional)', '48'); await h.set('Ruling (optional)', 'blank'); await h.set('Binding (optional)', 'Thread sewn')
        await h.click('Add included item'); await h.set('Included item 1', 'One notebook')
        assert.deepEqual(BooksFactsSchema.parse(h.current()), { kind: 'stationery', paper_gsm: 100, page_count: 96, sheet_count: 48, ruling: 'blank', binding: 'Thread sewn', included: ['One notebook'] })
        await h.click('Remove included item 1'); assert.equal('included' in (h.current() as object), false)
        assert.equal(h.dom.window.document.activeElement, h.button('Add included item'))
    } finally { await h.close() }
})
test('excerpt never invents permission; incomplete text is retained until explicit rights and attribution or removal', async () => {
    const h = await mount({ kind: 'book' })
    try {
        await h.click('Add reading excerpt')
        assert.equal(h.field('Excerpt permission').value, '')
        await h.set('Excerpt text', 'An original sample, still awaiting permission details.')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        await h.set('Excerpt text', '')
        assert.equal(h.field('Excerpt text').value, '')
        assert.deepEqual(h.current(), { kind: 'book', excerpt: {} })
        await h.set('Excerpt text', 'An original sample, still awaiting permission details.')
        await h.set('Excerpt permission', 'merchant_owned')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        await h.set('Excerpt attribution', 'Sample publisher · original merchant text')
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, true)
        await h.click('Remove reading excerpt'); assert.deepEqual(h.current(), { kind: 'book' })
        assert.equal(h.dom.window.document.activeElement, h.button('Add reading excerpt'))
        await h.click('Remove book and paper facts'); assert.equal(h.current(), null)
        assert.equal(h.button('Remove book and paper facts').disabled, true)
        assert.equal(h.dom.window.document.activeElement, h.container.querySelector('summary'))
    } finally { await h.close() }
})
test('disabled controls cannot emit changes; controlled parent replacement is reflected without stale local state', async () => {
    const initial = { kind: 'book', authors: ['Mira Sen'], excerpt: { text: 'Sample', permission: 'licensed', attribution: 'Sample publisher' } }
    const h = await mount(initial, true)
    try {
        for (const element of h.container.querySelectorAll('input,select,textarea,button')) assert.equal(element.matches(':disabled'), true)
        await h.click('Add author'); await h.set('Author 1', 'Blocked edit'); assert.deepEqual(h.current(), initial); assert.equal(h.changes.length, 0)
        await h.disable(false); await h.set('Author 1', 'Allowed edit'); assert.equal(h.changes.length, 1)
        await h.replace({ kind: 'stationery', paper_gsm: 120 }); assert.equal(h.field('Paper weight (gsm, optional)').value, '120')
        assert.doesNotMatch(h.container.textContent!, /Excerpt text|Author 1/)
    } finally { await h.close() }
})
test('unique labels and safe hostile text work in two real editors inside one parent form', async () => {
    const hostile = '<script>alert(1)</script><img src=x onerror="alert(1)">'
    const h = await mount({ kind: 'book', authors: [hostile] }, false, 2)
    try {
        const ids = Array.from(h.container.querySelectorAll('[id]'), element => element.id)
        assert.equal(ids.length, new Set(ids).size)
        for (const label of h.container.querySelectorAll('label')) assert.ok(h.dom.window.document.getElementById(label.htmlFor))
        for (const button of h.container.querySelectorAll('button')) assert.equal(button.getAttribute('type'), 'button')
        assert.equal(h.container.querySelectorAll('form').length, 1)
        assert.equal(h.container.querySelectorAll('script,[onerror],img').length, 0)
        assert.equal(h.field('Author 1').value, hostile)
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, true)
        await h.click('Remove author 1'); assert.deepEqual(h.current(), { kind: 'book' })
        assert.equal(h.submissions(), 0)
    } finally { await h.close() }
})
test('invalid historical fields remain visibly invalid until a deliberate clear, never silently accepted', async () => {
    const h = await mount({ kind: 'stationery', isbn: '9780306406157', sheet_count: -1 })
    try {
        assert.equal(BooksFactsSchema.safeParse(h.current()).success, false)
        assert.match(h.container.textContent!, /Unrecognized key|unrecognized key/)
        assert.equal(h.field('Sheet count (optional)').getAttribute('aria-invalid'), 'true')
        assert.equal(h.changes.length, 0)
        await h.click('Remove book and paper facts'); assert.equal(h.current(), null)
    } finally { await h.close() }
})
