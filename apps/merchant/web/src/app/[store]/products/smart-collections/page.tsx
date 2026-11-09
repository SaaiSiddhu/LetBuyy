'use client'
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageHeader, Card, Section, Button, Input, Textarea, Banner, Badge, Select, Checkbox, ConfirmDialog } from '@letbuyy/ui'
import { Plus, Trash2 } from 'lucide-react'
import { SmartCollectionPageSchema, SmartCollectionSchema, SmartCollectionPreviewSchema,
    CollectionMetadataCommandIntentSchema, confirmCollectionMetadataReceipt, SmartConditionFieldSchema, SmartConditionOpSchema,
    type SmartCollection, type SmartCollectionPage, type SmartCondition, type SmartCollectionPreviewResult } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { readCollectionCommand, retainCollectionCommand, clearCollectionCommand, withCollectionExecution, type SavedCollectionCommand } from '@/lib/products/collection-command-journal'
import { collectionCommandRejection } from '@/lib/products/collection-command-recovery'

type Form = { title: string; slug: string; description: string; match_type: 'all' | 'any'; conditions: SmartCondition[]; is_active: boolean }
const blank = (): Form => ({ title: '', slug: '', description: '', match_type: 'all', conditions: [], is_active: false })
const toForm = (row: SmartCollection): Form => ({ title: row.name, slug: row.slug, description: row.description ?? '', match_type: row.match_type, conditions: row.conditions, is_active: row.is_active })
const fields = { title: 'Title', product_type: 'Product type', vendor: 'Vendor', tag: 'Tag', price: 'Price (₹)', inventory_quantity: 'Inventory quantity' }
const ops = { equals: 'equals', not_equals: 'does not equal', contains: 'contains', starts_with: 'starts with', ends_with: 'ends with', gt: 'is greater than', lt: 'is less than' }
const options = (values: Record<string, string>) => Object.entries(values).map(([value, label]) => ({ value, label }))
export default function SmartCollectionsPage() {
    const { store } = useParams<{ store: string }>(), scope = useMerchantSecurityContext(store)
    if (!scope.siteId) return <Page><Banner variant="critical">Reload the selected store before opening collections.</Banner></Page>
    return <Workspace key={`${scope.actorId}:${scope.siteId}`} store={store} actorId={scope.actorId} siteId={scope.siteId} />
}
function Workspace({ store, actorId, siteId }: { store: string; actorId: string; siteId: string }) {
    const [page, setPage] = useState<SmartCollectionPage | null>(null), [number, setNumber] = useState(1), [search, setSearch] = useState('')
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [denied, setDenied] = useState(false)
    const [pending, setPending] = useState<SavedCollectionCommand | null>(null), [reviewable, setReviewable] = useState(false)
    const [editing, setEditing] = useState<SmartCollection | null>(null), [form, setForm] = useState<Form | null>(null), [discard, setDiscard] = useState(false), [removing, setRemoving] = useState(false)
    const [preview, setPreview] = useState<SmartCollectionPreviewResult | null>(null)
    const [missing, setMissing] = useState(false), [discardMissing, setDiscardMissing] = useState(false)
    const noticeRegion = useRef<HTMLDivElement | null>(null)
    const alive = useRef(false), active = useRef(true), flight = useRef(false), controller = useRef<AbortController | null>(null), epoch = useRef(0)
    useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
    useEffect(() => { if (!busy && (pending || error)) noticeRegion.current?.focus() }, [busy, pending, error])
    const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(editing ? toForm(editing) : blank())
    useEffect(() => {
        if (!dirty || pending) return
        const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent)
    }, [dirty, pending])
    function check() { if (!alive.current || !active.current) throw new Error('Account or store access changed. Reload this store.') }
    function dependencies() {
        if (!navigator.locks) throw new Error('This browser cannot safely retain collection requests. Use a browser with secure request locking.')
        return { storage: window.localStorage, locks: navigator.locks }
    }
    async function request(path: string, method = 'GET', body?: unknown, key?: string) {
        check(); const captured = controller.current!, generation = epoch.current
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/smart-collections${path}`, { method, cache: 'no-store',
            signal: AbortSignal.any([captured.signal, AbortSignal.timeout(20000)]), headers: { 'X-LetBuyy-Merchant-Context': actorId,
                ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'X-Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
        const value = await response.json().catch(() => null); check()
        if (response.status === 401 || response.status === 403 || response.status === 409 && value?.error?.code === 'SESSION_CONTEXT_CHANGED') {
            epoch.current++; active.current = false; setDenied(true); setPage(null); setEditing(null); setForm(null); setPreview(null)
            throw new Error('Store access changed. Reload this store.')
        }
        if (controller.current !== captured || captured.signal.aborted || generation !== epoch.current) throw new Error('A newer access check superseded this request.')
        if (!response.ok) throw Object.assign(new Error(value?.error?.message || 'The collection outcome could not be confirmed.'), { status: response.status, code: value?.error?.code })
        return value
    }
    async function run(work: () => Promise<void>) {
        if (flight.current || !alive.current || !active.current) return
        flight.current = true; controller.current?.abort(); controller.current = new AbortController(); setBusy(true); setError(null); setNotice(null)
        try { await work() } catch (e) { if (alive.current) setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'The collection response could not be confirmed. Keep the original request.') }
        finally { flight.current = false; if (alive.current) setBusy(false) }
    }
    async function load(n = number, term = search) {
        const value = SmartCollectionPageSchema.parse(await request(`?page=${n}&limit=20&search=${encodeURIComponent(term)}`))
        if (value.meta.store_id !== siteId || value.meta.page !== n || value.meta.per_page !== 20) throw new Error('Collection page scope changed.')
        check(); setPage(value); setNumber(n)
    }
    async function refresh() { await run(async () => {
        const { storage, locks } = dependencies(); setPending(await readCollectionCommand({ actorId, siteId }, storage, locks, check)); setReviewable(false); setMissing(false); await load()
    }) }
    useEffect(() => { let retired = false; queueMicrotask(() => { if (!retired) void refresh() }); return () => { retired = true } }, []) // One keyed actor/store lifetime.
    async function fresh(id: string) {
        const value = SmartCollectionSchema.parse((await request(`/${encodeURIComponent(id)}`)).data)
        if (value.id !== id || value.store_id !== siteId) throw new Error('Collection detail scope changed.')
        return value
    }
    async function open(row?: SmartCollection) { await run(async () => {
        if (pending) throw new Error('Recover the original collection request first.')
        const current = row ? await fresh(row.id) : null; setEditing(current); setForm(current ? toForm(current) : blank()); setPreview(null)
    }) }
    async function send(allowMissingDiscard = false) {
        const { storage, locks } = dependencies()
        await withCollectionExecution({ actorId, siteId }, locks, check, async () => {
            const saved = await readCollectionCommand({ actorId, siteId }, storage, locks, check)
            if (!saved) { setPending(null); return }
            setPending(saved); setReviewable(false); setMissing(false)
            if (saved.intent.command.collection_type !== 'smart') throw new Error('A manual collection request is retained. Recover it in Collections.')
            const intent = saved.intent, id = intent.collection_id
            let value: unknown
            try { value = await request(id ? `/${encodeURIComponent(id)}` : '', intent.operation === 'create' ? 'POST' : intent.operation === 'update' ? 'PATCH' : 'DELETE', intent.command, intent.command.idempotency_key) }
            catch (e) {
                const outcome = collectionCommandRejection(intent, e)
                if (outcome === 'missing' && allowMissingDiscard) {
                    await clearCollectionCommand(saved, storage, locks, check)
                    setPending(null); setEditing(null); setForm(null); setPreview(null)
                    setNotice('Rejected request discarded. The collection remains deleted.'); return
                }
                setReviewable(outcome === 'review'); setMissing(outcome === 'missing')
                throw e
            }
            confirmCollectionMetadataReceipt(intent, (value as { data?: unknown })?.data, actorId)
            await clearCollectionCommand(saved, storage, locks, check); setPending(null); setReviewable(false); setEditing(null); setForm(null); setPreview(null)
            setNotice(intent.operation === 'delete' ? 'Collection deleted.' : 'Collection saved.')
        })
        await load()
    }
    async function save(remove = false) { await run(async () => {
        if (!form || pending) return
        const intent = CollectionMetadataCommandIntentSchema.parse({ operation: remove ? 'delete' : editing ? 'update' : 'create', collection_id: editing?.id ?? null,
            command: { store_id: siteId, idempotency_key: crypto.randomUUID(), collection_type: 'smart', ...(editing ? { version: editing.version } : {}),
                ...(remove ? {} : { ...form, title: form.title.trim(), slug: form.slug.trim(), description: form.description || null }) } })
        const { storage, locks } = dependencies(); setPending(await retainCollectionCommand({ actorId, siteId }, intent, storage, locks, check)); setRemoving(false); await send()
    }) }
    async function review() { await run(async () => {
        if (!reviewable || !pending) return
        const { storage, locks } = dependencies()
        await withCollectionExecution({ actorId, siteId }, locks, check, async () => {
            const saved = await readCollectionCommand({ actorId, siteId }, storage, locks, check)
            if (!saved || JSON.stringify(saved) !== JSON.stringify(pending)) throw new Error('The saved request changed. Reload collections.')
            const current = saved.intent.collection_id ? await fresh(saved.intent.collection_id) : null
            // A definite command rejection is required before this action can release its key.
            await clearCollectionCommand(saved, storage, locks, check); setPending(null); setReviewable(false); setEditing(current); setPreview(null)
            // Keep the user's existing draft. Only the observed base revision advances.
            if (!form) {
                const base = current ? toForm(current) : blank(), fields = saved.intent.command
                setForm({ ...base,
                    ...('title' in fields && fields.title !== undefined ? { title: fields.title } : {}),
                    ...('slug' in fields && fields.slug != null ? { slug: fields.slug } : {}),
                    ...('description' in fields && fields.description !== undefined ? { description: fields.description ?? '' } : {}),
                    ...('conditions' in fields && fields.conditions !== undefined ? { conditions: fields.conditions } : {}),
                    ...('match_type' in fields && fields.match_type !== undefined ? { match_type: fields.match_type } : {}),
                    ...('is_active' in fields && fields.is_active !== undefined ? { is_active: fields.is_active } : {}),
                })
            }
            setNotice('Current version loaded. Review your kept edits before starting a new save.')
        })
    }) }
    async function showPreview() { await run(async () => {
        if (!editing || pending) return
        setPreview(null)
        const result = SmartCollectionPreviewSchema.parse((await request(`/${editing.id}/preview`)).data)
        if (result.store_id !== siteId || result.collection_id !== editing.id || result.collection_version !== editing.version) throw new Error('The collection changed. Reload its current version before previewing.')
        setPreview(result)
    }) }
    const disabled = busy || denied || pending !== null
    function condition(index: number, change: Partial<SmartCondition>) { setForm(old => old && ({ ...old, conditions: old.conditions.map((c, i) => i === index ? { ...c, ...change } : c) })) }
    return <Page>
        <PageHeader identity="products" recipe="index" title="Smart collections" description="Include active products automatically using saved rules."
            breadcrumbs={[{ label: 'Products', href: `/${store}/products` }, { label: 'Collections', href: `/${store}/products/collections` }, { label: 'Smart collections' }]} showBreadcrumbs
            primaryAction={{ label: 'Create collection', onClick: () => void open(), disabled: disabled || form !== null || page === null }} />
        <div ref={noticeRegion} tabIndex={-1}>
        {error && <Banner variant="critical" title={denied ? 'Store access changed' : 'Collection unavailable'}>{error}</Banner>}
        {notice && <Banner variant="success">{notice}</Banner>}
        {pending && !denied && <Banner variant="warning" title="Original collection request needs confirmation">
            <p className="m-0">Your original details and save key are retained in this browser. Retry to confirm its outcome.</p>
            <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-3)]">
                <Button disabled={busy} onClick={() => void run(send)}>Retry original collection save</Button>
                {reviewable && <Button disabled={busy} onClick={() => void review()}>Review current version and kept edits</Button>}
                {missing && <Button disabled={busy} onClick={() => setDiscardMissing(true)}>Discard rejected collection request</Button>}
            </div>
        </Banner>}
        </div>
        {!denied && <Card><Section title="Collections" description="Saved published rules also determine the storefront collection's products.">
            <div className="flex flex-wrap items-end gap-[var(--lb-space-2)]">
                <Input label="Search collections" value={search} maxLength={200} disabled={disabled || form !== null} onChange={e => setSearch(e.currentTarget.value)} />
                <Button disabled={disabled || form !== null} onClick={() => void run(() => load(1))}>Search</Button>
                <Button disabled={busy || form !== null} onClick={() => void refresh()}>Reload collections</Button>
            </div>
            {page ? <><p>{page.meta.total} matching collections · Page {page.meta.page}</p>
                {page.data.length === 0 && <p>{page.meta.total ? 'No collections on this page.' : 'No matching smart collections.'}</p>}
                {page.data.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] py-[var(--lb-space-3)]">
                    <div><strong>{row.name}</strong><p>/{row.slug} · {row.conditions.length} rules · {row.match_type === 'all' ? 'All conditions' : 'Any condition'}</p>
                        <Badge label={row.is_active ? 'Published' : 'Unpublished'} variant={row.is_active ? 'success' : 'default'} />
                        <span> · {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Creation date unavailable'}</span></div>
                    <Button disabled={disabled || form !== null} onClick={() => void open(row)}>Edit {row.name}</Button>
                </div>)}
                <div className="flex gap-[var(--lb-space-2)]"><Button disabled={disabled || form !== null || !page.meta.has_prev} onClick={() => void run(() => load(number - 1))}>Previous collections</Button>
                    <Button disabled={disabled || form !== null || !page.meta.has_next} onClick={() => void run(() => load(number + 1))}>Next collections</Button></div>
            </> : <p role="status">{busy ? 'Loading collections…' : 'Collection rows and counts are unavailable. Reload to retry.'}</p>}
        </Section></Card>}
        {form && !denied && <Card><Section title={editing ? 'Edit smart collection' : 'Create smart collection'}>
            <Input label="Collection name" maxLength={200} value={form.title} disabled={disabled} onChange={e => setForm({ ...form, title: e.currentTarget.value })} />
            <Input label="Slug" maxLength={160} value={form.slug} disabled={disabled} onChange={e => setForm({ ...form, slug: e.currentTarget.value })} helperText="Lowercase letters, numbers and hyphens." />
            <Textarea label="Description" maxLength={2000} value={form.description} disabled={disabled} onChange={e => setForm({ ...form, description: e.currentTarget.value })} />
            <Checkbox label="Published on storefront" checked={form.is_active} disabled={disabled} onChange={event => setForm({ ...form, is_active: event.currentTarget.checked })} />
            <Select label="Match type" options={[{ value: 'all', label: 'All conditions' }, { value: 'any', label: 'Any condition' }]} value={form.match_type} disabled={disabled} onChange={e => setForm({ ...form, match_type: e.currentTarget.value as 'all' | 'any' })} />
            {form.conditions.length === 0 && <p>No conditions: all active products are included.</p>}
            {form.conditions.map((c, i) => <div key={i} className="flex flex-wrap items-end gap-[var(--lb-space-2)]">
                <Select label={`Rule ${i + 1} field`} options={options(fields)} value={c.field} disabled={disabled} onChange={e => condition(i, { field: SmartConditionFieldSchema.parse(e.currentTarget.value) })} />
                <Select label={`Rule ${i + 1} operator`} options={options(ops)} value={c.op} disabled={disabled} onChange={e => condition(i, { op: SmartConditionOpSchema.parse(e.currentTarget.value) })} />
                <Input label={`Rule ${i + 1} value`} maxLength={2000} value={c.value} disabled={disabled} onChange={e => condition(i, { value: e.currentTarget.value })} />
                <Button aria-label={`Remove rule ${i + 1}`} disabled={disabled} onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, n) => n !== i) })}><Trash2 size={16} /></Button>
            </div>)}
            <Button disabled={disabled || form.conditions.length >= 50} onClick={() => setForm({ ...form, conditions: [...form.conditions, { field: 'title', op: 'contains', value: '' }] })}><Plus size={16} /> Add condition</Button>
            {editing && <Button disabled={disabled} onClick={() => void showPreview()}>Preview saved rules</Button>}
            {preview && <p role="status">{preview.count_is_exact ? `${preview.count} matching products` : `At least ${preview.count} matches in the evaluated sample; total matches are unknown`}. Evaluated {preview.evaluated_of} of {preview.catalog_count} active products. Preview uses saved rules.</p>}
            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                <Button disabled={disabled || !dirty} onClick={() => void save()}>Save collection</Button>
                <Button disabled={busy || pending !== null} onClick={() => dirty ? setDiscard(true) : (setForm(null), setEditing(null), setPreview(null))}>Close editor</Button>
                {editing && <Button disabled={disabled} onClick={() => setRemoving(true)}>Delete collection</Button>}
            </div>
        </Section></Card>}
        <ConfirmDialog open={discard} title="Discard unsaved collection edits?" description="The saved collection remains unchanged." confirmLabel="Discard edits" onConfirm={() => { setDiscard(false); setForm(null); setEditing(null); setPreview(null) }} onClose={() => setDiscard(false)} />
        <ConfirmDialog open={removing} title="Delete collection?" description="Products remain in your catalog." confirmLabel="Delete collection" onConfirm={() => void save(true)} onClose={() => setRemoving(false)} />
        <ConfirmDialog open={discardMissing} title="Discard rejected collection request?" description="The collection was removed. We will check the original request again before discarding its kept edits." confirmLabel="Discard request" onClose={() => setDiscardMissing(false)} onConfirm={() => { setDiscardMissing(false); void run(() => send(true)) }} />
    </Page>
}
