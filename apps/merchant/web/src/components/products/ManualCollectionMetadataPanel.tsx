'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Banner, Button, Card, Checkbox, ConfirmDialog, Input, Section, Textarea } from '@letbuyy/ui'
import { CollectionMetadataSchema, CollectionMetadataCommandIntentSchema, confirmCollectionMetadataReceipt, type CollectionMetadata } from '@letbuyy/shared-types'
import { readCollectionCommand, retainCollectionCommand, clearCollectionCommand, withCollectionExecution, type SavedCollectionCommand } from '@/lib/products/collection-command-journal'
import { collectionCommandRejection } from '@/lib/products/collection-command-recovery'
type Form = { title: string; slug: string; description: string; image_url: string; is_active: boolean }
const blank = (): Form => ({ title: '', slug: '', description: '', image_url: '', is_active: true })
const toForm = (row: CollectionMetadata): Form => ({ title: row.title, slug: row.slug ?? '', description: row.description ?? '', image_url: row.image_url ?? '', is_active: row.is_active === true })
export function ManualCollectionMetadataPanel({ store, actorId, siteId, selected, onClose, onSaved }: {
    store: string; actorId: string; siteId: string; selected: string | null; onClose: () => void; onSaved: () => void
}) {
    const [row, setRow] = useState<CollectionMetadata | null>(null), [form, setForm] = useState<Form | null>(null)
    const [pending, setPending] = useState<SavedCollectionCommand | null>(null), [reviewable, setReviewable] = useState(false)
    const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false), [denied, setDenied] = useState(false)
    const [discard, setDiscard] = useState(false), [remove, setRemove] = useState(false)
    const [missing, setMissing] = useState(false), [discardMissing, setDiscardMissing] = useState(false)
    const noticeRegion = useRef<HTMLDivElement | null>(null)
    const alive = useRef(false), active = useRef(true), flight = useRef(false), controller = useRef<AbortController | null>(null)
    useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
    useEffect(() => { if (!busy && (pending || error)) noticeRegion.current?.focus() }, [busy, pending, error])
    const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(row ? toForm(row) : blank())
    useEffect(() => {
        if (!dirty || pending) return
        const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent)
    }, [dirty, pending])
    function check() { if (!alive.current || !active.current) throw new Error('Store access changed. Reload this store.') }
    function ports() { if (!navigator.locks) throw new Error('Use a browser with secure request locking to save collections.'); return { storage: window.localStorage, locks: navigator.locks } }
    async function request(path: string, method = 'GET', body?: unknown, key?: string) {
        check(); const captured = controller.current!
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections${path}`, { method, cache: 'no-store',
            signal: AbortSignal.any([captured.signal, AbortSignal.timeout(20000)]), headers: { 'X-LetBuyy-Merchant-Context': actorId,
                ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'X-Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
        const value = await response.json().catch(() => null); check()
        if (response.status === 401 || response.status === 403 || response.status === 409 && value?.error?.code === 'SESSION_CONTEXT_CHANGED') {
            active.current = false; setDenied(true); setForm(null); setRow(null); throw new Error('Store access changed. Reload this store.')
        }
        if (captured !== controller.current || captured.signal.aborted) throw new Error('The collection request was superseded.')
        if (!response.ok) throw Object.assign(new Error(value?.error?.message || 'The collection outcome could not be confirmed.'), { status: response.status, code: value?.error?.code })
        return value
    }
    async function run(work: () => Promise<void>) {
        if (flight.current || !alive.current || !active.current) return
        flight.current = true; controller.current?.abort(); controller.current = new AbortController(); setBusy(true); setError(null); setNotice(null)
        try { await work() } catch (e) { if (alive.current) setError(e instanceof Error && e.name !== 'ZodError' ? e.message : 'The collection could not be confirmed. Keep the original request.') }
        finally { flight.current = false; if (alive.current) setBusy(false) }
    }
    async function read(id: string) {
        const value = CollectionMetadataSchema.parse((await request(`/${encodeURIComponent(id)}`)).data)
        if (value.id !== id || value.store_id !== siteId || value.collection_type !== 'manual' || value.deleted_at !== null) throw new Error('The current collection scope changed.')
        return value
    }
    useEffect(() => { let retired = false; queueMicrotask(() => { if (!retired) void run(async () => {
        const { storage, locks } = ports(); const saved = await readCollectionCommand({ actorId, siteId }, storage, locks, check); setPending(saved)
        if (saved || !selected) return
        const current = selected === 'create' ? null : await read(selected)
        setRow(current); setForm(current ? toForm(current) : blank())
    }) }); return () => { retired = true } }, [selected])
    async function send(allowMissingDiscard = false) {
        const { storage, locks } = ports()
        await withCollectionExecution({ actorId, siteId }, locks, check, async () => {
            const saved = await readCollectionCommand({ actorId, siteId }, storage, locks, check)
            if (!saved) { setPending(null); return }
            setPending(saved); setReviewable(false); setMissing(false)
            if (saved.intent.command.collection_type !== 'manual') throw new Error('Recover the retained request in Smart collections.')
            const intent = saved.intent; let value: unknown
            try { value = await request(intent.collection_id ? `/${intent.collection_id}` : '', intent.operation === 'create' ? 'POST' : intent.operation === 'update' ? 'PATCH' : 'DELETE', intent.command, intent.command.idempotency_key) }
            catch (e) {
                const outcome = collectionCommandRejection(intent, e)
                if (outcome === 'missing' && allowMissingDiscard) {
                    // Repeated original command, current actor/store and the
                    // canonical rejection are required after explicit consent.
                    await clearCollectionCommand(saved, storage, locks, check)
                    setPending(null); setForm(null); setRow(null); setNotice('Rejected request discarded. The collection remains deleted.'); onClose(); onSaved(); return
                }
                setReviewable(outcome === 'review'); setMissing(outcome === 'missing'); throw e
            }
            confirmCollectionMetadataReceipt(intent, (value as { data?: unknown })?.data, actorId)
            await clearCollectionCommand(saved, storage, locks, check); setPending(null); setReviewable(false); setForm(null); setRow(null); setNotice(intent.operation === 'delete' ? 'Collection deleted.' : 'Collection saved.'); onClose(); onSaved()
        })
    }
    async function save(deleting = false) { await run(async () => {
        if (!form || pending) return
        const intent = CollectionMetadataCommandIntentSchema.parse({ operation: deleting ? 'delete' : row ? 'update' : 'create', collection_id: row?.id ?? null,
            command: { collection_type: 'manual', store_id: siteId, idempotency_key: crypto.randomUUID(), ...(row ? { version: row.version } : {}),
                ...(deleting ? {} : { ...form, title: form.title.trim(), slug: form.slug || null, description: form.description || null, image_url: form.image_url || null }) } })
        const { storage, locks } = ports(); setPending(await retainCollectionCommand({ actorId, siteId }, intent, storage, locks, check)); setRemove(false); await send()
    }) }
    async function review() { await run(async () => {
        if (!pending || !reviewable) return
        const { storage, locks } = ports()
        await withCollectionExecution({ actorId, siteId }, locks, check, async () => {
            const saved = await readCollectionCommand({ actorId, siteId }, storage, locks, check)
            if (!saved || JSON.stringify(saved) !== JSON.stringify(pending)) throw new Error('The saved request changed. Reload collections.')
            const current = saved.intent.collection_id ? await read(saved.intent.collection_id) : null
            await clearCollectionCommand(saved, storage, locks, check); setPending(null); setReviewable(false); setRow(current)
            if (!form) {
                const base = current ? toForm(current) : blank(), command = saved.intent.command
                setForm({ ...base, ...Object.fromEntries(Object.entries(command).filter(([key]) => Object.hasOwn(base, key))),
                    slug: 'slug' in command ? command.slug ?? '' : base.slug, description: 'description' in command ? command.description ?? '' : base.description, image_url: 'image_url' in command ? command.image_url ?? '' : base.image_url })
            }
            setNotice('Current version loaded. Review your kept edits before starting a new save.')
        })
    }) }
    const disabled = busy || denied || pending !== null
    const close = () => { if (dirty) setDiscard(true); else { setForm(null); setRow(null); onClose() } }
    return <>
        <div ref={noticeRegion} tabIndex={-1}>
        {error && <Banner variant="critical">{error}</Banner>}{notice && <Banner variant="success">{notice}</Banner>}
        {pending && !denied && <Banner variant="warning" title="Original collection request needs confirmation">
            <p className="m-0">The original details and save key are retained.</p>
            <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-3)]">
                <Button disabled={busy || pending.intent.command.collection_type !== 'manual'} onClick={() => void run(send)}>Retry original collection save</Button>
                {pending.intent.command.collection_type === 'smart' && <a href={`/${store}/products/smart-collections`}>Recover in Smart collections</a>}
                {reviewable && <Button disabled={busy} onClick={() => void review()}>Review current version and kept edits</Button>}
                {missing && <Button disabled={busy} onClick={() => setDiscardMissing(true)}>Discard rejected collection request</Button>}
            </div>
        </Banner>}
        </div>
        {form && !denied && <Card><Section title={row ? 'Edit collection details' : 'Create collection'}>
            <Input label="Collection title" maxLength={160} value={form.title} disabled={disabled} onChange={e => setForm({ ...form, title: e.currentTarget.value })} />
            <Input label="Collection slug" maxLength={160} value={form.slug} disabled={disabled} onChange={e => setForm({ ...form, slug: e.currentTarget.value })} />
            <Textarea label="Description" maxLength={1000} value={form.description} disabled={disabled} onChange={e => setForm({ ...form, description: e.currentTarget.value })} />
            <Input label="Image URL" value={form.image_url} disabled={disabled} onChange={e => setForm({ ...form, image_url: e.currentTarget.value })} />
            <Checkbox label="Published on storefront" checked={form.is_active} disabled={disabled} onChange={e => setForm({ ...form, is_active: e.currentTarget.checked })} />
            <Button disabled={disabled || !dirty} onClick={() => void save()}>{row ? 'Save collection' : 'Create collection'}</Button>
            <Button disabled={busy || pending !== null} onClick={close}>Close editor</Button>
            {row && <Button disabled={disabled} onClick={() => setRemove(true)}>Delete collection</Button>}
        </Section></Card>}
        <ConfirmDialog open={discard} title="Discard unsaved collection edits?" description="Your saved collection remains available." confirmLabel="Discard edits" onClose={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setForm(null); setRow(null); onClose() }} />
        <ConfirmDialog open={remove} title="Delete collection?" description="Products remain in your catalog." confirmLabel="Delete collection" onClose={() => setRemove(false)} onConfirm={() => void save(true)} />
        <ConfirmDialog open={discardMissing} title="Discard rejected collection request?" description="The collection was removed. We will check the original request again before discarding its kept edits." confirmLabel="Discard request" onClose={() => setDiscardMissing(false)} onConfirm={() => { setDiscardMissing(false); void run(() => send(true)) }} />
    </>
}
